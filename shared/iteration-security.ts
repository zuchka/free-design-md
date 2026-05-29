import { randomBytes } from "node:crypto";

export const INPUT_CAPS = {
  userPrompt: 1000,
  parentMarkdown: 200_000,
  sectionTarget: 40,
} as const;

const BLOCKLIST: { name: string; pattern: RegExp }[] = [
  { name: "ignore_instructions", pattern: /\bignore\s+(all\s+|previous\s+|the\s+)?(prior\s+)?(instructions?|prompts?|rules?|context|above)\b/i },
  { name: "disregard_above",     pattern: /\bdisregard\s+(everything|all|the|prior|previous|above)\b/i },
  { name: "reveal_system",       pattern: /\b(reveal|show|print|repeat|leak|dump)\s+(the\s+|your\s+)?(all\s+)?(system\s+prompt|instructions?|hidden\s+prompt|instructions?\s+verbatim)\b/i },
  { name: "role_change",         pattern: /\byou\s+are\s+(now|actually|really)\s+(a|an|\w+,)/i },
  { name: "act_as",              pattern: /\bact\s+as\s+(if\s+)?(you\s+(were|are))?/i },
  { name: "developer_mode",      pattern: /\b(dev|developer|admin|jailbreak|dan)\s+mode\b/i },
  { name: "new_instructions",    pattern: /\bnew\s+(instructions?|rules?|directives?)\s*[:;-]/i },
];

export function checkBlocklist(text: string): string | null {
  for (const { name, pattern } of BLOCKLIST) {
    if (pattern.test(text)) return name;
  }
  return null;
}

export function makeNonce(): string {
  return randomBytes(8).toString("hex");
}

export function wrapWithNonce(nonce: string, tag: string, content: string): string {
  return `<${tag}_${nonce}>\n${content}\n</${tag}_${nonce}>`;
}

export function escapeDelimiter(nonce: string, tag: string, content: string): string {
  // Break any literal close-tag occurrence so user-supplied content can't
  // terminate the delimited block. Inserts a zero-width space between '<' and '/'.
  const closing = new RegExp(`</${tag}_${nonce}>`, "gi");
  return content.replace(closing, `<​/${tag}_${nonce}>`);
}

export type OutputCheck = { ok: true } | { ok: false; reason: string };

export function validateOutputShape(markdown: string): OutputCheck {
  if (!markdown || markdown.trim().length === 0) {
    return { ok: false, reason: "empty_output" };
  }
  if (!/^---\s*\n[\s\S]+?\n---\s*\n/.test(markdown)) {
    return { ok: false, reason: "missing_frontmatter" };
  }
  return { ok: true };
}

export function containsSystemPromptLeak(systemPrompt: string, output: string): boolean {
  const probe = systemPrompt.slice(0, 200).trim();
  if (probe.length < 80) return false;
  return output.includes(probe);
}
