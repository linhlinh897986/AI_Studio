---
name: github-dual-repo-workflow
description: Workflow for managing ViGen AIO source code and releases across two GitHub repositories. Pushes source code changes to https://github.com/linhlinh897986/AI_Studio and builds, packages, and publishes executable releases (.exe, .blockmap, latest.yml) to https://github.com/linhlinh897986/AI_Studio-Releases. Use when asked to commit code, push updates, build app installers, or release new versions.
---

# Dual Repository Workflow Guide (AI_Studio & AI_Studio-Releases)

This skill provides step-by-step instructions for managing code commits and app releases across two separate GitHub repositories:

1. **Source Code Repository**: [`https://github.com/linhlinh897986/AI_Studio.git`](https://github.com/linhlinh897986/AI_Studio.git)
   - Holds the primary application source code (Vite + React frontend, Electron main process, backend services, assets, and build configuration).
2. **Releases Repository**: [`https://github.com/linhlinh897986/AI_Studio-Releases.git`](https://github.com/linhlinh897986/AI_Studio-Releases.git)
   - Dedicated repository for hosted binary release assets (`ViGen AIO Studio Setup x.x.x.exe`, `ViGen AIO Studio Setup x.x.x.exe.blockmap`, `latest.yml`) used by `electron-updater` for auto-updates.

---

## 🔑 1. Authentication & Prerequisites

Ensure `.env` in the root project directory contains your GitHub Personal Access Token (`GH_TOKEN`):

```env
GH_TOKEN="github_pat_..."
```

> [!IMPORTANT]
> The `GH_TOKEN` must have `repo` and `write:packages` scope permissions to allow both git pushes and GitHub Release API operations.

---

## 💻 2. Pushing Source Code to `AI_Studio` (Codebase Repo)

When making code changes or feature updates:

1. **Check Git Remote**:
   Ensure `origin` points to `https://github.com/linhlinh897986/AI_Studio.git`:
   ```cmd
   git remote set-url origin https://x-access-token:%GH_TOKEN%@github.com/linhlinh897986/AI_Studio.git
   ```

2. **Commit and Push**:
   ```cmd
   git add .
   git commit -m "feat/fix: <descriptive message>"
   git push -u origin main
   ```

---

## 📦 3. Building & Publishing Releases to `AI_Studio-Releases` (Release Repo)

To build the executable application (`.exe`), obfuscate JavaScript, compile V8 bytecode, and upload the installer to `AI_Studio-Releases`:

### Step-by-Step Execution:

1. **Verify `package.json` Configuration**:
   Ensure the `build.win.publish` section targets `AI_Studio-Releases`:
   ```json
   "build": {
     "appId": "com.vigen.aio.studio",
     "productName": "ViGen AIO Studio",
     "win": {
       "icon": "build/icon.ico",
       "target": ["nsis"],
       "publish": [
         {
           "provider": "github",
           "owner": "linhlinh897986",
           "repo": "AI_Studio-Releases",
           "releaseType": "draft"
         }
       ]
     }
   }
   ```

2. **Run Automated Build Pipeline**:
   Execute the custom build script:
   ```cmd
   cmd.exe /c node build.js
   ```

   **What `build.js` automatically performs:**
   - ⚡ Compiles Vite frontend (`npx vite build`).
   - 🖼️ Generates & resizes app logo to `build/icon.png` and `build/icon.ico`.
   - 🧹 Prepares clean staging directory `dist-build/` (skipping `src/` JSX and `node_modules`).
   - 🔒 Obfuscates JS files using `javascript-obfuscator`.
   - ⚙️ Compiles V8 Bytecode (`.jsc`) via `bytenode` with Electron runtime.
   - 📦 Packages Windows NSIS installer using `electron-builder` into `dist/`.
   - 🚀 Uploads setup installer (`.exe`), `.blockmap`, and `latest.yml` to `https://api.github.com/repos/linhlinh897986/AI_Studio-Releases/releases`.
   - 🎉 Publishes the release officially on GitHub Releases.

---

## 🛠️ 4. Troubleshooting & Best Practices

- **Repository is empty Error (422)**:
  If `AI_Studio-Releases` has no commits yet, push an initial commit (e.g. `README.md`) to `main` branch before creating a release:
  ```cmd
  mkdir temp_release_init && cd temp_release_init
  git init
  echo # ViGen AIO Studio Releases > README.md
  git add README.md
  git commit -m "Initial commit"
  git branch -M main
  git remote add origin https://x-access-token:%GH_TOKEN%@github.com/linhlinh897986/AI_Studio-Releases.git
  git push -u origin main
  ```
- **Draft Cleanup**:
  If a release upload fails mid-process, clean up lingering draft releases before re-running `node build.js`.
