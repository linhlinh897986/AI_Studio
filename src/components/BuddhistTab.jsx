import React, { useState } from 'react';
import { Compass, Loader, AlertTriangle } from 'lucide-react';
import VideoPlayerPanel from './VideoPlayerPanel';

const { ipcRenderer } = window.require('electron');

export default function BuddhistTab({ onLog }) {
  const [topic, setTopic] = useState('Sự buông bỏ để tâm an nhiên');
  const [voice, setVoice] = useState('vi-VN-NamMinhNeural'); // Deep male voice for teachings
  const [bgMusic, setBgMusic] = useState('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3'); // Calm zen instrumental
  
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState('');

  // Generated state to pass to VideoPlayerPanel
  const [slides, setSlides] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [audioUrl, setAudioUrl] = useState('');

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);

  const handleGenerate = async () => {
    if (!topic) {
      setError('Vui lòng nhập chủ đề Phật pháp.');
      return;
    }
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      setError('Vui lòng cài đặt và xác thực Gemini API Key trong Tab Cấu Hình trước.');
      return;
    }

    setLoading(true);
    setError('');
    setSlides([]);
    setSubtitles([]);
    setAudioUrl('');

    try {
      // Stage 1: Call Gemini to write spiritual script and image prompts
      setLoadingStage('Gemini đang chiêm nghiệm viết bài giảng Phật pháp...');
      onLog('Buddhist', `Bắt đầu phân tích chủ đề: "${topic}"...`, 'info');
      
      const systemPrompt = `Bạn là một thiền sư hiền triết, am hiểu Phật Pháp sâu sắc. Hãy viết các câu triết lý sống bằng tiếng Việt mang tính thanh tịnh, chậm rãi, thư thái và bình yên. Trả về cấu trúc JSON bắt buộc.`;
      
      const userPrompt = `Hãy viết một bài giảng thiền ngắn gọn (khoảng 80-100 từ) về chủ đề "${topic}". Chia bài viết làm 4 phân đoạn.
Với mỗi phân đoạn, hãy cung cấp một mô tả hình ảnh tiếng Anh chi tiết để tạo ảnh thiền định.
Ví dụ mô tả ảnh: "Serene zen garden with bonzai, misty mountain, light rays, spiritual, clean, vertical format, 8k, photorealistic".

Trả về duy nhất định dạng JSON có cấu trúc sau:
{
  "title": "${topic}",
  "script": [
    {
      "text": "Câu triết lý tiếng Việt (khoảng 20 từ, chậm rãi)",
      "imagePrompt": "Mô tả ảnh tiếng Anh chi tiết"
    }
  ]
}`;

      const geminiModel = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
      const geminiRes = await ipcRenderer.invoke('gemini-generate', { apiKey, systemPrompt, userPrompt, geminiModel });
      if (!geminiRes.success) throw new Error(geminiRes.error);
      const generatedData = geminiRes.data.script;
      onLog('Buddhist', `Kịch bản triết lý hoàn tất. Lên kế hoạch tạo ${generatedData.length} phân cảnh thiền.`, 'success');

      // Stage 2: Synthesize slow calming speech
      setLoadingStage('Đang chuyển hóa triết lý thành giọng đọc thiền định...');
      onLog('Buddhist', 'Kết nối Edge-TTS để sinh giọng nói ấm áp, chậm rãi...', 'info');
      const fullText = generatedData.map(item => item.text).join(' ');
      const ttsRes = await ipcRenderer.invoke('edge-tts-synthesize', { 
        text: fullText, 
        options: { voice, rate: '-12%' } // Slowed down for meditative feel
      });
      if (!ttsRes.success) throw new Error(ttsRes.error);
      const localAudioUrl = ttsRes.filePath;
      setAudioUrl(localAudioUrl);
      onLog('Buddhist', 'Tạo giọng đọc triết lý thành công.', 'success');

      // Stage 3: CapCut ASR
      setLoadingStage('Đang đồng bộ từ vựng với CapCut ASR...');
      onLog('Buddhist', 'Gửi giọng thiền lên CapCut ASR để lấy mốc thời gian phụ đề...', 'info');
      const asrRes = await ipcRenderer.invoke('capcut-asr-transcribe', {
        audioPath: localAudioUrl,
        options: { language: 'vi-VN', needWordTimestamp: true }
      });
      if (!asrRes.success) throw new Error(asrRes.error);
      const asrSegments = asrRes.segments;
      setSubtitles(asrSegments);
      onLog('Buddhist', 'Đồng bộ phụ đề karaoke Phật pháp thành công.', 'success');

      // Stage 4: Generate and download AI images from Pollinations.ai
      setLoadingStage('Đang tạo và tải ảnh thiền định AI...');
      onLog('Buddhist', 'Đang yêu cầu tạo hình ảnh Phật pháp từ Pollinations.ai...', 'info');
      
      const localImages = [];
      for (let i = 0; i < generatedData.length; i++) {
        // Build prompt with vertical parameters
        const rawPrompt = generatedData[i].imagePrompt;
        const formattedPrompt = `${rawPrompt}, vertical aspect ratio, vertical frame, 1080x1920, zen, ultra high resolution, digital art`;
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(formattedPrompt)}?width=1080&height=1920&nologo=true`;
        
        onLog('Buddhist', `Đang kết xuất ảnh ${i + 1} với mô tả: "${rawPrompt.substring(0, 35)}..."`, 'info');
        const dlRes = await ipcRenderer.invoke('download-image', { imageUrl: pollinationsUrl });
        if (dlRes.success) {
          localImages.push(dlRes.filePath);
        } else {
          onLog('Buddhist', `Lỗi tạo ảnh phân cảnh ${i + 1}: ${dlRes.error}`, 'error');
        }
      }
      onLog('Buddhist', `Tạo và tải thành công ${localImages.length} ảnh thiền định về máy.`, 'success');

      // Stage 5: Sync slides to timing
      const lastWordSeg = asrSegments[asrSegments.length - 1];
      const audioDurationMs = lastWordSeg ? lastWordSeg.end_time : 15000;
      const audioDurationFrames = Math.ceil((audioDurationMs / 1000) * 30);

      const computedSlides = [];
      let currentFrame = 0;
      const segmentDurationFrames = Math.floor(audioDurationFrames / generatedData.length);

      generatedData.forEach((item, index) => {
        computedSlides.push({
          imageUrl: localImages[index % localImages.length] || localImages[0],
          startFrame: currentFrame,
          durationFrames: index === generatedData.length - 1 
            ? (audioDurationFrames - currentFrame) 
            : segmentDurationFrames
        });
        currentFrame += segmentDurationFrames;
      });

      setSlides(computedSlides);
      onLog('Buddhist', 'Đồng bộ hóa hình ảnh thiền định với giọng thiền hoàn tất.', 'success');
      onLog('Buddhist', 'Khởi tạo Video Phật pháp thành công!', 'success');

    } catch (err) {
      setError(err.message);
      onLog('Buddhist', `Lỗi tạo video: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress({ percent: 0, message: 'Khởi chạy kết xuất video Phật pháp...' });
    onLog('Buddhist', 'Bắt đầu xuất video thiền định MP4...', 'info');

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
        type: 'buddhist'
      };

      const res = await ipcRenderer.invoke('remotion-render', {
        inputProps,
        compositionId: 'BuddhistVideo'
      });

      if (res.success) {
        onLog('Buddhist', `Xuất video thành công! File: ${res.filePath}`, 'success');
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
      onLog('Editor', `Cập nhật từ tại câu ${segmentIdx + 1}: "${newValue}"`, 'info');
    }
  };

  return (
    <div className="tab-content">
      {/* Input panel */}
      <div className="workspace-left">
        <div className="glass-panel">
          <h2 style={{ fontSize: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Compass size={20} style={{ color: 'var(--success-zen)' }} /> Tạo Video Phật Pháp & Triết Lý
          </h2>

          <div className="form-group">
            <label className="form-label">Chủ đề bài giảng / triết lý</label>
            <input
              type="text"
              className="form-input"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={loading}
              placeholder="Nhập chủ đề triết lý (ví dụ: Sự buông bỏ, gieo nhân gặt quả, rèn tâm yên tĩnh...)"
            />
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Giọng thiền sư</label>
              <select 
                className="form-input"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                disabled={loading}
              >
                <option value="vi-VN-NamMinhNeural">Nam Minh (Giọng nam trầm ấm, truyền cảm - Rất khuyên dùng)</option>
                <option value="vi-VN-HoaiMyNeural">Hoài My (Giọng nữ chậm rãi, nhẹ nhàng)</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Nhạc thiền nền (Zen Music)</label>
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
            disabled={loading}
            style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, var(--success-zen) 0%, #047857 100%)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' }}
          >
            {loading ? (
              <>
                <Loader size={18} className="spin" style={{ marginRight: 8 }} />
                <span>{loadingStage}</span>
              </>
            ) : (
              'Bắt đầu Khởi tạo Video Phật Pháp'
            )}
          </button>

          {error && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: 13, background: 'rgba(239, 68, 68, 0.08)', padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
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
          onSubtitleUpdate={handleSubtitleUpdate}
          onExport={handleExport}
          isExporting={isExporting}
          exportProgress={exportProgress}
        />
      </div>
    </div>
  );
}
