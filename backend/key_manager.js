/**
 * Professional Gemini API Key Pool & Rate-Limiter Manager
 * Handles round-robin key selection, per-key token/request tracking,
 * automatic blacklisting of invalid keys (API_KEY_INVALID),
 * automatic cooldowns on 429 errors, and instant failover retries.
 */
class GeminiKeyPool {
  constructor() {
    this.globalIndex = 0;
    this.keyCooldowns = new Map(); // key -> cooldownTimestamp
    this.invalidKeys = new Set();  // set of permanently invalid/expired keys
  }

  parseKeys(apiKeyInput) {
    const rawKeys = [];
    if (apiKeyInput && typeof apiKeyInput === 'string') {
      apiKeyInput.split(/[\n,;\r]+/).map(k => k.trim().replace(/^["']|["']$/g, '')).filter(Boolean).forEach(k => {
        if (!rawKeys.includes(k)) rawKeys.push(k);
      });
    }
    // Only fall back to process.env if user provided no keys at all
    if (rawKeys.length === 0 && process.env.GEMINI_API_KEY) {
      process.env.GEMINI_API_KEY.split(/[\n,;\r]+/).map(k => k.trim().replace(/^["']|["']$/g, '')).filter(Boolean).forEach(k => {
        if (!rawKeys.includes(k)) rawKeys.push(k);
      });
    }

    // Filter out blacklisted invalid keys
    const validPool = rawKeys.filter(k => !this.invalidKeys.has(k));
    return validPool;
  }

  markInvalid(key) {
    if (!key) return;
    this.invalidKeys.add(key);
    console.error(`[KeyPool Manager ❌] Key ${key.substring(0, 10)}... KHÔNG HỢP LỆ (API_KEY_INVALID). Đã loại bỏ khỏi danh sách.`);
  }

  markCooldown(key, durationSec = 16) {
    if (!key) return;
    const until = Date.now() + (durationSec * 1000);
    this.keyCooldowns.set(key, until);
    console.log(`[KeyPool Manager ⏳] Key ${key.substring(0, 10)}... tạm nghỉ ${durationSec}s do dính 429 Quota.`);
  }

  getNextKey(apiKeyInput, offset = 0) {
    const keys = this.parseKeys(apiKeyInput);
    if (keys.length === 0) return '';
    if (keys.length === 1) return keys[0];

    const now = Date.now();
    for (let i = 0; i < keys.length; i++) {
      const idx = (this.globalIndex + offset + i) % keys.length;
      const candidate = keys[idx];
      const cd = this.keyCooldowns.get(candidate) || 0;
      if (now >= cd) {
        this.globalIndex = (idx + 1) % keys.length;
        return candidate;
      }
    }

    // Fallback: pick key with earliest cooldown expiry
    let bestKey = keys[0];
    let minCd = Infinity;
    keys.forEach(k => {
      const cd = this.keyCooldowns.get(k) || 0;
      if (cd < minCd) {
        minCd = cd;
        bestKey = k;
      }
    });
    return bestKey;
  }

  async executeWithRetry(apiKeyInput, apiFn, maxRetries = null) {
    const initialKeys = this.parseKeys(apiKeyInput);
    if (initialKeys.length === 0) {
      throw new Error('Chưa cấu hình Google Gemini API Key. Vui lòng nhập API Key trong mục Cài Đặt.');
    }

    const retries = maxRetries || Math.max(3, initialKeys.length * 2);
    let lastError = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      const activeKeys = this.parseKeys(apiKeyInput);
      if (activeKeys.length === 0) {
        throw new Error('Tất cả Gemini API Key của bạn đều không hợp lệ (API_KEY_INVALID). Vui lòng vào Cài Đặt để cập nhật API Key mới.');
      }

      const currentKey = this.getNextKey(apiKeyInput, attempt);
      if (!currentKey) {
        throw new Error('Không có Gemini API Key hợp lệ nào để sử dụng.');
      }

      try {
        const result = await apiFn(currentKey);
        return result;
      } catch (err) {
        lastError = err;
        const errMsg = err.message || '';
        console.warn(`[KeyPool Attempt ${attempt + 1}/${retries} - Key ${currentKey.substring(0, 10)}... Failed]: ${errMsg}`);

        if (errMsg.includes('API key not valid') || errMsg.includes('API_KEY_INVALID') || errMsg.includes('API_KEY_SERVICE_BLOCKED')) {
          this.markInvalid(currentKey);
          const remaining = this.parseKeys(apiKeyInput);
          if (remaining.length > 0) {
            console.log(`[KeyPool Auto Switch 🔀] Đã tự động chuyển sang API Key hợp lệ tiếp theo...`);
            continue;
          } else {
            throw new Error('API Key của bạn không hợp lệ hoặc đã bị vô hiệu hóa bởi Google (API_KEY_INVALID). Vui lòng kiểm tra lại API Key trong mục Cài Đặt.');
          }
        }

        if (errMsg.includes('429') || errMsg.includes('Quota')) {
          const match = errMsg.match(/retry in ([0-9.]+)s/i);
          const waitSec = match ? Math.ceil(parseFloat(match[1])) + 1 : 16;
          this.markCooldown(currentKey, waitSec);

          if (activeKeys.length > 1) {
            console.log(`[KeyPool Failover 429] Chuyển ngay sang API Key tiếp theo trong bể key...`);
            await new Promise(r => setTimeout(r, 400));
          } else {
            console.log(`[KeyPool Single Key 429] Tạm dừng ${waitSec}s trước khi thử lại...`);
            await new Promise(r => setTimeout(r, waitSec * 1000));
          }
        } else {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error(`Tất cả API Key đều thất bại.`);
  }
}

const globalKeyPool = new GeminiKeyPool();

module.exports = {
  globalKeyPool,
  GeminiKeyPool
};
