import React, { useState, useEffect } from 'react';
import { Shield, Key, Eye, EyeOff, Check, X, RefreshCw } from 'lucide-react';
const { ipcRenderer } = window.require('electron');

export default function SettingsTab() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, checking, success, error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key') || '';
    setApiKey(savedKey);
    if (savedKey) {
      testApiKey(savedKey);
    }
  }, []);

  const testApiKey = async (keyToTest) => {
    if (!keyToTest) return;
    setStatus('checking');
    try {
      const res = await ipcRenderer.invoke('settings-verify', { geminiApiKey: keyToTest });
      if (res.success) {
        setStatus('success');
        localStorage.setItem('gemini_api_key', keyToTest);
      } else {
        setStatus('error');
        setErrorMsg(res.error || 'API Key không hợp lệ.');
      }
    } catch (e) {
      setStatus('error');
      setErrorMsg(e.message);
    }
  };

  const handleSave = () => {
    if (!apiKey) {
      localStorage.removeItem('gemini_api_key');
      setStatus('idle');
      return;
    }
    testApiKey(apiKey);
  };

  const handleForceSave = () => {
    localStorage.setItem('gemini_api_key', apiKey);
    setStatus('success');
  };

  return (
    <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 24 }}>
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
  );
}
