import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Play, Square, Headphones, Sparkles, Filter, Check } from 'lucide-react';
const { ipcRenderer } = window.require('electron');

export default function LucyLabModal({ isOpen, onClose, onSelect, selectedPath }) {
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGender, setSelectedGender] = useState('all'); // all, nam, nu
  const [selectedRegion, setSelectedRegion] = useState('all'); // all, bac, nam
  const [selectedTag, setSelectedTag] = useState('all'); // all, review, truyen, etc.
  
  // Audio preview states
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    
    const fetchVoices = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await ipcRenderer.invoke('load-lucylab-voices');
        if (res.success) {
          setVoices(res.voices);
        } else {
          setError(res.error || 'Không tải được danh sách giọng nói.');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchVoices();
  }, [isOpen]);

  // Pause audio on close
  useEffect(() => {
    if (!isOpen && playingId) {
      handleStopAudio();
    }
  }, [isOpen]);

  const handlePlayPreview = (voice) => {
    if (playingId === voice.id) {
      handleStopAudio();
    } else {
      setPlayingId(voice.id);
      if (audioRef.current) {
        audioRef.current.src = voice.fileUrl;
        audioRef.current.play().catch(err => {
          console.error("Lỗi phát âm thanh mẫu:", err);
          alert("Không thể phát âm thanh xem trước. Hãy kiểm tra lại file mẫu.");
          setPlayingId(null);
        });
      }
    }
  };

  const handleStopAudio = () => {
    setPlayingId(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handleAudioEnded = () => {
    setPlayingId(null);
  };

  if (!isOpen) return null;

  // Extract all unique tags (excluding gender/region tags) for the tag filter dropdown
  const allTags = Array.from(
    new Set(
      voices.flatMap(v => v.tags || [])
        .filter(tag => !['nam', 'nữ', 'miền nam', 'miền bắc', 'nam bộ', 'bắc bộ'].includes(tag.toLowerCase()))
    )
  );

  // Filter voices
  const filteredVoices = voices.filter(voice => {
    // 1. Search Query
    const nameMatch = voice.name.toLowerCase().includes(searchQuery.toLowerCase());
    const descMatch = voice.description.toLowerCase().includes(searchQuery.toLowerCase());
    const queryMatch = nameMatch || descMatch;
    
    // 2. Gender Filter
    let genderMatch = true;
    const voiceTags = (voice.tags || []).map(t => t.toLowerCase());
    if (selectedGender === 'nam') {
      genderMatch = voiceTags.includes('nam') && !voiceTags.includes('nữ');
    } else if (selectedGender === 'nu') {
      genderMatch = voiceTags.includes('nữ') || voiceTags.includes('nu');
    }
    
    // 3. Region Filter
    let regionMatch = true;
    if (selectedRegion === 'bac') {
      regionMatch = voiceTags.includes('miền bắc') || voiceTags.includes('bắc bộ') || voiceTags.includes('bắc');
    } else if (selectedRegion === 'nam') {
      regionMatch = voiceTags.includes('miền nam') || voiceTags.includes('nam bộ') || voiceTags.includes('nam');
    }
    
    // 4. Custom Tag Filter
    let tagMatch = true;
    if (selectedTag !== 'all') {
      tagMatch = voiceTags.includes(selectedTag.toLowerCase());
    }
    
    return queryMatch && genderMatch && regionMatch && tagMatch;
  });

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(5, 3, 10, 0.85)',
      backdropFilter: 'blur(12px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      {/* Hidden Audio Element */}
      <audio ref={audioRef} onEnded={handleAudioEnded} style={{ display: 'none' }} />

      <div style={{
        width: '100%',
        maxWidth: '1000px',
        height: '85vh',
        backgroundColor: '#0c0a1a',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 40px rgba(124, 58, 237, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(90deg, rgba(124, 58, 237, 0.05) 0%, rgba(0,0,0,0) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={20} style={{ color: 'var(--primary)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#fff' }}>Thư Viện Giọng Clone LucyLab</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Chọn từ danh sách 83 giọng mẫu chất lượng cao để tiến hành nhân bản giọng nói
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: 'none',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar (Search & Filters) */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: '#090715',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div style={{ display: 'flex', gap: 16 }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                type="text"
                placeholder="Tìm kiếm giọng mẫu theo tên hoặc mô tả..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  paddingLeft: '40px',
                  paddingRight: '12px',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>

            {/* Gender Select */}
            <div style={{ width: '130px' }}>
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  padding: '0 8px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none'
                }}
              >
                <option value="all" style={{ backgroundColor: '#0c0a1a' }}>Giới tính: Tất cả</option>
                <option value="nam" style={{ backgroundColor: '#0c0a1a' }}>Giọng Nam</option>
                <option value="nu" style={{ backgroundColor: '#0c0a1a' }}>Giọng Nữ</option>
              </select>
            </div>

            {/* Region Select */}
            <div style={{ width: '130px' }}>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  padding: '0 8px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none'
                }}
              >
                <option value="all" style={{ backgroundColor: '#0c0a1a' }}>Vùng miền: Tất cả</option>
                <option value="bac" style={{ backgroundColor: '#0c0a1a' }}>Giọng Bắc</option>
                <option value="nam" style={{ backgroundColor: '#0c0a1a' }}>Giọng Nam</option>
              </select>
            </div>

            {/* Other Tags Select */}
            <div style={{ width: '140px' }}>
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  padding: '0 8px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none'
                }}
              >
                <option value="all" style={{ backgroundColor: '#0c0a1a' }}>Chủ đề: Tất cả</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag} style={{ backgroundColor: '#0c0a1a' }}>
                    {tag.charAt(0).toUpperCase() + tag.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
              <div style={{ width: 40, height: 40, border: '3px solid rgba(124, 58, 237, 0.15)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Đang tải danh sách giọng mẫu LucyLab...</span>
            </div>
          )}

          {error && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ef4444', gap: 10 }}>
              <span>Lỗi: {error}</span>
            </div>
          )}

          {!loading && !error && filteredVoices.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: 10 }}>
              <span>Không tìm thấy giọng mẫu nào khớp với bộ lọc.</span>
            </div>
          )}

          {!loading && !error && filteredVoices.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px'
            }}>
              {filteredVoices.map((voice) => {
                const isSelected = selectedPath === voice.filePath;
                const isPlaying = playingId === voice.id;
                
                return (
                  <div 
                    key={voice.id}
                    className={`glass-panel ${isSelected ? 'active' : ''}`}
                    style={{
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      border: isSelected ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.04)',
                      background: isSelected ? 'rgba(124, 58, 237, 0.05)' : 'rgba(255,255,255,0.01)',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      borderRadius: '12px'
                    }}
                  >
                    {/* Active Selected Badge */}
                    {isSelected && (
                      <span style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        background: 'var(--primary)',
                        color: '#fff',
                        borderRadius: '50%',
                        width: 20,
                        height: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Check size={12} />
                      </span>
                    )}

                    {/* Name & Title */}
                    <div>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#fff', paddingRight: isSelected ? 24 : 0 }}>
                        {voice.name}
                      </h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', height: '32px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {voice.description || 'Không có mô tả.'}
                      </p>
                    </div>

                    {/* Tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {voice.tags.map((tag, idx) => {
                        let color = 'rgba(255,255,255,0.06)';
                        let textColor = 'var(--text-secondary)';
                        if (tag.toLowerCase() === 'nam') {
                          color = 'rgba(59, 130, 246, 0.1)';
                          textColor = '#60a5fa';
                        } else if (tag.toLowerCase() === 'nữ' || tag.toLowerCase() === 'nu') {
                          color = 'rgba(236, 72, 153, 0.1)';
                          textColor = '#f472b6';
                        } else if (tag.toLowerCase().includes('bắc')) {
                          color = 'rgba(16, 185, 129, 0.1)';
                          textColor = '#34d399';
                        } else if (tag.toLowerCase().includes('nam')) {
                          color = 'rgba(245, 158, 11, 0.1)';
                          textColor = '#fbbf24';
                        }
                        
                        return (
                          <span key={idx} style={{
                            fontSize: '9px',
                            fontWeight: '600',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: color,
                            color: textColor,
                            textTransform: 'uppercase'
                          }}>
                            {tag}
                          </span>
                        );
                      })}
                    </div>

                    {/* Footer Actions */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 12 }}>
                      {/* Play Preview Button */}
                      <button
                        onClick={() => handlePlayPreview(voice)}
                        style={{
                          flex: 1,
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          fontSize: '12px',
                          fontWeight: '500',
                          border: isPlaying ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '6px',
                          backgroundColor: isPlaying ? 'rgba(124, 58, 237, 0.15)' : 'rgba(255,255,255,0.03)',
                          color: isPlaying ? 'var(--primary)' : 'var(--text-primary)',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (!isPlaying) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isPlaying) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                        }}
                      >
                        {isPlaying ? (
                          <>
                            <Square size={12} style={{ fill: 'currentColor' }} />
                            <span>Dừng</span>
                          </>
                        ) : (
                          <>
                            <Play size={12} style={{ fill: 'currentColor' }} />
                            <span>Nghe thử</span>
                          </>
                        )}
                      </button>

                      {/* Select Button */}
                      <button
                        onClick={() => {
                          onSelect(voice.filePath, voice.name);
                          onClose();
                        }}
                        style={{
                          flex: 1,
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '600',
                          border: 'none',
                          borderRadius: '6px',
                          backgroundColor: isSelected ? 'var(--success)' : 'var(--primary)',
                          color: '#fff',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.filter = 'brightness(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.filter = 'none';
                        }}
                      >
                        {isSelected ? 'Đang chọn' : 'Sử dụng'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
