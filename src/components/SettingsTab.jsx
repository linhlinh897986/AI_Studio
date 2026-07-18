import React, { useState, useEffect } from 'react';
import { Shield, Key, Eye, EyeOff, Check, X, RefreshCw, AlertTriangle, Download, ArrowUpCircle } from 'lucide-react';
const { ipcRenderer } = window.require('electron');

export default function SettingsTab() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('gemini-3.1-flash-lite');
  const [vibesSession, setVibesSession] = useState('');
  const [colabApiUrl, setColabApiUrl] = useState('');
  const [imageGenSource, setImageGenSource] = useState('meta_direct');
  const [videoGenSource, setVideoGenSource] = useState('pollinations_video');
  const [metaDirectCookie, setMetaDirectCookie] = useState('');
  const [labsGoogleCookie, setLabsGoogleCookie] = useState('');
  const [status, setStatus] = useState('idle'); // idle, checking, success, error
  const [errorMsg, setErrorMsg] = useState('');

  // Auto update variables
  const [updateState, setUpdateState] = useState({ type: 'idle' });

  useEffect(() => {
    const handleUpdateStatus = (event, data) => {
      setUpdateState(data);
    };
    ipcRenderer.on('update-status', handleUpdateStatus);
    return () => {
      ipcRenderer.removeListener('update-status', handleUpdateStatus);
    };
  }, []);

  const handleCheckUpdate = async () => {
    setUpdateState({ type: 'checking' });
    try {
      const res = await ipcRenderer.invoke('check-for-updates');
      if (!res.success) {
        setUpdateState({ type: 'error', message: res.error });
      }
    } catch (err) {
      setUpdateState({ type: 'error', message: err.message });
    }
  };

  const handleDownloadUpdate = async () => {
    setUpdateState({ type: 'downloading', percent: 0 });
    await ipcRenderer.invoke('download-update');
  };

  const handleInstallUpdate = () => {
    ipcRenderer.send('quit-and-install');
  };


  // Vibes check variables
  const [vibesCheckStatus, setVibesCheckStatus] = useState('idle'); // idle, checking, success, error
  const [vibesUsername, setVibesUsername] = useState('');
  const [vibesError, setVibesError] = useState('');

  // Local model status variables
  const [modelStatus, setModelStatus] = useState({ vieneu: false, omnivoice: false });
  const [installingModel, setInstallingModel] = useState(null);
  const [logOutput, setLogOutput] = useState('');

  const checkModelsStatus = async () => {
    try {
      const res = await ipcRenderer.invoke('check-local-models-status');
      if (res.success) {
        setModelStatus(res.status);
      }
    } catch (e) {
      console.error('Failed to check local models status:', e);
    }
  };

  const handleCheckVibesToken = async () => {
    if (!vibesSession) {
      setVibesCheckStatus('error');
      setVibesError('Vui lòng nhập token Vibes.ai trước.');
      return;
    }
    setVibesCheckStatus('checking');
    setVibesError('');
    try {
      const res = await ipcRenderer.invoke('check-vibes-token', { metaSession: vibesSession });
      if (res.success) {
        setVibesCheckStatus('success');
        setVibesUsername(res.username);
        // Automatically save if valid
        localStorage.setItem('vibes_meta_session', vibesSession);
        ipcRenderer.invoke('save-env-settings', {
          geminiApiKey: apiKey,
          geminiModel: model,
          vibesMetaSession: vibesSession,
          colabApiUrl: colabApiUrl
        });
      } else {
        setVibesCheckStatus('error');
        setVibesError(res.error || 'Token không hợp lệ.');
      }
    } catch (e) {
      setVibesCheckStatus('error');
      setVibesError(e.message);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await ipcRenderer.invoke('load-env-settings');
        if (res.success) {
          const { geminiApiKey, geminiModel, vibesMetaSession, colabApiUrl } = res.data;
          setApiKey(geminiApiKey || '');
          setModel(geminiModel || 'gemini-3.1-flash-lite');
          setVibesSession(vibesMetaSession || '');
          setColabApiUrl(colabApiUrl || '');
          
          if (geminiApiKey) localStorage.setItem('gemini_api_key', geminiApiKey);
          if (geminiModel) localStorage.setItem('gemini_model', geminiModel);
          if (vibesMetaSession) localStorage.setItem('vibes_meta_session', vibesMetaSession);
          if (colabApiUrl) localStorage.setItem('colab_api_url', colabApiUrl);

          const localSource = localStorage.getItem('image_gen_source') || 'meta_direct';
          const localVideoSource = localStorage.getItem('video_gen_source') || 'pollinations_video';
          const localCookie = localStorage.getItem('meta_direct_cookie') || '';
          const localLabsCookie = localStorage.getItem('labs_google_cookie') || '';
          setImageGenSource(localSource);
          setVideoGenSource(localVideoSource);
          setMetaDirectCookie(localCookie);
          setLabsGoogleCookie(localLabsCookie);

          if (geminiApiKey) {
            testApiKey(geminiApiKey, geminiModel);
          }
        }
      } catch (err) {
        console.error("Failed to load .env settings:", err);
      }
    };

    loadSettings();

    // Check models status
    checkModelsStatus();

    // Register log listener
    const handleLog = (event, { modelName, msg }) => {
      setLogOutput(prev => prev + msg);
    };
    ipcRenderer.on('model-install-log', handleLog);

    return () => {
      ipcRenderer.removeListener('model-install-log', handleLog);
    };
  }, []);

  const testApiKey = async (keyToTest, modelToTest = model) => {
    if (!keyToTest) return;
    setStatus('checking');
    try {
      const res = await ipcRenderer.invoke('settings-verify', { geminiApiKey: keyToTest, geminiModel: modelToTest });
      if (res.success) {
        setStatus('success');
        localStorage.setItem('gemini_api_key', keyToTest);
        localStorage.setItem('gemini_model', modelToTest);
        ipcRenderer.invoke('save-env-settings', {
          geminiApiKey: keyToTest,
          geminiModel: modelToTest,
          vibesMetaSession: vibesSession,
          colabApiUrl: colabApiUrl
        });
      } else {
        setStatus('error');
        setErrorMsg(res.error || 'API Key hoặc Model không hợp lệ.');
      }
    } catch (e) {
      setStatus('error');
      setErrorMsg(e.message);
    }
  };

  const handleSave = () => {
    localStorage.setItem('gemini_model', model);
    localStorage.setItem('vibes_meta_session', vibesSession);
    localStorage.setItem('colab_api_url', colabApiUrl);
    ipcRenderer.invoke('save-env-settings', {
      geminiApiKey: apiKey,
      geminiModel: model,
      vibesMetaSession: vibesSession,
      colabApiUrl: colabApiUrl
    });
    if (!apiKey) {
      localStorage.removeItem('gemini_api_key');
      setStatus('idle');
      return;
    }
    testApiKey(apiKey, model);
  };

  const handleForceSave = () => {
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('gemini_model', model);
    localStorage.setItem('vibes_meta_session', vibesSession);
    localStorage.setItem('colab_api_url', colabApiUrl);
    ipcRenderer.invoke('save-env-settings', {
      geminiApiKey: apiKey,
      geminiModel: model,
      vibesMetaSession: vibesSession,
      colabApiUrl: colabApiUrl
    });
    setStatus('success');
  };

  const handleInstallModel = async (modelName) => {
    setLogOutput('');
    setInstallingModel(modelName);
    try {
      const res = await ipcRenderer.invoke('install-local-model', { modelName });
      if (!res.success) {
        alert(`Lỗi cài đặt: ${res.error}`);
      }
    } catch (e) {
      alert(`Lỗi kết nối IPC: ${e.message}`);
    } finally {
      setInstallingModel(null);
      checkModelsStatus();
    }
  };

  const handleUninstallModel = async (modelName) => {
    if (!confirm(`Bạn có chắc chắn muốn gỡ cài đặt mô hình ${modelName} cục bộ?`)) return;
    setLogOutput('');
    setInstallingModel(modelName);
    try {
      const res = await ipcRenderer.invoke('uninstall-local-model', { modelName });
      if (!res.success) {
        alert(`Lỗi gỡ cài đặt: ${res.error}`);
      }
    } catch (e) {
      alert(`Lỗi kết nối IPC: ${e.message}`);
    } finally {
      setInstallingModel(null);
      checkModelsStatus();
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', padding: '12px 24px 40px 24px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="glass-panel active">
        <h2 style={{ fontSize: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={20} style={{ color: 'var(--primary)' }} /> Cấu hình Hệ thống
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
          Để sử dụng các tính năng tạo kịch bản, tự động dịch thuật và viết lời thoại thông minh, ứng dụng yêu cầu sử dụng khóa bảo mật Google Gemini API Key của bạn. Khóa này sẽ được lưu cục bộ trên máy tính của bạn và chỉ được gửi trực tiếp tới máy chủ Google AI.
        </p>

        <div className="form-group" style={{ position: 'relative' }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Key size={14} /> Google Gemini API Key
          </label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative', flexGrow: 1 }}>
              <input
                type={showKey ? 'text' : 'password'}
                className="form-input"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={status === 'checking'}
              style={{ minWidth: 120, padding: '12px 20px' }}
            >
              {status === 'checking' ? (
                <RefreshCw size={16} className="spin" />
              ) : (
                'Lưu & Kiểm tra'
              )}
            </button>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 20 }}>
          <label className="form-label">Chọn phiên bản Model Gemini</label>
          <select 
            className="form-input" 
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={status === 'checking'}
          >
            <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Mặc định - Mới nhất)</option>
            <option value="gemini-3.5-flash">Gemini 3.5 Flash (Hiệu năng cao)</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash (Chuẩn)</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro (Xử lý sâu)</option>
          </select>

        </div>

        <div className="form-group" style={{ marginTop: 20 }}>
          <label className="form-label">🎨 Bộ công cụ vẽ ảnh nền Phật giáo (Chỉ hỗ trợ Meta AI)</label>
          <select
            className="form-input"
            value={imageGenSource}
            onChange={(e) => {
              setImageGenSource(e.target.value);
              localStorage.setItem('image_gen_source', e.target.value);
            }}
            disabled={status === 'checking'}
          >
            <option value="meta_direct">Meta AI Trực tiếp (Browser — ảnh sạch, không logo)</option>
            <option value="meta_vibes">Meta AI qua Vibes.ai (Yêu cầu token Vibes.ai)</option>
          </select>
        </div>

        {imageGenSource === 'meta_vibes' && (
          <div className="form-group" style={{ marginTop: 20 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Key size={14} /> Meta AI (via Vibes.ai) Session Token (meta_session)
            </label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Nhập cookie meta_session..."
                value={vibesSession}
                onChange={(e) => {
                  setVibesSession(e.target.value);
                  localStorage.setItem('vibes_meta_session', e.target.value);
                }}
                disabled={status === 'checking'}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, flexGrow: 1 }}
              />
              <button
                className="btn btn-secondary"
                onClick={handleCheckVibesToken}
                disabled={vibesCheckStatus === 'checking'}
                style={{ minWidth: 120, padding: '12px 20px', fontSize: 13 }}
              >
                {vibesCheckStatus === 'checking' ? (
                  <RefreshCw size={14} className="spin" />
                ) : (
                  'Kiểm tra Token'
                )}
              </button>
            </div>
            {vibesCheckStatus === 'success' && (
              <div style={{ color: 'var(--success-zen)', fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Check size={12} /> <span>Token hoạt động tốt! (User: <strong>{vibesUsername}</strong>)</span>
              </div>
            )}
            {vibesCheckStatus === 'error' && (
              <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <X size={12} /> <span>{vibesError}</span>
              </div>
            )}
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
              Cookie dùng để tạo ảnh chất lượng cao miễn phí trên Vibes.ai. Hãy lấy từ DevTools trên trang web vibes.ai.
            </div>
          </div>
        )}

        <div style={{ marginTop: 25, borderTop: '1px dashed var(--border)', paddingTop: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
            🔑 Quản lý Cookie Tài khoản
          </h3>
          
          <div className="form-group" style={{ padding: 14, borderRadius: 10, border: '1px solid rgba(249, 115, 22, 0.2)', background: 'rgba(249, 115, 22, 0.02)', marginBottom: 20 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f97316', fontWeight: 600 }}>
              Cookie Meta.ai (Dành cho Ảnh nền Phật giáo)
            </label>
            <textarea
              className="form-input"
              rows={4}
              placeholder={'# Netscape HTTP Cookie File\nhoặc dán chuỗi Cookie thô từ F12 (datr=...; ecto_1_sess=...)'}
              value={metaDirectCookie}
              onChange={(e) => {
                setMetaDirectCookie(e.target.value);
                localStorage.setItem('meta_direct_cookie', e.target.value);
              }}
              disabled={status === 'checking'}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, width: '100%', padding: '10px', resize: 'vertical' }}
            />
            {metaDirectCookie && (metaDirectCookie.includes('labs.google') || metaDirectCookie.includes('google.com/fx')) && (
              <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 6, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <strong>Cảnh báo:</strong> Hình như bạn đang dán nhầm Cookie của <strong>Google Labs</strong> vào ô nhập Meta.ai!
              </div>
            )}
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
              Dán toàn bộ nội dung file cookie xuất từ extension (Netscape format) hoặc chuỗi cookie thô từ F12 → Network → Request Headers trên{' '}
              <a href="https://meta.ai" target="_blank" rel="noreferrer" style={{ color: '#f97316', textDecoration: 'underline' }}>meta.ai</a>.
            </div>
          </div>

          <div className="form-group" style={{ padding: 14, borderRadius: 10, border: '1px solid rgba(168, 85, 247, 0.2)', background: 'rgba(168, 85, 247, 0.02)' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#a855f7', fontWeight: 600 }}>
              Cookie Google Labs (Dành cho Người Que AI / Veo 3)
            </label>
            <textarea
              className="form-input"
              rows={4}
              placeholder={'# Netscape HTTP Cookie File\nhoặc dán chuỗi Cookie thô từ F12...'}
              value={labsGoogleCookie}
              onChange={(e) => {
                setLabsGoogleCookie(e.target.value);
                localStorage.setItem('labs_google_cookie', e.target.value);
              }}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, width: '100%', padding: '10px', resize: 'vertical' }}
            />
            {labsGoogleCookie && (labsGoogleCookie.includes('meta.ai') || labsGoogleCookie.includes('vibes.ai')) && (
              <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 6, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <strong>Cảnh báo:</strong> Hình như bạn đang dán nhầm Cookie của <strong>Meta.ai</strong> vào ô nhập Google Labs!
              </div>
            )}
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
              Dán toàn bộ nội dung file cookie xuất từ extension (Netscape format) trên{' '}
              <a href="https://labs.google" target="_blank" rel="noreferrer" style={{ color: '#a855f7', textDecoration: 'underline' }}>labs.google</a>.
            </div>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 20 }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            🌐 Google Colab / Local API URL
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="http://localhost:39828 hoặc link ngrok/cloudflare..."
            value={colabApiUrl}
            onChange={(e) => {
              setColabApiUrl(e.target.value);
              localStorage.setItem('colab_api_url', e.target.value);
            }}
            disabled={status === 'checking'}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
          />
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
            Đường dẫn API chạy OmniVoice hoặc VieNeu-TTS (mặc định cổng 39828 trên Colab hoặc Local server).
          </div>
        </div>

        {/* API Status Feedback */}
        {status === 'success' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success-zen)', fontSize: 13, background: 'rgba(16, 185, 129, 0.08)', padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <Check size={16} /> Kết nối thành công! Khóa Gemini API hoạt động tốt.
          </div>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(239, 68, 68, 0.06)', padding: '16px', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#ef4444', fontSize: 13 }}>
              <X size={16} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong>Lỗi kiểm tra khóa:</strong>
                <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{errorMsg}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <button 
                className="btn btn-secondary" 
                onClick={handleForceSave}
                style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8 }}
              >
                Vẫn lưu khóa (Bỏ qua kiểm tra)
              </button>
            </div>
          </div>
        )}

        {status === 'idle' && !apiKey && (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            * Chưa lưu khóa API. Vui lòng nhập khóa của bạn để kích hoạt AI.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20 }}>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={status === 'checking'}
            style={{ padding: '10px 24px', fontSize: 13, fontWeight: '600', borderRadius: 8 }}
          >
            Lưu Toàn Bộ Cấu Hình
          </button>
        </div>
      </div>

      <div className="glass-panel active" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          🎙️ Quản lý Mô hình Local (TTS Models Manager)
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
          Để sử dụng tính năng lồng tiếng và nhân bản giọng nói (voice cloning) hoàn toàn ngoại tuyến (offline) trên thiết bị của bạn mà không cần Google Colab, bạn có thể tải và cài đặt các mô hình trực tiếp vào môi trường ảo của ứng dụng.
        </p>

        {/* Model 1: VieNeu-TTS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              VieNeu-TTS (ONNX Runtime)
              {modelStatus.vieneu ? (
                <span style={{ fontSize: 11, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-zen)', padding: '2px 8px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Check size={10} /> Đã cài đặt
                </span>
              ) : (
                <span style={{ fontSize: 11, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 8px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <X size={10} /> Chưa cài đặt
                </span>
              )}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
              Mô hình lồng tiếng Việt chất lượng cao chạy trực tiếp trên CPU/GPU local.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              className="btn btn-primary"
              onClick={() => handleInstallModel('vieneu')}
              disabled={installingModel !== null}
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              {installingModel === 'vieneu' ? <RefreshCw size={14} className="spin" /> : 'Cài đặt Local'}
            </button>
            {modelStatus.vieneu && (
              <button 
                className="btn btn-secondary"
                onClick={() => handleUninstallModel('vieneu')}
                disabled={installingModel !== null}
                style={{ padding: '8px 16px', fontSize: 13, borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
              >
                Gỡ cài đặt
              </button>
            )}
          </div>
        </div>

        {/* Model 2: OmniVoice */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              OmniVoice (Zero-Shot Clone)
              {modelStatus.omnivoice ? (
                <span style={{ fontSize: 11, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-zen)', padding: '2px 8px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Check size={10} /> Đã cài đặt
                </span>
              ) : (
                <span style={{ fontSize: 11, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 8px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <X size={10} /> Chưa cài đặt
                </span>
              )}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
              Mô hình clone giọng nói đa ngôn ngữ nâng cao chạy trực tiếp trên local.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              className="btn btn-primary"
              onClick={() => handleInstallModel('omnivoice')}
              disabled={installingModel !== null}
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              {installingModel === 'omnivoice' ? <RefreshCw size={14} className="spin" /> : 'Cài đặt Local'}
            </button>
            {modelStatus.omnivoice && (
              <button 
                className="btn btn-secondary"
                onClick={() => handleUninstallModel('omnivoice')}
                disabled={installingModel !== null}
                style={{ padding: '8px 16px', fontSize: 13, borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
              >
                Gỡ cài đặt
              </button>
            )}
          </div>
        </div>

        {/* Real-time terminal log for installation */}
        {logOutput && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Bảng điều khiển Tiến trình cài đặt:</div>
            <pre style={{
              background: '#0a0813',
              color: '#34d399',
              padding: '16px',
              borderRadius: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              maxHeight: 250,
              overflowY: 'auto',
              border: '1px solid rgba(255,255,255,0.05)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}>
              {logOutput}
            </pre>
          </div>
        )}
      </div>

      {/* Auto Update Section */}
      <div className="glass-panel" style={{ padding: 24, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ArrowUpCircle size={22} style={{ color: 'var(--primary)' }} />
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>Cập nhật Ứng dụng (Auto Update)</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Tự động kiểm tra và nâng cấp phiên bản mới nhất từ GitHub Releases.</p>
            </div>
          </div>
          <button 
            className="btn btn-secondary"
            onClick={handleCheckUpdate}
            disabled={updateState.type === 'checking' || updateState.type === 'downloading'}
            style={{ padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <RefreshCw size={14} className={updateState.type === 'checking' ? 'spin' : ''} />
            {updateState.type === 'checking' ? 'Đang kiểm tra...' : 'Kiểm tra cập nhật'}
          </button>
        </div>

        {updateState.type === 'available' && (
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: 16, borderRadius: 8, marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ color: '#818cf8', fontSize: 14 }}>Phát hiện bản cập nhật mới: v{updateState.version}</strong>
                {updateState.releaseNotes && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{updateState.releaseNotes}</p>
                )}
              </div>
              <button 
                className="btn btn-primary"
                onClick={handleDownloadUpdate}
                style={{ padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={14} /> Tải bản cập nhật
              </button>
            </div>
          </div>
        )}

        {updateState.type === 'downloading' && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: 16, borderRadius: 8, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#34d399' }}>
              <span>Đang tải xuống bản vá... {updateState.percent || 0}%</span>
              <span>{updateState.speedKB || 0} KB/s</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ background: '#10b981', height: '100%', width: `${updateState.percent || 0}%`, transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        {updateState.type === 'downloaded' && (
          <div style={{ background: 'rgba(52, 211, 153, 0.15)', border: '1px solid #34d399', padding: 16, borderRadius: 8, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#34d399', fontSize: 14, fontWeight: 500 }}>Bản cập nhật v{updateState.version} đã sẵn sàng cài đặt!</span>
            <button 
              className="btn btn-primary"
              onClick={handleInstallUpdate}
              style={{ padding: '8px 16px', fontSize: 13, background: '#10b981', borderColor: '#10b981' }}
            >
              Khởi động lại & Cài đặt
            </button>
          </div>
        )}

        {updateState.type === 'not-available' && (
          <div style={{ color: '#34d399', fontSize: 13, marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={16} /> Bạn đang sử dụng phiên bản mới nhất.
          </div>
        )}

        {updateState.type === 'error' && (
          <div style={{ color: '#f87171', fontSize: 13, marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={16} /> Lỗi kiểm tra cập nhật: {updateState.message}
          </div>
        )}
      </div>

      <div className="glass-panel" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, marginBottom: 10, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Mẹo sử dụng</h3>
        <ul style={{ paddingLeft: 18, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.8 }}>
          <li>Bạn có thể lấy khóa API miễn phí (hoặc trả phí tùy nhu cầu) từ <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--secondary)', textDecoration: 'none' }}>Google AI Studio</a>.</li>
          <li>Thư mục chứa video kết xuất tạm thời: <code style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>ViGenAIO_Temp</code> nằm trong thư mục dữ liệu AppData của hệ thống.</li>
        </ul>
      </div>

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      </div>
    </div>
  );
}
