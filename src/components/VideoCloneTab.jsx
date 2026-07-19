import React, { useState } from 'react';
import { 
  Film, 
  Upload, 
  Sparkles, 
  Play, 
  Copy, 
  Check, 
  Scissors, 
  Layers, 
  Download, 
  Loader, 
  AlertTriangle, 
  FileText,
  Code,
  Video,
  FileVideo,
  CheckCircle2,
  Info,
  Clock,
  Camera,
  Music,
  Zap,
  Edit3,
  Wand2
} from 'lucide-react';

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

export default function VideoCloneTab({ onLog }) {
  const [videoPath, setVideoPath] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scenes, setScenes] = useState([]);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [activeViewMode, setActiveViewMode] = useState('formatted'); // 'formatted' | 'json'

  // Stage 2 Prompt Enhancer state
  const [enhancingIndex, setEnhancingIndex] = useState(null);

  // Extracted frames tracking
  const [extractedFrames, setExtractedFrames] = useState([]);

  const addLog = (msg, type = 'info') => {
    if (onLog) onLog('VideoClone', msg, type);
  };

  const sanitizeFilePath = (pathStr) => {
    if (!pathStr) return '';
    let clean = pathStr.replace(/^file:\/\/\/?/, '');
    if (clean.startsWith('/') && clean.includes(':')) {
      clean = clean.substring(1);
    }
    return clean;
  };

  const handleSelectVideoFile = async () => {
    try {
      if (!ipcRenderer) {
        setError('IPC Renderer không sẵn sàng.');
        return;
      }
      const res = await ipcRenderer.invoke('select-video-file');
      if (res.success && res.filePath) {
        const rawPath = sanitizeFilePath(res.filePath);
        setVideoPath(rawPath);
        setVideoUrl(`file://${rawPath.replace(/\\/g, '/')}`);
        setScenes([]);
        setError('');
        addLog(`Đã chọn video: ${rawPath}`, 'info');
      }
    } catch (err) {
      console.error('Failed to select video file:', err);
      setError(err.message);
    }
  };

  const handleAnalyzeVideo = async () => {
    const cleanPath = sanitizeFilePath(videoPath);
    if (!cleanPath) {
      setError('Vui lòng chọn hoặc tải lên file video gốc.');
      return;
    }

    const apiKey = localStorage.getItem('gemini_api_key') || '';
    if (!apiKey) {
      setError('Vui lòng cấu hình Gemini API Key trong menu Tab Cấu Hình trước.');
      return;
    }

    const geminiModel = localStorage.getItem('gemini_model') || 'gemini-3.1-flash-lite';

    setIsAnalyzing(true);
    setError('');
    setScenes([]);
    addLog(`Bắt đầu tải video gốc lên Gemini (${geminiModel}) để phân tích Scene 10s...`, 'info');

    try {
      const res = await ipcRenderer.invoke('video-clone-analyze', {
        apiKey,
        videoPath: cleanPath,
        customPrompt: customInstructions,
        geminiModel
      });

      if (res.success && res.scenes) {
        const parsedScenes = Array.isArray(res.scenes) ? res.scenes : (res.scenes.scenes || [res.scenes]);
        setScenes(parsedScenes);
        addLog(`Phân tích video hoàn tất! Đã trích xuất ${parsedScenes.length} phân cảnh 10s.`, 'success');
      } else {
        throw new Error(res.error || 'Gemini không thể phân tích video.');
      }
    } catch (err) {
      console.error(err);
      setError(`Lỗi phân tích video: ${err.message}`);
      addLog(`Lỗi phân tích video: ${err.message}`, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // STAGE 2: Enhance single scene prompt individually
  const handleEnhanceScene = async (sceneIndex) => {
    const apiKey = localStorage.getItem('gemini_api_key') || '';
    if (!apiKey) {
      setError('Vui lòng cấu hình Gemini API Key trong menu Tab Cấu Hình.');
      return;
    }
    const geminiModel = localStorage.getItem('gemini_model') || 'gemini-3.1-flash-lite';

    const targetGen = 'AI Video Generator';
    setEnhancingIndex(sceneIndex);
    addLog(`Đang tối ưu hóa Prompt Scene ${sceneIndex} qua Stage 2 AI Enhancer...`, 'info');

    try {
      const sceneData = scenes[sceneIndex];
      const res = await ipcRenderer.invoke('video-clone-enhance-scene', {
        apiKey,
        sceneData,
        targetGenerator: targetGen,
        geminiModel
      });

      if (res.success && res.enhanced) {
        const { enhanced_prompt, negative_prompt, camera_directive, style_tags } = res.enhanced;
        
        setScenes(prev => {
          const updated = [...prev];
          const targetScene = updated[sceneIndex].scene || updated[sceneIndex];
          targetScene.prompt = enhanced_prompt || targetScene.prompt;
          if (negative_prompt) targetScene.negative_prompt = negative_prompt;
          if (camera_directive) targetScene.camera = camera_directive;
          if (style_tags) targetScene.style = style_tags;
          return updated;
        });

        addLog(`✨ Tối ưu thành công Prompt Scene ${sceneIndex}!`, 'success');
      } else {
        throw new Error(res.error || 'Lỗi tối ưu prompt');
      }
    } catch (err) {
      addLog(`Lỗi Stage 2 Enhancer Scene ${sceneIndex}: ${err.message}`, 'error');
    } finally {
      setEnhancingIndex(null);
    }
  };

  // Update prompt directly on user editing textarea
  const handlePromptChange = (idx, newText) => {
    setScenes(prev => {
      const updated = [...prev];
      const targetScene = updated[idx].scene || updated[idx];
      targetScene.prompt = newText;
      return updated;
    });
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleExtractLastFrame = async (sceneIndex) => {
    const cleanPath = sanitizeFilePath(videoPath);
    if (!cleanPath) return;
    try {
      addLog(`Đang trích xuất Frame cuối của Scene ${sceneIndex}...`, 'info');
      const tempPath = cleanPath.replace(/\.[^/.]+$/, '');
      const outputPath = `${tempPath}_lastframe_scene_${sceneIndex}.png`;
      const res = await ipcRenderer.invoke('video-clone-extract-frame', {
        videoPath: cleanPath,
        outputPath
      });
      if (res.success) {
        setExtractedFrames(prev => [...prev, { sceneIndex, framePath: res.framePath }]);
        addLog(`✅ Cắt Frame cuối Scene ${sceneIndex} thành công: ${res.framePath}`, 'success');
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      addLog(`Lỗi trích xuất frame cuối: ${err.message}`, 'error');
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 20, 
      height: '100%', 
      overflowY: 'auto', 
      paddingRight: 6, 
      paddingBottom: 40,
      fontFamily: 'var(--font-body)'
    }}>
      
      {/* Studio Header Banner */}
      <div style={{ 
        background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(37, 99, 235, 0.12) 100%)', 
        border: '1px solid rgba(124, 58, 237, 0.3)', 
        borderRadius: 16, 
        padding: '22px 28px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, zIndex: 1 }}>
          <div style={{ 
            width: 52, 
            height: 52, 
            borderRadius: 14, 
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 6px 20px rgba(124, 58, 237, 0.4)'
          }}>
            <Film size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Clone Video & Phân Tích Scene 10s (Two-Stage Pipeline)
              </h2>
              <span style={{ 
                fontSize: 11, 
                fontWeight: 600, 
                background: 'rgba(124, 58, 237, 0.25)', 
                color: '#ddd6fe', 
                padding: '4px 12px', 
                borderRadius: 20, 
                border: '1px solid rgba(124, 58, 237, 0.4)'
              }}>
                Dual-Stage + Editable Prompt
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, margin: '4px 0 0 0' }}>
              Phân tích video thô 10s $\rightarrow$ Tùy chỉnh chỉnh sửa prompt từng Scene trực tiếp $\rightarrow$ Tối ưu hóa prompt nâng cao cho Veo, Sora, Kling.
            </p>
          </div>
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 420px) minmax(0, 1fr)', gap: 24, alignItems: 'flex-start', width: '100%' }}>
        
        {/* Left Column: Input Video & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          
          <div className="glass-panel active" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: 22 }}>
            <h3 style={{ 
              fontSize: 13, 
              fontWeight: 700, 
              textTransform: 'uppercase', 
              letterSpacing: '0.06em', 
              color: 'var(--text-primary)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              margin: 0
            }}>
              <Upload size={16} style={{ color: 'var(--accent)' }} />
              1. Tải Lên Video Gốc Cần Clone
            </h3>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>
                Đường dẫn file video gốc:
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Chọn hoặc kéo thả file video .mp4, .mov, .webm..."
                  value={videoPath}
                  onChange={(e) => {
                    const raw = sanitizeFilePath(e.target.value);
                    setVideoPath(raw);
                    if (raw) setVideoUrl(`file://${raw.replace(/\\/g, '/')}`);
                  }}
                  style={{ 
                    flex: 1, 
                    fontSize: 12, 
                    background: 'var(--bg-dark)', 
                    color: 'var(--text-primary)', 
                    borderColor: 'var(--border)',
                    borderRadius: 10,
                    padding: '9px 12px'
                  }}
                />
                <button
                  type="button"
                  onClick={handleSelectVideoFile}
                  style={{ 
                    padding: '0 16px', 
                    height: 38, 
                    whiteSpace: 'nowrap', 
                    fontSize: 12, 
                    fontWeight: 600,
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6,
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(37, 99, 235, 0.35)'
                  }}
                >
                  <FileVideo size={14} />
                  📁 Chọn file
                </button>
              </div>
            </div>

            {/* Video Player Box */}
            <div style={{ 
              width: '100%', 
              aspectRatio: '16/9', 
              background: '#04060A', 
              borderRadius: 14, 
              overflow: 'hidden', 
              border: '1px solid var(--border)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              position: 'relative'
            }}>
              {videoUrl ? (
                <video 
                  src={videoUrl} 
                  controls 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                  <Film size={40} style={{ opacity: 0.4, color: 'var(--accent)' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Chưa chọn file video gốc</span>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>Bấm "Chọn file" ở trên để chọn tệp .MP4, .MOV, .WEBM</span>
                </div>
              )}
            </div>

            {/* Custom Analysis Instructions */}
            <div className="form-group" style={{ margin: 0, width: '100%' }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                Ghi chú thêm cho Gemini AI (Tùy chọn):
              </label>
              <textarea
                className="form-control"
                rows={3}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Ví dụ: Giữ phong cách 3D Voxel, tập trung mô tả chi tiết ánh sáng studio và các đồ vật xuất hiện..."
                style={{ 
                  width: '100%',
                  boxSizing: 'border-box',
                  fontSize: 12, 
                  background: 'var(--bg-dark)', 
                  color: 'var(--text-primary)', 
                  borderColor: 'var(--border)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  resize: 'none', 
                  lineHeight: '1.5' 
                }}
              />
            </div>

            <button
              onClick={handleAnalyzeVideo}
              disabled={isAnalyzing || !videoPath}
              style={{ 
                width: '100%', 
                padding: '15px', 
                background: isAnalyzing || !videoPath 
                  ? 'var(--bg-surface-secondary)' 
                  : 'linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)', 
                color: isAnalyzing || !videoPath ? 'var(--text-muted)' : '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                boxShadow: isAnalyzing || !videoPath ? 'none' : '0 6px 20px rgba(124, 58, 237, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: isAnalyzing || !videoPath ? 'not-allowed' : 'pointer'
              }}
            >
              {isAnalyzing ? (
                <>
                  <Loader size={18} className="spin" />
                  <span>Bước 1: Bóc tách Video 10s...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Bước 1: Phân Tích Thô Video 10s</span>
                </>
              )}
            </button>

            {error && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 10, 
                color: '#ef4444', 
                fontSize: 12, 
                background: 'rgba(239, 68, 68, 0.1)', 
                padding: '12px 16px', 
                borderRadius: 10, 
                border: '1px solid rgba(239, 68, 68, 0.3)' 
              }}>
                <AlertTriangle size={16} style={{ shrink: 0 }} />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Output Prompts with Direct Editing & Stage 2 Enhancer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0, width: '100%' }}>
          
          <div className="glass-panel" style={{ minHeight: 520, display: 'flex', flexDirection: 'column', gap: 18, padding: 22, minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
            
            {/* Panel Header & View Switchers */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                  <FileText size={17} style={{ color: 'var(--accent)' }} />
                  2. Kết Quả Phân Tích Prompt 10s ({scenes.length} Scenes)
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                  Xem từng Scene Prompt chi tiết hoặc chuyển sang mã JSON tổng thể.
                </span>
              </div>

              {scenes.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-dark)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setActiveViewMode('formatted')}
                    style={{
                      padding: '6px 14px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 7,
                      border: 'none',
                      cursor: 'pointer',
                      background: activeViewMode === 'formatted' ? 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)' : 'transparent',
                      color: activeViewMode === 'formatted' ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.2s ease',
                      boxShadow: activeViewMode === 'formatted' ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none'
                    }}
                  >
                    📄 Full Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveViewMode('json')}
                    style={{
                      padding: '6px 14px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 7,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      background: activeViewMode === 'json' ? 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)' : 'transparent',
                      color: activeViewMode === 'json' ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.2s ease',
                      boxShadow: activeViewMode === 'json' ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none'
                    }}
                  >
                    <Code size={12} />
                    {'{ }'} Prompt JSON
                  </button>
                </div>
              )}
            </div>

            {/* Empty State */}
            {scenes.length === 0 && !isAnalyzing && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '70px 20px', gap: 14, textAlign: 'center', flex: 1 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  <Video size={30} />
                </div>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Chưa có dữ liệu phân tích</h4>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 380, margin: 0, lineHeight: 1.6 }}>
                  Hãy chọn file Video gốc bên trái và bấm <strong>"Bước 1: Phân Tích Thô Video 10s"</strong>.
                </p>
              </div>
            )}

            {/* JSON Code Raw Mode */}
            {scenes.length > 0 && activeViewMode === 'json' && (
              <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Mã JSON cấu trúc đầy đủ do Gemini xuất ra:
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(JSON.stringify(scenes, null, 2), 'raw-json')}
                    style={{
                      padding: '6px 14px',
                      fontSize: 11,
                      fontWeight: 600,
                      background: 'var(--bg-surface-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {copiedIndex === 'raw-json' ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                    <span>{copiedIndex === 'raw-json' ? 'Đã chép' : 'Sao chép Toàn Bộ JSON'}</span>
                  </button>
                </div>
                <pre style={{
                  padding: 18,
                  background: '#04060A',
                  borderRadius: 12,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: '#c4b5fd',
                  maxHeight: 540,
                  overflowX: 'auto',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  border: '1px solid var(--border)',
                  lineHeight: '1.5',
                  margin: 0
                }}>
                  {JSON.stringify(scenes, null, 2)}
                </pre>
              </div>
            )}

            {/* Formatted Scenes View with Direct Textarea Editing */}
            {scenes.length > 0 && activeViewMode === 'formatted' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxHeight: 580, overflowY: 'auto', paddingRight: 4 }}>
                {scenes.map((item, idx) => {
                  const scene = item.scene || item;
                  const timeline = scene.timeline || [];
                  const sceneIndex = scene.history_scene_index !== undefined ? scene.history_scene_index : idx;
                  const isEnhancingThis = enhancingIndex === idx;

                  return (
                    <div 
                      key={idx}
                      style={{
                        background: 'var(--bg-dark)',
                        border: '1px solid var(--border)',
                        borderRadius: 14,
                        padding: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14
                      }}
                    >
                      {/* Card Header & Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ 
                            fontSize: 12, 
                            fontWeight: 700, 
                            background: 'rgba(124, 58, 237, 0.25)', 
                            color: '#ddd6fe', 
                            padding: '4px 12px', 
                            borderRadius: 8,
                            border: '1px solid rgba(124, 58, 237, 0.4)'
                          }}>
                            Scene {sceneIndex} ({scene.duration || '10 seconds'})
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          {/* Stage 2 Enhancer Button */}
                          <button
                            type="button"
                            onClick={() => handleEnhanceScene(idx)}
                            disabled={isEnhancingThis}
                            style={{
                              padding: '5px 12px',
                              fontSize: 11,
                              fontWeight: 600,
                              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.3) 0%, rgba(37, 99, 235, 0.3) 100%)',
                              color: '#c4b5fd',
                              border: '1px solid rgba(124, 58, 237, 0.5)',
                              borderRadius: 8,
                              cursor: isEnhancingThis ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5
                            }}
                            title="Nâng cấp Prompt bằng Stage 2 AI Prompt Enhancer"
                          >
                            {isEnhancingThis ? <Loader size={12} className="spin" /> : <Wand2 size={12} />}
                            <span>{isEnhancingThis ? 'Đang nâng cấp...' : 'Tối Ưu Prompt AI'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleExtractLastFrame(sceneIndex)}
                            style={{
                              padding: '5px 12px',
                              fontSize: 11,
                              fontWeight: 600,
                              background: 'rgba(6, 182, 212, 0.15)',
                              color: '#67e8f9',
                              border: '1px solid rgba(6, 182, 212, 0.3)',
                              borderRadius: 8,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5
                            }}
                          >
                            <Scissors size={12} />
                            <span>Cắt Frame Cuối</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => copyToClipboard(scene.prompt || '', `prompt-${idx}`)}
                            style={{
                              padding: '5px 12px',
                              fontSize: 11,
                              fontWeight: 600,
                              background: 'var(--bg-surface-secondary)',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5
                            }}
                          >
                            {copiedIndex === `prompt-${idx}` ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                            <span>{copiedIndex === `prompt-${idx}` ? 'Đã chép' : 'Chép Prompt Text'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => copyToClipboard(JSON.stringify(item, null, 2), `json-${idx}`)}
                            style={{
                              padding: '5px 12px',
                              fontSize: 11,
                              fontWeight: 600,
                              background: 'rgba(124, 58, 237, 0.15)',
                              color: '#c4b5fd',
                              border: '1px solid rgba(124, 58, 237, 0.3)',
                              borderRadius: 8,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5
                            }}
                          >
                            {copiedIndex === `json-${idx}` ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Code size={12} />}
                            <span>{copiedIndex === `json-${idx}` ? 'Đã chép' : 'Chép JSON Scene'}</span>
                          </button>
                        </div>
                      </div>

                      {/* EDITABLE Full Video Generation Prompt Textarea */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Edit3 size={12} style={{ color: 'var(--accent)' }} /> Full Video Generation Prompt (Có thể chỉnh sửa):
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          value={scene.prompt || ''}
                          onChange={(e) => handlePromptChange(idx, e.target.value)}
                          placeholder="Nhập hoặc tinh chỉnh prompt tạo video tại đây..."
                          style={{ 
                            width: '100%',
                            fontSize: 12, 
                            fontFamily: 'var(--font-mono)', 
                            color: '#e2e8f0', 
                            background: '#04060A', 
                            padding: 12, 
                            borderRadius: 10, 
                            border: '1px solid var(--border)',
                            lineHeight: '1.6',
                            resize: 'vertical'
                          }}
                        />
                      </div>

                      {/* Negative Prompt display if available */}
                      {scene.negative_prompt && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: 10, borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: 11 }}>
                          <strong style={{ color: '#fca5a5' }}>🚫 Negative Prompt:</strong>
                          <span style={{ color: '#f87171', marginLeft: 6 }}>{scene.negative_prompt}</span>
                        </div>
                      )}

                      {/* Style & Camera Footer Badges */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11 }}>
                        {scene.style && (
                          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 10, borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                            <strong style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>🎨 Style & Lighting:</strong>
                            <span style={{ color: 'var(--text-secondary)' }}>{scene.style}</span>
                          </div>
                        )}
                        {scene.camera && (
                          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 10, borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                            <strong style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>🎥 Camera Rules:</strong>
                            <span style={{ color: 'var(--text-secondary)' }}>{scene.camera}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
