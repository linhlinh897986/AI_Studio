import { useCurrentFrame, useVideoConfig } from 'remotion';

export const Subtitles = ({ subtitles = [], styleType = 'modern', yPos = 220 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  // 1. Find active sentence/segment
  const activeSegment = subtitles.find(
    (seg) => currentTimeMs >= seg.start_time && currentTimeMs <= seg.end_time
  );

  if (!activeSegment) return null;

  // ── Render Style A: Cổ Kính Thư Pháp Dọc (Vertical Calligraphy) ──────────────
  if (styleType === 'calligraphy') {
    return (
      <div className="vertical-calligraphy-container">
        <div className="calligraphy-parchment">
          <div className="calligraphy-text-wrapper">
            {activeSegment.words && activeSegment.words.length > 0 ? (
              activeSegment.words.map((word, idx) => {
                const isActive = currentTimeMs >= word.start_time && currentTimeMs <= word.end_time;
                return (
                  <span 
                    key={idx} 
                    className={`calligraphy-word ${isActive ? 'active-calligraphy-highlight' : ''}`}
                  >
                    {word.text}
                  </span>
                );
              })
            ) : (
              <span className="calligraphy-text-fallback">
                {activeSegment.text}
              </span>
            )}
          </div>
        </div>
        <style>{`
          .vertical-calligraphy-container {
            position: absolute;
            right: 80px;
            bottom: ${yPos}px;
            display: flex;
            align-items: center;
            z-index: 20;
            pointer-events: none;
            animation: fade-slide-in 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .calligraphy-parchment {
            background: rgba(10, 8, 20, 0.85); /* dark scroll */
            backdrop-filter: blur(8px);
            border: 2px solid #d97706; /* Golden Amber border */
            border-radius: 16px;
            padding: 32px 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(217, 119, 6, 0.15);
            display: flex;
            justify-content: center;
          }
          .calligraphy-text-wrapper {
            writing-mode: vertical-rl; /* Crucial vertical text standard */
            text-orientation: upright; /* Keep characters standing straight */
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: center;
          }
          .calligraphy-word {
            font-family: 'Georgia', 'Times New Roman', serif;
            font-size: 34px;
            font-weight: 700;
            color: rgba(255, 255, 255, 0.85);
            letter-spacing: 0.05em;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
            transition: all 180ms ease;
            transform: scale(0.95);
            display: inline-block;
          }
          .calligraphy-word.active-calligraphy-highlight {
            color: #f59e0b; /* Golden Yellow */
            font-weight: 800;
            transform: scale(1.1) rotate(2deg);
            text-shadow: 0 0 12px rgba(245, 158, 11, 0.5), 2px 2px 2px rgba(0,0,0,0.9);
          }
          .calligraphy-text-fallback {
            font-family: 'Georgia', serif;
            font-size: 32px;
            font-weight: 700;
            color: #f59e0b;
            letter-spacing: 0.06em;
            text-shadow: 2px 2px 3px rgba(0,0,0,0.9);
            line-height: 1.6;
          }
          @keyframes fade-slide-in {
            0% { opacity: 0; transform: translateX(20px); }
            100% { opacity: 1; transform: translateX(0); }
          }
        `}</style>
      </div>
    );
  }

  // ── Render Style B: Hiện Đại TikTok Karaoke (Horizontal Style) ────────────────
  return (
    <div className="subtitles-overlay-container">
      <div className="subtitles-words-wrapper">
        {activeSegment.words && activeSegment.words.length > 0 ? (
          activeSegment.words.map((word, idx) => {
            const isActive = currentTimeMs >= word.start_time && currentTimeMs <= word.end_time;
            return (
              <span 
                key={idx} 
                className={`subtitle-word ${isActive ? 'active-highlight' : ''}`}
              >
                {word.text}
              </span>
            );
          })
        ) : (
          <div className="subtitles-text-fallback">
            {activeSegment.text}
          </div>
        )}
      </div>
      <style>{`
        .subtitles-overlay-container {
          position: absolute;
          bottom: ${yPos}px;
          width: 100%;
          display: flex;
          justify-content: center;
          padding: 0 48px;
          z-index: 20;
          pointer-events: none;
        }
        .subtitles-words-wrapper {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px 14px;
          text-align: center;
          background: rgba(0, 0, 0, 0.4);
          padding: 12px 24px;
          border-radius: 12px;
          backdrop-filter: blur(4px);
          border: 1px solid rgba(255,255,255,0.05);
        }
        .subtitle-word {
          font-family: 'Outfit', sans-serif;
          font-size: 40px;
          font-weight: 800;
          color: #ffffff;
          text-transform: uppercase;
          text-shadow: 2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 0px 4px 10px rgba(0,0,0,0.5);
          transition: all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          transform: scale(0.95);
          display: inline-block;
        }
        .subtitle-word.active-highlight {
          color: #fbbf24; /* Neon Yellow */
          transform: scale(1.15) translateY(-2px);
          text-shadow: 2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 0 0 15px rgba(251, 191, 36, 0.6);
        }
        .subtitles-text-fallback {
          font-family: 'Outfit', sans-serif;
          font-size: 38px;
          font-weight: 800;
          color: #ffffff;
          text-align: center;
          text-transform: uppercase;
          text-shadow: 2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 0px 4px 10px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  );
};
