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
  Cpu,
  Layers,
  Wifi,
  Clock,
  Bell,
  Search,
  Activity
} from 'lucide-react';

import Dashboard from './components/Dashboard';
import ShopeeTab from './components/ShopeeTab';
import BuddhistTab from './components/BuddhistTab';
import StickmanTab from './components/StickmanTab';
import DubberTab from './components/DubberTab';
import SettingsTab from './components/SettingsTab';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [logs, setLogs] = useState([]);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // Real-time Sci-Fi Dashboard stats state
  const [currentTime, setCurrentTime] = useState('');
  const [cpuUsage, setCpuUsage] = useState(18);
  const [ramUsage, setRamUsage] = useState(44);
  const [gpuUsage, setGpuUsage] = useState(8);

  // Time & System Specs Simulation
  useEffect(() => {
    // 1. Clock
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    // 2. CPU / RAM / GPU jitter simulation (Sci-Fi Center aesthetic)
    const statsTimer = setInterval(() => {
      setCpuUsage(Math.floor(12 + Math.random() * 15));
      setRamUsage(Math.floor(41 + Math.random() * 4));
      setGpuUsage(Math.floor(4 + Math.random() * 12));
    }, 3000);

    return () => {
      clearInterval(timer);
      clearInterval(statsTimer);
    };
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

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard activeTab={activeTab} setActiveTab={setActiveTab} logs={logs} />;
      case 'shopee':
        return <ShopeeTab onLog={addLog} />;
      case 'buddhist':
        return <BuddhistTab onLog={addLog} />;
      case 'stickman':
        return <StickmanTab onLog={addLog} />;
      case 'dubber':
        return <DubberTab onLog={addLog} />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <Dashboard activeTab={activeTab} setActiveTab={setActiveTab} logs={logs} />;
    }
  };

  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard - Hạm Đội Điều Khiển';
      case 'shopee': return 'Kênh Review Shopee Affiliate';
      case 'buddhist': return 'Kiến Tạo Phim Phật Pháp';
      case 'stickman': return 'Hoạt Họa Người Que AI';
      case 'dubber': return 'Trình Dịch & Lồng Tiếng Phim';
      case 'settings': return 'Cấu Hình Hệ Thống AI';
      default: return 'Trạm Điều Khiển';
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon" />
          <span className="logo-text">VIGEN AIO</span>
        </div>

        <nav className="nav-links">
          <div 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard className="nav-icon" />
            <span>Trạm Tổng Quan</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'shopee' ? 'active' : ''}`}
            onClick={() => setActiveTab('shopee')}
          >
            <ShoppingBag className="nav-icon" />
            <span>Shopee Generator</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'buddhist' ? 'active' : ''}`}
            onClick={() => setActiveTab('buddhist')}
          >
            <Compass className="nav-icon" />
            <span>Buddhist Engine</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'stickman' ? 'active' : ''}`}
            onClick={() => setActiveTab('stickman')}
          >
            <Smile className="nav-icon" />
            <span>Stickman Comic</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'dubber' ? 'active' : ''}`}
            onClick={() => setActiveTab('dubber')}
          >
            <Video className="nav-icon" />
            <span>Video Translator</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            style={{ marginTop: 'auto' }}
          >
            <Settings className="nav-icon" />
            <span>Bảng Cấu Hình</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-muted)' }}>
            <Server size={14} style={{ color: 'var(--accent-green)', filter: 'drop-shadow(0 0 5px var(--accent-green))' }} />
            <span>Hệ Thống Trực Tuyến</span>
          </div>
        </div>
      </aside>

      {/* Main Studio Frame */}
      <main className="main-content">
        {/* Sci-Fi Header Top Bar */}
        <header className="header-bar">
          <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Activity size={18} style={{ color: 'var(--secondary)', filter: 'drop-shadow(0 0 5px var(--secondary))' }} />
            <h2>{getHeaderTitle()}</h2>
          </div>
          
          {/* Futuristic System Stats Dashboard */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* CPU */}
            <div className="status-pill">
              <Cpu size={12} style={{ color: 'var(--secondary)' }} />
              <span>CPU: {cpuUsage}%</span>
            </div>
            
            {/* RAM */}
            <div className="status-pill">
              <Layers size={12} style={{ color: 'var(--primary)' }} />
              <span>RAM: {ramUsage}%</span>
            </div>

            {/* GPU */}
            <div className="status-pill">
              <Activity size={12} style={{ color: 'var(--accent-green)' }} />
              <span>GPU: {gpuUsage}%</span>
            </div>

            {/* NET */}
            <div className="status-pill">
              <Wifi size={12} style={{ color: 'var(--secondary)' }} />
              <div className="status-dot" />
            </div>

            {/* Clock */}
            <div className="status-pill" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
              <Clock size={12} style={{ color: '#fff' }} />
              <span style={{ color: '#fff', fontWeight: 600 }}>{currentTime || '00:00:00'}</span>
            </div>

            {/* Notification Bell (Visual Accent) */}
            <div style={{ position: 'relative', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              <Bell size={16} />
              <span style={{ position: 'absolute', top: -4, right: -4, width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />
            </div>
          </div>
        </header>

        {renderActiveTab()}
      </main>
    </div>
  );
}
