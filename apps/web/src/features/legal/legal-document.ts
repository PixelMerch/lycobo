/** 协议与政策的站内地址，均公开访问，不需要登录。 */
export const legalPaths = {
  terms: "/terms",
  privacy: "/privacy",
  refunds: "/refund-policy",
} as const;

/** 法律文本的 id。 */
export type LegalDocumentId = keyof typeof legalPaths;

/** 页面上协议与政策的排列顺序。 */
export const legalDocumentIds: readonly LegalDocumentId[] = ["terms", "privacy", "refunds"];

/** 正文里的一块：字符串是一段文字，数组是一组列表项。 */
export type LegalBlock = string | readonly string[];

/** 一节：小标题与按顺序排列的段落或列表。 */
export type LegalSection = { heading: string; blocks: readonly LegalBlock[] };

/** 一份法律文本：标题、导语与各节；编号由页面按顺序生成。 */
export type LegalDocument = {
  title: string;
  intro: string;
  updatedDate?: string;
  effectiveDate?: string | null;
  sections: readonly LegalSection[];
};

/** 章节定位使用稳定编号，切换界面语言后链接仍指向同一节。 */
export function legalSectionId(document: LegalDocumentId, index: number) {
  return `${document}-section-${index + 1}`;
}
