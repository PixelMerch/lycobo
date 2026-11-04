/** Validate ISO BMFF boundaries and read track dimensions without executing an external decoder. */
export function videoDimensions(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const name = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  let width = 0,
    height = 0,
    hasFtyp = false,
    hasMedia = false;
  const walk = (start: number, end: number, depth = 0) => {
    if (depth > 4) throw new Error("INVALID_VIDEO");
    for (let offset = start; offset < end; ) {
      if (offset + 8 > end) throw new Error("INVALID_VIDEO");
      let size = view.getUint32(offset);
      const type = name(offset + 4);
      let header = 8;
      if (size === 1) {
        if (offset + 16 > end) throw new Error("INVALID_VIDEO");
        const n = view.getBigUint64(offset + 8);
        if (n > BigInt(bytes.length)) throw new Error("INVALID_VIDEO");
        size = Number(n);
        header = 16;
      }
      if (size === 0) size = end - offset;
      if (size < header || offset + size > end) throw new Error("INVALID_VIDEO");
      if (depth === 0 && type === "ftyp") hasFtyp = true;
      if (depth === 0 && type === "mdat" && size > header) hasMedia = true;
      if (type === "tkhd" && size >= header + 84) {
        const w = view.getUint32(offset + size - 8) / 65536,
          h = view.getUint32(offset + size - 4) / 65536;
        if (w > 0 && h > 0 && w <= 8192 && h <= 8192) {
          width = Math.round(w);
          height = Math.round(h);
        }
      }
      if (["moov", "trak"].includes(type)) walk(offset + header, offset + size, depth + 1);
      offset += size;
    }
  };
  walk(0, bytes.length);
  if (!hasFtyp || !hasMedia || !width || !height) throw new Error("INVALID_VIDEO");
  return { width, height };
}
