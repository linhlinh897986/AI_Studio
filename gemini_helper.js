const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Call Gemini to generate a video script in JSON format
 * @param {string} apiKey 
 * @param {string} systemPrompt 
 * @param {string} userPrompt 
 * @returns {Promise<object>}
 */
async function generateJsonScript(apiKey, systemPrompt, userPrompt, modelName = "gemini-2.0-flash") {
  // Use GoogleGenerativeAI client SDK
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json"
    }
  });

  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: systemPrompt }]
      },
      {
        role: "model",
        parts: [{ text: "Tôi đã hiểu yêu cầu hệ thống. Tôi sẽ luôn trả về kết quả ở định dạng JSON đúng chuẩn cấu trúc được yêu cầu." }]
      }
    ]
  });

  const result = await chat.sendMessage(userPrompt);
  const responseText = result.response.text();
  
  try {
    return JSON.parse(responseText);
  } catch (err) {
    console.error("Gemini output was not valid JSON:", responseText);
    throw new Error("Gemini API không trả về định dạng JSON hợp lệ.");
  }
}

module.exports = {
  generateJsonScript
};
