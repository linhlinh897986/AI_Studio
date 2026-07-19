const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const BACKUP_API_KEYS = process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : [];

function cleanFilePath(filePath) {
  if (!filePath) return '';
  let cleaned = filePath.replace(/^file:\/\/\/?/, '');
  if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(cleaned)) {
    cleaned = cleaned.substring(1);
  }
  return path.normalize(cleaned);
}

/**
 * Extracts the first valid JSON array or object from text.
 */
function extractFirstJson(text) {

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  const startArr = text.indexOf('[');
  const startObj = text.indexOf('{');
  
  let start = -1;
  let isArray = false;

  if (startArr !== -1 && (startObj === -1 || startArr < startObj)) {
    start = startArr;
    isArray = true;
  } else if (startObj !== -1) {
    start = startObj;
    isArray = false;
  }

  if (start === -1) throw new Error('No JSON structure found in Gemini response');

  let depth = 0;
  let inString = false;
  let escape = false;

  const openChar = isArray ? '[' : '{';
  const closeChar = isArray ? ']' : '}';

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  throw new Error('Unbalanced JSON structure in response');
}

/**
 * Executes a shell command with promise wrap
 */
function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      if (error) {
        console.warn(`Command failed: ${command}\nError: ${error.message}`);
        return reject(error);
      }
      resolve(stdout ? stdout.trim() : stderr.trim());
    });
  });
}

/**
 * Extract last frame of a video using FFmpeg
 * @param {string} videoPath - Input MP4 path
 * @param {string} outputPath - Output JPG/PNG path
 * @returns {Promise<string>}
 */
async function extractLastFrame(rawVideoPath, rawOutputPath) {
  const videoPath = cleanFilePath(rawVideoPath);
  const outputPath = cleanFilePath(rawOutputPath);

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Try ffmpeg seek from end
  const cmd = `ffmpeg -y -sseof -0.2 -i "${videoPath}" -update 1 -q:v 2 "${outputPath}"`;
  try {
    await runCommand(cmd);
    if (fs.existsSync(outputPath)) {
      return outputPath;
    }
  } catch (err) {
    // Fallback ffmpeg command
    const fallbackCmd = `ffmpeg -y -i "${videoPath}" -vf "select='eq(n,gt(0))'" -vframes 1 "${outputPath}"`;
    await runCommand(fallbackCmd);
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error('Failed to extract last frame from video using FFmpeg');
  }

  return outputPath;
}

/**
 * Extract 2 keyframes from video for dual-input high resolution analysis
 */
async function extractKeyframes(videoPath, outputDir) {
  const frame1 = path.join(outputDir, `keyframe_1_${Date.now()}.png`);
  const frame2 = path.join(outputDir, `keyframe_2_${Date.now()}.png`);
  
  try {
    const cmd1 = `ffmpeg -y -ss 00:00:01 -i "${videoPath}" -vframes 1 "${frame1}"`;
    const cmd2 = `ffmpeg -y -ss 00:00:05 -i "${videoPath}" -vframes 1 "${frame2}"`;
    
    await Promise.allSettled([runCommand(cmd1), runCommand(cmd2)]);
    
    const frames = [];
    if (fs.existsSync(frame1)) frames.push(frame1);
    if (fs.existsSync(frame2)) frames.push(frame2);
    return frames;
  } catch (e) {
    console.warn("Could not extract keyframes:", e.message);
    return [];
  }
}

/**
 * Concatenate multiple MP4 files into a single MP4
 */
async function concatVideoSegments(videoPaths, outputPath) {
  if (!videoPaths || videoPaths.length === 0) {
    throw new Error("No video segments provided to concatenate");
  }

  if (videoPaths.length === 1) {
    fs.copyFileSync(videoPaths[0], outputPath);
    return outputPath;
  }

  const tempDir = path.dirname(outputPath);
  const listFilePath = path.join(tempDir, `concat_list_${Date.now()}.txt`);

  const listContent = videoPaths
    .map(p => `file '${p.replace(/\\/g, '/')}'`)
    .join('\n');

  fs.writeFileSync(listFilePath, listContent, 'utf8');

  const cmd = `ffmpeg -y -f concat -safe 0 -i "${listFilePath}" -c copy "${outputPath}"`;

  try {
    await runCommand(cmd);
  } finally {
    if (fs.existsSync(listFilePath)) {
      try { fs.unlinkSync(listFilePath); } catch (_) {}
    }
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error("FFmpeg failed to concatenate video segments.");
  }

  return outputPath;
}

/**
 * MASTER SYSTEM PROMPT FOR GEMINI VIDEO ANALYSIS
 */
const MASTER_VIDEO_CLONE_SYSTEM_PROMPT = `
You are a Master Professional Filmmaker, Executive Cinematographer, and Senior AI Video Prompt Engineer.
Your task is to analyze the input video with extreme professional precision down to the millisecond (ms), describing every tiny detail (lighting, micro-expressions, atmospheric physics, depth of field, surface textures, camera mechanics, audio-visual beats) while ensuring perfect cause-and-effect logical consistency.

YOUR TASK:
Analyze the input original video and break it down into sequential, continuous 10-second scenes (Scene index 0, Scene index 1, Scene index 2, etc.).

CONSTRAINTS & RULES:
1. Role: You are a professional filmmaker. Analyze every frame/millisecond with cinematic rigor. Describe every single detail—no matter how small—and ensure absolute physical and storyline logic.
2. Duration: Each scene MUST represent exactly 10 seconds of the original video timeline (0s-10s, 10s-20s, 20s-30s...).
3. Micro-beats: Break each 10s scene down into granular micro-beats in the "timeline" array (e.g., "0s-3s", "3s-6s", "6s-9s", "9s-10s").
4. Perform internal 4-step Chain-of-Thought reasoning:
   Step 1: Identify global visual art style, color palette, cinematic lighting, and lens physics.
   Step 2: Register all entities (humans, objects, vehicles, machinery, environment) in described_entities with micro-details.
   Step 3: Track precise millisecond-level movements, camera angles, lens choices, and action beats logic.
   Step 4: Synthesize a highly detailed, continuous, photorealistic text prompt for AI Video Generation.
5. Output STRICTLY VALID JSON. DO NOT wrap with markdown commentary outside the JSON.

OUTPUT JSON SCHEMA TEMPLATE:
[
  {
    "scene": {
      "duration": "10 seconds",
      "history_scene_index": 0,
      "timeline": [
        {
          "time": "0s-3s",
          "context": {
            "description": "<detailed_environment_and_lighting_description>"
          },
          "camera": {
            "shot": "<camera_shot_type_framing_lens_perspective_movement>"
          },
          "subjects": [
            {
              "name": "<subject_name>",
              "description": "<subject_position_appearance_and_expression>"
            }
          ],
          "objects": [
            {
              "name": "<object_name>",
              "state": "<object_initial_state_or_position>"
            }
          ],
          "visual_action": [
            {
              "actor": "<actor_name>",
              "action": "<detailed_action_movement_and_interaction>"
            }
          ],
          "sound": [
            {
              "sfx": "<sound_effect_description>"
            }
          ]
        }
      ],
      "prompt": "<comprehensive_video_generation_prompt_combining_subjects_actions_and_environment>",
      "style": "<visual_art_style_rendering_surface_color_palette_and_lighting>",
      "camera": "<master_camera_rules_focal_length_and_framing_constraints>",
      "rules": [
        "<dialogue_voiceover_and_action_constraints>"
      ]
    },
    "entity_context": {
      "described_entities": [
        {
          "name": "<entity_name>",
          "summary": "<short_entity_summary>",
          "type": "<human|creature|furniture|vehicle|machinery|outdoor|object>",
          "gender": "<gender_if_applicable>",
          "age": "<age_group_if_applicable>",
          "body": "<body_structure_or_build>",
          "skin": "<skin_or_surface_color>",
          "hair_color": "<hair_color>",
          "hair_style": "<hair_style>",
          "top": "<upper_clothing>",
          "bottom": "<lower_clothing>",
          "hat": "<headwear_if_applicable>",
          "distinctive": "<key_distinctive_visual_features>"
        }
      ]
    }
  }
]
`;

/**
 * Call Gemini API with video file and optional keyframes for multimodal analysis
 */
async function analyzeVideoWithGemini(apiKey, rawVideoPath, userCustomInstructions = '', geminiModel = null) {
  const videoPath = cleanFilePath(rawVideoPath);
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const selectedModel = geminiModel || 'gemini-3.1-flash-lite';
  const modelOptions = {
    model: selectedModel,
    generationConfig: {
      responseMimeType: 'application/json'
    },
    systemInstruction: MASTER_VIDEO_CLONE_SYSTEM_PROMPT
  };

  const contents = [];

  // 1. Read video file buffer as Base64 (or inlineData)
  const videoBuffer = fs.readFileSync(videoPath);
  const ext = path.extname(videoPath).toLowerCase();
  let mimeType = 'video/mp4';
  if (ext === '.webm') mimeType = 'video/webm';
  if (ext === '.mov') mimeType = 'video/quicktime';
  if (ext === '.avi') mimeType = 'video/x-msvideo';

  contents.push({
    inlineData: {
      data: videoBuffer.toString('base64'),
      mimeType: mimeType
    }
  });

  // 2. Extract high-res keyframes for Dual-Input context
  const tempDir = path.dirname(videoPath);
  const keyframePaths = await extractKeyframes(videoPath, tempDir);
  for (const kfPath of keyframePaths) {
    if (fs.existsSync(kfPath)) {
      const kfBuffer = fs.readFileSync(kfPath);
      contents.push({
        inlineData: {
          data: kfBuffer.toString('base64'),
          mimeType: 'image/png'
        }
      });
      // Clean up temp keyframe image
      try { fs.unlinkSync(kfPath); } catch (_) {}
    }
  }

  // 3. User prompt
  const userPrompt = `As a master professional filmmaker, analyze this video frame-by-frame down to the millisecond (ms). Describe every single visual, auditory, and cinematic detail, ensuring flawless physical and narrative logic across continuous 10-second scenes. Return a strictly valid JSON array matching the schema template. ${userCustomInstructions ? 'Additional user directives: ' + userCustomInstructions : ''}`;
  contents.push({ text: userPrompt });

  const { globalKeyPool } = require('./key_manager');
  const result = await globalKeyPool.executeWithRetry(apiKey, async (currentKey) => {
    const genAI = new GoogleGenerativeAI(currentKey);
    const model = genAI.getGenerativeModel(modelOptions);
    return await model.generateContent(contents);
  });

  const responseText = result.response.text();

  try {
    return JSON.parse(responseText);
  } catch (_) {
    const extracted = extractFirstJson(responseText);
    return JSON.parse(extracted);
  }
}

/**
 * STAGE 2: Enhance & Polish a single 10s scene prompt individually for maximum quality
 */
async function enhanceScenePrompt(apiKey, sceneData, targetGenerator = 'Veo/Sora', geminiModel = null) {
  const selectedModel = geminiModel || 'gemini-3.1-flash-lite';
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: selectedModel,
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  const enhancerSystemPrompt = `You are a Master AI Video Prompt Engineer for ${targetGenerator}.
Your job is to take raw timeline data and subjects from a 10s scene and synthesize an ultra-detailed, highly expressive, cinematic video generation prompt.
Focus on: photorealistic lighting, exact camera movement, camera lens, atmospheric depth, texture details, subject poses, and motion pacing.
Output JSON format:
{
  "enhanced_prompt": "Ultra-detailed master prompt in English for ${targetGenerator}",
  "negative_prompt": "Exclusion keywords to avoid morphing or artifacts",
  "camera_directive": "Exact camera movement instruction",
  "style_tags": "Lighting, rendering surface, and atmosphere tags"
}`;

  const userPrompt = `Refine and expand this 10-second scene data into an absolute top-tier video generation prompt:
${JSON.stringify(sceneData, null, 2)}`;

  const result = await model.generateContent([
    { text: enhancerSystemPrompt },
    { text: userPrompt }
  ]);

  const responseText = result.response.text();
  try {
    return JSON.parse(responseText);
  } catch (_) {
    const extracted = extractFirstJson(responseText);
    return JSON.parse(extracted);
  }
}

module.exports = {
  analyzeVideoWithGemini,
  enhanceScenePrompt,
  extractLastFrame,
  concatVideoSegments,
  MASTER_VIDEO_CLONE_SYSTEM_PROMPT
};

