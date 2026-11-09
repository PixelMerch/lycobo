function readBox(bytes: Uint8Array, view: DataView, offset: number, end: number) {
  if (offset + 8 > end) throw new Error("INVALID_VIDEO");
  let size = view.getUint32(offset);
  const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
  let header = 8;
  if (size === 1) {
    if (offset + 16 > end) throw new Error("INVALID_VIDEO");
    const n = view.getBigUint64(offset + 8);
    if (n > BigInt(view.byteLength)) throw new Error("INVALID_VIDEO");
    size = Number(n);
    header = 16;
  }
  if (size === 0) size = end - offset;
  if (size < header || offset + size > end) throw new Error("INVALID_VIDEO");
  return { size, type, header };
}

function readTrackDimensions(
  view: DataView,
  offset: number,
  size: number,
  header: number,
  type: string,
) {
  if (type !== "tkhd" || size < header + 84) return undefined;
  const width = view.getUint32(offset + size - 8) / 65536;
  const height = view.getUint32(offset + size - 4) / 65536;
  if (width <= 0 || height <= 0 || width > 8192 || height > 8192) return undefined;
  return { width: Math.round(width), height: Math.round(height) };
}

function* videoBoxes(bytes: Uint8Array, view: DataView, start: number, end: number) {
  for (let offset = start; offset < end; ) {
    const box = readBox(bytes, view, offset, end);
    yield { ...box, offset };
    offset += box.size;
  }
}

/** Validate ISO BMFF boundaries and read track dimensions without executing an external decoder. */
export function videoDimensions(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0,
    height = 0,
    hasFtyp = false,
    hasMedia = false;
  const walk = (start: number, end: number, depth = 0) => {
    if (depth > 4) throw new Error("INVALID_VIDEO");
    for (const { offset, size, type, header } of videoBoxes(bytes, view, start, end)) {
      hasFtyp ||= depth === 0 && type === "ftyp";
      hasMedia ||= depth === 0 && type === "mdat" && size > header;
      const dimensions = readTrackDimensions(view, offset, size, header, type);
      if (dimensions) {
        width = dimensions.width;
        height = dimensions.height;
      }
      if (["moov", "trak"].includes(type)) walk(offset + header, offset + size, depth + 1);
    }
  };
  walk(0, bytes.length);
  if (!hasFtyp || !hasMedia || !width || !height) throw new Error("INVALID_VIDEO");
  return { width, height };
}
