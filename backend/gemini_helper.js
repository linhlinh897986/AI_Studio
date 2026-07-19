const { GoogleGenerativeAI } = require('@google/generative-ai');

const BACKUP_API_KEYS = process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : [];


/**

 * Extracts the first valid JSON object from a string.
 * Handles common Gemini quirks: extra braces, markdown code fences, trailing text.
 */
function extractFirstJson(text) {
  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // Find the first '{' and walk forward counting braces to find the matching '}'
  const start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in response');

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  throw new Error('Unbalanced JSON braces in response');
}

function getApiKeyPool(apiKey) {
  const pool = [];
  if (apiKey && typeof apiKey === 'string') {
    apiKey.split(/[\n,;]+/).map(k => k.trim()).filter(Boolean).forEach(k => {
      if (!pool.includes(k)) pool.push(k);
    });
  }
  if (process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY.split(/[\n,;]+/).map(k => k.trim()).filter(Boolean).forEach(k => {
      if (!pool.includes(k)) pool.push(k);
    });
  }
  return pool.length > 0 ? pool : [''];
}

/**
 * Call Gemini to generate a video script in JSON format
 * @param {string} apiKey 
 * @param {string} systemPrompt 
 * @param {string} userPrompt 
 * @returns {Promise<object>}
 */
async function generateJsonScript(apiKey, systemPrompt, userPrompt, modelName = "gemini-3.1-flash-lite", pdfFilePath = null) {
  const modelOptions = { 
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  if (systemPrompt) {
    modelOptions.systemInstruction = systemPrompt;
  }


  const contents = [];
  if (pdfFilePath) {
    const fs = require('fs');
    if (fs.existsSync(pdfFilePath)) {
      const pdfBuffer = fs.readFileSync(pdfFilePath);
      contents.push({
        inlineData: {
          data: pdfBuffer.toString("base64"),
          mimeType: "application/pdf"
        }
      });
    } else {
      console.warn(`PDF file not found at: ${pdfFilePath}`);
    }
  }

  contents.push({ text: userPrompt });

  const { globalKeyPool } = require('./key_manager');
  const result = await globalKeyPool.executeWithRetry(apiKey, async (currentKey) => {
    const genAI = new GoogleGenerativeAI(currentKey);
    const model = genAI.getGenerativeModel(modelOptions);
    return await model.generateContent(contents);
  });

  const responseText = result.response.text();
  
  try {
    // First try a clean parse
    return JSON.parse(responseText);
  } catch (_) {
    // Fallback: extract the first balanced JSON object from the response
    try {
      const extracted = extractFirstJson(responseText);
      console.warn('Gemini returned extra content — used brace-balanced extraction.');
      return JSON.parse(extracted);
    } catch (err) {
      console.error("Gemini output was not valid JSON:", responseText);
      throw new Error("Gemini API không trả về định dạng JSON hợp lệ. Chi tiết: " + responseText.substring(0, 200));
    }
  }
}

module.exports = {
  generateJsonScript
};
