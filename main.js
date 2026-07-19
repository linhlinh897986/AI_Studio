const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { autoUpdater } = require('electron-updater');
const { synthesizeSpeech } = require('./backend/edge_tts_helper');
const { fetchShopeeProduct } = require('./backend/shopee_helper');
const { generateJsonScript } = require('./backend/gemini_helper');
const { transcribeCapCut, segmentsToSrt } = require('./backend/capcut_asr');
const { analyzeVideoWithGemini, enhanceScenePrompt, extractLastFrame, concatVideoSegments } = require('./backend/video_clone_helper');


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
    const loadDevServer = () => {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
        console.log('⚡ Đang chờ Vite dev server (localhost:5173) sẵn sàng...');
        setTimeout(loadDevServer, 1000);
      });
    };
    loadDevServer();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }



  // Toggle DevTools with F12 or Ctrl+Shift+I in all modes (development and production) to debug issues
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
}

const ensureAmbientSounds = async () => {
  const ambientDir = path.join(__dirname, 'resources', 'ambient');
  if (!fs.existsSync(ambientDir)) {
    fs.mkdirSync(ambientDir, { recursive: true });
  }

  const filesToDownload = [
    { name: 'bell.wav', url: 'https://raw.githubusercontent.com/nyulachan/nyula/main/Sounds/bell.wav' },
    { name: 'stream.wav', url: 'https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/1-28135-A-11.wav' },
    { name: 'rain.wav', url: 'https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/1-17367-A-10.wav' }
  ];

  for (const item of filesToDownload) {
    const destPath = path.join(ambientDir, item.name);
    if (!fs.existsSync(destPath)) {
      console.log(`Downloading ambient sound: ${item.name}...`);
      try {
        const response = await axios({
          method: 'GET',
          url: item.url,
          responseType: 'stream',
          timeout: 15000
        });
        const writer = fs.createWriteStream(destPath);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        console.log(`Downloaded ${item.name} successfully.`);
      } catch (err) {
        console.error(`Failed to download ${item.name}: ${err.message}`);
      }
    }
  }
};

// Configure AutoUpdater
function setupAutoUpdater() {
  autoUpdater.logger = console;
  autoUpdater.autoDownload = false; // Manual download trigger after user clicks update

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Đang kiểm tra bản cập nhật...');
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', { type: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Phát hiện bản cập nhật mới:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', {
      type: 'available',
      version: info.version,
      releaseDate: info.releaseDate || null,
      releaseNotes: info.releaseNotes || null
    });
  });
  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] Ứng dụng đã là phiên bản mới nhất.');
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', { type: 'not-available' });
  });
  autoUpdater.on('error', (err) => {
    console.error('[Updater Error] Lỗi kiểm tra cập nhật:', err.message);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', { type: 'error', message: err.message });
  });
  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent);
    const speedKB = (progressObj.bytesPerSecond / 1024).toFixed(1);
    console.log(`[Updater] Đang tải: ${percent}% (${speedKB} KB/s)`);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', {
      type: 'downloading',
      percent,
      speedKB,
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Bản cập nhật đã được tải xuống.');
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', {
      type: 'downloaded',
      version: info.version
    });
  });
}

// IPC Handlers for AutoUpdater
ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdatesAndNotify();
    if (result && result.updateInfo) {
      const info = result.updateInfo;
      return {
        success: true,
        updateInfo: {
          version: info.version || null,
          releaseNotes: info.releaseNotes || null,
          releaseDate: info.releaseDate || null,
          releaseName: info.releaseName || null
        }
      };
    }
    return { success: true, updateInfo: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.on('quit-and-install', () => {
  autoUpdater.quitAndInstall();
});

app.whenReady().then(async () => {
  // Ensure resources/music directory exists
  const musicDir = path.join(__dirname, 'resources', 'music');
  if (!fs.existsSync(musicDir)) {
    fs.mkdirSync(musicDir, { recursive: true });
  }

  createWindow();
  setupAutoUpdater();

  // Check for updates automatically 5s after start
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.error('[Updater Error] Lỗi khi chạy kiểm tra cập nhật:', err.message);
    });
  }, 5000);

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

// Automatically clean up redundant temporary files (downloaded images, TTS audio, intermediate ASR/remotion bundles)
const cleanupTempFiles = (keepFilePath = null) => {
  try {
    const tempDir = getTempDir();
    if (!fs.existsSync(tempDir)) return { success: true, deletedCount: 0 };

    const cleanKeepPath = keepFilePath ? keepFilePath.replace(/^file:\/\/\/?/, '').replace(/\//g, '\\') : null;
    const files = fs.readdirSync(tempDir);
    let deletedCount = 0;

    files.forEach((file) => {
      const filePath = path.join(tempDir, file);
      if (cleanKeepPath && filePath.toLowerCase() === cleanKeepPath.toLowerCase()) {
        return; // Preserve final rendered MP4 video file
      }

      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          const lowerName = file.toLowerCase();
          // Delete temporary downloaded images, TTS audio, JSON transcripts, bgmusic, or old temp renders
          const isTempAsset = lowerName.startsWith('bgmusic_') || 
                              lowerName.startsWith('download_') || 
                              lowerName.startsWith('tts_') || 
                              lowerName.startsWith('edge_') || 
                              lowerName.startsWith('asr_') || 
                              lowerName.startsWith('meta_') || 
                              lowerName.startsWith('vibe_') ||
                              lowerName.startsWith('extracted_') ||
                              (lowerName.startsWith('vigen_render_') && filePath !== cleanKeepPath) ||
                              lowerName.endsWith('.tmp') || 
                              (lowerName.endsWith('.json') && lowerName.startsWith('asr_'));

          if (isTempAsset) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        }
      } catch (e) {
        console.warn(`Could not delete temp file ${file}: ${e.message}`);
      }
    });

    console.log(`[Temp Cleanup] Deleted ${deletedCount} redundant temporary files from ${tempDir}`);
    return { success: true, deletedCount };
  } catch (err) {
    console.error(`[Temp Cleanup Error]: ${err.message}`);
    return { success: false, error: err.message };
  }
};

// ── IPC Handlers ────────────────────────────────────────────────────────────

// Cleanup Temp Files Handler
ipcMain.handle('clean-temp-files', async (event, { keepFilePath }) => {
  return cleanupTempFiles(keepFilePath);
});


// 1. Save and Verify Settings (API Keys)
ipcMain.handle('settings-verify', async (event, { geminiApiKey, geminiModel }) => {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const keys = (geminiApiKey || '').split(/[\n,;]+/).map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) return { success: false, error: 'Chưa nhập API Key nào.' };

    const modelName = geminiModel || "gemini-3.1-flash-lite";
    let validCount = 0;
    let lastErr = null;

    for (const k of keys) {
      try {
        const genAI = new GoogleGenerativeAI(k);
        const model = genAI.getGenerativeModel({ model: modelName });
        await model.generateContent("test");
        validCount++;
      } catch (err) {
        lastErr = err;
      }
    }

    if (validCount > 0) {
      return { success: true, verifiedCount: validCount, totalCount: keys.length };
    }
    return { success: false, error: lastErr ? lastErr.message : 'Tất cả API Key đều không hợp lệ.' };
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
    const modelName = geminiModel || "gemini-3.1-flash-lite";
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

// 3b. Video Clone Handlers
ipcMain.handle('video-clone-analyze', async (event, { apiKey, videoPath, customPrompt, geminiModel }) => {
  try {
    const scenes = await analyzeVideoWithGemini(apiKey, videoPath, customPrompt, geminiModel);
    return { success: true, scenes };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('video-clone-enhance-scene', async (event, { apiKey, sceneData, targetGenerator, geminiModel }) => {
  try {
    const enhanced = await enhanceScenePrompt(apiKey, sceneData, targetGenerator, geminiModel);
    return { success: true, enhanced };
  } catch (err) {
    return { success: false, error: err.message };
  }
});


ipcMain.handle('video-clone-extract-frame', async (event, { videoPath, outputPath }) => {
  try {
    const framePath = await extractLastFrame(videoPath, outputPath);
    return { success: true, framePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('video-clone-merge', async (event, { videoPaths, outputPath }) => {
  try {
    const finalPath = await concatVideoSegments(videoPaths, outputPath);
    return { success: true, finalPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 3a. Gemini Multi-Agentic Script Generation
ipcMain.handle('gemini-agentic-generate', async (event, { apiKey, topic, geminiModel, pdfFilePath, duration, style, aspectRatio, videoLayout }) => {
  try {
    const { runMultiAgentPipeline } = require('./backend/script_agent_pipeline');
    
    // Setup log forwarder
    const onProgress = (progressData) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('script-agent-progress', progressData);
      }
    };
    
    let resolvedPath = pdfFilePath;
    if (pdfFilePath && !path.isAbsolute(pdfFilePath)) {
      resolvedPath = path.join(__dirname, 'resources', 'scriptures', pdfFilePath);
    }
    
    const result = await runMultiAgentPipeline({
      apiKey,
      topic,
      geminiModel,
      pdfFilePath: resolvedPath,
      duration,
      style,
      aspectRatio,
      videoLayout,
      onProgress
    });

    
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});


// 3b. Google Labs Flow Video/Image Generation
ipcMain.handle('veo-web-generate-video', async (event, { cookieText, options }) => {
  try {
    const { generateVeoWebVideo } = require('./backend/veo_web_helper');
    
    const onLog = (message, type) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('veo-web-log', { message, type });
      }
    };
    
    const result = await generateVeoWebVideo(cookieText, options, onLog);
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 3c. Export Media File to Custom Location
ipcMain.handle('export-file', async (event, { srcPath, defaultName }) => {
  try {
    const cleanSrcPath = srcPath.replace(/^file:\/\/\/?/, '').replace(/\//g, '\\');
    const ext = path.extname(cleanSrcPath);
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(app.getPath('desktop'), defaultName || `export_${Date.now()}${ext}`),
      filters: [
        { name: ext === '.mp4' ? 'Video MP4' : 'Hình ảnh JPEG', extensions: [ext.replace('.', '')] }
      ]
    });
    if (filePath) {
      fs.copyFileSync(cleanSrcPath, filePath);
      return { success: true, filePath };
    }
    return { success: false, error: 'Cancelled' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 4. Microsoft Edge / VieNeu Local TTS Synthesis
ipcMain.handle('edge-tts-synthesize', async (event, { text, options }) => {
  try {
    const tempDir = getTempDir();
    
    // Check if local VieNeu voice is selected
    if (options && options.voice && options.voice.startsWith('vieneu-local-')) {
      const { synthesizeLocalTts } = require('./backend/vieneu_helper');
      const voiceKey = options.voice.replace('vieneu-local-', '');
      const voiceNameMap = {
        'trucly': 'Trúc Ly',
        'hoainam': 'Hoài Nam',
        'nhamy': 'Nhã My',
        'phuongtrinh': 'Phương Trinh',
        'minhquan': 'Minh Quân'
      };
      
      const localTtsOptions = {
        voice: voiceNameMap[voiceKey] || null,
        refAudioPath: options.refAudioPath || null,
        colabApiUrl: options.colabApiUrl || null
      };
      
      const filename = `speech_${Date.now()}_${Math.floor(Math.random() * 1000)}.wav`;
      const outputPath = path.join(tempDir, filename);
      
      await synthesizeLocalTts(text, outputPath, localTtsOptions);
      return { success: true, filePath: `file://${outputPath.replace(/\\/g, '/')}` };
    }
    
    // Check if OmniVoice voice is selected
    if (options && options.voice === 'omnivoice') {
      const { synthesizeOmniVoice } = require('./backend/omnivoice_helper');
      const filename = `speech_${Date.now()}_${Math.floor(Math.random() * 1000)}.wav`;
      const outputPath = path.join(tempDir, filename);
      
      await synthesizeOmniVoice(text, outputPath, options);
      return { success: true, filePath: `file://${outputPath.replace(/\\/g, '/')}` };
    }
    
    const filename = `speech_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp3`;
    const outputPath = path.join(tempDir, filename);
    
    await synthesizeSpeech(text, outputPath, options);
    
    // Return the path using file:// protocol so React player can play it locally
    return { success: true, filePath: `file://${outputPath.replace(/\\/g, '/')}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 4.5. Audio File Selection Dialog (for Voice Cloning)
ipcMain.handle('select-audio-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Audio Files', extensions: ['wav', 'mp3', 'm4a'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: "Đã hủy chọn file." };
    }

    return { success: true, filePath: result.filePaths[0] };
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

// Helper to convert local files to Base64 data URIs to bypass Chrome security blocks during headless render
const pathToBase64 = (filePathOrUrl) => {
  if (!filePathOrUrl) return '';
  const cleanPath = filePathOrUrl.replace(/^file:\/\/\/?/, '').replace(/\//g, '\\');
  if (!fs.existsSync(cleanPath)) {
    console.warn(`File not found for base64 conversion: ${cleanPath}`);
    return filePathOrUrl;
  }
  const ext = path.extname(cleanPath).toLowerCase();
  let mimeType = 'image/jpeg';
  if (ext === '.png') mimeType = 'image/png';
  else if (ext === '.webp') mimeType = 'image/webp';
  else if (ext === '.gif') mimeType = 'image/gif';
  else if (ext === '.mp3') mimeType = 'audio/mp3';
  else if (ext === '.wav') mimeType = 'audio/wav';
  else if (ext === '.ogg') mimeType = 'audio/ogg';
  else if (ext === '.m4a') mimeType = 'audio/x-m4a';

  const buffer = fs.readFileSync(cleanPath);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

// 8. Remotion Video Rendering to Local MP4
ipcMain.handle('remotion-render', async (event, { inputProps, compositionId }) => {
  try {
    const { bundle } = require('@remotion/bundler');
    const { renderMedia, selectComposition } = require('@remotion/renderer');

    const tempDir = getTempDir();
    const outputFilename = `vigen_render_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, outputFilename);

    // Localize remote audio assets to prevent Puppeteer network playback errors (MediaError)
    const clonedProps = JSON.parse(JSON.stringify(inputProps));
    
    // 1. Download background music if remote HTTPS
    if (clonedProps.bgMusicUrl && clonedProps.bgMusicUrl.startsWith('http')) {
      mainWindow.webContents.send('render-progress', { stage: 'localising', percent: 10, message: 'Đang tải nhạc nền về máy để tối ưu...' });
      const localBgMusicPath = path.join(tempDir, `bgmusic_${Date.now()}.mp3`);
      try {
        const response = await axios({
          method: 'GET',
          url: clonedProps.bgMusicUrl,
          responseType: 'stream',
          timeout: 25000
        });
        const writer = fs.createWriteStream(localBgMusicPath);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        clonedProps.bgMusicUrl = `file://${localBgMusicPath.replace(/\\/g, '/')}`;
      } catch (e) {
        console.warn(`Failed to localise bg music: ${e.message}, falling back to remote URL`);
      }
    }

    // 2. Map Buddhist ambient sounds to pre-downloaded local paths
    if (clonedProps.type === 'buddhist' && clonedProps.shopeeProps && clonedProps.shopeeProps.ambientSfx) {
      const sfx = clonedProps.shopeeProps.ambientSfx;
      const sfxNames = { bell: 'bell.wav', stream: 'stream.wav', rain: 'rain.wav' };
      const ambientUrls = {
        bell: 'https://raw.githubusercontent.com/nyulachan/nyula/main/Sounds/bell.wav',
        stream: 'https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/1-28135-A-11.wav',
        rain: 'https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/1-17367-A-10.wav'
      };

      if (sfxNames[sfx] && ambientUrls[sfx]) {
        const ambientDir = path.join(__dirname, 'resources', 'ambient');
        if (!fs.existsSync(ambientDir)) {
          fs.mkdirSync(ambientDir, { recursive: true });
        }
        const localSfxPath = path.join(ambientDir, sfxNames[sfx]);
        if (!fs.existsSync(localSfxPath)) {
          mainWindow.webContents.send('render-progress', { stage: 'localising', percent: 12, message: 'Đang tải âm thanh hiệu ứng về máy...' });
          try {
            const response = await axios({
              method: 'GET',
              url: ambientUrls[sfx],
              responseType: 'stream',
              timeout: 15000
            });
            const writer = fs.createWriteStream(localSfxPath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
              writer.on('finish', resolve);
              writer.on('error', reject);
            });
          } catch (e) {
            console.error(`Failed to download ambient sound ${sfx}:`, e.message);
          }
        }
        if (fs.existsSync(localSfxPath)) {
          clonedProps.shopeeProps.localAmbientUrl = `file://${localSfxPath.replace(/\\/g, '/')}`;
        }
      }
    }

    // 3. Convert all local assets to Base64 to bypass Puppeteer file:// security blocks
    mainWindow.webContents.send('render-progress', { stage: 'base64', percent: 15, message: 'Đang tối ưu hóa tài nguyên hình ảnh & âm thanh...' });
    if (clonedProps.audioUrl) {
      clonedProps.audioUrl = pathToBase64(clonedProps.audioUrl);
    }
    if (clonedProps.bgMusicUrl) {
      clonedProps.bgMusicUrl = pathToBase64(clonedProps.bgMusicUrl);
    }
    if (clonedProps.shopeeProps && clonedProps.shopeeProps.localAmbientUrl) {
      clonedProps.shopeeProps.localAmbientUrl = pathToBase64(clonedProps.shopeeProps.localAmbientUrl);
    }
    if (Array.isArray(clonedProps.slides)) {
      clonedProps.slides = clonedProps.slides.map(slide => ({
        ...slide,
        imageUrl: slide.imageUrl ? pathToBase64(slide.imageUrl) : ''
      }));
    }

    // Fork the Remotion rendering operation to a separate background child process to avoid blocking the main UI thread.
    const { fork } = require('child_process');
    const workerPath = path.join(__dirname, 'backend', 'render_worker.js');
    const child = fork(workerPath);

    return new Promise((resolve) => {
      child.on('message', (msg) => {
        if (msg.type === 'progress') {
          mainWindow.webContents.send('render-progress', { 
            stage: msg.stage, 
            percent: msg.percent, 
            message: msg.message 
          });
        } else if (msg.type === 'success') {
          child.kill();
          const finalFilePath = msg.filePath;
          // Automatically clean up all temporary images, audio & transcript files, keeping only the final output MP4!
          setTimeout(() => {
            cleanupTempFiles(finalFilePath);
          }, 1000);
          resolve({ success: true, filePath: `file://${finalFilePath.replace(/\\/g, '/')}` });
        } else if (msg.type === 'error') {

          child.kill();
          resolve({ success: false, error: msg.error });
        }
      });

      child.on('error', (err) => {
        child.kill();
        resolve({ success: false, error: err.message });
      });

      child.on('exit', (code) => {
        if (code !== 0) {
          resolve({ success: false, error: `Tiến trình kết xuất Remotion thoát đột ngột với mã ${code}` });
        }
      });

      // Start the render operation in background
      child.send({ clonedProps, compositionId, outputPath });
    });
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

ipcMain.handle('check-vibes-token', async (event, { metaSession }) => {
  try {
    const axios = require('axios');
    const headers = {
      'accept': '*/*',
      'accept-language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'content-type': 'application/json',
      'cookie': `cookie_ack=true; meta_session=${metaSession}`,
      'Referer': 'https://vibes.ai/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    const res = await axios.get("https://vibes.ai/api/auth/me", { headers, timeout: 10000 });
    if (res.status === 200 && res.data && res.data.user) {
      return { success: true, username: res.data.user.username, accountStatus: res.data.user.accountStatus };
    }
    return { success: false, error: 'Không lấy được thông tin người dùng.' };
  } catch (err) {
    let errorMsg = err.message;
    if (err.response && err.response.status === 401) {
      errorMsg = 'Token hết hạn hoặc không hợp lệ (Unauthorized 401).';
    }
    return { success: false, error: errorMsg };
  }
});

// 7. Vibes.ai Image Generation & Download
ipcMain.handle('vibes-generate-image', async (event, { prompt, metaSession }) => {
  try {
    const crypto = require('crypto');
    const axios = require('axios');

    const headers = {
      'accept': '*/*',
      'accept-language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'content-type': 'application/json',
      'cookie': `cookie_ack=true; meta_session=${metaSession}`,
      'Referer': 'https://vibes.ai/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    // Step 1: Create a temporary project to acquire a valid projectId
    let projectRes;
    try {
      projectRes = await axios.post('https://vibes.ai/api/projects', { name: 'Chưa đặt tên' }, { headers });
    } catch (e) {
      if (e.response && (e.response.status === 401 || e.response.status === 403)) {
        throw new Error("Phiên làm việc Vibes.ai hết hạn hoặc không hợp lệ (Unauthorized 401/403). Hãy lấy token meta_session mới.");
      }
      throw e;
    }
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

    try {
      await axios.post('https://vibes.ai/api/generation-batches', registerPayload, { headers });
    } catch (e) {
      if (e.response && (e.response.status === 401 || e.response.status === 403)) {
        throw new Error("Phiên làm việc Vibes.ai hết hạn hoặc không hợp lệ (Unauthorized 401/403). Hãy lấy token meta_session mới.");
      }
      throw e;
    }

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

    try {
      await axios.post('https://vibes.ai/api/generate/images', generatePayload, { headers });
    } catch (e) {
      if (e.response && (e.response.status === 401 || e.response.status === 403)) {
        throw new Error("Phiên làm việc Vibes.ai hết hạn hoặc không hợp lệ (Unauthorized 401/403). Hãy lấy token meta_session mới.");
      }
      console.warn(`[Vibes.ai] Generate POST returned error: ${e.message}. Attempting to poll batch regardless.`);
    }

    // Step 4: Poll for completion
    let imageUrls = [];
    const maxRetries = 25;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      try {
        const pollRes = await axios.get('https://vibes.ai/api/generation-batches', { headers });
        const batches = pollRes.data?.batches || [];
        const targetBatch = batches.find(b => b.id === batchId);

        if (targetBatch) {
          const completedItems = targetBatch.content.filter(c => c.imageUrl);
          if (completedItems.length > 0) {
            imageUrls = completedItems.map(c => c.imageUrl);
            // Break early if we have all 4 or the batch reports completion
            if (completedItems.length === targetBatch.content.length || targetBatch.isComplete) {
              break;
            }
          }
          if (targetBatch.hasError || targetBatch.error) {
            console.warn("[Vibes.ai] Batch status reported error:", targetBatch.error);
            break;
          }
        }
      } catch (pollErr) {
        console.warn(`[Vibes.ai] Polling attempt ${attempt} failed:`, pollErr.message);
        if (pollErr.response && (pollErr.response.status === 401 || pollErr.response.status === 403)) {
          throw new Error("Phiên làm việc Vibes.ai hết hạn hoặc không hợp lệ (Unauthorized 401/403). Hãy lấy token meta_session mới.");
        }
      }
    }

    if (imageUrls.length === 0) {
      throw new Error("Vượt quá thời gian chờ (Timeout) hoặc không lấy được liên kết ảnh từ Vibes.ai.");
    }

    // Step 5: Download all completed images locally to bypass browser Cookie validation
    const tempDir = getTempDir();
    const localPaths = [];
    
    // Concurrently download all generated options
    await Promise.all(imageUrls.map(async (url, idx) => {
      const filename = `vibes_${Date.now()}_${idx}_${Math.floor(Math.random() * 1000)}.jpg`;
      const outputPath = path.join(tempDir, filename);
      
      let absoluteUrl = url;
      if (absoluteUrl.startsWith('/')) {
        absoluteUrl = `https://vibes.ai${absoluteUrl}`;
      }
      
      const response = await axios({
        url: absoluteUrl,
        method: 'GET',
        headers: headers,
        responseType: 'stream',
        timeout: 20000
      });
      
      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Automatically remove Meta AI logo/watermark using Pillow
      try {
        const { execSync } = require('child_process');
        const scriptPath = path.join(__dirname, 'backend', 'image_cleaner.py');
        execSync(`python "${scriptPath}" "${outputPath}"`, { stdio: 'ignore' });
      } catch (cleanErr) {
        console.warn("[Vibes.ai] Logo removal failed:", cleanErr.message);
      }
      
      localPaths.push(`file://${outputPath.replace(/\\/g, '/')}`);
    }));

    return { success: true, localPaths, projectId };
  } catch (err) {
    return { success: false, error: err.message };
  }
});


// Helper to parse Netscape or raw Cookie string
function parseCookies(text) {
  const cookies = [];
  if (!text) return cookies;
  
  if (text.includes('\t')) {
    // Netscape format
    const lines = text.split('\n');
    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine || cleanLine.startsWith('#')) continue;
      const parts = cleanLine.split('\t');
      if (parts.length >= 7) {
        cookies.push({
          domain: parts[0],
          httpOnly: parts[3] === 'TRUE',
          secure: parts[3] === 'TRUE',
          expirationDate: parseInt(parts[4]),
          name: parts[5],
          value: parts[6].trim(),
          path: parts[2]
        });
      }
    }
  } else {
    // Key-value format like: name=value; name2=value2
    const pairs = text.split(';');
    for (const pair of pairs) {
      const parts = pair.split('=');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (name && value) {
          cookies.push({
            domain: '.meta.ai',
            path: '/',
            secure: true,
            httpOnly: false,
            name: name,
            value: value
          });
        }
      }
    }
  }
  return cookies;
}

// 7b. Meta AI Direct Image Generation via Browser Window
ipcMain.handle('meta-direct-generate-image', async (event, { prompt, cookieText }) => {
  let win = null;
  try {
    const fs = require('fs');
    const path = require('path');

    const cookies = parseCookies(cookieText);
    if (cookies.length === 0) {
      throw new Error('Không thể phân tích cookie. Hãy đảm bảo copy đúng định dạng Netscape hoặc chuỗi cookie raw.');
    }

    const tempDir = path.join(app.getPath('userData'), 'temp_images');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const filename = `meta_direct_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
    const outputPath = path.join(tempDir, filename);

    // Headless window - no UI displayed, saves resources
    win = new BrowserWindow({
      width: 1280,
      height: 900,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const ses = win.webContents.session;

    // Clear cookies individually to avoid HttpOnly overwrite errors
    try {
      const allCookies = await ses.cookies.get({ url: 'https://meta.ai' });
      for (const c of allCookies) {
        await ses.cookies.remove('https://meta.ai', c.name);
      }
    } catch (clearErr) {
      console.warn('[Meta AI Direct] Cookie clear warning:', clearErr.message);
    }

    // Set cookies with try/catch per cookie
    for (const c of cookies) {
      let domain = c.domain;
      if (!domain.startsWith('.')) domain = '.' + domain;
      try {
        await ses.cookies.set({
          url: 'https://meta.ai',
          name: c.name,
          value: c.value,
          domain: domain,
          path: c.path || '/',
          secure: true
        });
      } catch (cookieErr) {
        console.warn(`[Meta AI Direct] Skip cookie ${c.name}:`, cookieErr.message);
      }
    }

    // ── Setup webRequest interceptor BEFORE loadURL ──
    let capturedImageUrl = null;
    const seenUrls = new Set();
    let promptSent = false;

    ses.webRequest.onResponseStarted((details) => {
      const url = details.url;
      const type = details.resourceType;
      const contentType = (details.responseHeaders?.['content-type'] || details.responseHeaders?.['Content-Type'] || [''])[0];

      if (!promptSent) {
        seenUrls.add(url);
        return;
      }

      if (
        !capturedImageUrl &&
        (type === 'image' || contentType.includes('image')) &&
        url.includes('scontent') &&
        !url.includes('rsrc.php') &&
        !seenUrls.has(url)
      ) {
        console.log('[Meta AI Direct] Captured image via webRequest:', url.substring(0, 80) + '...');
        capturedImageUrl = url;
      }
    });

    console.log('[Meta AI Direct] Loading meta.ai...');
    await win.loadURL('https://meta.ai/');
    await new Promise(r => setTimeout(r, 8000));
    console.log(`[Meta AI Direct] Pre-existing URLs recorded: ${seenUrls.size}`);

    console.log('[Meta AI Direct] Submitting prompt:', prompt);

    // Đợi input element xuất hiện
    const inputFound = await win.webContents.executeJavaScript(`
      (async () => {
        for (let i = 0; i < 15; i++) {
          const el = document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea');
          if (el) { el.focus(); return true; }
          await new Promise(r => setTimeout(r, 500));
        }
        return false;
      })()
    `);
    if (!inputFound) throw new Error('Input element not found');

    // Gõ text bằng sendInputEvent - bypass OS focus, hoạt động headless
    for (const char of prompt) {
      win.webContents.sendInputEvent({ type: 'char', keyCode: char });
      await new Promise(r => setTimeout(r, 8));
    }
    await new Promise(r => setTimeout(r, 1500));

    // Tìm và click nút Send
    const result = await win.webContents.executeJavaScript(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        let sendBtn = buttons.find(btn => btn.getAttribute('aria-label')?.toLowerCase().includes('send'));
        if (!sendBtn) sendBtn = document.querySelector('button[type="submit"]');
        if (!sendBtn) {
          const enabledSvgBtns = buttons.filter(b => !b.disabled && b.querySelector('svg'));
          sendBtn = enabledSvgBtns[enabledSvgBtns.length - 1];
        }
        if (!sendBtn) return { success: false, error: 'Send button not found' };
        if (sendBtn.disabled) return { success: false, error: 'Send button is disabled' };
        sendBtn.click();
        return { success: true };
      })()
    `);

    if (!result || !result.success) {
      throw new Error(result ? result.error : 'Failed to submit prompt');
    }

    // Bắt đầu lắng nghe từ đây
    promptSent = true;
    console.log('[Meta AI Direct] Prompt sent! Waiting for image via request interceptor (max 90s)...');

    // Chờ interceptor bắt được URL ảnh
    let waited = 0;
    while (!capturedImageUrl && waited < 90) {
      await new Promise(r => setTimeout(r, 1000));
      waited++;
    }

    let imageUrl = capturedImageUrl;
    if (!imageUrl) {
      throw new Error('Không tìm thấy ảnh sau 90 giây. Kiểm tra cookie có còn hiệu lực không.');
    }
    console.log('[Meta AI Direct] Image URL captured after', waited, 'seconds.');

    // Download image
    console.log('[Meta AI Direct] Downloading image...');
    const downloadFile = (url, dest) => {
      return new Promise((resolve, reject) => {
        const https = require('https');
        const file = fs.createWriteStream(dest);
        const parsedUrl = new URL(url);
        const options = {
          hostname: parsedUrl.hostname,
          port: 443,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
          }
        };
        const request = https.get(options, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error('Download failed: status ' + response.statusCode));
            return;
          }
          response.pipe(file);
          file.on('finish', () => file.close(resolve));
        });
        request.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
        file.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
      });
    };

    await downloadFile(imageUrl, outputPath);

    // Remove Meta AI logo/watermark
    try {
      const { execSync } = require('child_process');
      const scriptPath = path.join(__dirname, 'backend', 'image_cleaner.py');
      execSync(`python "${scriptPath}" "${outputPath}"`, { stdio: 'ignore' });
    } catch (cleanErr) {
      console.warn('[Meta AI Direct] Logo removal skipped:', cleanErr.message);
    }

    console.log('[Meta AI Direct] Done!');
    return { success: true, localPaths: [`file://${outputPath.replace(/\\/g, '/')}`] };

  } catch (err) {
    console.error('[Meta AI Direct] Error:', err.message);
    return { success: false, error: err.message };
  } finally {
    if (win) win.destroy();
  }
});


ipcMain.handle('vibes-delete-project', async (event, { projectId, metaSession }) => {
  try {
    const axios = require('axios');
    const headers = {
      'accept': '*/*',
      'accept-language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'content-type': 'application/json',
      'cookie': `cookie_ack=true; meta_session=${metaSession}`,
      'Referer': 'https://vibes.ai/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    await axios.delete(`https://vibes.ai/api/projects/${projectId}?deleteAssets=true`, { headers });
    console.log(`[Vibes.ai] Cleaned up temporary project: ${projectId}`);
    return { success: true };
  } catch (err) {
    console.warn(`[Vibes.ai] Cleanup of project ${projectId} failed:`, err.message);
    return { success: false, error: err.message };
  }
});

// 7c. 9Router Image Generation IPC Handlers
ipcMain.handle('ninerouter-fetch-models', async (event, { nineRouterUrl, nineRouterKey }) => {
  try {
    const env = readEnv();
    const baseUrl = (nineRouterUrl || env.nineRouterUrl || process.env.NINEROUTER_URL || 'http://localhost:20128').replace(/\/+$/, '');
    const apiKey = nineRouterKey !== undefined ? nineRouterKey : (env.nineRouterKey || process.env.NINEROUTER_KEY || '');

    const headers = {};
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    const axios = require('axios');
    let res;
    try {
      res = await axios.get(`${baseUrl}/v1/models/image`, { headers, timeout: 10000 });
    } catch (e) {
      res = await axios.get(`${baseUrl}/v1/models`, { headers, timeout: 10000 });
    }

    if (res.data && Array.isArray(res.data.data)) {
      const models = res.data.data.map(m => (typeof m === 'string' ? m : m.id || m.name));
      return { success: true, models };
    } else if (res.data && Array.isArray(res.data)) {
      const models = res.data.map(m => (typeof m === 'string' ? m : m.id || m.name));
      return { success: true, models };
    }
    return { success: true, models: ['ag/gemini-3.1-flash-image', 'openai/dall-e-3', 'flux/schnell'] };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('ninerouter-generate-image', async (event, { prompt, nineRouterUrl, nineRouterKey, nineRouterModel, size, quality, background, image_detail, output_format }) => {
  try {
    const env = readEnv();
    const baseUrl = (nineRouterUrl || env.nineRouterUrl || process.env.NINEROUTER_URL || 'http://localhost:20128').replace(/\/+$/, '');
    const apiKey = nineRouterKey !== undefined ? nineRouterKey : (env.nineRouterKey || process.env.NINEROUTER_KEY || '');
    const model = nineRouterModel || env.nineRouterModel || process.env.NINEROUTER_MODEL || 'ag/gemini-3.1-flash-image';

    const axios = require('axios');
    const fs = require('fs');
    const path = require('path');

    const headers = {
      'Content-Type': 'application/json'
    };
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    const payload = {
      model: model,
      prompt: prompt,
      n: 1,
      size: size || "auto",
      quality: quality || "auto",
      background: background || "auto",
      image_detail: image_detail || "high",
      output_format: output_format || "png"
    };

    console.log(`[9Router Image Gen] Requesting ${baseUrl}/v1/images/generations with model=${model}...`);

    const tempDir = getTempDir();
    const timestamp = Date.now();
    const outputPath = path.join(tempDir, `9router_img_${timestamp}.${output_format || 'png'}`);

    const response = await axios.post(`${baseUrl}/v1/images/generations`, payload, {
      headers,
      responseType: 'arraybuffer',
      timeout: 120000
    });

    const contentType = response.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      const jsonStr = Buffer.from(response.data).toString('utf8');
      const json = JSON.parse(jsonStr);

      if (json.data && json.data.length > 0) {
        const item = json.data[0];
        if (item.url) {
          const imgRes = await axios.get(item.url, { responseType: 'arraybuffer' });
          fs.writeFileSync(outputPath, imgRes.data);
        } else if (item.b64_json) {
          const buf = Buffer.from(item.b64_json, 'base64');
          fs.writeFileSync(outputPath, buf);
        } else {
          throw new Error('9Router API không trả về URL hoặc base64 image data.');
        }
      } else if (json.error) {
        throw new Error(typeof json.error === 'string' ? json.error : json.error.message || 'Lỗi API 9Router');
      } else {
        throw new Error('Định dạng phản hồi JSON từ 9Router không hợp lệ.');
      }
    } else {
      fs.writeFileSync(outputPath, response.data);
    }

    console.log(`[9Router Image Gen] Success! Saved image to: ${outputPath}`);
    const fileUrl = `file://${outputPath.replace(/\\/g, '/')}`;
    return {
      success: true,
      localPaths: [fileUrl],
      localPath: fileUrl
    };

  } catch (err) {
    console.error('[9Router Image Gen] Error:', err.message);
    let errMsg = err.message;
    if (err.response && err.response.data) {
      try {
        const raw = Buffer.isBuffer(err.response.data) ? Buffer.from(err.response.data).toString('utf8') : JSON.stringify(err.response.data);
        const parsed = JSON.parse(raw);
        errMsg = parsed.error ? (typeof parsed.error === 'string' ? parsed.error : parsed.error.message) : raw;
      } catch (e) {
        errMsg = Buffer.isBuffer(err.response.data) ? Buffer.from(err.response.data).toString('utf8') : err.message;
      }
    }
    return { success: false, error: errMsg };
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

ipcMain.handle('save-used-idea', async (event, { title, description, source }) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'used_ideas.md');
    
    // Create file if it doesn't exist
    if (!fs.existsSync(filePath)) {
      const header = `# Danh Sách Ý Tưởng & Chủ Đề Đã Sử Dụng\n\nTệp này tự động lưu các chủ đề và ý tưởng video đã sản xuất để bạn tránh làm nội dung trùng lặp.\n\n| Ngày tạo | Tiêu đề video | Khía cạnh phân tích | Nguồn tài liệu |\n| --- | --- | --- | --- |\n`;
      fs.writeFileSync(filePath, header, 'utf8');
    }
    
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Format values to avoid pipe conflicts in markdown table
    const safeTitle = (title || '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
    const safeDesc = (description || '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
    const safeSource = (source || '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
    
    const newRow = `| ${dateStr} | ${safeTitle} | ${safeDesc} | ${safeSource} |\n`;
    fs.appendFileSync(filePath, newRow, 'utf8');
    
    return { success: true };
  } catch (err) {
    console.error("Failed to save used idea:", err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-used-ideas', async () => {
  try {
    const fs = require('fs');
    const { shell } = require('electron');
    const path = require('path');
    const filePath = path.join(__dirname, 'used_ideas.md');
    if (!fs.existsSync(filePath)) {
      const header = `# Danh Sách Ý Tưởng & Chủ Đề Đã Sử Dụng\n\nTệp này tự động lưu các chủ đề và ý tưởng video đã sản xuất để bạn tránh làm nội dung trùng lặp.\n\n| Ngày tạo | Tiêu đề video | Khía cạnh phân tích | Nguồn tài liệu |\n| --- | --- | --- | --- |\n`;
      fs.writeFileSync(filePath, header, 'utf8');
    }
    await shell.openPath(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('read-used-ideas', async () => {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'used_ideas.md');
    if (!fs.existsSync(filePath)) {
      return { success: true, content: '' };
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 9. Model Management IPC Routes
const modelsManager = require('./backend/local_models_manager');

ipcMain.handle('check-local-models-status', async () => {
  try {
    const vieneu = modelsManager.checkVieNeuStatus();
    const omnivoice = modelsManager.checkOmniVoiceStatus();
    return { success: true, status: { vieneu, omnivoice } };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('install-local-model', async (event, { modelName }) => {
  try {
    await modelsManager.installLocalModel(modelName, (msg) => {
      if (mainWindow) {
        mainWindow.webContents.send('model-install-log', { modelName, msg });
      }
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('uninstall-local-model', async (event, { modelName }) => {
  try {
    await modelsManager.uninstallLocalModel(modelName, (msg) => {
      if (mainWindow) {
        mainWindow.webContents.send('model-install-log', { modelName, msg });
      }
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 10. Load and Save Configuration to .env File
const envPath = path.join(__dirname, '.env');

function readEnv() {
  const settings = {
    geminiApiKey: '',
    geminiModel: '',
    vibesMetaSession: '',
    colabApiUrl: '',
    metaDirectCookie: '',
    labsGoogleCookie: ''
  };
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] ? match[2].trim() : '';
        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        
        // Convert escaped newlines back
        value = value.replace(/\\n/g, '\n');

        if (key === 'GEMINI_API_KEY') settings.geminiApiKey = value;
        else if (key === 'GEMINI_MODEL') settings.geminiModel = value;
        else if (key === 'VIBES_META_SESSION') settings.vibesMetaSession = value;
        else if (key === 'COLAB_API_URL') settings.colabApiUrl = value;
        else if (key === 'META_DIRECT_COOKIE') settings.metaDirectCookie = value;
        else if (key === 'LABS_GOOGLE_COOKIE') settings.labsGoogleCookie = value;
        else if (key === 'NINEROUTER_URL') settings.nineRouterUrl = value;
        else if (key === 'NINEROUTER_KEY') settings.nineRouterKey = value;
        else if (key === 'NINEROUTER_MODEL') settings.nineRouterModel = value;
      }
    }
  }
  return settings;
}

function writeEnv(settings) {
  // Read existing settings first to preserve unsupplied fields
  const existing = readEnv();
  const merged = { ...existing, ...settings };

  let content = '';
  content += `GEMINI_API_KEY="${merged.geminiApiKey || ''}"\n`;
  content += `GEMINI_MODEL="${merged.geminiModel || ''}"\n`;
  content += `VIBES_META_SESSION="${merged.vibesMetaSession || ''}"\n`;
  content += `COLAB_API_URL="${merged.colabApiUrl || ''}"\n`;
  content += `META_DIRECT_COOKIE="${(merged.metaDirectCookie || '').replace(/\r?\n/g, '\\n')}"\n`;
  content += `LABS_GOOGLE_COOKIE="${(merged.labsGoogleCookie || '').replace(/\r?\n/g, '\\n')}"\n`;
  content += `NINEROUTER_URL="${merged.nineRouterUrl || ''}"\n`;
  content += `NINEROUTER_KEY="${merged.nineRouterKey || ''}"\n`;
  content += `NINEROUTER_MODEL="${merged.nineRouterModel || ''}"\n`;
  fs.writeFileSync(envPath, content, 'utf8');
  
  // Set in process.env so backend can reference it directly if needed
  process.env.GEMINI_API_KEY = merged.geminiApiKey || '';
  process.env.GEMINI_MODEL = merged.geminiModel || '';
  process.env.VIBES_META_SESSION = merged.vibesMetaSession || '';
  process.env.COLAB_API_URL = merged.colabApiUrl || '';
  process.env.META_DIRECT_COOKIE = merged.metaDirectCookie || '';
  process.env.LABS_GOOGLE_COOKIE = merged.labsGoogleCookie || '';
  process.env.NINEROUTER_URL = merged.nineRouterUrl || '';
  process.env.NINEROUTER_KEY = merged.nineRouterKey || '';
  process.env.NINEROUTER_MODEL = merged.nineRouterModel || '';
}

ipcMain.handle('load-env-settings', async () => {
  try {
    const data = readEnv();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-env-settings', async (event, settings) => {
  try {
    writeEnv(settings);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('load-lucylab-voices', async () => {
  try {
    const lucylabDir = path.join(__dirname, 'resources', 'ref_audios', 'lucylab');
    const metadataPath = path.join(lucylabDir, 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      return { success: false, error: 'Không tìm thấy tệp metadata.json của LucyLab.' };
    }
    const rawData = fs.readFileSync(metadataPath, 'utf8');
    const voices = JSON.parse(rawData);
    
    const files = fs.readdirSync(lucylabDir);
    
    // Map each voice to its file path
    const mappedVoices = voices.map(voice => {
      // Find the file that starts with the voice ID (e.g., mhsL3CPLxmLYdSTKp3GANz)
      const matchingFile = files.find(file => file.startsWith(voice.id));
      if (matchingFile) {
        const fullPath = path.join(lucylabDir, matchingFile);
        return {
          id: voice.id,
          name: voice.name,
          description: voice.description || '',
          tags: voice.tags || [],
          filePath: fullPath,
          fileUrl: `file://${fullPath.replace(/\\/g, '/')}`,
          transcription: voice.transcribedRefText || ''
        };
      }
      return null;
    }).filter(v => v !== null);
    
    return { success: true, voices: mappedVoices };
  } catch (err) {
    return { success: false, error: err.message };
  }
});





