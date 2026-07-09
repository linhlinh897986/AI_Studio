import React, { useState, useEffect, useRef } from 'react';
import { Player } from '@remotion/player';
import { VideoComposition } from '../remotion/Video';
import { Edit3, Play, Pause, Download, Sliders, Check } from 'lucide-react';

export default function VideoPlayerPanel({ 
  slides = [], 
  subtitles = [], 
  audioUrl = '', 
  bgMusicUrl = '', 
  type = 'shopee',
  shopeeProps = {},
  onSubtitleUpdate = () => {},
  onExport = () => {},
  isExporting = false,
  exportProgress = null
}) {
  const playerRef = useRef(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [editingWord, setEditingWord] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  // Monitor playback time to highlight active spoken word chips
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onTimeUpdate = (e) => {
      setCurrentTimeMs(e.detail.timeInMilliseconds);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    player.addEventListener('timeupdate', onTimeUpdate);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);

    return () => {
      player.removeEventListener('timeupdate', onTimeUpdate);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
    };
  }, [playerRef.current]);

  const handleWordClick = (word, e) => {
    const player = playerRef.current;
    if (player) {
      player.seekToTime(word.start_time);
    }
  };

  const handleWordDoubleClick = (segmentIdx, wordIdx, word, e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPopoverPos({
      top: rect.bottom + window.scrollY + 8,
      left: rect.left + window.scrollX
    });
    setEditingWord({ segmentIdx, wordIdx, word });
    setEditValue(word.text);
  };

  const saveWordEdit = () => {
    if (!editingWord) return;
    const { segmentIdx, wordIdx } = editingWord;
    onSubtitleUpdate(segmentIdx, wordIdx, editValue);
    setEditingWord(null);
  };

  // Determine total duration based on slides
  const totalDurationFrames = slides.length > 0 
    ? slides[slides.length - 1].startFrame + slides[slides.length - 1].durationFrames 
    : 300;

  return (
    <div className="glass-panel active" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h3 style={{ fontSize: 16, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Sliders size={16} /> Preview & Subtitle Engine
      </h3>

      {/* Remotion Player Container */}
      <div className="player-container">
        {slides.length > 0 ? (
          <Player
            ref={playerRef}
            component={VideoComposition}
            inputProps={{
              slides,
              subtitles,
              audioUrl,
              bgMusicUrl,
              type,
              shopeeProps
            }}
            durationInFrames={totalDurationFrames}
            fps={30}
            compositionWidth={1080}
            compositionHeight={1920}
            style={{
              width: '100%',
              height: '100%'
            }}
            controls={false} // Custom buttons below
            loop
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14, flexDirection: 'column', gap: 12, background: 'rgba(0,0,0,0.5)' }}>
            <div style={{ width: 40, height: 40, border: '2px dashed var(--primary)', borderRadius: '50%' }} />
            Chưa có video. Nhập link/prompt và bấm Tạo Video.
          </div>
        )}
      </div>

      {/* Custom Player Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <button 
          className="btn btn-secondary" 
          onClick={() => {
            const player = playerRef.current;
            if (player) {
              if (isPlaying) player.pause();
              else player.play();
            }
          }}
          disabled={slides.length === 0}
          style={{ padding: '10px 20px', flexGrow: 1 }}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />} {isPlaying ? 'Tạm Dừng' : 'Xem Trước'}
        </button>

        <button 
          className="btn btn-primary"
          onClick={onExport}
          disabled={slides.length === 0 || isExporting}
          style={{ padding: '10px 24px' }}
        >
          <Download size={16} /> {isExporting ? 'Đang Xuất...' : 'Xuất MP4'}
        </button>
      </div>

      {/* Render Export Progress */}
      {isExporting && exportProgress && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            <span>{exportProgress.message}</span>
            <span>{exportProgress.percent}%</span>
          </div>
          <div className="progress-bar-glow">
            <div className="progress-bar-laser" style={{ width: `${exportProgress.percent}%` }} />
          </div>
        </div>
      )}

      {/* Signature Element: Interactive Subtitle Word Chips */}
      <div className="subtitles-editor" style={{ marginTop: 12 }}>
        <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          Gõ đúp vào từ để sửa phụ đề
        </h4>
        <div className="word-chips-container">
          {subtitles.length > 0 ? (
            subtitles.map((seg, segIdx) => (
              <div key={segIdx} style={{ display: 'contents' }}>
                {seg.words && seg.words.length > 0 ? (
                  seg.words.map((word, wordIdx) => {
                    const isActive = currentTimeMs >= word.start_time && currentTimeMs <= word.end_time;
                    return (
                      <div
                        key={`${segIdx}-${wordIdx}`}
                        className={`word-chip ${isActive ? 'active-spoken' : ''}`}
                        onClick={(e) => handleWordClick(word, e)}
                        onDoubleClick={(e) => handleWordDoubleClick(segIdx, wordIdx, word, e)}
                        title="Click để nhảy tới - Double click để sửa"
                      >
                        {word.text}
                      </div>
                    );
                  })
                ) : (
                  // Fallback if no words array
                  <div
                    className="word-chip"
                    style={{ flexGrow: 1, textAlign: 'center', padding: '10px' }}
                  >
                    {seg.text}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '20px 0', textAlign: 'center', width: '100%' }}>
              Chưa có phụ đề được tải.
            </div>
          )}
        </div>
      </div>

      {/* Floating Popover to edit a single word */}
      {editingWord && (
        <div 
          className="popover-edit" 
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          <input
            type="text"
            className="form-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveWordEdit()}
            autoFocus
            style={{ width: 140, padding: '6px 10px', fontSize: 13 }}
          />
          <button 
            className="btn btn-primary" 
            onClick={saveWordEdit}
            style={{ padding: '6px 10px' }}
          >
            <Check size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
