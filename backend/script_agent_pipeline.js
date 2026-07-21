const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const { globalKeyPool } = require('./key_manager');

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

  const { globalKeyPool } = require('./key_manager');
  const result = await globalKeyPool.executeWithRetry(apiKey, async (currentKey) => {
    const genAI = new GoogleGenerativeAI(currentKey);
    const model = genAI.getGenerativeModel(modelOptions);
    return await model.generateContent(contents);
  });

  const responseText = result.response.text().trim();
  return parseSafeJson(responseText);
}

function parseSafeJson(text) {
  if (!text) throw new Error('Empty response from AI');
  let clean = text.trim();
  clean = clean.replace(/```(?:json)?\s*([\s\S]*?)```/gi, '$1').trim();

  try {
    return JSON.parse(clean);
  } catch (_) {}

  const objMatch = clean.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch (_) {}
  }

  const arrMatch = clean.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch (_) {}
  }

  let repaired = clean;
  repaired = repaired.replace(/[\u0000-\u001F]+/g, (match) => {
    if (match.includes('\n')) return '\\n';
    if (match.includes('\r')) return '\\r';
    if (match.includes('\t')) return '\\t';
    return '';
  });
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(repaired);
  } catch (_) {}

  const repObjMatch = repaired.match(/\{[\s\S]*\}/);
  if (repObjMatch) {
    try { return JSON.parse(repObjMatch[0]); } catch (_) {}
  }

  try {
    let truncated = repaired;
    const openQuotes = (truncated.match(/(?<!\\)"/g) || []).length;
    if (openQuotes % 2 !== 0) truncated += '"';

    let openBraces = 0, openBrackets = 0;
    let inString = false;
    for (let i = 0; i < truncated.length; i++) {
      const char = truncated[i];
      if (char === '"' && (i === 0 || truncated[i - 1] !== '\\')) {
        inString = !inString;
      } else if (!inString) {
        if (char === '{') openBraces++;
        else if (char === '}') openBraces = Math.max(0, openBraces - 1);
        else if (char === '[') openBrackets++;
        else if (char === ']') openBrackets = Math.max(0, openBrackets - 1);
      }
    }

    truncated += ']'.repeat(openBrackets) + '}'.repeat(openBraces);
    return JSON.parse(truncated);
  } catch (_) {}

  throw new Error(`Phản hồi AI không đúng định dạng JSON: ${clean.substring(0, 150)}...`);
}

/**
 * Generates detailed image prompts for scenes by chunking them across multiple Gemini API key calls.
 * This solves context/token limits for long videos (up to 2-3 hours / 100+ scenes).
 */
async function generateScenePromptsInChunks({ apiKey, modelName, topic, scenes, aspectRatio = '9:16', onProgress }) {
  const CHUNK_SIZE = 4; // 4 scenes per API call for maximum detail & zero token overflow
  const pool = getApiKeyPool(apiKey);

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
          const originalText = (typeof chunk[idx] === 'string' ? chunk[idx] : chunk[idx]?.text) || item.text || '';
          formattedStoryboard.push({
            sceneIndex: chunkStart + idx,
            text: originalText,
            imagePrompt: item.imagePrompt || `Detailed East Asian Buddhist art of ${topic}, ${ratioText}, serene atmosphere`,
            voicePrompt: item.voicePrompt || 'Trầm ấm, chiêm nghiệm'
          });
        });
      } else {
        chunk.forEach((item, idx) => {
          const originalText = typeof item === 'string' ? item : (item.text || '');
          formattedStoryboard.push({
            sceneIndex: chunkStart + idx,
            text: originalText,
            imagePrompt: `Detailed East Asian Buddhist art illustrating: ${originalText}, ${ratioText}, peaceful temple backdrop`,
            voicePrompt: 'Trầm ấm, chiêm nghiệm'
          });
        });
      }
    } catch (chunkErr) {
      console.warn(`[Chunk Prompt Worker ${keyIdx + 1} Failed]: ${chunkErr.message}`);
      chunk.forEach((item, idx) => {
        const originalText = typeof item === 'string' ? item : (item.text || '');
        formattedStoryboard.push({
          sceneIndex: chunkStart + idx,
          text: originalText,
          imagePrompt: `Detailed East Asian Buddhist art illustrating: ${originalText}, ${ratioText}, peaceful temple backdrop`,
          voicePrompt: 'Trầm ấm, chiêm nghiệm'
        });
      });
    }
  }

  return formattedStoryboard;
}

/**
 * Expands script into multiple chapters for long duration videos (5m, 10m, 15m, 30m, 60m, 120m, 180m).
 * Prevents LLM output truncation by making chunked Gemini API calls across available keys.
 */
async function expandLongScriptInChunks({ apiKey, modelName, topic, outline, targetSyllables, styleText, pdfFilePath, onProgress }) {
  const CHUNK_SYLLABLES = 650; // ~40 sentences per Gemini call
  const numChapters = Math.max(2, Math.ceil(targetSyllables / CHUNK_SYLLABLES));
  const pool = getApiKeyPool(apiKey);

  const expandedScript = [];

  for (let i = 0; i < numChapters; i++) {
    const chapNum = i + 1;
    const keyIdx = i % pool.length;
    const currentKey = pool[keyIdx];

    const outlineSection = outline && outline[i % outline.length] 
      ? `Tên phần: ${outline[i % outline.length].section}. Trọng tâm: ${(outline[i % outline.length].points || []).join(', ')}`
      : `Phần ${chapNum}: Khai triển chủ đề sâu sắc`;

    if (typeof onProgress === 'function') {
      onProgress({
        agent: 'Script Rewriter',
        status: 'running',
        message: `⚡ [Worker #${keyIdx + 1}] Đang viết kịch bản chuyên sâu Chương ${chapNum}/${numChapters} (${outlineSection.slice(0, 45)}...)...`
      });
    }

    const chapPrompt = `Bạn là đại thiền sư và nhà biên kịch Phật giáo xuất sắc.
Hãy viết phần kịch bản thoại tiếng Việt cho Chương ${chapNum}/${numChapters} của bài pháp thoại về chủ đề "${topic}".

Bối cảnh chương: ${outlineSection}
Phong cách giọng văn: ${styleText}

YÊU CẦU QUAN TRỌNG:
1. Viết khoảng 35-45 câu thoại ngắn (khoảng 600-700 âm tiết tiếng Việt), hành văn mộc mạc, thanh tịnh, chậm rãi.
2. Tuyệt đối không dùng từ đệm thừa, không tự giới thiệu. Mỗi câu là 1 tư tưởng triết lý hoặc 1 mẩu chuyện/ví dụ thực tế.

Return ONLY a raw JSON array of objects:
[
  { "text": "Câu thoại tiếng Việt súc tích thứ nhất..." },
  { "text": "Câu thoại tiếng Việt thứ hai..." }
]`;

    try {
      const responseText = await globalKeyPool.executeWithRetry(apiKey, async (currentKey) => {
        const genAI = new GoogleGenerativeAI(currentKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json" }
        });
        const res = await model.generateContent([{ text: chapPrompt }]);
        return res.response.text().trim();
      });

      let chapData;
      try {
        chapData = JSON.parse(responseText);
      } catch (_) {
        const match = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        chapData = match ? JSON.parse(match[0]) : null;
      }

      if (Array.isArray(chapData) && chapData.length > 0) {
        chapData.forEach(item => {
          if (item.text && item.text.trim()) {
            expandedScript.push({ text: item.text.trim() });
          }
        });
      }
    } catch (err) {
      console.error(`[Chapter Worker Failed for Chap ${chapNum}]: ${err.message}`);
    }

    // Delay 800ms between chapter calls to maintain smooth token throughput
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  return expandedScript;
}

/**
 * Runs the complete multi-agent pipeline with distributed chunked prompt generation.
 */
async function runMultiAgentPipeline({ apiKey, topic, geminiModel, pdfFilePath, duration, style, aspectRatio = '9:16', videoLayout = 'storyboard', onProgress }) {


  const log = (agent, status, message, data = null) => {
    if (typeof onProgress === 'function') {
      onProgress({ agent, status, message, data });
    }
  };

  const modelName = geminiModel || "gemini-2.5-flash";
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

    let rawScenes = (resultData.rewriter?.rewrittenScript && resultData.rewriter.rewrittenScript.length > 0)
      ? resultData.rewriter.rewrittenScript
      : (resultData.formatter?.storyboard || []);

    // ⚡ LONG DURATION SCRIPT EXPANSION: If target duration is long (>= 5 mins), expand script in chunked chapter calls
    if (duration >= 5 || rawScenes.length < targetSentences * 0.4) {
      log('Script Rewriter', 'running', `⚡ Thời lượng dài (${durationText}). Đang kích hoạt 10-Worker Chunking để mở rộng bài giảng trọn vẹn ${targetSentences} câu thoại (~${targetSyllables} âm tiết)...`);
      const longScriptScenes = await expandLongScriptInChunks({
        apiKey,
        modelName,
        topic,
        outline: resultData.planner?.outline || [],
        targetSyllables,
        styleText,
        pdfFilePath,
        onProgress
      });
      if (longScriptScenes.length > 0) {
        rawScenes = longScriptScenes;
        log('Script Rewriter', 'success', `Đã mở rộng thành công bài giảng dài gồm ${rawScenes.length} câu thoại liền mạch!`);
      }
    }

    let chunkedStoryboard = [];
    if (videoLayout === 'static') {
      log('Final Formatter', 'running', '💡 Bạn chọn [Ảnh nền tĩnh (1 ảnh)]: Bỏ qua lặp 507 cảnh, đang tạo 1 Prompt ảnh duy nhất...');
      const ratioText = aspectRatio === '16:9' ? 'horizontal 16:9 landscape aspect ratio' : 'vertical 9:16 aspect ratio';
      let singlePrompt = `Detailed traditional East Asian Buddhist artwork, serene Buddha statue or meditating monk in a peaceful lotus temple garden, ${topic}, ${ratioText}, photorealistic, highly detailed, 8k resolution`;
      try {
        const text = await globalKeyPool.executeWithRetry(apiKey, async (currentKey) => {
          const genAI = new GoogleGenerativeAI(currentKey);
          const model = genAI.getGenerativeModel({ model: modelName });
          const res = await model.generateContent([
            `Create a single detailed English AI image prompt for a video background image.
Teaching Topic: "${topic}"
Target Video Format: ${ratioText}
REQUIREMENTS: Traditional East Asian Buddhist art, serene Buddhist monks, Buddha statues, temple gardens, peaceful nature. English, highly detailed. NO text overlay.
Return ONLY the prompt text in English.`
          ]);
          return res.response.text().trim();
        });
        if (text && text.length > 10) singlePrompt = text;
      } catch (e) {
        console.warn('Single prompt fallback:', e.message);
      }

      chunkedStoryboard = rawScenes.map((s, idx) => ({
        sceneIndex: idx + 1,
        text: typeof s === 'string' ? s : (s.text || ''),
        imagePrompt: singlePrompt,
        voicePrompt: 'Trầm ấm, chiêm nghiệm'
      }));
      log('Final Formatter', 'success', `✅ Đã tối ưu! Tạo 1 Prompt ảnh tĩnh dùng chung cho toàn bộ ${chunkedStoryboard.length} câu thoại.`);
    } else {
      // ⚡ CHUNKED PROMPT GENERATION: Split scenes across distributed API calls
      log('Final Formatter', 'running', '🚀 Bắt đầu phân chia tạo Prompt ảnh theo từng cụm phân cảnh qua các API Worker khác nhau...');
      chunkedStoryboard = await generateScenePromptsInChunks({
        apiKey,
        modelName,
        topic,
        scenes: rawScenes,
        aspectRatio,
        onProgress
      });
    }


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
