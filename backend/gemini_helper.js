const { GoogleGenerativeAI } = require('@google/generative-ai');

const BACKUP_API_KEYS = process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : [];
let keyIndex = 0;


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

/**
 * Call Gemini to generate a video script in JSON format
 * @param {string} apiKey 
 * @param {string} systemPrompt 
 * @param {string} userPrompt 
 * @returns {Promise<object>}
 */
async function generateJsonScript(apiKey, systemPrompt, userPrompt, modelName = "gemini-2.0-flash", pdfFilePath = null) {
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

  const pool = [];
  if (apiKey && apiKey.trim()) {
    pool.push(apiKey.trim());
  }
  BACKUP_API_KEYS.forEach(k => {
    if (!pool.includes(k)) pool.push(k);
  });

  let result;
  const maxRetries = pool.length > 1 ? Math.min(6, pool.length) : 4;
  let retryDelay = 1500;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const currentKey = pool[(keyIndex + attempt - 1) % pool.length];
    try {
      const genAI = new GoogleGenerativeAI(currentKey);
      const model = genAI.getGenerativeModel(modelOptions);
      result = await model.generateContent(contents);
      
      keyIndex = (keyIndex + attempt) % pool.length;
      break;
    } catch (e) {
      console.warn(`[Gemini Attempt ${attempt} failed with key ${currentKey.substring(0, 10)}...]: ${e.message}`);
      if (attempt === maxRetries) {
        throw e;
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retryDelay = Math.min(8000, retryDelay * 1.5);
    }
  }

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
