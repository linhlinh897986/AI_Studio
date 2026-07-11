const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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
 * Synthesizes Vietnamese speech using local VieNeu-TTS (ONNX Runtime)
 */
function synthesizeLocalTts(text, outputPath, options = {}) {
  return new Promise((resolve, reject) => {
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
  });
}

module.exports = {
  getPythonPath,
  synthesizeLocalTts
};
