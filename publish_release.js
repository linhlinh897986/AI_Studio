const fs = require('fs');
const path = require('path');

// Load .env
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

const token = process.env.GH_TOKEN;
if (!token) {
  console.error('ERROR: GH_TOKEN not found in .env');
  process.exit(1);
}

console.log('GH_TOKEN loaded:', token.substring(0, 15) + '...');

const axios = require('axios');
const pkgVersion = '1.0.3';


const owner = 'linhlinh897986';
const repo = 'AI_Studio-Releases';
const url = `https://api.github.com/repos/${owner}/${repo}/releases`;
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'vigen-github-publisher'
};

(async () => {
  try {
    // Delete existing release if any
    try {
      const checkRes = await axios.get(`${url}/tags/v${pkgVersion}`, { headers });
      if (checkRes.data && checkRes.data.id) {
        console.log(`Deleting existing release ID: ${checkRes.data.id}...`);
        await axios.delete(`${url}/${checkRes.data.id}`, { headers });
      }
    } catch (e) {}

    // Delete tag if exists
    try {
      await axios.delete(`https://api.github.com/repos/${owner}/${repo}/git/refs/tags/v${pkgVersion}`, { headers });
      console.log(`Deleted old tag v${pkgVersion}`);
    } catch (e) {}

    // Create new draft release
    console.log(`Creating draft release v${pkgVersion}...`);
    const createRes = await axios.post(url, {
      tag_name: `v${pkgVersion}`,
      name: `ViGen AIO Studio v${pkgVersion}`,
      body: `## ViGen AIO Studio v${pkgVersion}\n\n**Fix man hinh den khi khoi dong**\n- Fixed: React UI bundle bi obfuscate nham gay man hinh den khi cai va mo app\n- Fixed: dist/ duoc copy sach sau obfuscation, khong bi xu ly boi javascript-obfuscator\n- Fixed: vite.config.js khong con bi obfuscate\n- Improved: isDev detection logic`,
      draft: true
    }, { headers });

    const releaseId = createRes.data.id;
    const uploadBaseUrl = createRes.data.upload_url.split('{')[0];
    console.log(`Draft release created with ID: ${releaseId}`);

    const exeName = `ViGen AIO Studio Setup ${pkgVersion}.exe`;
    const filesToUpload = [
      { local: path.join(__dirname, 'dist-installer', exeName), remote: exeName, contentType: 'application/x-msdownload' },
      { local: path.join(__dirname, 'dist-installer', `${exeName}.blockmap`), remote: `${exeName}.blockmap`, contentType: 'application/octet-stream' },
      { local: path.join(__dirname, 'dist-installer', 'latest.yml'), remote: 'latest.yml', contentType: 'text/yaml' }

    ];

    for (const file of filesToUpload) {
      if (fs.existsSync(file.local)) {
        const sizeMB = (fs.statSync(file.local).size / (1024 * 1024)).toFixed(2);
        console.log(`Uploading ${file.remote} (${sizeMB} MB)...`);
        const data = fs.readFileSync(file.local);
        await axios.post(`${uploadBaseUrl}?name=${encodeURIComponent(file.remote)}`, data, {
          headers: { ...headers, 'Content-Type': file.contentType },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });
        console.log(`  Uploaded: ${file.remote}`);
      } else {
        console.warn(`  File not found: ${file.local}`);
      }
    }

    // Publish
    console.log(`Publishing release v${pkgVersion}...`);
    await axios.patch(`${url}/${releaseId}`, { draft: false }, { headers });
    console.log(`PUBLISHED v${pkgVersion} to https://github.com/${owner}/${repo}/releases`);

  } catch (err) {
    const msg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    console.error('ERROR:', msg);
    process.exit(1);
  }
})();
