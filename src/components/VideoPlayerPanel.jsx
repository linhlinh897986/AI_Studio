import React, { useState, useEffect, useRef } from 'react';
import { Player } from '@remotion/player';
import { VideoComposition } from '../remotion/Video';
import { Edit3, Play, Pause, Download, Sliders, Check, Type, Wind, Music, Sparkles, RotateCcw, RotateCw, SkipBack, SkipForward } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Mini SVG thumbnails for subtitle style picker
// ─────────────────────────────────────────────────────────────────────────────
const SUBTITLE_STYLES = [
  {
    key: 'lotus-gold',
    label: 'Cánh Sen Hoàng Kim',
    icon: '🌸',
    badge: '⭐ Đề xuất',
    badgeColor: '#d97706',
    preview: (
      <svg viewBox="0 0 100 48" width="100%" height="48">
        <rect width="100" height="48" fill="#0a0714" rx="6"/>
        <line x1="10" y1="20" x2="36" y2="20" stroke="#d4a017" strokeWidth="0.8" strokeOpacity="0.7"/>
        <line x1="64" y1="20" x2="90" y2="20" stroke="#d4a017" strokeWidth="0.8" strokeOpacity="0.7"/>
        <circle cx="50" cy="20" r="2.5" fill="#f5c842"/>
        <text x="50" y="34" textAnchor="middle" fontFamily="serif" fontSize="10" fontWeight="600" fill="url(#lgG)" filter="url(#lgGl)">Phật pháp</text>
        <defs>
          <linearGradient id="lgG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#d97706"/></linearGradient>
          <filter id="lgGl"><feGaussianBlur stdDeviation="0.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
      </svg>
    ),
  },
  {
    key: 'zen-brush',
    label: 'Thiền Họa Mực Tàu',
    icon: '🖌️',
    badge: '🖌️ Nghệ thuật',
    badgeColor: '#78716c',
    preview: (
      <svg viewBox="0 0 100 48" width="100%" height="48">
        <rect width="100" height="48" fill="#1a1208" rx="6"/>
        <ellipse cx="50" cy="30" rx="42" ry="12" fill="rgba(0,0,0,0.65)" filter="url(#zbB)"/>
        <text x="50" y="32" textAnchor="middle" fontFamily="serif" fontSize="9" fontWeight="400" fill="#f5f0e8" letterSpacing="1.5">Tĩnh lặng tâm</text>
        <rect x="16" y="38" width="68" height="1" fill="rgba(245,240,232,0.4)" rx="1"/>
        <defs><filter id="zbB"><feGaussianBlur stdDeviation="1.5"/></filter></defs>
      </svg>
    ),
  },
  {
    key: 'dharma-gate',
    label: 'Pháp Môn Cổ Điển',
    icon: '🏮',
    badge: '🏮 Truyền thống',
    badgeColor: '#991b1b',
    preview: (
      <svg viewBox="0 0 100 48" width="100%" height="48">
        <rect width="100" height="48" fill="#0a0004" rx="6"/>
        <rect x="6" y="10" width="88" height="28" fill="rgba(80,5,5,0.95)" rx="3"/>
        <rect x="6" y="10" width="88" height="28" fill="none" stroke="rgba(212,160,23,0.6)" strokeWidth="1" rx="3"/>
        <rect x="8" y="16" width="84" height="0.7" fill="#d4a017" opacity="0.8"/>
        <rect x="8" y="31" width="84" height="0.7" fill="#d4a017" opacity="0.8"/>
        <text x="50" y="27" textAnchor="middle" fontFamily="serif" fontSize="10" fontWeight="600" fill="#fff8e7">Phật pháp</text>
      </svg>
    ),
  },
  {
    key: 'sacred-glow',
    label: 'Linh Quang',
    icon: '✨',
    badge: '✨ Karaoke',
    badgeColor: '#854d0e',
    preview: (
      <svg viewBox="0 0 100 48" width="100%" height="48">
        <rect width="100" height="48" fill="#07030f" rx="6"/>
        <text x="12" y="30" fontFamily="serif" fontSize="10" fontWeight="600" fill="rgba(255,200,80,0.5)">Phật</text>
        <text x="36" y="31" fontFamily="serif" fontSize="12" fontWeight="700" fill="#fff8e7" filter="url(#sgG)">pháp</text>
        <text x="70" y="30" fontFamily="serif" fontSize="10" fontWeight="600" fill="rgba(255,255,255,0.4)">vô biên</text>
        <defs><filter id="sgG"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      </svg>
    ),
  },
  {
    key: 'mountain-mist',
    label: 'Sương Núi',
    icon: '🌿',
    badge: '🌿 Tối giản',
    badgeColor: '#166534',
    preview: (
      <svg viewBox="0 0 100 48" width="100%" height="48">
        <rect width="100" height="48" fill="#030d0a" rx="6"/>
        <text x="50" y="30" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fontWeight="300" fill="rgba(255,248,230,0.9)" letterSpacing="2">PHẬT PHÁP VÔ BIÊN</text>
      </svg>
    ),
  },
  {
    key: 'sutra-scroll',
    label: 'Cuộn Kinh Cổ',
    icon: '📜',
    badge: '📜 Cổ thư',
    badgeColor: '#78350f',
    preview: (
      <svg viewBox="0 0 100 48" width="100%" height="48">
        <rect width="100" height="48" fill="#0c0804" rx="6"/>
        <rect x="5" y="3" width="90" height="4" fill="url(#sR)" rx="2"/>
        <rect x="5" y="41" width="90" height="4" fill="url(#sR)" rx="2"/>
        <rect x="6" y="7" width="88" height="34" fill="url(#sB)" rx="2"/>
        <text x="50" y="28" textAnchor="middle" fontFamily="serif" fontSize="10" fontWeight="600" fill="#2d1a06">Phật pháp vô biên</text>
        <defs>
          <linearGradient id="sR" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#5c3d11"/><stop offset="50%" stopColor="#8b6335"/><stop offset="100%" stopColor="#5c3d11"/></linearGradient>
          <linearGradient id="sB" x1="0" y1="0" x2="0" y2="34" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#d4b896"/><stop offset="100%" stopColor="#b8956a"/></linearGradient>
        </defs>
      </svg>
    ),
  },
];

const PARTICLE_OPTIONS = [
  { key: 'dust',  label: 'Bụi Vàng Thiền Định', icon: '✨', desc: 'Hạt bụi vàng lấp lánh lơ lửng', color: '#d4a017' },
  { key: 'lotus', label: 'Cánh Hoa Sen Rơi',   icon: '🌸', desc: 'Cánh hoa sen hồng rơi nhẹ nhàng', color: '#ec4899' },
  { key: 'rays',  label: 'Tia Nắng Linh Quang',icon: '☀️', desc: 'Hào quang mặt trời lung linh',   color: '#f97316' },
  { key: 'none',  label: 'Tắt Hiệu Ứng Hạt',  icon: '○',  desc: 'Không hiển thị hạt bay',        color: '#6b7280' },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT — 2 Column Layout (Large Preview Left, Studio Controls Right)
// ─────────────────────────────────────────────────────────────────────────────
export default function VideoPlayerPanel({
  isOpen = false,
  onClose = () => {},
  slides = [],
  subtitles = [],
  audioUrl = '',
  bgMusicUrl = '',
  type = 'shopee',
  shopeeProps = {},
  onSubtitleUpdate = () => {},
  onExport = () => {},
  isExporting = false,
  exportProgress = null,

  voice = '',
  onVoiceChange = () => {},
  bgMusic = '',
  onBgMusicChange = () => {},

  // Buddhist-specific live-edit props
  aspectRatio = '9:16',
  onAspectRatioChange = () => {},
  particleType = 'dust',
  onParticleTypeChange = () => {},
  subtitleStyle = 'lotus-gold',
  onSubtitleStyleChange = () => {},
  subtitleY = 220,
  onSubtitleYChange = () => {},
  localMusicFiles = [],
  onOpenMusicFolder = () => {},
}) {
  const playerRef = useRef(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [editingSegIdx, setEditingSegIdx] = useState(null);
  const [editSegValue, setEditSegValue] = useState('');

  // Local live-edit state
  const [liveAspectRatio, setLiveAspectRatio] = useState(aspectRatio || '9:16');
  const [liveSubtitleStyle, setLiveSubtitleStyle] = useState(subtitleStyle);
  const [liveSubtitleY, setLiveSubtitleY] = useState(subtitleY);
  const [liveParticle, setLiveParticle] = useState(particleType);
  const [liveBgMusic, setLiveBgMusic] = useState(bgMusic);
  const [voiceVolume, setVoiceVolume] = useState(1.0);
  const [bgMusicVolume, setBgMusicVolume] = useState(0.15);

  // Unified Settings Tab: 'editor' | 'subtitle' | 'position' | 'particles' | 'music'
  const [activeTab, setActiveTab] = useState('editor');

  // Sync local state when props change
  useEffect(() => { setLiveAspectRatio(aspectRatio || '9:16'); }, [aspectRatio]);
  useEffect(() => { setLiveSubtitleStyle(subtitleStyle); }, [subtitleStyle]);
  useEffect(() => { setLiveSubtitleY(subtitleY); }, [subtitleY]);
  useEffect(() => { setLiveParticle(particleType); }, [particleType]);
  useEffect(() => { setLiveBgMusic(bgMusic); }, [bgMusic]);

  const handleAspectRatioChange = (val) => {
    setLiveAspectRatio(val);
    onAspectRatioChange(val);
  };
  const handleSubtitleStyleChange = (key) => {
    setLiveSubtitleStyle(key);
    onSubtitleStyleChange(key);
  };
  const handleYChange = (val) => {
    setLiveSubtitleY(val);
    onSubtitleYChange(val);
  };
  const handleParticleChange = (key) => {
    setLiveParticle(key);
    onParticleTypeChange(key);
  };
  const handleMusicChange = (val) => {
    setLiveBgMusic(val);
    onBgMusicChange(val);
  };

  const isLandscape = liveAspectRatio === '16:9';
  const compWidth = isLandscape ? 1920 : 1080;
  const compHeight = isLandscape ? 1080 : 1920;

  const liveShopeeProps = {
    ...shopeeProps,
    subtitleStyle: liveSubtitleStyle,
    subtitleY: liveSubtitleY,
    particleType: liveParticle,
    aspectRatio: liveAspectRatio,
    voiceVolume,
    bgMusicVolume,
  };


  // Monitor playback
  useEffect(() => {
    if (!isOpen) return;
    const player = playerRef.current;
    if (!player) return;
    const onTimeUpdate = (e) => setCurrentTimeMs(e.detail.timeInMilliseconds);
    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    player.addEventListener('timeupdate', onTimeUpdate);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    return () => {
      player.removeEventListener('timeupdate', onTimeUpdate);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
    };
  }, [playerRef.current, isOpen]);

  const handleSegmentClick = (seg) => {
    playerRef.current?.seekToTime(seg.start_time);
  };
  const saveSegmentEdit = (idx) => {
    onSubtitleUpdate(idx, editSegValue);
    setEditingSegIdx(null);
  };

  const totalDurationFrames = slides.length > 0
    ? slides[slides.length - 1].startFrame + slides[slides.length - 1].durationFrames
    : 300;

  if (!isOpen) return null;

  const ALL_TABS = [
    { id: 'editor',    icon: <Edit3 size={14}/>,  label: 'Sửa Câu' },
    { id: 'subtitle',  icon: <Type size={14}/>,   label: 'Kiểu Chữ' },
    { id: 'position',  icon: '↕',                  label: 'Vị Trí Chữ' },
    { id: 'particles', icon: <Wind size={14}/>,    label: 'Hạt Bay' },
    { id: 'music',     icon: <Music size={14}/>,   label: 'Nhạc Nền' },
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 99999,
      backdropFilter: 'blur(14px)',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div className="glass-panel active" style={{
        display: 'flex', flexDirection: 'column', gap: 0,
        width: '95%', maxWidth: 1280, height: '90vh',
        padding: 0, overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        borderRadius: 20,
        position: 'relative',
        background: '#12131c',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.02)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <h3 style={{
              fontSize: 14, margin: 0, display: 'flex', alignItems: 'center',
              gap: 10, color: 'var(--text-primary)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              <Sliders size={16} style={{ color: '#d4a017' }}/>
              Studio Thiết Kế &amp; Xem Trước Video
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '1px',
                color: '#f5c842', background: 'rgba(212,160,23,0.15)',
                border: '1px solid rgba(212,160,23,0.4)',
                borderRadius: 6, padding: '3px 10px',
              }}>LIVE EDIT</span>
            </h3>

            {/* Aspect Ratio Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(0,0,0,0.4)', padding: 3, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                onClick={() => handleAspectRatioChange('9:16')}
                style={{
                  padding: '5px 12px', borderRadius: 6, cursor: 'pointer', border: 'none',
                  background: !isLandscape ? '#d4a017' : 'transparent',
                  color: !isLandscape ? '#000' : 'var(--text-muted)',
                  fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'all 0.18s',
                }}
              >
                📱 9:16 (Dọc)
              </button>
              <button
                onClick={() => handleAspectRatioChange('16:9')}
                style={{
                  padding: '5px 12px', borderRadius: 6, cursor: 'pointer', border: 'none',
                  background: isLandscape ? '#d4a017' : 'transparent',
                  color: isLandscape ? '#000' : 'var(--text-muted)',
                  fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'all 0.18s',
                }}
              >
                🖥️ 16:9 (Ngang)
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16,
              width: 32, height: 32, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >✕</button>
        </div>

        {/* ── Body: Clean 2-Column Layout ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ══ COL 1: LARGE VIDEO PREVIEW & CONTROLS (Left Side) ══ */}
          <div style={{
            flex: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 28px',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(0,0,0,0.25)',
            overflow: 'hidden',
          }}>
            {/* Large Video Player Frame */}
            <div style={{
              flex: 1,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              maxHeight: 'calc(100% - 70px)',
            }}>
              <div style={{
                position: 'relative',
                height: '100%',
                maxHeight: isLandscape ? '420px' : '540px',
                aspectRatio: isLandscape ? '16/9' : '9/16',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {/* Outer Shell Border */}
                <div style={{
                  position: 'absolute', inset: -10,
                  border: '3px solid rgba(255,255,255,0.15)',
                  borderRadius: isLandscape ? 20 : 36,
                  background: 'rgba(0,0,0,0.5)',
                  pointerEvents: 'none',
                  zIndex: 2,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.8), inset 0 0 24px rgba(0,0,0,0.6)',
                }}>
                  {!isLandscape && (
                    <div style={{
                      position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
                      width: 60, height: 8, background: 'rgba(0,0,0,0.9)',
                      borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)',
                    }}/>
                  )}
                </div>




                {/* Remotion Player */}
                <div style={{
                  width: '100%', height: '100%',
                  borderRadius: isLandscape ? 14 : 28,
                  overflow: 'hidden',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                }}>
                  {slides.length > 0 ? (
                    <Player
                      ref={playerRef}
                      component={VideoComposition}
                      inputProps={{
                        slides, subtitles, audioUrl,
                        bgMusicUrl: liveBgMusic,
                        type,
                        shopeeProps: liveShopeeProps,
                      }}
                      durationInFrames={totalDurationFrames}
                      fps={30}
                      compositionWidth={compWidth}
                      compositionHeight={compHeight}
                      style={{ width: '100%', height: '100%' }}
                      controls={false}
                      loop
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      background: 'rgba(0,0,0,0.6)',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-muted)', fontSize: 13, gap: 12,
                    }}>
                      <div style={{ width: 40, height: 40, border: '2px dashed rgba(212,160,23,0.5)', borderRadius: '50%' }}/>
                      Chưa tạo video
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Interactive Timeline Scrubber & Controls Panel */}
            {(() => {
              const totalDurationMs = Math.round((totalDurationFrames / 30) * 1000);
              const currentFrame = Math.floor((currentTimeMs / 1000) * 30);
              const activeSceneIdx = slides.findIndex(s => currentFrame >= s.startFrame && currentFrame < (s.startFrame + s.durationFrames));
              const formatTime = (ms) => {
                if (!ms || isNaN(ms)) return '00:00';
                const totalSec = Math.floor(ms / 1000);
                const m = Math.floor(totalSec / 60);
                const s = totalSec % 60;
                return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
              };

              return (
                <div style={{
                  width: '100%',
                  maxWidth: isLandscape ? 680 : 540,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  marginTop: 14,
                  padding: '14px 18px',
                  background: 'rgba(15, 20, 32, 0.65)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: 16,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  flexShrink: 0,
                }}>
                  {/* Top Status Row: Time Indicator & Current Scene Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f5c842' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, background: 'rgba(212,160,23,0.18)', color: '#fbbf24', padding: '3px 9px', borderRadius: 6, border: '1px solid rgba(212,160,23,0.35)' }}>
                        {formatTime(currentTimeMs)}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
                      <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>
                        {formatTime(totalDurationMs)}
                      </span>
                    </div>

                    {activeSceneIdx >= 0 && (
                      <div style={{
                        fontSize: 11, color: '#e0e7ff', background: 'rgba(99, 102, 241, 0.2)',
                        padding: '3px 12px', borderRadius: 12, border: '1px solid rgba(99, 102, 241, 0.35)',
                        maxWidth: 240, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'
                      }}>
                        📍 Cảnh {activeSceneIdx + 1}/{slides.length}: {slides[activeSceneIdx]?.text || ''}
                      </div>
                    )}
                  </div>

                  {/* Scrubber Timeline Bar */}
                  <div style={{ position: 'relative', width: '100%', height: 26, display: 'flex', alignItems: 'center' }}>
                    {/* Scene Marker Lines on Timeline */}
                    <div style={{ position: 'absolute', inset: '9px 0', pointerEvents: 'none', zIndex: 1 }}>
                      {slides.map((s, idx) => {
                        if (idx === 0) return null;
                        const leftPct = (s.startFrame / totalDurationFrames) * 100;
                        return (
                          <div
                            key={idx}
                            style={{
                              position: 'absolute',
                              left: `${leftPct}%`,
                              top: -2,
                              bottom: -2,
                              width: 2,
                              background: 'rgba(255, 255, 255, 0.45)',
                              borderRadius: 1,
                              boxShadow: '0 0 4px rgba(0,0,0,0.8)',
                            }}
                            title={`Mốc Cảnh ${idx + 1}`}
                          />
                        );
                      })}
                    </div>

                    {/* Interactive Range Input Scrubber */}
                    <input
                      type="range"
                      min={0}
                      max={totalDurationMs || 1}
                      value={currentTimeMs}
                      disabled={slides.length === 0}
                      onChange={(e) => {
                        const seekMs = Number(e.target.value);
                        setCurrentTimeMs(seekMs);
                        playerRef.current?.seekToTime(seekMs);
                      }}
                      style={{
                        width: '100%',
                        height: 8,
                        borderRadius: 4,
                        outline: 'none',
                        cursor: 'pointer',
                        zIndex: 2,
                        accentColor: '#f5c842',
                        background: `linear-gradient(to right, #d97706 0%, #f5c842 ${(currentTimeMs / (totalDurationMs || 1)) * 100}%, rgba(255,255,255,0.12) ${(currentTimeMs / (totalDurationMs || 1)) * 100}%, rgba(255,255,255,0.12) 100%)`,
                      }}
                    />
                  </div>

                  {/* Bottom Action Controls */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          const newTime = Math.max(0, currentTimeMs - 5000);
                          setCurrentTimeMs(newTime);
                          playerRef.current?.seekToTime(newTime);
                        }}
                        disabled={slides.length === 0}
                        style={{ padding: '6px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8 }}
                        title="Lùi 5 giây"
                      >
                        <RotateCcw size={12}/> -5s
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          if (isPlaying) playerRef.current?.pause();
                          else playerRef.current?.play();
                        }}
                        disabled={slides.length === 0}
                        style={{
                          padding: '6px 16px', fontSize: 12, fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8,
                          background: isPlaying ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 200, 66, 0.2)',
                          color: isPlaying ? '#f87171' : '#f5c842',
                          border: `1px solid ${isPlaying ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 200, 66, 0.4)'}`
                        }}
                      >
                        {isPlaying ? <Pause size={14}/> : <Play size={14}/>}
                        {isPlaying ? 'Dừng' : 'Phát'}
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          const newTime = Math.min(totalDurationMs, currentTimeMs + 5000);
                          setCurrentTimeMs(newTime);
                          playerRef.current?.seekToTime(newTime);
                        }}
                        disabled={slides.length === 0}
                        style={{ padding: '6px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8 }}
                        title="Tiến 5 giây"
                      >
                        +5s <RotateCw size={12}/>
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => { playerRef.current?.pause(); playerRef.current?.seekToTime(0); setCurrentTimeMs(0); }}
                        disabled={slides.length === 0}
                        style={{ padding: '6px 10px', fontSize: 11, borderRadius: 8 }}
                        title="Về đầu 0s"
                      >
                        0s
                      </button>
                    </div>

                    <button
                      className="btn btn-primary"
                      onClick={onExport}
                      disabled={slides.length === 0 || isExporting}
                      style={{
                        padding: '8px 20px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        background: 'linear-gradient(135deg, #d97706, #b45309)',
                        border: 'none', fontSize: 12, fontWeight: 700, borderRadius: 8,
                        boxShadow: '0 4px 14px rgba(212,160,23,0.35)',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      <Download size={14}/> {isExporting ? 'Đang xuất...' : 'Xuất MP4'}
                    </button>
                  </div>
                </div>
              );
            })()}

            {isExporting && exportProgress && (
              <div style={{ width: '100%', maxWidth: 540, marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>{exportProgress.message}</span>
                  <span style={{ color: '#f5c842', fontWeight: 700 }}>{exportProgress.percent}%</span>
                </div>
                <div style={{ width: '100%', height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${exportProgress.percent}%`, height: '100%',
                    background: 'linear-gradient(90deg, #d97706, #f5c842)',
                    transition: 'width 0.3s ease',
                  }}/>
                </div>
              </div>
            )}
          </div>

          {/* ══ COL 2: UNIFIED STUDIO & EDITOR PANEL (Right Side 520px) ══ */}
          <div style={{
            width: 520, flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            background: '#161824',
          }}>
            {/* 5-Tab Bar */}
            <div style={{
              display: 'flex',
              background: 'rgba(0,0,0,0.4)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}>
              {ALL_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: '14px 4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: activeTab === tab.id
                      ? 'rgba(212,160,23,0.14)'
                      : 'transparent',
                    border: 'none',
                    borderBottom: activeTab === tab.id ? '2.5px solid #f5c842' : '2.5px solid transparent',
                    color: activeTab === tab.id ? '#f5c842' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.2px',
                    transition: 'all 0.18s',
                  }}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>

              {/* ── TAB 1: SUBTITLE EDITOR ── */}
              {activeTab === 'editor' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                    letterSpacing: '1px', textTransform: 'uppercase',
                    marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Edit3 size={13} style={{ color: '#d4a017' }}/>
                    Danh Sách Câu Phụ Đề ({subtitles.length})
                    <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.6, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>Double click để sửa</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {subtitles.length > 0 ? (
                      subtitles.map((seg, segIdx) => {
                        const isActive = currentTimeMs >= seg.start_time && currentTimeMs <= seg.end_time;
                        const isEditing = editingSegIdx === segIdx;
                        return (
                          <div
                            key={segIdx}
                            onClick={() => handleSegmentClick(seg)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '10px 14px',
                              background: isActive ? 'rgba(212,160,23,0.12)' : 'rgba(255,255,255,0.025)',
                              border: isActive ? '1px solid rgba(212,160,23,0.6)' : '1px solid rgba(255,255,255,0.06)',
                              borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
                              position: 'relative',
                            }}
                          >
                            {isActive && (
                              <div style={{
                                position: 'absolute', left: 0, top: 6, bottom: 6,
                                width: 3.5, background: '#f5c842', borderRadius: '0 3px 3px 0',
                                boxShadow: '0 0 8px rgba(245,200,66,0.8)',
                              }}/>
                            )}

                            <div style={{
                              fontSize: 10, color: isActive ? '#f5c842' : 'var(--text-muted)',
                              background: isActive ? 'rgba(212,160,23,0.18)' : 'rgba(0,0,0,0.3)',
                              padding: '3px 7px', borderRadius: 6, whiteSpace: 'nowrap',
                              fontFamily: 'var(--font-mono)', fontWeight: 700,
                              border: isActive ? '1px solid rgba(212,160,23,0.4)' : '1px solid transparent',
                            }}>
                              {(seg.start_time / 1000).toFixed(1)}s
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              {isEditing ? (
                                <input
                                  type="text" className="form-input"
                                  value={editSegValue}
                                  onChange={e => setEditSegValue(e.target.value)}
                                  onBlur={() => saveSegmentEdit(segIdx)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveSegmentEdit(segIdx);
                                    if (e.key === 'Escape') setEditingSegIdx(null);
                                  }}
                                  autoFocus
                                  style={{ width: '100%', height: 28, fontSize: 13, padding: '4px 10px' }}
                                />
                              ) : (
                                <div
                                  onDoubleClick={() => { setEditingSegIdx(segIdx); setEditSegValue(seg.text); }}
                                  style={{
                                    fontSize: 13, lineHeight: 1.5,
                                    color: isActive ? '#fff8e7' : 'var(--text-secondary)',
                                    fontWeight: isActive ? 600 : 400,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  }}
                                  title="Double click để sửa"
                                >{seg.text}</div>
                              )}
                            </div>

                            {!isEditing && (
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); setEditingSegIdx(segIdx); setEditSegValue(seg.text); }}
                                style={{
                                  background: 'none', border: 'none',
                                  color: 'var(--text-muted)', cursor: 'pointer',
                                  padding: 4, display: 'flex', alignItems: 'center',
                                  opacity: 0.6, transition: 'opacity 0.15s',
                                }}
                                title="Sửa câu"
                              >
                                <Edit3 size={14}/>
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                        <div style={{ fontSize: 36, marginBottom: 10 }}>📝</div>
                        Chưa có phụ đề được tải.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── TAB 2: SUBTITLE STYLE ── */}
              {activeTab === 'subtitle' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Chọn Phong Cách Phụ Đề
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {SUBTITLE_STYLES.map(style => {
                      const isSel = liveSubtitleStyle === style.key;
                      return (
                        <button
                          key={style.key}
                          onClick={() => handleSubtitleStyleChange(style.key)}
                          style={{
                            background: isSel ? 'rgba(212,160,23,0.12)' : 'rgba(255,255,255,0.025)',
                            border: isSel ? '1.5px solid rgba(212,160,23,0.8)' : '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 12,
                            padding: '10px',
                            cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', gap: 8,
                            transition: 'all 0.18s ease',
                            boxShadow: isSel ? '0 0 16px rgba(212,160,23,0.2)' : 'none',
                            transform: isSel ? 'translateY(-1px)' : 'none',
                            position: 'relative',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{
                            borderRadius: 6, overflow: 'hidden',
                            border: isSel ? '1px solid rgba(212,160,23,0.5)' : '1px solid rgba(255,255,255,0.06)',
                            width: '100%',
                          }}>
                            {React.cloneElement(style.preview, { style: { width: '100%', height: 'auto', display: 'block' } })}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700,
                              color: isSel ? '#f5c842' : 'var(--text-primary)',
                            }}>{style.label}</span>
                            <span style={{
                              fontSize: 9, fontWeight: 700,
                              color: style.badgeColor, background: `${style.badgeColor}22`,
                              border: `1px solid ${style.badgeColor}44`,
                              borderRadius: 4, padding: '1px 5px',
                            }}>{style.badge}</span>
                          </div>

                          {isSel && (
                            <div style={{
                              position: 'absolute', top: 6, right: 6,
                              width: 16, height: 16, borderRadius: '50%',
                              background: '#d4a017',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 9, color: '#000', fontWeight: 900,
                              boxShadow: '0 0 6px rgba(212,160,23,0.6)',
                            }}>✓</div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{
                    padding: '12px 14px',
                    background: 'rgba(212,160,23,0.08)',
                    border: '1px solid rgba(212,160,23,0.2)',
                    borderRadius: 10,
                    fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5,
                  }}>
                    {liveSubtitleStyle === 'lotus-gold'    && '🌸 Chữ gradient vàng nhũ + hoa sen trang trí. Phong cách sang trọng và linh thiêng nhất — khuyên dùng.'}
                    {liveSubtitleStyle === 'zen-brush'     && '🖌️ Nền mực tàu loang dần, chữ xuất hiện như nét bút họa. Phù hợp thiền định.'}
                    {liveSubtitleStyle === 'dharma-gate'   && '🏮 Hộp son đỏ viền vàng góc trang trí. Cổ kính và uy nghiêm như Chánh Điện.'}
                    {liveSubtitleStyle === 'sacred-glow'   && '✨ Từng chữ phát hào quang khi được đọc tới. Karaoke thiêng liêng.'}
                    {liveSubtitleStyle === 'mountain-mist' && '🌿 Chữ in hoa mỏng nhẹ xuất hiện như sương khói. Tối giản, nội dung là trung tâm.'}
                    {liveSubtitleStyle === 'sutra-scroll'  && '📜 Cuộn kinh cổ da thuộc nâu mở ra với thanh gỗ trang trí. Chữ đen như cổ thư.'}
                  </div>
                </div>
              )}

              {/* ── TAB 3: Y-POSITION ── */}
              {activeTab === 'position' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Vị Trí Dòng Chữ Trên Khung Hình
                  </div>

                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{
                      width: 80, aspectRatio: '9/16', flexShrink: 0,
                      border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 12,
                      background: 'rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden',
                    }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #1a0a2e 0%, #0a0714 100%)' }}/>
                      <div style={{ position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)', width: 22, height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }}/>
                      <div style={{
                        position: 'absolute',
                        bottom: `${(liveSubtitleY / 900) * 100}%`,
                        left: 0, right: 0, height: 2,
                        background: '#f5c842', boxShadow: '0 0 6px #f5c842',
                      }}/>
                      <div style={{
                        position: 'absolute',
                        bottom: `${(liveSubtitleY / 900) * 100}%`,
                        left: 4, right: 4, transform: 'translateY(-50%)',
                        textAlign: 'center', fontSize: 5.5, fontWeight: 700, color: '#f5c842',
                        pointerEvents: 'none',
                      }}>Phật Pháp Vô Biên</div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(212,160,23,0.1)', border: '1px solid rgba(212,160,23,0.3)',
                        borderRadius: 10, padding: '10px 14px',
                      }}>
                        <span style={{ fontSize: 26, fontWeight: 800, color: '#f5c842' }}>{liveSubtitleY}</span>
                        <span style={{ fontSize: 11, color: 'rgba(245,200,66,0.7)', marginLeft: 6, marginTop: 8 }}>px từ đáy</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {[
                          { label: 'Sát đáy (80px)',  value: 80 },
                          { label: 'Chuẩn 1/4 (220px)', value: 220 },
                          { label: 'Giữa hình (430px)', value: 430 },
                          { label: 'Phía trên (640px)', value: 640 },
                        ].map(p => (
                          <button
                            key={p.value}
                            onClick={() => handleYChange(p.value)}
                            style={{
                              padding: '8px 10px',
                              background: Math.abs(liveSubtitleY - p.value) < 40 ? 'rgba(212,160,23,0.18)' : 'rgba(255,255,255,0.03)',
                              border: Math.abs(liveSubtitleY - p.value) < 40 ? '1px solid rgba(212,160,23,0.6)' : '1px solid rgba(255,255,255,0.08)',
                              borderRadius: 8, cursor: 'pointer',
                              fontSize: 11, color: Math.abs(liveSubtitleY - p.value) < 40 ? '#f5c842' : 'var(--text-secondary)',
                              fontWeight: 600, transition: 'all 0.15s',
                            }}
                          >{p.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    <input
                      type="range" min="50" max="800"
                      value={liveSubtitleY}
                      onChange={e => handleYChange(Number(e.target.value))}
                      style={{ width: '100%', cursor: 'pointer', accentColor: '#d4a017', height: 6 }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                      <span>▲ Gần đáy (50px)</span>
                      <span>Giữa khung ▲</span>
                      <span>Đỉnh khung (800px) ▲</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 4: PARTICLES ── */}
              {activeTab === 'particles' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Hiệu Ứng Hạt Bay Thiền Định
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {PARTICLE_OPTIONS.map(opt => {
                      const isSel = liveParticle === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => handleParticleChange(opt.key)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            padding: '14px 16px',
                            background: isSel ? `${opt.color}18` : 'rgba(255,255,255,0.03)',
                            border: isSel ? `1.5px solid ${opt.color}80` : '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 12, cursor: 'pointer',
                            transition: 'all 0.18s ease',
                            boxShadow: isSel ? `0 0 18px ${opt.color}25` : 'none',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: isSel ? `${opt.color}25` : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${isSel ? opt.color + '60' : 'rgba(255,255,255,0.08)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 20, flexShrink: 0,
                          }}>{opt.icon}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: isSel ? opt.color : 'var(--text-primary)' }}>{opt.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
                          </div>
                          {isSel && (
                            <div style={{
                              width: 22, height: 22, borderRadius: '50%',
                              background: opt.color,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, color: '#000', fontWeight: 900, flexShrink: 0,
                            }}>✓</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── TAB 5: ZEN MUSIC & AUDIO VOLUMES ── */}
              {activeTab === 'music' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  
                  {/* 🔊 Volume Controls Section */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    🔊 Tùy Chỉnh Âm Lượng Video
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Voiceover Volume */}
                    <div style={{
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          🎙️ Âm lượng Giọng Đọc (Thiền Sư)
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#f5c842' }}>{Math.round(voiceVolume * 100)}%</span>
                      </div>
                      <input
                        type="range" min="0" max="1.5" step="0.05"
                        value={voiceVolume}
                        onChange={e => setVoiceVolume(parseFloat(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer', accentColor: '#f5c842' }}
                      />
                    </div>

                    {/* Background Music Volume */}
                    <div style={{
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          🎵 Âm lượng Nhạc Nền (Zen Music)
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#d4a017' }}>{Math.round(bgMusicVolume * 100)}%</span>
                      </div>
                      <input
                        type="range" min="0" max="1.0" step="0.02"
                        value={bgMusicVolume}
                        onChange={e => setBgMusicVolume(parseFloat(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer', accentColor: '#d4a017' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      Danh Sách Nhạc Nền
                    </div>

                    <button
                      onClick={onOpenMusicFolder}
                      style={{
                        background: 'rgba(212,160,23,0.12)', border: '1px solid rgba(212,160,23,0.3)',
                        color: '#f5c842', fontSize: 11, cursor: 'pointer',
                        padding: '4px 10px', borderRadius: 6, fontWeight: 700,
                      }}
                    >📂 Thêm nhạc MP3</button>
                  </div>

                  <button
                    onClick={() => handleMusicChange('')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px',
                      background: liveBgMusic === '' ? 'rgba(107,114,128,0.18)' : 'rgba(255,255,255,0.03)',
                      border: liveBgMusic === '' ? '1.5px solid rgba(107,114,128,0.6)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12, cursor: 'pointer', transition: 'all 0.18s ease',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontSize: 22, width: 38, textAlign: 'center' }}>🔇</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: liveBgMusic === '' ? '#9ca3af' : 'var(--text-primary)' }}>Tắt nhạc nền</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chỉ phát giọng thiền sư đọc</div>
                    </div>
                    {liveBgMusic === '' && (
                      <div style={{ marginLeft: 'auto', width: 20, height: 20, borderRadius: '50%', background: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 900 }}>✓</div>
                    )}
                  </button>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 310, overflowY: 'auto' }}>
                    {localMusicFiles.length > 0 ? (
                      localMusicFiles.map((file, idx) => {
                        const isSelMusic = liveBgMusic === file.fileUrl;
                        const trackName = file.name.replace(/\.[^/.]+$/, '');
                        const colors = ['#d4a017', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];
                        const color  = colors[idx % colors.length];
                        return (
                          <button
                            key={idx}
                            onClick={() => handleMusicChange(file.fileUrl)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '12px 16px',
                              background: isSelMusic ? `${color}18` : 'rgba(255,255,255,0.03)',
                              border: isSelMusic ? `1.5px solid ${color}80` : '1px solid rgba(255,255,255,0.08)',
                              borderRadius: 12, cursor: 'pointer', transition: 'all 0.18s ease',
                              textAlign: 'left',
                            }}
                          >
                            <div style={{
                              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                              background: isSelMusic ? `${color}30` : 'rgba(255,255,255,0.05)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              gap: 2,
                            }}>
                              {isSelMusic ? (
                                [4,7,5,8,4].map((h, i) => (
                                  <div key={i} style={{
                                    width: 3, height: h * 2, background: color, borderRadius: 2,
                                    animation: `mP${i} 0.7s ease-in-out infinite alternate`,
                                  }}/>
                                ))
                              ) : (
                                <span style={{ fontSize: 16 }}>🎵</span>
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: 12, fontWeight: 700,
                                color: isSelMusic ? color : 'var(--text-primary)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>{trackName}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Nhạc Thiền • MP3</div>
                            </div>
                            {isSelMusic && (
                              <div style={{ width: 20, height: 20, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#000', fontWeight: 900, flexShrink: 0 }}>✓</div>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                        Chưa có file nhạc.<br/>Bấm "Thêm nhạc MP3" để nạp nhạc của riêng bạn.
                      </div>
                    )}
                  </div>
                  <style>{`
                    @keyframes mP0 { from{height:6px} to{height:14px} }
                    @keyframes mP1 { from{height:12px} to{height:20px} }
                    @keyframes mP2 { from{height:8px} to{height:16px} }
                    @keyframes mP3 { from{height:14px} to{height:22px} }
                    @keyframes mP4 { from{height:6px} to{height:12px} }
                  `}</style>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
