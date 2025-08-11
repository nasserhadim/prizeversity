const crypto = require('crypto');

const CAESAR_SHIFT = parseInt(process.env.CAESAR_SHIFT || '3');
const GITHUB_FORMAT = process.env.GITHUB_FORMAT || 'GITHUB-{id}';

const generateExpectedAnswer = {
  'caesar-decrypt': (uniqueId) => {
    return uniqueId.split('').map(char => {
      if (char >= 'A' && char <= 'Z') {
        return String.fromCharCode(((char.charCodeAt(0) - 65 - CAESAR_SHIFT + 26) % 26) + 65);
      } else if (char >= '0' && char <= '9') {
        return String.fromCharCode(((char.charCodeAt(0) - 48 - CAESAR_SHIFT + 10) % 10) + 48);
      }
      return char;
    }).join('');
  },
  
  'github-osint': (uniqueId) => {
    // Hidden OSINT format from environment variable
    return GITHUB_FORMAT.replace('{id}', uniqueId.slice(-4).toUpperCase());
  },
  

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



  // Template for adding new challenge types
  'custom-challenge': (answer, metadata, uniqueId) => {
    // Implement custom validation logic here
    // Always hash answers before comparison for security
    const answerHash = crypto.createHash('sha256').update(answer.trim()).digest('hex');
    return answerHash === metadata.expectedHash;
  }
};

module.exports = validators;