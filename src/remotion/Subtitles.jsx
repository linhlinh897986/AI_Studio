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

  // Render horizontal layouts dynamically with different styles
  return (
    <div className={`subtitles-overlay-container style-${styleType}`}>
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

        /* ── Common Wrapper Configurations ── */
        .subtitles-words-wrapper {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          text-align: center;
          border-radius: 12px;
          transition: all 0.2s;
        }

        /* ── 1. STYLE: MODERN (TikTok Karaoke) ── */
        .style-modern .subtitles-words-wrapper {
          background: rgba(0, 0, 0, 0.4);
          padding: 12px 24px;
          backdrop-filter: blur(4px);
          border: 1px solid rgba(255,255,255,0.05);
          gap: 10px 14px;
        }
        .style-modern .subtitle-word {
          font-family: 'Outfit', sans-serif;
          font-size: 40px;
          font-weight: 800;
          color: #ffffff;
          text-transform: uppercase;
          text-shadow: 2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 0px 4px 10px rgba(0,0,0,0.5);
          transition: all 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          transform: scale(0.95);
          display: inline-block;
        }
        .style-modern .subtitle-word.active-highlight {
          color: #fbbf24; /* Neon Yellow */
          transform: scale(1.15) translateY(-2px);
          text-shadow: 2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 0 0 15px rgba(251, 191, 36, 0.6);
        }
        .style-modern .subtitles-text-fallback {
          font-family: 'Outfit', sans-serif;
          font-size: 38px;
          font-weight: 800;
          color: #ffffff;
          text-transform: uppercase;
          text-shadow: 2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000;
        }

        /* ── 2. STYLE: MINIMALIST (Aesthetic Zen) ── */
        .style-minimalist .subtitles-words-wrapper {
          background: transparent;
          padding: 8px 16px;
          gap: 8px 10px;
        }
        .style-minimalist .subtitle-word {
          font-family: 'Georgia', 'Times New Roman', serif;
          font-size: 32px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.85);
          text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
          transition: color 0.15s ease;
          display: inline-block;
        }
        .style-minimalist .subtitle-word.active-highlight {
          color: #f59e0b; /* Soft Gold */
          font-weight: 700;
          text-shadow: 0 0 8px rgba(245, 158, 11, 0.3), 1px 1px 3px rgba(0,0,0,0.9);
        }
        .style-minimalist .subtitles-text-fallback {
          font-family: 'Georgia', serif;
          font-size: 30px;
          color: #f59e0b;
          text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
        }

        /* ── 3. STYLE: CAPSULE (Modern Reel Capsule) ── */
        .style-capsule .subtitles-words-wrapper {
          background: rgba(0, 0, 0, 0.55);
          padding: 14px 28px;
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          gap: 12px 16px;
          align-items: center;
        }
        .style-capsule .subtitle-word {
          font-family: 'Outfit', sans-serif;
          font-size: 36px;
          font-weight: 700;
          color: #ffffff;
          padding: 6px 12px;
          border-radius: 9999px;
          transition: all 0.15s ease;
          display: inline-block;
        }
        .style-capsule .subtitle-word.active-highlight {
          background: #fbbf24; /* Solid Yellow capsule */
          color: #000000;
          font-weight: 800;
          box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
          transform: translateY(-2px);
        }
        .style-capsule .subtitles-text-fallback {
          font-family: 'Outfit', sans-serif;
          font-size: 34px;
          font-weight: 700;
          color: #fbbf24;
        }

        /* ── 4. STYLE: NEON (Glowing Cyan) ── */
        .style-neon .subtitles-words-wrapper {
          background: rgba(0, 0, 0, 0.3);
          padding: 12px 24px;
          gap: 10px 14px;
        }
        .style-neon .subtitle-word {
          font-family: 'Outfit', sans-serif;
          font-size: 38px;
          font-weight: 800;
          color: #ffffff;
          text-transform: uppercase;
          text-shadow: 1px 1px 2px #000;
          transition: all 0.12s ease;
          display: inline-block;
        }
        .style-neon .subtitle-word.active-highlight {
          color: #06b6d4; /* Vivid Cyan */
          transform: scale(1.1);
          text-shadow: 0 0 8px #06b6d4, 0 0 15px #06b6d4, 1px 1px 2px #000;
        }
        .style-neon .subtitles-text-fallback {
          font-family: 'Outfit', sans-serif;
          font-size: 36px;
          font-weight: 800;
          color: #06b6d4;
          text-shadow: 0 0 8px #06b6d4;
        }

        /* ── 5. STYLE: BANNER (Classic Movie Banner) ── */
        .style-banner {
          padding: 0 !important;
          left: 0;
          width: 100% !important;
        }
        .style-banner .subtitles-words-wrapper {
          background: rgba(0, 0, 0, 0.7);
          width: 100%;
          padding: 16px 20px;
          border-radius: 0;
          border-top: 1px solid rgba(255,255,255,0.08);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          gap: 10px 16px;
          backdrop-filter: blur(6px);
        }
        .style-banner .subtitle-word {
          font-family: 'Outfit', sans-serif;
          font-size: 36px;
          font-weight: 700;
          color: #ffffff;
          transition: color 0.1s ease;
          display: inline-block;
        }
        .style-banner .subtitle-word.active-highlight {
          color: #f59e0b; /* Bright Amber Gold */
          font-weight: 800;
        }
        .style-banner .subtitles-text-fallback {
          font-family: 'Outfit', sans-serif;
          font-size: 34px;
          font-weight: 700;
          color: #f59e0b;
        }
      `}</style>
    </div>
  );
};

