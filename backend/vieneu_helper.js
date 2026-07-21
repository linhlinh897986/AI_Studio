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
/**
 * Executes Colab Async Polling workflow to eliminate Cloudflare 524 timeouts.
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

  const downloadSingleStream = async (downloadUrl, outputPath, onProgress) => {
    const axios = require('axios');
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      timeout: 120000,
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });

    if (response.status !== 200) {
      throw new Error(`Download error HTTP ${response.status}`);
    }

    const contentLength = parseInt(response.headers['content-length'] || '0', 10);
    const sizeMB = contentLength > 0 ? (contentLength / 1024 / 1024).toFixed(1) : '?';
    console.log(`[VieNeu Colab Single-Thread] File size: ${sizeMB}MB. Downloading...`);
    onProgress(0, `Bắt đầu tải file âm thanh (${sizeMB} MB)...`);

    return new Promise((resolve, reject) => {
      const outStream = fs.createWriteStream(outputPath);
      response.data.pipe(outStream);

      let received = 0;
      let lastReportedPct = -1;
      let stallTimer = setTimeout(() => {
        outStream.destroy();
        reject(new Error('Tải audio bị treo (không nhận dữ liệu trong 3 phút). Kiểm tra kết nối Colab.'));
      }, 180000);

      response.data.on('data', (chunk) => {
        received += chunk.length;
        clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
          outStream.destroy();
          reject(new Error('Tải audio bị treo (không nhận dữ liệu trong 3 phút). Kiểm tra kết nối Colab.'));
        }, 180000);
        if (contentLength > 0) {
          const pct = Math.floor((received / contentLength) * 100);
          process.stdout.write(`\r[VieNeu Colab] Download: ${pct}% (${(received/1024/1024).toFixed(1)}MB / ${sizeMB}MB)`);
          if (pct !== lastReportedPct && pct % 2 === 0) {
            lastReportedPct = pct;
            onProgress(pct, `Đang tải âm thanh từ Colab: ${pct}% (${(received/1024/1024).toFixed(1)}MB / ${sizeMB}MB)`);
          }
        }
      });

      outStream.on('finish', () => {
        clearTimeout(stallTimer);
        console.log(`\n[VieNeu Colab] ✅ Download hoàn tất: ${outputPath}`);
        onProgress(100, `Tải âm thanh thành công!`);
        resolve(outputPath);
      });
      outStream.on('error', (err) => { clearTimeout(stallTimer); reject(err); });
      response.data.on('error', (err) => { clearTimeout(stallTimer); outStream.destroy(); reject(err); });
    });
  };

  const downloadResult = async (taskId) => {
    const axios = require('axios');
    const downloadUrl = `${colabUrl.replace(/\/$/, '')}/download/${taskId}`;
    console.log(`[VieNeu Colab Async] Downloading from: ${downloadUrl}`);

    try {
      const rangeCheckRes = await axios({
        method: 'GET',
        url: downloadUrl,
        headers: { 'ngrok-skip-browser-warning': 'true', 'Range': 'bytes=0-0' },
        timeout: 15000,
        validateStatus: s => s >= 200 && s < 400
      });

      let totalSize = 0;
      if (rangeCheckRes.headers['content-range']) {
        const match = rangeCheckRes.headers['content-range'].match(/\/(\d+)$/);
        if (match) totalSize = parseInt(match[1], 10);
      } else if (rangeCheckRes.headers['content-length']) {
        totalSize = parseInt(rangeCheckRes.headers['content-length'], 10);
      }

      const isRangeSupported = rangeCheckRes.status === 206 || rangeCheckRes.headers['accept-ranges'] === 'bytes';
      const NUM_THREADS = 10;
      const MIN_SIZE_FOR_MULTI_THREAD = 4 * 1024 * 1024;

      if (isRangeSupported && totalSize >= MIN_SIZE_FOR_MULTI_THREAD) {
        const sizeMB = (totalSize / 1024 / 1024).toFixed(1);
        console.log(`[VieNeu Multi-Thread] Dynamic multi-thread download: ${sizeMB}MB (${NUM_THREADS} luồng song song)...`);
        onProgress(0, `Bắt đầu tải đa luồng 10x (${sizeMB} MB)...`);

        const chunkSize = Math.ceil(totalSize / NUM_THREADS);
        const partFiles = [];
        const threadProgress = new Array(NUM_THREADS).fill(0);
        let lastReportedPct = -1;

        const downloadChunk = async (threadIdx) => {
          const start = threadIdx * chunkSize;
          const end = Math.min(start + chunkSize - 1, totalSize - 1);
          const partPath = `${outputPath}.part${threadIdx}`;
          partFiles.push(partPath);

          const res = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'stream',
            headers: {
              'ngrok-skip-browser-warning': 'true',
              'Range': `bytes=${start}-${end}`
            },
            timeout: 180000
          });

          return new Promise((resolvePart, rejectPart) => {
            const outStream = fs.createWriteStream(partPath);
            res.data.pipe(outStream);

            let stallTimer = setTimeout(() => {
              outStream.destroy();
              rejectPart(new Error(`Tải luồng ${threadIdx + 1} bị ngắt (timeout).`));
            }, 180000);

            res.data.on('data', (chunk) => {
              clearTimeout(stallTimer);
              stallTimer = setTimeout(() => {
                outStream.destroy();
                rejectPart(new Error(`Tải luồng ${threadIdx + 1} bị ngắt (timeout).`));
              }, 180000);

              threadProgress[threadIdx] += chunk.length;
              const totalReceived = threadProgress.reduce((a, b) => a + b, 0);
              const pct = Math.floor((totalReceived / totalSize) * 100);
              const recMB = (totalReceived / 1024 / 1024).toFixed(1);

              if (pct !== lastReportedPct && pct % 5 === 0) {
                lastReportedPct = pct;
                console.log(`[VieNeu Multi-Thread] Tiến độ tải 10x: ${pct}% (${recMB}MB / ${sizeMB}MB)`);
                onProgress(pct, `Đang tải đa luồng 10x: ${pct}% (${recMB}MB / ${sizeMB}MB)`);
              }
            });

            outStream.on('finish', () => { clearTimeout(stallTimer); resolvePart(partPath); });
            outStream.on('error', (err) => { clearTimeout(stallTimer); rejectPart(err); });
            res.data.on('error', (err) => { clearTimeout(stallTimer); outStream.destroy(); rejectPart(err); });
          });
        };

        await Promise.all(Array.from({ length: NUM_THREADS }, (_, i) => downloadChunk(i)));

        console.log(`[VieNeu Multi-Thread] Đang ghép 10 phần file...`);
        const finalStream = fs.createWriteStream(outputPath);
        for (let i = 0; i < NUM_THREADS; i++) {
          const pPath = `${outputPath}.part${i}`;
          if (fs.existsSync(pPath)) {
            const buffer = fs.readFileSync(pPath);
            finalStream.write(buffer);
            try { fs.unlinkSync(pPath); } catch (e) {}
          }
        }
        finalStream.end();

        console.log(`[VieNeu Multi-Thread] ✅ Tải đa luồng 10x thành công: ${outputPath}`);
        onProgress(100, `Tải đa luồng 10x thành công (${sizeMB} MB)!`);
        return outputPath;
      }
    } catch (mtErr) {
      console.warn(`[VieNeu Multi-Thread] Thử tải đa luồng thất bại (${mtErr.message}), chuyển về đơn luồng...`);
    }

    return downloadSingleStream(downloadUrl, outputPath, onProgress);
  };


  const downloadFromGoogleDrive = async (driveUrlOrId, outputPath, onProgress) => {
    const axios = require('axios');
    let fileId = driveUrlOrId;
    if (driveUrlOrId.includes('id=')) {
      const match = driveUrlOrId.match(/id=([a-zA-Z0-9_-]+)/);
      if (match) fileId = match[1];
    } else if (driveUrlOrId.includes('/d/')) {
      const match = driveUrlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) fileId = match[1];
    }

    console.log(`[Google Drive Downloader] Bắt đầu tải tệp ID: ${fileId}...`);
    onProgress(0, `Bắt đầu kết nối Google Drive CDN...`);

    const initialUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;

    try {
      const response = await axios({
        method: 'GET',
        url: initialUrl,
        responseType: 'stream',
        timeout: 180000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        console.log(`[Google Drive Downloader] Phát hiện trang xác nhận virus scan, đang tự động vượt qua...`);
        let htmlContent = '';
        response.data.on('data', chunk => htmlContent += chunk.toString());
        await new Promise(r => response.data.on('end', r));

        const confirmMatch = htmlContent.match(/confirm=([a-zA-Z0-9_-]+)/) || htmlContent.match(/uuid=([a-zA-Z0-9_-]+)/);
        const confirmToken = confirmMatch ? confirmMatch[1] : 't';
        const confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmToken}`;

        const retryResponse = await axios({
          method: 'GET',
          url: confirmUrl,
          responseType: 'stream',
          timeout: 180000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        return streamToFile(retryResponse, outputPath, onProgress);
      }

      return streamToFile(response, outputPath, onProgress);
    } catch (gErr) {
      console.warn(`[Google Drive Downloader] Tải từ Drive thất bại (${gErr.message}), chuyển về tải 10-luồng Colab...`);
      return downloadResult(taskId);
    }
  };

  const streamToFile = (response, outputPath, onProgress) => {
    return new Promise((resolve, reject) => {
      const contentLength = parseInt(response.headers['content-length'] || '0', 10);
      const sizeMB = contentLength > 0 ? (contentLength / 1024 / 1024).toFixed(1) : '?';
      console.log(`[Google Drive Stream] Đang tải ${sizeMB}MB từ Google CDN...`);
      onProgress(0, `Đang kết nối tải từ Google Drive CDN (${sizeMB} MB)...`);

      const outStream = fs.createWriteStream(outputPath);
      response.data.pipe(outStream);

      let received = 0;
      let lastReportedPct = -1;
      let stallTimer = setTimeout(() => {
        outStream.destroy();
        reject(new Error('Tải từ Google Drive quá thời gian chờ (Stall Timeout).'));
      }, 180000);

      response.data.on('data', (chunk) => {
        received += chunk.length;
        clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
          outStream.destroy();
          reject(new Error('Tải từ Google Drive quá thời gian chờ (Stall Timeout).'));
        }, 180000);

        if (contentLength > 0) {
          const pct = Math.floor((received / contentLength) * 100);
          if (pct !== lastReportedPct && pct % 5 === 0) {
            lastReportedPct = pct;
            console.log(`[Google Drive Stream] Tiến độ tải: ${pct}% (${(received/1024/1024).toFixed(1)}MB / ${sizeMB}MB)`);
            onProgress(pct, `Đang tải từ Google Drive CDN: ${pct}% (${(received/1024/1024).toFixed(1)}MB / ${sizeMB}MB)`);
          }
        } else {
          const recMB = (received / 1024 / 1024).toFixed(1);
          onProgress(50, `Đang tải từ Google Drive CDN: ${recMB} MB...`);
        }
      });

      outStream.on('finish', () => {
        clearTimeout(stallTimer);
        console.log(`[Google Drive Stream] ✅ Tải Google Drive thành công: ${outputPath}`);
        onProgress(100, `Tải tệp từ Google Drive hoàn tất!`);
        resolve(outputPath);
      });

      outStream.on('error', err => { clearTimeout(stallTimer); reject(err); });
      response.data.on('error', err => { clearTimeout(stallTimer); outStream.destroy(); reject(err); });
    });
  };

  const taskId = await submitTask();
  console.log(`[VieNeu Colab Async] Started task ID: ${taskId}. Polling every 3s...`);

  const startTime = Date.now();
  const maxWaitMs = 30 * 60 * 1000; // 30 mins max

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const statusRes = await pollStatus(taskId);
      if (statusRes.status === 'completed') {
        const fileSize = statusRes.file_size || statusRes.size || 0;
        const fileSizeMB = fileSize > 0 ? (fileSize / 1024 / 1024).toFixed(1) : '?';
        console.log(`[VieNeu Colab Async] Task ${taskId} completed! Tệp âm thành: ${fileSizeMB}MB. Downloading...`);

        const driveTarget = statusRes.drive_file_id || statusRes.drive_url || statusRes.gdrive_url || (statusRes.drive_info && statusRes.drive_info.gdrive_path);
        const MIN_GDRIVE_THRESHOLD_BYTES = 30 * 1024 * 1024; // 30MB
        let downloadedPath = '';

        try {
          if (driveTarget && fileSize > MIN_GDRIVE_THRESHOLD_BYTES) {
            console.log(`[VieNeu Download Decision] Tệp ${fileSizeMB}MB > 30MB. Chuyển sang tải bằng Google Drive CDN...`);
            downloadedPath = await downloadFromGoogleDrive(driveTarget, outputPath, onProgress);
          } else {
            if (driveTarget && fileSize <= MIN_GDRIVE_THRESHOLD_BYTES && fileSize > 0) {
              console.log(`[VieNeu Download Decision] Tệp ${fileSizeMB}MB <= 30MB. Ưu tiên tải trực tiếp bằng 10-luồng Colab...`);
            }
            downloadedPath = await downloadResult(taskId);
          }
        } finally {
          // Auto-cleanup task files on Colab & Google Drive after download
          try {
            const axios = require('axios');
            await axios.get(`${colabUrl.replace(/\/$/, '')}/delete/${taskId}`, { timeout: 10000 }).catch(() => {});
            console.log(`[VieNeu Cleanup] ✅ Đã tự động dọn dẹp tệp trên Colab & Google Drive cho task ${taskId}`);
          } catch (e) {}
        }

        return downloadedPath;
      } else if (statusRes.status === 'error') {
        throw new Error(`Colab task failed: ${statusRes.error || 'Unknown error'}`);
      }
    } catch (pollErr) {
      if (pollErr.message.includes('task failed')) throw pollErr;
      console.warn(`[VieNeu Async Polling Transient Error]: ${pollErr.message}`);
    }
  }

  throw new Error("Colab synthesis task timed out after 30 minutes of polling.");
}

function splitTextIntoSentenceChunks(text, maxChars = 500) {
  if (!text || text.length <= maxChars) return [text];
  const sentences = text.split(/(?<=[.!?;\n])\s+/);
  const chunks = [];
  let current = '';

  for (const s of sentences) {
    if ((current + ' ' + s).length <= maxChars) {
      current = (current + ' ' + s).trim();
    } else {
      if (current) chunks.push(current);
      current = s.trim();
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
}

function concatWavFiles(wavFilePaths, outputPath) {
  if (!wavFilePaths || wavFilePaths.length === 0) throw new Error("No WAV files to concat");
  if (wavFilePaths.length === 1) {
    fs.copyFileSync(wavFilePaths[0], outputPath);
    return outputPath;
  }

  const pcmBuffers = [];
  let header = null;
  let totalDataLength = 0;

  for (const fp of wavFilePaths) {
    if (!fs.existsSync(fp)) continue;
    const fileBuf = fs.readFileSync(fp);
    if (fileBuf.length < 44) continue;
    if (!header) {
      header = Buffer.from(fileBuf.subarray(0, 44));
    }
    const dataChunk = fileBuf.subarray(44);
    pcmBuffers.push(dataChunk);
    totalDataLength += dataChunk.length;
  }

  if (!header || pcmBuffers.length === 0) throw new Error("Lỗi hợp nhất file âm thanh WAV.");

  header.writeUInt32LE(36 + totalDataLength, 4);
  header.writeUInt32LE(totalDataLength, 40);

  const finalBuffer = Buffer.concat([header, ...pcmBuffers]);
  fs.writeFileSync(outputPath, finalBuffer);
  return outputPath;
}

function synthesizeLocalTtsSingleChunk(text, outputPath, options = {}) {
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

        // Try Async Polling first (prevents Cloudflare 524 timeouts)
        try {
          console.log(`[VieNeu Colab] Attempting Async Polling workflow on ${colabUrl}...`);
          const asyncResult = await executeColabAsyncPolling({
            colabUrl,
            requestBody,
            boundary,
            outputPath
          });
          return resolve(asyncResult);
        } catch (asyncErr) {
          console.warn(`[VieNeu Colab] Async polling fallback to direct stream: ${asyncErr.message}`);
          if (asyncErr.message.includes('task failed')) {
            return reject(asyncErr);
          }
        }

        const parsedUrl = new URL(colabUrl);
        const clientModule = parsedUrl.protocol === 'https:' ? https : http;

        // Direct Stream Sync Fallback
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

        req.on('error', (e) => reject(new Error(`Kết nối đến VieNeu Colab API thất bại: ${e.message}`)));
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Yêu cầu đến Colab API quá thời gian chờ (Timeout)'));
        });

        req.write(requestBody);
        req.end();
        return;
      }

      if (!isLocalInstalled) {
        return reject(new Error('Chưa cài đặt mô hình VieNeu-TTS cục bộ hoặc chưa mở Server Colab trong Cài đặt hệ thống.'));
      }

      // Execute Python script for local ONNX Runtime inference
      const { getVenvPythonCommand } = require('./local_models_manager');
      const pyCmd = getVenvPythonCommand();
      const scriptPath = path.join(__dirname, 'python', 'vieneu_local.py');

      const args = [scriptPath, '--text', text, '--output', outputPath];
      if (options.voice) args.push('--voice', options.voice);
      if (options.refAudioPath && fs.existsSync(options.refAudioPath)) {
        args.push('--ref_audio', options.refAudioPath);
      }

      const child = spawn(pyCmd, args);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log(`[VieNeu Local Output]: ${data.toString().trim()}`);
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Quá trình lồng tiếng VieNeu thất bại với mã lỗi ${code}. Chi tiết: ${stderr}`));
        }
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          resolve(outputPath);
        } else {
          reject(new Error("Lồng tiếng VieNeu hoàn tất nhưng không tìm thấy file đầu ra hoặc file bị rỗng."));
        }
      });

      child.on('error', (err) => {
        reject(err);
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
