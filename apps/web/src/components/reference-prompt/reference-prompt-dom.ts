import { currentMessages } from "../../i18n/messages";
import { componentsMessages } from "../components-messages";

// 引用胶囊上显示的名称：提示词里写作“@图片N”，界面按当前语言显示，例如英文为“Image N”。
function chipLabel(token: string) {
  return currentMessages(componentsMessages).imageName(Number(token.slice(3)));
}

/** Serialize chips back to the existing plain-text prompt contract. */
export function readPrompt(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node instanceof HTMLElement) {
    if (node.dataset.reference) return node.dataset.reference;
    if (node.tagName === "BR") return "\n";
  }
  return Array.from(node.childNodes, (child, index) => {
    const block = child instanceof HTMLElement && ["DIV", "P"].includes(child.tagName);
    const text = readPrompt(child);
    return block && index > 0 ? `\n${text === "\n" ? "" : text}` : text;
  }).join("");
}
export function selectionOffset(editor: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.anchorNode || !editor.contains(selection.anchorNode))
    return 0;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(editor);
  range.setEnd(selection.anchorNode, selection.anchorOffset);
  return readPrompt(range.cloneContents()).length;
}
function isReferenceChip(node: Node) {
  return node instanceof HTMLElement && !!node.dataset.reference;
}

function placeWithinToken(range: Range, node: Node, remaining: number, length: number) {
  if (remaining > length) return false;
  if (isReferenceChip(node)) {
    if (remaining === 0) range.setStartBefore(node);
    else range.setStartAfter(node);
    return true;
  }
  if (node.nodeType !== Node.TEXT_NODE) return false;
  range.setStart(node, remaining);
  return true;
}

export function placeCursor(editor: HTMLElement, offset: number) {
  editor.focus();
  const range = document.createRange();
  let remaining = offset;
  function visit(parent: Node): boolean {
    for (const node of parent.childNodes) {
      const length = readPrompt(node).length;
      if (placeWithinToken(range, node, remaining, length)) return true;
      if (!isReferenceChip(node) && remaining < length && visit(node)) return true;
      remaining -= length;
    }
    return false;
  }
  if (!visit(editor)) {
    range.selectNodeContents(editor);
    range.collapse(false);
  }
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export type PromptReference = { id: string; src: string; name?: string; assetId?: string };

export function referenceFor(text: string, references: readonly PromptReference[]) {
  if (!/^@图片[1-9]\d*$/.test(text)) return undefined;
  return references[Number(text.slice(3)) - 1];
}

function editorMatches(
  editor: HTMLElement,
  value: string,
  parts: string[],
  references: readonly PromptReference[],
) {
  const tokens = parts.filter((text) => referenceFor(text, references));
  const chips = Array.from(editor.querySelectorAll<HTMLElement>("[data-reference]"));
  const sameChips =
    tokens.length === chips.length &&
    chips.every((chip, index) => {
      const image = references[Number(tokens[index]?.slice(3)) - 1];
      // 名称也要一致：切换界面语言后重建胶囊，显示新语言的名称。
      return (
        chip.dataset.reference === tokens[index] &&
        chip.dataset.imageId === image?.id &&
        chip.lastElementChild?.textContent === chipLabel(tokens[index] ?? "")
      );
    });
  let textOffset = 0;
  const plainMentions: number[] = [];
  for (const text of parts) {
    if (text === "@") plainMentions.push(textOffset);
    textOffset += text.length;
  }
  const atSigns = Array.from(editor.querySelectorAll<HTMLElement>(".reference-at"));
  const sameAtSigns =
    atSigns.length === plainMentions.length &&
    atSigns.every(
      (at, index) =>
        at.textContent === "@" && Number(at.dataset.mentionStart) === plainMentions[index],
    );
  return readPrompt(editor) === value && sameChips && sameAtSigns;
}

function buildPromptFragment(parts: string[], references: readonly PromptReference[]) {
  const fragment = document.createDocumentFragment();
  let offset = 0;
  for (const text of parts) {
    const start = offset;
    offset += text.length;
    if (text === "@") {
      const at = document.createElement("span");
      at.className = "reference-at";
      at.dataset.mentionStart = String(start);
      at.textContent = text;
      fragment.append(at);
      continue;
    }
    const image = referenceFor(text, references);
    if (!image) {
      fragment.append(document.createTextNode(text));
      continue;
    }
    const chip = document.createElement("span");
    chip.className = "reference-prompt-chip";
    chip.contentEditable = "false";
    chip.dataset.reference = text;
    chip.dataset.imageId = image.id;
    const thumbnail = document.createElement("img");
    thumbnail.src = image.src;
    thumbnail.alt = "";
    const name = document.createElement("span");
    name.textContent = chipLabel(text);
    chip.append(thumbnail, name);
    fragment.append(chip);
  }
  return fragment;
}

export function synchronizePrompt(
  editor: HTMLElement,
  value: string,
  parts: string[],
  references: readonly PromptReference[],
  cursor: number,
  focusPending: boolean,
) {
  if (editorMatches(editor, value, parts, references)) return;
  const focused = document.activeElement === editor;
  const offset = focused ? selectionOffset(editor) : cursor;
  editor.replaceChildren(buildPromptFragment(parts, references));
  if (focused || focusPending) placeCursor(editor, offset);
}

export function focusPrompt(
  rich: HTMLElement | null,
  input: HTMLTextAreaElement | null,
  offset: number,
) {
  if (rich) {
    placeCursor(rich, offset);
    return;
  }
  input?.focus();
  input?.setSelectionRange(offset, offset);
}
