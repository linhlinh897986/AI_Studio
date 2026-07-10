import React, { useState } from 'react';
import { Compass, Loader, AlertTriangle, BookOpen, Sun, Wind, Type, Play } from 'lucide-react';
import VideoPlayerPanel from './VideoPlayerPanel';

const { ipcRenderer } = window.require('electron');

const ZEN_PRESETS = [
  {
    title: "Buông bỏ phiền não",
    topic: "Sự buông bỏ trong cuộc sống để tâm an nhiên, không tranh giành đố kỵ",
    quote: "Buông bỏ không phải là từ bỏ tất cả, mà là không để bất kỳ thứ gì trói buộc tâm hồn ta."
  },
  {
    title: "Luật nhân quả",
    topic: "Luật nhân quả gieo nhân nào gặt quả nấy, sống lương thiện, tích đức",
    quote: "Gieo nhân lương thiện, gặt quả bình yên. Mọi sự gặp gỡ trong đời đều có nhân duyên."
  },
  {
    title: "Tâm bình thế giới bình",
    topic: "Giữ tâm tĩnh lặng giữa dòng đời bão tố, thiền định chánh niệm",
    quote: "Tâm ta an thì thế giới an. Tâm ta tịnh thì vạn vật tịnh. Đừng tìm kiếm hạnh phúc bên ngoài."
  },
  {
    title: "Từ bi hỷ xả",
    topic: "Lòng khoan dung, từ bi hỷ xả, yêu thương và tha thứ cho mọi người",
    quote: "Từ bi là liều thuốc chữa lành mọi nỗi đau. Khi ta tha thứ, chính ta được giải thoát."
  }
];

export default function BuddhistTab({ onLog }) {
  const [topic, setTopic] = useState(ZEN_PRESETS[0].topic);
  const [voice, setVoice] = useState('vi-VN-NamMinhNeural'); // Deep male voice for teachings
  const [bgMusic, setBgMusic] = useState('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3'); // Calm zen instrumental
  
  // Custom mechanisms states
  const [mood, setMood] = useState('nature'); // nature, temple, meditation, mystical
  const [ambientSfx, setAmbientSfx] = useState('bell'); // bell, stream, rain, none
  const [particleType, setParticleType] = useState('dust'); // dust, lotus, rays, none
  const [subtitleStyle, setSubtitleStyle] = useState('modern'); // modern, calligraphy

  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState('');

  // Generated state to pass to VideoPlayerPanel
  const [slides, setSlides] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [audioUrl, setAudioUrl] = useState('');

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);

  const selectPreset = (preset) => {
    setTopic(preset.topic);
    onLog('Buddhist', `Đã chọn mẫu trích dẫn: "${preset.title}"`, 'info');
  };

  const handleGenerate = async () => {
    if (!topic) {
      setError('Vui lòng nhập chủ đề hoặc chọn một trích dẫn Phật pháp.');
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
      onLog('Buddhist', `Bắt đầu soạn thảo triết lý chủ đề: "${topic.substring(0, 35)}..."`, 'info');
      
      const systemPrompt = `Bạn là một thiền sư hiền triết, am hiểu Phật Pháp sâu sắc. Hãy viết các câu triết lý sống bằng tiếng Việt mang tính thanh tịnh, chậm rãi, thư thái và bình yên. Trả về cấu trúc JSON bắt buộc.`;
      
      // Select visual keywords based on chosen mood
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

      const userPrompt = `Hãy viết một bài giảng thiền ngắn gọn (khoảng 80-100 từ) về chủ đề "${topic}". Chia bài viết làm 4 phân đoạn.
Với mỗi phân đoạn, hãy cung cấp một mô tả hình ảnh tiếng Anh chi tiết để tạo ảnh thiền định.
Hãy luôn kết hợp và hòa quyện các chủ đề hình ảnh của mỗi câu với phong cách không gian trực quan sau: "${moodVisualDetail}".

Trả về duy nhất định dạng JSON có cấu trúc sau:
{
  "title": "${topic}",
  "script": [
    {
      "text": "Câu triết lý tiếng Việt (khoảng 20 từ, giọng điệu thiền tịnh chậm rãi)",
      "imagePrompt": "Mô tả ảnh tiếng Anh chi tiết tích hợp hoàn hảo với phong cách không gian được cung cấp"
    }
  ]
}`;

      const geminiModel = localStorage.getItem('gemini_model') || 'gemini-3.1-flash-lite';
      const geminiRes = await ipcRenderer.invoke('gemini-generate', { apiKey, systemPrompt, userPrompt, geminiModel });
      if (!geminiRes.success) throw new Error(geminiRes.error);
      const generatedData = geminiRes.data.script;
      onLog('Buddhist', `Kịch bản triết lý hoàn tất. Visual Mood đã chọn: [${mood}].`, 'success');

      // Stage 2: Synthesize slow calming speech
      setLoadingStage('Đang chuyển hóa triết lý thành giọng đọc thiền định...');
      onLog('Buddhist', 'Kết nối Edge-TTS để sinh giọng nói ấm áp, chậm rãi...', 'info');
      const fullText = generatedData.map(item => item.text).join(' ');
      const ttsRes = await ipcRenderer.invoke('edge-tts-synthesize', { 
        text: fullText, 
        options: { voice, rate: '-15%' } // meditatively slow
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
      onLog('Buddhist', 'Đang kết xuất hình ảnh Phật pháp từ Pollinations.ai...', 'info');
      
      const localImages = [];
      for (let i = 0; i < generatedData.length; i++) {
        const rawPrompt = generatedData[i].imagePrompt;
        const formattedPrompt = `${rawPrompt}, vertical aspect ratio, vertical frame, 1080x1920, zen, ultra high resolution, digital art`;
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(formattedPrompt)}?width=1080&height=1920&nologo=true`;
        
        onLog('Buddhist', `Đang tạo ảnh phân cảnh ${i + 1}/${generatedData.length}...`, 'info');
        const dlRes = await ipcRenderer.invoke('download-image', { imageUrl: pollinationsUrl });
        if (dlRes.success) {
          localImages.push(dlRes.filePath);
        } else {
          onLog('Buddhist', `Lỗi tạo ảnh phân cảnh ${i + 1}: ${dlRes.error}`, 'error');
        }
      }
      onLog('Buddhist', `Tải về thành công ${localImages.length} ảnh thiền định.`, 'success');

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
      onLog('Buddhist', 'Đồng bộ hóa hình ảnh thiền định với âm thanh hoàn tất.', 'success');
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
        type: 'buddhist',
        buddhistProps: {
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
            <Compass size={20} style={{ color: 'var(--success)' }} /> Tạo Video Phật Pháp & Triết Lý
          </h2>

          {/* 1. Quote presets */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BookOpen size={14} /> Thư viện trích dẫn hay (Chọn nhanh)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {ZEN_PRESETS.map((preset, idx) => (
                <div
                  key={idx}
                  onClick={() => selectPreset(preset)}
                  style={{
                    padding: '10px 14px',
                    background: 'var(--bg-surface-secondary)',
                    border: topic === preset.topic ? '1px solid var(--success)' : '1px solid var(--border)',
                    borderRadius: 12,
                    cursor: 'pointer',
                    fontSize: 13,
                    transition: 'all 200ms ease',
                    boxShadow: topic === preset.topic ? '0 0 10px rgba(34, 197, 94, 0.15)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (topic !== preset.topic) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    if (topic !== preset.topic) e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <strong style={{ color: topic === preset.topic ? 'var(--success)' : 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                    {preset.title}
                  </strong>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {preset.quote}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Ý tưởng / Chủ đề bài giảng chi tiết</label>
            <input
              type="text"
              className="form-input"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={loading}
              placeholder="Nhập chủ đề triết lý..."
            />
          </div>

          {/* 2. Visual Mood & Subtitle Style selectors */}
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

          {/* 3. Audio Ambient Mixer & Particle options */}
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

          {/* 4. Voice and Background music configuration */}
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
            disabled={loading}
            style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, var(--success) 0%, #15803d 100%)', boxShadow: '0 4px 15px rgba(34, 197, 94, 0.25)' }}
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
            // Overuse shopeeProps to pass custom Zen mechanisms parameters cleanly into Remotion Player
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
