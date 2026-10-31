/** Reference tokens and punctuation alone do not describe a new generation. */
export function hasPromptDescription(prompt: string): boolean {
  const description = prompt.replace(/@图片[1-9]\d*|@/g, "");
  return /[\p{L}\p{N}]/u.test(description);
}
