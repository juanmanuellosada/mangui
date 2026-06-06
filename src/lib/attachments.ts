/**
 * attachments.ts — data-access helpers for movement_attachments.
 *
 * The "attachments" bucket is PRIVATE. Files are always served via
 * signed URLs (createSignedUrl). Paths are stored as relative storage
 * paths, not public URLs.
 */

import { createClient } from "@/lib/supabase/client"
import type { Enums, Tables } from "@/lib/database.types"

// ── Types ─────────────────────────────────────────────────────────────────────

export type AttachmentKind = Enums<"attachment_kind">
export type MovementAttachment = Tables<"movement_attachments">

// ── Validation ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

/**
 * Validates that a file is an accepted type (image/* or application/pdf)
 * and within the size limit (~5 MB). Returns an error message or null.
 */
export function validateAttachmentFile(file: File): string | null {
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    return "Solo se admiten imágenes (JPG, PNG, WebP) o PDF."
  }
  if (file.size > MAX_FILE_SIZE) {
    return "El archivo no puede superar 5 MB."
  }
  return null
}

// ── Upload ────────────────────────────────────────────────────────────────────

interface UploadAttachmentParams {
  file: File
  userId: string
  kind: AttachmentKind
  /** Provide exactly one of movementId, transferId, or statementId. */
  movementId?: string
  transferId?: string
  statementId?: string
}

interface UploadAttachmentResult {
  data: MovementAttachment | null
  error: string | null
}

/**
 * Uploads a file to the "attachments" bucket and inserts a row in
 * movement_attachments. Stores the storage path (not a public URL).
 *
 * Exactly one of movementId, transferId, or statementId must be provided.
 *
 * Upload-then-insert: if the insert fails after a successful upload,
 * the storage object remains (orphaned). The caller can retry from
 * the edit view — consistent with D4 in the design doc.
 */
export async function uploadAttachment({
  file,
  userId,
  kind,
  movementId,
  transferId,
  statementId,
}: UploadAttachmentParams): Promise<UploadAttachmentResult> {
  const validationError = validateAttachmentFile(file)
  if (validationError) {
    return { data: null, error: validationError }
  }

  const supabase = createClient()
  const ext = file.name.split(".").pop() ?? "bin"
  const path = `${userId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload(path, file, { upsert: false, contentType: file.type })

  if (uploadError) {
    return { data: null, error: `Error al subir: ${uploadError.message}` }
  }

  const { data: row, error: insertError } = await supabase
    .from("movement_attachments")
    .insert({
      user_id: userId,
      movement_id: movementId ?? null,
      transfer_id: transferId ?? null,
      statement_id: statementId ?? null,
      kind,
      file_url: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
    })
    .select()
    .single()

  if (insertError) {
    return { data: null, error: `Error al guardar el adjunto: ${insertError.message}` }
  }

  return { data: row, error: null }
}

// ── Delete ────────────────────────────────────────────────────────────────────

interface DeleteAttachmentResult {
  error: string | null
}

/**
 * Deletes a movement_attachments row and the corresponding storage object.
 * Attempts both even if one fails; returns the first error encountered.
 */
export async function deleteAttachment(
  attachmentId: string,
  storagePath: string
): Promise<DeleteAttachmentResult> {
  const supabase = createClient()

  const { error: dbError } = await supabase
    .from("movement_attachments")
    .delete()
    .eq("id", attachmentId)

  const { error: storageError } = await supabase.storage
    .from("attachments")
    .remove([storagePath])

  if (dbError) {
    return { error: `Error al borrar el adjunto: ${dbError.message}` }
  }
  if (storageError) {
    return { error: `Fila borrada pero el archivo no se eliminó: ${storageError.message}` }
  }

  return { error: null }
}

// ── List ──────────────────────────────────────────────────────────────────────

interface ListAttachmentsResult {
  data: MovementAttachment[]
  error: string | null
}

/**
 * Returns all attachments for a given movement, ordered by created_at.
 */
export async function listAttachments(movementId: string): Promise<ListAttachmentsResult> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("movement_attachments")
    .select("*")
    .eq("movement_id", movementId)
    .order("created_at", { ascending: true })

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data ?? [], error: null }
}

/**
 * Returns all attachments for a given transfer, ordered by created_at.
 */
export async function listTransferAttachments(transferId: string): Promise<ListAttachmentsResult> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("movement_attachments")
    .select("*")
    .eq("transfer_id", transferId)
    .order("created_at", { ascending: true })

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data ?? [], error: null }
}

/**
 * Returns all attachments for a given card statement, ordered by created_at.
 * Covers both kind='resumen' and kind='comprobante' linked via statement_id.
 */
export async function listStatementAttachments(statementId: string): Promise<ListAttachmentsResult> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("movement_attachments")
    .select("*")
    .eq("statement_id", statementId)
    .order("created_at", { ascending: true })

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data ?? [], error: null }
}

// ── Signed URL ────────────────────────────────────────────────────────────────

const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour

/**
 * Resolves a viewable signed URL for a private attachment.
 * Returns null if the signed URL could not be generated.
 */
export async function getAttachmentUrl(
  storagePath: string,
  ttlSeconds = SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
  const supabase = createClient()

  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(storagePath, ttlSeconds)

  if (error || !data?.signedUrl) {
    return null
  }

  return data.signedUrl
}
