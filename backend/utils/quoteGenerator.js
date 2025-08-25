const { get_encoding } = require('tiktoken');
const crypto = require('crypto');

async function generateQuoteForUser(uniqueId, salt = 'hangman_challenge_2024') {
  const hash = crypto.createHash('md5').update(uniqueId + salt).digest('hex');
  const seed = parseInt(hash.substring(0, 8), 16);
  
  try {
    const axios = require('axios');
    const response = await axios.get('https://thequoteshub.com/api/', {
      timeout: 5000
    });
    
    if (response.data && typeof response.data === 'string') {
      const lines = response.data.split('\n');
      const quoteLine = lines.find(line => line.startsWith('Quote:'));
      const authorLine = lines.find(line => line.startsWith('Author:'));
      const tagsLine = lines.find(line => line.startsWith('Tags:'));
      
      if (quoteLine) {
        const quote = quoteLine.replace('Quote:', '').trim();
        const author = authorLine ? authorLine.replace('Author:', '').trim() : 'Unknown';
        const tags = tagsLine ? tagsLine.replace('Tags:', '').trim().split(',').map(t => t.trim()) : [];
        
        const wordCount = quote.replace(/[^\w\s]/g, '').split(/\s+/).filter(word => word.length > 0).length;
        if (wordCount <= 12) {
          return {
            quote: quote,
            author: author,
            tags: tags
          };
        }
      }
    }
  } catch (error) {
    // Just use fallback quotes if the API is down
  }
  
  // Shouldn't be needed but helpful if the API is down
  const fallbackQuotes = [
    { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { quote: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
    { quote: "Life is what happens to you while you're busy making other plans.", author: "John Lennon" },
    { quote: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { quote: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
    { quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { quote: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
    { quote: "Don't let yesterday take up too much of today.", author: "Will Rogers" },
    { quote: "You learn more from failure than from success.", author: "Unknown" },
    { quote: "It's not whether you get knocked down, it's whether you get up.", author: "Vince Lombardi" }
  ];
  
  const selectedQuote = fallbackQuotes[seed % fallbackQuotes.length];
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
