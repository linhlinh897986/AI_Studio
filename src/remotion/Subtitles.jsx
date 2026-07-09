import { useCurrentFrame, useVideoConfig } from 'remotion';

export const Subtitles = ({ subtitles = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  // 1. Find active sentence/segment
  const activeSegment = subtitles.find(
    (seg) => currentTimeMs >= seg.start_time && currentTimeMs <= seg.end_time
  );

  if (!activeSegment) return null;

  // 2. Render karaoke style if word-level data exists
  if (activeSegment.words && activeSegment.words.length > 0) {
    return (
      <div className="subtitles-overlay-container">
        <div className="subtitles-words-wrapper">
          {activeSegment.words.map((word, idx) => {
            const isActive = currentTimeMs >= word.start_time && currentTimeMs <= word.end_time;
            return (
              <span 
                key={idx} 
                className={`subtitle-word ${isActive ? 'active-highlight' : ''}`}
              >
                {word.text}
              </span>
            );
          })}
        </div>
        <style>{`
          .subtitles-overlay-container {
            position: absolute;
            bottom: 220px;
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
        `}</style>
      </div>
    );
  }

  // 3. Fallback: simple text display if no word timings
  return (
    <div className="subtitles-overlay-container">
      <div className="subtitles-text-fallback">
        {activeSegment.text}
      </div>
      <style>{`
        .subtitles-overlay-container {
          position: absolute;
          bottom: 220px;
          width: 100%;
          display: flex;
          justify-content: center;
          padding: 0 48px;
          z-index: 20;
          pointer-events: none;
        }
        .subtitles-text-fallback {
          font-family: 'Outfit', sans-serif;
          font-size: 38px;
          font-weight: 800;
          color: #ffffff;
          text-align: center;
          text-transform: uppercase;
          text-shadow: 2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 0px 4px 10px rgba(0,0,0,0.5);
          background: rgba(0, 0, 0, 0.4);
          padding: 12px 24px;
          border-radius: 12px;
          backdrop-filter: blur(4px);
        }
      `}</style>
    </div>
  );
};
