/**
 * Hash Cracker Template Generator
 */

const crypto = require('crypto');

function generateRandomCode(seed) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  
  const hash = crypto.createHash('sha256').update(seed + 'hashcode').digest('hex');
  
  for (let i = 0; i < 12; i++) {
    const index = parseInt(hash.substring(i * 2, i * 2 + 2), 16) % chars.length;
    code += chars[index];
    if (i === 3 || i === 7) code += '-';
  }
  
  return code;
}

function hashCode(code, algorithm) {
  return crypto.createHash(algorithm).update(code).digest('hex');
}

async function generate(config, seed) {
  const algorithm = config.hashAlgorithm || 'sha256';
  const difficulty = config.difficulty || 'medium';
  
  const answer = generateRandomCode(seed);
  const hashedAnswer = hashCode(answer, algorithm);
  
  const displayData = JSON.stringify({
    hash: hashedAnswer,
    algorithm: algorithm.toUpperCase(),
    format: 'XXXX-XXXX-XXXX'
  }, null, 2);
  
  return {
    displayData,
    expectedAnswer: answer,
    metadata: {
      algorithm,
      difficulty,
      hash: hashedAnswer
    }
  };
}

function validateConfig(config) {
  const errors = [];
  
  const validAlgorithms = ['md5', 'sha256'];
  if (config.hashAlgorithm && !validAlgorithms.includes(config.hashAlgorithm)) {
    errors.push(`Invalid hash algorithm: ${config.hashAlgorithm}`);
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
