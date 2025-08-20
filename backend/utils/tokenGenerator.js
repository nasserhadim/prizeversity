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

async function getTokenId(wordOrPromise) {
  let enc;
  try {
    // If it's a promise, await it; otherwise use it directly
    // This package requires the use of async/await because 
    // it relies on Promises for asynchronous operations (like tokenization)
    const word = typeof wordOrPromise === 'object' && wordOrPromise.then
      ? await wordOrPromise 
      : wordOrPromise;
    
    if (!word || typeof word !== 'string') {
      throw new Error(`Invalid word input: ${word}`);
    }
    
    enc = get_encoding("gpt2");
    const tokens = enc.encode(word);
    
    if (tokens && tokens.length > 0) {
      const tokenId = tokens[0];
      enc.free();
      return tokenId;
    } else {
      enc.free();
      throw new Error('No tokens generated for word');
    }
  } catch (error) {
    if (enc) {
      try {
        enc.free(); // Free the encoding resources so they can be reused
      } catch (freeError) {
        // Ignore free errors
      }
    }
    throw new Error(`Token encoding failed: ${error.message}`);
  }
}

async function generateChallengeData(uniqueId, salt = 'haystack_salt_2024') {
  try {
    const word = await generateUniqueWord(uniqueId, salt);
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
