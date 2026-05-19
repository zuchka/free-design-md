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

// Render a primitive value as a YAML scalar. Pure numbers stay bare; anything
// else gets JSON-quoted so weird characters (commas, hashes, parens) can't
// break parsing downstream.
function yamlScalar(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (/^-?\d+(\.\d+)?(px|rem|em|%)$/.test(trimmed)) return trimmed;
  // Simple bare-identifier keywords (underline, none, solid, etc.) — safe to
  // emit unquoted. Anything with whitespace, hashes, commas, parens, etc.
  // gets quoted to keep the YAML parseable.
  if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmed)) return trimmed;
  return JSON.stringify(trimmed);
}

type Components = NonNullable<DesignSystemData["components"]>;

function pushKV(lines: string[], indent: string, key: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return;
  lines.push(`${indent}${key}: ${yamlScalar(trimmed)}`);
}

function emitComponentsYaml(
  lines: string[],
  components: DesignSystemData["components"] | undefined,
): void {
  if (!components) return;
  const buf: string[] = [];
  const pre = buf.length;

  const buttonPrimary = components.button?.primary;
  const buttonKeys = buttonPrimary
    ? (["background", "color", "radius", "padding", "fontSize", "fontWeight", "border"] as const).filter(
        (k) => buttonPrimary[k] && buttonPrimary[k].trim(),
      )
    : [];
  const card = components.card;
  const cardKeys = card
    ? (["background", "color", "radius", "padding", "border", "shadow"] as const).filter(
        (k) => card[k] && card[k].trim(),
      )
    : [];
  const link = components.link;
  const linkKeys = link
    ? (["color", "textDecoration", "fontWeight"] as const).filter(
        (k) => link[k] && link[k].trim(),
      )
    : [];
  const headings = components.headings;
  const headingLevels = (["h1", "h2", "h3"] as const).filter((lvl) => {
    const h = headings?.[lvl];
    return h && (h.lineHeight || h.letterSpacing || h.color);
  });

  if (!buttonKeys.length && !cardKeys.length && !linkKeys.length && !headingLevels.length) return;

  buf.push("components:");
  if (buttonKeys.length) {
    buf.push("  button:");
    buf.push("    primary:");
    for (const k of buttonKeys) pushKV(buf, "      ", k, buttonPrimary![k]);
  }
  if (cardKeys.length) {
    buf.push("  card:");
    for (const k of cardKeys) pushKV(buf, "    ", k, card![k]);
  }
  if (linkKeys.length) {
    buf.push("  link:");
    for (const k of linkKeys) pushKV(buf, "    ", k, link![k]);
  }
  if (headingLevels.length) {
    buf.push("  headings:");
    for (const lvl of headingLevels) {
      const h = headings![lvl]!;
      buf.push(`    ${lvl}:`);
      pushKV(buf, "      ", "lineHeight", h.lineHeight);
      pushKV(buf, "      ", "letterSpacing", h.letterSpacing);
      pushKV(buf, "      ", "color", h.color);
    }
  }

  if (buf.length > pre) lines.push(...buf);
}

function emitComponentsProse(
  lines: string[],
  components: DesignSystemData["components"] | undefined,
): void {
  if (!components) return;
  const buttonPrimary = components.button?.primary;
  const card = components.card;
  const link = components.link;
  const headings = components.headings;

  const buttonHasAny =
    buttonPrimary &&
    (["background", "color", "radius", "padding", "fontSize", "fontWeight", "border"] as const).some(
      (k) => buttonPrimary[k] && buttonPrimary[k].trim(),
    );
  const cardHasAny =
    card &&
    (["background", "color", "radius", "padding", "border", "shadow"] as const).some(
      (k) => card[k] && card[k].trim(),
    );
  const linkHasAny =
    link &&
    (["color", "textDecoration", "fontWeight"] as const).some(
      (k) => link[k] && link[k].trim(),
    );
  const headingHasAny =
    headings &&
    (["h1", "h2", "h3"] as const).some((lvl) => {
      const h = headings[lvl];
      return h && (h.lineHeight || h.letterSpacing || h.color);
    });

  if (!buttonHasAny && !cardHasAny && !linkHasAny && !headingHasAny) return;

  lines.push("## Components");
  lines.push("");

  if (buttonHasAny) {
    lines.push("### Button (primary)");
    lines.push("");
    if (buttonPrimary!.background)
      lines.push(`- Background — \`{components.button.primary.background}\` — \`${buttonPrimary!.background}\``);
    if (buttonPrimary!.color)
      lines.push(`- Color — \`${buttonPrimary!.color}\``);
    if (buttonPrimary!.radius)
      lines.push(`- Radius — \`${buttonPrimary!.radius}\``);
    if (buttonPrimary!.padding)
      lines.push(`- Padding — \`${buttonPrimary!.padding}\``);
    if (buttonPrimary!.fontSize || buttonPrimary!.fontWeight) {
      const parts = [buttonPrimary!.fontSize, buttonPrimary!.fontWeight].filter(Boolean);
      lines.push(`- Font — \`${parts.join(" / ")}\``);
    }
    if (buttonPrimary!.border)
      lines.push(`- Border — \`${buttonPrimary!.border}\``);
    lines.push("");
  }

  if (cardHasAny) {
    lines.push("### Card");
    lines.push("");
    if (card!.background)
      lines.push(`- Background — \`{components.card.background}\` — \`${card!.background}\``);
    if (card!.color) lines.push(`- Color — \`${card!.color}\``);
    if (card!.radius) lines.push(`- Radius — \`${card!.radius}\``);
    if (card!.padding) lines.push(`- Padding — \`${card!.padding}\``);
    if (card!.border) lines.push(`- Border — \`${card!.border}\``);
    if (card!.shadow) lines.push(`- Shadow — \`${card!.shadow}\``);
    lines.push("");
  }

  if (linkHasAny) {
    lines.push("### Link");
    lines.push("");
    if (link!.color)
      lines.push(`- Color — \`{components.link.color}\` — \`${link!.color}\``);
    if (link!.textDecoration)
      lines.push(`- Decoration — \`${link!.textDecoration}\``);
    if (link!.fontWeight)
      lines.push(`- Weight — \`${link!.fontWeight}\``);
    lines.push("");
  }

  if (headingHasAny) {
    lines.push("### Headings");
    lines.push("");
    for (const lvl of ["h1", "h2", "h3"] as const) {
      const h = headings![lvl];
      if (!h || (!h.lineHeight && !h.letterSpacing && !h.color)) continue;
      const parts: string[] = [];
      if (h.lineHeight) parts.push(`line-height \`${h.lineHeight}\``);
      if (h.letterSpacing) parts.push(`letter-spacing \`${h.letterSpacing}\``);
      if (h.color) parts.push(`color \`${h.color}\``);
      lines.push(`- **${lvl}** — ${parts.join(", ")}.`);
    }
    lines.push("");
  }
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
  const headingStack = (tp.headingFontStack ?? "").trim();
  const bodyStack = (tp.bodyFontStack ?? "").trim();
  for (const [name, size] of headingEntries) {
    if (!tp.headingFont && !size && !hWeight) continue;
    lines.push(`  ${name}:`);
    if (tp.headingFont) lines.push(`    fontFamily: ${tp.headingFont}`);
    // Emit the full fallback stack so agents reading design.md see the
    // brand's intended chain (e.g. "ui-serif, Georgia, ..., serif") rather
    // than guessing from the primary font name alone.
    if (headingStack && headingStack !== tp.headingFont) {
      lines.push(`    fontFamilyStack: ${quote(headingStack)}`);
    }
    if (size) lines.push(`    fontSize: ${size}`);
    if (hWeight) lines.push(`    fontWeight: ${hWeight}`);
  }
  if (tp.bodyFont || bWeight) {
    lines.push("  body:");
    if (tp.bodyFont) lines.push(`    fontFamily: ${tp.bodyFont}`);
    if (bodyStack && bodyStack !== tp.bodyFont) {
      lines.push(`    fontFamilyStack: ${quote(bodyStack)}`);
    }
    if (bWeight) lines.push(`    fontWeight: ${bWeight}`);
  }

  // Semantic radii — agents reading this design.md key off the explicit names.
  // Falls back to the legacy single-value `md:` line when the semantic block
  // isn't populated (pre-C4 design systems).
  const radii = data.borders?.radii;
  const buttonRadius = (radii?.button ?? "").trim();
  const cardRadius = (radii?.card ?? "").trim();
  const pillRadius = (radii?.pill ?? "").trim();
  const hasAnyRadius = !!(
    radius ||
    buttonRadius ||
    cardRadius ||
    pillRadius
  );
  if (hasAnyRadius) {
    lines.push("rounded:");
    if (radius) lines.push(`  md: ${radius}`);
    if (buttonRadius) lines.push(`  button: ${buttonRadius}`);
    if (cardRadius) lines.push(`  card: ${cardRadius}`);
    if (pillRadius) lines.push(`  pill: ${pillRadius}`);
  }

  const spacingScale = data.spacing?.scale;
  if (spacingScale && spacingScale.length > 0) {
    const items = spacingScale.map((v) => quote(v)).join(", ");
    lines.push("spacing:");
    lines.push(`  scale: [${items}]`);
  }

  emitComponentsYaml(lines, data.components);
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

  if (spacingScale && spacingScale.length > 0) {
    lines.push("## Spacing");
    lines.push("");
    lines.push(`- Scale: \`${spacingScale.join(" / ")}\``);
    lines.push("");
  }

  emitComponentsProse(lines, data.components);

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
