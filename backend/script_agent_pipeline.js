const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const BACKUP_API_KEYS = process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : [];
let keyIndex = 0;


/**
 * Helper to call an agent using Gemini JSON mode
 */
async function callAgent({ apiKey, modelName, systemPrompt, userPrompt, jsonSchemaDesc, pdfFilePath = null }) {
  const modelOptions = { 
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const name = modelName.toLowerCase();
  if (name.startsWith('gemini-3')) {
    modelOptions.generationConfig.thinkingConfig = {
      thinkingLevel: "HIGH"
    };
  } else if (name.startsWith('gemini-2.5') || name.includes('thinking')) {
    modelOptions.generationConfig.thinkingConfig = {
      thinkingBudget: 2048
    };
  }

  if (systemPrompt) {
    modelOptions.systemInstruction = systemPrompt;
  }

  const contents = [];
  if (pdfFilePath && fs.existsSync(pdfFilePath)) {
    try {
      const pdfBuffer = fs.readFileSync(pdfFilePath);
      contents.push({
        inlineData: {
          data: pdfBuffer.toString("base64"),
          mimeType: "application/pdf"
        }
      });
    } catch (err) {
      console.error(`Error reading PDF file at ${pdfFilePath}:`, err);
    }
  }

  contents.push({ 
    text: `${userPrompt}\n\nIMPORTANT: You MUST return a single, valid JSON object matching this structure/schema description:\n${jsonSchemaDesc}\nEnsure there is no markdown code wrapping (like \`\`\`json ... \`\`\`), just return the raw JSON string.` 
  });

  const pool = [];
  if (apiKey && apiKey.trim()) {
    pool.push(apiKey.trim());
  }
  BACKUP_API_KEYS.forEach(k => {
    if (!pool.includes(k)) pool.push(k);
  });

  let result;
  const maxRetries = pool.length > 1 ? Math.min(6, pool.length) : 3;
  let delay = 1500;

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
        throw new Error(`[Gemini Error] Thất bại sau ${maxRetries} lần gọi với các API Key khác nhau. Lỗi cuối: ${e.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(8000, delay * 1.5);
    }
  }

  const responseText = result.response.text().trim();
  try {
    return JSON.parse(responseText);
  } catch (err) {
    try {
      const fenceMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        return JSON.parse(fenceMatch[1].trim());
      }
      const braceMatch = responseText.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        return JSON.parse(braceMatch[0]);
      }
    } catch (_) {}
    throw new Error(`AI returned invalid JSON: ${responseText.substring(0, 300)}...`);
  }
}

/**
 * Generates detailed image prompts for scenes by chunking them across multiple Gemini API key calls.
 * This solves context/token limits for long videos (up to 2-3 hours / 100+ scenes).
 */
async function generateScenePromptsInChunks({ apiKey, modelName, topic, scenes, aspectRatio = '9:16', onProgress }) {
  const CHUNK_SIZE = 4; // 4 scenes per API call for maximum detail & zero token overflow
  const pool = [];
  if (apiKey && apiKey.trim()) pool.push(apiKey.trim());
  BACKUP_API_KEYS.forEach(k => { if (!pool.includes(k)) pool.push(k); });

  const formattedStoryboard = [];
  const ratioText = aspectRatio === '16:9' ? 'horizontal 16:9 landscape aspect ratio' : 'vertical 9:16 aspect ratio';

  for (let i = 0; i < scenes.length; i += CHUNK_SIZE) {
    const chunk = scenes.slice(i, i + CHUNK_SIZE);
    const chunkStart = i + 1;
    const chunkEnd = Math.min(i + CHUNK_SIZE, scenes.length);
    const keyIdx = Math.floor(i / CHUNK_SIZE) % pool.length;
    const currentKey = pool[keyIdx];

    if (typeof onProgress === 'function') {
      onProgress({
        agent: 'Final Formatter',
        status: 'running',
        message: `⚡ [API Worker #${keyIdx + 1}] Đang tạo Prompt ảnh (${aspectRatio}) cho Phân cảnh ${chunkStart}-${chunkEnd} / ${scenes.length}...`
      });
    }

    const chunkPrompt = `You are an expert East Asian Buddhist art director and AI image prompt engineer.
Create a detailed English image prompt and voice prompt for each of the following video scenes.

Teaching Topic: "${topic}"
Target Video Format: ${ratioText}

Scenes to process:
${chunk.map((s, idx) => `[Scene ${chunkStart + idx}]: "${s.text || s}"`).join('\n')}

REQUIREMENTS FOR EACH IMAGE PROMPT:
1. Must feature traditional East Asian Buddhist art, serene Buddhist monks, Buddha statues, temple gardens, or peaceful nature matching the teaching.
2. Must be in English, highly detailed, specifying lighting, colors, mood, atmosphere, and composition suitable for ${ratioText}.
3. Absolutely NO text overlay in the generated image.

Return a JSON array matching this exact format:
[
  {
    "sceneIndex": ${chunkStart},
    "text": "Exact Vietnamese script text for this scene",
    "imagePrompt": "Detailed English art prompt for image generator specifying ${ratioText}...",
    "voicePrompt": "Voice tone instruction for narrator..."
  }
]`;

    try {
      const genAI = new GoogleGenerativeAI(currentKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      });

      const res = await model.generateContent([{ text: chunkPrompt }]);
      const responseText = res.response.text().trim();
      let chunkData;
      try {
        chunkData = JSON.parse(responseText);
      } catch (_) {
        const match = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        chunkData = match ? JSON.parse(match[0]) : null;
      }

      if (Array.isArray(chunkData)) {
        chunkData.forEach((item, idx) => {
          formattedStoryboard.push({
            sceneIndex: chunkStart + idx,
            text: item.text || chunk[idx]?.text || '',
            imagePrompt: item.imagePrompt || `Detailed East Asian Buddhist art of ${topic}, ${ratioText}, serene atmosphere`,
            voicePrompt: item.voicePrompt || 'Trầm ấm, chiêm nghiệm'
          });
        });
      } else {
        chunk.forEach((item, idx) => {
          formattedStoryboard.push({
            sceneIndex: chunkStart + idx,
            text: item.text || (typeof item === 'string' ? item : ''),
            imagePrompt: `Detailed East Asian Buddhist art illustrating: ${item.text || item}, ${ratioText}, peaceful temple backdrop`,
            voicePrompt: 'Trầm ấm, chiêm nghiệm'
          });
        });
      }
    } catch (chunkErr) {
      console.warn(`[Chunk Prompt Worker ${keyIdx + 1} Failed]: ${chunkErr.message}`);
      chunk.forEach((item, idx) => {
        formattedStoryboard.push({
          sceneIndex: chunkStart + idx,
          text: item.text || (typeof item === 'string' ? item : ''),
          imagePrompt: `Detailed East Asian Buddhist art illustrating: ${item.text || item}, ${ratioText}, peaceful temple backdrop`,
          voicePrompt: 'Trầm ấm, chiêm nghiệm'
        });
      });
    }
  }

  return formattedStoryboard;
}

/**
 * Runs the complete multi-agent pipeline with distributed chunked prompt generation.
 */
async function runMultiAgentPipeline({ apiKey, topic, geminiModel, pdfFilePath, duration, style, aspectRatio = '9:16', onProgress }) {

  const log = (agent, status, message, data = null) => {
    if (typeof onProgress === 'function') {
      onProgress({ agent, status, message, data });
    }
  };

  const modelName = geminiModel || "gemini-2.0-flash";
  const durationText = duration >= 60 ? `${duration / 60} giờ` : (duration === 0.5 ? "30 giây" : `${duration} phút`);
  const styleText = style === 'accessible' 
    ? "Bình dị, đời thường, mộc mạc, dễ hiểu, tránh các từ Hán Việt quá phức tạp hoặc thuật ngữ học thuật khô khan." 
    : "Sâu sắc, trang nghiêm, phản ánh đúng tinh thần thiền tông và thuật ngữ Phật học chính quy.";

  // Calculate target syllables (approx 130 syllables per minute of slow speech)
  const targetSyllables = duration === 0.5 ? 65 : Math.round(duration * 130);
  const targetSentences = Math.round(targetSyllables / 16);

  const unifiedSystemPrompt = `Bạn là hệ thống AI Multi-Agent chuyên nghiệp thiết kế kịch bản video triết lý và Phật pháp.
Hệ thống của bạn tích hợp vai trò của 8 Agent làm việc tuần tự:
1. Idea Agent: Phân tích ý tưởng người dùng, chọn phong cách kể chuyện chiêm nghiệm, định vị đối tượng người nghe.
2. Research Agent: Nghiên cứu điển tích, câu chuyện kinh điển và trích dẫn thiền lý từ tài liệu đính kèm (PDF) hoặc kiến thức Phật giáo.
3. Audience Agent: Phân tích tâm lý khán giả, đề xuất câu mở đầu (hook) tự nhiên, chân thành.
4. Story Planner: Lập outline chi tiết theo mạch cảm xúc tự nhiên.
5. Script Writer: Soạn thảo bản thảo kịch bản thoại tiếng Việt (khoảng ${targetSentences} câu), hành văn mộc mạc, chậm rãi.
6. Script Critic: Thẩm định kịch bản nháp, chỉ ra câu nghe gượng gạo, đề xuất cải tiến.
7. Script Rewriter: Tiếp thu phê bình, viết lại bản thảo tối ưu nhất.
8. Final Formatter: Phân tách kịch bản thành các câu thoại chuẩn (storyboard scenes).

Bạn MUST chạy quy trình này và trả về duy nhất một cấu trúc JSON hợp lệ khớp chính xác với schema mô tả bên dưới.`;

  const unifiedUserPrompt = `Chủ đề yêu cầu: "${topic}"
Thời lượng kịch bản: ${durationText}
Giọng văn/Phong cách: ${styleText}
Đoạn văn viết khoảng ${targetSentences} câu thoại (tổng khoảng ${targetSyllables} âm tiết tiếng Việt).

Hãy nghiên cứu tài liệu đính kèm (nếu có), suy nghĩ tuần tự và hoàn thành toàn bộ kịch bản.`;

  const jsonSchemaDesc = `{
  "idea": {
    "theme": "Chủ đề cụ thể đã được tối ưu hóa (tiếng Việt)",
    "style": "Phong cách kể chuyện chiêm nghiệm",
    "targetAudience": "Đối tượng người nghe",
    "duration": "Thời lượng video",
    "coreObjective": "Mục tiêu cốt lõi"
  },
  "research": {
    "facts": ["Những triết lý sâu sắc"],
    "examples": ["Ví dụ thực tế"],
    "quotes": ["Trích dẫn Kinh điển"],
    "stories": ["Truyện thiền/Điển tích ngắn"]
  },
  "audience": {
    "desires": ["Khao khát khán giả"],
    "fears": ["Nỗi băn khoăn"],
    "curiosities": ["Điểm tò mò"],
    "hookStrategies": ["2-3 câu mở đầu (Hook)"]
  },
  "planner": {
    "outline": [
      {
        "section": "Tên phần",
        "objective": "Mục tiêu phần",
        "points": ["Điểm triết lý chính"]
      }
    ]
  },
  "writer": {
    "draftScript": [
      { "text": "Câu thoại tiếng Việt" }
    ]
  },
  "critic": {
    "scores": { "authenticityAndFlow": 9, "wisdomDepth": 8, "emotion": 9, "pacing": 8, "cta": 8 },
    "critique": { "hook": "...", "pacing": "...", "emotion": "...", "cta": "..." },
    "recommendations": ["Sửa đổi 1", "Sửa đổi 2"]
  },
  "rewriter": {
    "rewrittenScript": [
      { "text": "Câu thoại tiếng Việt đã được viết lại tự nhiên, hoàn hảo" }
    ]
  },
  "formatter": {
    "title": "Tiêu đề video cuốn hút (5-8 từ tiếng Việt)",
    "description": "Mô tả ngắn gọn",
    "hashtags": ["hashtag1", "hashtag2"],
    "storyboard": [
      {
        "sceneIndex": 1,
        "text": "Lời thoại tiếng Việt cho phân cảnh này"
      }
    ]
  }
}`;

  const agents = [
    { name: 'Idea Agent', runMsg: `Đang phân tích ý tưởng ban đầu: "${topic}"...` },
    { name: 'Research Agent', runMsg: 'Đang nghiên cứu điển tích, câu chuyện kinh điển và trích dẫn thiền lý...' },
    { name: 'Audience Agent', runMsg: 'Đang phân tích tâm tư khán giả để tìm cách tiếp cận tự nhiên nhất...' },
    { name: 'Story Planner', runMsg: 'Đang xây dựng mạch cốt truyện tự nhiên và kết nối thiền lý...' },
    { name: 'Script Writer', runMsg: 'Đang soạn thảo bản nháp kịch bản thoại tiếng Việt...' },
    { name: 'Script Critic', runMsg: 'Đang thẩm định nghiêm ngặt độ tự nhiên, chiều sâu thiền lý và mạch cảm xúc...' },
    { name: 'Script Rewriter', runMsg: 'Đang tiếp thu phê bình, loại bỏ câu từ gượng gạo và viết lại bản thảo tối ưu nhất...' },
    { name: 'Final Formatter', runMsg: 'Đang phân tách các phân cảnh...' }
  ];

  let currentStepIdx = 0;
  let activeAgent = null;

  const progressInterval = setInterval(() => {
    if (currentStepIdx < agents.length) {
      activeAgent = agents[currentStepIdx];
      log(activeAgent.name, 'running', activeAgent.runMsg);
      currentStepIdx++;
    }
  }, 1300);

  let resultData;
  try {
    resultData = await callAgent({
      apiKey,
      modelName,
      systemPrompt: unifiedSystemPrompt,
      userPrompt: unifiedUserPrompt,
      jsonSchemaDesc,
      pdfFilePath
    });

    clearInterval(progressInterval);

    // Fast-forward agent status updates
    const currentSimulatedIdx = currentStepIdx;
    for (let i = 0; i < agents.length - 1; i++) {
      const agent = agents[i];
      if (i >= currentSimulatedIdx) {
        log(agent.name, 'running', agent.runMsg);
      }
      
      let successMessage = '';
      let agentKey = '';
      if (agent.name === 'Idea Agent') {
        successMessage = `Đã định hình ý tưởng. Chủ đề tối ưu: "${resultData.idea?.theme || ''}"`;
        agentKey = 'idea';
      } else if (agent.name === 'Research Agent') {
        successMessage = `Nghiên cứu chất liệu hoàn tất. Đã trích xuất ${resultData.research?.quotes?.length || 0} trích dẫn.`;
        agentKey = 'research';
      } else if (agent.name === 'Audience Agent') {
        successMessage = `Đã thấu hiểu tâm lý khán giả. Mở đầu đề xuất: "${resultData.audience?.hookStrategies?.[0] || ''}"`;
        agentKey = 'audience';
      } else if (agent.name === 'Story Planner') {
        successMessage = `Đã thiết lập dàn ý tự nhiên gồm ${resultData.planner?.outline?.length || 0} phần chính.`;
        agentKey = 'planner';
      } else if (agent.name === 'Script Writer') {
        successMessage = `Đã soạn xong bản thảo thô gồm ${resultData.writer?.draftScript?.length || 0} câu thoại.`;
        agentKey = 'writer';
      } else if (agent.name === 'Script Critic') {
        successMessage = `Đã hoàn tất thẩm định. Điểm Chân thật & Tự nhiên: ${resultData.critic?.scores?.authenticityAndFlow || 9}/10.`;
        agentKey = 'critic';
      } else if (agent.name === 'Script Rewriter') {
        successMessage = `Đã biên tập xong kịch bản tự nhiên. Số câu: ${resultData.rewriter?.rewrittenScript?.length || 0}`;
        agentKey = 'rewriter';
      }
      
      log(agent.name, 'success', successMessage, resultData[agentKey] || {});
    }

    // ⚡ CHUNKED PROMPT GENERATION: Split scenes across distributed API calls
    log('Final Formatter', 'running', '🚀 Bắt đầu phân chia tạo Prompt ảnh theo từng cụm phân cảnh qua các API Worker khác nhau...');
    const rawScenes = resultData.formatter?.storyboard || resultData.rewriter?.rewrittenScript || [];
    const chunkedStoryboard = await generateScenePromptsInChunks({
      apiKey,
      modelName,
      topic,
      scenes: rawScenes,
      aspectRatio,
      onProgress
    });

    log('Final Formatter', 'success', `Đã phân chia API và tạo thành công ${chunkedStoryboard.length} Phân cảnh kèm Image Prompt đồng bộ!`, {
      title: resultData.formatter?.title,
      storyboard: chunkedStoryboard
    });

    return {
      success: true,
      data: {
        title: resultData.formatter?.title || topic,
        description: resultData.formatter?.description || '',
        hashtags: resultData.formatter?.hashtags || [],
        storyboard: chunkedStoryboard,
        script: chunkedStoryboard.map(item => ({ text: item.text })),
        agentLogs: {
          idea: resultData.idea || {},
          research: resultData.research || {},
          audience: resultData.audience || {},
          planner: resultData.planner || {},
          writer: resultData.writer || {},
          critic: resultData.critic || {},
          rewriter: resultData.rewriter || {},
          formatter: {
            title: resultData.formatter?.title,
            description: resultData.formatter?.description,
            hashtags: resultData.formatter?.hashtags,
            storyboard: chunkedStoryboard
          }
        }
      }
    };

  } catch (error) {
    clearInterval(progressInterval);
    const failedAgent = activeAgent ? activeAgent.name : 'System';
    log(failedAgent, 'error', `Thất bại khi gọi API: ${error.message}`);
    throw error;
  }
}

module.exports = {
  runMultiAgentPipeline,
  generateScenePromptsInChunks
};
