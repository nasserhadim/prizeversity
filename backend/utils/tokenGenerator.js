const { get_encoding } = require('tiktoken');
const crypto = require('crypto');

const WORD_POOL = [
  'cryptography', 'quantum', 'cybersecurity', 'blockchain', 'algorithm', 'encryption', 'forensics',
  'malware', 'phishing', 'vulnerability', 'authentication', 'authorization', 'firewall', 'intrusion',
  'penetration', 'reconnaissance', 'exploitation', 'privilege', 'escalation', 'rootkit', 'botnet',
  'honeypot', 'sandbox', 'steganography', 'ransomware', 'keylogger', 'trojan', 'backdoor', 'exploit',
  'payload', 'shellcode', 'buffer', 'overflow', 'injection', 'mitigation', 'hardening', 'patching',
  'incident', 'response', 'forensic', 'analysis', 'attribution', 'threat', 'intelligence', 'hunting',
  'adversary', 'tactics', 'techniques', 'procedures', 'indicators', 'compromise', 'detection',
  'prevention', 'monitoring', 'logging', 'correlation', 'baseline', 'anomaly', 'signature',
  'heuristic', 'behavioral', 'machine', 'learning', 'artificial', 'neural', 'network', 'deep',
  'reinforcement', 'supervised', 'unsupervised', 'classification', 'regression', 'clustering',
  'feature', 'extraction', 'selection', 'engineering', 'preprocessing', 'normalization', 'scaling'
];

function generateUniqueWord(uniqueId, salt = 'haystack_challenge_2024') {
  const hash = crypto.createHash('md5').update(uniqueId + salt).digest('hex');
  const index = parseInt(hash.substring(0, 8), 16) % WORD_POOL.length;
  return WORD_POOL[index];
}

function getTokenId(word) {
  try {
    const enc = get_encoding("gpt2");
    const tokens = enc.encode(word);
    enc.free(); // Free the encoder memory
    
    if (tokens.length > 0) {
      return tokens[0];
    } else {
      throw new Error('No tokens generated for word');
    }
  } catch (error) {
    throw new Error(`Token encoding failed: ${error.message}`);
  }
}

async function generateChallengeData(uniqueId, salt = 'haystack_salt_2024') {
  try {
    const word = generateUniqueWord(uniqueId, salt);
    const tokenId = getTokenId(word);
    
    return {
      generatedWord: word,
      expectedTokenId: tokenId
    };
  } catch (error) {
    console.error('Error generating challenge data:', error);
    throw error;
  }
}

module.exports = {
  generateUniqueWord,
  getTokenId,
  generateChallengeData
};
