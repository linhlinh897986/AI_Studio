const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { synthesizeSpeech } = require('./edge_tts_helper');
const { fetchShopeeProduct } = require('./shopee_helper');
const { generateJsonScript } = require('./gemini_helper');
const { transcribeCapCut, segmentsToSrt } = require('./capcut_asr');

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
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

app.whenReady().then(() => {
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
ipcMain.handle('gemini-generate', async (event, { apiKey, systemPrompt, userPrompt, geminiModel }) => {
  try {
    const modelName = geminiModel || "gemini-2.0-flash";
    const result = await generateJsonScript(apiKey, systemPrompt, userPrompt, modelName);
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

// 6.5. PDF Downloading & Extraction
ipcMain.handle('buddhist-parse-pdf', async (event, { filePath, fileUrl }) => {
  try {
    const pdfParse = require('pdf-parse');
    let buffer;
    if (fileUrl) {
      const axios = require('axios');
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      buffer = Buffer.from(response.data);
    } else if (filePath) {
      const cleanPath = filePath.startsWith('file://') ? filePath.substring(7) : filePath;
      buffer = fs.readFileSync(cleanPath);
    } else {
      throw new Error('Không có tệp PDF nào được cung cấp.');
    }

    const data = await pdfParse(buffer);
    return {
      success: true,
      text: data.text,
      numpages: data.numpages,
      info: data.info
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

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
      bundleLocation,
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

