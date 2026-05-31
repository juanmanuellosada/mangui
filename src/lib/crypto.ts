import "server-only"

/**
 * AES-256-GCM symmetric encryption for user AI API keys.
 * The key is read from APP_ENCRYPTION_KEY (base64-encoded 32 bytes).
 * Ciphertext format: base64(iv):base64(authTag):base64(ciphertext)
 */

function getEncryptionKey(): Uint8Array {
  const raw = process.env.APP_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      "[crypto] APP_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32"
    )
  }
  const key = Uint8Array.from(Buffer.from(raw, "base64"))
  if (key.length !== 32) {
    throw new Error(
      `[crypto] APP_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}). ` +
        "Generate a valid key with: openssl rand -base64 32"
    )
  }
  return key
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const keyBytes = getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for GCM

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  )

  // AES-GCM produces ciphertext + 16-byte auth tag appended
  const encoded = new TextEncoder().encode(plaintext)
  const cipherWithTag = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    cryptoKey,
    encoded
  )

  const cipherWithTagBytes = new Uint8Array(cipherWithTag)
  const tagOffset = cipherWithTagBytes.length - 16
  const ciphertext = cipherWithTagBytes.subarray(0, tagOffset)
  const tag = cipherWithTagBytes.subarray(tagOffset)

  const ivB64 = Buffer.from(iv).toString("base64")
  const tagB64 = Buffer.from(tag).toString("base64")
  const dataB64 = Buffer.from(ciphertext).toString("base64")

  return `${ivB64}:${tagB64}:${dataB64}`
}

export async function decryptSecret(stored: string): Promise<string> {
  const keyBytes = getEncryptionKey()
  const parts = stored.split(":")
  if (parts.length !== 3) {
    throw new Error("[crypto] Invalid ciphertext format — expected ivB64:tagB64:dataB64")
  }
  const [ivB64, tagB64, dataB64] = parts
  const iv = Uint8Array.from(Buffer.from(ivB64, "base64"))
  const tag = Uint8Array.from(Buffer.from(tagB64, "base64"))
  const ciphertext = Uint8Array.from(Buffer.from(dataB64, "base64"))

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  )

  // WebCrypto expects ciphertext + auth tag concatenated
  const combined = new Uint8Array(ciphertext.length + tag.length)
  combined.set(ciphertext, 0)
  combined.set(tag, ciphertext.length)

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    cryptoKey,
    combined
  )

  return new TextDecoder().decode(decrypted)
}
