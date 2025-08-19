const crypto = require('crypto');

const validators = {
  'caesar-decrypt': (answer, metadata, uniqueId) => {
    const hash = crypto.createHash('md5').update(uniqueId + metadata.salt).digest('hex');
    const shift = (parseInt(hash.substring(0, 2), 16) % metadata.algorithmParams.range) + metadata.algorithmParams.base;
    const expected = uniqueId.split('').map(char => {
      if (char >= 'A' && char <= 'Z') {
        return String.fromCharCode(((char.charCodeAt(0) - 65 - shift + 26) % 26) + 65);
      } else if (char >= '0' && char <= '9') {
        return String.fromCharCode(((char.charCodeAt(0) - 48 - shift + 10) % 10) + 48);
      }
      return char;
    }).join('');
    return answer.trim().toUpperCase() === expected;
  },

  'github-osint': (answer, metadata, uniqueId) => {
    const hash = crypto.createHash('md5').update(uniqueId + metadata.salt).digest('hex');
    const prefix = metadata.algorithmParams.prefixes[parseInt(hash.substring(0, 1), 16) % metadata.algorithmParams.prefixes.length];
    const suffix = hash.substring(8, 14).toUpperCase();
    const expected = `${prefix}_${suffix}`;
    return answer.trim().toUpperCase() === expected;
  },

  'code-breaker': (answer, metadata, uniqueId) => {
    const hash = crypto.createHash('md5').update(uniqueId + metadata.salt).digest('hex');
    const targetInput = hash.substring(8, 12).toUpperCase();
    return answer.trim().toUpperCase() === targetInput;
  },

  'image-forensics': (answer, metadata, uniqueId) => {
    const hash = crypto.createHash('md5').update(uniqueId + metadata.salt).digest('hex');
    const expectedAnswer = `FORENSICS_${hash.substring(0, 8).toUpperCase()}`;
    return answer.trim() === expectedAnswer;
  },

  'wayneaws-verification': (answer, metadata, uniqueId) => {
    const answerHash = crypto.createHash('sha256').update(answer.trim()).digest('hex');
    return answerHash === metadata.staticAnswerHash;
  },

  'needle-in-haystack': (answer, metadata, uniqueId) => {
    const hash = crypto.createHash('md5').update(uniqueId + metadata.salt).digest('hex');
    const targetCode = hash.substring(0, 8).toUpperCase();
    return answer.trim().toUpperCase() === targetCode;
  },

  'custom-challenge': (answer, metadata, uniqueId) => {
    const answerHash = crypto.createHash('sha256').update(answer.trim()).digest('hex');
    return answerHash === metadata.expectedHash;
  }
};

module.exports = validators;