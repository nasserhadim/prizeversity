export const CHALLENGE_NAMES = [
  'Little Caesar\'s Secret',
  'Check Me Out',
  'C++ Bug Hunt',
  'I Always Sign My Work...',
  'Secrets in the Clouds',
  'Needle in a Haystack',
  'Hangman'
];

export const DEFAULT_CHALLENGE_CONFIG = {
  title: 'Cyber Challenge Series',
  rewardMode: 'individual',
  challengeBits: [50, 75, 100, 125, 150, 175, 200],
  totalRewardBits: 775,
  // NEW: Multiplier application settings
  applyPersonalMultiplier: false,
  applyGroupMultiplier: false,
  multiplierMode: 'individual',
  challengeMultipliers: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  totalMultiplier: 1.0,
  luckMode: 'individual',
  challengeLuck: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  totalLuck: 1.0,
  discountMode: 'individual',
  challengeDiscounts: [0, 0, 0, 0, 0, 0, 0],
  totalDiscount: 0,
  shieldMode: 'individual',
  challengeShields: [false, false, false, false, false, false, false],
  totalShield: false,
  attackMode: 'individual',
  challengeAttackBonuses: [0, 0, 0, 0, 0, 0, 0],
  totalAttackBonus: 0,
  challengeHintsEnabled: [false, false, false, false, false, false, false],
  challengeHints: [[], [], [], [], [], [], []],
  hintPenaltyPercent: 25,
  maxHintsPerChallenge: 2,
  dueDateEnabled: false,
  dueDate: '',
  challengeVisibility: [true, true, true, true, true, true, true]
};

export const CHALLENGE_IDS = [
  'caesar-secret-001',
  'github-osint-002',
  'cpp-debug-003',
  'forensics-004',
  'wayneaws-005',
  'haystack-006',
  'hangman-007'
];
