import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, 
  Image as ImageIcon, 
  Play, 
  Download, 
  Cookie, 
  Tv, 
  Terminal, 
  FolderOpen, 
  ExternalLink,
  Loader,
  AlertTriangle,
  Sliders,
  CheckCircle,
  History
} from 'lucide-react';

const { ipcRenderer } = window.require('electron');

export default function VeoTab({ onLog }) {
  const [cookieText, setCookieText] = useState(() => {
    return localStorage.getItem('labs_google_cookie') || '';
  });
  const [prompt, setPrompt] = useState('A cinematic shot of a futuristic flying car over neon-lit streets, cyberpunk style');
  const [type, setType] = useState('video'); // video, image
  const [aspect, setAspect] = useState('16:9');
  const [count, setCount] = useState('1x');
  const [model, setModel] = useState('Omni Flash');
  const [showBrowser, setShowBrowser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { filePath, type }

  const [localLogs, setLocalLogs] = useState([]);
  const logsEndRef = useRef(null);

  // Load history from localStorage
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('veo_generation_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('veo_generation_history', JSON.stringify(history));
  }, [history]);

  // Handle local logs auto scroll to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [localLogs]);

  // Set default model based on type (video vs image)
  useEffect(() => {
    if (type === 'video') {
      setAspect('16:9');
      setModel('Omni Flash');
    } else {
      setAspect('1:1');
      setModel('Nano Banana 2');
    }
  }, [type]);

  const addLocalLog = (message, logType = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLocalLogs(prev => [...prev, { text: message, type: logType, timestamp }]);
  };

  // Register real-time log event listener from main process
  useEffect(() => {
    const handleLogEvent = (event, data) => {
      addLocalLog(data.message, data.type);
      if (data.type === 'error') {
        setError(data.message);
      }
    };
    ipcRenderer.on('veo-web-log', handleLogEvent);
    return () => {
      ipcRenderer.removeListener('veo-web-log', handleLogEvent);
    };
  }, []);

  const handleGenerate = async () => {
    if (!cookieText.trim()) {
      setError('Vui lòng nhập Cookie của Google Labs.');
      return;
    }
    if (!prompt.trim()) {
      setError('Vui lòng nhập Prompt mô tả ý tưởng.');
      return;
    }

    // Save cookie for next sessions
    localStorage.setItem('labs_google_cookie', cookieText);

    setLoading(true);
    setError('');
    setResult(null);
    setLocalLogs([]);
    setStatusText('Bắt đầu tiến trình tạo media bằng Web Flow...');

    onLog('VeoWeb', `Bắt đầu gửi prompt tạo ${type === 'video' ? 'video' : 'ảnh'}: "${prompt.substring(0, 40)}..."`, 'info');
    addLocalLog('Đang chuẩn bị phiên tự động hóa...', 'info');

    const options = {
      prompt,
      type,
      aspect,
      count,
      model,
      showBrowser
    };

    try {
      const res = await ipcRenderer.invoke('veo-web-generate-video', {
        cookieText,
        options
      });

      if (res.success) {
        setResult({ filePath: res.filePath, type: res.type });
        onLog('VeoWeb', `Tạo ${type === 'video' ? 'video' : 'ảnh'} thành công!`, 'success');
        addLocalLog('Hoàn tất tiến trình sinh tệp kết quả!', 'success');

        // Add to history
        const newItem = {
          id: Date.now(),
          prompt,
          type: res.type,
          aspect,
          model,
          filePath: res.filePath,
          timestamp: new Date().toLocaleString()
        };
        setHistory(prev => [newItem, ...prev.slice(0, 19)]); // limit to 20 items
      } else {
        throw new Error(res.error || 'Unknown error');
      }
    } catch (err) {
      setError(err.message);
      onLog('VeoWeb', `Lỗi tiến trình: ${err.message}`, 'error');
      addLocalLog(`Lỗi: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  const handleOpenPath = async (filePath) => {
    await ipcRenderer.invoke('open-path', { filePath });
  };

  const handleShowInFolder = async (filePath) => {
    await ipcRenderer.invoke('show-item-in-folder', { filePath });
  };

  const handleExport = async (srcPath) => {
    const ext = type === 'video' ? '.mp4' : '.jpg';
    const defaultName = `veo_web_${Date.now()}${ext}`;
    addLocalLog('Đang mở hộp thoại xuất file...', 'info');
    const res = await ipcRenderer.invoke('export-file', { srcPath, defaultName });
    if (res.success) {
      addLocalLog(`Đã xuất tệp thành công tới: ${res.filePath}`, 'success');
    } else if (res.error !== 'Cancelled') {
      addLocalLog(`Lỗi khi xuất tệp: ${res.error}`, 'error');
    }
  };

  return (
    <div className="tab-content" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24, height: '100%', overflow: 'hidden', padding: '8px 4px' }}>
      {/* Control Panel */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', paddingRight: 10 }}>
        <h3 style={{ fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <Sliders size={18} style={{ color: 'var(--primary)' }} /> Cấu hình sinh Media
        </h3>

        {/* Form Types */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
          <button 
            onClick={() => setType('video')}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: type === 'video' ? 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)' : 'transparent',
              color: type === 'video' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            <Video size={16} /> Tạo Video
          </button>
          <button 
            onClick={() => setType('image')}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: type === 'image' ? 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)' : 'transparent',
              color: type === 'image' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            <ImageIcon size={16} /> Tạo Hình ảnh
          </button>
        </div>

        {/* Prompt Input */}
        <div className="form-group">
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>Nhập Prompt (Câu lệnh mô tả tiếng Anh)</label>
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            rows={4}
            className="search-box-input"
            style={{ width: '100%', cursor: 'text', height: 90, borderRadius: 10, padding: 12, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', color: '#fff', fontSize: 13, resize: 'none', outline: 'none' }}
            placeholder="E.g., A beautiful hyperrealistic forest stream under warm sunlight, 8k..."
          />
        </div>

        {/* Customization Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Aspect Ratio */}
          <div className="form-group">
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>Tỷ lệ khung hình</label>
            <select 
              value={aspect}
              onChange={(e) => setAspect(e.target.value)}
              disabled={loading}
              className="search-box-input"
              style={{ width: '100%', background: 'var(--bg-surface-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: '#fff', outline: 'none' }}
            >
              {type === 'video' ? (
                <>
                  <option value="16:9">16:9 (Ngang)</option>
                  <option value="9:16">9:16 (Dọc)</option>
                </>
              ) : (
                <>
                  <option value="16:9">16:9 (Ngang)</option>
                  <option value="4:3">4:3</option>
                  <option value="1:1">1:1 (Vuông)</option>
                  <option value="3:4">3:4</option>
                  <option value="9:16">9:16 (Dọc)</option>
                </>
              )}
            </select>
          </div>

          {/* Count */}
          <div className="form-group">
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>Số lượng tệp tạo</label>
            <select 
              value={count}
              onChange={(e) => setCount(e.target.value)}
              disabled={loading}
              className="search-box-input"
              style={{ width: '100%', background: 'var(--bg-surface-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: '#fff', outline: 'none' }}
            >
              <option value="1x">1x</option>
              <option value="x2">x2</option>
              <option value="x3">x3</option>
              <option value="x4">x4</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16, alignItems: 'center' }}>
          {/* Model */}
          <div className="form-group">
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>Loại mô hình AI</label>
            <select 
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={loading}
              className="search-box-input"
              style={{ width: '100%', background: 'var(--bg-surface-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: '#fff', outline: 'none' }}
            >
              {type === 'video' ? (
                <>
                  <option value="Omni Flash">Omni Flash (Mặc định)</option>
                  <option value="Veo 3.1">Veo 3.1 (Độ phân giải cao)</option>
                  <option value="Veo 3.1 Fast">Veo 3.1 Fast (Tốc độ cao)</option>
                </>
              ) : (
                <>
                  <option value="Nano Banana 2">Nano Banana 2</option>
                  <option value="Imagen 3">Imagen 3 (Chất lượng cao)</option>
                  <option value="Imagen 3 Fast">Imagen 3 Fast (Tốc độ cao)</option>
                </>
              )}
            </select>
          </div>

          {/* Show Browser Checkbox */}
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
            <input 
              type="checkbox" 
              id="show-browser" 
              checked={showBrowser}
              onChange={(e) => setShowBrowser(e.target.checked)}
              disabled={loading}
              style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            <label htmlFor="show-browser" style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, userSelect: 'none' }}>
              Hiện trình duyệt
            </label>
          </div>
        </div>

        {/* Cookie Input */}
        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Cookie size={14} style={{ color: '#f59e0b' }} /> Google Labs Cookie (Netscape)
          </label>
          <textarea 
            value={cookieText}
            onChange={(e) => setCookieText(e.target.value)}
            disabled={loading}
            rows={5}
            className="search-box-input"
            style={{ width: '100%', cursor: 'text', height: 80, fontFamily: 'monospace', fontSize: 10, borderRadius: 10, padding: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)', color: '#a3a3a3', resize: 'none', outline: 'none' }}
            placeholder="Dán nội dung file Cookie Netscape ở đây..."
          />
        </div>

        {/* Error notification */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 14px', borderRadius: 10, color: 'var(--danger)', fontSize: 12 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Submit button */}
        <button 
          onClick={handleGenerate}
          disabled={loading}
          className="btn btn-primary"
          style={{ 
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', marginTop: 8,
            boxShadow: loading ? 'none' : '0 4px 15px rgba(168, 85, 247, 0.4)'
          }}
        >
          {loading ? (
            <>
              <Loader size={16} className="spin" /> Đang sản xuất media...
            </>
          ) : (
            <>
              <Play size={16} fill="currentColor" /> Bắt đầu tạo Media
            </>
          )}
        </button>
      </div>

      {/* Result Panel & Live Logs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%', overflow: 'hidden' }}>
        {/* Preview Screen */}
        <div className="glass-panel" style={{ flex: 1.2, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 300, background: '#0a0815' }}>
          <h3 style={{ fontSize: 14, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tv size={14} /> Xem trước kết quả
          </h3>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
            {result ? (
              result.type === 'video' ? (
                <video 
                  src={result.filePath} 
                  controls 
                  autoPlay
                  loop
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <img 
                  src={result.filePath} 
                  alt="AI generated result"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              )
            ) : loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <Loader size={36} className="spin" style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{statusText || 'AI đang tạo nội dung nghe nhìn...'}</span>
              </div>
            ) : (
              <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center' }}>
                Chưa có nội dung nào được tạo. Nhấp nút bắt đầu ở bảng điều khiển bên trái.
              </div>
            )}
          </div>

          {result && (
            <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => handleOpenPath(result.filePath)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, padding: '10px' }}
              >
                <ExternalLink size={14} /> Mở Tệp tin
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => handleShowInFolder(result.filePath)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, padding: '10px' }}
              >
                <FolderOpen size={14} /> Thư mục chứa
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => handleExport(result.filePath)}
                style={{ flex: 1.2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, padding: '10px' }}
              >
                <Download size={14} /> Xuất Video/Ảnh
              </button>
            </div>
          )}
        </div>

        {/* Live Logs Terminal Console */}
        <div className="glass-panel" style={{ flex: 0.8, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 180 }}>
          <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Terminal size={14} /> Tiến trình sinh tự động
          </h3>

          <div className="console-box" style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 12, border: '1px solid rgba(255,255,255,0.03)' }}>
            {localLogs.length > 0 ? (
              localLogs.map((log, idx) => (
                <div key={idx} className={`console-line ${log.type}`} style={{ marginBottom: 4 }}>
                  [{log.timestamp}] {log.text}
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                Đang chờ kích hoạt tiến trình tự động hóa...
              </div>
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
