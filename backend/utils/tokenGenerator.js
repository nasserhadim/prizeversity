const { spawn } = require('child_process');
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
  return new Promise((resolve, reject) => {
    const pythonCode = `
import tiktoken
import sys

def get_token_id(word):
    try:
        enc = tiktoken.get_encoding("gpt2")
        tokens = enc.encode(word)
        if len(tokens) > 0:
            return tokens[0]
        else:
            return None
    except Exception as e:
        return None

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(1)
    
    word = sys.argv[1]
    token_id = get_token_id(word)
    
    if token_id is not None:
        print(token_id)
    else:
        sys.exit(1)
`;

    const python = spawn('python3', ['-c', pythonCode, word]);
    let output = '';
    let error = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      error += data.toString();
    });

    python.on('close', (code) => {
      if (code === 0 && output.trim()) {
        const tokenId = parseInt(output.trim());
        if (!isNaN(tokenId)) {
          resolve(tokenId);
        } else {
          reject(new Error('Invalid token ID returned'));
        }
      } else {
        reject(new Error(`Python execution failed: ${error || 'Unknown error'}`));
      }
    });

    python.on('error', (err) => {
      reject(new Error(`Failed to spawn python process: ${err.message}`));
    });
  });
}

async function generateChallengeData(uniqueId, salt = 'haystack_salt_2024') {
  try {
    const word = generateUniqueWord(uniqueId, salt);
    const tokenId = await getTokenId(word);
    
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
