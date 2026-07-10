import React, { useState } from 'react';
import { Video, Loader, AlertTriangle, Play, FileVideo, CheckCircle2 } from 'lucide-react';

const { ipcRenderer } = window.require('electron');

export default function DubberTab({ onLog }) {
  const [videoPath, setVideoPath] = useState('');
  const [sourceLang, setSourceLang] = useState('en-US');
  const [targetVoice, setTargetVoice] = useState('vi-VN-NamMinhNeural');
  
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState('');

  // Creation outputs
  const [dubbedVideoUrl, setDubbedVideoUrl] = useState('');
  const [transcript, setTranscript] = useState([]);

  const handleSelectVideo = async () => {
    try {
      const res = await ipcRenderer.invoke('select-video-file');
      if (res.success) {
        setVideoPath(res.filePath);
        onLog('Dubber', `Đã chọn video: ${res.filePath}`, 'info');
      } else {
        onLog('Dubber', res.error, 'error');
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDubVideo = async () => {
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
    setDubbedVideoUrl('');
    setTranscript([]);

    try {
      // Stage 1: Extract audio track from video
      setLoadingStage('Đang tách âm thanh gốc từ video...');
      onLog('Dubber', 'Đang trích xuất track âm thanh của video bằng FFmpeg...', 'info');
      const extRes = await ipcRenderer.invoke('video-extract-audio', { videoPath });
      if (!extRes.success) throw new Error(extRes.error);
      const audioWavPath = extRes.filePath;
      onLog('Dubber', `Tách âm thanh thành công: ${audioWavPath}`, 'success');

      // Stage 2: CapCut ASR Transcription in source language
      setLoadingStage('Đang gửi âm thanh lên CapCut ASR để nhận dạng giọng nói...');
      onLog('Dubber', `Nhận dạng giọng nói gốc với ngôn ngữ nguồn: ${sourceLang}...`, 'info');
      const asrRes = await ipcRenderer.invoke('capcut-asr-transcribe', {
        audioPath: `file://${audioWavPath.replace(/\\/g, '/')}`,
        options: { language: sourceLang, needWordTimestamp: false }
      });
      if (!asrRes.success) throw new Error(asrRes.error);
      const segments = asrRes.segments;
      if (segments.length === 0) {
        throw new Error("Không phát hiện thấy lời thoại trong video gốc.");
      }
      onLog('Dubber', `Tách giọng nói thành công! Nhận diện được ${segments.length} câu nói.`, 'success');

      // Stage 3: Translate transcription using Gemini
      setLoadingStage('Gemini đang dịch thuật kịch bản nói sang Tiếng Việt...');
      onLog('Dubber', 'Gửi lời thoại gốc lên Gemini để dịch nghĩa khớp thời gian...', 'info');
      
      const systemPrompt = `Bạn là chuyên gia dịch thuật video chuyên nghiệp. Hãy dịch các phân đoạn thoại tiếng Anh/Trung sang tiếng Việt tự nhiên, phù hợp văn phong nói lồng tiếng Việt Nam. Giữ nguyên mốc thời gian. Trả về đối tượng JSON đúng cấu trúc.`;
      
      const userPrompt = `Hãy dịch danh sách lời thoại sau sang tiếng Việt tự nhiên:
${JSON.stringify(segments.map((s, idx) => ({ id: idx, text: s.text, start_time: s.start_time, end_time: s.end_time })))}

Trả về duy nhất một đối tượng JSON có thuộc tính "translations" là một mảng các phần tử có cấu trúc:
- "start_time": giữ nguyên của câu
- "end_time": giữ nguyên của câu
- "text": câu dịch tiếng Việt tương ứng.`;

      const geminiModel = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
      const geminiRes = await ipcRenderer.invoke('gemini-generate', { apiKey, systemPrompt, userPrompt, geminiModel });
      if (!geminiRes.success) throw new Error(geminiRes.error);
      const translations = geminiRes.data.translations;
      setTranscript(translations);
      onLog('Dubber', 'Dịch thuật kịch bản hoàn tất.', 'success');

      // Stage 4: Synthesize individual segment audios and auto time-stretch
      setLoadingStage('Đang lồng tiếng Việt từng câu khớp thời gian gốc...');
      onLog('Dubber', 'Đang tạo giọng nói lồng tiếng từng câu thông qua Edge-TTS...', 'info');
      
      const dubbedSegments = [];
      for (let i = 0; i < translations.length; i++) {
        const seg = translations[i];
        const segDurationMs = seg.end_time - seg.start_time;

        onLog('Dubber', `Lồng tiếng câu ${i + 1}/${translations.length}: "${seg.text.substring(0, 20)}..." (Thời lượng gốc: ${segDurationMs}ms)`, 'info');
        
        // Synthesize single segment
        const ttsRes = await ipcRenderer.invoke('edge-tts-synthesize', {
          text: seg.text,
          options: { voice: targetVoice, rate: '+0%' }
        });

        if (ttsRes.success) {
          dubbedSegments.push({
            filePath: ttsRes.filePath,
            start_time: seg.start_time,
            end_time: seg.end_time
          });
        } else {
          onLog('Dubber', `Lỗi lồng tiếng câu ${i + 1}: ${ttsRes.error}`, 'error');
        }
      }

      // Stage 5: Merge back with original video
      setLoadingStage('Đang hòa âm lồng tiếng và ghép trộn video...');
      onLog('Dubber', 'Đang trộn lồng tiếng mới với âm thanh nền video gốc...', 'info');
      const mergeRes = await ipcRenderer.invoke('video-dub-merge', {
        videoPath,
        segments: dubbedSegments
      });
      if (!mergeRes.success) throw new Error(mergeRes.error);

      setDubbedVideoUrl(mergeRes.filePath);
      onLog('Dubber', `Lồng tiếng video thành công! Video đã lưu: ${mergeRes.filePath}`, 'success');

    } catch (err) {
      setError(err.message);
      onLog('Dubber', `Lỗi nhân bản/lồng tiếng: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  return (
    <div className="tab-content" style={{ display: 'flex', gap: 32 }}>
      {/* Settings column */}
      <div className="workspace-left" style={{ flex: 1.1 }}>
        <div className="glass-panel">
          <h2 style={{ fontSize: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Video size={20} style={{ color: 'var(--secondary)' }} /> Nhân Bản & Lồng Tiếng Video AI
          </h2>

          <div className="form-group">
            <label className="form-label">Chọn Video Gốc</label>
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
                <option value="en-US">Tiếng Anh (en-US)</option>
                <option value="zh-CN">Tiếng Trung Quốc (zh-CN)</option>
                <option value="ja-JP">Tiếng Nhật Bản (ja-JP)</option>
                <option value="ko-KR">Tiếng Hàn Quốc (ko-KR)</option>
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
                <option value="vi-VN-NamMinhNeural">Nam Minh (Giọng nam rõ ràng - Phù hợp vlog)</option>
                <option value="vi-VN-HoaiMyNeural">Hoài My (Giọng nữ hoạt ngôn - Phù hợp review)</option>
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleDubVideo}
            disabled={loading || !videoPath}
            style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, var(--secondary) 0%, #0891b2 100%)', boxShadow: '0 4px 15px rgba(6, 182, 212, 0.3)' }}
          >
            {loading ? (
              <>
                <Loader size={18} className="spin" style={{ marginRight: 8 }} />
                <span>{loadingStage}</span>
              </>
            ) : (
              'Bắt đầu Nhân Bản & Lồng Tiếng'
            )}
          </button>

          {error && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: 13, background: 'rgba(239, 68, 68, 0.08)', padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Translation details if finished */}
        {transcript.length > 0 && (
          <div className="glass-panel" style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 14, marginBottom: 12, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Lời thoại đã dịch</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto', paddingRight: 10 }}>
              {transcript.map((item, idx) => (
                <div key={idx} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>Dòng #{idx + 1}</span>
                    <span>{(item.start_time / 1000).toFixed(2)}s -- {(item.end_time / 1000).toFixed(2)}s</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#e2e8f0' }}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Video preview column */}
      <div className="workspace-right" style={{ flex: 0.9, minWidth: 380 }}>
        <div className="glass-panel active" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ fontSize: 15, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Kết Quả Nhân Bản</h3>
          
          <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {dubbedVideoUrl ? (
              <video 
                src={dubbedVideoUrl} 
                controls 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : videoPath ? (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <video 
                  src={videoPath} 
                  style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.4 }}
                />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--text-muted)' }}>
                  <FileVideo size={32} />
                  <span style={{ fontSize: 12 }}>Đã tải Video gốc. Hãy nhấn lồng tiếng.</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                <FileVideo size={40} />
                <span>Chưa có video được chọn.</span>
              </div>
            )}
          </div>

          {dubbedVideoUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--success-zen)', fontSize: 13, background: 'rgba(16, 185, 129, 0.08)', padding: '12px', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.15)' }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>Đã hoàn thành! Bạn có thể phát video để nghe giọng lồng tiếng Việt hòa âm với nhạc nền gốc.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
