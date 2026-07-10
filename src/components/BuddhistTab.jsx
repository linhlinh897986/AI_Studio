import React, { useState, useEffect } from 'react';
import { Compass, Loader, AlertTriangle, BookOpen, Sun, Wind, Type, FileText, Upload, Sliders, Layers } from 'lucide-react';
import VideoPlayerPanel from './VideoPlayerPanel';

const { ipcRenderer } = window.require('electron');

const CURATED_PDFS = [
  {
    title: "Kinh Địa Tạng Bồ Tát Bổn Nguyện (HT. Thích Trí Tịnh dịch)",
    url: "https://www.daotranglienhoa.com/wp-content/uploads/2020/05/Kinh-Dia-Tang-HT-Thich-Tri-Tinh.pdf",
    desc: "Bộ kinh nổi tiếng về chữ hiếu, công đức độ sanh và thế giới u minh."
  },
  {
    title: "Kinh Diệu Pháp Liên Hoa (Kinh Pháp Hoa - HT. Thích Trí Tịnh)",
    url: "https://www.daotranglienhoa.com/wp-content/uploads/2020/05/Kinh-Phap-Hoa-HT-Thich-Tri-Tinh.pdf",
    desc: "Vua của các kinh điển Đại Thừa, khai mở tri kiến Phật cho mọi chúng sinh."
  },
  {
    title: "Kinh Pháp Cú (Dhammapada - HT. Thích Minh Châu dịch)",
    url: "https://daotranglienhoa.com/wp-content/uploads/2020/05/Kinh-Phap-Cu-HT-Thich-Minh-Chau.pdf",
    desc: "423 câu thi kệ ngắn gọn chứa đựng tinh hoa triết lý giải thoát."
  },
  {
    title: "Kinh Kim Cang Bát Nhã Ba La Mật (HT. Thích Trí Tịnh dịch)",
    url: "https://www.daotranglienhoa.com/wp-content/uploads/2020/05/Kinh-Kim-Cang-HT-Thich-Tri-Tinh.pdf",
    desc: "Kinh điển tối thượng luận giải về tính Không và trí tuệ giải thoát."
  },
  {
    title: "Kinh A Di Đà (HT. Thích Trí Tịnh dịch)",
    url: "https://www.daotranglienhoa.com/wp-content/uploads/2020/05/Kinh-A-Di-Da-HT-Thich-Tri-Tinh.pdf",
    desc: "Kinh điển nền tảng hướng tâm về thế giới Tây Phương Cực Lạc thanh tịnh."
  },
  {
    title: "Bước Đầu Học Phật (HT. Thích Thanh Từ)",
    url: "https://thuvienhoasen.org/images/file/GKrurg03GkzWjACY/buoc-dau-hoc-phat.pdf",
    desc: "Cẩm nang hướng dẫn căn bản về nhân quả, tu tập thiền định."
  },
  {
    title: "Phật Học Phổ Thông - Khóa I (HT. Thích Thiện Hoa)",
    url: "https://thuvienhoasen.org/images/file/GcfriO7hhcJA-7O8/phat-hoc-pho-thong-khoa-1.pdf",
    desc: "Giáo trình Phật giáo căn bản cho hàng Phật tử tại gia."
  }
];

export default function BuddhistTab({ onLog }) {
  // Batch video configuration
  const [numVideos, setNumVideos] = useState(1); // 1, 5, 10, 15
  const [selectedRefKey, setSelectedRefKey] = useState('free'); // free, local, or index of CURATED_PDFS
  
  const [sourceType, setSourceType] = useState('prompt'); // prompt, pdf
  const [topic, setTopic] = useState('Sự buông bỏ trong cuộc sống để tâm an nhiên, không tranh giành đố kỵ');
  const [voice, setVoice] = useState('vi-VN-NamMinhNeural');
  const [bgMusic, setBgMusic] = useState('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3');
  
  // Custom mechanisms states
  const [mood, setMood] = useState('nature');
  const [ambientSfx, setAmbientSfx] = useState('bell');
  const [particleType, setParticleType] = useState('dust');
  const [subtitleStyle, setSubtitleStyle] = useState('modern');

  // PDF specific states
  const [pdfFile, setPdfFile] = useState(null); // { name, path, url }
  const [pdfText, setPdfText] = useState('');
  const [pdfPagesCount, setPdfPagesCount] = useState(0);
  const [pdfStartPage, setPdfStartPage] = useState(1);
  const [pdfEndPage, setPdfEndPage] = useState(2);
  const [extractedExcerpt, setExtractedExcerpt] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

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

  // Approximate page slicer for pdf-parse text stream
  const extractPagesExcerpt = (fullText, totalPages, start, end) => {
    if (!fullText) return '';
    const cleanStart = Math.max(1, start);
    const cleanEnd = Math.max(cleanStart, end);

    const pages = fullText.split(/\x0c|\f/);
    if (pages.length >= totalPages - 1 && pages.length > 1) {
      const sliceStart = Math.max(0, cleanStart - 1);
      const sliceEnd = Math.min(pages.length, cleanEnd);
      return pages.slice(sliceStart, sliceEnd).join('\n').trim();
    }
    const charPerPage = Math.floor(fullText.length / (totalPages || 1));
    const startIndex = Math.max(0, (cleanStart - 1) * charPerPage);
    const endIndex = Math.min(fullText.length, cleanEnd * charPerPage);
    return fullText.substring(startIndex, endIndex).trim();
  };

  useEffect(() => {
    if (pdfText) {
      const excerpt = extractPagesExcerpt(pdfText, pdfPagesCount, pdfStartPage, pdfEndPage);
      setExtractedExcerpt(excerpt);
    }
  }, [pdfStartPage, pdfEndPage, pdfText]);

  // Handle reference material dropdown change
  const handleRefMaterialChange = async (val) => {
    setSelectedRefKey(val);
    if (val === 'free') {
      setSourceType('prompt');
      setPdfFile(null);
      setPdfText('');
      setExtractedExcerpt('');
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
    setPdfLoading(true);
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
      onLog('Buddhist', `Đang nạp PDF cục bộ: ${filePath.split('\\').pop()}...`, 'info');
      
      const parseRes = await ipcRenderer.invoke('buddhist-parse-pdf', { filePath });
      if (!parseRes.success) throw new Error(parseRes.error);
      
      setPdfFile({ name: filePath.split('\\').pop(), path: filePath });
      setPdfText(parseRes.text);
      setPdfPagesCount(parseRes.numpages);
      setPdfStartPage(1);
      setPdfEndPage(Math.min(parseRes.numpages, 2));
      
      onLog('Buddhist', `Đọc PDF thành công! Gồm ${parseRes.numpages} trang.`, 'success');
    } catch (e) {
      setError(`Lỗi đọc file PDF: ${e.message}`);
      setSelectedRefKey('free');
      setSourceType('prompt');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleLoadCuratedPdf = async (pdfItem) => {
    setPdfLoading(true);
    setError('');
    setPdfFile({ name: pdfItem.title, url: pdfItem.url });
    onLog('Buddhist', `Đang tải tài liệu Kinh điển: "${pdfItem.title}"...`, 'info');
    try {
      const parseRes = await ipcRenderer.invoke('buddhist-parse-pdf', { fileUrl: pdfItem.url });
      if (!parseRes.success) throw new Error(parseRes.error);
      
      setPdfText(parseRes.text);
      setPdfPagesCount(parseRes.numpages);
      setPdfStartPage(1);
      setPdfEndPage(Math.min(parseRes.numpages, 2));
      
      onLog('Buddhist', `Tải & Đọc tài liệu thành công! Gồm ${parseRes.numpages} trang.`, 'success');
    } catch (e) {
      setError(`Lỗi tải trực tuyến: ${e.message}. Hãy tải file PDF về máy và nạp cục bộ.`);
      onLog('Buddhist', `Lỗi tải: ${e.message}`, 'error');
      setSelectedRefKey('free');
      setSourceType('prompt');
    } finally {
      setPdfLoading(false);
    }
  };

  // Triggers generation (runs loop for batch mode)
  const handleGenerate = async () => {
    if (sourceType === 'prompt' && !topic) {
      setError('Vui lòng nhập ý tưởng chủ đề.');
      return;
    }
    if (sourceType === 'pdf' && !extractedExcerpt) {
      setError('Vui lòng chọn tài liệu tham khảo và trích xuất trang trước.');
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
      for (let i = 0; i < totalToGenerate; i++) {
        setCurrentBatchIdx(i);
        const stagePrefix = `[Video ${i + 1}/${totalToGenerate}]`;
        onLog('Buddhist', `${stagePrefix} Bắt đầu khởi tạo...`, 'info');

        // 1. Generate script
        setLoadingStage(`${stagePrefix} AI đang biên soạn kịch bản độc lập...`);
        const systemPrompt = `Bạn là một thiền sư hiền triết, am hiểu Phật Pháp sâu sắc. Hãy viết các câu triết lý sống bằng tiếng Việt mang tính thanh tịnh, chậm rãi, thư thái và bình yên. Trả về cấu trúc JSON bắt buộc.`;
        
        let moodVisualDetail = '';
        if (mood === 'temple') {
          moodVisualDetail = 'ancient misty temple, stone lanterns, slow rising incense smoke, warm golden morning sun, highly detailed vertical format';
        } else if (mood === 'nature') {
          moodVisualDetail = 'serene lush green bamboo forest, fresh morning dew drops, clear flowing stream water, slow zoom vertical format';
        } else if (mood === 'meditation') {
          moodVisualDetail = 'a dark silhouette of a Buddhist monk meditating peacefully under a giant bodhi tree, giant red sunset, absolute silence vertical format';
        } else if (mood === 'mystical') {
          moodVisualDetail = 'mystical glowing pink lotus flower floating on calm sacred water, galaxy stardust nebula night background, glowing rays vertical format';
        }

        let userPrompt = '';
        if (sourceType === 'prompt') {
          userPrompt = `Hãy viết một bài giảng thiền ngắn gọn (khoảng 80-100 từ) về chủ đề "${topic}". 
Đây là video số ${i + 1} trên tổng số ${totalToGenerate} video độc lập. Hãy viết kịch bản này khai thác một khía cạnh riêng biệt, hoàn toàn không trùng lặp ý tưởng với các video khác.
Chia bài viết làm 4 phân đoạn. Với mỗi phân đoạn, hãy cung cấp một mô tả hình ảnh tiếng Anh chi tiết để tạo ảnh thiền định.
Hãy luôn kết hợp các phân cảnh hình ảnh với phong cách không gian trực quan sau: "${moodVisualDetail}".

Trả về duy nhất định dạng JSON có cấu trúc sau:
{
  "title": "${topic.substring(0, 20)} - Phần ${i + 1}",
  "script": [
    {
      "text": "Câu triết lý tiếng Việt (khoảng 20 từ, giọng điệu thiền tịnh chậm rãi)",
      "imagePrompt": "Mô tả ảnh tiếng Anh chi tiết tích hợp hoàn hảo với phong cách không gian được cung cấp"
    }
  ]
}`;
        } else {
          userPrompt = `Hãy viết một bài giảng thiền ngắn gọn (khoảng 80-100 từ) dựa trên tài liệu Phật pháp trích dẫn dưới đây:
NỘI DUNG TÀI LIỆU TRÍCH DẪN:
"""
${extractedExcerpt.substring(0, 1500)}
"""

Đây là video số ${i + 1} trên tổng số ${totalToGenerate} video. Hãy đúc kết một chủ đề/bài học hoặc câu kinh cốt lõi khác biệt trong tài liệu trích dẫn để soạn bài giảng này, tránh trùng lặp nội dung với các phần khác.
Hãy chia bài viết làm 4 phân đoạn. Với mỗi phân đoạn cung cấp mô tả hình ảnh tiếng Anh chi tiết.
Hãy kết hợp hình ảnh với phong cách không gian sau: "${moodVisualDetail}".

Trả về duy nhất định dạng JSON có cấu trúc sau:
{
  "title": "Lời Phật Dạy - Tập ${i + 1}",
  "script": [
    {
      "text": "Câu triết lý tiếng Việt đúc kết từ tài liệu (khoảng 20 từ, chậm rãi)",
      "imagePrompt": "Mô tả ảnh tiếng Anh chi tiết tích hợp hoàn hảo với phong cách không gian được cung cấp"
    }
  ]
}`;
        }

        const geminiModel = localStorage.getItem('gemini_model') || 'gemini-3.1-flash-lite';
        const geminiRes = await ipcRenderer.invoke('gemini-generate', { apiKey, systemPrompt, userPrompt, geminiModel });
        if (!geminiRes.success) throw new Error(geminiRes.error);
        const generatedData = geminiRes.data.script;

        // 2. TTS Voiceover
        setLoadingStage(`${stagePrefix} Đang lồng tiếng thiền sư...`);
        const fullText = generatedData.map(item => item.text).join(' ');
        const ttsRes = await ipcRenderer.invoke('edge-tts-synthesize', { 
          text: fullText, 
          options: { voice, rate: '-15%' }
        });
        if (!ttsRes.success) throw new Error(ttsRes.error);
        const localAudioUrl = ttsRes.filePath;

        // 3. ASR Syncing
        setLoadingStage(`${stagePrefix} Đang chạy phụ đề karaoke...`);
        const asrRes = await ipcRenderer.invoke('capcut-asr-transcribe', {
          audioPath: localAudioUrl,
          options: { language: 'vi-VN', needWordTimestamp: true }
        });
        if (!asrRes.success) throw new Error(asrRes.error);
        const asrSegments = asrRes.segments;

        // 4. Image downloads
        setLoadingStage(`${stagePrefix} Đang tạo & tải ảnh thiền AI...`);
        const localImages = [];
        for (let j = 0; j < generatedData.length; j++) {
          const rawPrompt = generatedData[j].imagePrompt;
          const formattedPrompt = `${rawPrompt}, vertical aspect ratio, vertical frame, 1080x1920, zen, ultra high resolution, digital art`;
          const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(formattedPrompt)}?width=1080&height=1920&nologo=true`;
          
          const dlRes = await ipcRenderer.invoke('download-image', { imageUrl: pollinationsUrl });
          if (dlRes.success) {
            localImages.push(dlRes.filePath);
          } else {
            localImages.push(localImages[0] || ''); // fallback
          }
        }

        // 5. Build Slide timings
        const lastWordSeg = asrSegments[asrSegments.length - 1];
        const audioDurationMs = lastWordSeg ? lastWordSeg.end_time : 15000;
        const audioDurationFrames = Math.ceil((audioDurationMs / 1000) * 30);

        const computedSlides = [];
        let currentFrame = 0;
        const segmentDurationFrames = Math.floor(audioDurationFrames / generatedData.length);

        generatedData.forEach((item, idx) => {
          computedSlides.push({
            imageUrl: localImages[idx % localImages.length] || localImages[0],
            startFrame: currentFrame,
            durationFrames: idx === generatedData.length - 1 
              ? (audioDurationFrames - currentFrame) 
              : segmentDurationFrames
          });
          currentFrame += segmentDurationFrames;
        });

        // Set to local states (enables real-time preview of the LAST generated video)
        setSlides(computedSlides);
        setSubtitles(asrSegments);
        setAudioUrl(localAudioUrl);

        onLog('Buddhist', `${stagePrefix} Khởi tạo thành công cấu trúc video!`, 'success');

        // 6. IF batch size > 1, we automatically render/export to MP4 file on the fly!
        if (totalToGenerate > 1) {
          setLoadingStage(`${stagePrefix} Đang kết xuất video thành tệp MP4...`);
          onLog('Buddhist', `${stagePrefix} Bắt đầu kết xuất video MP4 tự động...`, 'info');

          const inputProps = {
            slides: computedSlides,
            subtitles: asrSegments,
            audioUrl: localAudioUrl,
            bgMusicUrl: bgMusic,
            type: 'buddhist',
            shopeeProps: {
              ambientSfx,
              particleType,
              subtitleStyle
            }
          };

          const renderRes = await ipcRenderer.invoke('remotion-render', {
            inputProps,
            compositionId: 'BuddhistVideo'
          });

          if (renderRes.success) {
            setBatchLogs(prev => [...prev, { success: true, path: renderRes.filePath }]);
            onLog('Buddhist', `${stagePrefix} Kết xuất MP4 thành công! File: ${renderRes.filePath}`, 'success');
          } else {
            setBatchLogs(prev => [...prev, { success: false, error: renderRes.error }]);
            onLog('Buddhist', `${stagePrefix} Lỗi kết xuất MP4: ${renderRes.error}`, 'error');
          }
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

    const progressListener = (event, progress) => {
      setExportProgress(progress);
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
          subtitleStyle
        }
      };

      const res = await ipcRenderer.invoke('remotion-render', {
        inputProps,
        compositionId: 'BuddhistVideo'
      });

      if (res.success) {
        onLog('Buddhist', `Kết xuất video thành công! File: ${res.filePath}`, 'success');
        alert(`Xuất video thành công! File lưu tại: ${res.filePath}`);
      } else {
        throw new Error(res.error);
      }
    } catch (e) {
      onLog('Buddhist', `Lỗi xuất video: ${e.message}`, 'error');
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

          {/* 1. Batch Quantity Selector */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={14} /> Số lượng video muốn sản xuất hàng loạt
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[1, 5, 10, 15].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setNumVideos(num)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: numVideos === num ? 'var(--success)' : 'var(--bg-surface-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    color: numVideos === num ? '#fff' : 'var(--text-primary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 13,
                    transition: 'all 200s'
                  }}
                >
                  {num} Video{num > 1 ? 's' : ''}
                </button>
              ))}
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
              disabled={loading || pdfLoading}
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

          {/* Prompt description input (only show if free topic selected) */}
          {selectedRefKey === 'free' && (
            <div className="form-group">
              <label className="form-label">Ý tưởng / Chủ đề bài giảng chi tiết</label>
              <input
                type="text"
                className="form-input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading}
                placeholder="Nhập chủ đề triết lý (ví dụ: Sự buông bỏ, luật nhân quả...)"
              />
            </div>
          )}

          {/* PDF Details Panel (only show if reference type is PDF) */}
          {sourceType === 'pdf' && pdfFile && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: '70%' }}>
                  📄 File: {pdfFile.name}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Tổng: {pdfPagesCount} trang
                </span>
              </div>

              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Từ trang:</span>
                  <input 
                    type="number" 
                    min="1" 
                    max={pdfPagesCount} 
                    value={pdfStartPage}
                    onChange={(e) => setPdfStartPage(parseInt(e.target.value) || 1)}
                    style={{ width: 60, padding: 6, background: 'var(--bg-dark)', border: '1px solid var(--border)', borderRadius: 8, color: '#fff', fontSize: 12 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Đến trang:</span>
                  <input 
                    type="number" 
                    min={pdfStartPage} 
                    max={pdfPagesCount} 
                    value={pdfEndPage}
                    onChange={(e) => setPdfEndPage(parseInt(e.target.value) || pdfStartPage)}
                    style={{ width: 60, padding: 6, background: 'var(--bg-dark)', border: '1px solid var(--border)', borderRadius: 8, color: '#fff', fontSize: 12 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nội dung trích xuất làm tư liệu tham khảo:</span>
                <textarea
                  className="form-input"
                  value={extractedExcerpt}
                  readOnly
                  style={{ height: 100, fontSize: 11, background: 'var(--bg-dark)', resize: 'none', padding: 12, color: 'var(--text-secondary)' }}
                  placeholder="Không có dữ liệu trích xuất."
                />
              </div>
            </div>
          )}

          {pdfLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, color: 'var(--success)', fontSize: 13, marginBottom: 20 }}>
              <Loader size={16} className="spin" /> Đang tải và phân tích cú pháp Ebook PDF...
            </div>
          )}

          {/* Visual settings */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sun size={14} /> Không gian (Visual Mood)
              </label>
              <select 
                className="form-input"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                disabled={loading}
              >
                <option value="nature">Trúc xanh & Suối chảy (Serene Nature)</option>
                <option value="temple">Chùa cổ & Khói sương (Ancient Temple)</option>
                <option value="meditation">Nhà sư & Bóng hoàng hôn (Bodhi Meditation)</option>
                <option value="mystical">Hồ sen phát sáng (Mystical Zen)</option>
              </select>
            </div>

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
                <option value="modern">Hiện đại (TikTok Karaoke nằm ngang)</option>
                <option value="calligraphy">Cổ kính (Thư pháp cuộn chạy dọc)</option>
              </select>
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
                <option value="vi-VN-NamMinhNeural">Nam Minh (Giọng nam trầm ấm - Khuyên dùng)</option>
                <option value="vi-VN-HoaiMyNeural">Hoài My (Giọng nữ chậm rãi, nhẹ nhàng)</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Nhạc nền (Zen Music)</label>
              <select 
                className="form-input"
                value={bgMusic}
                onChange={(e) => setBgMusic(e.target.value)}
                disabled={loading}
              >
                <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3">Thiền tịch thanh tao 1</option>
                <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3">Suối thiền tĩnh tâm 2</option>
                <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3">Chuông chùa an nhiên 3</option>
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={loading || pdfLoading}
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
            subtitleStyle
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
