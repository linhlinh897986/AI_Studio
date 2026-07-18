import { AbsoluteFill, Sequence, Audio, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { Slide } from './Slide';
import { Subtitles } from './Subtitles';
import { useState, useEffect } from 'react';
import { getAudioDurationInSeconds } from '@remotion/media-utils';

const AudioWithFade = ({ src, baseVolume, durationFrames, fadeDurationFrames }) => {
  const frame = useCurrentFrame();
  
  let volumeMultiplier = 1;
  if (frame < fadeDurationFrames) {
    volumeMultiplier = frame / fadeDurationFrames;
  } else if (frame > durationFrames - fadeDurationFrames) {
    const remaining = durationFrames - frame;
    volumeMultiplier = Math.max(0, remaining / fadeDurationFrames);
  }
  
  return (
    <Audio
      src={src}
      volume={baseVolume * volumeMultiplier}
    />
  );
};

const LoopingAudio = ({ src, baseVolume = 0.12, fadeDurationFrames = 60 }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [durationInSeconds, setDurationInSeconds] = useState(null);

  useEffect(() => {
    getAudioDurationInSeconds(src)
      .then((duration) => {
        setDurationInSeconds(duration);
      })
      .catch((err) => {
        console.error("Failed to get audio duration:", err);
      });
  }, [src]);

  if (!durationInSeconds) {
    return <Audio src={src} volume={0} />;
  }

  const durationFrames = Math.floor(durationInSeconds * fps);
  const repeats = Math.ceil(durationInFrames / durationFrames);

  return (
    <>
      {Array.from({ length: repeats }).map((_, i) => {
        const startFrame = i * durationFrames;
        return (
          <Sequence
            key={i}
            from={startFrame}
            durationInFrames={durationFrames}
            layout="absolute-fill"
          >
            <AudioWithFade
              src={src}
              baseVolume={baseVolume}
              durationFrames={durationFrames}
              fadeDurationFrames={fadeDurationFrames}
            />
          </Sequence>
        );
      })}
    </>
  );
};

export const VideoComposition = ({ 
  slides = [], 
  subtitles = [], 
  audioUrl = '', 
  bgMusicUrl = '', 
  type = 'shopee',
  shopeeProps = {} 
}) => {
  
  // Extract custom parameters from shopeeProps
  const isBuddhist = type === 'buddhist';
  const particleType = isBuddhist ? (shopeeProps.particleType || 'dust') : 'none';
  const subtitleStyle = isBuddhist ? (shopeeProps.subtitleStyle || 'modern') : 'modern';
  const subtitleY = shopeeProps.subtitleY !== undefined ? shopeeProps.subtitleY : 220;
  const voiceVolume = shopeeProps.voiceVolume !== undefined ? shopeeProps.voiceVolume : 1.0;
  const bgMusicVolume = shopeeProps.bgMusicVolume !== undefined ? shopeeProps.bgMusicVolume : 0.15;

  return (
    <AbsoluteFill style={{ backgroundColor: '#03010a', overflow: 'hidden' }}>
      
      {/* 1. Main Background Music with smooth loop transitions */}
      {bgMusicUrl && (
        <LoopingAudio 
          src={bgMusicUrl} 
          baseVolume={bgMusicVolume} 
          fadeDurationFrames={60} // 2-second fade-in/out
        />
      )}

      {/* 3. Voiceover Vocals */}
      {audioUrl && (
        <Audio 
          src={audioUrl} 
          volume={voiceVolume}
        />
      )}


      {/* 4. Slides transitions layer */}
      {slides.map((slide, index) => {
        return (
          <Sequence
            key={index}
            from={slide.startFrame}
            durationInFrames={slide.durationFrames}
            layout="absolute-fill"
          >
            <Slide 
              imageUrl={slide.imageUrl} 
              index={index} 
              type={type} 
            />
            {type === 'stickman' && (
              <StickmanComicOverlay 
                text={slide.text}
                speakerType={slide.speakerType}
                bubblePos={slide.bubblePos}
                sticker={slide.sticker}
                styleType={shopeeProps.style}
              />
            )}
          </Sequence>
        );
      })}

      {/* 5. Custom Particles Overlay Layer */}
      {isBuddhist && particleType !== 'none' && (
        <Sequence from={0} durationInFrames={9999}>
          <ZenParticlesOverlay particleType={particleType} />
        </Sequence>
      )}

      {/* 6. Shopee Card Overlay (Affiliate Marketing) */}
      {type === 'shopee' && shopeeProps && (
        <Sequence from={0} durationInFrames={9999}>
          <ShopeeBadgeOverlay 
            title={shopeeProps.title} 
            price={shopeeProps.price}
            ratingStar={shopeeProps.ratingStar}
          />
        </Sequence>
      )}

      {/* 7. Static Video Title with Multi-Style Buddhist Overlays */}
      {type === 'buddhist' && subtitleStyle.startsWith('buddhist-') && shopeeProps.videoTitle && (
        <Sequence from={0} durationInFrames={9999}>
          <div style={{
            position: 'absolute',
            top: subtitleStyle === 'buddhist-dharmachakra' ? 180 : 220,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
            pointerEvents: 'none',
          }}>
            {/* Style: buddhist-calligraphy (Classic Minimalist Gold) */}
            {subtitleStyle === 'buddhist-calligraphy' && (
              <span style={{
                fontFamily: "'Dancing Script', cursive",
                fontSize: 78,
                fontWeight: 700,
                background: 'linear-gradient(to bottom, #fbbf24, #d97706)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 2px 10px rgba(0,0,0,0.8), 0 4px 30px rgba(0,0,0,0.7)',
                textAlign: 'center',
              }}>
                {shopeeProps.videoTitle}
              </span>
            )}

            {/* Style: buddhist-mandala (Mandala Gold) */}
            {subtitleStyle === 'buddhist-mandala' && (
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: 260 }}>
                {/* Rotating Mandala SVG */}
                <div style={{
                  position: 'absolute',
                  transform: `rotate(${useCurrentFrame() * 0.15}deg)`,
                  opacity: 0.22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg width="280" height="280" viewBox="0 0 100 100" fill="none">
                    <circle cx="50" cy="50" r="45" stroke="#fbbf24" strokeWidth="0.6" strokeDasharray="3,2" />
                    <circle cx="50" cy="50" r="38" stroke="#fbbf24" strokeWidth="0.4" />
                    <circle cx="50" cy="50" r="28" stroke="#fbbf24" strokeWidth="0.3" strokeDasharray="1,1" />
                    {[...Array(12)].map((_, i) => (
                      <path key={i} d="M 50,50 Q 38,20 50,8 Q 62,20 50,50" stroke="#fbbf24" strokeWidth="0.35" transform={`rotate(${i * 30} 50 50)`} />
                    ))}
                  </svg>
                </div>
                {/* Title */}
                <span style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 72,
                  fontWeight: 700,
                  color: '#fbbf24',
                  textShadow: '0 2px 12px rgba(0,0,0,0.9), 0 4px 25px rgba(0,0,0,0.8)',
                  zIndex: 2,
                  textAlign: 'center',
                  letterSpacing: '1px',
                }}>
                  {shopeeProps.videoTitle}
                </span>
                {/* Golden Lotus below */}
                <div style={{ zIndex: 2, marginTop: 8, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.9))' }}>
                  <svg width="48" height="34" viewBox="0 0 100 80" fill="#fbbf24">
                    <path d="M 50,10 C 55,30 55,70 50,75 C 45,70 45,30 50,10 Z" />
                    <path d="M 50,25 C 38,30 28,45 32,62 C 39,62 46,50 50,45" stroke="#fbbf24" strokeWidth="2" fill="none" />
                    <path d="M 50,40 C 22,45 18,58 28,65 C 34,65 44,55 50,52" stroke="#fbbf24" strokeWidth="2" fill="none" />
                    <path d="M 50,25 C 62,30 72,45 68,62 C 61,62 54,50 50,45" stroke="#fbbf24" strokeWidth="2" fill="none" />
                    <path d="M 50,40 C 78,45 82,58 72,65 C 66,65 56,55 50,52" stroke="#fbbf24" strokeWidth="2" fill="none" />
                  </svg>
                </div>
              </div>
            )}

            {/* Style: buddhist-ink-wash (Ink Wash Thủy Mặc) */}
            {subtitleStyle === 'buddhist-ink-wash' && (
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: 260 }}>
                {/* Enso / Ink Wash Circle Backdrop */}
                <div style={{ position: 'absolute', opacity: 0.45, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="240" height="240" viewBox="0 0 100 100" fill="none">
                    <path d="M 50,10 C 72,10 90,28 90,50 C 90,72 72,90 50,90 C 28,90 10,72 10,50 C 10,32 24,15 45,11" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" />
                  </svg>
                </div>
                {/* Red stamp decoration on the right side of the circle */}
                <div style={{ position: 'absolute', top: 50, right: '24%', zIndex: 1, opacity: 0.85, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
                  <div style={{ width: 28, height: 28, border: '2px solid #dc2626', background: 'transparent', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', fontSize: 10, fontWeight: 900, fontFamily: 'serif' }}>
                    佛
                  </div>
                </div>
                {/* Title */}
                <span style={{
                  fontFamily: "'Dancing Script', cursive",
                  fontSize: 82,
                  fontWeight: 700,
                  color: '#1a120b', // dark charcoal ink
                  textShadow: '-2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 2px 2px 0 #fff, 0 4px 15px rgba(0,0,0,0.8)',
                  zIndex: 2,
                  textAlign: 'center',
                }}>
                  {shopeeProps.videoTitle}
                </span>
                {/* Small Pink Lotus in corner */}
                <div style={{ position: 'absolute', bottom: 10, left: '22%', opacity: 0.9 }}>
                  <svg width="36" height="36" viewBox="0 0 100 100" fill="url(#pinkLotusGrad)">
                    <defs>
                      <radialGradient id="pinkLotusGrad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fbcfe8" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </radialGradient>
                    </defs>
                    <path d="M 50,20 Q 40,40 50,80 Q 60,40 50,20 Z" />
                    <path d="M 50,40 Q 20,45 35,75 Q 48,65 50,55" />
                    <path d="M 50,40 Q 80,45 65,75 Q 52,65 50,55" />
                  </svg>
                </div>
              </div>
            )}

            {/* Style: buddhist-dharmachakra (Pháp luân cổ kính) */}
            {subtitleStyle === 'buddhist-dharmachakra' && (
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 10 }}>
                {/* Spinning Dharmachakra Wheel */}
                <div style={{
                  transform: `rotate(${useCurrentFrame() * 0.25}deg)`,
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.8))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 4,
                }}>
                  <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
                    <circle cx="50" cy="50" r="40" stroke="#fbbf24" strokeWidth="4" />
                    <circle cx="50" cy="50" r="10" stroke="#fbbf24" strokeWidth="3" />
                    <circle cx="50" cy="50" r="3" fill="#fbbf24" />
                    {[...Array(8)].map((_, i) => (
                      <line key={i} x1="50" y1="50" x2={50 + 38 * Math.cos(i * Math.PI / 4)} y2={50 + 38 * Math.sin(i * Math.PI / 4)} stroke="#fbbf24" strokeWidth="4" />
                    ))}
                  </svg>
                </div>
                {/* Decorative border frame container */}
                <div style={{
                  borderTop: '1.5px double #fbbf24',
                  borderBottom: '1.5px double #fbbf24',
                  padding: '8px 48px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  maxWidth: '85%',
                }}>
                  <span style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 66,
                    fontWeight: 700,
                    color: '#fbbf24',
                    textShadow: '0 2px 10px rgba(0,0,0,0.9), 0 4px 20px rgba(0,0,0,0.8)',
                    textAlign: 'center',
                    letterSpacing: '2px',
                  }}>
                    {shopeeProps.videoTitle}
                  </span>
                </div>
                {/* Elegant separator below */}
                <div style={{ marginTop: 2, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}>
                  <svg width="120" height="12" viewBox="0 0 120 12" fill="none">
                    <path d="M 10,6 L 50,6 M 70,6 L 110,6" stroke="#fbbf24" strokeWidth="1" />
                    <circle cx="10" cy="6" r="2" fill="#fbbf24" />
                    <circle cx="110" cy="6" r="2" fill="#fbbf24" />
                    <polygon points="56,3 64,6 56,9" fill="#fbbf24" />
                  </svg>
                </div>
              </div>
            )}

            {/* Style: buddhist-neon (Neon Phát Sáng) */}
            {subtitleStyle === 'buddhist-neon' && (
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                {/* Glowing neon lotus above */}
                <div style={{ filter: 'drop-shadow(0 0 8px #fbbf24)' }}>
                  <svg width="56" height="42" viewBox="0 0 100 80" fill="none">
                    <path d="M 50,10 C 55,30 55,70 50,75 C 45,70 45,30 50,10 Z" fill="#fbbf24" />
                    <path d="M 50,25 C 38,30 28,45 32,62 C 39,62 46,50 50,45" stroke="#fbbf24" strokeWidth="2.5" />
                    <path d="M 50,40 C 22,45 18,58 28,65 C 34,65 44,55 50,52" stroke="#fbbf24" strokeWidth="2.5" />
                    <path d="M 50,25 C 62,30 72,45 68,62 C 61,62 54,50 50,45" stroke="#fbbf24" strokeWidth="2.5" />
                    <path d="M 50,40 C 78,45 82,58 72,65 C 66,65 56,55 50,52" stroke="#fbbf24" strokeWidth="2.5" />
                  </svg>
                </div>
                {/* Neon title */}
                <span style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 76,
                  fontWeight: 800,
                  color: '#ffffff',
                  textAlign: 'center',
                  textShadow: '0 0 6px #fff, 0 0 12px #fbbf24, 0 0 24px #fbbf24, 0 0 48px #d97706, 0 4px 15px rgba(0,0,0,0.8)',
                  letterSpacing: '1px',
                }}>
                  {shopeeProps.videoTitle}
                </span>
              </div>
            )}
          </div>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Playfair+Display:ital,wght@0,700;1,700&family=Caveat:wght@700&family=Lora:ital,wght@0,500;1,500&display=swap');
          `}</style>
        </Sequence>
      )}

      {/* 8. Subtitles Layer (supports horizontal karaoke vs vertical calligraphy) */}
      <Subtitles 
        subtitles={subtitles} 
        styleType={subtitleStyle} 
        yPos={subtitleY}
      />
      
    </AbsoluteFill>
  );
};

// Simple deterministic seeded random generator to prevent re-render flashing/teleporting
const getSeededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// ── Multi-Effect Ambient Particles Overlay ───────────────────────────────────
const ZenParticlesOverlay = ({ particleType = 'dust' }) => {
  const frame = useCurrentFrame();
  const { width = 1080, height = 1920 } = useVideoConfig();

  // Determine particle count based on type
  const particleCount = particleType === 'dust' ? 35 : particleType === 'lotus' ? 22 : 16;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 5, overflow: 'hidden' }}>
      <div className={`zen-particles-container ${particleType}`} style={{ position: 'absolute', inset: 0 }}>
        
        {/* 1. RAYS: Tia Nắng Linh Quang (Divine Volumetric Sunbeams & Light Shafts) */}
        {particleType === 'rays' && (
          <>
            {/* Main top-left divine sunburst glow */}
            <div style={{
              position: 'absolute',
              top: '-15%', left: '-15%',
              width: '80%', height: '80%',
              background: 'radial-gradient(ellipse at 20% 10%, rgba(255, 248, 220, 0.75) 0%, rgba(251, 191, 36, 0.45) 35%, rgba(245, 158, 11, 0.15) 65%, transparent 85%)',
              filter: 'blur(15px)',
              pointerEvents: 'none',
              mixBlendMode: 'screen',
            }} />

            {/* Volumetric Light Beam 1 */}
            <div style={{
              position: 'absolute',
              top: '-20%', left: '0%',
              width: '65%', height: '140%',
              background: 'linear-gradient(135deg, rgba(255, 250, 220, 0.45) 0%, rgba(251, 191, 36, 0.22) 45%, transparent 80%)',
              transform: `rotate(-12deg) scale(${1.0 + Math.sin(frame * 0.03) * 0.06})`,
              transformOrigin: 'top left',
              filter: 'blur(12px)',
              mixBlendMode: 'screen',
            }} />

            {/* Volumetric Light Beam 2 */}
            <div style={{
              position: 'absolute',
              top: '-25%', left: '22%',
              width: '50%', height: '150%',
              background: 'linear-gradient(145deg, rgba(255, 255, 240, 0.55) 0%, rgba(245, 158, 11, 0.28) 50%, transparent 85%)',
              transform: `rotate(-4deg) scale(${1.0 + Math.cos(frame * 0.025) * 0.07})`,
              transformOrigin: 'top left',
              filter: 'blur(10px)',
              mixBlendMode: 'screen',
            }} />

            {/* Volumetric Light Beam 3 */}
            <div style={{
              position: 'absolute',
              top: '-15%', left: '42%',
              width: '45%', height: '130%',
              background: 'linear-gradient(155deg, rgba(255, 235, 170, 0.40) 0%, rgba(251, 191, 36, 0.18) 60%, transparent 90%)',
              transform: `rotate(6deg) scale(${1.0 + Math.sin(frame * 0.02) * 0.05})`,
              transformOrigin: 'top left',
              filter: 'blur(14px)',
              mixBlendMode: 'screen',
            }} />

            {/* Atmospheric Ambient Shimmer */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(255, 230, 140, 0.2) 0%, rgba(251, 191, 36, 0.08) 50%, transparent 100%)',
              mixBlendMode: 'screen',
              opacity: 0.85 + Math.sin(frame * 0.04) * 0.15,
            }} />
          </>
        )}

        {/* 2. Floating Elements: Bụi Vàng Thiền Định / Cánh Hoa Sen / Sparkles trong tia nắng */}
        {(particleType === 'dust' || particleType === 'lotus' || particleType === 'rays') && (
          [...Array(particleCount)].map((_, i) => {
            const seedLeft = getSeededRandom(i * 12 + 1.5);
            const seedSpeed = getSeededRandom(i * 24 + 3.8);
            const seedSwayRange = getSeededRandom(i * 36 + 5.9);
            const seedSwayFreq = getSeededRandom(i * 48 + 7.2);
            const seedScale = getSeededRandom(i * 60 + 9.1);
            const seedYOffset = getSeededRandom(i * 72 + 11.3);
            const seedPulse = getSeededRandom(i * 84 + 13.5);

            // Initial position
            const initialXPercent = 2 + seedLeft * 96;
            const initialXPos = (initialXPercent / 100) * width;

            // Speed:
            const speed = particleType === 'lotus' 
              ? 1.0 + seedSpeed * 1.2 
              : particleType === 'rays'
              ? 0.8 + seedSpeed * 1.4
              : 1.2 + seedSpeed * 2.0;

            // Stagger particles vertically
            const startY = -60;
            const totalTravel = height + 120;
            const staggeredStart = seedYOffset * totalTravel;
            const yPos = (startY + (frame * speed + staggeredStart)) % totalTravel;

            // Swaying
            const swayRange = particleType === 'lotus'
              ? 50 + seedSwayRange * 70 
              : 20 + seedSwayRange * 35;
            
            const swayFreq = 0.01 + seedSwayFreq * 0.015;
            const swayX = Math.sin(frame * swayFreq + i * 2) * swayRange;

            // Rotation
            const rotationSpeed = particleType === 'lotus' ? 0.3 + seedSwayRange * 0.4 : 0;
            const rotation = particleType === 'lotus'
              ? (frame * rotationSpeed + i * 50) % 360
              : 0;

            // Size:
            // DUST: 14px to 28px glowing orbs
            // RAYS specks: 10px to 20px
            // LOTUS: 32px to 54px
            const sizePx = particleType === 'lotus'
              ? Math.round(32 + seedScale * 22)
              : particleType === 'dust'
              ? Math.round(14 + seedScale * 14)
              : Math.round(10 + seedScale * 10);

            const pulseOpacity = 0.7 + Math.sin(frame * (0.04 + seedPulse * 0.06) + i) * 0.3;
            const opacity = particleType === 'lotus'
              ? 0.5 + seedScale * 0.45
              : pulseOpacity;

            const x = initialXPos + swayX;
            const y = yPos;

            if (particleType === 'lotus') {
              return (
                <div 
                  key={i} 
                  className="lotus-petal"
                  style={{
                    position: 'absolute',
                    transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)`,
                    opacity,
                    width: `${sizePx}px`,
                    height: `${Math.round(sizePx * 1.4)}px`,
                    background: 'radial-gradient(ellipse at 30% 20%, #fde047 0%, #f472b6 40%, #db2777 100%)',
                    borderRadius: '80% 0 85% 50% / 80% 0 85% 50%',
                    boxShadow: '0 4px 14px rgba(219, 39, 119, 0.5)',
                    filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))'
                  }}
                />
              );
            }

            // DUST or RAYS particles: Glowing golden Orbs / Stars!
            return (
              <div 
                key={i} 
                className="dust-orb"
                style={{
                  position: 'absolute',
                  transform: `translate(${x}px, ${y}px)`,
                  opacity,
                  width: `${sizePx}px`,
                  height: `${sizePx}px`,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #ffffff 0%, #fef08a 35%, #fbbf24 70%, rgba(245, 158, 11, 0.2) 100%)',
                  boxShadow: `0 0 ${Math.round(sizePx * 0.8)}px #ffe066, 0 0 ${Math.round(sizePx * 1.6)}px #f59e0b, inset 0 0 ${Math.round(sizePx * 0.3)}px #ffffff`,
                  filter: 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.9))'
                }}
              />
            );
          })
        )}
      </div>
    </AbsoluteFill>
  );
};


// ── Shopee Sales & Pricing Card Overlay ──────────────────────────────────────
const ShopeeBadgeOverlay = ({ title = '', price = 0, ratingStar = 5 }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 10, padding: 48, justifyContent: 'flex-start' }}>
      <div className="shopee-badge-card">
        <div className="shopee-logo-tag">SHOPEE CHI TIẾT</div>
        <div className="shopee-badge-info">
          <div className="shopee-badge-title">{title}</div>
          <div className="shopee-badge-bottom">
            <span className="shopee-badge-price">{price.toLocaleString('vi-VN')} đ</span>
            <span className="shopee-badge-stars">⭐ {ratingStar.toFixed(1)}</span>
          </div>
        </div>
      </div>
      <style>{`
        .shopee-badge-card {
          width: 100%;
          background: rgba(249, 115, 22, 0.95);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: 0 10px 25px rgba(249, 115, 22, 0.4);
          animation: slide-down 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .shopee-logo-tag {
          font-family: 'Outfit', sans-serif;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.1em;
          background: #fff;
          color: #f97316;
          padding: 4px 8px;
          border-radius: 6px;
          align-self: flex-start;
        }
        .shopee-badge-title {
          font-family: 'Inter', sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.3;
        }
        .shopee-badge-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 4px;
        }
        .shopee-badge-price {
          font-family: 'Outfit', sans-serif;
          font-size: 20px;
          font-weight: 800;
          color: #fff;
        }
        .shopee-badge-stars {
          font-family: 'Outfit', sans-serif;
          font-size: 13px;
          font-weight: 600;
          background: rgba(255,255,255,0.2);
          padding: 3px 8px;
          border-radius: 6px;
          color: #fff;
        }
        @keyframes slide-down {
          0% { transform: translateY(-40px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </AbsoluteFill>
  );
};

// ── Stickman Comic Overlays ──────────────────────────────────────────────────
const StickmanComicOverlay = ({ 
  text = '', 
  speakerType = 'narration', 
  bubblePos = 'none', 
  sticker = 'none', 
  styleType = 'sketch' 
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring animation for speech bubble / caption scaling
  const entrance = spring({
    frame,
    fps,
    config: {
      damping: 12,
      stiffness: 110,
      mass: 0.5,
    },
  });

  const isNeon = styleType === 'neon';
  const isBlueprint = styleType === 'blueprint';
  const isRetro = styleType === 'retro';

  // 1. Comic Caption Banner (Narration)
  if (speakerType === 'narration') {
    let bannerStyle = {
      background: '#fef08a', // light yellow
      color: '#000',
      border: '5px solid #000',
      boxShadow: '6px 6px 0px #000',
      transform: `scale(${entrance}) rotate(-1deg)`,
    };

    if (isNeon) {
      bannerStyle = {
        background: '#090d16',
        color: '#fff',
        border: '3px solid #f472b6',
        boxShadow: '0 0 15px #f472b6',
        transform: `scale(${entrance}) rotate(-1deg)`,
      };
    } else if (isBlueprint) {
      bannerStyle = {
        background: '#1e3a8a',
        color: '#fff',
        border: '3px dashed #fff',
        boxShadow: 'none',
        transform: `scale(${entrance}) rotate(0deg)`,
      };
    } else if (isRetro) {
      bannerStyle = {
        background: '#ffedd5',
        color: '#431407',
        border: '4px solid #431407',
        boxShadow: '5px 5px 0px #431407',
        transform: `scale(${entrance}) rotate(1deg)`,
      };
    }

    return (
      <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 15, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 120 }}>
        <div 
          className="comic-narration-box"
          style={{
            width: '80%',
            padding: '18px 24px',
            borderRadius: 8,
            textAlign: 'center',
            fontFamily: "'Comic Neue', sans-serif",
            fontSize: 34,
            fontWeight: 800,
            lineHeight: 1.4,
            textTransform: 'uppercase',
            ...bannerStyle
          }}
        >
          {text}
        </div>
      </AbsoluteFill>
    );
  }

  // 2. SVG Speech Bubble (Dialogue)
  if (speakerType === 'dialogue' && bubblePos !== 'none') {
    let bubbleStyle = {
      background: '#ffffff',
      color: '#000000',
      border: '5px solid #000000',
      boxShadow: '6px 6px 0px #000000',
    };

    let pointerColor = '#000000';
    let innerPointerColor = '#ffffff';

    if (isNeon) {
      bubbleStyle = {
        background: '#05050a',
        color: '#22d3ee',
        border: '3px solid #22d3ee',
        boxShadow: '0 0 15px rgba(34, 211, 238, 0.4)',
      };
      pointerColor = '#22d3ee';
      innerPointerColor = '#05050a';
    } else if (isBlueprint) {
      bubbleStyle = {
        background: '#1e40af',
        color: '#ffffff',
        border: '3px solid #ffffff',
        boxShadow: 'none',
      };
      pointerColor = '#ffffff';
      innerPointerColor = '#1e40af';
    } else if (isRetro) {
      bubbleStyle = {
        background: '#ffffff',
        color: '#1a120b',
        border: '4px solid #1a120b',
        boxShadow: '5px 5px 0px #1a120b',
      };
      pointerColor = '#1a120b';
      innerPointerColor = '#ffffff';
    }

    // Determine layout coordinates based on bubblePos
    let positionProps = {};
    let pointerStyle = {};

    if (bubblePos === 'top-left') {
      positionProps = { top: 220, left: 80 };
      pointerStyle = { bottom: -20, left: 40, transform: 'rotate(0deg)' };
    } else if (bubblePos === 'top-right') {
      positionProps = { top: 220, right: 80 };
      pointerStyle = { bottom: -20, right: 40, transform: 'rotateY(180deg)' };
    } else if (bubblePos === 'bottom-left') {
      positionProps = { bottom: 320, left: 80 };
      pointerStyle = { top: -20, left: 40, transform: 'rotateX(180deg)' };
    } else if (bubblePos === 'bottom-right') {
      positionProps = { bottom: 320, right: 80 };
      pointerStyle = { top: -20, right: 40, transform: 'rotate(180deg)' };
    }

    return (
      <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 15 }}>
        <div
          className="speech-bubble-container"
          style={{
            position: 'absolute',
            width: '65%',
            maxWidth: 400,
            padding: '16px 20px',
            borderRadius: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${entrance})`,
            transformOrigin: bubblePos.includes('left') ? 'bottom left' : 'bottom right',
            ...positionProps,
            ...bubbleStyle
          }}
        >
          {/* Text */}
          <span style={{
            fontFamily: "'Architects Daughter', 'Comic Neue', sans-serif",
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1.3,
            textAlign: 'center'
          }}>
            {text}
          </span>

          {/* Curved Pointer Tail using simple SVG */}
          <svg 
            width="30" 
            height="22" 
            viewBox="0 0 30 22" 
            style={{
              position: 'absolute',
              ...pointerStyle
            }}
          >
            {/* Outer border shape */}
            <path d="M 0 0 C 10 10 20 22 30 22 C 22 15 15 5 12 0 Z" fill={pointerColor} />
            {/* Inner fill shape */}
            <path d="M 2 0 C 11 9 19 20 28 20 C 20 14 14 4 11 0 Z" fill={innerPointerColor} />
          </svg>
        </div>

        {/* Action Sticker overlay inside the same panel */}
        {sticker !== 'none' && (
          <StickmanActionSticker text={sticker} styleType={styleType} />
        )}
      </AbsoluteFill>
    );
  }

  // 3. Show sticker on narration slides if it has a sticker
  if (sticker !== 'none') {
    return (
      <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 16 }}>
        <StickmanActionSticker text={sticker} styleType={styleType} />
      </AbsoluteFill>
    );
  }

  return null;
};

// Sub-component: Comic Action Sticker ("BOOM!", "BANG!", etc.)
const StickmanActionSticker = ({ text = '', styleType = 'sketch' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Instant scale spring for punchy feel
  const scale = spring({
    frame,
    fps,
    config: {
      damping: 6,
      stiffness: 180,
      mass: 0.3,
    },
  });

  const isNeon = styleType === 'neon';
  const isBlueprint = styleType === 'blueprint';

  let stickerColor = '#e11d48'; // crimson red
  let fontShadow = '4px 4px 0px #facc15, 8px 8px 0px #000'; // 3D comic offset yellow+black
  
  if (isNeon) {
    stickerColor = '#a855f7'; // purple neon
    fontShadow = '0 0 10px #a855f7, 0 0 25px #22d3ee, 3px 3px 2px #000';
  } else if (isBlueprint) {
    stickerColor = '#ffffff';
    fontShadow = '3px 3px 0px #1e3a8a, -3px -3px 0px #1e3a8a';
  }

  return (
    <div style={{
      position: 'absolute',
      left: '25%',
      top: '40%',
      width: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: `scale(${scale}) rotate(${(frame % 2 === 0 ? 1 : -1) * 2 - 8}deg)`, // minor shake at the beginning
      animation: 'comic-shake 0.3s ease-in-out infinite',
      pointerEvents: 'none',
      zIndex: 20
    }}>
      <span style={{
        fontFamily: "'Bangers', 'Luckiest Guy', sans-serif",
        fontSize: 120,
        fontWeight: 900,
        color: stickerColor,
        textShadow: fontShadow,
        letterSpacing: '2px',
        textAlign: 'center'
      }}>
        {text}
      </span>
      
      <style>{`
        @keyframes comic-shake {
          0% { transform: translate(0, 0) rotate(-8deg) scale(1); }
          25% { transform: translate(-3px, 3px) rotate(-9deg) scale(1.02); }
          50% { transform: translate(3px, -3px) rotate(-7deg) scale(0.98); }
          75% { transform: translate(-2px, -2px) rotate(-8.5deg) scale(1.01); }
          100% { transform: translate(0, 0) rotate(-8deg) scale(1); }
        }
      `}</style>
      
      {/* Load Action Comic Fonts from Google */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bangers&family=Luckiest+Guy&family=Comic+Neue:wght@700;800&family=Architects+Daughter&display=swap');
      `}</style>
    </div>
  );
};
