import React, { useState } from 'react';
import { Video, Loader, AlertTriangle, FileVideo, Download, Sliders } from 'lucide-react';
import VideoPlayerPanel from './VideoPlayerPanel';

const { ipcRenderer } = window.require('electron');

export default function DubberTab({ onLog }) {
  const [videoPath, setVideoPath] = useState('');
  const [sourceLang, setSourceLang] = useState('zh-CN'); // Default to Chinese Douyin
  const [targetVoice, setTargetVoice] = useState('vi-VN-HoaiMyNeural');
  
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState('');

  // Generated state to pass to VideoPlayerPanel for Remotion previewing
  const [slides, setSlides] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [audioUrl, setAudioUrl] = useState('');

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);

  const handleSelectVideo = async () => {
    try {
      const res = await ipcRenderer.invoke('select-video-file');
      if (res.success) {
        setVideoPath(res.filePath);
        onLog('Cloner', `Đã chọn video: ${res.filePath}`, 'info');
      } else {
        onLog('Cloner', res.error, 'error');
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const handleCloneVideo = async () => {
    if (!videoPath) {
      setError('Vui lòng chọn một video gốc.');
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
      // Stage 1: Extract original audio track from imported video
      setLoadingStage('Đang tách âm thanh gốc từ video...');
      onLog('Cloner', 'Đang trích xuất âm thanh video bằng FFmpeg...', 'info');
      const extRes = await ipcRenderer.invoke('video-extract-audio', { videoPath });
      if (!extRes.success) throw new Error(extRes.error);
      const audioWavPath = extRes.filePath;
      onLog('Cloner', `Tách âm thanh thành công: ${audioWavPath}`, 'success');

      // Stage 2: CapCut ASR Transcription in source language
      setLoadingStage('Đang gửi âm thanh lên CapCut ASR để dịch giọng nói...');
      onLog('Cloner', `Nhận dạng giọng nói gốc với ngôn ngữ nguồn: ${sourceLang}...`, 'info');
      const asrRes = await ipcRenderer.invoke('capcut-asr-transcribe', {
        audioPath: `file://${audioWavPath.replace(/\\/g, '/')}`,
        options: { language: sourceLang, needWordTimestamp: false }
      });
      if (!asrRes.success) throw new Error(asrRes.error);
      const segments = asrRes.segments;
      if (segments.length === 0) {
        throw new Error("Không phát hiện thấy lời thoại hoặc nhân vật nói trong video gốc.");
      }
      onLog('Cloner', `Nhận dạng thành công ${segments.length} lời thoại gốc.`, 'success');

      // Stage 3: Translate and Generate Image Prompts for Re-creation (MMO Re-up style)
      setLoadingStage('Gemini đang biên dịch kịch bản & lên prompt tạo ảnh mới...');
      onLog('Cloner', 'Gửi lời thoại gốc lên Gemini để dịch nghĩa và tạo mô tả cảnh ảnh...', 'info');
      
      const systemPrompt = `Bạn là chuyên gia sản xuất lại nội dung video (Re-up/Re-create bán content) chuyên nghiệp cho TikTok/Douyin. Hãy dịch lời thoại sang tiếng Việt và mô tả khung cảnh tương đương bằng tiếng Anh để vẽ lại bằng AI. Trả về cấu trúc JSON.`;
      
      const userPrompt = `Hãy dịch danh sách lời thoại sau sang tiếng Việt súc tích, tự nhiên và tạo mô tả hình ảnh người que hoặc hoạt hình tương tự để chúng ta sinh ảnh mới thay thế video gốc.
Lời thoại gốc:
${JSON.stringify(segments.map((s, idx) => ({ id: idx, text: s.text, start_time: s.start_time, end_time: s.end_time })))}

Trả về duy nhất đối tượng JSON chứa mảng "clonedSegments", mỗi phân cảnh gồm:
- "start_time": giữ nguyên
- "end_time": giữ nguyên
- "translatedText": lời thoại dịch tiếng Việt tự nhiên
- "imagePrompt": mô tả vẽ ảnh 2D hoạt hình/người que bằng tiếng Anh phù hợp ngữ cảnh của câu.`;

      const geminiModel = localStorage.getItem('gemini_model') || 'gemini-3.1-flash-lite';
      const geminiRes = await ipcRenderer.invoke('gemini-generate', { apiKey, systemPrompt, userPrompt, geminiModel });
      if (!geminiRes.success) throw new Error(geminiRes.error);
      const clonedSegments = geminiRes.data.clonedSegments;
      onLog('Cloner', 'Đã dịch lời thoại và lên ý tưởng vẽ lại hình ảnh thành công.', 'success');

      // Stage 4: Synthesize individual dubbed voices
      setLoadingStage('Đang lồng tiếng Việt khớp mốc thời gian thoại gốc...');
      onLog('Cloner', 'Đang tạo giọng lồng tiếng Việt qua Edge-TTS...', 'info');
      const fullVocalText = clonedSegments.map(s => s.translatedText).join(' ');
      const ttsRes = await ipcRenderer.invoke('edge-tts-synthesize', {
        text: fullVocalText,
        options: { voice: targetVoice, rate: '+5%' }
      });
      if (!ttsRes.success) throw new Error(ttsRes.error);
      const localAudioUrl = ttsRes.filePath;
      setAudioUrl(localAudioUrl);
      onLog('Cloner', 'Lồng tiếng Việt thành công.', 'success');

      // Stage 5: CapCut ASR to get Vietnamese word timestamps
      setLoadingStage('Đang phân tích thời gian phụ đề Karaoke tiếng Việt...');
      onLog('Cloner', 'Đang đồng bộ phụ đề Karaoke tiếng Việt qua CapCut ASR...', 'info');
      const asrVnRes = await ipcRenderer.invoke('capcut-asr-transcribe', {
        audioPath: localAudioUrl,
        options: { language: 'vi-VN', needWordTimestamp: true }
      });
      if (!asrVnRes.success) throw new Error(asrVnRes.error);
      setSubtitles(asrVnRes.segments);
      onLog('Cloner', 'Đồng bộ phụ đề thành công.', 'success');

      // Stage 6: Generate new replacement AI images from Pollinations.ai (Bán Content / Clone)
      setLoadingStage('AI đang vẽ lại toàn bộ các bức ảnh thay thế video gốc...');
      onLog('Cloner', 'Đang tải các tranh phác họa AI mới đại diện cho các phân cảnh từ Pollinations...', 'info');
      
      const localImages = [];
      for (let i = 0; i < clonedSegments.length; i++) {
        const rawPrompt = clonedSegments[i].imagePrompt;
        // Reinforce minimalist drawing styles to prevent wild renders
        const formattedPrompt = `Minimalist stickman cartoon drawing, white background, simple black lines, funny pose, ${rawPrompt}, vertical aspect ratio, 1080x1920`;
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(formattedPrompt)}?width=1080&height=1920&nologo=true`;
        
        onLog('Cloner', `Đang vẽ lại phân cảnh ${i + 1} với mô tả: "${rawPrompt.substring(0, 35)}..."`, 'info');
        const dlRes = await ipcRenderer.invoke('download-image', { imageUrl: pollinationsUrl });
        if (dlRes.success) {
          localImages.push(dlRes.filePath);
        } else {
          onLog('Cloner', `Lỗi tải ảnh phân cảnh ${i + 1}: ${dlRes.error}`, 'error');
        }
      }
      onLog('Cloner', `Đã tải về máy thành công ${localImages.length} bức ảnh AI mới thay thế.`, 'success');

      // Stage 7: Align images to video timing
      const lastWordSeg = asrVnRes.segments[asrVnRes.segments.length - 1];
      const audioDurationMs = lastWordSeg ? lastWordSeg.end_time : 12000;
      const audioDurationFrames = Math.ceil((audioDurationMs / 1000) * 30);

      const computedSlides = [];
      let currentFrame = 0;
      const segmentDurationFrames = Math.floor(audioDurationFrames / clonedSegments.length);

      clonedSegments.forEach((item, index) => {
        computedSlides.push({
          imageUrl: localImages[index % localImages.length] || localImages[0],
          startFrame: currentFrame,
          durationFrames: index === clonedSegments.length - 1 
            ? (audioDurationFrames - currentFrame) 
            : segmentDurationFrames
        });
        currentFrame += segmentDurationFrames;
      });

      setSlides(computedSlides);
      onLog('Cloner', 'Đã thay thế toàn bộ hình ảnh và đồng bộ hóa lời thoại.', 'success');
      onLog('Cloner', 'Clone video hoàn tất! Bạn có thể xem trước.', 'success');

    } catch (err) {
      setError(err.message);
      onLog('Cloner', `Lỗi nhân bản video: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress({ percent: 0, message: 'Khởi chạy kết xuất video clone...' });
    onLog('Cloner', 'Bắt đầu xuất video lồng tiếng & thay thế hình ảnh AI...', 'info');

    const progressListener = (event, progress) => {
      setExportProgress(progress);
    };
    ipcRenderer.on('render-progress', progressListener);

    try {
      const inputProps = {
        slides,
        subtitles,
        audioUrl,
        bgMusicUrl: '', // keep background quiet or mix manually
        type: 'stickman' // reuse stickman transitions for clean render
      };

      const res = await ipcRenderer.invoke('remotion-render', {
        inputProps,
        compositionId: 'StickmanVideo'
      });

      if (res.success) {
        onLog('Cloner', `Xuất video clone bán content thành công! File: ${res.filePath}`, 'success');
        alert(`Xuất video thành công! File lưu tại: ${res.filePath}`);
      } else {
        throw new Error(res.error);
      }
    } catch (e) {
      onLog('Cloner', `Lỗi xuất video: ${e.message}`, 'error');
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
      onLog('Editor', `Cập nhật từ phụ đề video clone: "${newValue}"`, 'info');
    }
  };

  return (
    <div className="tab-content">
      {/* Settings column */}
      <div className="workspace-left" style={{ flex: 1.1 }}>
        <div className="glass-panel">
          <h2 style={{ fontSize: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Video size={20} style={{ color: 'var(--secondary)' }} /> Clone Video douyin/Vlog thành Video AI Mới
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
            Tải lên video người que hoặc hoạt hình gốc. Hệ thống sẽ dùng CapCut ASR tách lời thoại, Gemini dịch nghĩa và tự động vẽ lại hình ảnh phác họa mới từ AI để tạo ra video bán content độc lập hoàn chỉnh.
          </p>

          <div className="form-group">
            <label className="form-label">Chọn Video Gốc (Douyin/TikTok/Vlog)</label>
            <div style={{ display: 'flex', gap: 12 }}>
              <input
                type="text"
                className="form-input"
                value={videoPath}
                placeholder="Chọn file video từ máy tính của bạn..."
                readOnly
              />
              <button 
                className="btn btn-secondary" 
                onClick={handleSelectVideo}
                disabled={loading}
                style={{ whiteSpace: 'nowrap', padding: '10px 18px' }}
              >
                Chọn File
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Ngôn ngữ gốc video</label>
              <select 
                className="form-input"
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                disabled={loading}
              >
                <option value="zh-CN">Tiếng Trung (zh-CN) - Douyin</option>
                <option value="en-US">Tiếng Anh (en-US)</option>
                <option value="vi-VN">Tiếng Việt (vi-VN)</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Giọng lồng tiếng Việt</label>
              <select 
                className="form-input"
                value={targetVoice}
                onChange={(e) => setTargetVoice(e.target.value)}
                disabled={loading}
              >
                <option value="vi-VN-HoaiMyNeural">Hoài My (Giọng nữ biểu cảm - Khuyên dùng)</option>
                <option value="vi-VN-NamMinhNeural">Nam Minh (Giọng nam trầm ấm)</option>
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleCloneVideo}
            disabled={loading || !videoPath}
            style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, var(--secondary) 0%, #0891b2 100%)', boxShadow: '0 4px 15px rgba(6, 182, 212, 0.3)' }}
          >
            {loading ? (
              <>
                <Loader size={18} className="spinner-spin" style={{ marginRight: 8 }} />
                <span>{loadingStage}</span>
              </>
            ) : (
              'Bắt đầu Thay Thế Ảnh AI & Lồng Tiếng'
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

      {/* Video preview column */}
      <div className="workspace-right" style={{ flex: 0.9, minWidth: 380 }}>
        <VideoPlayerPanel 
          slides={slides}
          subtitles={subtitles}
          audioUrl={audioUrl}
          bgMusicUrl={''}
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
