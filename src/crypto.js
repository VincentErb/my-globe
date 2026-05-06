/**
 * Returns the SHA-256 hash of `str` as a lowercase hex string.
 * Uses the Web Crypto API — available in all modern browsers and Deno.
 */
export async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
