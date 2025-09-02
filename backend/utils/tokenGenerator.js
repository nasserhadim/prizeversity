const { get_encoding } = require('tiktoken');
const crypto = require('crypto');
const { generate } = require('random-words');

let Filter;
let filter;

async function initializeFilter() {
  if (!Filter) {
    const badWords = await import('bad-words');
    Filter = badWords.Filter; 
    filter = new Filter();
  }
  return filter;
}

async function generateUniqueWord(uniqueId, salt = 'haystack_challenge_2024') {
  const badWordsFilter = await initializeFilter();
  
  const hash = crypto.createHash('md5').update(uniqueId + salt).digest('hex');
  let seed = parseInt(hash.substring(0, 8), 16);
  let word;
  let attempts = 0;
  const maxAttempts = 10;
  
  do {
    word = generate({
      exactly: 1,
      wordsPerString: 1,
      seed: (seed + attempts).toString()
    })[0];
    attempts++;
  } while (badWordsFilter.isProfane(word) && attempts < maxAttempts);
  
  if (badWordsFilter.isProfane(word)) {
    word = badWordsFilter.clean(word);
  }
  
  return word;
}

async function getTokenIdsAcrossModels(word) {
  const models = [
    "gpt2",         // Default GPT-2 encoding
    "p50k_base",    // For most GPT-3 models
    "cl100k_base",  // For newer models like GPT-3.5-turbo and GPT-4
    "r50k_base"     // For older GPT-3 models
  ];
  
  const results = {};
  
  for (const model of models) {
    let enc;
    try {
      enc = get_encoding(model);
      const tokens = enc.encode(word);
      
      if (tokens && tokens.length > 0) {
        results[model] = tokens;
      }
      
      if (enc) {
        enc.free();
      }
    } catch (error) {
      console.log(`Warning: Encoding with ${model} failed: ${error.message}`);
      if (enc) {
        try { enc.free(); } catch (e) { /* ignore */ }
      }
    }
  }
  
  return results;
}

async function getTokenId(wordOrPromise) {
  try {
    const word = typeof wordOrPromise === 'object' && wordOrPromise.then
      ? await wordOrPromise 
      : wordOrPromise;
    
    if (!word || typeof word !== 'string') {
      throw new Error(`Invalid word input: ${word}`);
    }
    
    // For backward compatibility, still provide the single token
    let enc;
    try {
      enc = get_encoding("gpt2");
      const tokens = enc.encode(word);
      const firstToken = tokens && tokens.length > 0 ? tokens[0] : null;
      enc.free();
      return firstToken;
    } catch (error) {
      if (enc) try { enc.free(); } catch (e) {}
      console.log(`Warning: Default encoding failed: ${error.message}`);
      return null;
    }
  } catch (error) {
    throw new Error(`Token encoding failed: ${error.message}`);
  }
}

async function generateChallengeData(uniqueId, salt = 'haystack_salt_2024') {
  try {
    const word = await generateUniqueWord(uniqueId, salt);
    const tokenId = await getTokenId(word);
    const allTokenIds = await getTokenIdsAcrossModels(word);
    
    // Flatten all token IDs into a unique set
    const allPossibleTokens = new Set();
    Object.values(allTokenIds).forEach(tokens => {
      tokens.forEach(token => allPossibleTokens.add(token));
    });
    
    return {
      generatedWord: word,
      expectedTokenId: tokenId,
      allTokenIds: allTokenIds,
      validTokens: Array.from(allPossibleTokens)
    };
  } catch (error) {
    console.error('Error generating challenge data:', error);
    throw error;
  }
}

module.exports = {
  generateUniqueWord,
  getTokenId,
  getTokenIdsAcrossModels,
  generateChallengeData
};
