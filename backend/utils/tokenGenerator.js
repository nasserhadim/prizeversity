const { get_encoding } = require('tiktoken');
const crypto = require('crypto');
const { generate } = require('random-words');

function generateUniqueWord(uniqueId, salt = 'haystack_challenge_2024') {
  const hash = crypto.createHash('md5').update(uniqueId + salt).digest('hex');
  const seed = parseInt(hash.substring(0, 8), 16);
  
  const word = generate({
    exactly: 1,
    wordsPerString: 1,
    seed: seed.toString()
  })[0];
  
  return word;
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
module.exports = {
  generateUniqueWord,
  getTokenId,
  generateChallengeData
};
