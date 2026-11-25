const publicImageOrigin = "https://static.lycobo.com/site-20261125";

/** 为公开展示图生成版本化的 R2 地址。 */
export function publicImageUrl(path: string) {
  return `${publicImageOrigin}${path}`;
}
