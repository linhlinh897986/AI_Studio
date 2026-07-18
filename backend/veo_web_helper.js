const { BrowserWindow, app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

// Helper to parse Netscape cookie file content
function parseCookies(text) {
  const cookies = [];
  if (!text) return cookies;
  
  const lines = text.split('\n');
  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine || cleanLine.startsWith('#')) continue;
    const parts = cleanLine.split('\t');
    if (parts.length >= 7) {
      cookies.push({
        domain: parts[0],
        path: parts[2],
        secure: parts[3] === 'TRUE',
        httpOnly: parts[3] === 'TRUE',
        expirationDate: parseInt(parts[4]),
        name: parts[5],
        value: parts[6].trim()
      });
    }
  }
  return cookies;
}

// Download file helper
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };
    const request = https.get(options, (response) => {
      if (response.statusCode !== 200 && response.statusCode !== 206) {
        reject(new Error(`Download failed: status ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    });
    request.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
    file.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
  });
}

/**
 * Automate video or image generation via Google Labs Flow
 * @param {string} cookieText Netscape cookies content
 * @param {object} options prompt, type, aspect, count, model, showBrowser
 * @param {function} onLog callback log(message, type)
 * @returns {Promise<object>} success, filePath/localPaths
 */
async function generateVeoWebVideo(cookieText, options, onLog = () => {}) {
  let win = null;
  const tempDir = path.join(app.getPath('userData'), 'ViGenAIO_Temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const { prompt, type, aspect, count, model, showBrowser } = options;
  const isVideo = type === 'video';

  onLog('Khởi tạo trình duyệt ngầm...', 'info');

  try {
    win = new BrowserWindow({
      width: 1400,
      height: 900,
      show: !!showBrowser,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const ses = win.webContents.session;

    // Clear old Google Labs cookies
    onLog('Đang làm sạch cookie phiên cũ...', 'info');
    try {
      const allCookies = await ses.cookies.get({ url: 'https://labs.google' });
      for (const c of allCookies) {
        await ses.cookies.remove('https://labs.google', c.name);
      }
    } catch (clearErr) {
      console.warn('Cookie clear warning:', clearErr.message);
    }

    // Inject User Cookies
    onLog('Đang nạp cookie Google Labs...', 'info');
    const cookies = parseCookies(cookieText);
    if (cookies.length === 0) {
      throw new Error('Định dạng cookie không hợp lệ. Vui lòng cung cấp Cookie dạng Netscape.');
    }

    for (const c of cookies) {
      const cookieOptions = {
        url: 'https://labs.google',
        name: c.name,
        value: c.value,
        path: c.path || '/',
        secure: true
      };

      // __Host- cookies must NOT have a domain property in Electron
      if (!c.name.startsWith('__Host-')) {
        let domain = c.domain;
        if (!domain.startsWith('.')) domain = '.' + domain;
        cookieOptions.domain = domain;
      }

      try {
        await ses.cookies.set(cookieOptions);
      } catch (cookieErr) {
        console.warn(`Skip cookie ${c.name}:`, cookieErr.message);
      }
    }

    let capturedUrl = null;
    let captureType = isVideo ? 'video' : 'image';

    // Load Flow
    onLog('Đang mở trang Google Flow...', 'info');
    await win.loadURL('https://labs.google/fx/tools/flow');

    // Wait for initial load
    onLog('Đang chờ giao diện trang tải xong (10s)...', 'info');
    await new Promise(r => setTimeout(r, 10000));

    // Dismiss overlays loop
    await win.webContents.executeJavaScript(`
      (() => {
        // Dismiss changelog iframe
        const iframes = document.querySelectorAll('iframe[src*="changelog"]');
        iframes.forEach(f => f.remove());
        
        // Click Got It, Close or Accept buttons
        const closeBtns = Array.from(document.querySelectorAll('button, [role="button"]')).filter(b => {
          const label = (b.getAttribute('aria-label') || '').toLowerCase();
          const text = b.textContent.toLowerCase();
          return label.includes('close') || label.includes('dismiss') || text.includes('close') || text.includes('got it') || text.includes('agree');
        });
        closeBtns.forEach(btn => {
          try { btn.click(); } catch(e) {}
        });
      })()
    `);

    // Click "Dự án mới" (New Project)
    onLog('Đang khởi tạo dự án mới...', 'info');
    const createdProject = await win.webContents.executeJavaScript(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent.includes('Dự án mới'));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      })()
    `);

    if (!createdProject) {
      throw new Error('Không thể bấm nút "Dự án mới". Vui lòng kiểm tra cookie hoặc trạng thái đăng nhập.');
    }

    onLog('Đang chờ giao diện workspace khởi tạo (12s)...', 'info');
    await new Promise(r => setTimeout(r, 12000));

    // Dismiss workspace overlays
    await win.webContents.executeJavaScript(`
      (() => {
        const closeBtns = Array.from(document.querySelectorAll('button, [role="button"]')).filter(b => {
          const label = (b.getAttribute('aria-label') || '').toLowerCase();
          const text = b.textContent.toLowerCase();
          return label.includes('close') || label.includes('dismiss') || text.includes('close') || text.includes('got it');
        });
        closeBtns.forEach(btn => {
          try { btn.click(); } catch(e) {}
        });
      })()
    `);

    // Configure Generation Settings
    onLog(`Đang thiết lập thông số: Tỷ lệ ${aspect}, Số lượng ${count}, Mô hình ${model || 'mặc định'}...`, 'info');
    const settingsApplied = await win.webContents.executeJavaScript(`
      (async () => {
        const saveBtnAlreadyExists = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Lưu'));
        if (!saveBtnAlreadyExists) {
          const buttons = Array.from(document.querySelectorAll('button'));
          const tuneBtn = buttons.find(b => b.textContent.includes('tune'));
          if (!tuneBtn) return { success: false, error: 'Không tìm thấy nút cài đặt để mở bảng thiết lập' };
          tuneBtn.click();
          await new Promise(r => setTimeout(r, 2500));
        } else {
          await new Promise(r => setTimeout(r, 500));
        }

        const triggers = Array.from(document.querySelectorAll('.flow_tab_slider_trigger'));
        const isVideo = ${isVideo};
        const aspect = "${aspect}";
        const count = "${count}";
        const model = "${model}";

        if (!isVideo) {
          // Image Aspect ratio
          const aspectMap = { '16:9': 0, '4:3': 1, '1:1': 2, '3:4': 3, '9:16': 4 };
          const aspectIdx = aspectMap[aspect];
          if (aspectIdx !== undefined && triggers[aspectIdx]) triggers[aspectIdx].click();
          
          // Image Count
          const countMap = { '1x': 5, 'x2': 6, 'x3': 7, 'x4': 8 };
          const countIdx = countMap[count];
          if (countIdx !== undefined && triggers[countIdx]) triggers[countIdx].click();

          // Image Model
          if (model) {
            const dropdown = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Banana'));
            if (dropdown) {
              dropdown.click();
              await new Promise(r => setTimeout(r, 600));
              const options = Array.from(document.querySelectorAll('[role="option"], [role="listbox"] div, button, li'));
              const option = options.find(o => o.textContent.toLowerCase().includes(model.toLowerCase()));
              if (option) option.click();
            }
          }
        } else {
          // Video Aspect ratio
          const aspectMap = { '16:9': 9, '9:16': 10 };
          const aspectIdx = aspectMap[aspect];
          if (aspectIdx !== undefined && triggers[aspectIdx]) triggers[aspectIdx].click();
          
          // Video Count
          const countMap = { '1x': 11, 'x2': 12, 'x3': 13, 'x4': 14 };
          const countIdx = countMap[count];
          if (countIdx !== undefined && triggers[countIdx]) triggers[countIdx].click();

          // Video Model
          if (model) {
            const dropdown = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Omni') || b.textContent.includes('Veo'));
            if (dropdown) {
              dropdown.click();
              await new Promise(r => setTimeout(r, 600));
              const options = Array.from(document.querySelectorAll('[role="option"], [role="listbox"] div, button, li'));
              const option = options.find(o => o.textContent.toLowerCase().includes(model.toLowerCase()));
              if (option) option.click();
            }
          }
        }

        await new Promise(r => setTimeout(r, 1000));
        
        // Save
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Lưu'));
        if (saveBtn) {
          saveBtn.click();
          return { success: true };
        }
        return { success: false, error: 'Không tìm thấy nút Lưu cài đặt' };
      })()
    `);

    if (settingsApplied && !settingsApplied.success) {
      onLog(`Cảnh báo thiết lập: ${settingsApplied.error}. Sử dụng cấu hình mặc định.`, 'warning');
    } else {
      onLog('Đã áp dụng cấu hình cài đặt thành công.', 'success');
      // Dismiss the settings panel by clicking the settings (tune) button again
      await win.webContents.executeJavaScript(`
        (() => {
          const tuneBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('tune'));
          if (tuneBtn) {
            tuneBtn.click();
          } else {
            const backdrop = document.elementFromPoint(100, 450);
            if (backdrop) backdrop.click();
          }
        })()
      `);
      await new Promise(r => setTimeout(r, 1500));
    }

    await new Promise(r => setTimeout(r, 2000));

    // Type prompt
    onLog('Đang điền câu lệnh Prompt...', 'info');
    const focused = await win.webContents.executeJavaScript(`
      (() => {
        const el = document.querySelector('[data-slate-editor="true"]');
        if (el) {
          el.click();
          el.focus();
          return true;
        }
        return false;
      })()
    `);

    if (!focused) {
      throw new Error('Không thể focus vào ô nhập liệu Prompt.');
    }

    // Input prompt characters
    for (const char of prompt) {
      win.webContents.sendInputEvent({ type: 'char', keyCode: char });
      await new Promise(r => setTimeout(r, 15));
    }

    await new Promise(r => setTimeout(r, 1500));

    // Press Enter to submit
    onLog('Bắt đầu nhấn Enter để kích hoạt sinh video/hình ảnh...', 'info');
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
    await new Promise(r => setTimeout(r, 50));
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });

    // Intercept network requests ONLY AFTER generation is submitted
    onLog('Đang kích hoạt bộ chặn request mạng...', 'info');
    const responseStartedListener = (details) => {
      const url = details.url;
      const contentType = (details.responseHeaders?.['content-type'] || details.responseHeaders?.['Content-Type'] || [''])[0];

      if (url.includes('flow-content.google/') || url.includes('/media.getMediaUrlRedirect')) {
        if (isVideo && (contentType.includes('video') || url.includes('/video/'))) {
          if (!capturedUrl) {
            capturedUrl = url;
            onLog(`Đã bắt được tệp video: ${url.substring(0, 80)}...`, 'success');
          }
        } else if (!isVideo && (contentType.includes('image') || url.includes('/image/'))) {
          if (!capturedUrl) {
            capturedUrl = url;
            onLog(`Đã bắt được tệp ảnh: ${url.substring(0, 80)}...`, 'success');
          }
        }
      }
    };
    ses.webRequest.onResponseStarted(responseStartedListener);

    // Wait for capturedUrl
    onLog('Đang sinh media ngầm. Chờ bộ chặn request nhận URL (Tối đa 180 giây)...', 'info');
    let elapsed = 0;
    const timeout = 180; // 180 seconds maximum
    while (!capturedUrl && elapsed < timeout) {
      await new Promise(r => setTimeout(r, 2000));
      elapsed += 2;
      if (elapsed % 10 === 0) {
        onLog(`Đang tạo media ngầm... (${elapsed}s passed)`, 'info');
      }
      if (elapsed % 30 === 0) {
        try {
          const debugImg = await win.webContents.capturePage();
          const debugImgPath = path.join(tempDir, `veo_debug_${elapsed}s.png`);
          fs.writeFileSync(debugImgPath, debugImg.toPNG());
          onLog(`[Debug Screenshot] Saved image at ${elapsed}s to: ${debugImgPath}`, 'info');
        } catch (screenshotErr) {
          console.warn('Debug screenshot failed:', screenshotErr.message);
        }
      }
    }

    if (!capturedUrl) {
      throw new Error('Hết thời gian chờ (180 giây) nhưng không bắt được URL tệp tin. Vui lòng kiểm tra lại cookie hoặc prompt.');
    }

    // Download the captured file
    onLog('Đã nhận được URL tệp tin. Đang tải tệp tin về máy...', 'info');
    const ext = isVideo ? '.mp4' : '.jpg';
    const outputFilename = `veo_web_render_${Date.now()}${ext}`;
    const outputPath = path.join(tempDir, outputFilename);

    await downloadFile(capturedUrl, outputPath);
    onLog('Tải tệp tin kết quả thành công!', 'success');

    // Clean up
    ses.webRequest.onResponseStarted(null);
    win.destroy();

    return { 
      success: true, 
      filePath: `file://${outputPath.replace(/\\/g, '/')}`,
      type: captureType 
    };

  } catch (err) {
    onLog(`Lỗi tiến trình: ${err.message}`, 'error');
    if (win) {
      try {
        win.destroy();
      } catch (e) {}
    }
    return { success: false, error: err.message };
  }
}

module.exports = {
  generateVeoWebVideo
};
