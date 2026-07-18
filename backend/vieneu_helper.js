const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');

/**
 * Resolves the path to the Python executable, prioritizing pre-installed environments
 */
function getPythonPath() {
  // 1. Check if D:\AIO virtual environment exists (preferred, pre-setup with vieneu)
  const aioVenv = 'D:\\AIO\\.venv\\Scripts\\python.exe';
  if (fs.existsSync(aioVenv)) {
    return aioVenv;
  }
  
  // 2. Check if local venv exists in current project
  const localVenv = path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(localVenv)) {
    return localVenv;
  }
  
  // 3. Fallback to global python
  return 'python';
}

/**
 * Uploads reference audio to Google Colab / Local server
 */
function uploadRefAudio(colabUrl, refAudioPath) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`[VieNeu Colab] Uploading reference audio: ${path.basename(refAudioPath)}`);
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      const fileBuffer = fs.readFileSync(refAudioPath);
      const fileName = 'reference.wav';

      let fileHeader = `--${boundary}\r\n`;
      fileHeader += `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`;
      fileHeader += `Content-Type: audio/wav\r\n\r\n`;

      const fileHeaderBuffer = Buffer.from(fileHeader, 'utf-8');
      const fileFooterBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');

      const requestBody = Buffer.concat([
        fileHeaderBuffer,
        fileBuffer,
        fileFooterBuffer
      ]);

      const parsedUrl = new URL(colabUrl);
      const clientModule = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: '/upload_ref',
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': requestBody.length,
          'ngrok-skip-browser-warning': 'true'
        },
        timeout: 45000
      };

      const req = clientModule.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Tải file mẫu lên Colab thất bại: Mã lỗi ${res.statusCode} - ${body}`));
          }
          try {
            const json = JSON.parse(body);
            if (json.ref_path) {
              resolve(json.ref_path);
            } else {
              reject(new Error(`Colab phản hồi không chứa ref_path: ${body}`));
            }
          } catch (e) {
            reject(new Error(`Lỗi parse phản hồi upload_ref của Colab: ${e.message}`));
          }
        });
      });

      req.on('error', (e) => reject(new Error(`Không thể kết nối đến endpoint upload_ref của Colab: ${e.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Yêu cầu upload_ref quá thời gian chờ (Timeout)'));
      });

      req.write(requestBody);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Synthesizes Vietnamese speech using local VieNeu-TTS (ONNX Runtime)
 */
function synthesizeLocalTts(text, outputPath, options = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      const { checkVieNeuStatus } = require('./local_models_manager');
      const isLocalInstalled = checkVieNeuStatus();

      // If not installed locally, but colabApiUrl is configured, use Colab
      if (!isLocalInstalled && options.colabApiUrl) {
        console.log("[VieNeu] Local installation not found. Running Colab synthesis...");
        const colabUrl = options.colabApiUrl;
        
        let colabRefPath = null;
        if (options.refAudioPath && fs.existsSync(options.refAudioPath)) {
          try {
            colabRefPath = await uploadRefAudio(colabUrl, options.refAudioPath);
          } catch (uploadError) {
            console.warn(`[VieNeu Colab] Upload pre-check failed: ${uploadError.message}. Proceeding with direct stream fallback.`);
          }
        }

        console.log(`[VieNeu Colab] Requesting synthesis from: ${colabUrl}`);
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

        let payload = '';
        payload += `--${boundary}\r\n`;
        payload += `Content-Disposition: form-data; name="text"\r\n\r\n${text}\r\n`;
        
        if (options.voice) {
          payload += `--${boundary}\r\n`;
          payload += `Content-Disposition: form-data; name="voice"\r\n\r\n${options.voice}\r\n`;
        }

        let requestBody;
        if (colabRefPath) {
          payload += `--${boundary}\r\n`;
          payload += `Content-Disposition: form-data; name="ref_path"\r\n\r\n${colabRefPath}\r\n`;
          payload += `--${boundary}--\r\n`;
          requestBody = Buffer.from(payload, 'utf-8');
        } else if (options.refAudioPath && fs.existsSync(options.refAudioPath)) {
          const fileBuffer = fs.readFileSync(options.refAudioPath);
          const fileName = 'reference.wav';

          let fileHeader = `--${boundary}\r\n`;
          fileHeader += `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`;
          fileHeader += `Content-Type: audio/wav\r\n\r\n`;

          const fileHeaderBuffer = Buffer.from(fileHeader, 'utf-8');
          const fileFooterBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');

          requestBody = Buffer.concat([
            Buffer.from(payload, 'utf-8'),
            fileHeaderBuffer,
            fileBuffer,
            fileFooterBuffer
          ]);
        } else {
          payload += `--${boundary}--\r\n`;
          requestBody = Buffer.from(payload, 'utf-8');
        }

        const parsedUrl = new URL(colabUrl);
        const clientModule = parsedUrl.protocol === 'https:' ? https : http;

        const reqOptions = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          path: '/synthesize',
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': requestBody.length,
            'ngrok-skip-browser-warning': 'true'
          },
          timeout: 120000 // 2 minutes
        };

        const req = clientModule.request(reqOptions, (res) => {
          if (res.statusCode !== 200) {
            let errData = '';
            res.on('data', chunk => errData += chunk);
            res.on('end', () => {
              let errorMsg = `API trả về mã lỗi ${res.statusCode}`;
              if (res.statusCode === 502 || errData.includes('ERR_NGROK') || errData.includes('cf-error-details')) {
                errorMsg = `Lỗi kết nối Server Colab/Ngrok. Vui lòng kiểm tra lại Google Colab Notebook của bạn đã được khởi chạy toàn bộ các cell chưa.`;
              } else {
                errorMsg += `: ${errData}`;
              }
              reject(new Error(errorMsg));
            });
            return;
          }

          const outStream = fs.createWriteStream(outputPath);
          res.pipe(outStream);
          outStream.on('finish', () => resolve(outputPath));
          outStream.on('error', (err) => reject(new Error(`Lỗi khi ghi file âm thanh: ${err.message}`)));
        });

        req.on('error', (e) => reject(new Error(`Kết nối đến VieNeu Colab API thất bại: ${e.message}`)));
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Yêu cầu đến Colab API quá thời gian chờ (Timeout)'));
        });

        req.write(requestBody);
        req.end();
        return;
      }

      // If not local and no Colab URL
      if (!isLocalInstalled) {
        return reject(new Error("Mô hình VieNeu chưa được cài đặt cục bộ và bạn chưa cấu hình Google Colab URL trong Cài đặt hệ thống."));
      }

      // Local synthesis
      const pythonPath = getPythonPath();
      const scriptPath = path.join(__dirname, 'python', 'vieneu_local.py');
      
      const args = [
        scriptPath,
        '--text', text,
        '--output', outputPath
      ];
      
      if (options.refAudioPath) {
        args.push('--ref_audio', options.refAudioPath);
      } else if (options.voice && !options.voice.includes('Neural')) {
        args.push('--voice', options.voice);
      }
      
      console.log(`[VieNeu TTS Local] Executing: "${pythonPath}" ${args.map(a => `"${a}"`).join(' ')}`);
      const child = spawn(pythonPath, args);
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        const msg = data.toString();
        stdout += msg;
        console.log(`[VieNeu Python STDOUT] ${msg.trim()}`);
      });
      
      child.stderr.on('data', (data) => {
        const msg = data.toString();
        stderr += msg;
        console.error(`[VieNeu Python STDERR] ${msg.trim()}`);
      });
      
      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`VieNeu local failed with code ${code}. Details: ${stderr}`));
        }
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          resolve(outputPath);
        } else {
          reject(new Error("VieNeu synthesized successfully but the output file is missing or empty."));
        }
      });
      
      child.on('error', (err) => {
        reject(new Error(`Failed to start VieNeu python process: ${err.message}`));
      });
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = {
  getPythonPath,
  synthesizeLocalTts
};
