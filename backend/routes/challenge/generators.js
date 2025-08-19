const axios = require('axios');
const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = require('./constants');
const { generateChallenge2Password } = require('./utils');

const uploadLocks = new Map();

async function createGitHubBranch(uniqueId, userId) {
  if (GITHUB_TOKEN === 'contact-akrm-for-token') {
    console.log('GitHub token not configured, skipping branch creation');
    return;
  }

  const headers = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Prizeversity-Challenge'
  };

  try {
    try {
      await axios.get(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/branches/${uniqueId}`,
        { headers }
      );
      console.log(`Branch ${uniqueId} already exists, skipping...`);
      return;
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }
    }

    const mainBranch = await axios.get(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/branches/main`,
      { headers }
    );
    const mainSha = mainBranch.data.commit.sha;

    await axios.post(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`,
      {
        ref: `refs/heads/${uniqueId}`,
        sha: mainSha
      },
      { headers }
    );

    const challenge2Password = generateChallenge2Password(uniqueId);
    const fileContent = `\nnice job lol: ${challenge2Password}\n\n`;
    const encodedContent = Buffer.from(fileContent).toString('base64');

    await axios.put(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/hello_world.txt`,
      {
        message: `Add challenge file for ${uniqueId}`,
        content: encodedContent,
        branch: uniqueId
      },
      { headers }
    );

    console.log(`✅ Created GitHub branch ${uniqueId} with Challenge 2 password`);

  } catch (error) {
    console.error('GitHub API Error:', error.response?.data || error.message);
    throw error;
  }
}

function generateCppDebuggingChallenge(studentData, uniqueId) {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(uniqueId + 'cpp_debug_salt_2024').digest('hex');
  
  const firstNameHash = crypto.createHash('md5').update(studentData.firstName).digest('hex');
  const lastNameHash = crypto.createHash('md5').update(studentData.lastName).digest('hex');
  
  const studentInitials = (studentData.firstName[0] + studentData.lastName[0]).toUpperCase();
  const nameLength = studentData.firstName.length + studentData.lastName.length;
  const agentNumeric = parseInt(studentData.agentId.replace(/\D/g, '')) % 1000;
  
  const baseA = parseInt(firstNameHash.substring(0, 3), 16) % 50 + 20; 
  const baseB = parseInt(lastNameHash.substring(0, 3), 16) % 30 + 10; 
  const baseC = parseInt(hash.substring(0, 3), 16) % 25 + 5; 
  
  const loopCount = (nameLength % 4) + 3; 
  const multiplierA = (agentNumeric % 3) + 2; 
  const multiplierB = (parseInt(hash.substring(6, 8), 16) % 3) + 2; 
  
  const varPrefix = studentInitials;
  const className = `Agent${studentData.agentId.replace(/\D/g, '')}`;
  
  let result = baseA;
  for (let i = 0; i < loopCount; i++) {
    if (i % 2 === 0) {
      result = (result * multiplierA + baseB) - i;
    } else {
      result = (result + baseC * multiplierB) + (i * 2);
    }
  }
  
  const finalModifier = (nameLength * agentNumeric) % 100;
  result = result + finalModifier;
  
  const cppCode = `#include <iostream>
#include <string>
using namespace std;

// Student: ${studentData.firstName} ${studentData.lastName}
// Agent ID: ${studentData.agentId}
// Department: ${studentData.department}

class ${className} {
private:
    int ${varPrefix}_value_alpha;
    int ${varPrefix}_value_beta; 
    int ${varPrefix}_value_gamma;
    string agent_name;
    
public:
    ${className}() {
        agent_name = "${studentData.firstName}${studentData.lastName}";
        ${varPrefix}_value_alpha = ${baseA};  // From: ${studentData.firstName}
        ${varPrefix}_value_beta = ${baseB};   // From: ${studentData.lastName}  
        ${varPrefix}_value_gamma = ${baseC};  // From: ${uniqueId}
    }
    
    int processSecretAlgorithm() {
        int result = ${varPrefix}_value_alpha;
        int loop_max = ${loopCount}; // Based on name length: ${nameLength}
        
        for (int iteration = 0; iteration < loop_max; iteration++) {
            if (iteration % 2 == 0) {
                // Even iterations: multiply and subtract
                result = (result * ${multiplierA} + ${varPrefix}_value_beta) - iteration;
            } else {
                // Odd iterations: add and multiply
                result = (result + ${varPrefix}_value_gamma * ${multiplierB}) + (iteration * 2);
            }
        }
        
        // Final agent-specific modifier
        int agent_modifier = ${finalModifier}; // (${nameLength} * ${agentNumeric}) % 100
        result = result + agent_modifier;
        
        return result;
    }
};

int main() {
    ${className} agent;
    int final_output = agent.processSecretAlgorithm();
    cout << final_output << endl;
    return 0;
}`;

  const scenarios = [
    `Agent ${studentData.firstName} ${studentData.lastName} submitted this classified algorithm, but the security team needs to verify the output.`,
    `The ${studentData.department} received this encrypted code from Agent ${studentData.agentId}. What's the decryption result?`,
    `This personalized security protocol was generated for ${studentData.firstName}. Trace through the execution manually.`,
    `Agent ${studentData.lastName} reported anomalies in this code. Calculate the actual output to verify their findings.`,
    `The cyber security division needs ${studentData.firstName} to manually verify this algorithm's output for security audit purposes.`
  ];
  
  const scenarioIndex = parseInt(hash.substring(8, 10), 16) % scenarios.length;
  
  const challenge = {
    missionId: `SECURE-${studentData.agentId}-${hash.substring(10, 14).toUpperCase()}`,
    scenario: scenarios[scenarioIndex],
    agentId: studentData.agentId,
    studentName: `${studentData.firstName} ${studentData.lastName}`,
    cppCode: cppCode,
    actualOutput: result,
    task: `Manually trace through this C++ program and determine what value it outputs. This is YOUR personalized code - it won't work for other students!`,
    securityNote: `🔒 ANTI-CHEAT: This code is personalized with YOUR name and agent ID. AI tools will give wrong answers because they don't know your specific student data!`,
    hint: "Work through each loop iteration step by step. Pay attention to the even/odd iteration logic and the final modifier calculation.",
    difficulty: "Intermediate",
    timeLimit: "30 minutes",
    debugInfo: {
      studentSpecificData: {
        firstName: studentData.firstName,
        lastName: studentData.lastName,
        agentId: studentData.agentId,
        nameLength: nameLength,
        agentNumeric: agentNumeric,
        initials: studentInitials
      },
      calculationParams: {
        baseA: baseA,
        baseB: baseB, 
        baseC: baseC,
        loopCount: loopCount,
        multiplierA: multiplierA,
        multiplierB: multiplierB,
        finalModifier: finalModifier
      }
    }
  };
  
  return challenge;
}

async function generateAndUploadForensicsImage(user, uniqueId) {
  const fs = require('fs').promises;
  const path = require('path');
  const sharp = require('sharp');
  const piexifjs = require('piexifjs');
  
  try {
    const crypto = require('crypto');
    const studentHash = crypto.createHash('md5').update(user._id.toString() + uniqueId).digest('hex');
    const artistName = `FORENSICS_${studentHash.substring(0, 8).toUpperCase()}`;
    const filename = `campus_${uniqueId}.jpg`;
    
    const baseImagePath = path.join(__dirname, '../../..', 'frontend/src/assets/campus.jpg');
    const baseImageBuffer = await fs.readFile(baseImagePath);
    
    const imageBuffer = await sharp(baseImageBuffer)
      .composite([{
        input: Buffer.from(`<svg width="300" height="50">
          <rect width="300" height="50" fill="rgba(0,0,0,0.7)"/>
          <text x="10" y="30" fill="white" font-size="14" font-family="Arial">
            Evidence ID: ${uniqueId.substring(0, 8)}
          </text>
        </svg>`),
        gravity: 'southeast'
      }])
      .jpeg({ quality: 95 })
      .toBuffer();
    
    const exifObj = {
      '0th': {
        [piexifjs.ImageIFD.Artist]: artistName,
        [piexifjs.ImageIFD.Copyright]: `WSU Cybersecurity Challenge - ${new Date().getFullYear()}`,
        [piexifjs.ImageIFD.Software]: 'WSU Forensics Lab',
        [piexifjs.ImageIFD.DateTime]: new Date().toISOString().replace('T', ' ').substring(0, 19)
      }
    };
    
    const exifBytes = piexifjs.dump(exifObj);
    
    const base64Image = 'data:image/jpeg;base64,' + imageBuffer.toString('base64');
    const finalImageBase64 = piexifjs.insert(exifBytes, base64Image);
    const finalImageBuffer = Buffer.from(finalImageBase64.split(',')[1], 'base64');
    
    await uploadToGitHub(filename, finalImageBuffer, GITHUB_TOKEN);
    
    return { filename, artistName };
    
  } catch (error) {
    console.error('Error generating forensics image:', error);
    throw new Error('Failed to generate forensics evidence');
  }
}

async function uploadToGitHub(filename, fileBuffer, githubToken) {
  if (!githubToken || githubToken === 'contact-akrm-for-token') {
    throw new Error('GITHUB_TOKEN environment variable not properly configured');
  }
  
  const owner = 'cinnamonstic';
  const repo = 'wsu-transit-delay';
  const path = `assets/${filename}`;
  
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      let sha = null;
      
      try {
        const existingFile = await axios.get(url, {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        sha = existingFile.data.sha;
        console.log(`File ${filename} exists, updating with SHA: ${sha}`);
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`File ${filename} does not exist, creating new file`);
        } else {
          throw error;
        }
      }
      
      const uploadData = {
        message: sha ? `chore: update campus image ${filename}` : `chore: add campus image ${filename}`,
        content: fileBuffer.toString('base64')
      };
      
      if (sha) {
        uploadData.sha = sha;
      }
      
      const response = await axios.put(url, uploadData, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      console.log(`✅ Successfully uploaded ${filename} to GitHub`);
      return response.data;
      
    } catch (error) {
      if (error.response?.status === 409) {
        console.warn(`⚠️  SHA conflict for ${filename}, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
        retryCount++;
        if (retryCount >= maxRetries) {
          throw new Error('Max retries reached for SHA conflict');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      console.error('GitHub upload error:', error.response?.data || error.message);
      throw new Error('Failed to upload to GitHub');
    }
  }
}

module.exports = {
  createGitHubBranch,
  generateCppDebuggingChallenge,
  generateAndUploadForensicsImage,
  uploadLocks
};
