import { AbsoluteFill, Sequence, Audio, useCurrentFrame, useVideoConfig } from 'remotion';
import { Slide } from './Slide';
import { Subtitles } from './Subtitles';

export const VideoComposition = ({ 
  slides = [], 
  subtitles = [], 
  audioUrl = '', 
  bgMusicUrl = '', 
  type = 'shopee',
  shopeeProps = {} 
}) => {
  
  // Extract custom Buddhist parameters from shopeeProps if type is buddhist
  const isBuddhist = type === 'buddhist';
  const ambientSfx = isBuddhist ? (shopeeProps.ambientSfx || 'bell') : 'none';
  const particleType = isBuddhist ? (shopeeProps.particleType || 'dust') : 'none';
  const subtitleStyle = isBuddhist ? (shopeeProps.subtitleStyle || 'modern') : 'modern';
  const subtitleY = shopeeProps.subtitleY !== undefined ? shopeeProps.subtitleY : 220;

  // Map ambient audio keys to stable raw GitHub CDN links
  const ambientUrls = {
    bell: 'https://raw.githubusercontent.com/nyulachan/nyula/main/Sounds/bell.wav',
    stream: 'https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/1-28135-A-11.wav',
    rain: 'https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/1-17367-A-10.wav'
  };

  const selectedAmbientUrl = shopeeProps.localAmbientUrl || ambientUrls[ambientSfx];

  return (
    <AbsoluteFill style={{ backgroundColor: '#03010a', overflow: 'hidden' }}>
      
      {/* 1. Main Background Music */}
      {bgMusicUrl && (
        <Audio 
          src={bgMusicUrl} 
          volume={isBuddhist ? 0.12 : 0.08} 
          loop 
        />
      )}

      {/* 2. Secondary Ambient SFX Loop (Meditative water/bell/rain) */}
      {isBuddhist && selectedAmbientUrl && (
        <Audio 
          src={selectedAmbientUrl} 
          volume={ambientSfx === 'bell' ? 0.35 : 0.18} // louder bell since it tolls periodically
          loop
        />
      )}

      {/* 3. Voiceover Vocals */}
      {audioUrl && (
        <Audio 
          src={audioUrl} 
          volume={1.0}
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

      {/* 7. Subtitles Layer (supports horizontal karaoke vs vertical calligraphy) */}
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

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 5 }}>
      <div className={`zen-particles-container ${particleType}`}>
        
        {/* Render dust or lotus floating elements */}
        {(particleType === 'dust' || particleType === 'lotus') && (
          [...Array(15)].map((_, i) => {
            const seedLeft = getSeededRandom(i * 12 + 1.5);
            const seedSpeed = getSeededRandom(i * 24 + 3.8);
            const seedSwayRange = getSeededRandom(i * 36 + 5.9);
            const seedSwayFreq = getSeededRandom(i * 48 + 7.2);
            const seedScale = getSeededRandom(i * 60 + 9.1);
            const seedYOffset = getSeededRandom(i * 72 + 11.3);

            // Calculate stable initial horizontal position
            const initialXPercent = 5 + seedLeft * 90;
            const initialXPos = (initialXPercent / 100) * width;

            // Speed: 1.0 to 2.2 pixels per frame for extremely slow, graceful falling
            const speed = particleType === 'lotus' 
              ? 0.8 + seedSpeed * 0.8 
              : 1.2 + seedSpeed * 1.5;

            // Stagger particles vertically. Wrap around screen height + padding
            const startY = -80;
            const totalTravel = height + 160;
            const staggeredStart = seedYOffset * totalTravel;
            const yPos = (startY + (frame * speed + staggeredStart)) % totalTravel;

            // Sinuous horizontal sway (slow sine wave)
            const swayRange = particleType === 'lotus'
              ? 40 + seedSwayRange * 60 
              : 15 + seedSwayRange * 25;
            
            const swayFreq = 0.008 + seedSwayFreq * 0.012; // slow frequency
            const swayX = Math.sin(frame * swayFreq + i) * swayRange;

            // Smooth slow rotation for lotus petals
            const rotationSpeed = particleType === 'lotus' ? 0.2 + seedSwayRange * 0.3 : 0;
            const rotation = particleType === 'lotus'
              ? (frame * rotationSpeed + i * 45) % 360
              : 0;

            const scale = particleType === 'lotus'
              ? 0.5 + seedScale * 0.7
              : 0.3 + seedScale * 0.5;

            const opacity = particleType === 'lotus'
              ? 0.15 + seedScale * 0.4
              : 0.1 + seedScale * 0.3;

            const x = initialXPos + swayX;
            const y = yPos;

            return (
              <div 
                key={i} 
                className={`zen-element ${particleType === 'lotus' ? 'lotus-petal' : 'dust-spec'}`}
                style={{
                  position: 'absolute',
                  transform: `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`,
                  opacity,
                  width: particleType === 'lotus' ? '30px' : '6px',
                  height: particleType === 'lotus' ? '42px' : '6px',
                  background: particleType === 'lotus' 
                    ? 'radial-gradient(circle, #fbcfe8 0%, #ec4899 100%)' 
                    : '#fbbf24',
                  borderRadius: particleType === 'lotus' 
                    ? '80% 0 85% 50% / 80% 0 85% 50%' 
                    : '50%',
                  filter: particleType === 'dust' ? 'blur(1px)' : 'none'
                }}
              />
            );
          })
        )}

        {/* Render misty sun rays overlay */}
        {particleType === 'rays' && (
          <div className="sun-rays-overlay" />
        )}
      </div>

      <style>{`
        .zen-particles-container {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        /* Sunlight Rays Breathing Animation */
        .sun-rays-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.12) 0%, transparent 60%);
          mix-blend-mode: overlay;
          animation: breathe-rays 4s ease-in-out infinite alternate;
          transform-origin: top left;
        }
        @keyframes breathe-rays {
          0% { transform: scale(1.0); opacity: 0.7; }
          100% { transform: scale(1.08); opacity: 1.0; }
        }
      `}</style>
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
