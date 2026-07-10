import { AbsoluteFill, Sequence, Audio } from 'remotion';
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

  // Map ambient audio keys to their Mixkit royalty-free SFX links
  const ambientUrls = {
    bell: 'https://assets.mixkit.co/active_storage/sfx/1659/1659-84.wav',
    stream: 'https://assets.mixkit.co/active_storage/sfx/2433/2433-84.wav',
    rain: 'https://assets.mixkit.co/active_storage/sfx/2526/2526-84.wav'
  };

  const selectedAmbientUrl = ambientUrls[ambientSfx];

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
      />
      
    </AbsoluteFill>
  );
};

// ── Multi-Effect Ambient Particles Overlay ───────────────────────────────────
const ZenParticlesOverlay = ({ particleType = 'dust' }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 5 }}>
      <div className={`zen-particles-container ${particleType}`}>
        
        {/* Render dust or lotus floating elements */}
        {(particleType === 'dust' || particleType === 'lotus') && (
          [...Array(15)].map((_, i) => (
            <div 
              key={i} 
              className={`zen-element ${particleType === 'lotus' ? 'lotus-petal' : 'dust-spec'}`}
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 8}s`,
                animationDuration: particleType === 'lotus' ? `${8 + Math.random() * 10}s` : `${10 + Math.random() * 12}s`,
                transform: `scale(${0.4 + Math.random() * 1.2})`,
                opacity: 0.1 + Math.random() * 0.5
              }}
            />
          ))
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

        /* 1. Golden Dust Specs Animation */
        .dust-spec {
          position: absolute;
          bottom: -20px;
          width: 8px;
          height: 8px;
          background: #fbbf24; /* Golden glow */
          border-radius: 50%;
          filter: blur(2px);
          animation: float-up-dust linear infinite;
        }
        @keyframes float-up-dust {
          0% { transform: translateY(0) translateX(0) scale(0.5); opacity: 0; }
          10% { opacity: 0.7; }
          90% { opacity: 0.5; }
          100% { transform: translateY(-110vh) translateX(40px) scale(1.3); opacity: 0; }
        }

        /* 2. Pink Lotus Petals Falling Animation */
        .lotus-petal {
          position: absolute;
          top: -20px;
          width: 14px;
          height: 20px;
          background: radial-gradient(circle, #fbcfe8 0%, #ec4899 100%); /* Pink rose */
          border-radius: 80% 0 85% 50% / 80% 0 85% 50%;
          transform: rotate(45deg);
          animation: fall-sway-lotus linear infinite;
        }
        @keyframes fall-sway-lotus {
          0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.6; }
          100% { transform: translateY(110vh) translateX(-80px) rotate(360deg); opacity: 0; }
        }

        /* 3. Sunlight Rays Breathing Animation */
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
