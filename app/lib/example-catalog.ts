export interface ExampleCatalogEntry {
  slug: string;
  aliases?: string[];
  title: string;
  sourceUrl: string;
  category: string;
  description: string;
  bestFor: string;
}

export const CURATED_EXAMPLE_CATALOG = [
  {
    slug: "stripe",
    title: "Stripe",
    sourceUrl: "https://stripe.com",
    category: "Fintech & Crypto",
    description:
      "Payment infrastructure with crisp typography, restrained surfaces, and violet conversion moments.",
    bestFor: "API docs, fintech onboarding, checkout flows, and B2B SaaS.",
  },
  {
    slug: "intuit",
    title: "Intuit",
    sourceUrl: "https://www.intuit.com",
    category: "Local extras",
    description:
      "Financial product system with practical blue actions, trusted green accents, and utility panels.",
    bestFor: "SMB tools, fintech dashboards, support flows, and account setup.",
  },
  {
    slug: "walmart",
    title: "Walmart",
    sourceUrl: "https://www.walmart.com",
    category: "Local extras",
    description:
      "Retail system with blue commerce chrome, yellow deal signals, and dense product grids.",
    bestFor: "Retail search, marketplace grids, inventory views, and promotion-heavy flows.",
  },
  {
    slug: "apple",
    title: "Apple",
    sourceUrl: "https://www.apple.com",
    category: "Media & Consumer Tech",
    description:
      "Premium consumer-tech system with SF typography, cinematic product imagery, and generous white space.",
    bestFor: "Product launches, hardware pages, editorial commerce, and premium marketing.",
  },
  {
    slug: "shopify",
    title: "Shopify",
    sourceUrl: "https://www.shopify.com",
    category: "E-commerce & Retail",
    description:
      "Commerce-platform system with dark cinematic sections, green accents, and confident merchant storytelling.",
    bestFor: "Commerce platforms, creator tools, marketplace onboarding, and merchant dashboards.",
  },
  {
    slug: "vercel",
    title: "Vercel",
    sourceUrl: "https://vercel.com",
    category: "Developer Tools & IDEs",
    description:
      "Frontend platform system with black-white precision, Geist typography, and code-forward product surfaces.",
    bestFor: "Developer platforms, docs, deployment flows, and infrastructure dashboards.",
  },
  {
    slug: "airbnb",
    title: "Airbnb",
    sourceUrl: "https://www.airbnb.com",
    category: "E-commerce & Retail",
    description:
      "Travel marketplace system with warm coral actions, photography-led cards, and rounded booking UI.",
    bestFor: "Marketplaces, booking flows, listing grids, and hospitality products.",
  },
  {
    slug: "nike",
    title: "Nike",
    sourceUrl: "https://www.nike.com",
    category: "E-commerce & Retail",
    description:
      "Athletic retail system with monochrome UI, bold display type, and full-bleed photography.",
    bestFor: "Sports retail, lifestyle campaigns, product drops, and editorial commerce.",
  },
  {
    slug: "claude",
    title: "Claude",
    sourceUrl: "https://www.anthropic.com/claude",
    category: "AI & LLM Platforms",
    description:
      "AI assistant system with warm editorial surfaces, terracotta accents, and careful prose hierarchy.",
    bestFor: "AI products, research pages, assistant onboarding, and thoughtful SaaS brands.",
  },
  {
    slug: "figma",
    title: "Figma",
    sourceUrl: "https://www.figma.com",
    category: "Design & Creative Tools",
    description:
      "Collaborative design-tool system with vibrant brand colors, playful geometry, and product-led layouts.",
    bestFor: "Creative tools, collaboration apps, design systems, and product education.",
  },
  {
    slug: "linear.app",
    aliases: ["linear"],
    title: "Linear",
    sourceUrl: "https://linear.app",
    category: "Productivity & SaaS",
    description:
      "Issue-tracking system with minimal dark surfaces, precise spacing, and subtle purple accents.",
    bestFor: "Engineering workflows, project management, technical dashboards, and focused SaaS.",
  },
  {
    slug: "notion",
    title: "Notion",
    sourceUrl: "https://www.notion.com",
    category: "Productivity & SaaS",
    description:
      "Workspace system with warm minimalism, serif display moments, and soft document-like surfaces.",
    bestFor: "Knowledge bases, docs tools, workspace apps, and editorial product surfaces.",
  },
  {
    slug: "supabase",
    title: "Supabase",
    sourceUrl: "https://supabase.com",
    category: "Backend, Database & DevOps",
    description:
      "Open-source backend system with dark emerald surfaces, code panels, and developer-first hierarchy.",
    bestFor: "Database tools, API dashboards, developer docs, and backend platforms.",
  },
  {
    slug: "github",
    title: "GitHub",
    sourceUrl: "https://github.com/features",
    category: "Local extras",
    description:
      "Developer platform system with dark code surfaces, Octicon-style UI, and collaboration patterns.",
    bestFor: "Developer workflows, repositories, code review, and platform dashboards.",
  },
  {
    slug: "bmw",
    title: "BMW",
    sourceUrl: "https://www.bmwusa.com",
    category: "Automotive",
    description:
      "Luxury automotive system with austere surfaces, electric blue CTAs, and full-bleed vehicle imagery.",
    bestFor: "Automotive sites, premium product catalogs, configurators, and editorial launches.",
  },
  {
    slug: "spotify",
    title: "Spotify",
    sourceUrl: "https://www.spotify.com",
    category: "Media & Consumer Tech",
    description:
      "Music streaming system with vivid green accents, dark surfaces, bold type, and album-art energy.",
    bestFor: "Music apps, media libraries, creator platforms, and entertainment dashboards.",
  },
  {
    slug: "airtable",
    title: "Airtable",
    sourceUrl: "https://www.airtable.com",
    category: "Design & Creative Tools",
    description:
      "Structured-data product system with white editorial canvas and colorful workflow surfaces.",
    bestFor: "Database tools, workflow builders, spreadsheets, and ops platforms.",
  },
  {
    slug: "binance",
    title: "Binance",
    sourceUrl: "https://www.binance.com",
    category: "Fintech & Crypto",
    description:
      "Crypto exchange system with black-yellow contrast, trading status colors, and urgent transaction UI.",
    bestFor: "Trading apps, crypto dashboards, financial data views, and account flows.",
  },
  {
    slug: "bmw-m",
    title: "BMW M",
    sourceUrl: "https://www.bmw-m.com/en/index.html",
    category: "Automotive",
    description:
      "Performance automotive system with motorsport imagery, near-black surfaces, and M tricolor accents.",
    bestFor: "Performance brands, motorsport pages, premium launches, and high-contrast galleries.",
  },
  {
    slug: "bugatti",
    title: "Bugatti",
    sourceUrl: "https://www.bugatti.com",
    category: "Automotive",
    description:
      "Hypercar system with monochrome austerity, cinematic photography, and monumental display type.",
    bestFor: "Luxury vehicles, rare product launches, editorial galleries, and prestige brands.",
  },
  {
    slug: "cal",
    title: "Cal.com",
    sourceUrl: "https://cal.com",
    category: "Productivity & SaaS",
    description:
      "Scheduling system with clean neutral surfaces, black CTAs, and Cal Sans display hierarchy.",
    bestFor: "Scheduling products, booking flows, productivity tools, and calendar apps.",
  },
  {
    slug: "clay",
    title: "Clay",
    sourceUrl: "https://www.clay.com",
    category: "Design & Creative Tools",
    description:
      "GTM data system with bright art direction, rounded type, and saturated feature cards.",
    bestFor: "Growth tools, data enrichment, GTM platforms, and creative SaaS marketing.",
  },
  {
    slug: "clickhouse",
    title: "ClickHouse",
    sourceUrl: "https://clickhouse.com",
    category: "Backend, Database & DevOps",
    description:
      "Analytics database system with black canvas, electric yellow accents, and code-heavy cards.",
    bestFor: "Database products, analytics infrastructure, documentation, and technical launches.",
  },
  {
    slug: "cohere",
    title: "Cohere",
    sourceUrl: "https://cohere.com",
    category: "AI & LLM Platforms",
    description:
      "Enterprise AI system with editorial white space, mineral surfaces, and data-rich product bands.",
    bestFor: "AI platforms, enterprise search, model pages, and research-to-product narratives.",
  },
  {
    slug: "coinbase",
    title: "Coinbase",
    sourceUrl: "https://www.coinbase.com",
    category: "Fintech & Crypto",
    description:
      "Crypto finance system with clean blue identity, institutional calm, and layered product cards.",
    bestFor: "Fintech apps, wallet flows, trading dashboards, and trusted onboarding.",
  },
  {
    slug: "composio",
    title: "Composio",
    sourceUrl: "https://composio.dev",
    category: "Backend, Database & DevOps",
    description:
      "AI integration platform with dark technical surfaces, blue voltage, and terminal-style mockups.",
    bestFor: "Agent tooling, API integrations, developer dashboards, and docs pages.",
  },
  {
    slug: "cursor",
    title: "Cursor",
    sourceUrl: "https://cursor.com",
    category: "Developer Tools & IDEs",
    description:
      "AI code editor system with warm editorial canvas, orange actions, and code timeline visuals.",
    bestFor: "IDE products, AI coding tools, developer workflows, and product demos.",
  },
  {
    slug: "dell-1996",
    title: "Dell (1996)",
    sourceUrl: "https://web.archive.org/web/19961219154658/http://www.dell.com/",
    category: "Retro Web",
    description:
      "Catalog-era web system with black frames, flat ribbon cards, Times body copy, and GIF-era badges.",
    bestFor: "Retro UI, nostalgia projects, period-accurate web pages, and playful prototypes.",
  },
  {
    slug: "elevenlabs",
    title: "ElevenLabs",
    sourceUrl: "https://elevenlabs.io",
    category: "AI & LLM Platforms",
    description:
      "Voice AI system with off-white editorial surfaces, atmospheric gradients, and subtle black CTAs.",
    bestFor: "Audio tools, AI media products, creator platforms, and narrative landing pages.",
  },
  {
    slug: "expo",
    title: "Expo",
    sourceUrl: "https://expo.dev",
    category: "Developer Tools & IDEs",
    description:
      "React Native platform system with white canvas, code surfaces, and device mockup hero moments.",
    bestFor: "Mobile developer tools, SDK docs, framework pages, and launch sites.",
  },
  {
    slug: "ferrari",
    title: "Ferrari",
    sourceUrl: "https://www.ferrari.com",
    category: "Automotive",
    description:
      "Luxury automotive system with cinematic near-black surfaces, Rosso Corsa accents, and sparse CTAs.",
    bestFor: "Luxury launches, motorsport pages, product galleries, and premium editorial.",
  },
  {
    slug: "framer",
    title: "Framer",
    sourceUrl: "https://www.framer.com",
    category: "Design & Creative Tools",
    description:
      "Website-builder system with black canvas, blue accents, and motion-forward showcase panels.",
    bestFor: "Design tools, website builders, interactive demos, and launch pages.",
  },
  {
    slug: "hashicorp",
    title: "HashiCorp",
    sourceUrl: "https://www.hashicorp.com",
    category: "Backend, Database & DevOps",
    description:
      "Infrastructure system with black enterprise surfaces and per-product accent identities.",
    bestFor: "Cloud tooling, infrastructure products, multi-product docs, and enterprise platforms.",
  },
  {
    slug: "hp",
    title: "HP",
    sourceUrl: "https://www.hp.com",
    category: "Media & Consumer Tech",
    description:
      "PC and printer system with white canvas, HP blue CTAs, geometric type, and angular motifs.",
    bestFor: "Hardware commerce, support portals, enterprise product pages, and device catalogs.",
  },
  {
    slug: "ibm",
    title: "IBM",
    sourceUrl: "https://www.ibm.com",
    category: "Media & Consumer Tech",
    description:
      "Enterprise technology system grounded in Carbon patterns, IBM Plex type, and blue accents.",
    bestFor: "Enterprise SaaS, cloud platforms, technical content, and large-system dashboards.",
  },
  {
    slug: "intercom",
    title: "Intercom",
    sourceUrl: "https://www.intercom.com",
    category: "Productivity & SaaS",
    description:
      "Customer messaging system with cream surfaces, orange AI accents, and product-led cards.",
    bestFor: "Support tools, messaging products, AI assistants, and customer-service platforms.",
  },
  {
    slug: "kraken",
    title: "Kraken",
    sourceUrl: "https://www.kraken.com",
    category: "Fintech & Crypto",
    description:
      "Crypto trading system with dark data-dense surfaces, purple accents, and market UI patterns.",
    bestFor: "Trading platforms, crypto products, financial dashboards, and account flows.",
  },
  {
    slug: "lamborghini",
    title: "Lamborghini",
    sourceUrl: "https://www.lamborghini.com",
    category: "Automotive",
    description:
      "Luxury automotive system with black cathedral surfaces, gold accents, and custom display type.",
    bestFor: "Supercar launches, luxury galleries, immersive product pages, and prestige brands.",
  },
  {
    slug: "lovable",
    title: "Lovable",
    sourceUrl: "https://lovable.dev",
    category: "Developer Tools & IDEs",
    description:
      "AI app-builder system with friendly gradients, playful developer surfaces, and soft product UI.",
    bestFor: "AI builders, prototyping tools, app generators, and friendly developer platforms.",
  },
  {
    slug: "mastercard",
    title: "Mastercard",
    sourceUrl: "https://www.mastercard.com",
    category: "Fintech & Crypto",
    description:
      "Payments-network system with warm cream canvas, orbital pill shapes, and editorial trust signals.",
    bestFor: "Financial networks, payment products, partner portals, and trust-building pages.",
  },
  {
    slug: "meta",
    title: "Meta",
    sourceUrl: "https://www.meta.com",
    category: "E-commerce & Retail",
    description:
      "Consumer-tech retail system with product photography, binary surfaces, and Meta Blue CTAs.",
    bestFor: "Hardware stores, device configurators, product education, and consumer launches.",
  },
  {
    slug: "minimax",
    title: "Minimax",
    sourceUrl: "https://www.minimaxi.com",
    category: "AI & LLM Platforms",
    description:
      "AI model provider system with stark white marketing, black CTAs, and vivid model cards.",
    bestFor: "Model providers, AI product catalogs, docs grids, and pricing pages.",
  },
  {
    slug: "mintlify",
    title: "Mintlify",
    sourceUrl: "https://mintlify.com",
    category: "Productivity & SaaS",
    description:
      "Documentation platform system with sky-gradient heroes, green accents, and dense docs layouts.",
    bestFor: "Docs platforms, developer portals, SDK sites, and technical content systems.",
  },
  {
    slug: "miro",
    title: "Miro",
    sourceUrl: "https://miro.com",
    category: "Design & Creative Tools",
    description:
      "Visual collaboration system with canary yellow brand energy, sticky-note colors, and board mockups.",
    bestFor: "Whiteboards, collaboration tools, workshop products, and planning surfaces.",
  },
  {
    slug: "mistral.ai",
    title: "Mistral AI",
    sourceUrl: "https://mistral.ai",
    category: "AI & LLM Platforms",
    description:
      "Open-weight AI system with engineered minimalism, purple tones, and precise technical surfaces.",
    bestFor: "Model labs, research products, technical docs, and AI platform pages.",
  },
  {
    slug: "mongodb",
    title: "MongoDB",
    sourceUrl: "https://www.mongodb.com",
    category: "Backend, Database & DevOps",
    description:
      "Database system with dark teal hero bands, green CTAs, and documentation-rich product pages.",
    bestFor: "Database products, learning portals, pricing grids, and developer education.",
  },
  {
    slug: "nintendo-2001",
    title: "Nintendo.com (2001)",
    sourceUrl: "https://web.archive.org/web/20010202062500/http://www.nintendo.com/",
    category: "Retro Web",
    description:
      "Y2K console-web system with beveled panels, glowing nav, box-art type, and circuit-board energy.",
    bestFor: "Retro UI, game-themed pages, nostalgia interfaces, and period web prototypes.",
  },
  {
    slug: "nvidia",
    title: "NVIDIA",
    sourceUrl: "https://www.nvidia.com",
    category: "Media & Consumer Tech",
    description:
      "GPU computing system with green-black energy, technical content, and high-performance product pages.",
    bestFor: "AI hardware, compute platforms, technical product launches, and partner pages.",
  },
  {
    slug: "ollama",
    title: "Ollama",
    sourceUrl: "https://ollama.com",
    category: "AI & LLM Platforms",
    description:
      "Local LLM system with terminal-first simplicity, monochrome surfaces, and developer utility.",
    bestFor: "Local AI tools, CLI products, developer onboarding, and minimal docs.",
  },
  {
    slug: "opencode.ai",
    title: "OpenCode AI",
    sourceUrl: "https://opencode.ai",
    category: "AI & LLM Platforms",
    description:
      "AI coding platform with developer-centric dark surfaces and code-first interaction patterns.",
    bestFor: "AI coding products, agent tools, IDE extensions, and technical launch pages.",
  },
  {
    slug: "pinterest",
    title: "Pinterest",
    sourceUrl: "https://www.pinterest.com",
    category: "Media & Consumer Tech",
    description:
      "Visual discovery system with red accents, image masonry, and content-first interaction patterns.",
    bestFor: "Discovery feeds, visual search, creator platforms, and inspiration products.",
  },
  {
    slug: "playstation",
    title: "PlayStation",
    sourceUrl: "https://www.playstation.com",
    category: "Media & Consumer Tech",
    description:
      "Gaming retail system with channel-style surfaces, cyan interaction, and product imagery.",
    bestFor: "Game stores, console pages, entertainment commerce, and immersive product hubs.",
  },
  {
    slug: "posthog",
    title: "PostHog",
    sourceUrl: "https://posthog.com",
    category: "Backend, Database & DevOps",
    description:
      "Product analytics system with playful branding, developer-friendly surfaces, and dark UI moments.",
    bestFor: "Analytics products, devtools, product-led docs, and feature comparison pages.",
  },
  {
    slug: "raycast",
    title: "Raycast",
    sourceUrl: "https://www.raycast.com",
    category: "Developer Tools & IDEs",
    description:
      "Productivity launcher system with sleek dark chrome, gradient accents, and keyboard-first UI.",
    bestFor: "Command palettes, productivity apps, extensions, and power-user tools.",
  },
  {
    slug: "renault",
    title: "Renault",
    sourceUrl: "https://www.renault.com",
    category: "Automotive",
    description:
      "French automotive system with vivid aurora gradients, proprietary type, and sharp buttons.",
    bestFor: "Automotive launches, EV pages, brand campaigns, and configurator surfaces.",
  },
  {
    slug: "replicate",
    title: "Replicate",
    sourceUrl: "https://replicate.com",
    category: "AI & LLM Platforms",
    description:
      "ML API system with clean white canvas, code-forward examples, and model marketplace structure.",
    bestFor: "Model marketplaces, inference APIs, developer docs, and AI tooling.",
  },
  {
    slug: "resend",
    title: "Resend",
    sourceUrl: "https://resend.com",
    category: "Productivity & SaaS",
    description:
      "Email API system with minimal dark surfaces, monospace accents, and developer-grade restraint.",
    bestFor: "Email APIs, devtools, transactional products, and docs-led landing pages.",
  },
  {
    slug: "revolut",
    title: "Revolut",
    sourceUrl: "https://www.revolut.com",
    category: "Fintech & Crypto",
    description:
      "Digital banking system with sleek dark surfaces, gradient cards, and fintech precision.",
    bestFor: "Banking apps, cards, consumer finance, and account onboarding.",
  },
  {
    slug: "runwayml",
    title: "Runway",
    sourceUrl: "https://runwayml.com",
    category: "AI & LLM Platforms",
    description:
      "AI creative-tools system with cinematic dark heroes, paper-white reading bands, and filmic pacing.",
    bestFor: "Creative AI tools, media platforms, video products, and editorial showcases.",
  },
  {
    slug: "sanity",
    title: "Sanity",
    sourceUrl: "https://www.sanity.io",
    category: "Backend, Database & DevOps",
    description:
      "Headless CMS system with dark editorial marketing, mono technical labels, and coral CTAs.",
    bestFor: "CMS products, content platforms, developer docs, and editorial infrastructure.",
  },
  {
    slug: "sentry",
    title: "Sentry",
    sourceUrl: "https://sentry.io",
    category: "Backend, Database & DevOps",
    description:
      "Error monitoring system with dark dashboards, pink-purple accents, and data-dense observability UI.",
    bestFor: "Monitoring tools, observability dashboards, developer alerts, and incident workflows.",
  },
  {
    slug: "slack",
    title: "Slack",
    sourceUrl: "https://slack.com",
    category: "Tree-only upstream item",
    description:
      "Workplace messaging system with aubergine brand color, cream-lavender surfaces, and pill CTAs.",
    bestFor: "Team communication, collaboration tools, onboarding, and messaging products.",
  },
  {
    slug: "spacex",
    title: "SpaceX",
    sourceUrl: "https://www.spacex.com",
    category: "Media & Consumer Tech",
    description:
      "Space technology system with stark black-white contrast, full-bleed imagery, and mission tone.",
    bestFor: "Aerospace, mission pages, cinematic launches, and high-stakes technical brands.",
  },
  {
    slug: "starbucks",
    title: "Starbucks",
    sourceUrl: "https://www.starbucks.com",
    category: "E-commerce & Retail",
    description:
      "Coffee retail system with earth-green palette, warm cream surfaces, and proprietary sans typography.",
    bestFor: "Food retail, loyalty apps, store finders, and consumer promotion pages.",
  },
  {
    slug: "superhuman",
    title: "Superhuman",
    sourceUrl: "https://superhuman.com",
    category: "Developer Tools & IDEs",
    description:
      "Fast email system with premium dark hero surfaces, purple glow, and keyboard-first positioning.",
    bestFor: "Email products, productivity SaaS, power-user tools, and premium onboarding.",
  },
  {
    slug: "tesla",
    title: "Tesla",
    sourceUrl: "https://www.tesla.com",
    category: "Automotive",
    description:
      "Electric vehicle system with radical subtraction, cinematic photography, and minimal chrome.",
    bestFor: "EV pages, configurators, product launches, and direct-to-consumer commerce.",
  },
  {
    slug: "theverge",
    title: "The Verge",
    sourceUrl: "https://www.theverge.com",
    category: "Media & Consumer Tech",
    description:
      "Tech editorial system with acid accents, bold display type, and dense media layouts.",
    bestFor: "Editorial media, tech news, magazine surfaces, and content-rich homepages.",
  },
  {
    slug: "together.ai",
    title: "Together AI",
    sourceUrl: "https://www.together.ai",
    category: "AI & LLM Platforms",
    description:
      "Open-source AI infrastructure system with dark hero bands, gradients, and technical docs structure.",
    bestFor: "AI infrastructure, model APIs, research pages, and developer platforms.",
  },
  {
    slug: "uber",
    title: "Uber",
    sourceUrl: "https://www.uber.com",
    category: "Media & Consumer Tech",
    description:
      "Mobility system with black-white restraint, tight type, urban imagery, and pill controls.",
    bestFor: "Mobility apps, marketplace onboarding, logistics tools, and urban services.",
  },
  {
    slug: "vodafone",
    title: "Vodafone",
    sourceUrl: "https://www.vodafone.com",
    category: "Media & Consumer Tech",
    description:
      "Telecom system with monumental uppercase display, scarlet CTAs, and chaptered content bands.",
    bestFor: "Telecom products, enterprise services, plan pages, and consumer campaigns.",
  },
  {
    slug: "voltagent",
    title: "VoltAgent",
    sourceUrl: "https://voltagent.dev",
    category: "AI & LLM Platforms",
    description:
      "AI agent framework system with void-black canvas, emerald accent, and terminal-native product UI.",
    bestFor: "Agent frameworks, developer tools, observability, and technical docs.",
  },
  {
    slug: "warp",
    title: "Warp",
    sourceUrl: "https://www.warp.dev",
    category: "Developer Tools & IDEs",
    description:
      "Terminal system with warm dark surfaces, understated CTAs, and dense command-line mockups.",
    bestFor: "Terminal apps, command tools, developer productivity, and AI coding workflows.",
  },
  {
    slug: "webflow",
    title: "Webflow",
    sourceUrl: "https://webflow.com",
    category: "Design & Creative Tools",
    description:
      "Visual web-builder system with black-white contrast and multi-color product-category accents.",
    bestFor: "Website builders, design platforms, no-code products, and launch pages.",
  },
  {
    slug: "wired",
    title: "WIRED",
    sourceUrl: "https://www.wired.com",
    category: "Media & Consumer Tech",
    description:
      "Tech magazine system with paper-white density, custom editorial type, and ink-blue links.",
    bestFor: "Editorial media, magazine layouts, article pages, and content subscriptions.",
  },
  {
    slug: "wise",
    title: "Wise",
    sourceUrl: "https://wise.com",
    category: "Fintech & Crypto",
    description:
      "Money-transfer system with lime-green accents, heavy display type, and sage-tinted surfaces.",
    bestFor: "Fintech products, international payments, consumer banking, and pricing explainers.",
  },
  {
    slug: "x.ai",
    title: "xAI",
    sourceUrl: "https://x.ai",
    category: "AI & LLM Platforms",
    description:
      "Frontier AI system with near-black canvas, white pill controls, and cosmic engineering restraint.",
    bestFor: "AI labs, research launches, model products, and stark technical brands.",
  },
  {
    slug: "zapier",
    title: "Zapier",
    sourceUrl: "https://zapier.com",
    category: "Productivity & SaaS",
    description:
      "Automation system with warm cream neutrals, orange CTAs, and friendly workflow storytelling.",
    bestFor: "Automation platforms, workflow builders, integrations, and SMB productivity tools.",
  },
] satisfies ExampleCatalogEntry[];

export const CURATED_EXAMPLE_CANONICAL_SLUGS = CURATED_EXAMPLE_CATALOG.map(
  (entry) => entry.slug,
);

export function getCatalogEntryBySlug(
  slug: string | undefined,
): ExampleCatalogEntry | null {
  if (!slug) return null;
  const normalized = slug.trim().toLowerCase();
  return (
    CURATED_EXAMPLE_CATALOG.find(
      (entry) =>
        entry.slug === normalized || (entry.aliases ?? []).includes(normalized),
    ) ?? null
  );
}
