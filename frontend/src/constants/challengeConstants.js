export const CHALLENGE_NAMES = [
  'Little Caesar\'s Secret',
  'Check Me Out',
  'Security Bug Fix',
  'Digital Forensics Lab',
  'WayneAWS Verification'
];

export const DEFAULT_CHALLENGE_CONFIG = {
  title: 'Cyber Challenge Series - Fall Semester',
  rewardMode: 'individual',
  challengeBits: [50, 75, 100, 125, 150],
  totalRewardBits: 500,
  multiplierMode: 'individual',
  challengeMultipliers: [1.0, 1.0, 1.0, 1.0, 1.0],
  totalMultiplier: 1.0,
  luckMode: 'individual',
  challengeLuck: [1.0, 1.0, 1.0, 1.0, 1.0],
  totalLuck: 1.0,
  discountMode: 'individual',
  challengeDiscounts: [0, 0, 0, 0, 0],
  totalDiscount: 0,
  shieldMode: 'individual',
  challengeShields: [false, false, false, false, false],
  totalShield: false,
  attackMode: 'individual',
  challengeAttackBonuses: [0, 0, 0, 0, 0],
  totalAttackBonus: 0,
  challengeHintsEnabled: [false, false, false, false, false],
  challengeHints: [[], [], [], [], []],
  hintPenaltyPercent: 25,
  maxHintsPerChallenge: 2,
  dueDateEnabled: false,
  dueDate: '',
};

export const CHALLENGE_IDS = [
  'caesar-secret-001',
  'github-osint-002',
  'network-analysis-003',
  'advanced-crypto-004',
  'wayneaws-verification-005'
];
