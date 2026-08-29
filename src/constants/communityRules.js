// src/constants/communityRules.js

// ─── Default rules (fallback) ─────────────────────────────────────
const DEFAULT_RULES = [
  'Be respectful. No harassment, hate speech, or bullying.',
  'Stay on topic for this community.',
  'No spam, scams, or repeated advertising.',
  'No NSFW, nudity, or sexual content.',
  'No sharing of others’ private information (doxxing).',
  'Follow ECHO’s community guidelines and terms of service.',
  'Do not impersonate others or create fake accounts.',
  'Report violations to the community moderators.',
];

// ─── Rules by category ────────────────────────────────────────────
const BY_NAME = {
  // ─── Gaming ──────────────────────────────────────────────────────
  gaming: [
    'Talk about games, players, gaming culture, and esports.',
    'No cheating, hacking, or discussion of exploits that harm others.',
    'No harassment or toxic behavior in game‑related discussions.',
    'No NSFW content or inappropriate game mods.',
    'Credit artists and creators when sharing fan art or mods.',
    'No promoting illegal game copies or pirated content.',
    'Be fair when sharing tips, guides, and links.',
    'Respect other players’ skill levels and preferences.',
  ],

  // ─── Music ──────────────────────────────────────────────────────
  music: [
    'Share music, artists, playlists, and music news respectfully.',
    'Credit artists and creators when sharing their work.',
    'No piracy links or illegal downloads.',
    'No NSFW content or explicit lyrics without proper warning.',
    'Respect different musical tastes and genres.',
    'No self‑promotion unless allowed by the community.',
    'Keep discussions civil – no artist bashing.',
    'Use spoiler tags for unreleased or leaked content (if any).',
  ],

  // ─── Technology ──────────────────────────────────────────────────
  technology: [
    'Discuss tech, coding, gadgets, and innovations helpfully.',
    'No malware, hacking tools, or harmful scripts.',
    'No scams, pyramid schemes, or fake “get rich” tech offers.',
    'No NSFW content or offensive tech jokes.',
    'Cite sources for technical claims where possible.',
    'Be constructive when giving feedback or troubleshooting.',
    'No promoting illegal or unethical tech practices.',
    'Respect intellectual property – share only with proper attribution.',
  ],

  // ─── Movies & Film ──────────────────────────────────────────────
  movies: [
    'Discuss films, shows, actors, and cinema.',
    'Mark spoilers clearly – use warnings before revealing plot points.',
    'Be kind about others’ opinions and tastes.',
    'No piracy links or illegal streaming sources.',
    'No NSFW content without warning (e.g., violent scenes).',
    'No spam or repeated self‑promotion of your own film projects.',
    'Respect copyright – share only official clips or trailers.',
    'Keep discussions constructive and avoid personal attacks.',
  ],

  // ─── Art & Design ──────────────────────────────────────────────
  art: [
    'Share original art or clearly credit the source.',
    'No tracing or claiming others’ work as your own.',
    'No NSFW or adult‑only art – keep it safe for all.',
    'Give constructive feedback – no harsh or destructive criticism.',
    'No spam or advertising of art services without permission.',
    'Respect the artistic process and different styles.',
    'No AI‑generated art claiming to be original (disclose if it’s AI).',
    'Be supportive and encourage creativity.',
  ],

  // ─── Fitness & Health ──────────────────────────────────────────
  fitness: [
    'Encourage healthy habits – no body shaming or negative comments.',
    'This is not a substitute for professional medical advice.',
    'No dangerous challenge pressure – always consult a doctor.',
    'No NSFW content or inappropriate fitness images.',
    'Do not promote harmful supplements or illegal substances.',
    'Share only credible health and fitness information.',
    'Be respectful of different fitness levels and goals.',
    'No spam or repetitive self‑promotion of coaching services.',
  ],

  // ─── Books & Reading ────────────────────────────────────────────
  books: [
    'Discuss books, authors, reading lists, and literature.',
    'Mark spoilers clearly – use warnings before revealing major plot points.',
    'Respect different reading tastes and genres.',
    'No piracy links or illegal ebook sharing.',
    'No NSFW content without proper warnings (e.g., mature themes).',
    'No spam or repeated self‑promotion of your own books.',
    'Credit authors and sources when sharing quotes.',
    'Be constructive and supportive in discussions.',
  ],

  // ─── Brand / Official Communities ──────────────────────────────
  brand: [
    'This is an official brand community – respectful and constructive engagement is required.',
    'Follow the brand’s specific guidelines and tone of voice.',
    'No competitor promotion or negative brand comparisons.',
    'No harassment of brand representatives or other members.',
    'No spam, scams, or unsolicited advertising.',
    'All content must be appropriate for a public brand setting – no NSFW.',
    'Do not share confidential or non‑public brand information.',
    'Use the designated channels for support or feedback – not general chat.',
    'Brand moderators have final say on content and member conduct.',
  ],

  // ─── General / Default ──────────────────────────────────────────
  general: DEFAULT_RULES,
};

// ─── Penalty notice (displayed in rules modals) ──────────────────
export const RULES_PENALTY =
  'Violating these rules may result in warnings, temporary suspension, or a permanent ban from ECHO.';

// ─── Helper: get rules for a given community name ───────────────
export function getCommunityRules(communityName = '') {
  const n = String(communityName).toLowerCase();

  // Check for brand/official keywords first
  if (n.includes('brand') || n.includes('official') || n.includes('support') || n.includes('help')) {
    return BY_NAME.brand;
  }

  // Existing category keywords
  if (n.includes('game') || n.includes('gaming') || n.includes('esport')) return BY_NAME.gaming;
  if (n.includes('music') || n.includes('song') || n.includes('artist')) return BY_NAME.music;
  if (n.includes('tech') || n.includes('coding') || n.includes('programming')) return BY_NAME.technology;
  if (n.includes('movie') || n.includes('film') || n.includes('cinema')) return BY_NAME.movies;
  if (n.includes('art') || n.includes('design') || n.includes('creative')) return BY_NAME.art;
  if (n.includes('fit') || n.includes('health') || n.includes('workout')) return BY_NAME.fitness;
  if (n.includes('book') || n.includes('read') || n.includes('literature')) return BY_NAME.books;

  // Fallback to default
  return DEFAULT_RULES;
}

// ─── Export all rules for admin / editing purposes ──────────────
export const ALL_RULE_CATEGORIES = {
  default: DEFAULT_RULES,
  gaming: BY_NAME.gaming,
  music: BY_NAME.music,
  technology: BY_NAME.technology,
  movies: BY_NAME.movies,
  art: BY_NAME.art,
  fitness: BY_NAME.fitness,
  books: BY_NAME.books,
  brand: BY_NAME.brand,
};