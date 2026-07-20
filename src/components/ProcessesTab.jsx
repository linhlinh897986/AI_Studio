import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Play, 
  FolderOpen, 
  Search, 
  Trash2, 
  Terminal,
  FileVideo,
  ChevronDown,
  ChevronUp,
  StopCircle
} from 'lucide-react';

const { ipcRenderer } = window.require('electron');

export default function ProcessesTab({ processes = [], setProcesses, stopProcess, stopAllProcesses }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const logContainerRef = useRef(null);

  // Statistics
  const total = processes.length;
  const running = processes.filter(p => p.status === 'running').length;
  const success = processes.filter(p => p.status === 'success').length;
  const failed = processes.filter(p => p.status === 'failed').length;

  // Filter processes
  const filtered = processes.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Auto-scroll log box to bottom when logs update, but ONLY scroll inside the log box
  // NOT the whole page - use scrollTop on container, not scrollIntoView
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [expandedId, processes]);

  const handleOpenVideo = async (filePath) => {
    if (!filePath) return;
    const res = await ipcRenderer.invoke('open-path', { filePath });
    if (!res.success) {
      alert(`Không thể mở file: ${res.error}`);
    }
  };

  const handleOpenFolder = async (filePath) => {
    if (!filePath) return;
    const res = await ipcRenderer.invoke('show-item-in-folder', { filePath });
    if (!res.success) {
      alert(`Không thể mở thư mục: ${res.error}`);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử tiến trình đã hoàn tất? Các tiến trình đang chạy sẽ được giữ lại.")) {
      setProcesses(prev => prev.filter(p => p.status === 'running'));
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'running':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--success)', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '4px 10px', borderRadius: 20 }}>
            <Loader2 size={12} className="spin" /> ĐANG CHẠY
          </span>
        );
      case 'success':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--success)', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '4px 10px', borderRadius: 20 }}>
            <CheckCircle2 size={12} /> HOÀN THÀNH
          </span>
        );
      case 'failed':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '4px 10px', borderRadius: 20 }}>
            <XCircle size={12} /> THẤT BẠI
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="tab-content" style={{ flexDirection: 'column', gap: 24, padding: '24px 0' }}>
      {/* Top statistics section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <Activity size={20} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tổng tiến trình</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginTop: 4 }}>{total}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(34, 197, 94, 0.04)', border: '1px solid rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
            <Loader2 size={20} className={running > 0 ? "spin" : ""} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Đang xử lý</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>{running}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Thành công</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>{success}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
            <XCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Thất bại</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444', marginTop: 4 }}>{failed}</div>
          </div>
        </div>
      </div>

      {/* Filter and clean controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div className="search-box-container" style={{ flex: 1, maxWidth: 400, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <Search className="search-box-icon" />
          <input 
            type="text" 
            className="search-box-input" 
            placeholder="Tìm kiếm theo tên tiến trình hoặc ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {running > 0 && (
            <button 
              className="btn" 
              onClick={() => {
                if (window.confirm("Bạn có chắc chắn muốn dừng TẤT CẢ các tiến trình ngầm đang chạy?")) {
                  stopAllProcesses && stopAllProcesses('Người dùng bấm dừng tất cả tiến trình.');
                }
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', fontWeight: 600 }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'}
            >
              <StopCircle size={15} /> Dừng tất cả ({running})
            </button>
          )}

          {processes.some(p => p.status !== 'running') && (
            <button 
              className="btn" 
              onClick={handleClearHistory}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.06)'}
            >
              <Trash2 size={15} /> Xóa lịch sử đã xong
            </button>
          )}
        </div>
      </div>

      {/* Process list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {filtered.length > 0 ? (
          filtered.map((proc) => {
            const isExpanded = expandedId === proc.id;
            return (
              <div 
                key={proc.id} 
                className="glass-panel" 
                style={{ 
                  padding: 20, 
                  border: isExpanded ? '1px solid var(--border-focus)' : '1px solid var(--border)',
                  boxShadow: isExpanded ? '0 8px 30px rgba(168, 85, 247, 0.08)' : 'none',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
                }}
              >
                {/* Process header */}
                <div 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setExpandedId(isExpanded ? null : proc.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                    <div style={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: 8, 
                      background: 'rgba(255,255,255,0.02)', 
                      border: '1px solid var(--border)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: proc.status === 'running' ? 'var(--success)' : 'var(--text-secondary)'
                    }}>
                      <FileVideo size={18} />
                    </div>
                    
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h4 style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{proc.name}</h4>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>ID: {proc.id}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> Bắt đầu: {proc.startTime}</span>
                        {proc.endTime && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> Kết thúc: {proc.endTime}</span>}
                        <span style={{ textTransform: 'capitalize' }}>Phân loại: {proc.type}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {proc.status === 'running' && (
                      <button
                        className="btn"
                        title="Dừng tác vụ này"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Bạn có chắc chắn muốn dừng tác vụ "${proc.name}"?`)) {
                            stopProcess && stopProcess(proc.id, 'Người dùng bấm dừng tác vụ thủ công.');
                          }
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', borderRadius: 8, fontWeight: 600 }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.22)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'}
                      >
                        <StopCircle size={13} /> Dừng tác vụ
                      </button>
                    )}
                    {getStatusBadge(proc.status)}
                    {isExpanded ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </div>

                {/* Progress bar (always visible for running tasks) */}
                {proc.status === 'running' && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
                      <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Loader2 size={12} className="spin" style={{ color: 'var(--success)' }} /> {proc.stage || 'Đang xử lý...'}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--success)' }}>{proc.progress}%</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.02)' }}>
                      <div style={{ height: '100%', width: `${proc.progress}%`, background: 'linear-gradient(to right, var(--success), #22c55e)', borderRadius: 3, boxShadow: '0 0 10px rgba(34, 197, 94, 0.4)', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )}

                {/* Error Banner (always visible when failed, even if collapsed) */}
                {proc.status === 'failed' && proc.error && (
                  <div style={{ marginTop: 14, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <XCircle size={16} style={{ marginTop: 2, flexShrink: 0, color: '#ef4444' }} />
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: '#ef4444', display: 'block', fontSize: 12, textTransform: 'uppercase', marginBottom: 2 }}>Chi tiết lỗi phát sinh:</strong>
                      <span style={{ color: '#fca5a5', lineHeight: 1.4, wordBreak: 'break-word' }}>{proc.error}</span>
                    </div>
                  </div>
                )}

                {/* Expanded Console Logs & File Actions */}
                {isExpanded && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    
                    {/* Action buttons for success */}
                    {proc.status === 'success' && proc.outputPath && (
                      <div style={{ display: 'flex', gap: 12, background: 'rgba(34, 197, 94, 0.04)', padding: 14, borderRadius: 12, border: '1px solid rgba(34, 197, 94, 0.15)' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block' }}>TỆP KẾT XUẤT THÀNH PHẨM:</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'block', marginTop: 2, wordBreak: 'break-all' }}>
                            {proc.outputPath.split('/').pop()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <button 
                            className="btn btn-secondary" 
                            onClick={() => handleOpenVideo(proc.outputPath)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12 }}
                          >
                            <Play size={13} /> Mở Video
                          </button>
                          <button 
                            className="btn btn-primary" 
                            onClick={() => handleOpenFolder(proc.outputPath)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12, background: 'linear-gradient(135deg, var(--success) 0%, #15803d 100%)' }}
                          >
                            <FolderOpen size={13} /> Mở thư mục
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Error display */}
                    {proc.status === 'failed' && proc.error && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 12, padding: '14px 18px', color: '#f87171', fontSize: 13 }}>
                        <strong>LỖI CHI TIẾT:</strong> {proc.error}
                      </div>
                    )}

                    {/* Logging console box */}
                    <div>
                      <h5 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Terminal size={13} /> Nhật ký hoạt động (Logs)
                      </h5>
                      <div 
                        ref={logContainerRef}
                        style={{ 
                          height: 180, 
                          background: 'rgba(0,0,0,0.4)', 
                          borderRadius: 12, 
                          border: '1px solid var(--border)', 
                          padding: 14, 
                          overflowY: 'auto', 
                          fontFamily: 'var(--font-mono)', 
                          fontSize: 11, 
                          display: 'flex', 
                          flexDirection: 'column-reverse', 
                          gap: 4 
                        }}
                      >
                        {proc.logs.map((log, idx) => (
                          <div key={idx} style={{ color: log.type === 'error' ? '#ef4444' : log.type === 'success' ? 'var(--success)' : log.type === 'warning' ? '#f59e0b' : 'var(--text-muted)' }}>
                            [{log.timestamp}] {log.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              <Activity size={28} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, color: '#fff', marginBottom: 6 }}>Chưa có tiến trình hoạt động</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto', lineHeight: 1.5 }}>
                Không có tác vụ nào đang hoạt động hoặc được ghi nhận trong lịch sử. Hãy sản xuất video review Shopee hoặc Phật pháp để xem quá trình xử lý ngầm tại đây.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
