const { GoogleGenerativeAI } = require('@google/generative-ai');

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
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const modelOptions = { 
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  if (systemPrompt) {
    modelOptions.systemInstruction = systemPrompt;
  }

  const model = genAI.getGenerativeModel(modelOptions);

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

  let result;
  const maxRetries = 4;
  let retryDelay = 3500;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      result = await model.generateContent(contents);
      break;
    } catch (e) {
      const isRateLimit = e.message.includes('429') || e.message.includes('Too Many Requests') || e.message.includes('quota');
      if (isRateLimit && attempt < maxRetries) {
        console.warn(`[Gemini API] Rate limit (429) hoặc quá giới hạn hạn mức (Quota exceeded). Đang thử lại sau ${retryDelay / 1000} giây... (Lần ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
      } else {
        throw e;
      }
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
