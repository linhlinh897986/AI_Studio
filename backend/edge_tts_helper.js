const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const fs = require('fs');
const path = require('path');

/**
 * Pre-processes text for Vietnamese speech optimization
 */
function preprocessTextForTts(text, voiceIdOrLang = 'vi') {
  if (!text) return '';
  
  // 1. Convert negative numbers (hyphen followed by a digit -> "âm ")
  let clean = text.replace(/-(?=\d)/g, 'âm ');

  // 2. Replace other hyphens with spaces for natural word separation
  clean = clean.replace(/-/g, ' ');

  // Only convert numbers if the voice language is Vietnamese
  const isVi = !voiceIdOrLang || 
               voiceIdOrLang.toLowerCase().startsWith('vi') || 
               voiceIdOrLang.toLowerCase().includes('vivn');

  if (isVi) {
    // Automatically convert abbreviated measurement units
    clean = clean.replace(/\b(\d+)\s*m\s*(\d+)\b/gi, '$1 mét $2');
    clean = clean.replace(/\b(\d+)\s*m(?![a-zA-Zà-ỹÀ-Ỹ])/gi, '$1 mét');
    clean = clean.replace(/\b(\d+)\s*cm(?![a-zA-Zà-ỹÀ-Ỹ])/gi, '$1 xăng ti mét');
    clean = clean.replace(/\b(\d+)\s*km(?![a-zA-Zà-ỹÀ-Ỹ])/gi, '$1 ki lô mét');
    clean = clean.replace(/\b(\d+)\s*kg(?![a-zA-Zà-ỹÀ-Ỹ])/gi, '$1 ki lô gam');
    
    // Helper to convert integer to Vietnamese words
    function integerToVietnamese(num) {
      num = parseInt(num, 10);
      if (isNaN(num)) return '';
      if (num === 0) return 'không';

      const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
      
      function readThreeDigits(n, showZeroHundred) {
        let res = '';
        const hundred = Math.floor(n / 100);
        const ten = Math.floor((n % 100) / 10);
        const unit = n % 10;

        if (hundred > 0) {
          res += units[hundred] + ' trăm ';
        } else if (showZeroHundred) {
          res += 'không trăm ';
        }

        if (ten > 0) {
          if (ten === 1) {
            res += 'mười ';
          } else {
            res += units[ten] + ' mươi ';
          }
        } else if ((hundred > 0 || showZeroHundred) && unit > 0) {
          res += 'lẻ ';
        }

        if (unit > 0) {
          if (unit === 1 && ten > 1) {
            res += 'mốt';
          } else if (unit === 5 && ten >= 1) {
            res += 'lăm';
          } else {
            res += units[unit];
          }
        }
        return res.trim();
      }

      let res = '';
      let billion = Math.floor(num / 1000000000);
      let million = Math.floor((num % 1000000000) / 1000000);
      let thousand = Math.floor((num % 1000000) / 1000);
      let remain = num % 1000;

      if (billion > 0) {
        res += integerToVietnamese(billion) + ' tỷ ';
      }
      if (million > 0) {
        res += readThreeDigits(million, billion > 0) + ' triệu ';
      }
      if (thousand > 0) {
        res += readThreeDigits(thousand, billion > 0 || million > 0) + ' nghìn ';
      }
      if (remain > 0 || res === '') {
        res += readThreeDigits(remain, billion > 0 || million > 0 || thousand > 0);
      }

      return res.trim().replace(/\s+/g, ' ');
    }

    // 2. Replace fractions (e.g. 3/4 -> ba phần tư)
    const fractionRegex = /\b(\d+)\/(\d+)(?:\/(\d+))?\b/g;
    clean = clean.replace(fractionRegex, (match, numerator, denominator, year) => {
      if (year) {
        return match;
      }
      const num = parseInt(numerator, 10);
      const den = parseInt(denominator, 10);
      if (num > den && den <= 12 && num <= 31) {
        return match;
      }
      let numWord = integerToVietnamese(numerator);
      let denWord = integerToVietnamese(denominator);
      if (denominator === '4') {
        denWord = 'tư';
      }
      return `${numWord} phần ${denWord}`;
    });

    // 3. Replace decimals (e.g. 0.9 -> không chấm chín)
    const decimalRegex = /\b(\d+)\.(\d+)\b/g;
    clean = clean.replace(decimalRegex, (match, integerPart, fractionalPart) => {
      const intWord = integerToVietnamese(integerPart);
      const fracWords = fractionalPart.split('').map(digit => {
        const digitMap = { '0': 'không', '1': 'một', '2': 'hai', '3': 'ba', '4': 'bốn', '5': 'năm', '6': 'sáu', '7': 'bảy', '8': 'tám', '9': 'chín' };
        return digitMap[digit] || '';
      }).join(' ');
      return `${intWord} chấm ${fracWords}`;
    });
  }

  // 4. Normalize spaces
  return clean.replace(/\s+/g, ' ').trim();
}

/**
 * Synthesize text to speech using msedge-tts native package
 */
function synthesizeSpeech(text, outputPath, options = {}) {
  const voice = options.voice || 'vi-VN-NamMinhNeural';
  const rate = options.rate || '+0%';

  return new Promise(async (resolve, reject) => {
    // 1. Preprocess and normalize text for optimal speech naturalness
    const normalizedText = preprocessTextForTts(text, voice);
    const cleanText = (normalizedText || '').trim();

    // 2. Safety fallback for punctuation-only inputs
    const hasAlphaNumeric = /[\p{L}\p{N}]/u.test(cleanText);
    if (!hasAlphaNumeric) {
      console.log(`TTS input contains no alphanumeric characters ("${cleanText}"). Generating 1.0s silent WAV file as fallback.`);
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

        const outDir = path.dirname(outputPath);
        if (outDir && !fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        fs.writeFileSync(outputPath, buffer);
        return resolve(outputPath);
      } catch (err) {
        return reject(new Error('Không thể tạo âm thanh tĩnh: ' + err.message));
      }
    }

    // Ensure output directory exists
    const outDir = path.dirname(outputPath);
    if (outDir && !fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // 3. Synthesize via MsEdgeTTS with retry logic
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 2s, 4s
          console.log(`[Edge TTS Node] Retrying attempt ${attempt}/${maxRetries} in ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
        }

        console.log(`[Edge TTS Node] Synthesizing speech: "${cleanText.substring(0, 40)}..." [Voice: ${voice}, Rate: ${rate}]`);
        const tts = new MsEdgeTTS();
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
        const { audioStream } = tts.toStream(cleanText, { rate });

        const ws = fs.createWriteStream(outputPath);
        audioStream.pipe(ws);

        await new Promise((resolveStream, rejectStream) => {
          ws.on('finish', () => {
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
              resolveStream();
            } else {
              rejectStream(new Error("Received empty audio stream (size = 0)"));
            }
          });

          const handleError = (err) => {
            try {
              ws.destroy();
            } catch (e) {}
            rejectStream(err);
          };

          ws.on('error', handleError);
          audioStream.on('error', handleError);
        });

        // Resolve on success
        return resolve(outputPath);

      } catch (err) {
        lastError = err;
        console.error(`[Edge TTS Node] Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
        // Clean up failed file chunk if exists, with a short delay to release OS lock
        try {
          await new Promise(r => setTimeout(r, 150));
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
        } catch (e) {
          console.warn(`[Edge TTS Node] Failed to unlink temp file: ${e.message}`);
        }
      }
    }

    reject(new Error(`Edge TTS Node failed after ${maxRetries} attempts: ${lastError ? lastError.message : 'Unknown error'}`));
  });
}

module.exports = {
  preprocessTextForTts,
  synthesizeSpeech
};
