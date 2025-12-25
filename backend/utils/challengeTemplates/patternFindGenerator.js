/**
 * Pattern Finder Template Generator
 */

const crypto = require('crypto');

const NOISE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generatePattern(seed, length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const hash = crypto.createHash('sha256').update(seed + 'pattern').digest('hex');
  
  let prefix = '';
  for (let i = 0; i < 3; i++) {
    const charIndex = parseInt(hash.substring(i * 2, i * 2 + 2), 16) % 26;
    prefix += String.fromCharCode(65 + charIndex);
  }
  
  let code = '';
  for (let i = 0; i < length; i++) {
    const charIndex = parseInt(hash.substring(6 + i * 2, 8 + i * 2), 16) % chars.length;
    code += chars[charIndex];
    if (i === Math.floor(length / 2) - 1) code += '-';
  }
  
  return `${prefix}-${code}`;
}

function generateNoise(seed, length, noiseLevel) {
  const hash = crypto.createHash('sha256').update(seed + 'noise').digest('hex');
  let noise = '';
  
  const densities = { low: 20, medium: 50, high: 100 };
  const charsPerLine = densities[noiseLevel] || 50;
  
  for (let i = 0; i < length; i++) {
    const charHash = crypto.createHash('md5').update(hash + i.toString()).digest('hex');
    const charIndex = parseInt(charHash.substring(0, 2), 16) % NOISE_CHARS.length;
    noise += NOISE_CHARS[charIndex];
    
    if ((i + 1) % charsPerLine === 0) {
      noise += '\n';
    }
  }
  
  return noise;
}

function embedPattern(noise, pattern, seed) {
  const hash = crypto.createHash('md5').update(seed + 'position').digest('hex');
  const lines = noise.split('\n').filter(line => line.length > 0);
  
  const lineIndex = parseInt(hash.substring(0, 4), 16) % Math.max(1, lines.length - 2);
  
  if (lines[lineIndex]) {
    const insertPos = parseInt(hash.substring(4, 8), 16) % Math.max(1, lines[lineIndex].length - pattern.length);
    const line = lines[lineIndex];
    lines[lineIndex] = line.substring(0, insertPos) + pattern + line.substring(insertPos + pattern.length);
  } else {
    lines.push(pattern);
  }
  
  return lines.join('\n');
}

async function generate(config, seed) {
  const patternLength = config.patternLength || 6;
  const noiseLevel = config.noiseLevel || 'medium';
  
  const pattern = generatePattern(seed, patternLength);
  
  const noiseLengths = { low: 500, medium: 1000, high: 2000 };
  const noiseLength = noiseLengths[noiseLevel] || 1000;
  
  const noise = generateNoise(seed, noiseLength, noiseLevel);
  const documentContent = embedPattern(noise, pattern, seed);
  
  const displayData = JSON.stringify({
    document: documentContent
  }, null, 2);
  
  return {
    displayData,
    expectedAnswer: pattern,
    metadata: {
      patternLength,
      noiseLevel,
      documentLength: documentContent.length
    }
  };
}

function validateConfig(config) {
  const errors = [];
  
  if (config.patternLength !== undefined) {
    if (config.patternLength < 4 || config.patternLength > 12) {
      errors.push('Pattern length must be between 4 and 12');
    }
  }
  
  const validNoiseLevels = ['low', 'medium', 'high'];
  if (config.noiseLevel && !validNoiseLevels.includes(config.noiseLevel)) {
    errors.push(`Invalid noise level: ${config.noiseLevel}`);
  }
  
  return { valid: errors.length === 0, errors };
}

module.exports = {
  generate,
  validateConfig
};
