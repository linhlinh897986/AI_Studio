import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║       PHẬT PHÁP SUBTITLE ENGINE — v2.1 Premium Edition          ║
 * ║  6 phong cách độc quyền, thiết kế bởi nhà sản xuất 20 năm KN   ║
 * ║  v2.1: Sentence-grouping engine — gom segments thành câu hoàn   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Styles:
 *   1. lotus-gold         — Cánh Sen Hoàng Kim  (Vàng nhũ sang trọng)
 *   2. zen-brush          — Thiền Họa Mực Tàu   (Ink Wash thủy mặc)
 *   3. dharma-gate        — Pháp Môn Cổ Điển    (Cổng Phật Đường)
 *   4. sacred-glow        — Linh Quang Thiêng Liêng (Hào Quang Phật)
 *   5. mountain-mist      — Sương Núi Tĩnh Lặng (Siêu tối giản)
 *   6. sutra-scroll       — Cuộn Kinh Cổ        (Thư Pháp Kinh Điển)
 */

// ─────────────────────────────────────────────────────────────────────────────
// SENTENCE GROUPING ENGINE
// Gom các ASR utterance ngắn liên tiếp (gap < GAP_THRESHOLD_MS) thành 1 "câu"
// để subtitle luôn hiển thị trọn vẹn 1 ý, không bị cắt ngang 2-3 từ.
// ─────────────────────────────────────────────────────────────────────────────
const GAP_THRESHOLD_MS = 700;   // khoảng cách tối đa giữa 2 utterance trong cùng nhóm
const MAX_GROUP_CHARS  = 60;    // số ký tự tối đa 1 nhóm (tránh quá dài)
const MAX_GROUP_SEGS   = 6;     // số utterance tối đa 1 nhóm

/**
 * Xây dựng mảng "groups" từ subtitles gốc.
 * Mỗi group = { start_time, end_time, text, segments[] }
 */
function buildGroups(subtitles) {
  if (!subtitles || subtitles.length === 0) return [];
  const groups = [];
  let current = {
    start_time: subtitles[0].start_time,
    end_time: subtitles[0].end_time,
    text: subtitles[0].text,
    segments: [subtitles[0]],
  };

  for (let i = 1; i < subtitles.length; i++) {
    const seg = subtitles[i];
    const gap = seg.start_time - current.end_time;
    const combined = current.text + ' ' + seg.text;
    const canMerge =
      gap <= GAP_THRESHOLD_MS &&
      combined.length <= MAX_GROUP_CHARS &&
      current.segments.length < MAX_GROUP_SEGS;

    if (canMerge) {
      current.end_time = seg.end_time;
      current.text = combined.trim();
      current.segments.push(seg);
    } else {
      groups.push(current);
      current = {
        start_time: seg.start_time,
        end_time: seg.end_time,
        text: seg.text,
        segments: [seg],
      };
    }
  }
  groups.push(current);
  return groups;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export const Subtitles = ({ subtitles = [], styleType = 'lotus-gold', yPos = 220 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  // Build grouped sentences (computed once per subtitles array)
  const groups = buildGroups(subtitles);

  // Find active group
  const activeGroup = groups.find(
    (g) => currentTimeMs >= g.start_time && currentTimeMs <= g.end_time
  );

  if (!activeGroup) return null;

  // For word-level highlighting (sacred-glow): collect all words in group
  const allWords = activeGroup.segments.flatMap(seg =>
    seg.words && seg.words.length > 0
      ? seg.words
      : [{ text: seg.text, start_time: seg.start_time, end_time: seg.end_time }]
  );

  const groupDuration = activeGroup.end_time - activeGroup.start_time;
  const timeInGroup = currentTimeMs - activeGroup.start_time;

  // Smooth fade utility (relative to group)
  const getFade = (fadeIn = 200, fadeOut = 350) => {
    if (timeInGroup < fadeIn) return timeInGroup / fadeIn;
    const remaining = activeGroup.end_time - currentTimeMs;
    if (remaining < fadeOut) return Math.max(0, remaining / fadeOut);
    return 1;
  };

  // ══════════════════════════════════════════════════════════════════
  // 1. LOTUS GOLD — Cánh Sen Hoàng Kim
  //    Chữ gradient vàng nhũ, trang trí đường kẻ hoa sen SVG
  // ══════════════════════════════════════════════════════════════════
  if (styleType === 'lotus-gold') {
    const opacity = getFade(200, 350);
    const slideUp = interpolate(
      Math.min(timeInGroup, 200),
      [0, 200],
      [14, 0],
      { extrapolateRight: 'clamp' }
    );

    return (
      <div style={{
        position: 'absolute',
        bottom: yPos,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        padding: '0 48px',
        zIndex: 20,
        pointerEvents: 'none',
        opacity,
        transform: `translateY(${slideUp}px)`,
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          maxWidth: '90%',
        }}>
          <svg width="220" height="16" viewBox="0 0 220 16" fill="none">
            <line x1="0" y1="8" x2="85" y2="8" stroke="url(#gg1)" strokeWidth="1" />
            <line x1="135" y1="8" x2="220" y2="8" stroke="url(#gg2)" strokeWidth="1" />
            <path d="M110,2 C113,5 113,11 110,14 C107,11 107,5 110,2Z" fill="#d4a017" opacity="0.9" />
            <path d="M110,5 C106,7 103,11 105,14 C107,13 109,9 110,7" fill="#d4a017" opacity="0.7" />
            <path d="M110,5 C114,7 117,11 115,14 C113,13 111,9 110,7" fill="#d4a017" opacity="0.7" />
            <circle cx="110" cy="8" r="2" fill="#f5c842" />
            <polygon points="90,8 93,5 96,8 93,11" fill="#d4a017" opacity="0.6" />
            <polygon points="124,8 127,5 130,8 127,11" fill="#d4a017" opacity="0.6" />
            <defs>
              <linearGradient id="gg1" x1="0" y1="0" x2="85" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#d4a017" stopOpacity="0" />
                <stop offset="100%" stopColor="#d4a017" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="gg2" x1="135" y1="0" x2="220" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#d4a017" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#d4a017" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>

          <div style={{ position: 'relative', textAlign: 'center' }}>
            <span style={{
              position: 'absolute',
              inset: 0,
              fontFamily: "'Lora', 'Noto Serif', serif",
              fontSize: 42,
              fontWeight: 600,
              color: 'transparent',
              filter: 'blur(12px)',
              opacity: 0.35,
              background: 'linear-gradient(135deg, #f5c842, #d97706)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              userSelect: 'none',
            }}>{activeGroup.text}</span>
            <span style={{
              fontFamily: "'Lora', 'Noto Serif', serif",
              fontSize: 42,
              fontWeight: 600,
              background: 'linear-gradient(180deg, #fef3c7 0%, #f5c842 45%, #d97706 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.45,
              letterSpacing: '0.5px',
              display: 'block',
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.95)) drop-shadow(0 0 20px rgba(212,160,23,0.4))',
            }}>{activeGroup.text}</span>
          </div>

          <svg width="160" height="12" viewBox="0 0 160 12" fill="none">
            <line x1="0" y1="6" x2="58" y2="6" stroke="#d4a017" strokeWidth="0.8" strokeOpacity="0.6" />
            <line x1="102" y1="6" x2="160" y2="6" stroke="#d4a017" strokeWidth="0.8" strokeOpacity="0.6" />
            <circle cx="80" cy="6" r="3" fill="#d4a017" opacity="0.8" />
            <circle cx="66" cy="6" r="1.5" fill="#d4a017" opacity="0.5" />
            <circle cx="94" cy="6" r="1.5" fill="#d4a017" opacity="0.5" />
          </svg>
        </div>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&display=swap');`}</style>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // 2. ZEN BRUSH — Thiền Họa Mực Tàu
  //    Nền mực tàu loang dần, chữ xuất hiện như bút họa
  // ══════════════════════════════════════════════════════════════════
  if (styleType === 'zen-brush') {
    const opacity = getFade(250, 400);
    const brushReveal = interpolate(
      Math.min(timeInGroup, 300),
      [0, 300],
      [0, 1],
      { easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp' }
    );

    return (
      <div style={{
        position: 'absolute',
        bottom: yPos,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        padding: '0 56px',
        zIndex: 20,
        pointerEvents: 'none',
        opacity,
      }}>
        <div style={{ position: 'relative', maxWidth: '88%', textAlign: 'center' }}>
          <div style={{
            position: 'absolute',
            inset: '-12px -24px',
            background: 'radial-gradient(ellipse 110% 80% at 50% 60%, rgba(0,0,0,0.72) 60%, transparent 100%)',
            filter: 'blur(4px)',
            transform: `scaleX(${brushReveal})`,
            transformOrigin: 'left center',
          }} />
          <span style={{
            position: 'relative',
            fontFamily: "'Noto Serif SC', 'Noto Serif', Georgia, serif",
            fontSize: 40,
            fontWeight: 400,
            color: '#f5f0e8',
            lineHeight: 1.5,
            letterSpacing: '1.5px',
            textShadow: '0 1px 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)',
            display: 'block',
          }}>{activeGroup.text}</span>
          <div style={{
            marginTop: 8,
            height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(245,240,232,0.5) 30%, rgba(245,240,232,0.5) 70%, transparent)',
            transform: `scaleX(${brushReveal})`,
            transformOrigin: 'left center',
            borderRadius: 2,
          }} />
        </div>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500&display=swap');`}</style>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // 3. DHARMA GATE — Pháp Môn Cổ Điển
  //    Hộp son đỏ-vàng truyền thống, viền kép trang trí góc
  // ══════════════════════════════════════════════════════════════════
  if (styleType === 'dharma-gate') {
    const opacity = getFade(180, 300);
    const scale = interpolate(
      Math.min(timeInGroup, 200),
      [0, 200],
      [0.96, 1],
      { extrapolateRight: 'clamp' }
    );

    const cornerPositions = [
      { top: 4, left: 4 },
      { top: 4, right: 4 },
      { bottom: 4, left: 4 },
      { bottom: 4, right: 4 },
    ];

    return (
      <div style={{
        position: 'absolute',
        bottom: yPos,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        padding: '0 40px',
        zIndex: 20,
        pointerEvents: 'none',
        opacity,
        transform: `scale(${scale})`,
      }}>
        <div style={{ position: 'relative', maxWidth: '86%' }}>
          <div style={{
            position: 'absolute',
            inset: -3,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #d4a017, #8b1a1a, #d4a017)',
            opacity: 0.7,
          }} />
          <div style={{
            position: 'relative',
            background: 'linear-gradient(180deg, rgba(90,10,10,0.92) 0%, rgba(60,5,5,0.96) 100%)',
            border: '1px solid rgba(212,160,23,0.6)',
            borderRadius: 4,
            padding: '16px 36px',
            textAlign: 'center',
          }}>
            {cornerPositions.map((pos, i) => (
              <svg key={i} width="14" height="14" viewBox="0 0 14 14"
                style={{ position: 'absolute', ...pos }}>
                <path d="M0,0 L8,0 L8,2 L2,2 L2,8 L0,8 Z" fill="#d4a017" opacity="0.8" />
              </svg>
            ))}
            <div style={{
              height: 1,
              background: 'linear-gradient(90deg, transparent, #d4a017 20%, #f5c842 50%, #d4a017 80%, transparent)',
              marginBottom: 12,
              opacity: 0.8,
            }} />
            <span style={{
              fontFamily: "'Lora', 'Noto Serif', serif",
              fontSize: 38,
              fontWeight: 600,
              color: '#fff8e7',
              lineHeight: 1.45,
              letterSpacing: '0.8px',
              textShadow: '0 1px 8px rgba(0,0,0,0.8), 0 0 16px rgba(212,160,23,0.3)',
              display: 'block',
            }}>{activeGroup.text}</span>
            <div style={{
              height: 1,
              background: 'linear-gradient(90deg, transparent, #d4a017 20%, #f5c842 50%, #d4a017 80%, transparent)',
              marginTop: 12,
              opacity: 0.8,
            }} />
          </div>
        </div>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&display=swap');`}</style>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // 4. SACRED GLOW — Linh Quang Thiêng Liêng
  //    Từng từ phát hào quang vàng khi được đọc tới (karaoke)
  //    Hiển thị toàn bộ câu, highlight từ đang đọc
  // ══════════════════════════════════════════════════════════════════
  if (styleType === 'sacred-glow') {
    const opacity = getFade(200, 300);

    return (
      <div style={{
        position: 'absolute',
        bottom: yPos,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        padding: '0 40px',
        zIndex: 20,
        pointerEvents: 'none',
        opacity,
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '4px 10px',
          maxWidth: '90%',
          textAlign: 'center',
        }}>
          {allWords.length > 0 ? (
            allWords.map((word, idx) => {
              const isActive = currentTimeMs >= word.start_time && currentTimeMs <= word.end_time;
              const isPast = currentTimeMs > word.end_time;
              return (
                <span key={idx} style={{
                  fontFamily: "'Cinzel', 'Lora', serif",
                  fontSize: 40,
                  fontWeight: isActive ? 700 : 600,
                  display: 'inline-block',
                  transition: 'all 0.1s ease',
                  color: isActive ? '#fff8e7' : isPast ? 'rgba(245,200,100,0.65)' : 'rgba(255,255,255,0.5)',
                  textShadow: isActive
                    ? '0 0 8px rgba(245,200,100,0.9), 0 0 20px rgba(245,200,100,0.6), 0 0 40px rgba(245,200,100,0.3), 0 2px 6px rgba(0,0,0,0.9)'
                    : '0 2px 6px rgba(0,0,0,0.8)',
                  transform: isActive ? 'scale(1.12) translateY(-2px)' : 'scale(1)',
                  letterSpacing: '0.3px',
                }}>{word.text}</span>
              );
            })
          ) : (
            <span style={{
              fontFamily: "'Cinzel', 'Lora', serif",
              fontSize: 40,
              fontWeight: 600,
              color: '#fff8e7',
              textShadow: '0 0 16px rgba(245,200,100,0.7), 0 2px 8px rgba(0,0,0,0.9)',
              letterSpacing: '0.5px',
            }}>{activeGroup.text}</span>
          )}
        </div>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap');`}</style>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // 5. MOUNTAIN MIST — Sương Núi Tĩnh Lặng
  //    Cực kỳ tối giản, chữ in hoa mỏng nhẹ như sương khói
  // ══════════════════════════════════════════════════════════════════
  if (styleType === 'mountain-mist') {
    const opacity = getFade(500, 600);
    const blur = interpolate(
      Math.min(timeInGroup, 400),
      [0, 400],
      [3, 0],
      { extrapolateRight: 'clamp' }
    );

    return (
      <div style={{
        position: 'absolute',
        bottom: yPos,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        padding: '0 64px',
        zIndex: 20,
        pointerEvents: 'none',
        opacity,
        filter: `blur(${blur}px)`,
      }}>
        <div style={{ maxWidth: '82%', textAlign: 'center' }}>
          <span style={{
            fontFamily: "'Raleway', 'Outfit', sans-serif",
            fontSize: 36,
            fontWeight: 300,
            color: 'rgba(255, 248, 230, 0.92)',
            lineHeight: 1.6,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            textShadow: '0 2px 16px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.6)',
            display: 'block',
          }}>{activeGroup.text}</span>
        </div>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Raleway:wght@200;300;400&display=swap');`}</style>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // 6. SUTRA SCROLL — Cuộn Kinh Cổ
  //    Cuộn kinh cổ da thuộc nâu, chữ đen mực, cuộn mở dần
  // ══════════════════════════════════════════════════════════════════
  if (styleType === 'sutra-scroll') {
    const opacity = getFade(150, 400);
    const unfurl = interpolate(
      Math.min(timeInGroup, 350),
      [0, 350],
      [0.3, 1],
      { easing: Easing.out(Easing.back(1.5)), extrapolateRight: 'clamp' }
    );

    return (
      <div style={{
        position: 'absolute',
        bottom: yPos,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        padding: '0 44px',
        zIndex: 20,
        pointerEvents: 'none',
        opacity,
        transform: `scaleY(${unfurl})`,
        transformOrigin: 'bottom center',
      }}>
        <div style={{ position: 'relative', maxWidth: '88%' }}>
          <div style={{
            position: 'absolute',
            inset: '4px 0 -4px',
            background: 'rgba(0,0,0,0.5)',
            borderRadius: 6,
            filter: 'blur(6px)',
          }} />
          <div style={{
            position: 'relative',
            background: 'linear-gradient(180deg, #d4b896 0%, #c9a87a 40%, #b8956a 100%)',
            borderRadius: 4,
            padding: '14px 32px 16px',
            border: '1px solid rgba(100,60,20,0.4)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2)',
          }}>
            <div style={{
              position: 'absolute',
              top: -5, left: -4, right: -4,
              height: 10,
              background: 'linear-gradient(90deg, #5c3d11, #8b6335, #5c3d11)',
              borderRadius: 5,
              boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
            }} />
            <span style={{
              fontFamily: "'Lora', 'Noto Serif', Georgia, serif",
              fontSize: 36,
              fontWeight: 600,
              color: '#2d1a06',
              lineHeight: 1.5,
              letterSpacing: '0.8px',
              textShadow: '0 1px 0 rgba(255,255,255,0.2)',
              display: 'block',
              textAlign: 'center',
            }}>{activeGroup.text}</span>
            <div style={{
              position: 'absolute',
              bottom: -5, left: -4, right: -4,
              height: 10,
              background: 'linear-gradient(90deg, #5c3d11, #8b6335, #5c3d11)',
              borderRadius: 5,
              boxShadow: '0 -2px 4px rgba(0,0,0,0.4)',
            }} />
          </div>
        </div>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&display=swap');`}</style>
      </div>
    );
  }

  return null;
};
