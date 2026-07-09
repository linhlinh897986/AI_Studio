import React, { useState } from 'react';
import { Smile, Loader, AlertTriangle } from 'lucide-react';
import VideoPlayerPanel from './VideoPlayerPanel';

const { ipcRenderer } = window.require('electron');

export default function StickmanTab({ onLog }) {
  const [prompt, setPrompt] = useState('Chuyện người que Bob tập nấu trứng và làm cháy bếp');
  const [voice, setVoice] = useState('vi-VN-HoaiMyNeural');
  const [bgMusic, setBgMusic] = useState('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'); // Funny music
  
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
    if (!prompt) {
      setError('Vui lòng nhập ý tưởng truyện người que.');
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
      // Stage 1: Gemini storyboards
      setLoadingStage('Gemini đang vẽ kịch bản phân cảnh người que hài hước...');
      onLog('Stickman', `Bắt đầu soạn thảo truyện: "${prompt}"...`, 'info');

      const systemPrompt = `Bạn là biên kịch truyện tranh người que (stickman) hài hước. Hãy viết truyện ngắn tiếng Việt dí dỏm và cung cấp prompt tiếng Anh tương ứng để vẽ nhân vật người que. Trả về định dạng JSON bắt buộc.`;
      
      const userPrompt = `Hãy sáng tác truyện ngắn hài hước (khoảng 80 từ) về: "${prompt}". Chia làm 4 phân cảnh.
Với mỗi phân cảnh, cung cấp:
- "text": Câu dẫn chuyện hoặc lời hội thoại tiếng Việt ngắn gọn, hài hước.
- "imagePrompt": Mô tả vẽ nhân vật người que bằng tiếng Anh. Luôn bắt đầu bằng cụm: "Minimalist stickman cartoon drawing, white background, simple black lines, funny pose, [specific action here], clean lines, vector style".

Trả về duy nhất định dạng JSON có cấu trúc sau:
{
  "script": [
    {
      "text": "Lời dẫn hoặc thoại phân cảnh 1",
      "imagePrompt": "Mô tả vẽ stickman phân cảnh 1"
    }
  ]
}`;

      const geminiModel = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
      const geminiRes = await ipcRenderer.invoke('gemini-generate', { apiKey, systemPrompt, userPrompt, geminiModel });
      if (!geminiRes.success) throw new Error(geminiRes.error);
      const generatedData = geminiRes.data.script;
      onLog('Stickman', `Biên kịch kịch bản người que xong. Gồm ${generatedData.length} trang truyện.`, 'success');

      // Stage 2: Edge-TTS voice synthesis
      setLoadingStage('Đang lồng tiếng vui nhộn cho câu chuyện...');
      onLog('Stickman', 'Kết nối Edge-TTS lồng tiếng biểu cảm...', 'info');
      const fullText = generatedData.map(item => item.text).join(' ');
      const ttsRes = await ipcRenderer.invoke('edge-tts-synthesize', { 
        text: fullText, 
        options: { voice, rate: '+10%' } // Faster and funnier
      });
      if (!ttsRes.success) throw new Error(ttsRes.error);
      const localAudioUrl = ttsRes.filePath;
      setAudioUrl(localAudioUrl);
      onLog('Stickman', 'Tạo giọng đọc dẫn truyện thành công.', 'success');

      // Stage 3: CapCut ASR
      setLoadingStage('Đang tạo thời gian phụ đề động bằng CapCut ASR...');
      onLog('Stickman', 'Gửi audio truyện lên CapCut ASR để đồng bộ phụ đề...', 'info');
      const asrRes = await ipcRenderer.invoke('capcut-asr-transcribe', {
        audioPath: localAudioUrl,
        options: { language: 'vi-VN', needWordTimestamp: true }
      });
      if (!asrRes.success) throw new Error(asrRes.error);
      const asrSegments = asrRes.segments;
      setSubtitles(asrSegments);
      onLog('Stickman', 'Đồng bộ phụ đề karaoke thành công.', 'success');

      // Stage 4: Draw and download stickman frames from Pollinations.ai
      setLoadingStage('Đang vẽ phác họa các hình ảnh người que...');
      onLog('Stickman', 'Đang yêu cầu phác họa ảnh người que bằng nét đen nền trắng từ AI...', 'info');
      
      const localImages = [];
      for (let i = 0; i < generatedData.length; i++) {
        const rawPrompt = generatedData[i].imagePrompt;
        const formattedPrompt = `${rawPrompt}, high contrast, sharp details`;
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(formattedPrompt)}?width=1080&height=1920&nologo=true`;
        
        onLog('Stickman', `Đang vẽ tranh phân cảnh ${i + 1}: "${rawPrompt.substring(50, 85)}..."`, 'info');
        const dlRes = await ipcRenderer.invoke('download-image', { imageUrl: pollinationsUrl });
        if (dlRes.success) {
          localImages.push(dlRes.filePath);
        } else {
          onLog('Stickman', `Lỗi tải tranh phân cảnh ${i + 1}: ${dlRes.error}`, 'error');
        }
      }
      onLog('Stickman', `Đã tải về máy thành công ${localImages.length} tranh vẽ người que.`, 'success');

      // Stage 5: Sync slides to timing
      const lastWordSeg = asrSegments[asrSegments.length - 1];
      const audioDurationMs = lastWordSeg ? lastWordSeg.end_time : 12000;
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
      onLog('Stickman', 'Đồng bộ hình vẽ truyện tranh với âm thanh hoàn tất.', 'success');
      onLog('Stickman', 'Khởi tạo Video Người que thành công!', 'success');

    } catch (err) {
      setError(err.message);
      onLog('Stickman', `Lỗi tạo video: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress({ percent: 0, message: 'Khởi chạy kết xuất truyện người que...' });
    onLog('Stickman', 'Bắt đầu xuất video MP4 nét vẽ người que...', 'info');

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
        type: 'stickman'
      };

      const res = await ipcRenderer.invoke('remotion-render', {
        inputProps,
        compositionId: 'StickmanVideo'
      });

      if (res.success) {
        onLog('Stickman', `Xuất video người que thành công! File: ${res.filePath}`, 'success');
        alert(`Xuất video thành công! File lưu tại: ${res.filePath}`);
      } else {
        throw new Error(res.error);
      }
    } catch (e) {
      onLog('Stickman', `Lỗi xuất video: ${e.message}`, 'error');
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
      onLog('Editor', `Cập nhật từ phụ đề người que: "${newValue}"`, 'info');
    }
  };

  return (
    <div className="tab-content">
      {/* Config */}
      <div className="workspace-left">
        <div className="glass-panel">
          <h2 style={{ fontSize: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Smile size={20} style={{ color: 'var(--primary)' }} /> Tạo Video Người Que (Stickman AI)
          </h2>

          <div className="form-group">
            <label className="form-label">Ý tưởng / Cốt truyện ngắn</label>
            <textarea
              className="form-input form-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
              placeholder="Nhập cốt truyện ngắn vui nhộn (ví dụ: Người que Bob chơi trốn tìm với khủng long...)"
            />
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Giọng Dẫn Chuyện</label>
              <select 
                className="form-input"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                disabled={loading}
              >
                <option value="vi-VN-HoaiMyNeural">Hoài My (Giọng nữ hoạt bát, tươi trẻ)</option>
                <option value="vi-VN-NamMinhNeural">Nam Minh (Giọng nam rõ ràng, hài hước)</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Nhạc Nền Vui Nhộn</label>
              <select 
                className="form-input"
                value={bgMusic}
                onChange={(e) => setBgMusic(e.target.value)}
                disabled={loading}
              >
                <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3">Vui nhộn tăng động 1</option>
                <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3">Tươi sáng lí lắc 2</option>
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={loading}
            style={{ width: '100%', padding: '16px' }}
          >
            {loading ? (
              <>
                <Loader size={18} className="spin" style={{ marginRight: 8 }} />
                <span>{loadingStage}</span>
              </>
            ) : (
              'Bắt đầu Tạo Truyện Người Que AI'
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

      {/* Preview player */}
      <div className="workspace-right">
        <VideoPlayerPanel 
          slides={slides}
          subtitles={subtitles}
          audioUrl={audioUrl}
          bgMusicUrl={bgMusic}
          type="stickman"
          onSubtitleUpdate={handleSubtitleUpdate}
          onExport={handleExport}
          isExporting={isExporting}
          exportProgress={exportProgress}
        />
      </div>
    </div>
  );
}
