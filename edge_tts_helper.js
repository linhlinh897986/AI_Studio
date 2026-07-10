const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Synthesize text to speech using edge-tts CLI tool
 * @param {string} text Text to speak
 * @param {string} outputPath Output file path
 * @param {object} options Speech options
 * @returns {Promise<string>}
 */
function synthesizeSpeech(text, outputPath, options = {}) {
  const voice = options.voice || 'vi-VN-NamMinhNeural';
  const rate = options.rate || '+0%';

  return new Promise((resolve, reject) => {
    // Edge-tts python script path on user's machine
    const edgeTtsPath = 'C:\\Users\\linhl\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts\\edge-tts.exe';
    
    // Write text to a temp file to avoid Windows CMD command line character limits (8191 chars)
    const tempTextFile = path.join(path.dirname(outputPath), `tts_input_${Date.now()}_${Math.floor(Math.random() * 1000)}.txt`);
    
    try {
      fs.writeFileSync(tempTextFile, text, 'utf8');
    } catch (err) {
      return reject(new Error('Không thể tạo file tạm cho văn bản TTS: ' + err.message));
    }

    // Run edge-tts using file input
    const cmd = `"${edgeTtsPath}" -f "${tempTextFile}" -v "${voice}" --rate="${rate}" --write-media "${outputPath}"`;
    
    exec(cmd, (error, stdout, stderr) => {
      // Clean up temp text file
      try {
        fs.unlinkSync(tempTextFile);
      } catch (e) {}

      if (error) {
        console.error("edge-tts CLI error:", stderr || error.message);
        reject(new Error(stderr || error.message));
      } else {
        resolve(outputPath);
      }
    });
  });
}

module.exports = {
  synthesizeSpeech
};
