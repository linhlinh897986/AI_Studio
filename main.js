const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { synthesizeSpeech } = require('./backend/edge_tts_helper');
const { fetchShopeeProduct } = require('./backend/shopee_helper');
const { generateJsonScript } = require('./backend/gemini_helper');
const { transcribeCapCut, segmentsToSrt } = require('./backend/capcut_asr');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "ViGen AIO - Studio Sản Xuất Video AI",
    backgroundColor: "#07050f",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // simpler for local development in electron
      webSecurity: false // allow loading local files (images, audio) in React player
    }
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    const loadURLWithRetry = (url) => {
      mainWindow.loadURL(url).catch((err) => {
        console.log("Vite server is not ready yet, retrying in 1s...");
        setTimeout(() => loadURLWithRetry(url), 1000);
      });
    };
    loadURLWithRetry('http://localhost:5173');
    
    // Toggle DevTools with F12 or Ctrl+Shift+I to speed up window startup
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      }
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Ensure resources/music directory exists
  const musicDir = path.join(__dirname, 'resources', 'music');
  if (!fs.existsSync(musicDir)) {
    fs.mkdirSync(musicDir, { recursive: true });
  }

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Create temp directory for storing downloaded images, synthesized audio, and renders
const getTempDir = () => {
  const dir = path.join(app.getPath('userData'), 'ViGenAIO_Temp');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// ── IPC Handlers ────────────────────────────────────────────────────────────

// 1. Save and Verify Settings (API Keys)
ipcMain.handle('settings-verify', async (event, { geminiApiKey, geminiModel }) => {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const modelName = geminiModel || "gemini-2.0-flash";
    const model = genAI.getGenerativeModel({ model: modelName });
    await model.generateContent("test");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 2. Shopee Details Fetching
ipcMain.handle('shopee-fetch', async (event, { shopeeLink }) => {
  try {
    const product = await fetchShopeeProduct(shopeeLink);
    return { success: true, product };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 3. Gemini Prompt Generation
ipcMain.handle('gemini-generate', async (event, { apiKey, systemPrompt, userPrompt, geminiModel, pdfFilePath }) => {
  try {
    const modelName = geminiModel || "gemini-2.0-flash";
    let resolvedPath = pdfFilePath;
    if (pdfFilePath && !path.isAbsolute(pdfFilePath)) {
      resolvedPath = path.join(__dirname, 'resources', 'scriptures', pdfFilePath);
    }
    const result = await generateJsonScript(apiKey, systemPrompt, userPrompt, modelName, resolvedPath);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 4. Microsoft Edge TTS Synthesis
ipcMain.handle('edge-tts-synthesize', async (event, { text, options }) => {
  try {
    const tempDir = getTempDir();
    const filename = `speech_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp3`;
    const outputPath = path.join(tempDir, filename);
    
    await synthesizeSpeech(text, outputPath, options);
    
    // Return the path using file:// protocol so React player can play it locally
    return { success: true, filePath: `file://${outputPath.replace(/\\/g, '/')}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 5. CapCut ASR Audio Transcription
ipcMain.handle('capcut-asr-transcribe', async (event, { audioPath, options }) => {
  try {
    // If the path starts with file://, strip it
    let cleanPath = audioPath;
    if (audioPath.startsWith('file://')) {
      cleanPath = audioPath.substring(7);
      if (process.platform === 'win32' && cleanPath.startsWith('/')) {
        cleanPath = cleanPath.substring(1);
      }
    }

    const segments = await transcribeCapCut(cleanPath, options);
    return { success: true, segments };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 6. Download External Image to Temp Local Path
ipcMain.handle('download-image', async (event, { imageUrl }) => {
  try {
    const tempDir = getTempDir();
    const extension = imageUrl.split('?')[0].split('.').pop() || 'jpg';
    const filename = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.${extension}`;
    const outputPath = path.join(tempDir, filename);

    const response = await axios({
      url: imageUrl,
      method: 'GET',
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    return { success: true, filePath: `file://${outputPath.replace(/\\/g, '/')}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 6.5. PDF Dialog Picker

ipcMain.handle('open-pdf-dialog', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: "Đã hủy chọn file." };
    }

    return { success: true, filePath: result.filePaths[0] };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 7. Video File Selection Dialog
ipcMain.handle('select-video-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'mkv', 'avi', 'mov'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: "Đã hủy chọn file." };
    }

    const videoPath = result.filePaths[0];
    return { success: true, filePath: `file://${videoPath.replace(/\\/g, '/')}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 8. Remotion Video Rendering to Local MP4
ipcMain.handle('remotion-render', async (event, { inputProps, compositionId }) => {
  try {
    const { bundle } = require('@remotion/bundler');
    const { renderMedia, selectComposition } = require('@remotion/renderer');

    const tempDir = getTempDir();
    const outputFilename = `vigen_render_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, outputFilename);

    // Bundle the Remotion entrypoint
    // In our project layout, remotion entrypoint is inside src/remotion/index.js
    const entry = path.join(__dirname, 'src', 'remotion', 'index.js');
    
    // Update loading dialog progress in UI
    mainWindow.webContents.send('render-progress', { stage: 'bundling', percent: 20, message: 'Đang đóng gói mã nguồn Remotion...' });

    const bundleLocation = await bundle({
      entryPoint: entry,
      // webpackConfig parameter or defaults
    });

    mainWindow.webContents.send('render-progress', { stage: 'selecting', percent: 40, message: 'Đang khởi tạo Composition...' });

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps: inputProps,
    });

    mainWindow.webContents.send('render-progress', { stage: 'rendering', percent: 60, message: 'Đang kết xuất khung hình và âm thanh...' });

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: inputProps,
      onProgress: ({ progress }) => {
        mainWindow.webContents.send('render-progress', { 
          stage: 'rendering', 
          percent: Math.floor(60 + (progress * 40)), 
          message: `Đang kết xuất video: ${Math.floor(progress * 100)}%` 
        });
      }
    });

    return { success: true, filePath: `file://${outputPath.replace(/\\/g, '/')}` };
  } catch (err) {
    console.error("Remotion render error:", err);
    return { success: false, error: err.message };
  }
});

// 9. Extract Audio from Video File using FFmpeg
ipcMain.handle('video-extract-audio', async (event, { videoPath }) => {
  try {
    const { exec } = require('child_process');
    const tempDir = getTempDir();
    const outputFilename = `extracted_${Date.now()}.wav`;
    const outputPath = path.join(tempDir, outputFilename);

    let cleanVideoPath = videoPath;
    if (videoPath.startsWith('file://')) {
      cleanVideoPath = videoPath.substring(7);
      if (process.platform === 'win32' && cleanVideoPath.startsWith('/')) {
        cleanVideoPath = cleanVideoPath.substring(1);
      }
    }

    const cmd = `ffmpeg -y -i "${cleanVideoPath}" -vn -ar 16000 -ac 1 -c:a pcm_s16le "${outputPath}"`;
    
    await new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve();
      });
    });

    return { success: true, filePath: outputPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 10. Merge Dubbed Vocals back with Original Video Audio (mixing bg music)
ipcMain.handle('video-dub-merge', async (event, { videoPath, segments }) => {
  try {
    const { exec } = require('child_process');
    const tempDir = getTempDir();
    
    // First, compile all segment audio tracks into a single timeline using FFmpeg adelay/amix
    const voiceoverFilename = `voiceover_combined_${Date.now()}.wav`;
    const voiceoverPath = path.join(tempDir, voiceoverFilename);

    let cleanVideoPath = videoPath;
    if (videoPath.startsWith('file://')) {
      cleanVideoPath = videoPath.substring(7);
      if (process.platform === 'win32' && cleanVideoPath.startsWith('/')) {
        cleanVideoPath = cleanVideoPath.substring(1);
      }
    }

    // Prepare inputs and filter complex arguments
    // We expect segments to have { filePath, start_time }
    const inputsStr = segments.map(seg => {
      let cleanSegPath = seg.filePath;
      if (cleanSegPath.startsWith('file://')) {
        cleanSegPath = cleanSegPath.substring(7);
        if (process.platform === 'win32' && cleanSegPath.startsWith('/')) {
          cleanSegPath = cleanSegPath.substring(1);
        }
      }
      return `-i "${cleanSegPath}"`;
    }).join(' ');

    const delayFilters = segments.map((seg, idx) => {
      const delayMs = Math.floor(seg.start_time);
      return `[${idx}:a]adelay=${delayMs}|${delayMs}[a${idx}]`;
    }).join(';');

    const mixInputs = segments.map((_, idx) => `[a${idx}]`).join('');
    const mixFilter = `${mixInputs}amix=inputs=${segments.length}[voice]`;

    const combineCmd = `ffmpeg -y ${inputsStr} -filter_complex "${delayFilters};${mixFilter}" -map "[voice]" "${voiceoverPath}"`;

    // 1. Run combining command
    await new Promise((resolve, reject) => {
      exec(combineCmd, (error, stdout, stderr) => {
        if (error) reject(new Error("Lỗi ghép thoại lồng tiếng: " + error.message));
        else resolve();
      });
    });

    // 2. Mix combined voiceover with original video audio (reducing original audio to 15%)
    const finalFilename = `dubbed_video_${Date.now()}.mp4`;
    const finalOutputPath = path.join(tempDir, finalFilename);

    const mixVideoCmd = `ffmpeg -y -i "${cleanVideoPath}" -i "${voiceoverPath}" -filter_complex "[0:a]volume=0.15[bg];[1:a]volume=1.0[fg];[bg][fg]amix=inputs=2:duration=first" -c:v copy -c:a aac "${finalOutputPath}"`;

    await new Promise((resolve, reject) => {
      exec(mixVideoCmd, (error, stdout, stderr) => {
        if (error) reject(new Error("Lỗi hòa âm trộn video: " + error.message));
        else resolve();
      });
    });

    return { success: true, filePath: `file://${finalOutputPath.replace(/\\/g, '/')}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
});


// 7. Vibes.ai Image Generation & Download
ipcMain.handle('vibes-generate-image', async (event, { prompt, metaSession }) => {
  try {
    const crypto = require('crypto');
    const axios = require('axios');
    const tempDir = getTempDir();
    const filename = `vibes_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
    const outputPath = path.join(tempDir, filename);

    const headers = {
      'accept': '*/*',
      'accept-language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'content-type': 'application/json',
      'cookie': `cookie_ack=true; meta_session=${metaSession}`,
      'Referer': 'https://vibes.ai/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    // Step 1: Create a temporary project to acquire a valid projectId
    const projectRes = await axios.post('https://vibes.ai/api/projects', { name: 'Chưa đặt tên' }, { headers });
    if (!projectRes.data || !projectRes.data.success || !projectRes.data.project) {
      throw new Error("Không thể tạo dự án tạm thời trên Vibes.ai. Hãy kiểm tra Meta Session Cookie.");
    }
    const projectId = projectRes.data.project.id;

    // Step 2: Register the generation batch
    const batchId = `batch-${crypto.randomUUID()}`;
    const requestId = `www-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const registerPayload = {
      id: batchId,
      type: 'images',
      prompt: prompt,
      timestamp: now,
      content: [
        { id: `${batchId}-content-0`, type: 'images', isLoading: true },
        { id: `${batchId}-content-1`, type: 'images', isLoading: true },
        { id: `${batchId}-content-2`, type: 'images', isLoading: true },
        { id: `${batchId}-content-3`, type: 'images', isLoading: true }
      ],
      isComplete: false,
      config: {
        directGeneration: true,
        promptModel: 'gemini-2.5-flash',
        aspectRatio: '9:16',
        imageModel: 'midjen-base',
        videoModel: 'midjen-short',
        resolution: '480p',
        batchVariation: true
      },
      promptModel: 'gemini-2.5-flash',
      imageModel: 'midjen-base',
      videoModel: 'midjen-short',
      generationStartTime: now,
      isDirectGeneration: true,
      projectId: projectId
    };

    await axios.post('https://vibes.ai/api/generation-batches', registerPayload, { headers });

    // Step 3: Trigger the image generation
    const generatePayload = {
      inputs: [
        { type: 'variation', image_prompt: prompt, original_prompt: prompt, config: registerPayload.config },
        { type: 'variation', image_prompt: prompt, original_prompt: prompt, config: registerPayload.config },
        { type: 'variation', image_prompt: prompt, original_prompt: prompt, config: registerPayload.config },
        { type: 'variation', image_prompt: prompt, original_prompt: prompt, config: registerPayload.config }
      ],
      config: {
        ...registerPayload.config,
        generationType: 't2i'
      },
      batchId: batchId,
      mg_request_id: requestId,
      projectId: projectId
    };

    await axios.post('https://vibes.ai/api/generate/images', generatePayload, { headers });

    // Step 4: Poll for completion
    let imageUrl = null;
    const maxRetries = 20;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const pollRes = await axios.get('https://vibes.ai/api/generation-batches', { headers });
      const batches = pollRes.data?.batches || [];
      const targetBatch = batches.find(b => b.id === batchId);

      if (targetBatch) {
        const allLoaded = targetBatch.content.every(c => !c.isLoading);
        if (allLoaded) {
          imageUrl = targetBatch.content[0].imageUrl;
          break;
        }
      }
    }

    if (!imageUrl) {
      throw new Error("Vượt quá thời gian chờ (Timeout) tạo ảnh trên Vibes.ai.");
    }

    // Step 5: Download the generated image locally
    const response = await axios({
      url: imageUrl,
      method: 'GET',
      responseType: 'stream',
      timeout: 20000
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    return { success: true, filePath: `file://${outputPath.replace(/\\/g, '/')}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-path', async (event, { filePath }) => {
  try {
    const { shell } = require('electron');
    const cleanPath = filePath.replace(/^file:\/\/\/?/, '').replace(/\//g, '\\');
    await shell.openPath(cleanPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('show-item-in-folder', async (event, { filePath }) => {
  try {
    const { shell } = require('electron');
    const cleanPath = filePath.replace(/^file:\/\/\/?/, '').replace(/\//g, '\\');
    shell.showItemInFolder(cleanPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('list-local-music', async () => {
  try {
    const musicDir = path.join(__dirname, 'resources', 'music');
    if (!fs.existsSync(musicDir)) {
      fs.mkdirSync(musicDir, { recursive: true });
    }
    const files = fs.readdirSync(musicDir);
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];
    const musicFiles = files
      .filter(file => audioExtensions.includes(path.extname(file).toLowerCase()))
      .map(file => {
        const fullPath = path.join(musicDir, file);
        return {
          name: file,
          filePath: fullPath,
          fileUrl: `file://${fullPath.replace(/\\/g, '/')}`
        };
      });
    return { success: true, musicFiles, musicDir };
  } catch (err) {
    return { success: false, error: err.message };
  }
});



