import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Compass, 
  Smile, 
  Video, 
  Settings, 
  AlertTriangle,
  Server,
  Search,
  Bell,
  User,
  Activity,
  Tv,
  Film
} from 'lucide-react';

import Dashboard from './components/Dashboard';
import ShopeeTab from './components/ShopeeTab';
import BuddhistTab from './components/BuddhistTab';
import StickmanTab from './components/StickmanTab';
import SettingsTab from './components/SettingsTab';
import ProcessesTab from './components/ProcessesTab';
import VideoCloneTab from './components/VideoCloneTab';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [logs, setLogs] = useState([]);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [processes, setProcesses] = useState(() => {
    try {
      const saved = localStorage.getItem('vigen_processes');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Automatically mark previously 'running' tasks as interrupted (failed) on reload/restart
        return parsed.map((proc) => {
          if (proc.status === 'running') {
            const timestamp = new Date().toLocaleTimeString();
            return {
              ...proc,
              status: 'failed',
              error: 'Tiến trình bị gián đoạn do tắt ứng dụng hoặc tải lại.',
              endTime: timestamp,
              logs: [
                { timestamp, text: 'Tiến trình bị gián đoạn do ứng dụng khởi động lại.', type: 'error' },
                ...proc.logs
              ]
            };
          }
          return proc;
        });
      }
      return [];
    } catch (e) {
      console.error("Failed to load processes from localStorage", e);
      return [];
    }
  });

  // Save processes list to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('vigen_processes', JSON.stringify(processes));
    } catch (e) {
      console.error("Failed to save processes to localStorage", e);
    }
  }, [processes]);

  // Hydrate all persistent settings from IPC backend on app launch
  useEffect(() => {
    const hydrateSettings = async () => {
      try {
        const { ipcRenderer } = window.require ? window.require('electron') : {};
        if (ipcRenderer) {
          const res = await ipcRenderer.invoke('load-env-settings');
          if (res.success && res.data) {
            const { 
              geminiApiKey, 
              geminiModel, 
              vibesMetaSession, 
              colabApiUrl, 
              metaDirectCookie, 
              labsGoogleCookie, 
              nineRouterUrl, 
              nineRouterKey, 
              nineRouterModel 
            } = res.data;

            if (geminiApiKey) {
              localStorage.setItem('gemini_api_key', geminiApiKey);
              setHasApiKey(true);
            }
            if (geminiModel) localStorage.setItem('gemini_model', geminiModel);
            if (vibesMetaSession) localStorage.setItem('vibes_meta_session', vibesMetaSession);
            if (colabApiUrl) localStorage.setItem('colab_api_url', colabApiUrl);
            if (metaDirectCookie) localStorage.setItem('meta_direct_cookie', metaDirectCookie);
            if (labsGoogleCookie) localStorage.setItem('labs_google_cookie', labsGoogleCookie);
            if (nineRouterUrl) localStorage.setItem('ninerouter_url', nineRouterUrl);
            if (nineRouterKey) localStorage.setItem('ninerouter_key', nineRouterKey);
            if (nineRouterModel) localStorage.setItem('ninerouter_model', nineRouterModel);
          }
        }
      } catch (err) {
        console.error("Failed to hydrate settings on startup:", err);
      }
    };
    hydrateSettings();
  }, []);

  // Poll localStorage to check if API key exists for visual warning badges
  useEffect(() => {
    const checkApiKey = () => {
      const key = localStorage.getItem('gemini_api_key');
      setHasApiKey(!!key);
    };

    checkApiKey();
    const interval = setInterval(checkApiKey, 2000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (tab, text, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prevLogs) => [
      { tab, text, type, timestamp },
      ...prevLogs.slice(0, 99) // Cap at 100 logs
    ]);
  };

  const registerProcess = (id, name, type) => {
    const timestamp = new Date().toLocaleTimeString();
    setProcesses((prev) => [
      {
        id,
        name,
        type,
        status: 'running',
        progress: 0,
        stage: 'Khởi tạo tiến trình...',
        startTime: timestamp,
        endTime: null,
        outputPath: null,
        error: null,
        logs: [{ timestamp, text: 'Tiến trình đăng ký thành công.', type: 'success' }]
      },
      ...prev
    ]);
    addLog(type, `Khởi tạo tiến trình ngầm: "${name}" [ID: ${id}]`, 'info');
  };

  const updateProcess = (id, updates) => {
    setProcesses((prev) =>
      prev.map((proc) => {
        if (proc.id === id) {
          const updated = { ...proc, ...updates };
          if (updates.status === 'success' || updates.status === 'failed') {
            updated.endTime = new Date().toLocaleTimeString();
          }
          return updated;
        }
        return proc;
      })
    );
  };

  const addProcessLog = (id, text, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setProcesses((prev) =>
      prev.map((proc) => {
        if (proc.id === id) {
          return {
            ...proc,
            logs: [{ timestamp, text, type }, ...proc.logs]
          };
        }
        return proc;
      })
    );
  };

  const stopProcess = (id, reason = 'Đã dừng bởi người dùng.') => {
    const timestamp = new Date().toLocaleTimeString();
    setProcesses((prev) =>
      prev.map((proc) => {
        if (proc.id === id && proc.status === 'running') {
          return {
            ...proc,
            status: 'failed',
            error: reason,
            endTime: timestamp,
            logs: [{ timestamp, text: `[ĐÃ DỪNG] ${reason}`, type: 'error' }, ...proc.logs]
          };
        }
        return proc;
      })
    );
    addLog('process', `Đã dừng tiến trình [ID: ${id}]`, 'warning');
  };

  const stopAllProcesses = (reason = 'Đã dừng tất cả các tiến trình ngầm đang chạy.') => {
    const timestamp = new Date().toLocaleTimeString();
    setProcesses((prev) =>
      prev.map((proc) => {
        if (proc.status === 'running') {
          return {
            ...proc,
            status: 'failed',
            error: reason,
            endTime: timestamp,
            logs: [{ timestamp, text: `[ĐÃ DỪNG HÀNG LOẠT] ${reason}`, type: 'error' }, ...proc.logs]
          };
        }
        return proc;
      })
    );
    addLog('process', `Đã dừng tất cả các tiến trình đang chạy.`, 'warning');
  };

  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard';
      case 'shopee': return 'Shopee Review';
      case 'buddhist': return 'Sản xuất Video Phật Pháp';
      case 'stickman': return 'Stickman Animator';
      case 'video-clone': return 'Clone Video AI';
      case 'processes': return 'Giám sát Tiến trình ngầm';
      case 'settings': return 'Cấu hình Hệ thống';
      default: return 'Studio';
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon" />
          <span className="logo-text">ViGen AIO</span>
        </div>

        <nav className="nav-links">
          <div 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard className="nav-icon" />
            <span>Dashboard</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'shopee' ? 'active' : ''}`}
            onClick={() => setActiveTab('shopee')}
          >
            <ShoppingBag className="nav-icon" />
            <span>Shopee Review</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'buddhist' ? 'active' : ''}`}
            onClick={() => setActiveTab('buddhist')}
          >
            <Compass className="nav-icon" />
            <span>Video Phật Pháp</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'stickman' ? 'active' : ''}`}
            onClick={() => setActiveTab('stickman')}
          >
            <Smile className="nav-icon" />
            <span>Người Que AI</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'video-clone' ? 'active' : ''}`}
            onClick={() => setActiveTab('video-clone')}
          >
            <Film className="nav-icon" />
            <span>Clone Video AI</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'processes' ? 'active' : ''}`}
            onClick={() => setActiveTab('processes')}
          >
            <Activity className="nav-icon" />
            <span>Tiến Trình</span>
            {processes.filter(p => p.status === 'running').length > 0 && (
              <span style={{ 
                marginLeft: 'auto', 
                fontSize: 10, 
                fontWeight: 'bold', 
                background: 'var(--success)', 
                color: '#fff', 
                padding: '2px 6px', 
                borderRadius: 10, 
                boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)'
              }}>
                {processes.filter(p => p.status === 'running').length}
              </span>
            )}
          </div>

          <div 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            style={{ marginTop: 'auto' }}
          >
            <Settings className="nav-icon" />
            <span>Tab Cấu Hình</span>
            {!hasApiKey && (
              <AlertTriangle 
                size={14} 
                style={{ color: '#f59e0b', marginLeft: 'auto' }} 
                title="Cảnh báo: Chưa cài đặt API Key"
              />
            )}
          </div>
        </nav>

        {/* Footer info: Local servers check */}
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
            <Server size={14} style={{ color: 'var(--success)' }} />
            <span>Hệ thống: Sẵn sàng</span>
          </div>
        </div>
      </aside>

      {/* Main Studio Frame */}
      <main className="main-content">
        <header className="header-bar">
          <div className="header-title">
            <h2>{getHeaderTitle()}</h2>
          </div>

          {/* Search box & Command palette placeholder */}
          <div className="search-box-container">
            <Search className="search-box-icon" />
            <input 
              type="text" 
              className="search-box-input" 
              placeholder="Tìm kiếm hoặc gõ lệnh (Ctrl + K)..." 
              readOnly
              style={{ cursor: 'pointer' }}
              onClick={() => alert("Command Palette đang được phát triển trong phiên bản tiếp theo.")}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {!hasApiKey && activeTab !== 'settings' && (
              <div 
                onClick={() => setActiveTab('settings')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 10, color: 'var(--warning)', fontSize: 12, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <AlertTriangle size={14} />
                <span>Yêu cầu Gemini API Key</span>
              </div>
            )}
            
            {/* Notification & User Actions */}
            <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 200ms' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>
              <Bell size={18} />
            </button>

            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-surface-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <User size={16} />
            </div>
          </div>
        </header>

        {/* Always-mounted tabs — hidden with display:none to preserve component state */}
        <div style={{ display: activeTab === 'dashboard' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          <Dashboard activeTab={activeTab} setActiveTab={setActiveTab} logs={logs} />
        </div>
        <div style={{ display: activeTab === 'shopee' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          <ShopeeTab 
            onLog={addLog}
            registerProcess={registerProcess}
            updateProcess={updateProcess}
            addProcessLog={addProcessLog}
          />
        </div>
        <div style={{ display: activeTab === 'buddhist' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          <BuddhistTab
            onLog={addLog}
            registerProcess={registerProcess}
            updateProcess={updateProcess}
            addProcessLog={addProcessLog}
          />
        </div>
        <div style={{ display: activeTab === 'stickman' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          <StickmanTab 
            onLog={addLog}
            registerProcess={registerProcess}
            updateProcess={updateProcess}
            addProcessLog={addProcessLog}
          />
        </div>
        <div style={{ display: activeTab === 'video-clone' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          <VideoCloneTab 
            onLog={addLog}
            registerProcess={registerProcess}
            updateProcess={updateProcess}
            addProcessLog={addProcessLog}
          />
        </div>
        <div style={{ display: activeTab === 'processes' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          <ProcessesTab 
            processes={processes} 
            setProcesses={setProcesses} 
            stopProcess={stopProcess}
            stopAllProcesses={stopAllProcesses}
          />
        </div>
        <div style={{ display: activeTab === 'settings' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          <SettingsTab />
        </div>
      </main>
    </div>
  );
}
