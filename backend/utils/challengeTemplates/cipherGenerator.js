/**
 * Cipher Template Generator
 */

const crypto = require('crypto');

const WORD_POOLS = {
  adjectives: ['SWIFT', 'BRAVE', 'DARK', 'BRIGHT', 'QUICK', 'SILENT', 'BOLD', 'FIERCE', 'WILD', 'CALM'],
  nouns: ['FALCON', 'TIGER', 'STORM', 'SHADOW', 'FLAME', 'FROST', 'HAWK', 'WOLF', 'EAGLE', 'RAVEN'],
  prefixes: ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'OMEGA', 'SIGMA', 'THETA', 'ZETA', 'KAPPA', 'LAMBDA']
};

function generateRandomAnswer(seed, difficulty) {
  const hash = crypto.createHash('md5').update(seed).digest('hex');
  
  const adjIdx = parseInt(hash.substring(0, 2), 16) % WORD_POOLS.adjectives.length;
  const nounIdx = parseInt(hash.substring(2, 4), 16) % WORD_POOLS.nouns.length;
  const prefixIdx = parseInt(hash.substring(4, 6), 16) % WORD_POOLS.prefixes.length;
  const numSuffix = parseInt(hash.substring(6, 9), 16) % 1000;
  
  switch (difficulty) {
    case 'easy':
      return `${WORD_POOLS.prefixes[prefixIdx]}-${numSuffix.toString().padStart(3, '0')}`;
    case 'hard':
      return `${WORD_POOLS.adjectives[adjIdx]}-${WORD_POOLS.nouns[nounIdx]}-${numSuffix}`;
    default:
      return `${WORD_POOLS.nouns[nounIdx]}-${numSuffix.toString().padStart(3, '0')}`;
  }
}

function caesarEncrypt(text, shift) {
  return text.replace(/[A-Z]/g, char => {
    const code = char.charCodeAt(0);
    const shifted = ((code - 65 + shift) % 26) + 65;
    return String.fromCharCode(shifted);
  }).replace(/[0-9]/g, digit => {
    const num = parseInt(digit);
    return ((num + shift) % 10).toString();
  });
}

function base64Encrypt(text, seed) {
  const salt = seed.substring(0, 4).toUpperCase();
  const combined = `${salt}:${text}`;
  return Buffer.from(combined).toString('base64');
}

function rot13Encrypt(text) {
  return caesarEncrypt(text, 13);
}

function atbashEncrypt(text) {
  return text.replace(/[A-Z]/g, char => {
    const code = char.charCodeAt(0);
    return String.fromCharCode(90 - (code - 65));
  });
}

function vigenereEncrypt(text, keyword) {
  let result = '';
  let keyIndex = 0;
  
  for (const char of text) {
    if (/[A-Z]/.test(char)) {
      const textCode = char.charCodeAt(0) - 65;
      const keyCode = keyword[keyIndex % keyword.length].charCodeAt(0) - 65;
      const encrypted = ((textCode + keyCode) % 26) + 65;
      result += String.fromCharCode(encrypted);
      keyIndex++;
    } else {
      result += char;
    }
  }
  
  return result;
}

async function generate(config, seed) {
  const cipherType = config.cipherType || 'caesar';
  const difficulty = config.difficulty || 'medium';
  
  const answer = generateRandomAnswer(seed, difficulty);
  
  let displayData;
  let metadata = { cipherType };
  
  switch (cipherType) {
    case 'caesar': {
      const shiftHash = crypto.createHash('md5').update(seed + 'shift').digest('hex');
      const shift = (parseInt(shiftHash.substring(0, 2), 16) % 21) + 3;
      displayData = caesarEncrypt(answer, shift);
      metadata.shift = shift;
      break;
    }
    
    case 'base64':
      displayData = base64Encrypt(answer, seed);
      break;
    
    case 'rot13':
      displayData = rot13Encrypt(answer);
      break;
    
    case 'atbash':
      displayData = atbashEncrypt(answer);
      break;
    
    case 'vigenere': {
      const keywords = ['CYBER', 'SECURE', 'ENCODE', 'SECRET', 'CIPHER'];
      const keyHash = crypto.createHash('md5').update(seed + 'key').digest('hex');
      const keyword = keywords[parseInt(keyHash.substring(0, 2), 16) % keywords.length];
      displayData = vigenereEncrypt(answer, keyword);
      metadata.keyword = keyword;
      break;
    }
    
    default:
      displayData = caesarEncrypt(answer, 7);
  }
  
  return {
    displayData,
    expectedAnswer: answer,
    metadata
  };
}

function validateConfig(config) {
  const errors = [];
  
  const validCipherTypes = ['caesar', 'base64', 'rot13', 'atbash', 'vigenere'];
  if (config.cipherType && !validCipherTypes.includes(config.cipherType)) {
    errors.push(`Invalid cipher type: ${config.cipherType}`);
  }
  
  const validDifficulties = ['easy', 'medium', 'hard'];
  if (config.difficulty && !validDifficulties.includes(config.difficulty)) {
    errors.push(`Invalid difficulty: ${config.difficulty}`);
  }
  
  return { valid: errors.length === 0, errors };
}

module.exports = {
  generate,
  validateConfig
};
