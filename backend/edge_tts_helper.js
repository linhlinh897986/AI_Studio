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
    // Check if the text has any speakable alphanumeric characters
    // Using Unicode property escapes (\p{L} for letters, \p{N} for numbers)
    const hasAlphaNumeric = /[\p{L}\p{N}]/u.test(text);
    if (!hasAlphaNumeric) {
      console.log(`TTS input contains no alphanumeric characters ("${text}"). Generating 1.0s silent WAV file as fallback.`);
      try {
        const numChannels = 1;
        const bitsPerSample = 16;
        const sampleRate = 16000;
        const blockAlign = numChannels * (bitsPerSample / 8); 
        const byteRate = sampleRate * blockAlign; 
        const dataSize = Math.floor(1.0 * byteRate); // 1.0 second of silence
        const buffer = Buffer.alloc(44 + dataSize);

        buffer.write('RIFF', 0);
        buffer.writeUInt32LE(36 + dataSize, 4);
        buffer.write('WAVE', 8);
        buffer.write('fmt ', 12);
        buffer.writeUInt32LE(16, 16);
        buffer.writeUInt16LE(1, 20);
        buffer.writeUInt16LE(numChannels, 22);
        buffer.writeUInt32LE(sampleRate, 24);
        buffer.writeUInt32LE(byteRate, 28);
        buffer.writeUInt16LE(blockAlign, 32);
        buffer.writeUInt16LE(bitsPerSample, 34);
        buffer.write('data', 36);
        buffer.writeUInt32LE(dataSize, 40);

        fs.writeFileSync(outputPath, buffer);
        return resolve(outputPath);
      } catch (err) {
        return reject(new Error('Không thể tạo âm thanh tĩnh: ' + err.message));
      }
    }

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
