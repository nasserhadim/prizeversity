const crypto = require('crypto');

const validators = {
  'caesar-decrypt': (answer, metadata, uniqueId) => {
    const hash = crypto.createHash('md5').update(uniqueId + metadata.salt).digest('hex');
    const shift = (parseInt(hash.substring(0, 2), 16) % metadata.algorithmParams.range) + metadata.algorithmParams.base;
    const expected = uniqueId.split('').map(char => {
      if (char >= 'A' && char <= 'Z') {
        return String.fromCharCode(((char.charCodeAt(0) - 65 - shift + 26) % 26) + 65);
      } else if (char >= '0' && char <= '9') {
        return String.fromCharCode(((char.charCodeAt(0) - 48 - shift + 10) % 10) + 48);
      }
      return char;
    }).join('');
    return answer.trim().toUpperCase() === expected;
  },

  'github-osint': (answer, metadata, uniqueId) => {
    const hash = crypto.createHash('md5').update(uniqueId + metadata.salt).digest('hex');
    const prefix = metadata.algorithmParams.prefixes[parseInt(hash.substring(0, 1), 16) % metadata.algorithmParams.prefixes.length];
    const suffix = hash.substring(8, 14).toUpperCase();
    const expected = `${prefix}_${suffix}`;
    return answer.trim().toUpperCase() === expected;
  },

  'cpp-debugging': (answer, metadata, uniqueId, studentData) => {
    // Complex, personalized C++ debugging challenge using student data
    const hash = crypto.createHash('md5').update(uniqueId + metadata.salt).digest('hex');
    
    // We need student data to validate - this should be passed from the route
    if (!studentData) {
      return false;
    }
    
    // Generate student-specific values from their actual data (same as generation)
    const firstNameHash = crypto.createHash('md5').update(studentData.firstName).digest('hex');
    const lastNameHash = crypto.createHash('md5').update(studentData.lastName).digest('hex');
    
    // Create multiple obfuscated values
    const nameLength = studentData.firstName.length + studentData.lastName.length;
    const agentNumeric = parseInt(studentData.agentId.replace(/\D/g, '')) % 1000;
    
    // Generate complex, interconnected values
    const baseA = parseInt(firstNameHash.substring(0, 3), 16) % 50 + 20; // 20-69
    const baseB = parseInt(lastNameHash.substring(0, 3), 16) % 30 + 10; // 10-39
    const baseC = parseInt(hash.substring(0, 3), 16) % 25 + 5; // 5-29
    
    const loopCount = (nameLength % 4) + 3; // 3-6 iterations
    const multiplierA = (agentNumeric % 3) + 2; // 2-4
    const multiplierB = (parseInt(hash.substring(6, 8), 16) % 3) + 2; // 2-4
    
    // Calculate the correct result using complex nested logic (same as generation)
    let result = baseA;
    for (let i = 0; i < loopCount; i++) {
      if (i % 2 === 0) {
        result = (result * multiplierA + baseB) - i;
      } else {
        result = (result + baseC * multiplierB) + (i * 2);
      }
    }
    
    // Add a final transformation based on student name
    const finalModifier = (nameLength * agentNumeric) % 100;
    result = result + finalModifier;
    
    return answer.trim() === result.toString();
  },

  'image-forensics': (answer, metadata, uniqueId) => {
    const hash = crypto.createHash('md5').update(uniqueId + metadata.salt).digest('hex');
    const expectedAnswer = `FORENSICS_${hash.substring(0, 8).toUpperCase()}`;
    return answer.trim() === expectedAnswer;
  },

  'wayneaws-verification': (answer, metadata, uniqueId) => {
    const answerHash = crypto.createHash('sha256').update(answer.trim()).digest('hex');
    return answerHash === metadata.staticAnswerHash;
  },

  'needle-in-haystack': (answer, metadata, uniqueId) => {
    const hash = crypto.createHash('md5').update(uniqueId + metadata.salt).digest('hex');
    const targetCode = hash.substring(0, 8).toUpperCase();
    return answer.trim().toUpperCase() === targetCode;
  },

  'custom-challenge': (answer, metadata, uniqueId) => {
    const answerHash = crypto.createHash('sha256').update(answer.trim()).digest('hex');
    return answerHash === metadata.expectedHash;
  }
};

module.exports = validators;