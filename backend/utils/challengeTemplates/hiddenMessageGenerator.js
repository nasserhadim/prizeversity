/**
 * Hidden Message Template Generator
 * 
 * Embeds codes into image EXIF metadata or filenames.
 * Uses piexifjs for real EXIF manipulation.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateCode(seed) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  
  const hash = crypto.createHash('sha256').update(seed + 'hiddencode').digest('hex');
  
  for (let i = 0; i < 12; i++) {
    const index = parseInt(hash.substring(i * 2, i * 2 + 2), 16) % chars.length;
    code += chars[index];
    if (i === 3 || i === 7) code += '-';
  }
  
  return code;
}

async function generate(config, seed) {
  const embedMethod = config.embedMethod || 'exif';
  const answer = generateCode(seed);
  
  let displayData;
  let metadata = { embedMethod };
  
  switch (embedMethod) {
    case 'exif': {
      displayData = JSON.stringify({
        type: 'exif',
        instructions: 'Download the challenge file and examine its metadata.',
        format: 'XXXX-XXXX-XXXX'
      }, null, 2);
      
      metadata.exifField = 'ImageDescription';
      metadata.hiddenCode = answer;
      break;
    }
    
    case 'filename': {
      const encodedAnswer = Buffer.from(answer).toString('base64').replace(/=/g, '');
      const obfuscatedFilename = `challenge_${encodedAnswer}_data.txt`;
      
      displayData = JSON.stringify({
        type: 'filename',
        filename: obfuscatedFilename,
        encoding: 'base64'
      }, null, 2);
      
      metadata.filename = obfuscatedFilename;
      metadata.encoding = 'base64';
      break;
    }
    
    default:
      displayData = JSON.stringify({
        type: 'unknown'
      }, null, 2);
  }
  
  return {
    displayData,
    expectedAnswer: answer,
    metadata
  };
}

/**
 * Generate a personalized image with EXIF data embedded
 * This creates a real JPEG with the code in EXIF metadata
 */
async function generatePersonalizedFile(config, studentProgress, baseFilePath = null) {
  const embedMethod = config.embedMethod || 'exif';
  const answer = studentProgress.generatedContent?.metadata?.hiddenCode || 
                 studentProgress.generatedContent?.expectedAnswer;
  
  if (!answer) {
    throw new Error('No generated answer found for this student');
  }
  
  switch (embedMethod) {
    case 'exif': {
      try {
        const piexif = require('piexifjs');
        
        // Create a minimal JPEG with EXIF data
        // If teacher uploaded a base image, use that; otherwise create a simple one
        let imageData;
        
        if (baseFilePath && fs.existsSync(baseFilePath)) {
          imageData = fs.readFileSync(baseFilePath).toString('binary');
        } else {
          // Use sharp to create a simple challenge image
          const sharp = require('sharp');
          
          // Create a simple gradient image
          const width = 800;
          const height = 600;
          
          const svgImage = `
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
                </linearGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#grad)"/>
              <text x="50%" y="45%" font-family="monospace" font-size="24" fill="#0f3460" text-anchor="middle">
                CHALLENGE FILE
              </text>
              <text x="50%" y="55%" font-family="monospace" font-size="16" fill="#0f3460" text-anchor="middle">
                Examine the metadata
              </text>
            </svg>
          `;
          
          const jpegBuffer = await sharp(Buffer.from(svgImage))
            .jpeg({ quality: 90 })
            .toBuffer();
          
          imageData = jpegBuffer.toString('binary');
        }
        
        // Insert EXIF data with the hidden code
        const zeroth = {};
        const exif = {};
        const gps = {};
        
        // Set the hidden code in ImageDescription
        zeroth[piexif.ImageIFD.ImageDescription] = answer;
        zeroth[piexif.ImageIFD.Software] = 'Prizeversity Challenge';
        zeroth[piexif.ImageIFD.Artist] = 'Challenge System';
        
        // Also hide it in UserComment for those who check there
        exif[piexif.ExifIFD.UserComment] = `ASCII\0\0\0${answer}`;
        
        const exifObj = { '0th': zeroth, 'Exif': exif, 'GPS': gps };
        const exifStr = piexif.dump(exifObj);
        
        // Remove existing EXIF and insert new
        let newImageData;
        try {
          const stripped = piexif.remove(imageData);
          newImageData = piexif.insert(exifStr, stripped);
        } catch (e) {
          // If removing fails, try inserting directly
          newImageData = piexif.insert(exifStr, imageData);
        }
        
        return {
          content: Buffer.from(newImageData, 'binary'),
          filename: `challenge_${Date.now()}.jpg`,
          mimetype: 'image/jpeg'
        };
      } catch (error) {
        // Fallback to text-based approach if EXIF manipulation fails
        const content = `EXIF Metadata Dump
==================
ImageDescription: ${answer}
Software: Prizeversity Challenge
Artist: Challenge System
==================`;
        
        return {
          content: Buffer.from(content),
          filename: `challenge_metadata_${Date.now()}.txt`,
          mimetype: 'text/plain'
        };
      }
    }
    
    case 'filename': {
      const encodedAnswer = Buffer.from(answer).toString('base64').replace(/=/g, '');
      const filename = `challenge_${encodedAnswer}_data.txt`;
      
      const content = `Challenge File
==============

Decode the filename to find your answer.
The encoded portion is between "challenge_" and "_data".
`;
      
      return {
        content: Buffer.from(content),
        filename: filename,
        mimetype: 'text/plain'
      };
    }
    
    default:
      throw new Error(`Unknown embed method: ${embedMethod}`);
  }
}

function validateConfig(config) {
  const errors = [];
  
  const validMethods = ['exif', 'filename'];
  if (config.embedMethod && !validMethods.includes(config.embedMethod)) {
    errors.push(`Invalid embed method: ${config.embedMethod}`);
  }
  
  return { valid: errors.length === 0, errors };
}

module.exports = {
  generate,
  generatePersonalizedFile,
  validateConfig
};
