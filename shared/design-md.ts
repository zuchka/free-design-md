import type { DesignSystemData } from "./api";

export interface DesignMdInput {
  title: string;
  description?: string | null;
  data: DesignSystemData;
  customInstructions?: string | null;
}

const COLOR_LABELS: { key: keyof DesignSystemData["colors"]; label: string; token: string }[] = [
  { key: "primary", label: "Primary", token: "primary" },
  { key: "secondary", label: "Secondary", token: "secondary" },
  { key: "accent", label: "Accent", token: "accent" },
  { key: "background", label: "Background", token: "background" },
  { key: "surface", label: "Surface", token: "surface" },
  { key: "text", label: "Text", token: "text" },
  { key: "textMuted", label: "Text Muted", token: "text-muted" },
];

function yamlWeight(value: string | undefined): string {
  if (!value) return "";
  const n = Number(value);
  return Number.isFinite(n) && value.trim() !== "" ? String(n) : JSON.stringify(value);
}

function quote(value: string): string {
  return JSON.stringify(value);
}

export function designSystemToDesignMd(input: DesignMdInput): string {
  const { title, description, data, customInstructions } = input;
  const desc = (description ?? "").trim();
  const ci = (customInstructions ?? "").trim();
  const radius = (data.borders?.radius ?? "").trim();

  const lines: string[] = [];
  lines.push("---");
  lines.push(`name: ${title}`);
  if (desc) lines.push(`description: ${desc}`);

  lines.push("colors:");
  for (const { key, token } of COLOR_LABELS) {
    const v = (data.colors?.[key] ?? "").trim();
    if (v) lines.push(`  ${token}: ${quote(v)}`);
  }

  lines.push("typography:");
  const tp = data.typography;
  const hWeight = yamlWeight(tp.headingWeight);
  const bWeight = yamlWeight(tp.bodyWeight);
  const headingEntries: [string, string][] = [
    ["heading-1", tp.headingSizes?.h1 ?? ""],
    ["heading-2", tp.headingSizes?.h2 ?? ""],
    ["heading-3", tp.headingSizes?.h3 ?? ""],
  ];
  for (const [name, size] of headingEntries) {
    if (!tp.headingFont && !size && !hWeight) continue;
    lines.push(`  ${name}:`);
    if (tp.headingFont) lines.push(`    fontFamily: ${tp.headingFont}`);
    if (size) lines.push(`    fontSize: ${size}`);
    if (hWeight) lines.push(`    fontWeight: ${hWeight}`);
  }
  if (tp.bodyFont || bWeight) {
    lines.push("  body:");
    if (tp.bodyFont) lines.push(`    fontFamily: ${tp.bodyFont}`);
    if (bWeight) lines.push(`    fontWeight: ${bWeight}`);
  }

  if (radius) {
    lines.push("rounded:");
    lines.push(`  md: ${radius}`);
  }
  lines.push("---");
  lines.push("");

  lines.push("## Overview");
  lines.push("");
  if (desc) lines.push(/[.!?]$/.test(desc) ? desc : `${desc}.`);
  if (ci) lines.push(`Custom instructions: ${ci}`);
  if (!desc && !ci) lines.push(`Design system "${title}".`);
  lines.push("");

  const hasColors = COLOR_LABELS.some(({ key }) => (data.colors?.[key] ?? "").trim());
  if (hasColors) {
    lines.push("## Colors");
    lines.push("");
    for (const { key, label, token } of COLOR_LABELS) {
      const v = (data.colors?.[key] ?? "").trim();
      if (v) lines.push(`- **${label}** — \`{colors.${token}}\` — \`${v}\``);
    }
    lines.push("");
  }

  if (tp.headingFont || tp.bodyFont) {
    lines.push("## Typography");
    lines.push("");
    if (tp.headingFont) {
      const sizes = headingEntries.filter(([, s]) => s).map(([n, s]) => `${n.replace("heading-", "h")} ${s}`).join(" / ");
      lines.push(`- **Headings** — \`${tp.headingFont}\`, weight \`${tp.headingWeight ?? ""}\`${sizes ? `. Sizes: ${sizes}.` : "."}`);
    }
    if (tp.bodyFont) lines.push(`- **Body** — \`${tp.bodyFont}\`, weight \`${tp.bodyWeight ?? ""}\`.`);
    lines.push("");
  }

  const slidePadding = (data.spacing?.slidePadding ?? "").trim();
  const elementGap = (data.spacing?.elementGap ?? "").trim();
  if (slidePadding || elementGap) {
    lines.push("## Layout");
    lines.push("");
    if (slidePadding) lines.push(`- Slide padding: \`${slidePadding}\``);
    if (elementGap) lines.push(`- Element gap: \`${elementGap}\``);
    lines.push("");
  }

  const accentWidth = (data.borders?.accentWidth ?? "").trim();
  if (radius || accentWidth) {
    lines.push("## Shapes");
    lines.push("");
    if (radius) lines.push(`- Border radius: \`${radius}\``);
    if (accentWidth) lines.push(`- Accent stripe width: \`${accentWidth}\``);
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
