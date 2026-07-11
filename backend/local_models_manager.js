const fs = require('fs');
const path = require('path');
const { spawn, execSync, exec } = require('child_process');

let pythonCmdCache = null;
let uvCmdCache = null;

function getPythonCommand() {
  if (pythonCmdCache !== null) return pythonCmdCache;
  
  // Try 'py' launcher first
  try {
    execSync('py --version', { stdio: 'ignore' });
    pythonCmdCache = 'py';
    return pythonCmdCache;
  } catch (e) {}
  
  // Try 'python3' next
  try {
    execSync('python3 --version', { stdio: 'ignore' });
    pythonCmdCache = 'python3';
    return pythonCmdCache;
  } catch (e) {}
  
  // Fallback to 'python'
  pythonCmdCache = 'python';
  return pythonCmdCache;
}

function getVenvPythonCommand() {
  // Check if D:\AIO virtual environment exists first (preferred)
  const aioVenv = 'D:\\AIO\\.venv\\Scripts\\python.exe';
  if (fs.existsSync(aioVenv)) {
    return aioVenv;
  }
  
  // Check if local project venv exists
  const localVenv = path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(localVenv)) {
    return localVenv;
  }
  return getPythonCommand();
}

function getUvCommand() {
  if (uvCmdCache !== null) return uvCmdCache;
  
  // 1. Check if uv is installed globally
  try {
    execSync('uv --version', { stdio: 'ignore' });
    uvCmdCache = 'uv';
    return uvCmdCache;
  } catch (e) {}
  
  // 2. Check if portable uv.exe exists in current project scratch directory
  const projectScratch = path.join(__dirname, '..', 'resources', 'bin', 'uv.exe');
  if (fs.existsSync(projectScratch)) {
    uvCmdCache = projectScratch;
    return uvCmdCache;
  }
  
  return null;
}

/**
 * Downloads uv portable package if not present
 */
async function downloadUv(progressCallback) {
  const targetDir = path.join(__dirname, '..', 'resources', 'bin');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const zipPath = path.join(targetDir, 'uv-windows.zip');
  const uvExePath = path.join(targetDir, 'uv.exe');
  
  if (fs.existsSync(uvExePath)) {
    uvCmdCache = uvExePath;
    return uvExePath;
  }
  
  progressCallback('Đang tải công cụ uv portable từ GitHub để khởi tạo môi trường ảo...');
  
  const axios = require('axios');
  const url = 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip';
  
  const response = await axios({
    method: 'get',
    url: url,
    responseType: 'stream'
  });
  
  const writer = fs.createWriteStream(zipPath);
  response.data.pipe(writer);
  
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
  
  progressCallback('Đang tiến hành giải nén bộ cài uv...');
  
  try {
    try {
      execSync(`tar -xf "${zipPath}" -C "${targetDir}"`, { stdio: 'ignore' });
    } catch (tarErr) {
      console.warn("tar command failed, using PowerShell as fallback:", tarErr.message);
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`, { stdio: 'ignore' });
    }
    
    const files = fs.readdirSync(targetDir);
    const extractedFolder = files.find(f => f.startsWith('uv-') && fs.statSync(path.join(targetDir, f)).isDirectory());
    if (extractedFolder) {
      const extractedUvExe = path.join(targetDir, extractedFolder, 'uv.exe');
      if (fs.existsSync(extractedUvExe)) {
        fs.copyFileSync(extractedUvExe, uvExePath);
        fs.rmSync(path.join(targetDir, extractedFolder), { recursive: true, force: true });
      }
    }
    
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    
    progressCallback('Thiết lập uv portable thành công.');
    uvCmdCache = uvExePath;
    return uvExePath;
  } catch (err) {
    throw new Error(`Không thể thiết lập uv: ${err.message}`);
  }
}

/**
 * Ensures Python Virtual Environment exists in current project
 */
async function ensureVenv(progressCallback, uvCmd) {
  // If D:\AIO\.venv is used, we do not need to create local venv
  const aioVenv = 'D:\\AIO\\.venv\\Scripts\\python.exe';
  if (fs.existsSync(aioVenv)) {
    progressCallback('Sử dụng môi trường ảo ảo của dự án D:\\AIO.');
    return;
  }

  const venvPython = path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(venvPython)) {
    return;
  }
  
  const venvDir = path.join(__dirname, '..', '.venv');
  if (fs.existsSync(venvDir)) {
    try {
      fs.rmSync(venvDir, { recursive: true, force: true });
    } catch (e) {}
  }
  
  progressCallback('Đang khởi tạo môi trường ảo Python 3.10 cục bộ...');
  const scratchDir = path.join(__dirname, '..');
  
  await new Promise((resolve, reject) => {
    exec(`"${uvCmd}" venv "${venvDir}" --python 3.10`, { cwd: scratchDir }, (err, stdout, stderr) => {
      if (err) {
        console.warn("Failed creating venv with 3.10, falling back to default python version:", stderr);
        exec(`"${uvCmd}" venv "${venvDir}"`, { cwd: scratchDir }, (err2, stdout2, stderr2) => {
          if (err2) {
            reject(new Error(`Không thể tạo môi trường ảo: ${stderr2}`));
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  });
  
  progressCallback('Tạo môi trường ảo thành công.');
}

/**
 * Checks whether VieNeu-TTS is installed and importable
 */
function checkVieNeuStatus() {
  try {
    const pyCmd = getVenvPythonCommand();
    execSync(`"${pyCmd}" -c "import vieneu"`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Checks whether OmniVoice is installed and importable
 */
function checkOmniVoiceStatus() {
  try {
    const pyCmd = getVenvPythonCommand();
    execSync(`"${pyCmd}" -c "import omnivoice"`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Installs local python model package
 */
async function installLocalModel(modelName, progressCallback) {
  let uvCmd = getUvCommand();
  if (!uvCmd) {
    uvCmd = await downloadUv(progressCallback);
  }
  
  await ensureVenv(progressCallback, uvCmd);
  const venvPy = getVenvPythonCommand();
  
  progressCallback(`Bắt đầu cài đặt thư viện ${modelName} bằng uv...`);
  
  return new Promise((resolve, reject) => {
    const pip = spawn(uvCmd, ['pip', 'install', '--python', venvPy, modelName]);
    
    pip.stdout.on('data', (data) => {
      progressCallback(data.toString());
    });
    
    pip.stderr.on('data', (data) => {
      progressCallback(data.toString());
    });
    
    pip.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Cài đặt ${modelName} thất bại (exit code ${code})`));
      }
      
      // Verification import test
      try {
        execSync(`"${venvPy}" -c "import ${modelName}"`, { stdio: 'ignore' });
        progressCallback(`Cài đặt ${modelName} hoàn tất và xác thực thành công!`);
        resolve();
      } catch (e) {
        reject(new Error(`Cài đặt thành công nhưng không thể import ${modelName} trong môi trường ảo.`));
      }
    });
  });
}

/**
 * Uninstalls local python model package
 */
async function uninstallLocalModel(modelName, progressCallback) {
  const uvCmd = getUvCommand() || 'uv';
  const venvPy = getVenvPythonCommand();
  
  progressCallback(`Đang gỡ cài đặt thư viện ${modelName} khỏi môi trường ảo...`);
  
  return new Promise((resolve, reject) => {
    const pip = spawn(uvCmd, ['pip', 'uninstall', '--python', venvPy, '-y', modelName]);
    
    pip.stdout.on('data', (data) => {
      progressCallback(data.toString());
    });
    
    pip.stderr.on('data', (data) => {
      progressCallback(data.toString());
    });
    
    pip.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Gỡ cài đặt ${modelName} thất bại (exit code ${code})`));
      }
      progressCallback(`Đã gỡ cài đặt hoàn toàn ${modelName} khỏi môi trường ảo.`);
      resolve();
    });
  });
}

module.exports = {
  checkVieNeuStatus,
  checkOmniVoiceStatus,
  installLocalModel,
  uninstallLocalModel,
  getVenvPythonCommand
};
