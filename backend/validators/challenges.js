const crypto = require('crypto');

const CAESAR_BASE = parseInt(process.env.CAESAR_BASE || '3');
const CAESAR_RANGE = parseInt(process.env.CAESAR_RANGE || '6');
const CAESAR_SALT = process.env.CAESAR_SALT || 'default_salt_2024';

const generateExpectedAnswer = {
  'caesar-decrypt': (uniqueId) => {
    const hash = crypto.createHash('md5').update(uniqueId + CAESAR_SALT).digest('hex');
    const shift = (parseInt(hash.substring(0, 2), 16) % CAESAR_RANGE) + CAESAR_BASE; 
    return uniqueId.split('').map(char => {
      if (char >= 'A' && char <= 'Z') {
        return String.fromCharCode(((char.charCodeAt(0) - 65 - shift + 26) % 26) + 65);
      } else if (char >= '0' && char <= '9') {
        return String.fromCharCode(((char.charCodeAt(0) - 48 - shift + 10) % 10) + 48);
      }
      return char;
    }).join('');
  },
  
  'github-osint': (uniqueId) => {
    const hash = crypto.createHash('md5').update(uniqueId + 'secret_salt_2024').digest('hex');
    const prefix = ['ACCESS', 'TOKEN', 'KEY', 'SECRET', 'CODE'][parseInt(hash.substring(0, 1), 16) % 5];
    const suffix = hash.substring(8, 14).toUpperCase();
    return `${prefix}_${suffix}`;
  },
  
  'network-analysis': (uniqueId) => {
    // New Challenge 3: Cryptographic Hash Detective
    // Generate a deterministic hash function based on uniqueId
    const hash = crypto.createHash('md5').update(uniqueId + 'forensics_salt_2024').digest('hex');
    
    // The target input that students need to find (this is the answer)
    const targetInput = hash.substring(8, 12).toUpperCase(); // 4-character target
    
    // Return the original input that students should find
    return targetInput;
  },
  
  'advanced-crypto': () => {
    return 'FLAG{crypto_expert_2024}';
  }
};

const validators = {
  'caesar-decrypt': (answer, metadata, uniqueId) => {
    const expected = generateExpectedAnswer['caesar-decrypt'](uniqueId);
    return answer.trim().toUpperCase() === expected;
  },

  'github-osint': (answer, metadata, uniqueId) => {
    const expected = generateExpectedAnswer['github-osint'](uniqueId);
    return answer.trim().toUpperCase() === expected;
  },

  'network-analysis': (answer, metadata, uniqueId) => {
    const expected = generateExpectedAnswer['network-analysis'](uniqueId);
    return answer.trim().toUpperCase() === expected;
  },

  'advanced-crypto': (answer, metadata, uniqueId) => {
    const expected = generateExpectedAnswer['advanced-crypto']();
    return answer.trim() === expected;
  },

  // Template for adding new challenge types
  'custom-challenge': (answer, metadata, uniqueId) => {
    // Implement custom validation logic here
    // Always hash answers before comparison for security
    const answerHash = crypto.createHash('sha256').update(answer.trim()).digest('hex');
    return answerHash === metadata.expectedHash;
  }
};

module.exports = validators;
module.exports.generateExpectedAnswer = generateExpectedAnswer;