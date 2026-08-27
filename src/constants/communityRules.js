// src/constants/communityRules.js

const DEFAULT_RULES = [
  'Be respectful. No harassment, hate, or bullying.',
  'Stay on topic for this community.',
  'No spam, scams, or repeated advertising.',
  'No NSFW, nudity, or sexual content.',
  'No sharing of others’ private information.',
  'Follow ECHO’s community guidelines.',
];

const BY_NAME = {
  gaming: [
    'Talk about games, players, and gaming culture.',
    'No cheating discussions that harm others’ accounts.',
    'No harassment in matches or lobbies talk.',
    'No NSFW content.',
    'Be fair when sharing tips and links.',
  ],
  music: [
    'Share music, artists, and playlists kindly.',
    'Credit artists when you can.',
    'No piracy links or illegal downloads.',
    'No NSFW content.',
    'Respect different tastes.',
  ],
  technology: [
    'Discuss tech, coding, and gadgets helpfully.',
    'No malware, hacking, or harmful scripts.',
    'No scams or fake “get rich” tech schemes.',
    'No NSFW content.',
  ],
  tech: [
    'Discuss tech, coding, and gadgets helpfully.',
    'No malware, hacking, or harmful scripts.',
    'No scams or fake tech schemes.',
    'No NSFW content.',
  ],
  movies: [
    'Spoilers: warn others first.',
    'Be kind about opinions.',
    'No piracy links.',
    'No NSFW content.',
  ],
  art: [
    'Share original or credited art.',
    'No tracing claims as original work.',
    'No NSFW / adult art.',
    'Give constructive feedback.',
  ],
  fitness: [
    'Encourage healthy habits; no shaming.',
    'This is not medical advice.',
    'No dangerous challenge pressure.',
    'No NSFW content.',
  ],
  books: [
    'Spoilers: use warnings.',
    'Respect different reading tastes.',
    'No piracy links.',
    'No NSFW content.',
  ],
  general: DEFAULT_RULES,
};

export const RULES_PENALTY =
  'Breaking these rules can lead to a permanent ban from ECHO.';

export function getCommunityRules(communityName = '') {
  const n = String(communityName).toLowerCase();
  if (n.includes('game')) return BY_NAME.gaming;
  if (n.includes('music')) return BY_NAME.music;
  if (n.includes('tech')) return BY_NAME.tech;
  if (n.includes('movie') || n.includes('film')) return BY_NAME.movies;
  if (n.includes('art')) return BY_NAME.art;
  if (n.includes('fit')) return BY_NAME.fitness;
  if (n.includes('book') || n.includes('read')) return BY_NAME.books;
  return DEFAULT_RULES;
}