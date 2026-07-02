import type { createClient } from "@/lib/supabase/client"

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024

/**
 * Sube una foto de perfil al bucket público "icons" (mismo bucket que el
 * selector de íconos, ver icon-picker.tsx SubirTab) y devuelve la URL pública.
 */
export async function uploadAvatar(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  file: File
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Solo se admiten imágenes (JPG, PNG, WebP, SVG).")
  }
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    throw new Error("La imagen no puede superar 2 MB.")
  }

  const ext = file.name.split(".").pop() ?? "jpg"
  const path = `${userId}/avatar-${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("icons")
    .upload(path, file, { upsert: false, contentType: file.type })

  if (uploadError) {
    throw new Error(`Error al subir la imagen: ${uploadError.message}`)
  }

  const { data } = supabase.storage.from("icons").getPublicUrl(path)
  return data.publicUrl
}

/**
 * Extrae el path interno (relativo al bucket) de una URL pública del bucket "icons",
 * para poder borrarlo con supabase.storage.from("icons").remove([path]).
 * Devuelve null si la URL no corresponde al bucket "icons".
 */
export function avatarPathFromPublicUrl(url: string): string | null {
  const marker = "/object/public/icons/"
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}
