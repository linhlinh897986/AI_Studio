const fs = require('fs');
const path = require('path');
const { spawnSync, execSync } = require('child_process');

const tempDir = path.join(__dirname, 'dist-build');
const srcDir = __dirname;

(async () => {
  // Load environment variables from .env file if it exists
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        let value = trimmed.substring(index + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
  }

  // 0. Build Vite frontend bundle
  console.log('⚡ Đang biên dịch frontend Vite (npx vite build)...');
  try {
    execSync('npx vite build', { stdio: 'inherit', cwd: __dirname });
    console.log('✅ Đã tạo thư mục dist (Vite build success).');
  } catch (err) {
    console.error('❌ Lỗi biên dịch Vite frontend:', err.message);
    process.exit(1);
  }


  // Convert PNG to ICO for Windows installer
  const pngToIco = require('png-to-ico').default;
  const { Jimp } = require('jimp');
  const pngPath = path.join(__dirname, 'build', 'icon.png');
  const icoPath = path.join(__dirname, 'build', 'icon.ico');
  
  if (fs.existsSync(pngPath)) {
    console.log('🖼️ Đang định dạng lại icon và chuyển đổi sang build/icon.ico...');
    try {
      const image = await Jimp.read(pngPath);
      const tempPngPath = path.join(__dirname, 'build', 'temp_icon_clean.png');
      await image.resize({ w: 512, h: 512 }).write(tempPngPath);
      
      const buf = await pngToIco(tempPngPath);
      fs.writeFileSync(icoPath, buf);
      
      if (fs.existsSync(tempPngPath)) {
        fs.unlinkSync(tempPngPath);
      }
      
      console.log('✅ Đã tạo thành công build/icon.ico với logo mới.');
    } catch (err) {
      console.error('❌ Lỗi khi chuyển đổi icon sang .ico:', err.message);
    }
  }

  // 1. Clean old temp build folder
  console.log('🧹 Đang quét dọn dẹp thư mục tạm dist-build cũ...');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  // 2. Copy source code to dist-build
  console.log('📂 Sao chép mã nguồn sang dist-build...');
  const excludePatterns = [
    /[\\/]node_modules([\\/]|$)/,
    /[\\/]\.venv([\\/]|$)/,
    /[\\/]dist-build([\\/]|$)/,
    /[\\/]\.git([\\/]|$)/,
    /[\\/]\.agents([\\/]|$)/,
    /[\\/]\.gemini([\\/]|$)/,
    /[\\/]scratch([\\/]|$)/,
    /[\\/]build\.js$/
  ];

  function filterCopy(srcPath) {
    for (const pattern of excludePatterns) {
      if (pattern.test(srcPath)) {
        return false;
      }
    }
    return true;
  }

  function copyFolderSync(from, to) {
    if (!fs.existsSync(from)) return;
    const stat = fs.statSync(from);
    if (stat.isDirectory()) {
      if (!fs.existsSync(to)) {
        fs.mkdirSync(to, { recursive: true });
      }
      const files = fs.readdirSync(from);
      for (const file of files) {
        const fromPath = path.join(from, file);
        const toPath = path.join(to, file);
        if (filterCopy(fromPath)) {
          copyFolderSync(fromPath, toPath);
        }
      }
    } else {
      fs.copyFileSync(from, to);
    }
  }

  copyFolderSync(srcDir, tempDir);
  console.log('✅ Đã sao chép mã nguồn.');

  // Clean package.json in temp folder
  const tempPkgPath = path.join(tempDir, 'package.json');
  if (fs.existsSync(tempPkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(tempPkgPath, 'utf8'));
      delete pkg.build;
      fs.writeFileSync(tempPkgPath, JSON.stringify(pkg, null, 2), 'utf8');
      console.log('✅ Đã chuẩn hóa package.json cho thư mục build tạm thời (loại bỏ trường build).');
    } catch (err) {
      console.error('❌ Lỗi khi dọn dẹp package.json trong thư mục tạm:', err.message);
      process.exit(1);
    }
  }

  // 3. Obfuscate JavaScript files
  console.log('🔒 Đang làm rối mã nguồn JavaScript...');
  const JavaScriptObfuscator = require('javascript-obfuscator');

  function obfuscateDir(dir) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        if (file !== 'node_modules' && file !== 'src') {
          obfuscateDir(filePath);
        }
      } else if (file.endsWith('.js')) {
        const relative = path.relative(tempDir, filePath);
        if (relative === 'compile-in-electron.js') {
          continue;
        }
        
        const code = fs.readFileSync(filePath, 'utf8');
        try {
          const result = JavaScriptObfuscator.obfuscate(code, {
            compact: true,
            controlFlowFlattening: false,
            deadCodeInjection: false,
            stringArray: true,
            stringArrayThreshold: 0.8,
            transformObjectKeys: true,
            unicodeEscapeSequence: false
          });
          fs.writeFileSync(filePath, result.getObfuscatedCode(), 'utf8');
          console.log(`   [Obfuscated]: ${relative}`);
        } catch (err) {
          console.error(`❌ Lỗi khi làm rối file ${relative}:`, err.message);
          process.exit(1);
        }
      }
    }
  }


  obfuscateDir(tempDir);
  console.log('✅ Đã làm rối mã nguồn JavaScript.');

  // 4. Create bytecode compilation script using Electron
  console.log('🛠️ Tạo script biên dịch bytecode...');
  const compileScriptPath = path.join(tempDir, 'compile-in-electron.js');
  const compileScriptContent = `
const bytenode = require('bytenode');
const fs = require('fs');
const path = require('path');

function getJsFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'src' && file !== 'dist') {
        getJsFiles(filePath, files);
      }
    } else if (file.endsWith('.js')) {
      files.push(filePath);
    }
  }
  return files;
}

const jsFiles = getJsFiles(__dirname);

for (const jsFile of jsFiles) {
  const relPath = path.relative(__dirname, jsFile);
  
  if (relPath === 'compile-in-electron.js') {
    console.log(\`   [Bỏ qua Bytecode]: \${relPath}\`);
    continue;
  }
  
  const jscFile = jsFile.slice(0, -3) + '.jsc';
  console.log(\`   [Compiled Bytecode]: \${relPath} -> \${relPath.slice(0, -3)}.jsc\`);
  
  try {
    bytenode.compileFile({
      filename: jsFile,
      output: jscFile
    });
    const jscName = path.basename(jscFile);
    const fileLoaderContent = \`const bytenode = require('bytenode');\\nmodule.exports = require('./\${jscName}');\\n\`;
    fs.writeFileSync(jsFile, fileLoaderContent, 'utf8');
  } catch (err) {
    console.error(\`❌ Lỗi biên dịch bytecode file \${relPath}:\`, err.message);
    process.exit(1);
  }
}

const loaderContent = \`
const bytenode = require('bytenode');
require('./main.jsc');
\`;
fs.writeFileSync(path.join(__dirname, 'main.js'), loaderContent.trim() + '\\n');

console.log('✅ Đã biên dịch bytecode thành công!');
process.exit(0);
`;

  fs.writeFileSync(compileScriptPath, compileScriptContent.trim() + '\n', 'utf8');

  // 5. Run Electron for V8 bytecode compilation
  console.log('⚙️ Khởi chạy Electron để biên dịch sang V8 Bytecode...');
  const electronPath = require('electron');
  const runCompile = spawnSync(electronPath, [compileScriptPath], { stdio: 'inherit' });

  if (runCompile.status !== 0) {
    console.error('❌ Lỗi chạy script biên dịch bytecode bằng Electron.');
    process.exit(1);
  }

  if (fs.existsSync(compileScriptPath)) {
    fs.unlinkSync(compileScriptPath);
  }

  console.log('✅ Hoàn tất bảo mật và biên dịch mã nguồn!');

  const args = process.argv.slice(2);
  if (args.includes('--compile-only')) {
    console.log('ℹ️ Tham số --compile-only được phát hiện. Bỏ qua bước đóng gói với electron-builder.');
    process.exit(0);
  }

  // 6. Package application with electron-builder
  console.log('📦 Đang đóng gói ứng dụng bằng electron-builder...');
  const builder = require('electron-builder');

  const rootPkgPath = path.join(__dirname, 'package.json');
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  const buildConfig = rootPkg.build || {};

  builder.build({
    config: buildConfig,
    publish: 'never'
  }).then(async (result) => {
    console.log('\n🎉 ĐÓNG GÓI ỨNG DỤNG THÀNH CÔNG!');
    console.log('📂 Bộ cài đặt nằm tại thư mục "dist/":');
    result.forEach(f => console.log(`   - ${f}`));

    // Automated upload & release publish to GitHub
    const token = process.env.GH_TOKEN;
    if (token) {
      const pkgVersion = rootPkg.version;
      const owner = buildConfig.win?.publish?.[0]?.owner || 'linhlinh897986';
      const repo = buildConfig.win?.publish?.[0]?.repo || 'AI_Studio-Releases';
      
      console.log(`\n🚀 Bắt đầu tự động tải lên và phát hành v${pkgVersion} lên GitHub repo ${owner}/${repo}...`);
      try {
        const axios = require('axios');
        const url = `https://api.github.com/repos/${owner}/${repo}/releases`;
        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'vigen-github-publisher'
        };

        // Delete existing draft/release tag if present
        try {
          const checkRes = await axios.get(`${url}/tags/v${pkgVersion}`, { headers });
          if (checkRes.data && checkRes.data.id) {
            console.log(`🗑️ Đang xóa bản phát hành cũ v${pkgVersion} trên GitHub (ID: ${checkRes.data.id})...`);
            await axios.delete(`${url}/${checkRes.data.id}`, { headers });
          }
        } catch (e) {}

        try {
          await axios.delete(`https://api.github.com/repos/${owner}/${repo}/git/refs/tags/v${pkgVersion}`, { headers });
          console.log(`🗑️ Đang xóa tag v${pkgVersion} cũ trên GitHub...`);
        } catch (e) {}

        // Create new draft release
        console.log(`🆕 Đang tạo bản nháp phát hành v${pkgVersion}...`);
        const createRes = await axios.post(url, {
          tag_name: `v${pkgVersion}`,
          name: `ViGen AIO Studio Setup ${pkgVersion}`,
          body: `Bản phát hành chính thức ViGen AIO Studio v${pkgVersion}\n\nFeatures:\n- AI Video Generation & Studio tools\n- Integrated Auto-Update support\n- High performance discrete GPU acceleration`,
          draft: true
        }, { headers });

        const releaseId = createRes.data.id;
        const uploadUrlTemplate = createRes.data.upload_url;
        const uploadBaseUrl = uploadUrlTemplate.split('{')[0];

        const exeName = `ViGen AIO Studio Setup ${pkgVersion}.exe`;
        const filesToUpload = [
          { 
            local: path.join(__dirname, 'dist', exeName), 
            remote: exeName, 
            contentType: 'application/x-msdownload' 
          },
          { 
            local: path.join(__dirname, 'dist', `${exeName}.blockmap`), 
            remote: `${exeName}.blockmap`, 
            contentType: 'application/octet-stream' 
          },
          { 
            local: path.join(__dirname, 'dist', 'latest.yml'), 
            remote: 'latest.yml', 
            contentType: 'text/yaml' 
          }
        ];

        for (const file of filesToUpload) {
          if (fs.existsSync(file.local)) {
            const fileSizeMB = (fs.statSync(file.local).size / (1024 * 1024)).toFixed(2);
            console.log(`📤 Đang tải lên ${file.remote} (${fileSizeMB} MB)...`);
            const fileData = fs.readFileSync(file.local);
            await axios.post(`${uploadBaseUrl}?name=${encodeURIComponent(file.remote)}`, fileData, {
              headers: {
                ...headers,
                'Content-Type': file.contentType
              },
              maxContentLength: Infinity,
              maxBodyLength: Infinity
            });
            console.log(`   ✅ Tải lên thành công: ${file.remote}`);
          } else {
            console.warn(`   ⚠️ Không tìm thấy tệp nguồn để tải lên: ${file.local}`);
          }
        }

        // Publish release
        console.log(`🚀 Đang chính thức công bố bản phát hành v${pkgVersion} trên GitHub...`);
        await axios.patch(`${url}/${releaseId}`, { draft: false }, { headers });
        console.log(`🎉 PHÁT HÀNH THÀNH CÔNG PHIÊN BẢN v${pkgVersion} LÊN GITHUB (${owner}/${repo})!`);

      } catch (err) {
        const errMsg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
        console.error(`❌ Lỗi trong quá trình upload và phát hành:`, errMsg);
      }
    } else {
      console.log('ℹ️ Không tìm thấy GH_TOKEN trong môi trường hoặc .env. Bỏ qua bước upload GitHub Releases.');
    }
  }).catch((err) => {
    console.error('\n❌ Đóng gói ứng dụng thất bại:', err);
    process.exit(1);
  });
})();
