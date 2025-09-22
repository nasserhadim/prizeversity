const { get_encoding } = require('tiktoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

async function generateQuoteForUser(uniqueId, salt = 'hangman_challenge_2024') {
  const hash = crypto.createHash('md5').update(uniqueId + salt).digest('hex');
  const seed = parseInt(hash.substring(0, 8), 16);
  
  // Enhanced distribution algorithm for better classroom spread
  // Use multiple hash segments and character positions from uniqueId
  const char1Hash = crypto.createHash('md5').update(uniqueId[0] + salt + 'char1').digest('hex');
  const char2Hash = crypto.createHash('md5').update(uniqueId[1] + salt + 'char2').digest('hex');
  const lengthHash = crypto.createHash('md5').update(uniqueId.length.toString() + salt + 'length').digest('hex');
  
  const char1Offset = parseInt(char1Hash.substring(0, 4), 16);
  const char2Offset = parseInt(char2Hash.substring(4, 8), 16);
  const lengthOffset = parseInt(lengthHash.substring(8, 12), 16);
  
  function loadQuotes() {
    try {
      const quotesPath = path.join(__dirname, '../data/quotes.txt');
      const quotesContent = fs.readFileSync(quotesPath, 'utf8');
      return quotesContent.trim().split('\n').map(line => {
        const [quote, author] = line.split('|');
        return { quote: quote.trim(), author: author.trim() };
      });
    } catch (error) {
      console.error('Error loading quotes from file:', error);
      return [{ quote: "Error loading quotes", author: "System" }];
    }
  }

  const fallbackQuotes = loadQuotes();
  
  // Enhanced distribution algorithm combining multiple hash factors
  // This significantly improves quote distribution within classrooms
  // An API call has proved to be less reliable, so we use this instead for now
  const combinedSeed = (seed + char1Offset + char2Offset + lengthOffset) % fallbackQuotes.length;
  const selectedQuote = fallbackQuotes[combinedSeed];
  
  return {
    quote: selectedQuote.quote,
    author: selectedQuote.author,
    tags: ['wisdom']
  };
}

async function getTokensForWords(words) {
  const models = [
    "gpt2",
    "p50k_base",
    "cl100k_base",
    "r50k_base"
  ];
  
  const wordTokens = {};
  
  for (const word of words) {
    const allTokens = new Set();
    
    for (const model of models) {
      let enc;
      try {
        enc = get_encoding(model);
        const tokens = enc.encode(word.toLowerCase());
        
        if (tokens && tokens.length > 0) {
          tokens.forEach(token => allTokens.add(token));
        }
        
        if (enc) {
          enc.free();
        }
      } catch (error) {
        if (enc) {
          try { enc.free(); } catch (e) { /* ignore */ }
        }
      }
    }
    
    wordTokens[word.toLowerCase()] = Array.from(allTokens);
  }
  
  return wordTokens;
}

async function generateHangmanData(uniqueId, salt = 'hangman_salt_2024') {
  try {
    const quoteData = await generateQuoteForUser(uniqueId, salt);
    const words = quoteData.quote
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    const wordTokens = await getTokensForWords(words);
    
    return {
      quote: quoteData.quote,
      author: quoteData.author,
      words: words,
      wordTokens: wordTokens,
      maskedQuote: words.map(() => '_'.repeat(5)).join(' ')
    };
  } catch (error) {
    console.error('Error generating hangman data:', error);
    throw error;
  }
}

module.exports = {
  generateQuoteForUser,
  getTokensForWords,
  generateHangmanData
};
