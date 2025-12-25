/**
 * Challenge Template Engine
 */

const cipherGenerator = require('./cipherGenerator');
const hashGenerator = require('./hashGenerator');
const hiddenMessageGenerator = require('./hiddenMessageGenerator');
const patternFindGenerator = require('./patternFindGenerator');

const templates = {
  'cipher': cipherGenerator,
  'hash': hashGenerator,
  'hidden-message': hiddenMessageGenerator,
  'pattern-find': patternFindGenerator
};

const templateMetadata = {
  'passcode': {
    name: 'Static Passcode',
    description: 'Students enter a teacher-defined passcode.',
    icon: 'key',
    isSecure: false
  },
  'cipher': {
    name: 'Cipher Decoder',
    description: 'Decrypt an encrypted message.',
    icon: 'lock',
    isSecure: true,
    options: {
      cipherType: {
        label: 'Cipher Type',
        type: 'select',
        options: [
          { value: 'caesar', label: 'Caesar Cipher' },
          { value: 'base64', label: 'Base64 Encoding' },
          { value: 'rot13', label: 'ROT13' },
          { value: 'atbash', label: 'Atbash' },
          { value: 'vigenere', label: 'Vigenère Cipher' }
        ],
        default: 'caesar'
      },
      difficulty: {
        label: 'Difficulty',
        type: 'select',
        options: [
          { value: 'easy', label: 'Easy' },
          { value: 'medium', label: 'Medium' },
          { value: 'hard', label: 'Hard' }
        ],
        default: 'medium'
      }
    }
  },
  'hash': {
    name: 'Hash Cracker',
    description: 'Crack a hash to find the original code.',
    icon: 'hash',
    isSecure: true,
    options: {
      hashAlgorithm: {
        label: 'Hash Algorithm',
        type: 'select',
        options: [
          { value: 'md5', label: 'MD5' },
          { value: 'sha256', label: 'SHA-256' }
        ],
        default: 'md5'
      },
      difficulty: {
        label: 'Difficulty',
        type: 'select',
        options: [
          { value: 'easy', label: 'Easy' },
          { value: 'medium', label: 'Medium' },
          { value: 'hard', label: 'Hard' }
        ],
        default: 'medium'
      }
    }
  },
  'hidden-message': {
    name: 'Hidden Message',
    description: 'Find hidden data in file metadata.',
    icon: 'eye-off',
    isSecure: true,
    options: {
      embedMethod: {
        label: 'Hiding Method',
        type: 'select',
        options: [
          { value: 'exif', label: 'Image EXIF Metadata' },
          { value: 'filename', label: 'Encoded Filename' }
        ],
        default: 'exif'
      }
    },
    requiresFile: true
  },
  'pattern-find': {
    name: 'Pattern Finder',
    description: 'Find a hidden pattern in generated text.',
    icon: 'search',
    isSecure: true,
    options: {
      patternLength: {
        label: 'Pattern Length',
        type: 'number',
        min: 4,
        max: 12,
        default: 6
      },
      noiseLevel: {
        label: 'Noise Level',
        type: 'select',
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' }
        ],
        default: 'medium'
      }
    }
  }
};

async function generateForStudent(templateType, templateConfig, studentId, challengeId) {
  const generator = templates[templateType];
  
  if (!generator) {
    throw new Error(`Unknown template type: ${templateType}`);
  }
  
  const crypto = require('crypto');
  const seed = crypto.createHash('sha256')
    .update(`${studentId}-${challengeId}-${Date.now()}`)
    .digest('hex');
  
  const result = await generator.generate(templateConfig, seed);
  
  return {
    displayData: result.displayData,
    expectedAnswer: result.expectedAnswer,
    generationSeed: seed,
    generatedAt: new Date(),
    metadata: result.metadata || {}
  };
}

function verifyAnswer(submittedAnswer, expectedAnswer, templateType) {
  if (!submittedAnswer || !expectedAnswer) {
    return false;
  }
  
  const normalizedSubmitted = submittedAnswer.trim().toUpperCase();
  const normalizedExpected = expectedAnswer.trim().toUpperCase();
  
  return normalizedSubmitted === normalizedExpected;
}

function getTemplateMetadata(templateType = null) {
  if (templateType) {
    return templateMetadata[templateType] || null;
  }
  return templateMetadata;
}

function validateConfig(templateType, config) {
  const generator = templates[templateType];
  
  if (!generator) {
    return { valid: false, errors: [`Unknown template type: ${templateType}`] };
  }
  
  if (generator.validateConfig) {
    return generator.validateConfig(config);
  }
  
  return { valid: true, errors: [] };
}

module.exports = {
  generateForStudent,
  verifyAnswer,
  getTemplateMetadata,
  validateConfig,
  templates,
  templateMetadata
};
