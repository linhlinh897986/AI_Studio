import React, { useState, useEffect } from 'react';
import { Compass, Loader, AlertTriangle, BookOpen, Sun, Wind, Type, FileText, Upload, Sliders, Layers } from 'lucide-react';
import VideoPlayerPanel from './VideoPlayerPanel';

const { ipcRenderer } = window.require('electron');

/**
 * Align storyboard scenes with ASR text segments to compute startFrame and durationFrames
 */
function alignStoryboardWithSegments(storyboard, segments) {
  if (!segments || segments.length === 0) {
    const durationPerScene = 5000; // 5s fallback
    return storyboard.map((scene, idx) => ({
      startFrame: Math.round((idx * durationPerScene / 1000) * 30),
      durationFrames: Math.round((durationPerScene / 1000) * 30),
      text: scene.text
    }));
  }

  const slides = [];
  let currentSegIdx = 0;
  
  for (let i = 0; i < storyboard.length; i++) {
    const scene = storyboard[i];
    const sceneTextClean = scene.text.toLowerCase().replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, '');
    
    let sceneStartMs = null;
    let sceneEndMs = null;
    const isLastScene = (i === storyboard.length - 1);
    
    while (currentSegIdx < segments.length) {
      const seg = segments[currentSegIdx];
      const segTextClean = seg.text.toLowerCase().replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, '');
      
      if (sceneStartMs === null) {
        sceneStartMs = seg.start_time;
      }
      sceneEndMs = seg.end_time;
      
      if (isLastScene) {
        currentSegIdx++;
        continue;
      }
      
      const nextSeg = segments[currentSegIdx + 1];
      if (nextSeg) {
        const nextSegTextClean = nextSeg.text.toLowerCase().replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, '');
        const nextScene = storyboard[i + 1];
        const nextSceneTextClean = nextScene.text.toLowerCase().replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, '');
        
        const matchesNextScene = nextSceneTextClean.includes(nextSegTextClean) || 
                                 (nextSegTextClean.length > 3 && nextSceneTextClean.indexOf(nextSegTextClean.substring(0, Math.min(10, nextSegTextClean.length))) !== -1);
        
        if (matchesNextScene) {
          currentSegIdx++;
          break;
        }
      }
      currentSegIdx++;
    }
    
    if (sceneStartMs === null) {
      sceneStartMs = i > 0 ? (slides[i - 1].startFrame + slides[i - 1].durationFrames) * 1000 / 30 : 0;
      sceneEndMs = sceneStartMs + 3000;
    }
    
    const startFrame = Math.round((sceneStartMs / 1000) * 30);
    const durationFrames = Math.max(15, Math.round(((sceneEndMs - sceneStartMs) / 1000) * 30));
    
    slides.push({
      startFrame,
      durationFrames,
      text: scene.text
    });
  }
  
  // Connect frames to fill all visual timeline gaps
  for (let i = 0; i < slides.length - 1; i++) {
    const nextStart = slides[i + 1].startFrame;
    slides[i].durationFrames = Math.max(15, nextStart - slides[i].startFrame);
  }
  
  return slides;
}


const CURATED_PDFS = [
  {
    title: "Kinh Địa Tạng Bồ Tát Bổn Nguyện (HT. Thích Trí Tịnh dịch)",
    localFile: "kinh_dia_tang.pdf",
    url: "https://www.daotranglienhoa.com/wp-content/uploads/2020/05/Kinh-Dia-Tang-HT-Thich-Tri-Tinh.pdf",
    desc: "Bộ kinh nổi tiếng về chữ hiếu, công đức độ sanh và thế giới u minh."
  },
  {
    title: "Kinh Diệu Pháp Liên Hoa (Kinh Pháp Hoa - HT. Thích Trí Tịnh)",
    localFile: "kinh_phap_hoa.pdf",
    url: "https://www.daotranglienhoa.com/wp-content/uploads/2020/05/Kinh-Phap-Hoa-HT-Thich-Tri-Tinh.pdf",
    desc: "Vua của các kinh điển Đại Thừa, khai mở tri kiến Phật cho mọi chúng sinh."
  },
  {
    title: "Kinh Pháp Cú (Dhammapada - Lời Vàng Ấn Tống)",
    localFile: "k21-423_loi_vang_cua_phat_an_tong_co_bia.pdf",
    url: "https://daotranglienhoa.com/wp-content/uploads/2020/05/Kinh-Phap-Cu-HT-Thich-Minh-Chau.pdf",
    desc: "423 câu thi kệ ngắn gọn chứa đựng tinh hoa triết lý giải thoát."
  },
  {
    title: "Kinh Kim Cang Bát Nhã Ba La Mật (HT. Thích Trí Tịnh dịch)",
    localFile: "kinh_kim_cang.pdf",
    url: "https://www.daotranglienhoa.com/wp-content/uploads/2020/05/Kinh-Kim-Cang-HT-Thich-Tri-Tinh.pdf",
    desc: "Kinh điển tối thượng luận giải về tính Không và trí tuệ giải thoát."
  },
  {
    title: "Kinh A Di Đà (Kinh A Di Đà Có Bìa)",
    localFile: "k09-kinh_a_di_da_co_bia.pdf",
    url: "https://www.daotranglienhoa.com/wp-content/uploads/2020/05/Kinh-A-Di-Da-HT-Thich-Tri-Tinh.pdf",
    desc: "Kinh điển nền tảng hướng tâm về thế giới Tây Phương Cực Lạc thanh tịnh."
  },
  {
    title: "Bước Đầu Học Phật (HT. Thích Thanh Từ)",
    localFile: "buocdauhocphat.pdf",
    url: "https://thuvienhoasen.org/images/file/GKrurg03GkzWjACY/buoc-dau-hoc-phat.pdf",
    desc: "Cẩm nang hướng dẫn căn bản về nhân quả, tu tập thiền định."
  }
];

export default function BuddhistTab({ 
  onLog, 
  registerProcess = () => {}, 
  updateProcess = () => {}, 
  addProcessLog = () => {} 
}) {
  // Batch video configuration
  const [numVideos, setNumVideos] = useState(1); // 1, 5, 10, 15
  const [videoDuration, setVideoDuration] = useState(3); // minutes: 2, 3, 5, 8, 10, 15
  const [selectedRefKey, setSelectedRefKey] = useState('free'); // free, local, or index of CURATED_PDFS
  const [manualImageSelect, setManualImageSelect] = useState(false);

  // Duration → approximate syllable count (tiếng) at slow meditation speed (~130 syllables/min)
  const DURATION_SYLLABLE_MAP = { 0.5: 65, 3: 400, 5: 650, 10: 1300, 15: 1950, 30: 3900, 60: 7800, 120: 15600, 180: 23400 };
  
  const [sourceType, setSourceType] = useState('prompt'); // prompt, pdf
  const [topic, setTopic] = useState('');
  const [voice, setVoice] = useState('vi-VN-NamMinhNeural');
  const [refAudioPath, setRefAudioPath] = useState('');
  const [bgMusic, setBgMusic] = useState('');
  const [scriptStyle, setScriptStyle] = useState('accessible'); // accessible, philosophical
  
  // Custom mechanisms states

  const [particleType, setParticleType] = useState('dust');
  const [subtitleStyle, setSubtitleStyle] = useState('lotus-gold');
  const [subtitleY, setSubtitleY] = useState(220);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [bgMusicVolume, setBgMusicVolume] = useState(0.15);


  // PDF specific states
  const [pdfFile, setPdfFile] = useState(null); // { name, path, url, localFile }

  // Core generator states
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState('');

  // Batch rendering states
  const [batchLogs, setBatchLogs] = useState([]);
  const [currentBatchIdx, setCurrentBatchIdx] = useState(null); // null if not batching

  // Image Selection Modal States
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImages, setModalImages] = useState([]);
  const [imageSelectCallback, setImageSelectCallback] = useState(null);

  // Preview panel states (corresponds to the currently loaded/generated video)
  const [slides, setSlides] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [audioUrl, setAudioUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [aspectRatio, setAspectRatio] = useState('9:16'); // '9:16' or '16:9'

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  
  const [localMusicFiles, setLocalMusicFiles] = useState([]);
  const [musicFolderPath, setMusicFolderPath] = useState('');

  // Multi-Agent and Storyboard layout states
  const [writingMode, setWritingMode] = useState('agentic'); // standard, agentic
  const [videoLayout, setVideoLayout] = useState('storyboard'); // static, storyboard
  const [currentAgentProgress, setCurrentAgentProgress] = useState(null); // { agent, status, message }
  const [allAgentLogs, setAllAgentLogs] = useState(null); // Stores the agent outputs object
  const [showAgentLogsModal, setShowAgentLogsModal] = useState(false);


  // Fetch local music files from resources/music folder on mount
  useEffect(() => {
    const fetchLocalMusic = async () => {
      try {
        const res = await ipcRenderer.invoke('list-local-music');
        if (res.success) {
          if (Array.isArray(res.musicFiles)) {
            setLocalMusicFiles(res.musicFiles);
            if (res.musicFiles.length > 0) {
              setBgMusic(res.musicFiles[0].fileUrl);
            }
          }
          if (res.musicDir) {
            setMusicFolderPath(res.musicDir);
          }
        }
      } catch (e) {
        console.error('Failed to load local music list:', e);
      }
    };
    fetchLocalMusic();
  }, []);

  const handleOpenMusicFolder = async () => {
    if (!musicFolderPath) return;
    try {
      await ipcRenderer.invoke('open-path', { filePath: musicFolderPath });
    } catch (e) {
      alert(`Không thể mở thư mục nhạc: ${e.message}`);
    }
  };

  const handleSelectRefAudio = async () => {
    try {
      const res = await ipcRenderer.invoke('select-audio-file');
      if (res.success) {
        setRefAudioPath(res.filePath);
      }
    } catch (err) {
      console.error('Failed to select audio file:', err);
    }
  };

  // Handle reference material dropdown change
  const handleRefMaterialChange = async (val) => {
    setSelectedRefKey(val);
    if (val === 'free') {
      setSourceType('prompt');
      setPdfFile(null);
    } else if (val === 'local') {
      setSourceType('pdf');
      await handleLoadLocalPdf();
    } else {
      setSourceType('pdf');
      const idx = parseInt(val);
      const item = CURATED_PDFS[idx];
      if (item) {
        await handleLoadCuratedPdf(item);
      }
    }
  };

  const handleLoadLocalPdf = async () => {
    setError('');
    try {
      const res = await ipcRenderer.invoke('open-pdf-dialog');
      if (!res.success) {
        setSelectedRefKey('free');
        setSourceType('prompt');
        if (res.error !== 'Cancelled') setError(res.error);
        return;
      }
      const filePath = res.filePath;
      onLog('Buddhist', `Đã chọn tệp PDF cục bộ: ${filePath.split('\\').pop()}`, 'info');
      setPdfFile({ name: filePath.split('\\').pop(), path: filePath });
    } catch (e) {
      setError(`Lỗi chọn file PDF: ${e.message}`);
      setSelectedRefKey('free');
      setSourceType('prompt');
    }
  };

  const handleLoadCuratedPdf = async (pdfItem) => {
    setError('');
    setPdfFile({ name: pdfItem.title, url: pdfItem.url, localFile: pdfItem.localFile });
    onLog('Buddhist', `Đã chọn tài liệu Kinh điển: "${pdfItem.title}"`, 'info');
  };

  // Triggers generation (runs loop for batch mode)
  const handleGenerate = async () => {
    if (sourceType === 'prompt' && !topic) {
      setError('Vui lòng nhập ý tưởng chủ đề.');
      return;
    }
    if (sourceType === 'pdf' && !pdfFile) {
      setError('Vui lòng chọn tài liệu tham khảo.');
      return;
    }

    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      setError('Vui lòng cấu hình Gemini API Key trong Tab Cấu Hình trước.');
      return;
    }

    setLoading(true);
    setError('');
    setBatchLogs([]);

    const totalToGenerate = numVideos;
    onLog('Buddhist', `Bắt đầu tiến trình tạo BATCH gồm ${totalToGenerate} video...`, 'info');

    // Pre-check Vibes.ai token status before starting if meta_vibes is selected
    const imageGenSource = localStorage.getItem('image_gen_source') || 'meta_direct';
    if (imageGenSource === 'meta_vibes') {
      const vibesCookie = localStorage.getItem('vibes_meta_session') || '';
      if (vibesCookie) {
        onLog('Buddhist', 'Đang kiểm tra trạng thái hoạt động của tài khoản Vibes.ai...', 'info');
        try {
          const checkRes = await ipcRenderer.invoke('check-vibes-token', { metaSession: vibesCookie });
          if (checkRes.success) {
            onLog('Buddhist', `Tài khoản Vibes.ai hợp lệ! (Người dùng: ${checkRes.username})`, 'success');
          } else {
            onLog('Buddhist', `Tài khoản Vibes.ai không khả dụng: ${checkRes.error}`, 'warning');
            const proceed = confirm(`⚠️ Token Vibes.ai đã hết hạn hoặc không hợp lệ: "${checkRes.error}"\n\nBạn có muốn tự động chuyển sang chế độ sử dụng bộ vẽ ảnh dự phòng miễn phí (Pollinations.ai) không?`);
            if (!proceed) {
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          onLog('Buddhist', `Lỗi kiểm tra Vibes.ai: ${err.message}`, 'warning');
        }
      }
    }

    try {
      const geminiModel = localStorage.getItem('gemini_model') || 'gemini-3.1-flash-lite';
      const pdfFilePath = sourceType === 'pdf' ? (pdfFile?.path || pdfFile?.localFile || null) : null;

      // ── BƯỚC 1: Lập kế hoạch & Hoạch định danh sách chủ đề ──────────────────
      const planProcessId = `buddhist-plan-${Date.now()}`;
      registerProcess(planProcessId, `[Khởi tạo] Phân tích tài liệu & Hoạch định ${totalToGenerate} video`, 'buddhist');
      addProcessLog(planProcessId, `Bắt đầu tiến trình sản xuất BATCH ${totalToGenerate} video...`, 'info');
      addProcessLog(planProcessId, `Đang phân tích tài liệu & gửi yêu cầu lên kế hoạch nội dung tới Gemini AI...`, 'info');

      setLoadingStage(`Đang phân tích tài liệu và hoạch định ${totalToGenerate} chủ đề cho loạt video...`);
      
      let usedIdeasContext = '';
      try {
        const readRes = await ipcRenderer.invoke('read-used-ideas');
        if (readRes.success && readRes.content) {
          usedIdeasContext = `\n\nDANH SÁCH CÁC CHỦ ĐỀ/Ý TƯỞNG ĐÃ SẢN XUẤT TRONG QUÁ KHỨ (TUYỆT ĐỐI NÉ TRÁNH TRÙNG LẶP HOẶC TƯƠNG TỰ CÁC CHỦ ĐỀ NÀY):\n${readRes.content}\n`;
        }
      } catch (readErr) {
        console.error("Lỗi đọc lịch sử ý tưởng:", readErr);
      }

      const step1System = `Bạn là một thiền sư hiền triết, am hiểu Phật Pháp sâu sắc. Hãy lập kế hoạch và phân chia chủ đề cho loạt video bài giảng ngắn. Trả về cấu trúc JSON bắt buộc.`;
      
      let step1Prompt = '';
      if (sourceType === 'prompt') {
        step1Prompt = `Tôi muốn sản xuất một loạt gồm ${totalToGenerate} video thiền ngắn độc lập xoay quanh chủ đề chính: "${topic}".
${usedIdeasContext}
Hãy lên hoạch định chi tiết đề xuất đúng ${totalToGenerate} khía cạnh/góc nhìn/chủ đề phụ riêng biệt, hoàn toàn không trùng lặp ý tưởng với nhau và tuyệt đối không trùng lặp với danh sách các chủ đề đã sản xuất trong quá khứ ở trên.
Trả về duy nhất định dạng JSON có cấu trúc sau:
{
  "topics": [
    {
      "index": 1,
      "title": "Tiêu đề ngắn gọn cho video (khoảng 5-8 từ)",
      "description": "Mô tả khía cạnh cụ thể mà video này sẽ tập trung truyền tải"
    }
  ]
}`;
      } else {
        step1Prompt = `Tôi muốn sản xuất một loạt gồm ${totalToGenerate} video Phật pháp ngắn độc lập dựa trên tài liệu đính kèm.
${topic.trim() ? `Hãy ưu tiên xoay quanh định hướng/chủ đề sau: "${topic}".` : ''}
${usedIdeasContext}
Hãy phân tích kỹ tài liệu đính kèm và đề xuất đúng ${totalToGenerate} chủ đề/ý tưởng bài giảng riêng biệt, sâu sắc, hoàn toàn không trùng lặp ý tưởng với nhau và tuyệt đối không trùng lặp với danh sách các chủ đề đã sản xuất trong quá khứ ở trên.
Trả về duy nhất định dạng JSON có cấu trúc sau:
{
  "topics": [
    {
      "index": 1,
      "title": "Tiêu đề ngắn gọn cho video (khoảng 5-8 từ)",
      "description": "Mô tả khía cạnh hoặc lĩnh vực bài giảng cụ thể"
    }
  ]
}`;
      }

      const step1Res = await ipcRenderer.invoke('gemini-generate', {
        apiKey,
        systemPrompt: step1System,
        userPrompt: step1Prompt,
        geminiModel,
        pdfFilePath
      });

      if (!step1Res.success) {
        updateProcess(planProcessId, { status: 'failed', error: step1Res.error });
        addProcessLog(planProcessId, `Lỗi hoạch định chủ đề: ${step1Res.error}`, 'error');
        throw new Error(`Lỗi lập kế hoạch chủ đề: ${step1Res.error}`);
      }

      const plannedTopics = step1Res.data.topics;
      if (!Array.isArray(plannedTopics) || plannedTopics.length === 0) {
        const noTopicsErr = "Không nhận được danh sách hoạch định chủ đề từ AI.";
        updateProcess(planProcessId, { status: 'failed', error: noTopicsErr });
        addProcessLog(planProcessId, noTopicsErr, 'error');
        throw new Error(noTopicsErr);
      }

      updateProcess(planProcessId, { status: 'success', progress: 100, stage: 'Hoạch định thành công!' });
      addProcessLog(planProcessId, `Lập kế hoạch thành công! Đã tạo ${plannedTopics.length} chủ đề độc lập.`, 'success');
      onLog('Buddhist', `Lập kế hoạch thành công! Đã lên danh sách ${plannedTopics.length} chủ đề độc lập.`, 'success');

      // ── BƯỚC 2: Tự động chạy Hàng Đợi Song Song Tối Ưu (Decoupled Batch Queue Engine) ───
      const withRetry = async (fn, retries = 3, delay = 1500) => {
        let lastErr;
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            return await fn();
          } catch (err) {
            lastErr = err;
            if (attempt < retries) {
              await new Promise(r => setTimeout(r, delay * Math.pow(1.5, attempt - 1)));
            }
          }
        }
        throw lastErr;
      };

      if (totalToGenerate === 1) {
        // Single video mode
        const i = 0;
        setCurrentBatchIdx(i);
        const stagePrefix = `[Video 1/1]`;
        const currentTopic = plannedTopics[0];
        const processId = `buddhist-single-${Date.now()}`;
        registerProcess(processId, `[Video 1/1] ${currentTopic.title}`, 'buddhist');
        addProcessLog(processId, `Bắt đầu xử lý chủ đề: "${currentTopic.title}"`, 'info');

        let generatedData = [];
        let geminiResData = null;

        if (writingMode === 'agentic') {
          setLoadingStage(`${stagePrefix} Khởi chạy quy trình Multi-Agent...`);
          updateProcess(processId, { progress: 10, stage: 'Đang chạy 1 API Request...' });

          const progressListener = (event, progressData) => {
            setCurrentAgentProgress(progressData);
            const statusIcon = progressData.status === 'success' ? '✅' : '⏳';
            addProcessLog(processId, `[${progressData.agent}] ${statusIcon} ${progressData.message}`, progressData.status === 'success' ? 'success' : 'info');
            setLoadingStage(`${stagePrefix} [${progressData.agent}] ${progressData.message}`);
          };
          ipcRenderer.on('script-agent-progress', progressListener);

          const agenticRes = await ipcRenderer.invoke('gemini-agentic-generate', {
            apiKey, topic: currentTopic.title, geminiModel, pdfFilePath, duration: videoDuration, style: scriptStyle, aspectRatio, videoLayout
          });
          ipcRenderer.removeListener('script-agent-progress', progressListener);

          if (!agenticRes.success) throw new Error(agenticRes.error);
          geminiResData = agenticRes.data;
          generatedData = geminiResData.script;
          setAllAgentLogs(geminiResData.agentLogs);
        } else {
          setLoadingStage(`${stagePrefix} AI đang biên soạn kịch bản chi tiết...`);
          updateProcess(processId, { progress: 10, stage: 'AI đang biên soạn kịch bản...' });
          
          const systemPrompt = `Bạn là nhà biên kịch xuất sắc chuyên viết kịch bản video ngắn. Trả về JSON.`;
          const targetSyllables = DURATION_SYLLABLE_MAP[videoDuration] || 400;
          const durText = videoDuration === 0.5 ? '30 giây' : `${videoDuration} phút`;
          const styleInstruction = scriptStyle === 'accessible' ? `- GIỌNG VĂN: Bình dị.` : `- GIỌNG VĂN: Triết lý.`;

          const userPrompt = `Hãy viết một bài giảng thiền liền mạch (khoảng ${targetSyllables} âm tiết) về chủ đề: ${currentTopic.title}. ${styleInstruction}`;
          const geminiRes = await ipcRenderer.invoke('gemini-generate', { apiKey, systemPrompt, userPrompt, geminiModel, pdfFilePath });
          if (!geminiRes.success) throw new Error(geminiRes.error);
          geminiResData = geminiRes.data;
          generatedData = geminiResData.script;
        }

        // Voice
        setLoadingStage(`${stagePrefix} Đang lồng tiếng thiền sư...`);
        updateProcess(processId, { progress: 30, stage: 'Đang lồng tiếng thiền sư...' });
        const fullText = generatedData.map(item => item.text).join(' ');
        const colabApiUrl = localStorage.getItem('colab_api_url') || '';
        const ttsRes = await ipcRenderer.invoke('edge-tts-synthesize', { text: fullText, options: { voice, rate: '-15%', refAudioPath, colabApiUrl } });
        if (!ttsRes.success) throw new Error(ttsRes.error);
        const localAudioUrl = ttsRes.filePath;

        // ASR
        setLoadingStage(`${stagePrefix} Đang chạy phụ đề karaoke...`);
        updateProcess(processId, { progress: 50, stage: 'Đang chạy phụ đề karaoke...' });
        const asrRes = await ipcRenderer.invoke('capcut-asr-transcribe', { audioPath: localAudioUrl, options: { language: 'vi-VN', needWordTimestamp: true } });
        if (!asrRes.success) throw new Error(asrRes.error);
        const asrSegments = asrRes.segments;

        // Images
        const imageGenSource = localStorage.getItem('image_gen_source') || 'meta_direct';
        const localImages = [];
        const storyboard = (writingMode === 'agentic' && videoLayout === 'storyboard')
          ? geminiResData.storyboard
          : [{ sceneIndex: 1, text: fullText, imagePrompt: (geminiResData.imagePrompt || (geminiResData.storyboard?.[0]?.imagePrompt) || 'a serene Buddha meditating, vertical 9:16') }];

        for (let sIdx = 0; sIdx < storyboard.length; sIdx++) {
          const scene = storyboard[sIdx];
          const ratioPrompt = aspectRatio === '16:9' ? 'horizontal aspect ratio, 16:9 landscape' : 'vertical aspect ratio, 9:16 portrait';
          const formattedPrompt = `${scene.imagePrompt}, ${ratioPrompt}, photorealistic, highly detailed`;
          const imgWidth = aspectRatio === '16:9' ? 1920 : 1080;
          const imgHeight = aspectRatio === '16:9' ? 1080 : 1920;
          let imagePath = '';

          if (imageGenSource === '9router') {
            try {
              const nrRes = await ipcRenderer.invoke('ninerouter-generate-image', { prompt: formattedPrompt });
              if (nrRes.success) imagePath = nrRes.localPaths[0];
              else throw new Error(nrRes.error);
            } catch (e) {
              const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(formattedPrompt)}?width=${imgWidth}&height=${imgHeight}&nologo=true`;
              const dlRes = await ipcRenderer.invoke('download-image', { imageUrl: pollinationsUrl });
              if (dlRes.success) imagePath = dlRes.filePath;
              else throw new Error(dlRes.error);
            }
          } else if (imageGenSource === 'meta_direct') {
            try {
              const cookieText = localStorage.getItem('meta_direct_cookie') || '';
              const metaRes = await ipcRenderer.invoke('meta-direct-generate-image', { prompt: formattedPrompt, cookieText });
              if (metaRes.success) imagePath = metaRes.localPaths[0];
              else throw new Error(metaRes.error);
            } catch (e) {
              const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(formattedPrompt)}?width=${imgWidth}&height=${imgHeight}&nologo=true`;
              const dlRes = await ipcRenderer.invoke('download-image', { imageUrl: pollinationsUrl });
              if (dlRes.success) imagePath = dlRes.filePath;
              else throw new Error(dlRes.error);
            }
          } else {
            try {
              const vibesCookie = localStorage.getItem('vibes_meta_session') || '';
              const vibeRes = await ipcRenderer.invoke('vibes-generate-image', { prompt: formattedPrompt, metaSession: vibesCookie });
              if (vibeRes.success) {
                let selectedImagePath = vibeRes.localPaths[0];
                if (manualImageSelect && vibeRes.localPaths.length > 1) {
                  selectedImagePath = await new Promise((resolve) => {
                    setModalImages(vibeRes.localPaths);
                    setShowImageModal(true);
                    setImageSelectCallback(() => (fp) => {
                      setShowImageModal(false);
                      resolve(fp);
                    });
                  });
                }
                imagePath = selectedImagePath;
                ipcRenderer.invoke('vibes-delete-project', { projectId: vibeRes.projectId, metaSession: vibesCookie });
              } else throw new Error(vibeRes.error);
            } catch (e) {
              const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(formattedPrompt)}?width=${imgWidth}&height=${imgHeight}&nologo=true`;
              const dlRes = await ipcRenderer.invoke('download-image', { imageUrl: pollinationsUrl });
              if (dlRes.success) imagePath = dlRes.filePath;
              else throw new Error(dlRes.error);
            }
          }
          localImages.push(imagePath);
        }

        const lastWordSeg = asrSegments[asrSegments.length - 1];
        const audioDurationMs = lastWordSeg ? lastWordSeg.end_time : 15000;
        const audioDurationFrames = Math.ceil((audioDurationMs / 1000) * 30);

        let computedSlides = [];
        if (writingMode === 'agentic' && videoLayout === 'storyboard') {
          computedSlides = alignStoryboardWithSegments(storyboard, asrSegments);
          computedSlides = computedSlides.map((slide, sIdx) => ({ ...slide, imageUrl: localImages[sIdx] || localImages[0] || '' }));
        } else {
          computedSlides = [{ imageUrl: localImages[0] || '', startFrame: 0, durationFrames: audioDurationFrames }];
        }

        setSlides(computedSlides);
        setSubtitles(asrSegments);
        setAudioUrl(localAudioUrl);
        setVideoTitle(currentTopic.title);

        updateProcess(processId, { status: 'success', progress: 100, stage: 'Khởi tạo thành công!' });
        onLog('Buddhist', `Khởi tạo video Phật pháp thành công! Nhấp 'Xuất Video MP4' ở bên phải để lưu file.`, 'success');
        setShowPreview(true);

      } else {
        // 🚀 BULK BATCH PARALLEL PIPELINE FOR 2+ VIDEOS
        setLoadingStage(`⚡ Đang khởi chạy quy trình sản xuất hàng loạt ${totalToGenerate} video (Chạy song song tối ưu)...`);
        onLog('Buddhist', `⚡ Đang chạy quy trình sản xuất hàng loạt ${totalToGenerate} video song song...`, 'info');

        const CONCURRENCY_LIMIT = 2; // Run 2 parallel media prep tasks
        const completedResults = [];
        const renderQueue = [];
        let isRendering = false;

        // Render Queue Worker
        const processRenderQueue = async () => {
          if (isRendering || renderQueue.length === 0) return;
          isRendering = true;

          while (renderQueue.length > 0) {
            const item = renderQueue.shift();
            const { processId, stagePrefix, inputProps, index, title } = item;

            try {
              updateProcess(processId, { progress: 80, stage: 'Đang kết xuất Remotion MP4...' });
              addProcessLog(processId, `${stagePrefix} Đang tiến hành kết xuất Remotion MP4...`, 'info');
              onLog('Buddhist', `${stagePrefix} Bắt đầu kết xuất MP4...`, 'info');

              const progressListener = (event, progress) => {
                const percent = Math.floor(progress.percent * 100);
                const remotionProgress = 80 + Math.floor(percent * 0.19);
                updateProcess(processId, { progress: remotionProgress, stage: `Đang render MP4 (${percent}%)...` });
              };

              ipcRenderer.on('render-progress', progressListener);
              const renderRes = await ipcRenderer.invoke('remotion-render', { inputProps, compositionId: 'BuddhistVideo' });
              ipcRenderer.removeListener('render-progress', progressListener);

              if (renderRes.success) {
                const resultObj = { success: true, path: renderRes.filePath, title, index };
                completedResults.push(resultObj);
                updateProcess(processId, { status: 'success', progress: 100, stage: 'Hoàn thành!', outputPath: renderRes.filePath });
                addProcessLog(processId, `${stagePrefix} Xuất MP4 thành công: ${renderRes.filePath}`, 'success');
                onLog('Buddhist', `${stagePrefix} Kết xuất MP4 thành công! Tệp: ${renderRes.filePath}`, 'success');
              } else {
                const resultObj = { success: false, error: renderRes.error, title, index };
                completedResults.push(resultObj);
                updateProcess(processId, { status: 'failed', error: renderRes.error });
                addProcessLog(processId, `${stagePrefix} Lỗi kết xuất MP4: ${renderRes.error}`, 'error');
                onLog('Buddhist', `${stagePrefix} Lỗi kết xuất MP4: ${renderRes.error}`, 'error');
              }
            } catch (rErr) {
              const resultObj = { success: false, error: rErr.message, title, index };
              completedResults.push(resultObj);
              updateProcess(processId, { status: 'failed', error: rErr.message });
            }

            setBatchLogs([...completedResults]);
          }
          isRendering = false;
        };

        // Media Prep Task Runner for individual video
        const runMediaPrepForItem = async (i) => {
          const stagePrefix = `[Video ${i + 1}/${totalToGenerate}]`;
          const currentTopic = plannedTopics[i % plannedTopics.length];
          const processId = `buddhist-batch-${Date.now()}-${i}`;
          registerProcess(processId, `[Video ${i + 1}/${totalToGenerate}] ${currentTopic.title}`, 'buddhist');
          addProcessLog(processId, `Bắt đầu sản xuất media: "${currentTopic.title}"`, 'info');
          onLog('Buddhist', `${stagePrefix} Chuẩn bị kịch bản & media cho chủ đề: "${currentTopic.title}"...`, 'info');

          try {
            // 1. Scripting (with Retry)
            let generatedData = [];
            let geminiResData = null;

            const geminiRes = await withRetry(async () => {
              if (writingMode === 'agentic') {
                return await ipcRenderer.invoke('gemini-agentic-generate', {
                  apiKey, topic: currentTopic.title, geminiModel, pdfFilePath, duration: videoDuration, style: scriptStyle, aspectRatio, videoLayout
                });
              } else {
                const systemPrompt = `Bạn là nhà biên kịch xuất sắc... Trả về JSON.`;
                const targetSyllables = DURATION_SYLLABLE_MAP[videoDuration] || 400;
                const durText = videoDuration === 0.5 ? '30 giây' : `${videoDuration} phút`;
                const styleInstruction = scriptStyle === 'accessible' ? `- GIỌNG VĂN: Bình dị.` : `- GIỌNG VĂN: Triết lý.`;
                const userPrompt = `Hãy viết một bài giảng thiền liền mạch (khoảng ${targetSyllables} âm tiết) về chủ đề: ${currentTopic.title}. ${styleInstruction}`;
                return await ipcRenderer.invoke('gemini-generate', { apiKey, systemPrompt, userPrompt, geminiModel, pdfFilePath });
              }
            }, 3);

            if (!geminiRes.success) throw new Error(geminiRes.error);
            geminiResData = geminiRes.data;
            generatedData = geminiResData.script;

            // 2. TTS Voice (with Retry)
            const fullText = generatedData.map(item => item.text).join(' ');
            const colabApiUrl = localStorage.getItem('colab_api_url') || '';
            const ttsRes = await withRetry(async () => {
              return await ipcRenderer.invoke('edge-tts-synthesize', {
                text: fullText,
                options: { voice, rate: '-15%', refAudioPath, colabApiUrl }
              });
            }, 3);

            if (!ttsRes.success) throw new Error(ttsRes.error);
            const localAudioUrl = ttsRes.filePath;

            // 3. ASR Syncing (with Retry)
            const asrRes = await withRetry(async () => {
              return await ipcRenderer.invoke('capcut-asr-transcribe', {
                audioPath: localAudioUrl,
                options: { language: 'vi-VN', needWordTimestamp: true }
              });
            }, 3);

            if (!asrRes.success) throw new Error(asrRes.error);
            const asrSegments = asrRes.segments;

            // 4. Image Generation
            const imageGenSource = localStorage.getItem('image_gen_source') || 'meta_direct';
            const localImages = [];
            const storyboard = (writingMode === 'agentic' && videoLayout === 'storyboard')
              ? geminiResData.storyboard
              : [{ sceneIndex: 1, text: fullText, imagePrompt: (geminiResData.imagePrompt || (geminiResData.storyboard?.[0]?.imagePrompt) || 'a serene Buddha meditating, vertical 9:16') }];

            for (let sIdx = 0; sIdx < storyboard.length; sIdx++) {
              const scene = storyboard[sIdx];
              const ratioPrompt = aspectRatio === '16:9' ? 'horizontal aspect ratio, 16:9 landscape' : 'vertical aspect ratio, 9:16 portrait';
              const formattedPrompt = `${scene.imagePrompt}, ${ratioPrompt}, photorealistic, highly detailed`;
              const imgWidth = aspectRatio === '16:9' ? 1920 : 1080;
              const imgHeight = aspectRatio === '16:9' ? 1080 : 1920;
              let imagePath = '';

              if (imageGenSource === '9router') {
                try {
                  const nrRes = await ipcRenderer.invoke('ninerouter-generate-image', { prompt: formattedPrompt });
                  if (nrRes.success) imagePath = nrRes.localPaths[0];
                  else throw new Error(nrRes.error);
                } catch (e) {
                  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(formattedPrompt)}?width=${imgWidth}&height=${imgHeight}&nologo=true`;
                  const dlRes = await ipcRenderer.invoke('download-image', { imageUrl: pollinationsUrl });
                  if (dlRes.success) imagePath = dlRes.filePath;
                  else throw new Error(dlRes.error);
                }
              } else if (imageGenSource === 'meta_direct') {
                try {
                  const cookieText = localStorage.getItem('meta_direct_cookie') || '';
                  const metaRes = await ipcRenderer.invoke('meta-direct-generate-image', { prompt: formattedPrompt, cookieText });
                  if (metaRes.success) imagePath = metaRes.localPaths[0];
                  else throw new Error(metaRes.error);
                } catch (e) {
                  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(formattedPrompt)}?width=${imgWidth}&height=${imgHeight}&nologo=true`;
                  const dlRes = await ipcRenderer.invoke('download-image', { imageUrl: pollinationsUrl });
                  if (dlRes.success) imagePath = dlRes.filePath;
                  else throw new Error(dlRes.error);
                }
              } else {
                try {
                  const vibesCookie = localStorage.getItem('vibes_meta_session') || '';
                  const vibeRes = await ipcRenderer.invoke('vibes-generate-image', { prompt: formattedPrompt, metaSession: vibesCookie });
                  if (vibeRes.success) {
                    imagePath = vibeRes.localPaths[0];
                    ipcRenderer.invoke('vibes-delete-project', { projectId: vibeRes.projectId, metaSession: vibesCookie });
                  } else throw new Error(vibeRes.error);
                } catch (e) {
                  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(formattedPrompt)}?width=${imgWidth}&height=${imgHeight}&nologo=true`;
                  const dlRes = await ipcRenderer.invoke('download-image', { imageUrl: pollinationsUrl });
                  if (dlRes.success) imagePath = dlRes.filePath;
                  else throw new Error(dlRes.error);
                }
              }
              localImages.push(imagePath);
            }

            // 5. Slides
            const lastWordSeg = asrSegments[asrSegments.length - 1];
            const audioDurationMs = lastWordSeg ? lastWordSeg.end_time : 15000;
            const audioDurationFrames = Math.ceil((audioDurationMs / 1000) * 30);

            let computedSlides = [];
            if (writingMode === 'agentic' && videoLayout === 'storyboard') {
              computedSlides = alignStoryboardWithSegments(storyboard, asrSegments);
              computedSlides = computedSlides.map((slide, sIdx) => ({ ...slide, imageUrl: localImages[sIdx] || localImages[0] || '' }));
            } else {
              computedSlides = [{ imageUrl: localImages[0] || '', startFrame: 0, durationFrames: audioDurationFrames }];
            }

            return {
              success: true,
              processId,
              stagePrefix,
              index: i,
              title: currentTopic.title,
              inputProps: {
                slides: computedSlides,
                subtitles: asrSegments,
                audioUrl: localAudioUrl,
                bgMusicUrl: bgMusic,
                type: 'buddhist',
                shopeeProps: { particleType, subtitleStyle, subtitleY, voiceVolume, bgMusicVolume, aspectRatio }
              }
            };

          } catch (err) {
            updateProcess(processId, { status: 'failed', error: err.message });
            addProcessLog(processId, `${stagePrefix} Thất bại: ${err.message}`, 'error');
            return { success: false, index: i, title: currentTopic.title, error: err.message };
          }
        };

        // Parallel Concurrency Pool Controller
        const pendingIndices = Array.from({ length: totalToGenerate }, (_, idx) => idx);
        const activePromises = new Set();

        while (pendingIndices.length > 0 || activePromises.size > 0) {
          while (pendingIndices.length > 0 && activePromises.size < CONCURRENCY_LIMIT) {
            const itemIdx = pendingIndices.shift();
            const taskPromise = (async () => {
              const res = await runMediaPrepForItem(itemIdx);
              if (res.success && res.inputProps) {
                renderQueue.push(res);
                processRenderQueue();
              } else if (!res.success) {
                completedResults.push(res);
                setBatchLogs([...completedResults]);
              }
            })();

            activePromises.add(taskPromise);
            taskPromise.finally(() => activePromises.delete(taskPromise));
          }

          if (activePromises.size > 0) {
            await Promise.race(Array.from(activePromises));
          }
        }

        // Wait for render queue to flush completely
        while (isRendering || renderQueue.length > 0) {
          await new Promise(r => setTimeout(r, 500));
        }

        const successCount = completedResults.filter(r => r.success).length;
        const failCount = completedResults.filter(r => !r.success).length;
        onLog('Buddhist', `🎉 Đã sản xuất xong hàng loạt! Thành công ${successCount}/${totalToGenerate} video. ${failCount > 0 ? `(${failCount} tệp lỗi)` : ''}`, 'success');
        alert(`🎉 Hoàn tất sản xuất hàng loạt ${totalToGenerate} video!\n- Thành công: ${successCount}\n- Thất bại: ${failCount}\nTất cả file MP4 đã được kết xuất và lưu trữ.`);
      }

    } catch (err) {
      setError(err.message);
      onLog('Buddhist', `Gặp lỗi trong tiến trình: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setLoadingStage('');
      setCurrentBatchIdx(null);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress({ percent: 0, message: 'Khởi chạy kết xuất video Phật pháp...' });
    onLog('Buddhist', 'Bắt đầu kết xuất video MP4 thành phẩm...', 'info');

    // Register process in background tracker
    const processId = `buddhist-export-${Date.now()}`;
    registerProcess(processId, `Xuất Video: ${topic.trim() ? topic : 'Video Phật Pháp'}`, 'buddhist');
    addProcessLog(processId, 'Bắt đầu kết xuất video thành phẩm...', 'info');

    const progressListener = (event, progress) => {
      setExportProgress(progress);
      const percent = Math.floor(progress.percent * 100);
      updateProcess(processId, { progress: percent, stage: `Đang render MP4 (${percent}%)...` });
      addProcessLog(processId, `Render: ${percent}%...`, 'info');
    };
    ipcRenderer.on('render-progress', progressListener);

    try {
      const inputProps = {
        slides,
        subtitles,
        audioUrl,
        bgMusicUrl: bgMusic,
        type: 'buddhist',
        shopeeProps: {
          particleType,
          subtitleStyle,
          subtitleY,
          aspectRatio
        }
      };

      const res = await ipcRenderer.invoke('remotion-render', {
        inputProps,
        compositionId: 'BuddhistVideo'
      });

      if (res.success) {
        onLog('Buddhist', `Kết xuất video thành công! File: ${res.filePath}`, 'success');
        updateProcess(processId, { status: 'success', progress: 100, stage: 'Hoàn thành!', outputPath: res.filePath });
        addProcessLog(processId, `Xuất video thành công! Tệp lưu tại: ${res.filePath}`, 'success');
        alert(`Xuất video thành công! File lưu tại: ${res.filePath}`);
      } else {
        throw new Error(res.error);
      }
    } catch (e) {
      onLog('Buddhist', `Lỗi xuất video: ${e.message}`, 'error');
      updateProcess(processId, { status: 'failed', error: e.message });
      addProcessLog(processId, `Lỗi xuất video: ${e.message}`, 'error');
      alert(`Lỗi xuất video: ${e.message}`);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
      ipcRenderer.removeListener('render-progress', progressListener);
    }
  };

  const handleSubtitleUpdate = (segmentIdx, newValue) => {
    const updatedSubtitles = [...subtitles];
    const segment = updatedSubtitles[segmentIdx];
    if (segment) {
      segment.text = newValue;
      
      // Update individual word items
      const words = newValue.trim().split(/\s+/);
      const totalDuration = segment.end_time - segment.start_time;
      const wordDuration = totalDuration / Math.max(1, words.length);
      
      segment.words = words.map((word, idx) => ({
        text: word,
        start_time: Math.floor(segment.start_time + idx * wordDuration),
        end_time: Math.floor(segment.start_time + (idx + 1) * wordDuration)
      }));

      setSubtitles(updatedSubtitles);
      onLog('Editor', `Cập nhật phụ đề câu ${segmentIdx + 1}: "${newValue}"`, 'info');
    }
  };

  return (
    <div className="tab-content" style={{ justifyContent: 'center' }}>
      {/* Input panel */}
      <div className="workspace-left" style={{ maxWidth: 720, width: '100%', margin: '0 auto', flex: 'none' }}>
        <div className="glass-panel" style={{ padding: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Compass size={20} style={{ color: 'var(--success)' }} /> Tạo Hàng Loạt Video Phật Pháp & Triết Lý
          </h2>

          {/* 1. Batch Quantity Selector */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={14} /> Số lượng video
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 5, 10, 15].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setNumVideos(num)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: numVideos === num ? 'var(--success)' : 'var(--bg-surface-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    color: numVideos === num ? '#fff' : 'var(--text-primary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 13,
                    transition: 'all 0.2s'
                  }}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Duration Selector */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              ⏱️ Thời lượng mỗi video
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[0.5, 3, 5, 10, 15, 30, 60, 120, 180].map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setVideoDuration(min)}
                  disabled={loading}
                  style={{
                    flex: '1 0 auto',
                    minWidth: 44,
                    padding: '8px 10px',
                    background: videoDuration === min ? 'var(--accent)' : 'var(--bg-surface-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    color: videoDuration === min ? '#fff' : 'var(--text-primary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 12,
                    transition: 'all 0.18s ease'
                  }}
                >
                  {min === 0.5 ? '30s' : min >= 60 ? `${min / 60}h` : `${min}'`}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Aspect Ratio & Image Format Selector */}

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              📐 Định dạng &amp; Tỷ lệ khung hình (Video &amp; Tạo ảnh AI)
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setAspectRatio('9:16')}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: aspectRatio === '9:16' ? 'rgba(212,160,23,0.15)' : 'var(--bg-surface-secondary)',
                  border: aspectRatio === '9:16' ? '1.5px solid #d4a017' : '1px solid var(--border)',
                  borderRadius: 10,
                  color: aspectRatio === '9:16' ? '#f5c842' : 'var(--text-primary)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.18s ease',
                }}
              >
                <span>📱 9:16 (Dọc)</span>
                <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 400 }}>(TikTok, Shorts)</span>
              </button>

              <button
                type="button"
                onClick={() => setAspectRatio('16:9')}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: aspectRatio === '16:9' ? 'rgba(212,160,23,0.15)' : 'var(--bg-surface-secondary)',
                  border: aspectRatio === '16:9' ? '1.5px solid #d4a017' : '1px solid var(--border)',
                  borderRadius: 10,
                  color: aspectRatio === '16:9' ? '#f5c842' : 'var(--text-primary)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.18s ease',
                }}
              >
                <span>🖥️ 16:9 (Ngang)</span>
                <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 400 }}>(YouTube, TV)</span>
              </button>
            </div>
          </div>




          {/* 2. Unified Reference Materials Dropdown Selector */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BookOpen size={14} /> Chọn tài liệu tham khảo Phật Pháp
            </label>
            <select
              className="form-input"
              value={selectedRefKey}
              onChange={(e) => handleRefMaterialChange(e.target.value)}
              disabled={loading}
            >
              <option value="free">✍️ Ý tưởng tự do (Không dùng tài liệu, tự gõ chủ đề)</option>
              <option value="local">📂 Sử dụng tệp PDF cục bộ từ máy tính của bạn...</option>
              <optgroup label="Thư viện Ebook Kinh điển Phật giáo online">
                {CURATED_PDFS.map((item, idx) => (
                  <option key={idx} value={idx}>
                    📖 {item.title}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Prompt description input */}
          <div className="form-group">
            <label className="form-label">
              {selectedRefKey === 'free' 
                ? 'Ý tưởng / Chủ đề bài giảng chi tiết (Bắt buộc)' 
                : 'Hướng tập trung / Ý tưởng bài viết (Tùy chọn)'}
            </label>
            <input
              type="text"
              className="form-input"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={loading}
              placeholder={selectedRefKey === 'free' 
                ? 'Nhập chủ đề triết lý (ví dụ: Sự buông bỏ, luật nhân quả...)' 
                : 'Ví dụ: Tập trung vào chữ Hiếu, về sự Vô thường... (để trống AI sẽ tự do khai thác)'}
            />
          </div>

          {/* Script style selector */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              ✍️ Giọng văn kịch bản Phật Pháp
            </label>
            <select
              className="form-input"
              value={scriptStyle}
              onChange={(e) => setScriptStyle(e.target.value)}
              disabled={loading}
            >
              <option value="accessible">✨ Bình dị, Gần gũi & Dễ hiểu (Khuyên dùng)</option>
              <option value="philosophical">🎓 Triết lý, Học thuật & Hàn lâm (Kinh điển sâu sắc)</option>
            </select>
          </div>

          {/* Mặc định sử dụng quy trình tối ưu Multi-Agent (1 API Request) */}

          {/* Video Visual Layout Selector */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              🖼️ Kiểu phân cảnh hình ảnh
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setVideoLayout('static')}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: videoLayout === 'static' ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : 'var(--bg-surface-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  color: videoLayout === 'static' ? '#fff' : 'var(--text-primary)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 13,
                  transition: 'all 0.2s',
                  boxShadow: videoLayout === 'static' ? '0 4px 10px rgba(139, 92, 246, 0.25)' : 'none'
                }}
              >
                Ảnh nền tĩnh (1 ảnh)
              </button>
              <button
                type="button"
                onClick={() => setVideoLayout('storyboard')}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: videoLayout === 'storyboard' ? 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)' : 'var(--bg-surface-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  color: videoLayout === 'storyboard' ? '#fff' : 'var(--text-primary)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 13,
                  transition: 'all 0.2s',
                  boxShadow: videoLayout === 'storyboard' ? '0 4px 10px rgba(236, 72, 153, 0.25)' : 'none'
                }}
              >
                🎞️ Đa phân cảnh (Slideshow)
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, lineHeight: '1.4' }}>
              {videoLayout === 'storyboard' 
                ? '💡 AI sẽ tạo hình nền riêng biệt cho mỗi cảnh và tự động chuyển cảnh chuyển động khớp nhịp lời nói của Thiền sư.' 
                : '💡 Sử dụng 1 ảnh nền Phật giáo tĩnh cho toàn bộ video.'}
            </p>
          </div>


          {/* PDF Details Panel (only show if reference type is PDF) */}
          {sourceType === 'pdf' && pdfFile && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: '100%' }}>
                  📄 Đã nạp tài liệu: {pdfFile.name}
                </span>
              </div>
            </div>
          )}

          {/* ── Styling settings moved to Preview Studio ── */}
          <div style={{
            marginBottom: 20,
            padding: '12px 16px',
            background: 'rgba(212,160,23,0.07)',
            border: '1px solid rgba(212,160,23,0.2)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🎛️</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f5c842', marginBottom: 2 }}>
                Kiểu phụ đề, Vị trí, Hạt bay &amp; Nhạc nền
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Tùy chỉnh trực tiếp trong <strong style={{ color: 'var(--text-secondary)' }}>Preview Studio</strong> — bấm nút <em>Xem Video &amp; Phụ Đề</em> bên dưới để mở.
              </div>
            </div>
          </div>

          {/* 6. VOICE SELECTOR */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Giọng thiền sư</label>
            <select 
              className="form-input"
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              disabled={loading}
            >
              <optgroup label="Microsoft Edge TTS (Online)">
                <option value="vi-VN-NamMinhNeural">Nam Minh (Giọng nam trầm ấm - Khuyên dùng)</option>
                <option value="vi-VN-HoaiMyNeural">Hoài My (Giọng nữ chậm rãi, nhẹ nhàng)</option>
              </optgroup>
              <optgroup label="VieNeu-TTS ONNX (Local)">
                <option value="vieneu-local-trucly">Trúc Ly (Giọng nữ truyền cảm)</option>
                <option value="vieneu-local-hoainam">Hoài Nam (Giọng nam trầm ấm)</option>
                <option value="vieneu-local-nhamy">Nhã My (Giọng nữ nhẹ nhàng)</option>
                <option value="vieneu-local-phuongtrinh">Phương Trinh (Giọng nữ ấm áp)</option>
                <option value="vieneu-local-minhquan">Minh Quân (Giọng nam rõ ràng)</option>
                <option value="vieneu-local-clone">🎙️ Clone giọng tự chọn (.wav)...</option>
              </optgroup>
              <optgroup label="OmniVoice Model (Cloud/Colab)">
                <option value="omnivoice">🎙️ Clone giọng qua Google Colab API (.wav)...</option>
              </optgroup>
            </select>
          </div>

          {/* 7. ZEN BACKGROUND MUSIC */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Nhạc nền (Zen Music)</label>
              <button 
                type="button"
                onClick={handleOpenMusicFolder}
                style={{ background: 'none', border: 'none', color: 'var(--success)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
                title="Mở thư mục nhạc nền để thêm file MP3 của riêng bạn"
              >
                📂 Thêm nhạc
              </button>
            </div>
            <select 
              className="form-input"
              value={bgMusic}
              onChange={(e) => setBgMusic(e.target.value)}
              disabled={loading}
            >
              <option value="">🔇 Không sử dụng nhạc nền</option>
              {localMusicFiles.length > 0 ? (
                localMusicFiles.map((file, idx) => (
                  <option key={idx} value={file.fileUrl}>
                    🎵 {file.name.replace(/\.[^/.]+$/, "")}
                  </option>
                ))
              ) : (
                <option disabled>Không tìm thấy tệp nhạc nào trong thư mục resources/music</option>
              )}
            </select>
          </div>

          {(voice === 'vieneu-local-clone' || voice === 'omnivoice') && (
            <div className="form-group" style={{ marginBottom: 20, animation: 'fadeIn 0.3s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Chọn tệp âm thanh mẫu (.wav)</label>
                <span style={{ fontSize: 10, color: 'var(--success)' }}>⚠️ Thời lượng tốt nhất: 3 - 5 giây</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Đường dẫn tệp .wav hoặc bấm nút chọn..." 
                  value={refAudioPath || ''}
                  onChange={(e) => setRefAudioPath(e.target.value)}
                  style={{ flex: 1 }}
                  disabled={loading}
                />
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleSelectRefAudio}
                  style={{ padding: '0 16px', height: 40, whiteSpace: 'nowrap' }}
                  disabled={loading}
                >
                  📁 Chọn file
                </button>
              </div>
              {voice === 'omnivoice' && !localStorage.getItem('colab_api_url') && (
                <div style={{ color: '#ef4444', fontSize: 11, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>⚠️ Bạn chưa cấu hình Google Colab API URL trong tab <strong>Cài đặt</strong>!</span>
                </div>
              )}
            </div>
          )}

          {/* Bottom Actions */}
          <div style={{ display: 'flex', gap: 16, borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 24 }}>
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={loading}
              style={{ 
                flex: 1.5, 
                padding: '14px', 
                background: 'linear-gradient(135deg, var(--success) 0%, #15803d 100%)', 
                boxShadow: '0 4px 15px rgba(34, 197, 94, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 700
              }}
            >
              {loading ? (
                <>
                  <Loader size={18} className="spin" style={{ marginRight: 8 }} />
                  <span>{loadingStage}</span>
                </>
              ) : (
                `Bắt đầu Sản xuất Hàng loạt (${numVideos} Video)`
              )}
            </button>

             {slides.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flex: 1 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowPreview(true)}
                  style={{ 
                    flex: 1, 
                    padding: '14px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: 8,
                    borderColor: 'var(--success)',
                    color: 'var(--success)',
                    background: 'transparent',
                    borderWidth: 1.5,
                    fontSize: 14,
                    fontWeight: 600
                  }}
                >
                  <Sliders size={18} />
                  <span>Xem Video & Phụ Đề</span>
                </button>

                {allAgentLogs && (
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => {
                      setActiveAgentTab('idea');
                      setShowAgentLogsModal(true);
                    }}
                    style={{ 
                      flex: 1, 
                      padding: '14px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: 8,
                      borderColor: 'var(--accent)',
                      color: 'var(--accent)',
                      background: 'transparent',
                      borderWidth: 1.5,
                      fontSize: 14,
                      fontWeight: 600
                    }}
                  >
                    🤖 Phản Biện Đa Agent
                  </button>
                )}
              </div>
            )}
          </div>


          {/* Batch Logs Display */}
          {batchLogs.length > 0 && (
            <div style={{ marginTop: 20, background: 'rgba(0,0,0,0.2)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
              <strong style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                BÁO CÁO KẾT XUẤT HÀNG LOẠT:
              </strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 100, overflowY: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                {batchLogs.map((log, idx) => (
                  <div key={idx} style={{ color: log.success ? 'var(--success)' : '#ef4444' }}>
                    {log.success 
                      ? `✓ Video ${idx + 1}: Xuất thành công -> ${log.path.split('/').pop()}` 
                      : `✗ Video ${idx + 1}: Thất bại -> ${log.error}`
                    }
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontSize: 13, background: 'rgba(239, 68, 68, 0.08)', padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Video Panel Modal */}
      {showPreview && (
        <VideoPlayerPanel
          isOpen={showPreview}
          slides={slides}
          subtitles={subtitles}
          audioUrl={audioUrl}
          bgMusicUrl={bgMusic}
          type="buddhist"
          shopeeProps={{
            particleType,
            subtitleStyle,
            subtitleY,
            videoTitle,
            aspectRatio,
            voiceVolume,
            bgMusicVolume
          }}

          onSubtitleUpdate={handleSubtitleUpdate}
          onExport={handleExport}
          isExporting={isExporting}
          exportProgress={exportProgress}
          onClose={() => setShowPreview(false)}
          // Live-edit callbacks — propagate changes to parent state so video re-renders
          aspectRatio={aspectRatio}
          onAspectRatioChange={(val) => setAspectRatio(val)}
          subtitleStyle={subtitleStyle}
          onSubtitleStyleChange={(val) => setSubtitleStyle(val)}
          subtitleY={subtitleY}
          onSubtitleYChange={(val) => setSubtitleY(val)}
          particleType={particleType}
          onParticleTypeChange={(val) => setParticleType(val)}
          bgMusic={bgMusic}
          onBgMusicChange={(val) => setBgMusic(val)}
          localMusicFiles={localMusicFiles}
          onOpenMusicFolder={handleOpenMusicFolder}
        />
      )}

      {/* 4-Image Selection Modal */}
      {showImageModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.25s ease'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 24,
            width: '90%',
            maxWidth: 850,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                🎨 Chọn Ảnh Nền Cho Video
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '6px 0 0 0' }}>
                Vibes.ai đã tạo ra 4 mẫu ảnh khác nhau dựa trên ý tưởng của kịch bản. Hãy click chọn bức ảnh bạn thích nhất dưới đây để tiếp tục dựng video:
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
              overflowY: 'auto',
              padding: '8px 2px'
            }}>
              {modalImages.map((url, idx) => (
                <div 
                  key={idx}
                  onClick={() => {
                    if (imageSelectCallback) imageSelectCallback(url);
                  }}
                  style={{
                    position: 'relative',
                    aspectRatio: '9/16',
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: '3px solid transparent',
                    cursor: 'pointer',
                    background: 'var(--bg-surface-secondary)',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--success)';
                    e.currentTarget.style.transform = 'scale(1.03)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <img 
                    src={url} 
                    alt={`Option ${idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 'bold',
                    backdropFilter: 'blur(4px)'
                  }}>
                    Mẫu #{idx + 1}
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  if (imageSelectCallback) imageSelectCallback(modalImages[0]);
                }}
                style={{ padding: '8px 20px', fontSize: 13 }}
              >
                Bỏ qua (Chọn mẫu #1)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8-Agent Logs Viewer Modal */}
      {showAgentLogsModal && allAgentLogs && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.25s ease'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 28,
            width: '95%',
            maxWidth: 950,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            color: 'var(--text-primary)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  🤖 Nhật Ký Phản Biện & Viết Kịch Bản Đa Agent (8-Agent System)
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '4px 0 0 0' }}>
                  Chi tiết tiến trình phân tích sâu của từng Agent trong pipeline
                </p>
              </div>
              <button 
                onClick={() => setShowAgentLogsModal(false)}
                style={{
                  background: 'var(--bg-surface-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: 14
                }}
              >
                ✕
              </button>
            </div>

            {/* Tab navigation */}
            <div style={{
              display: 'flex',
              gap: 8,
              borderBottom: '1px solid var(--border)',
              paddingBottom: 10,
              overflowX: 'auto',
              whiteSpace: 'nowrap'
            }}>
              {[
                { id: 'idea', label: '1. Idea Agent', icon: '💡' },
                { id: 'research', label: '2. Research Agent', icon: '🔍' },
                { id: 'audience', label: '3. Audience Agent', icon: '👥' },
                { id: 'planner', label: '4. Story Planner', icon: '📋' },
                { id: 'writer', label: '5. Script Writer', icon: '✍️' },
                { id: 'critic', label: '6. Script Critic', icon: '⚖️' },
                { id: 'rewriter', label: '7. Script Rewriter', icon: '🔄' },
                { id: 'formatter', label: '8. Final Formatter', icon: '🎞️' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveAgentTab(tab.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: activeAgentTab === tab.id ? 'var(--success)' : 'transparent',
                    border: '1px solid ' + (activeAgentTab === tab.id ? 'var(--success)' : 'var(--border)'),
                    color: activeAgentTab === tab.id ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Tab contents */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              background: 'rgba(0,0,0,0.15)',
              padding: 20,
              borderRadius: 12,
              border: '1px solid var(--border)',
              fontFamily: 'system-ui, sans-serif',
              lineHeight: '1.6',
              fontSize: 13
            }}>
              {activeAgentTab === 'idea' && allAgentLogs.idea && (
                <div>
                  <h4 style={{ margin: '0 0 12px 0', color: 'var(--success)' }}>💡 Đề xuất Chủ đề & Phân tích Ý tưởng Ban đầu</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '8px 0', fontWeight: 'bold', width: '30%' }}>Chủ đề cụ thể:</td><td style={{ padding: '8px 0' }}>{allAgentLogs.idea.theme}</td></tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '8px 0', fontWeight: 'bold' }}>Phong cách:</td><td style={{ padding: '8px 0' }}>{allAgentLogs.idea.style}</td></tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '8px 0', fontWeight: 'bold' }}>Đối tượng mục tiêu:</td><td style={{ padding: '8px 0' }}>{allAgentLogs.idea.targetAudience}</td></tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '8px 0', fontWeight: 'bold' }}>Thời lượng:</td><td style={{ padding: '8px 0' }}>{allAgentLogs.idea.duration}</td></tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '8px 0', fontWeight: 'bold' }}>Mục tiêu cốt lõi:</td><td style={{ padding: '8px 0' }}>{allAgentLogs.idea.coreObjective}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}

              {activeAgentTab === 'research' && allAgentLogs.research && (
                <div>
                  <h4 style={{ margin: '0 0 12px 0', color: 'var(--success)' }}>🔍 Dữ liệu & Điển Tích Thu Thập Được</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <strong style={{ display: 'block', marginBottom: 6, color: '#60a5fa' }}>📖 Trích dẫn Phật Pháp / Câu thơ cổ:</strong>
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {allAgentLogs.research.quotes.map((q, idx) => <li key={idx} style={{ marginBottom: 6 }}><em>"{q}"</em></li>)}
                      </ul>
                    </div>
                    <div>
                      <strong style={{ display: 'block', marginBottom: 6, color: '#f59e0b' }}>🎋 Mẩu chuyện Thiền / Bài học:</strong>
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {allAgentLogs.research.stories.map((s, idx) => <li key={idx} style={{ marginBottom: 6 }}>{s}</li>)}
                      </ul>
                    </div>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <strong style={{ display: 'block', marginBottom: 6, color: '#10b981' }}>💡 Bài học & Ví dụ đời thực:</strong>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {[...allAgentLogs.research.facts, ...allAgentLogs.research.examples].map((f, idx) => <li key={idx} style={{ marginBottom: 4 }}>{f}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              {activeAgentTab === 'audience' && allAgentLogs.audience && (
                <div>
                  <h4 style={{ margin: '0 0 12px 0', color: 'var(--success)' }}>👥 Thấu Hiểu Khán Giả & Đề Xuất Hook</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <strong>🎯 Khán giả đang khao khát:</strong>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                        {allAgentLogs.audience.desires.map((d, idx) => <span key={idx} style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)', padding: '4px 10px', borderRadius: 20, fontSize: 11 }}>{d}</span>)}
                      </div>
                    </div>
                    <div>
                      <strong>⚠️ Nỗi sợ / Điểm đau thầm kín của khán giả:</strong>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                        {allAgentLogs.audience.fears.map((f, idx) => <span key={idx} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '4px 10px', borderRadius: 20, fontSize: 11 }}>{f}</span>)}
                      </div>
                    </div>
                    <div>
                      <strong>🧐 Điểm khơi gợi tò mò:</strong>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                        {allAgentLogs.audience.curiosities.map((c, idx) => <li key={idx}>{c}</li>)}
                      </ul>
                    </div>
                    <div>
                      <strong style={{ color: '#60a5fa' }}>⚡ Đề xuất Hook giữ chân 3 giây đầu:</strong>
                      <ul style={{ margin: '4px 0 0 0', paddingLeft: 20, fontWeight: 'bold' }}>
                        {allAgentLogs.audience.hookStrategies.map((h, idx) => <li key={idx} style={{ color: '#93c5fd' }}>"{h}"</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {activeAgentTab === 'planner' && allAgentLogs.planner && (
                <div>
                  <h4 style={{ margin: '0 0 12px 0', color: 'var(--success)' }}>📋 Dàn Ý Phác Thảo Trực Quan (Story Outline)</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {allAgentLogs.planner.outline.map((sec, idx) => (
                      <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, borderLeft: '3px solid var(--success)' }}>
                        <strong style={{ color: 'var(--success)' }}>{sec.section}</strong>: <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sec.objective}</span>
                        <ul style={{ margin: '6px 0 0 0', paddingLeft: 20, fontSize: 12 }}>
                          {sec.points.map((p, pIdx) => <li key={pIdx}>{p}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeAgentTab === 'writer' && allAgentLogs.writer && (
                <div>
                  <h4 style={{ margin: '0 0 12px 0', color: 'var(--success)' }}>✍️ Bản Thảo Kịch Bản Thô (Original Draft Script)</h4>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 8, maxHeight: 250, overflowY: 'auto' }}>
                    {allAgentLogs.writer.draftScript.map((c, idx) => (
                      <p key={idx} style={{ margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--success)', fontWeight: 'bold', marginRight: 8 }}>Câu {idx + 1}:</span>
                        {c.text}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {activeAgentTab === 'critic' && allAgentLogs.critic && (
                <div>
                  <h4 style={{ margin: '0 0 12px 0', color: 'var(--success)' }}>⚖️ Phản Biện Chấm Điểm & Đánh Giá Giữ Chân Khán Giả</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 32, fontWeight: 'bold', color: 'var(--success)' }}>
                          {(Object.values(allAgentLogs.critic.scores).reduce((sum, val) => sum + (Number(val) || 0), 0) / Math.max(1, Object.keys(allAgentLogs.critic.scores).length)).toFixed(1)}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ĐIỂM TRUNG BÌNH</span>
                      </div>
                      
                      {Object.entries(allAgentLogs.critic.scores).map(([key, score]) => {
                        const labels = {
                          authenticityAndFlow: "Chân thật & Tự nhiên",
                          wisdomDepth: "Chiều sâu Thiền lý",
                          emotion: "Cảm xúc chạm lòng",
                          pacing: "Nhịp điệu dòng chảy",
                          cta: "Độ lắng kết thúc (CTA)"
                        };
                        return (
                          <div key={key} style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{labels[key] || key}:</span>
                            <span style={{ fontWeight: 'bold', color: score >= 8 ? 'var(--success)' : '#f59e0b' }}>{score}/10</span>
                          </div>
                        );
                      })}

                    </div>
                    <div>
                      <strong style={{ color: '#ef4444', display: 'block', marginBottom: 4 }}>⚠️ Điểm Phê Bình Sắc Bén:</strong>
                      <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <p style={{ margin: 0 }}><strong>Hook 3s đầu:</strong> {allAgentLogs.critic.critique.hook}</p>
                        <p style={{ margin: 0 }}><strong>Nhịp điệu:</strong> {allAgentLogs.critic.critique.pacing}</p>
                        <p style={{ margin: 0 }}><strong>Cảm xúc:</strong> {allAgentLogs.critic.critique.emotion}</p>
                        <p style={{ margin: 0 }}><strong>Bài học (CTA):</strong> {allAgentLogs.critic.critique.cta}</p>
                      </div>
                      
                      <strong style={{ color: 'var(--success)', display: 'block', marginTop: 14, marginBottom: 4 }}>🔄 Yêu cầu chỉnh sửa đề xuất:</strong>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
                        {allAgentLogs.critic.recommendations.map((rec, idx) => <li key={idx} style={{ color: '#86efac' }}>{rec}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {activeAgentTab === 'rewriter' && allAgentLogs.rewriter && (
                <div>
                  <h4 style={{ margin: '0 0 12px 0', color: 'var(--success)' }}>🔄 Kịch Bản Đã Viết Lại Hoàn Thiện (Polished & Edited Script)</h4>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 8, maxHeight: 250, overflowY: 'auto' }}>
                    {allAgentLogs.rewriter.rewrittenScript.map((c, idx) => (
                      <p key={idx} style={{ margin: '0 0 8px 0' }}>
                        <span style={{ color: 'var(--success)', fontWeight: 'bold', marginRight: 8 }}>Câu {idx + 1}:</span>
                        {c.text}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {activeAgentTab === 'formatter' && allAgentLogs.formatter && (
                <div>
                  <h4 style={{ margin: '0 0 12px 0', color: 'var(--success)' }}>🎞️ Cấu Trúc Đa Phân Cảnh & Thiết Kế Vẽ Tranh AI (Final Formatted Storyboard)</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 250, overflowY: 'auto' }}>
                    {allAgentLogs.formatter.storyboard.map((scene, idx) => (
                      <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--success)', marginBottom: 6, fontWeight: 'bold' }}>
                          <span>Cảnh {scene.sceneIndex || idx + 1}</span>
                          <span style={{ color: 'var(--text-muted)' }}>🎙️ {scene.voicePrompt}</span>
                        </div>
                        <p style={{ margin: '0 0 8px 0', fontSize: 12 }}>{scene.text}</p>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 4, fontSize: 11, color: '#93c5fd', fontFamily: 'var(--font-mono)' }}>
                          <strong>🎨 Prompt:</strong> {scene.imagePrompt}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowAgentLogsModal(false)}
                style={{ padding: '10px 24px' }}
              >
                Đóng Nhật Ký
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

