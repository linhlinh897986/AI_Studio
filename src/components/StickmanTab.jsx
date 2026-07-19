import React, { useState } from 'react';
import { 
  Smile, 
  Loader, 
  AlertTriangle, 
  Sliders, 
  Sparkles, 
  User, 
  Paintbrush, 
  Volume2, 
  Music, 
  RefreshCw, 
  Check, 
  Play, 
  ChevronRight, 
  Undo,
  FileText,
  Video
} from 'lucide-react';
import VideoPlayerPanel from './VideoPlayerPanel';

const { ipcRenderer } = window.require('electron');

const CHARACTER_PROFILES = [
  { id: 'bob', name: 'Bob (Classic)', desc: 'Người que cổ điển, nét vẽ trơn, hoạt bát.' },
  { id: 'alice', name: 'Alice (Hair/Bow)', desc: 'Người que nữ, có tóc dài đính nơ dễ thương.' },
  { id: 'boss', name: 'Sếp Boss', desc: 'Người que đeo kính mắt, đội mũ phớt và cà vạt.' },
  { id: 'ninja', name: 'Ninja', desc: 'Người que đeo băng đô đỏ, có kiếm sau lưng.' }
];

const ART_STYLES = [
  { 
    id: 'sketch', 
    name: 'Phác thảo Ink', 
    desc: 'Nét vẽ bút lông đen tối giản trên nền trắng.',
    suffix: ', isolated white background, clear line art sketch, black marker outline, hand-drawn simple stickman style, 2d cartoon' 
  },
  { 
    id: 'neon', 
    name: 'Neon Phát Sáng', 
    desc: 'Nét vẽ neon màu rực rỡ trên nền đen.',
    suffix: ', glowing neon lines, vibrant colors, solid pitch black background, synthwave stickman style, 2d vector' 
  },
  { 
    id: 'retro', 
    name: 'Retro Cartoon', 
    desc: 'Phác họa màu nước phấn nhạt kết hợp nét đen.',
    suffix: ', soft retro pastel colors fill, thick black outlines, cute simple hand-drawn cartoon style' 
  },
  { 
    id: 'blueprint', 
    name: 'Bản vẽ kỹ thuật', 
    desc: 'Nét vẽ trắng trên nền giấy ô vuông xanh lam.',
    suffix: ', technical blueprint drafting paper grid background, white chalk outlines, blueprint stickman drawing' 
  }
];

const BUBBLE_POSITIONS = [
  { id: 'none', label: 'Không bong bóng' },
  { id: 'top-left', label: 'Trên - Trái' },
  { id: 'top-right', label: 'Trên - Phải' },
  { id: 'bottom-left', label: 'Dưới - Trái' },
  { id: 'bottom-right', label: 'Dưới - Phải' }
];

const STICKERS = [
  { id: 'none', label: 'Không sticker' },
  { id: 'BOOM!', label: '💥 BOOM!' },
  { id: 'BANG!', label: '⚡ BANG!' },
  { id: 'OOF!', label: '🩹 OOF!' },
  { id: 'CRASH!', label: '☄️ CRASH!' },
  { id: 'WHAT?!', label: '❓ WHAT?!' }
];

export default function StickmanTab({ onLog }) {
  // Input settings
  const [prompt, setPrompt] = useState('Chuyện người que Bob tập nấu trứng và làm cháy bếp');
  const [character, setCharacter] = useState('bob');
  const [style, setStyle] = useState('sketch');
  const [voice, setVoice] = useState('vi-VN-HoaiMyNeural');
  const [bgMusic, setBgMusic] = useState('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3');

  // Status steps: 'setup' | 'storyboard' | 'ready'
  const [step, setStep] = useState('setup');
  const [storyboard, setStoryboard] = useState([]);
  
  // Processing states
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [panelDrawingIndex, setPanelDrawingIndex] = useState(null); // tracking individual panel image generation
  const [error, setError] = useState('');

  // Generated assets state
  const [slides, setSlides] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [audioUrl, setAudioUrl] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Helper: call API to generate drawing for a single storyboard panel
  const generateImageForPanel = async (imagePrompt) => {
    const styleObj = ART_STYLES.find(s => s.id === style) || ART_STYLES[0];
    const charObj = CHARACTER_PROFILES.find(c => c.id === character) || CHARACTER_PROFILES[0];
    
    // Inject character profile context dynamically into prompt
    const enrichedPrompt = `funny stickman ${charObj.name} (${charObj.desc}), ${imagePrompt}${styleObj.suffix}`;
    const imageGenSource = localStorage.getItem('image_gen_source') || 'meta_direct';
    
    if (imageGenSource === 'labs_flow_image' || imageGenSource === 'labs_flow_video') {
      const cookieText = localStorage.getItem('labs_google_cookie') || '';
      return await ipcRenderer.invoke('veo-web-generate-video', {
        cookieText,
        options: {
          prompt: enrichedPrompt,
          type: 'image',
          aspect: '1:1',
          count: '1x',
          model: 'Nano Banana 2',
          showBrowser: false
        }
      });
    } else if (imageGenSource === '9router') {
      return await ipcRenderer.invoke('ninerouter-generate-image', { prompt: enrichedPrompt });
    } else if (imageGenSource === 'meta_direct') {
      const cookieText = localStorage.getItem('meta_direct_cookie') || '';
      return await ipcRenderer.invoke('meta-direct-generate-image', { prompt: enrichedPrompt, cookieText });
    } else {
      const vibesCookie = localStorage.getItem('vibes_meta_session') || '';
      return await ipcRenderer.invoke('vibes-generate-image', { prompt: enrichedPrompt, metaSession: vibesCookie });
    }
  };

  // Step 1: Generate script from Gemini
  const handleGenerateScript = async () => {
    if (!prompt) {
      setError('Vui lòng nhập ý tưởng cốt truyện người que.');
      return;
    }
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      setError('Vui lòng cài đặt và xác thực Gemini API Key trong Tab Cấu Hình trước.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      setLoadingStage('Gemini đang sáng tác kịch bản phân cảnh hài hước...');
      onLog('Stickman', `Đang kết nối Gemini để thiết lập cốt truyện: "${prompt}"...`, 'info');

      const charObj = CHARACTER_PROFILES.find(c => c.id === character);
      const styleObj = ART_STYLES.find(s => s.id === style);

      const systemPrompt = `Bạn là biên kịch truyện tranh người que (stickman) dí dỏm. Hãy sáng tác truyện ngắn hài hước tiếng Việt và thiết lập kịch bản phân cảnh chi tiết. Trả về định dạng JSON bắt buộc đúng cấu trúc.`;
      
      const userPrompt = `Hãy viết một câu chuyện ngắn hài hước (khoảng 80 từ) về đề tài: "${prompt}". 
Nhân vật chính: ${charObj.name} (${charObj.desc}).
Hãy chia câu chuyện thành 4 phân cảnh. Trả về cấu trúc JSON sau:
{
  "storyboard": [
    {
      "text": "Lời thoại ngắn của nhân vật hoặc câu dẫn chuyện hài hước bằng tiếng Việt",
      "speakerType": "dialogue" hoặc "narration",
      "imagePrompt": "Mô tả cảnh hành động ngộ nghĩnh của nhân vật người que bằng tiếng Anh để vẽ AI (ví dụ: funny stickman trying to cook, kitchen on fire, eyes wide in panic, simple outlines)"
    }
  ]
}
Hãy viết prompt mô tả bằng tiếng Anh đơn giản, hành động cực kỳ cường điệu hài hước.`;

      const geminiModel = localStorage.getItem('gemini_model') || 'gemini-3.1-flash-lite';
      const geminiRes = await ipcRenderer.invoke('gemini-generate', { apiKey, systemPrompt, userPrompt, geminiModel });
      if (!geminiRes.success) throw new Error(geminiRes.error);
      
      const storyboardData = geminiRes.data.storyboard;
      if (!storyboardData || !Array.isArray(storyboardData)) {
        throw new Error("Không thể phân tích định dạng phân cảnh từ Gemini.");
      }

      // Add default styling bubble/sticker parameters to each panel
      const enrichedStoryboard = storyboardData.map((item, idx) => ({
        ...item,
        bubblePos: item.speakerType === 'dialogue' ? (idx % 2 === 0 ? 'top-left' : 'top-right') : 'none',
        sticker: idx === 2 ? 'BOOM!' : 'none', // give a funny sticker placeholder to scene 3
        imageUrl: '' // will be generated later
      }));

      setStoryboard(enrichedStoryboard);
      setStep('storyboard');
      onLog('Stickman', `Sáng tác phân cảnh truyện hoàn tất! Bắt đầu biên tập.`, 'success');
    } catch (err) {
      setError(err.message);
      onLog('Stickman', `Lỗi tạo kịch bản: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  // Step 2: Regenerate single image inside storyboard editor
  const handleRegeneratePanelImage = async (index) => {
    setPanelDrawingIndex(index);
    setError('');
    onLog('Stickman', `Bắt đầu vẽ lại hình ảnh cho Phân cảnh ${index + 1}...`, 'info');

    try {
      const panel = storyboard[index];
      const res = await generateImageForPanel(panel.imagePrompt);
      if (res && res.success) {
        const filePath = res.filePath || (res.localPaths && res.localPaths[0]);
        const updatedStoryboard = [...storyboard];
        updatedStoryboard[index].imageUrl = filePath;
        setStoryboard(updatedStoryboard);
        onLog('Stickman', `Vẽ thành công Phân cảnh ${index + 1}!`, 'success');
      } else {
        throw new Error(res ? res.error : 'Vẽ lỗi.');
      }
    } catch (err) {
      setError(`Lỗi vẽ cảnh ${index + 1}: ${err.message}`);
      onLog('Stickman', `Vẽ phân cảnh ${index + 1} thất bại: ${err.message}`, 'error');
    } finally {
      setPanelDrawingIndex(null);
    }
  };

  // Step 3: Compile Voice, ASR timing, generate any missing drawings, align and preview
  const handleCompileVideo = async () => {
    setLoading(true);
    setError('');
    onLog('Stickman', 'Bắt đầu tổng hợp tài nguyên truyện người que...', 'info');

    try {
      // 1. Generate missing drawing files if any panel has no image
      const updatedStoryboard = [...storyboard];
      for (let i = 0; i < updatedStoryboard.length; i++) {
        if (!updatedStoryboard[i].imageUrl) {
          setLoadingStage(`Đang vẽ tự động phân cảnh ${i + 1}/${updatedStoryboard.length}...`);
          setPanelDrawingIndex(i);
          const res = await generateImageForPanel(updatedStoryboard[i].imagePrompt);
          if (res && res.success) {
            const filePath = res.filePath || (res.localPaths && res.localPaths[0]);
            updatedStoryboard[i].imageUrl = filePath;
            setStoryboard([...updatedStoryboard]);
          } else {
            onLog('Stickman', `Lỗi vẽ cảnh ${i + 1}: ${res?.error}. Sử dụng ảnh tạm.`, 'warning');
            updatedStoryboard[i].imageUrl = 'https://placehold.co/1080x1920/ffffff/000000?text=Stickman+Frame';
          }
        }
      }
      setPanelDrawingIndex(null);

      // 2. Synthesize audio speech (concatenating all dialogue and narration)
      setLoadingStage('Đang tổng hợp giọng nói thuyết minh AI...');
      onLog('Stickman', 'Đang kết nối tới Edge-TTS để đọc lời thoại...', 'info');
      const fullSpeechText = updatedStoryboard.map(item => item.text).join('. ');
      
      const ttsRes = await ipcRenderer.invoke('edge-tts-synthesize', {
        text: fullSpeechText,
        options: { voice, rate: '0%' }
      });
      if (!ttsRes.success) throw new Error(ttsRes.error);
      const localAudioUrl = ttsRes.filePath;
      setAudioUrl(localAudioUrl);
      onLog('Stickman', 'Lồng tiếng truyện người que hoàn thành.', 'success');

      // 3. ASR Timing extraction for accurate karaoke & slide synchronization
      setLoadingStage('Đang khớp thời gian phụ đề từng từ...');
      onLog('Stickman', 'Tách phụ đề ASR từ âm thanh...', 'info');
      const asrRes = await ipcRenderer.invoke('capcut-asr-transcribe', {
        audioPath: localAudioUrl,
        options: { language: 'vi-VN', needWordTimestamp: false }
      });
      if (!asrRes.success) throw new Error(asrRes.error);
      const asrSegments = asrRes.segments;
      setSubtitles(asrSegments);
      onLog('Stickman', 'Phân tích âm thanh và tạo dòng phụ đề thành công.', 'success');

      // 4. Align slides exactly to ASR sentences timestamps for premium synchronization
      setLoadingStage('Đang đồng bộ phân cảnh với nhịp thoại...');
      const lastWordSeg = asrSegments[asrSegments.length - 1];
      const audioDurationMs = lastWordSeg ? lastWordSeg.end_time : 10000;
      const audioDurationFrames = Math.ceil((audioDurationMs / 1000) * 30);

      const computedSlides = [];
      
      // If we have an exact match between ASR sentences and storyboard items, map 1-to-1
      if (asrSegments.length === updatedStoryboard.length) {
        onLog('Stickman', 'Đồng bộ chính xác 1-1 các cảnh theo ASR Timestamps.', 'info');
        updatedStoryboard.forEach((item, index) => {
          const seg = asrSegments[index];
          const startFrame = Math.floor((seg.start_time / 1000) * 30);
          const endFrame = index === updatedStoryboard.length - 1 
            ? audioDurationFrames 
            : Math.floor((asrSegments[index + 1].start_time / 1000) * 30);
          
          computedSlides.push({
            imageUrl: item.imageUrl,
            startFrame,
            durationFrames: Math.max(15, endFrame - startFrame),
            text: item.text,
            speakerType: item.speakerType,
            bubblePos: item.bubblePos,
            sticker: item.sticker
          });
        });
      } else {
        // Fallback proportional layout by text length
        onLog('Stickman', 'Nhận diện số phụ đề lệch kịch bản. Tự động chia tỉ lệ theo câu chữ.', 'info');
        const totalTextLen = updatedStoryboard.reduce((acc, curr) => acc + curr.text.length, 0) || 1;
        let currentFrame = 0;
        
        updatedStoryboard.forEach((item, index) => {
          const ratio = item.text.length / totalTextLen;
          const durationFrames = Math.floor(audioDurationFrames * ratio);
          
          computedSlides.push({
            imageUrl: item.imageUrl,
            startFrame: currentFrame,
            durationFrames: index === updatedStoryboard.length - 1 
              ? (audioDurationFrames - currentFrame) 
              : Math.max(15, durationFrames),
            text: item.text,
            speakerType: item.speakerType,
            bubblePos: item.bubblePos,
            sticker: item.sticker
          });
          currentFrame += durationFrames;
        });
      }

      setSlides(computedSlides);
      onLog('Stickman', 'Đồng bộ hóa hoạt ảnh hoàn chỉnh.', 'success');
      setStep('ready');
      setShowPreview(true);
    } catch (err) {
      setError(err.message);
      onLog('Stickman', `Lỗi kết nối tài nguyên: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setLoadingStage('');
      setPanelDrawingIndex(null);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress({ percent: 0, message: 'Bắt đầu render video Remotion...' });
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
        type: 'stickman',
        shopeeProps: {
          style: style // Pass drawing style for custom rendering inside composition
        }
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
      
      // Sync text inside the slides too!
      const updatedSlides = [...slides];
      if (updatedSlides[segmentIdx]) {
        updatedSlides[segmentIdx].text = newValue;
        setSlides(updatedSlides);
      }
      onLog('Editor', `Cập nhật hội thoại/phụ đề cảnh ${segmentIdx + 1}: "${newValue}"`, 'info');
    }
  };

  // Update specific field inside a panel in local storyboard state
  const handleUpdatePanelField = (index, field, value) => {
    const updated = [...storyboard];
    updated[index][field] = value;
    setStoryboard(updated);
  };

  return (
    <div className="tab-content" style={{ justifyContent: 'center', height: '100%', overflowY: 'auto' }}>
      
      {/* STEP 1: INITIAL SETUP CONFIG */}
      {step === 'setup' && (
        <div className="workspace-left" style={{ maxWidth: 800, width: '100%', margin: '0 auto', flex: 'none' }}>
          <div className="glass-panel" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(232, 121, 249, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <Smile size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: 18, margin: 0 }}>Tạo Video Người Que AI (Stickman Animator)</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Sáng tác truyện tranh hoạt hình người que Bob vui nhộn qua nét vẽ AI.</p>
              </div>
            </div>

            {/* Input Story Idea */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={15} style={{ color: 'var(--primary)' }} /> Cốt truyện / Ý tưởng video
              </label>
              <textarea
                className="form-input form-textarea"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading}
                style={{ height: 100 }}
                placeholder="Nhập cốt truyện ngắn vui nhộn (ví dụ: Người que Bob chơi trốn tìm với khủng long T-Rex và bị nuốt chửng...)"
              />
            </div>

            {/* Grid selector: Characters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={15} style={{ color: 'var(--primary)' }} /> Chọn hình dạng nhân vật người que
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {CHARACTER_PROFILES.map((profile) => (
                  <div
                    key={profile.id}
                    onClick={() => !loading && setCharacter(profile.id)}
                    style={{
                      padding: '14px 18px',
                      background: character === profile.id ? 'rgba(232, 121, 249, 0.08)' : 'rgba(255,255,255,0.02)',
                      border: character === profile.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                      borderRadius: 12,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: character === profile.id ? '0 0 12px rgba(232, 121, 249, 0.2)' : 'none'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, color: character === profile.id ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: character === profile.id ? 'var(--primary)' : 'transparent', border: '1px solid var(--border)' }} />
                      {profile.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{profile.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grid selector: Art Styles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Paintbrush size={15} style={{ color: 'var(--primary)' }} /> Phong cách nét vẽ AI (Art Style Presets)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {ART_STYLES.map((artStyle) => (
                  <div
                    key={artStyle.id}
                    onClick={() => !loading && setStyle(artStyle.id)}
                    style={{
                      padding: '14px 18px',
                      background: style === artStyle.id ? 'rgba(232, 121, 249, 0.08)' : 'rgba(255,255,255,0.02)',
                      border: style === artStyle.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                      borderRadius: 12,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: style === artStyle.id ? '0 0 12px rgba(232, 121, 249, 0.2)' : 'none'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, color: style === artStyle.id ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: style === artStyle.id ? 'var(--primary)' : 'transparent', border: '1px solid var(--border)' }} />
                      {artStyle.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{artStyle.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audio Settings */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Volume2 size={15} style={{ color: 'var(--primary)' }} /> Giọng Đọc Dẫn Chuyện
                </label>
                <select 
                  className="form-input"
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  disabled={loading}
                >
                  <option value="vi-VN-HoaiMyNeural">Hoài My (Giọng nữ hoạt bát, vui vẻ)</option>
                  <option value="vi-VN-NamMinhNeural">Nam Minh (Giọng nam hài hước, dí dỏm)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Music size={15} style={{ color: 'var(--primary)' }} /> Âm Nhạc Nền Hài Hước
                </label>
                <select
                  className="form-input"
                  value={bgMusic}
                  onChange={(e) => setBgMusic(e.target.value)}
                  disabled={loading}
                >
                  <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3">Funny Track 1 (Helix 4)</option>
                  <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3">Funny Track 2 (Helix 8)</option>
                  <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3">Funny Track 3 (Helix 12)</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <button
              className="btn btn-primary"
              onClick={handleGenerateScript}
              disabled={loading}
              style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 600 }}
            >
              {loading ? (
                <>
                  <Loader size={18} className="spin" />
                  <span>{loadingStage}</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Tạo phân cảnh kịch bản bằng Gemini</span>
                </>
              )}
            </button>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: 13, background: 'rgba(239, 68, 68, 0.08)', padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: INTERACTIVE STORYBOARD EDITOR */}
      {step === 'storyboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', maxWidth: 1200, margin: '0 auto' }}>
          
          {/* Header Panel */}
          <div className="glass-panel" style={{ padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 16, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} style={{ color: 'var(--primary)' }} /> Biên Tập Bảng Phân Cảnh (Storyboard Panels)
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Hiệu chỉnh mô tả vẽ, hội thoại và vị trí bong bóng trước khi kết xuất video.</p>
            </div>
            
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setStep('setup')}
                style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}
                disabled={loading}
              >
                <Undo size={14} /> Quay lại thiết lập
              </button>
              
              <button 
                className="btn btn-primary" 
                onClick={handleCompileVideo}
                disabled={loading}
                style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}
              >
                {loading ? (
                  <>
                    <Loader size={15} className="spin" />
                    <span>{loadingStage}</span>
                  </>
                ) : (
                  <>
                    <Video size={15} />
                    <span>Tạo Video & Lồng Tiếng</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            {storyboard.map((panel, idx) => (
              <div 
                key={idx} 
                className="glass-panel" 
                style={{ 
                  padding: 24, 
                  display: 'flex', 
                  gap: 20, 
                  border: panelDrawingIndex === idx ? '1px dashed var(--primary)' : '1px solid var(--border)',
                  position: 'relative'
                }}
              >
                {/* Panel number badge */}
                <div style={{ position: 'absolute', top: 12, left: 12, background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 'bold', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
                  {idx + 1}
                </div>

                {/* Left Side: Image Preview & Regen */}
                <div style={{ width: 180, display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
                  <div style={{ 
                    width: '100%', 
                    aspectRatio: '1/1', 
                    borderRadius: 10, 
                    border: '1px solid var(--border)', 
                    background: '#04020a', 
                    overflow: 'hidden', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    position: 'relative' 
                  }}>
                    {panelDrawingIndex === idx ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 11 }}>
                        <Loader size={20} className="spin" style={{ color: 'var(--primary)' }} />
                        <span>Đang vẽ tranh...</span>
                      </div>
                    ) : panel.imageUrl ? (
                      <img 
                        src={`file:///${panel.imageUrl.replace(/\\/g, '/')}`} 
                        alt={`Cảnh ${idx + 1}`} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 10 }}>
                        Tranh chưa vẽ
                      </div>
                    )}
                  </div>
                  
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleRegeneratePanelImage(idx)}
                    disabled={loading || panelDrawingIndex !== null}
                    style={{ padding: '8px 10px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <RefreshCw size={13} className={panelDrawingIndex === idx ? 'spin' : ''} />
                    <span>{panel.imageUrl ? 'Vẽ lại hình này' : 'Vẽ hình'}</span>
                  </button>
                </div>

                {/* Right Side: Fields Editor */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  
                  {/* Speaker Type Selection */}
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => handleUpdatePanelField(idx, 'speakerType', 'narration')}>
                      <input 
                        type="radio" 
                        name={`speakerType-${idx}`} 
                        checked={panel.speakerType === 'narration'} 
                        onChange={() => {}}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Lời dẫn truyện</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => handleUpdatePanelField(idx, 'speakerType', 'dialogue')}>
                      <input 
                        type="radio" 
                        name={`speakerType-${idx}`} 
                        checked={panel.speakerType === 'dialogue'} 
                        onChange={() => {}}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Lời hội thoại</span>
                    </div>
                  </div>

                  {/* Speech text input */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Nội dung lời đọc (Tiếng Việt)</label>
                    <textarea
                      className="form-input form-textarea"
                      value={panel.text}
                      onChange={(e) => handleUpdatePanelField(idx, 'text', e.target.value)}
                      style={{ height: 56, fontSize: 13, padding: '8px 10px' }}
                      placeholder="Lời dẫn hoặc lời hội thoại vật người que..."
                    />
                  </div>

                  {/* Image Generation prompt */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mô tả hình vẽ AI (Prompt English)</label>
                    <textarea
                      className="form-input form-textarea"
                      value={panel.imagePrompt}
                      onChange={(e) => handleUpdatePanelField(idx, 'imagePrompt', e.target.value)}
                      style={{ height: 56, fontSize: 12, fontFamily: 'monospace', padding: '8px 10px' }}
                      placeholder="funny stickman doing action, image details..."
                    />
                  </div>

                  {/* Comic overlays options */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bong bóng hội thoại</label>
                      <select
                        className="form-input"
                        value={panel.bubblePos}
                        onChange={(e) => handleUpdatePanelField(idx, 'bubblePos', e.target.value)}
                        style={{ height: 32, fontSize: 12, padding: '0 8px' }}
                      >
                        {BUBBLE_POSITIONS.map(pos => (
                          <option key={pos.id} value={pos.id}>{pos.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sticker Comic</label>
                      <select
                        className="form-input"
                        value={panel.sticker}
                        onChange={(e) => handleUpdatePanelField(idx, 'sticker', e.target.value)}
                        style={{ height: 32, fontSize: 12, padding: '0 8px' }}
                      >
                        {STICKERS.map(stk => (
                          <option key={stk.id} value={stk.id}>{stk.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                </div>
              </div>
            ))}
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: 13, background: 'rgba(239, 68, 68, 0.08)', padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Quick preview trigger if already compiled */}
          {slides.length > 0 && (
            <button
              className="btn btn-secondary"
              onClick={() => setShowPreview(true)}
              style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'center', width: 280, borderColor: 'var(--primary)', color: 'var(--primary)', background: 'transparent', borderWidth: 1.5, fontSize: 13, fontWeight: 600 }}
            >
              <Sliders size={15} />
              <span>Mở Trình Xem thử & Phụ đề</span>
            </button>
          )}
        </div>
      )}

      {/* STEP 3: READY / SUCCESS COMPILATION STATE */}
      {step === 'ready' && (
        <div className="workspace-left" style={{ maxWidth: 640, width: '100%', margin: '0 auto', flex: 'none' }}>
          <div className="glass-panel" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24, textAlign: 'center', alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34, 197, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
              <Check size={32} />
            </div>
            
            <div>
              <h2 style={{ fontSize: 18, margin: 0 }}>Video Người Que Đã Sẵn Sàng!</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>Kịch bản phân cảnh truyện tranh và âm thanh lồng tiếng đã được biên soạn đồng bộ thành công.</p>
            </div>

            <div style={{ display: 'flex', gap: 16, width: '100%' }}>
              <button
                className="btn btn-primary"
                onClick={() => setShowPreview(true)}
                style={{ flex: 1, padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600 }}
              >
                <Play size={16} /> Xem thử video
              </button>
              
              <button
                className="btn btn-secondary"
                onClick={() => setStep('storyboard')}
                style={{ flex: 1, padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Sliders size={16} /> Biên tập lại cảnh
              </button>
            </div>

            <button
              className="btn"
              onClick={() => {
                setStoryboard([]);
                setSlides([]);
                setSubtitles([]);
                setAudioUrl('');
                setStep('setup');
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              Tạo câu chuyện người que mới
            </button>
          </div>
        </div>
      )}

      {/* VideoPlayerPanel Modal */}
      <VideoPlayerPanel 
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        slides={slides}
        subtitles={subtitles}
        audioUrl={audioUrl}
        bgMusicUrl={bgMusic}
        type="stickman"
        onSubtitleUpdate={handleSubtitleUpdate}
        onExport={handleExport}
        isExporting={isExporting}
        exportProgress={exportProgress}
        
        voice={voice}
        onVoiceChange={setVoice}
        bgMusic={bgMusic}
        onBgMusicChange={setBgMusic}
      />
    </div>
  );
}
