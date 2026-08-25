// src/constants/communityRules.js

const BASE_RULES = [
  'Stay on topic — only discuss what this community is about.',
  'No nudity, sexual content, or pornography of any kind.',
  'No hate speech, harassment, threats, or bullying.',
  'No spam, scams, or repeated unwanted messages.',
  'Respect other members. Disagreements are fine; insults are not.',
  'Do not share private information (yours or anyone else’s).',
  'Breaking these rules can result in a permanent account ban with no appeal.',
];

const BY_NAME = {
  General: ['This is a casual hangout — keep it friendly and appropriate for everyone.'],
  Gaming: [
    'Talk about games, players, tips, and esports — not unrelated topics.',
    'No cheating services, account trading, or piracy links.',
  ],
  Movies: [
    'Discuss films, shows, actors, and recommendations.',
    'Mark major spoilers clearly when you post them.',
  ],
  Music: [
    'Share music talk, recommendations, and artists you love.',
    'No illegal download links or pirated content.',
  ],
  Technology: [
    'Talk tech, programming, AI, gadgets, and the future.',
    'No malware, cracking tools, or hacking-for-harm content.',
  ],
  Art: [
    'Share art discussion and creative work that is safe for all ages.',
    'No NSFW or adult-only artwork.',
  ],
  'Book Club': [
    'Discuss books, authors, reading lists, and stories.',
    'Mark major spoilers clearly when you post them.',
  ],
  Fitness: [
    'Share fitness tips, routines, and healthy habits.',
    'No dangerous “miracle” medical claims or steroid sales.',
  ],
};

export function getCommunityRules(communityName) {
  const name = (communityName || '').trim();
  const extra = BY_NAME[name] || [];
  const lower = name.toLowerCase();
  let fuzzy = [];
  if (!extra.length) {
    if (lower.includes('tech')) fuzzy = BY_NAME.Technology;
    else if (lower.includes('game')) fuzzy = BY_NAME.Gaming;
    else if (lower.includes('music')) fuzzy = BY_NAME.Music;
    else if (lower.includes('movie') || lower.includes('film')) fuzzy = BY_NAME.Movies;
    else if (lower.includes('fit')) fuzzy = BY_NAME.Fitness;
    else if (lower.includes('art')) fuzzy = BY_NAME.Art;
    else if (lower.includes('book') || lower.includes('read')) fuzzy = BY_NAME['Book Club'];
    else if (lower.includes('general')) fuzzy = BY_NAME.General;
  }
  return [...(extra.length ? extra : fuzzy), ...BASE_RULES];
}

export const RULES_PENALTY =
  'Violating community rules may result in a permanent account ban of your ECHO account.';

export const COMMUNITY_CATALOG = [
  { id: 'general', name: 'General', description: 'A place to talk, meet people and discuss anything.', image: '/images/communities/default.png', tags: ['chat', 'hangout'] },
  { id: 'gaming', name: 'Gaming', description: 'Find players, discuss games and connect with fellow gamers.', image: '/images/communities/gaming.png', tags: ['games', 'esports'] },
  { id: 'movies', name: 'Movies', description: 'Discuss films, shows, actors and your latest watch.', image: '/images/communities/movies.png', tags: ['film', 'tv'] },
  { id: 'music', name: 'Music', description: 'Discover music, share your favourite songs and meet other music lovers.', image: '/images/communities/music.png', tags: ['songs', 'artists'] },
  { id: 'technology', name: 'Technology', description: 'Talk about tech, programming, AI and the future.', image: '/images/communities/tech.png', tags: ['tech', 'ai', 'coding'] },
  { id: 'art', name: 'Art', description: 'Share creative work, techniques and inspiration — all ages welcome.', image: '/images/communities/art.png', tags: ['design', 'creative'] },
  { id: 'book-club', name: 'Book Club', description: 'Books, authors, reading lists and thoughtful discussion.', image: '/images/communities/book.png', tags: ['books', 'reading'] },
  { id: 'fitness', name: 'Fitness', description: 'Workouts, healthy habits and motivation with the community.', image: '/images/communities/fitness.png', tags: ['health', 'workout'] },
];