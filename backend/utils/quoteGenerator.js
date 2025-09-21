const { get_encoding } = require('tiktoken');
const crypto = require('crypto');

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
  
  const fallbackQuotes = [
    // Tech & Innovation
    { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { quote: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
    { quote: "Code is poetry.", author: "Unknown" },
    { quote: "The best error message is the one that never shows up.", author: "Thomas Fuchs" },
    { quote: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
    { quote: "Programs must be written for people to read.", author: "Harold Abelson" },
    { quote: "Any fool can write code that a computer can understand.", author: "Martin Fowler" },
    { quote: "First, solve the problem. Then, write the code.", author: "John Johnson" },
    { quote: "Code never lies, comments sometimes do.", author: "Ron Jeffries" },
    { quote: "The function of good software is to make the complex appear simple.", author: "Grady Booch" },
    
    // Motivational & Success
    { quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { quote: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
    { quote: "Don't let yesterday take up too much of today.", author: "Will Rogers" },
    { quote: "You learn more from failure than from success.", author: "Unknown" },
    { quote: "It's not whether you get knocked down, it's whether you get up.", author: "Vince Lombardi" },
    { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { quote: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
    { quote: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill" },
    { quote: "Your limitation—it's only your imagination.", author: "Unknown" },
    { quote: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
    
    // Philosophy & Wisdom
    { quote: "Life is what happens to you while you're busy making other plans.", author: "John Lennon" },
    { quote: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { quote: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
    { quote: "Be yourself; everyone else is already taken.", author: "Oscar Wilde" },
    { quote: "Two things are infinite: the universe and human stupidity.", author: "Albert Einstein" },
    { quote: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
    { quote: "Life is really simple, but we insist on making it complicated.", author: "Confucius" },
    { quote: "The only true wisdom is in knowing you know nothing.", author: "Socrates" },
    { quote: "Yesterday is history, tomorrow is a mystery, today is a gift.", author: "Eleanor Roosevelt" },
    { quote: "The mind is everything. What you think you become.", author: "Buddha" },
    
    // Learning & Growth
    { quote: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
    { quote: "The more that you read, the more things you will know.", author: "Dr. Seuss" },
    { quote: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
    { quote: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
    { quote: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
    { quote: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
    { quote: "The expert in anything was once a beginner.", author: "Helen Hayes" },
    { quote: "Knowledge is power.", author: "Francis Bacon" },
    { quote: "Tell me and I forget, teach me and I remember, involve me and I learn.", author: "Benjamin Franklin" },
    { quote: "The capacity to learn is a gift; the ability to learn is a skill.", author: "Brian Herbert" },
    
    // Leadership & Achievement  
    { quote: "A leader is one who knows the way, goes the way, and shows the way.", author: "John C. Maxwell" },
    { quote: "The greatest leader is not necessarily the one who does the greatest things.", author: "Ronald Reagan" },
    { quote: "Don't be afraid to give your best to what seemingly are small jobs.", author: "Dale Carnegie" },
    { quote: "The difference between ordinary and extraordinary is that little extra.", author: "Jimmy Johnson" },
    { quote: "Excellence is never an accident.", author: "Aristotle" },
    { quote: "Quality is not an act, it is a habit.", author: "Aristotle" },
    { quote: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
    { quote: "The only way to achieve the impossible is to believe it is possible.", author: "Charles Kingsleigh" },
    { quote: "Dream big and dare to fail.", author: "Norman Vaughan" },
    { quote: "What lies behind us and what lies before us are tiny matters.", author: "Ralph Waldo Emerson" }
  ];
  
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
