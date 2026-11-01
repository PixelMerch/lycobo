/**
 * Media type of reference bytes sent to a provider: stored references are PNG, and the worker
 * re-encodes opaque ones as JPEG before upload, so the type is read from the content.
 */
export function referenceType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { mime: "image/jpeg", extension: "jpg" } as const;
  if (
    bytes.length > 11 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  )
    return { mime: "image/webp", extension: "webp" } as const;
  return { mime: "image/png", extension: "png" } as const;
}
