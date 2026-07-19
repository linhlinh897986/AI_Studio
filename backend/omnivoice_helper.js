const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

/**
 * Uploads reference audio to Google Colab / Local server
 */
function uploadRefAudio(colabUrl, refAudioPath) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`[OmniVoice Colab] Uploading reference audio: ${path.basename(refAudioPath)}`);
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
        timeout: 300000 // 5 minutes
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
 * Executes Colab Async Polling workflow for OmniVoice to eliminate Cloudflare 524 timeouts.
 */
async function executeColabAsyncPolling({ colabUrl, requestBody, boundary, outputPath }) {
  const parsedUrl = new URL(colabUrl);
  const clientModule = parsedUrl.protocol === 'https:' ? https : http;

  const submitTask = () => new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: '/synthesize_async',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': requestBody.length,
        'ngrok-skip-browser-warning': 'true'
      },
      timeout: 30000
    };

    const req = clientModule.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(body);
            if (json.task_id) return resolve(json.task_id);
          } catch (e) {}
        }
        const snippet = (body || '').replace(/[\r\n]+/g, ' ').slice(0, 150);
        reject(new Error(`Endpoint /synthesize_async not supported or returned ${res.statusCode}: ${snippet}`));
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Task submission timeout')); });
    req.write(requestBody);
    req.end();
  });

  const pollStatus = (taskId) => new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: `/status/${taskId}`,
      method: 'GET',
      headers: { 'ngrok-skip-browser-warning': 'true' },
      timeout: 15000
    };

    const req = clientModule.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            const snippet = (body || '').replace(/[\r\n]+/g, ' ').slice(0, 150);
            reject(new Error(`Máy chủ Colab phản hồi không đúng định dạng JSON: ${snippet}`));
          }
        } else {
          reject(new Error(`Status check failed with code ${res.statusCode}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Status check timeout')); });
    req.end();
  });

  const downloadResult = (taskId) => new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: `/download/${taskId}`,
      method: 'GET',
      headers: { 'ngrok-skip-browser-warning': 'true' },
      timeout: 120000
    };

    const req = clientModule.request(reqOptions, (res) => {
      if (res.statusCode !== 200) {
        let errData = '';
        res.on('data', chunk => errData += chunk);
        res.on('end', () => reject(new Error(`Download error ${res.statusCode}: ${errData}`)));
        return;
      }
      const outStream = fs.createWriteStream(outputPath);
      res.pipe(outStream);
      outStream.on('finish', () => resolve(outputPath));
      outStream.on('error', (err) => reject(err));
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Download timeout')); });
    req.end();
  });

  const taskId = await submitTask();
  console.log(`[OmniVoice Colab Async] Started task ID: ${taskId}. Polling every 3s...`);

  const startTime = Date.now();
  const maxWaitMs = 30 * 60 * 1000; // 30 mins max

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const statusRes = await pollStatus(taskId);
      if (statusRes.status === 'completed') {
        console.log(`[OmniVoice Colab Async] Task ${taskId} completed! Downloading audio...`);
        return await downloadResult(taskId);
      } else if (statusRes.status === 'error') {
        throw new Error(`Colab task failed: ${statusRes.error || 'Unknown error'}`);
      }
    } catch (pollErr) {
      if (pollErr.message.includes('task failed')) throw pollErr;
      console.warn(`[OmniVoice Async Polling Transient Error]: ${pollErr.message}`);
    }
  }

  throw new Error("Colab synthesis task timed out after 30 minutes of polling.");
}

/**
 * Synthesizes speech using OmniVoice API
 */
function synthesizeOmniVoice(text, outputPath, options = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      const refAudioPath = options.refAudioPath;
      if (!refAudioPath || !fs.existsSync(refAudioPath)) {
        return reject(new Error('OmniVoice yêu cầu chọn một tệp âm thanh mẫu (.wav) để clone giọng.'));
      }

      // Check if local installation exists
      const { checkOmniVoiceStatus, getVenvPythonCommand } = require('./local_models_manager');
      if (checkOmniVoiceStatus()) {
        console.log("[OmniVoice] Local installation detected. Running local synthesis...");
        const pyCmd = getVenvPythonCommand();
        const scriptPath = path.join(__dirname, 'python', 'omnivoice_local.py');
        const child = spawn(pyCmd, [scriptPath, '--text', text, '--output', outputPath, '--ref_audio', refAudioPath]);
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', data => stdout += data.toString());
        child.stderr.on('data', data => stderr += data.toString());
        
        child.on('close', (code) => {
          if (code !== 0) {
            return reject(new Error(`OmniVoice Local failed with code ${code}. Details: ${stderr}`));
          }
          if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            resolve(outputPath);
          } else {
            reject(new Error("OmniVoice synthesized successfully but output file is missing or empty."));
          }
        });
        
        child.on('error', (err) => {
          reject(new Error(`Failed to start OmniVoice local python process: ${err.message}`));
        });
        return;
      }

      // Fallback: Google Colab Synthesis
      const colabUrl = options.colabApiUrl || '';
      if (!colabUrl) {
        return reject(new Error('Chưa cấu hình đường dẫn API Google Colab trong Cài đặt hệ thống.'));
      }

      // Try uploading reference file first to optimize
      let colabRefPath = null;
      try {
        colabRefPath = await uploadRefAudio(colabUrl, refAudioPath);
      } catch (uploadError) {
        console.warn(`[OmniVoice Colab] Upload pre-check failed: ${uploadError.message}. Proceeding with direct stream fallback.`);
      }

      console.log(`[OmniVoice Colab] Requesting synthesis from: ${colabUrl}`);
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

      let payload = '';
      payload += `--${boundary}\r\n`;
      payload += `Content-Disposition: form-data; name="text"\r\n\r\n${text}\r\n`;
      payload += `--${boundary}\r\n`;
      payload += `Content-Disposition: form-data; name="language"\r\n\r\nvi\r\n`;

      const numStep = options.numStep !== undefined ? options.numStep : 32;
      payload += `--${boundary}\r\n`;
      payload += `Content-Disposition: form-data; name="num_step"\r\n\r\n${numStep}\r\n`;

      const guidanceScale = options.guidanceScale !== undefined ? options.guidanceScale : 2.5;
      payload += `--${boundary}\r\n`;
      payload += `Content-Disposition: form-data; name="guidance_scale"\r\n\r\n${guidanceScale}\r\n`;

      let requestBody;
      if (colabRefPath) {
        payload += `--${boundary}\r\n`;
        payload += `Content-Disposition: form-data; name="ref_path"\r\n\r\n${colabRefPath}\r\n`;
        payload += `--${boundary}--\r\n`;
        requestBody = Buffer.from(payload, 'utf-8');
      } else {
        const fileBuffer = fs.readFileSync(refAudioPath);
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
      }

      // Try Async Polling first (prevents Cloudflare 524 timeouts)
      try {
        console.log(`[OmniVoice Colab] Attempting Async Polling workflow on ${colabUrl}...`);
        const asyncResult = await executeColabAsyncPolling({
          colabUrl,
          requestBody,
          boundary,
          outputPath
        });
        return resolve(asyncResult);
      } catch (asyncErr) {
        console.warn(`[OmniVoice Colab] Async polling fallback to direct stream: ${asyncErr.message}`);
        if (asyncErr.message.includes('task failed')) {
          return reject(asyncErr);
        }
      }

      // Direct Stream Sync Fallback
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
        timeout: 1800000 // 30 minutes
      };

      const req = clientModule.request(reqOptions, (res) => {
        if (res.statusCode !== 200) {
          let errData = '';
          res.on('data', chunk => errData += chunk);
          res.on('end', () => {
            let errorMsg = `API trả về mã lỗi ${res.statusCode}`;
            if (res.statusCode === 524 || errData.includes('524')) {
              errorMsg = `Lỗi Cloudflare 524 (Timeout 100s): Do đoạn văn bản quá dài, Colab xử lý vượt quá 100 giây nên dịch vụ Cloudflare Tunnel đã tự động ngắt kết nối. Vui lòng chuyển sang dùng đường dẫn Ngrok Tunnel trên Colab hoặc chia nhỏ văn bản.`;
            } else if (res.statusCode === 502 || errData.includes('ERR_NGROK') || errData.includes('cf-error-details')) {
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

      req.on('error', (e) => reject(new Error(`Kết nối đến OmniVoice Colab API thất bại: ${e.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Yêu cầu đến Colab API quá thời gian chờ (Timeout)'));
      });

      req.write(requestBody);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = {
  synthesizeOmniVoice
};
