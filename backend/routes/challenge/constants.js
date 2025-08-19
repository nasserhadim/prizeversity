const GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'contact-akrm-for-token';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'cinnamonstic';
const GITHUB_REPO = process.env.GITHUB_REPO || 'contact-akrm-for-repo';

const CHALLENGE_NAMES = [
  'Little Caesar\'s Secret', 
  'Check Me Out', 
  'C++ Bug Hunt', 
  'I Always Sign My Work...', 
  'Secrets in the Clouds', 
  'Needle in a Haystack'
];

const CHALLENGE_IDS = {
  CAESAR_SECRET: 'caesar-secret-001',
  GITHUB_OSINT: 'github-osint-002',
  CPP_DEBUG: 'cpp-debug-003',
  FORENSICS: 'forensics-004',
  WAYNEAWS: 'wayneaws-005',
  HAYSTACK: 'haystack-006'
};

const DEFAULT_CHALLENGE_SETTINGS = {
  challengeBits: [50, 75, 100, 125, 150, 175],
  challengeMultipliers: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  challengeLuck: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  challengeDiscounts: [0, 0, 0, 0, 0, 0],
  challengeShields: [false, false, false, false, false, false],
  challengeHintsEnabled: [false, false, false, false, false, false]
};

module.exports = {
  GITHUB_TOKEN,
  GITHUB_OWNER,
  GITHUB_REPO,
  CHALLENGE_NAMES,
  CHALLENGE_IDS,
  DEFAULT_CHALLENGE_SETTINGS
};
