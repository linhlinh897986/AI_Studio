const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Call Gemini to generate a video script in JSON format
 * @param {string} apiKey 
 * @param {string} systemPrompt 
 * @param {string} userPrompt 
 * @returns {Promise<object>}
 */
async function generateJsonScript(apiKey, systemPrompt, userPrompt, modelName = "gemini-2.0-flash", pdfFilePath = null) {
  // Use GoogleGenerativeAI client SDK
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

  const result = await model.generateContent(contents);
  const responseText = result.response.text();
  
  try {
    return JSON.parse(responseText);
  } catch (err) {
    console.error("Gemini output was not valid JSON:", responseText);
    throw new Error("Gemini API không trả về định dạng JSON hợp lệ. Chi tiết phản hồi: " + responseText.substring(0, 100));
  }
}

module.exports = {
  generateJsonScript
};
