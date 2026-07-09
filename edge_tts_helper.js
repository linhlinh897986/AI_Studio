const WebSocket = require('ws');
const fs = require('fs');
const crypto = require('crypto');

/**
 * Generate SSML for Microsoft Edge TTS
 * @param {string} text 
 * @param {string} voice 
 * @param {string} rate 
 * @returns {string}
 */
function makeSsml(text, voice = 'vi-VN-NamMinhNeural', rate = '+0%') {
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='vi-VN'>
    <voice name='${voice}'>
      <prosody pitch='+0Hz' rate='${rate}' volume='+0%'>${text}</prosody>
    </voice>
  </speak>`;
}

/**
 * Generate a random Edge TTS request ID
 * @returns {string}
 */
function makeRequestId() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

/**
 * Synthesize text to speech and save as MP3
 * @param {string} text Text to speak
 * @param {string} outputPath Output file path
 * @param {object} options Speech options
 * @returns {Promise<string>}
 */
function synthesizeSpeech(text, outputPath, options = {}) {
  const voice = options.voice || 'vi-VN-NamMinhNeural';
  const rate = options.rate || '+0%';
  
  return new Promise((resolve, reject) => {
    const wsUrl = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E92837EF58D6847F14E';
    const ws = new WebSocket(wsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        'Origin': 'chrome-extension://jdiccldimpdaibdgojnbhgbigifhcomb'
      }
    });

    const audioChunks = [];
    let isFinished = false;

    ws.on('open', () => {
      // 1. Send Configuration
      const timestamp = new Date().toISOString();
      const configMessage = `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"system":{"name":"SpeechSDK","version":"1.30.0","build":"JavaScript","lang":"JavaScript"}}}`;
      ws.send(configMessage);

      // 2. Send SSML request
      const reqId = makeRequestId();
      const ssml = makeSsml(text, voice, rate);
      const ssmlMessage = `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}\r\nPath:ssml\r\n\r\n${ssml}`;
      ws.send(ssmlMessage);
    });

    ws.on('message', (data, isBinary) => {
      try {
        if (isBinary) {
          // The binary format starts with a 2-byte header indicating the size of the text metadata
          const headerLength = data.readUInt16BE(0);
          const header = data.toString('utf8', 2, 2 + headerLength);
          
          if (header.includes('Path:audio')) {
            // Raw audio payload is after the 2-byte length and the header metadata
            const audioData = data.subarray(2 + headerLength);
            audioChunks.push(audioData);
          }
        } else {
          const textMsg = data.toString('utf8');
          if (textMsg.includes('Path:turn.end')) {
            isFinished = true;
            ws.close();
          }
        }
      } catch (err) {
        reject(err);
      }
    });

    ws.on('close', (code, reason) => {
      if (isFinished) {
        if (audioChunks.length === 0) {
          reject(new Error('TTS closed but received no audio data'));
        } else {
          try {
            const buffer = Buffer.concat(audioChunks);
            fs.writeFileSync(outputPath, buffer);
            resolve(outputPath);
          } catch (err) {
            reject(err);
          }
        }
      } else {
        reject(new Error(`WebSocket connection closed prematurely. Code: ${code}, Reason: ${reason || 'Unknown'}`));
      }
    });

    ws.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = {
  synthesizeSpeech
};
