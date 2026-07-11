import React, { useState, useEffect } from 'react';
import { Compass, Loader, AlertTriangle, BookOpen, Sun, Wind, Type, FileText, Upload, Sliders, Layers } from 'lucide-react';
import VideoPlayerPanel from './VideoPlayerPanel';

const { ipcRenderer } = window.require('electron');

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

  // Duration → approximate word count (Vietnamese TTS at -15% speed ≈ 80 words/min)
  const DURATION_WORD_MAP = { 2: 160, 3: 240, 5: 400, 8: 640, 10: 800, 15: 1200 };
  
  const [sourceType, setSourceType] = useState('prompt'); // prompt, pdf
  const [topic, setTopic] = useState('');
  const [voice, setVoice] = useState('vi-VN-NamMinhNeural');
  const [refAudioPath, setRefAudioPath] = useState('');
  const [bgMusic, setBgMusic] = useState('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3');
  
  // Custom mechanisms states

  const [ambientSfx, setAmbientSfx] = useState('bell');
  const [particleType, setParticleType] = useState('dust');
  const [subtitleStyle, setSubtitleStyle] = useState('modern');
  const [subtitleY, setSubtitleY] = useState(220);

  // PDF specific states
  const [pdfFile, setPdfFile] = useState(null); // { name, path, url, localFile }

  // Core generator states
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState('');

  // Batch rendering states
  const [batchLogs, setBatchLogs] = useState([]);
  const [currentBatchIdx, setCurrentBatchIdx] = useState(null); // null if not batching

  // Preview panel states (corresponds to the currently loaded/generated video)
  const [slides, setSlides] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [audioUrl, setAudioUrl] = useState('');

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  
  const [localMusicFiles, setLocalMusicFiles] = useState([]);
  const [musicFolderPath, setMusicFolderPath] = useState('');

  // Fetch local music files from resources/music folder on mount
  useEffect(() => {
    const fetchLocalMusic = async () => {
      try {
        const res = await ipcRenderer.invoke('list-local-music');
        if (res.success) {
          if (Array.isArray(res.musicFiles)) {
            setLocalMusicFiles(res.musicFiles);
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

    try {
      const geminiModel = localStorage.getItem('gemini_model') || 'gemini-3.1-flash-lite';
      const pdfFilePath = sourceType === 'pdf' ? (pdfFile?.path || pdfFile?.localFile || null) : null;

      // ── BƯỚC 1: Lập kế hoạch & Hoạch định danh sách chủ đề ──────────────────
      setLoadingStage(`Đang phân tích tài liệu và hoạch định ${totalToGenerate} chủ đề cho loạt video...`);
      const step1System = `Bạn là một thiền sư hiền triết, am hiểu Phật Pháp sâu sắc. Hãy lập kế hoạch và phân chia chủ đề cho loạt video bài giảng ngắn. Trả về cấu trúc JSON bắt buộc.`;
      
      let step1Prompt = '';
      if (sourceType === 'prompt') {
        step1Prompt = `Tôi muốn sản xuất một loạt gồm ${totalToGenerate} video thiền ngắn độc lập xoay quanh chủ đề chính: "${topic}".

Hãy lên hoạch định chi tiết đề xuất đúng ${totalToGenerate} khía cạnh/góc nhìn/chủ đề phụ riêng biệt, hoàn toàn không trùng lặp ý tưởng với nhau.
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

Hãy phân tích kỹ tài liệu đính kèm và đề xuất đúng ${totalToGenerate} chủ đề/ý tưởng bài giảng riêng biệt, sâu sắc, hoàn toàn không trùng lặp ý tưởng với nhau.
Trả về duy nhất định dạng JSON có cấu trúc sau:
{
  "topics": [
    {
      "index": 1,
      "title": "Tiêu đề ngắn gọn cho video (khoảng 5-8 từ)",
      "description": "Mô tả khía cạnh hoặc câu kinh cụ thể trong tài liệu mà video này sẽ tập trung phân tích"
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

      if (!step1Res.success) throw new Error(`Lỗi lập kế hoạch chủ đề: ${step1Res.error}`);
      const plannedTopics = step1Res.data.topics;
      if (!Array.isArray(plannedTopics) || plannedTopics.length === 0) {
        throw new Error("Không nhận được danh sách hoạch định chủ đề từ AI.");
      }

      onLog('Buddhist', `Lập kế hoạch thành công! Đã lên danh sách ${plannedTopics.length} chủ đề độc lập.`, 'success');

      // ── BƯỚC 2: Vòng lặp biên soạn kịch bản chi tiết dựa trên kế hoạch ───────
      for (let i = 0; i < totalToGenerate; i++) {
        setCurrentBatchIdx(i);
        const stagePrefix = `[Video ${i + 1}/${totalToGenerate}]`;
        const currentTopic = plannedTopics[i % plannedTopics.length];

        // Register process in background tracker
        const processId = `buddhist-batch-${Date.now()}-${i}`;
        registerProcess(processId, `[Video ${i + 1}/${totalToGenerate}] ${currentTopic.title}`, 'buddhist');
        addProcessLog(processId, `Bắt đầu xử lý chủ đề: "${currentTopic.title}". Trọng tâm: ${currentTopic.description}`, 'info');

        onLog('Buddhist', `${stagePrefix} Bắt đầu khởi tạo chủ đề: "${currentTopic.title}"...`, 'info');

        // 1. Generate script
        setLoadingStage(`${stagePrefix} AI đang biên soạn kịch bản chi tiết...`);
        updateProcess(processId, { progress: 10, stage: 'AI đang biên soạn kịch bản chi tiết...' });
        addProcessLog(processId, 'Đang gửi yêu cầu lập kịch bản chi tiết và hình ảnh tới Gemini...', 'info');
        const systemPrompt = `Bạn là một thiền sư hiền triết, am hiểu Phật Pháp sâu sắc. Hãy viết các câu triết lý sống bằng tiếng Việt mang tính thanh tịnh, chậm rãi, thư thái và bình yên. Trả về cấu trúc JSON bắt buộc.`;
        
        const targetWords = DURATION_WORD_MAP[videoDuration] || 240;
        const sentenceCount = Math.round(targetWords / 20); // ~20 từ/câu

        let userPrompt = '';
        if (sourceType === 'prompt') {
          userPrompt = `Hãy viết một bài giảng thiền liền mạch, sâu sắc (khoảng ${targetWords} từ tiếng Việt, tương đương ${videoDuration} phút audio giọng đọc chậm rãi) dựa trên chủ đề hoạch định sau:
Tiêu đề: ${currentTopic.title}
Trọng tâm: ${currentTopic.description}

YÊU CẦU QUAN TRỌNG:
- CÂU MỞ ĐẦU (Câu thứ nhất trong mảng "script") PHẢI là một câu hỏi chạm đúng nỗi đau, một sự thực bất ngờ hoặc một lời cảnh tỉnh sâu sắc để thu hút sự chú ý ngay trong 3 giây đầu tiên (ví dụ: "Có bao giờ bạn thấy...", "Tại sao càng níu giữ lại càng mệt mỏi?", "Nghiệp quả lớn nhất đời người là...", "Bí mật lớn nhất của tâm an yên chính là..."). Tuyệt đối không chào hỏi, giới thiệu dông dài.
- KHÔNG chia đoạn, KHÔNG đánh số, KHÔNG tiêu đề phụ. Viết liền mạch như một bài pháp thoại tự nhiên.
- Giọng văn thiền định, chậm rãi, bình an, mỗi câu khoảng 15-25 từ.
- Tổng cộng khoảng ${sentenceCount} câu, đủ để lấp đầy ${videoDuration} phút.
- Mỗi phần tử trong mảng "script" là MỘT CÂU độc lập (không phải đoạn văn).

Hãy thiết kế 1 đoạn mô tả hình ảnh tiếng Anh chi tiết, dùng làm ảnh nền tĩnh cho toàn bộ video. Ảnh PHẢI là hình ảnh Đức Phật hoặc nhà sư đang ngồi thiền/giảng pháp, bối cảnh thanh tịnh liên quan đến chủ đề, phong cách nghệ thuật Phật giáo Á Đông, tỷ lệ dọc 9:16.

Trả về duy nhất định dạng JSON có cấu trúc sau:
{
  "title": "${currentTopic.title}",
  "imagePrompt": "Detailed English image prompt featuring a Buddha or Buddhist monk scene directly related to the video's teaching theme, vertical 9:16 aspect ratio, traditional East Asian Buddhist art style",
  "script": [
    { "text": "Một câu thiền định tiếng Việt (15-25 từ, tự nhiên, liền mạch với câu trước và sau)" }
  ]
}`;
        } else {
          userPrompt = `Hãy viết một bài giảng thiền liền mạch, sâu sắc (khoảng ${targetWords} từ tiếng Việt, tương đương ${videoDuration} phút audio giọng đọc chậm rãi) dựa trên tài liệu Phật pháp đính kèm, tập trung khai thác chính xác chủ đề hoạch định sau:
Tiêu đề: ${currentTopic.title}
Trọng tâm: ${currentTopic.description}

YÊU CẦU QUAN TRỌNG:
- CÂU MỞ ĐẦU (Câu thứ nhất trong mảng "script") PHẢI là một câu hỏi chạm đúng nỗi đau, một sự thực bất ngờ hoặc một lời cảnh tỉnh sâu sắc để thu hút sự chú ý ngay trong 3 giây đầu tiên (ví dụ: "Có bao giờ bạn thấy...", "Tại sao càng níu giữ lại càng mệt mỏi?", "Nghiệp quả lớn nhất đời người là...", "Bí mật lớn nhất của tâm an yên chính là..."). Tuyệt đối không chào hỏi, giới thiệu dông dài.
- KHÔNG chia đoạn, KHÔNG đánh số, KHÔNG tiêu đề phụ. Viết liền mạch như một bài pháp thoại tự nhiên.
- Giọng văn thiền định, chậm rãi, bình an, mỗi câu khoảng 15-25 từ.
- Tổng cộng khoảng ${sentenceCount} câu, đủ để lấp đầy ${videoDuration} phút.
- Mỗi phần tử trong mảng "script" là MỘT CÂU độc lập (không phải đoạn văn).
- Trích dẫn trực tiếp và phân tích sâu từ tài liệu đính kèm.

Hãy thiết kế 1 đoạn mô tả hình ảnh tiếng Anh chi tiết, dùng làm ảnh nền tĩnh cho toàn bộ video. Ảnh PHẢI là hình ảnh Đức Phật hoặc nhà sư đang ngồi thiền/giảng pháp, bối cảnh thanh tịnh liên quan đến chủ đề, phong cách nghệ thuật Phật giáo Á Đông, tỷ lệ dọc 9:16.

Trả về duy nhất định dạng JSON có cấu trúc sau:
{
  "title": "${currentTopic.title}",
  "imagePrompt": "Detailed English image prompt featuring a Buddha or Buddhist monk scene directly related to the video's teaching theme, vertical 9:16 aspect ratio, traditional East Asian Buddhist art style",
  "script": [
    { "text": "Một câu thiền định tiếng Việt (15-25 từ, đúc kết từ tài liệu, tự nhiên liền mạch)" }
  ]
}`;
        }

        const geminiRes = await ipcRenderer.invoke('gemini-generate', { 
          apiKey, 
          systemPrompt, 
          userPrompt, 
          geminiModel,
          pdfFilePath
        });
        if (!geminiRes.success) {
          updateProcess(processId, { status: 'failed', error: geminiRes.error });
          addProcessLog(processId, `Lỗi tạo kịch bản Gemini: ${geminiRes.error}`, 'error');
          throw new Error(geminiRes.error);
        }
        const generatedData = geminiRes.data.script;
        addProcessLog(processId, `AI tạo kịch bản thành công. Số đoạn: ${generatedData.length}`, 'success');

        // 2. TTS Voiceover
        setLoadingStage(`${stagePrefix} Đang lồng tiếng thiền sư...`);
        updateProcess(processId, { progress: 30, stage: 'Đang lồng tiếng thiền sư...' });
        addProcessLog(processId, 'Bắt đầu gọi Edge-TTS lồng tiếng Việt...', 'info');
        const fullText = generatedData.map(item => item.text).join(' ');
        const ttsRes = await ipcRenderer.invoke('edge-tts-synthesize', { 
          text: fullText, 
          options: { voice, rate: '-15%', refAudioPath }
        });
        if (!ttsRes.success) {
          updateProcess(processId, { status: 'failed', error: ttsRes.error });
          addProcessLog(processId, `Lỗi lồng tiếng: ${ttsRes.error}`, 'error');
          throw new Error(ttsRes.error);
        }
        const localAudioUrl = ttsRes.filePath;
        addProcessLog(processId, 'Lồng tiếng Việt hoàn tất.', 'success');

        // 3. ASR Syncing
        setLoadingStage(`${stagePrefix} Đang chạy phụ đề karaoke...`);
        updateProcess(processId, { progress: 50, stage: 'Đang chạy phụ đề karaoke...' });
        addProcessLog(processId, 'Chạy ASR đồng bộ thời gian phụ đề...', 'info');
        const asrRes = await ipcRenderer.invoke('capcut-asr-transcribe', {
          audioPath: localAudioUrl,
          options: { language: 'vi-VN', needWordTimestamp: true }
        });
        if (!asrRes.success) {
          updateProcess(processId, { status: 'failed', error: asrRes.error });
          addProcessLog(processId, `Lỗi chạy ASR phụ đề: ${asrRes.error}`, 'error');
          throw new Error(asrRes.error);
        }
        const asrSegments = asrRes.segments;
        addProcessLog(processId, `Khớp phụ đề thành công (${asrSegments.length} dòng).`, 'success');

        // 4. Image generation via Vibes.ai
        setLoadingStage(`${stagePrefix} Đang tạo ảnh Phật/Nhà sư qua Vibes.ai...`);
        updateProcess(processId, { progress: 70, stage: 'Đang tạo ảnh Phật/Nhà sư qua Vibes.ai...' });
        addProcessLog(processId, 'Bắt đầu tạo ảnh nền Phật giáo...', 'info');
        const localImages = [];
        const imagePrompt = geminiRes.data.imagePrompt || `a serene Buddha meditating, traditional East Asian Buddhist art style, vertical 9:16`;
        const formattedPrompt = `${imagePrompt}, vertical aspect ratio, 9:16, photorealistic, highly detailed, masterpiece`;

        let imagePath = '';
        try {
          const vibesCookie = localStorage.getItem('vibes_meta_session') || '';
          if (!vibesCookie) {
            throw new Error('Chưa cấu hình Vibes.ai Meta Session trong Cài đặt.');
          }
          onLog('Buddhist', `${stagePrefix} Đang gọi API Vibes.ai tạo ảnh Phật/Nhà sư...`, 'info');
          addProcessLog(processId, 'Đang kết nối API Vibes.ai...', 'info');
          const vibeRes = await ipcRenderer.invoke('vibes-generate-image', { prompt: formattedPrompt, metaSession: vibesCookie });
          if (vibeRes.success) {
            imagePath = vibeRes.filePath;
            onLog('Buddhist', `${stagePrefix} Tạo ảnh Phật/Nhà sư thành công qua Vibes.ai!`, 'success');
            addProcessLog(processId, 'Tạo ảnh Phật/Nhà sư thành công qua Vibes.ai!', 'success');
          } else {
            throw new Error(vibeRes.error);
          }
        } catch (vibeErr) {
          const warnMsg = `Không tạo được ảnh trên Vibes.ai (${vibeErr.message}). Chuyển sang vẽ ảnh dự phòng miễn phí qua Pollinations...`;
          onLog('Buddhist', warnMsg, 'warning');
          addProcessLog(processId, warnMsg, 'warning');
          
          const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(formattedPrompt)}?width=1080&height=1920&nologo=true`;
          const dlRes = await ipcRenderer.invoke('download-image', { imageUrl: pollinationsUrl });
          if (dlRes.success) {
            imagePath = dlRes.filePath;
            onLog('Buddhist', `${stagePrefix} Vẽ ảnh dự phòng thành công!`, 'success');
            addProcessLog(processId, 'Vẽ ảnh dự phòng thành công!', 'success');
          } else {
            const errMsg = `Không thể tạo ảnh Phật giáo (Vibes.ai & Pollinations đều lỗi): ${dlRes.error}`;
            addProcessLog(processId, errMsg, 'error');
            updateProcess(processId, { status: 'failed', error: errMsg });
            throw new Error(errMsg);
          }
        }
        localImages.push(imagePath);

        // 5. Build Slide timings (one single slide for the entire video!)
        const lastWordSeg = asrSegments[asrSegments.length - 1];
        const audioDurationMs = lastWordSeg ? lastWordSeg.end_time : 15000;
        const audioDurationFrames = Math.ceil((audioDurationMs / 1000) * 30);

        const computedSlides = [
          {
            imageUrl: localImages[0] || '',
            startFrame: 0,
            durationFrames: audioDurationFrames
          }
        ];

        // Set to local states (enables real-time preview of the LAST generated video)
        setSlides(computedSlides);
        setSubtitles(asrSegments);
        setAudioUrl(localAudioUrl);

        onLog('Buddhist', `${stagePrefix} Khởi tạo thành công cấu trúc video!`, 'success');

        // 6. IF batch size > 1, we automatically render/export to MP4 file on the fly!
        if (totalToGenerate > 1) {
          setLoadingStage(`${stagePrefix} Đang kết xuất video thành tệp MP4...`);
          onLog('Buddhist', `${stagePrefix} Bắt đầu kết xuất video MP4 tự động...`, 'info');
          updateProcess(processId, { progress: 80, stage: 'Bắt đầu kết xuất video MP4...' });
          addProcessLog(processId, 'Khởi chạy tiến trình render Remotion MP4...', 'info');

          const progressListener = (event, progress) => {
            const percent = Math.floor(progress.percent * 100);
            const remotionProgress = 80 + Math.floor(percent * 0.19);
            updateProcess(processId, { progress: remotionProgress, stage: `Đang kết xuất Remotion MP4 (${percent}%)...` });
            addProcessLog(processId, `Đang render Remotion: ${percent}%...`, 'info');
          };
          ipcRenderer.on('render-progress', progressListener);

          const inputProps = {
            slides: computedSlides,
            subtitles: asrSegments,
            audioUrl: localAudioUrl,
            bgMusicUrl: bgMusic,
            type: 'buddhist',
            shopeeProps: {
              ambientSfx,
              particleType,
              subtitleStyle,
              subtitleY
            }
          };

          const renderRes = await ipcRenderer.invoke('remotion-render', {
            inputProps,
            compositionId: 'BuddhistVideo'
          });

          ipcRenderer.removeListener('render-progress', progressListener);

          if (renderRes.success) {
            setBatchLogs(prev => [...prev, { success: true, path: renderRes.filePath }]);
            onLog('Buddhist', `${stagePrefix} Kết xuất MP4 thành công! File: ${renderRes.filePath}`, 'success');
            updateProcess(processId, { status: 'success', progress: 100, stage: 'Hoàn thành!', outputPath: renderRes.filePath });
            addProcessLog(processId, `Kết xuất MP4 thành công! Tệp lưu tại: ${renderRes.filePath}`, 'success');
          } else {
            setBatchLogs(prev => [...prev, { success: false, error: renderRes.error }]);
            onLog('Buddhist', `${stagePrefix} Lỗi kết xuất MP4: ${renderRes.error}`, 'error');
            updateProcess(processId, { status: 'failed', error: renderRes.error });
            addProcessLog(processId, `Lỗi kết xuất video: ${renderRes.error}`, 'error');
          }
        } else {
          // If totalToGenerate === 1, the draft preparation is complete
          updateProcess(processId, { status: 'success', progress: 100, stage: 'Khởi tạo thành công!' });
          addProcessLog(processId, 'Đã chuẩn bị cấu trúc video thành công! Bạn có thể xem trước hoặc nhấp "Xuất Video MP4" ở cột phải để lưu file.', 'success');
        }
      }

      // Finish notification
      if (totalToGenerate > 1) {
        onLog('Buddhist', `Hoàn tất sản xuất hàng loạt ${totalToGenerate} video Phật pháp!`, 'success');
        alert(`Đã hoàn tất sản xuất hàng loạt ${totalToGenerate} video!\nTất cả file MP4 đã được lưu trữ trong thư mục tạm.`);
      } else {
        onLog('Buddhist', `Khởi tạo video Phật pháp thành công! Nhấp 'Xuất Video MP4' ở bên phải để lưu file.`, 'success');
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
          ambientSfx,
          particleType,
          subtitleStyle,
          subtitleY
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

  const handleSubtitleUpdate = (segmentIdx, wordIdx, newValue) => {
    const updatedSubtitles = [...subtitles];
    if (updatedSubtitles[segmentIdx] && updatedSubtitles[segmentIdx].words[wordIdx]) {
      updatedSubtitles[segmentIdx].words[wordIdx].text = newValue;
      updatedSubtitles[segmentIdx].text = updatedSubtitles[segmentIdx].words
        .map(w => w.text)
        .join(' ');
      setSubtitles(updatedSubtitles);
      onLog('Editor', `Cập nhật từ phụ đề: "${newValue}"`, 'info');
    }
  };

  return (
    <div className="tab-content">
      {/* Input panel */}
      <div className="workspace-left">
        <div className="glass-panel">
          <h2 style={{ fontSize: 18, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Compass size={20} style={{ color: 'var(--success)' }} /> Tạo Hàng Loạt Video Phật Pháp & Triết Lý
          </h2>

          {/* 1. Batch Quantity + Duration Selectors */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ flex: 1 }}>
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

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                ⏱️ Thời lượng mỗi video
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[2, 3, 5, 8, 10, 15].map((min) => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => setVideoDuration(min)}
                    disabled={loading}
                    style={{
                      flex: 1,
                      minWidth: 40,
                      padding: '10px 8px',
                      background: videoDuration === min ? 'var(--accent)' : 'var(--bg-surface-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      color: videoDuration === min ? '#fff' : 'var(--text-primary)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: 13,
                      transition: 'all 0.2s'
                    }}
                  >
                    {min}'
                  </button>
                ))}
              </div>
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

          {/* Visual settings - Subtitle Style & Subtitle Y Coordinate */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Type size={14} /> Kiểu chữ phụ đề
              </label>
              <select 
                className="form-input"
                value={subtitleStyle}
                onChange={(e) => setSubtitleStyle(e.target.value)}
                disabled={loading}
              >
                <option value="modern">Hiện đại (TikTok Karaoke)</option>
                <option value="minimalist">Tối giản (Aesthetic Zen)</option>
                <option value="capsule">Viên thuốc (Modern Reel Capsule)</option>
                <option value="neon">Neon phát sáng (Glowing Cyan)</option>
                <option value="banner">Thanh điện ảnh (Classic Movie Banner)</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>↕️ Tọa độ Y phụ đề</span>
                <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{subtitleY}px</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', height: '38px' }}>
                <input 
                  type="range" 
                  min="50" 
                  max="800" 
                  value={subtitleY} 
                  onChange={(e) => setSubtitleY(Number(e.target.value))}
                  disabled={loading}
                  style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--success)' }}
                />
              </div>
            </div>
          </div>

          {/* Audio mixing and particles */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wind size={14} /> Âm thanh hòa âm (Ambient SFX)
              </label>
              <select 
                className="form-input"
                value={ambientSfx}
                onChange={(e) => setAmbientSfx(e.target.value)}
                disabled={loading}
              >
                <option value="bell">Chuông chùa & Gõ mõ ngân vang</option>
                <option value="stream">Tiếng suối chảy róc rách</option>
                <option value="rain">Tiếng mưa rơi nhẹ rừng trúc</option>
                <option value="none">Không có âm thanh ngầm</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Hiệu ứng hạt bay (Particles)</label>
              <select 
                className="form-input"
                value={particleType}
                onChange={(e) => setParticleType(e.target.value)}
                disabled={loading}
              >
                <option value="dust">Bụi vàng thiền định lấp lánh</option>
                <option value="lotus">Cánh hoa sen rơi lơ lửng</option>
                <option value="rays">Tia nắng mặt trời lung linh</option>
                <option value="none">Không dùng hiệu ứng hạt</option>
              </select>
            </div>
          </div>

          {/* Voice and background music */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ flex: 1 }}>
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
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
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
                <optgroup label="Nhạc mặc định (Online)">
                  <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3">Thiền tịch thanh tao 1</option>
                  <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3">Suối thiền tĩnh tâm 2</option>
                  <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3">Chuông chùa an nhiên 3</option>
                </optgroup>
                {localMusicFiles.length > 0 && (
                  <optgroup label="Nhạc nền tự chọn (Thư mục local)">
                    {localMusicFiles.map((file, idx) => (
                      <option key={idx} value={file.fileUrl}>
                        🎵 {file.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          {voice === 'vieneu-local-clone' && (
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
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={loading}
            style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, var(--success) 0%, #15803d 100%)', boxShadow: '0 4px 15px rgba(34, 197, 94, 0.25)' }}
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

      {/* Video Panel */}
      <div className="workspace-right">
        <VideoPlayerPanel 
          slides={slides}
          subtitles={subtitles}
          audioUrl={audioUrl}
          bgMusicUrl={bgMusic}
          type="buddhist"
          shopeeProps={{
            ambientSfx,
            particleType,
            subtitleStyle,
            subtitleY
          }}
          onSubtitleUpdate={handleSubtitleUpdate}
          onExport={handleExport}
          isExporting={isExporting}
          exportProgress={exportProgress}
        />
      </div>
    </div>
  );
}
