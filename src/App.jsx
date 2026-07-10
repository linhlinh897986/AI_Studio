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
  Activity
} from 'lucide-react';

import Dashboard from './components/Dashboard';
import ShopeeTab from './components/ShopeeTab';
import BuddhistTab from './components/BuddhistTab';
import StickmanTab from './components/StickmanTab';
import DubberTab from './components/DubberTab';
import SettingsTab from './components/SettingsTab';
import ProcessesTab from './components/ProcessesTab';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [logs, setLogs] = useState([]);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [processes, setProcesses] = useState([]);

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

  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard';
      case 'shopee': return 'Shopee Review';
      case 'buddhist': return 'Sản xuất Video Phật Pháp';
      case 'stickman': return 'Stickman Animator';
      case 'dubber': return 'Video Cloner & Dubber';
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
            className={`nav-item ${activeTab === 'dubber' ? 'active' : ''}`}
            onClick={() => setActiveTab('dubber')}
          >
            <Video className="nav-icon" />
            <span>Lồng Tiếng Video</span>
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
        <div style={{ display: activeTab === 'dashboard' ? 'contents' : 'none' }}>
          <Dashboard activeTab={activeTab} setActiveTab={setActiveTab} logs={logs} />
        </div>
        <div style={{ display: activeTab === 'shopee' ? 'contents' : 'none' }}>
          <ShopeeTab onLog={addLog} />
        </div>
        <div style={{ display: activeTab === 'buddhist' ? 'contents' : 'none' }}>
          <BuddhistTab
            onLog={addLog}
            registerProcess={registerProcess}
            updateProcess={updateProcess}
            addProcessLog={addProcessLog}
          />
        </div>
        <div style={{ display: activeTab === 'stickman' ? 'contents' : 'none' }}>
          <StickmanTab onLog={addLog} />
        </div>
        <div style={{ display: activeTab === 'dubber' ? 'contents' : 'none' }}>
          <DubberTab onLog={addLog} />
        </div>
        <div style={{ display: activeTab === 'processes' ? 'contents' : 'none' }}>
          <ProcessesTab processes={processes} setProcesses={setProcesses} />
        </div>
        <div style={{ display: activeTab === 'settings' ? 'contents' : 'none' }}>
          <SettingsTab />
        </div>
      </main>
    </div>
  );
}
