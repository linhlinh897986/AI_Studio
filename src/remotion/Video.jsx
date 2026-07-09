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
  return (
    <AbsoluteFill style={{ backgroundColor: '#03010a', overflow: 'hidden' }}>
      
      {/* 1. Background Music */}
      {bgMusicUrl && (
        <Audio 
          src={bgMusicUrl} 
          volume={type === 'buddhist' ? 0.15 : 0.08} 
          loop 
        />
      )}

      {/* 2. Main Voiceover */}
      {audioUrl && (
        <Audio 
          src={audioUrl} 
          volume={1.0}
        />
      )}

      {/* 3. Image Slides Layer with transitions */}
      {slides.map((slide, index) => {
        return (
          <Sequence
            key={index}
            from={slide.startFrame}
            durationInFrames={slide.durationFrames}
            layout="absolute"
          >
            <Slide 
              imageUrl={slide.imageUrl} 
              index={index} 
              type={type} 
            />
          </Sequence>
        );
      })}

      {/* 4. Zen Ambient Particles Layer (For Buddhist theme) */}
      {type === 'buddhist' && (
        <Sequence from={0} durationInFrames={9999}>
          <ZenParticlesOverlay />
        </Sequence>
      )}

      {/* 5. Shopee Sales & QR Overlay (For Shopee Review) */}
      {type === 'shopee' && shopeeProps && (
        <Sequence from={0} durationInFrames={9999}>
          <ShopeeBadgeOverlay 
            title={shopeeProps.title} 
            price={shopeeProps.price}
            ratingStar={shopeeProps.ratingStar}
          />
        </Sequence>
      )}

      {/* 6. Active Word Subtitles Layer */}
      <Subtitles subtitles={subtitles} />
      
    </AbsoluteFill>
  );
};

// ── Zen Atmospheric Particles Overlay ────────────────────────────────────────
const ZenParticlesOverlay = () => {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 5 }}>
      {/* Dynamic ambient particles CSS styled */}
      <div className="zen-particles-container">
        {[...Array(15)].map((_, i) => (
          <div 
            key={i} 
            className="zen-particle" 
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${10 + Math.random() * 12}s`,
              transform: `scale(${0.5 + Math.random() * 1.5})`
            }}
          />
        ))}
      </div>
      <style>{`
        .zen-particles-container {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
        .zen-particle {
          position: absolute;
          bottom: -20px;
          width: 8px;
          height: 8px;
          background: rgba(16, 185, 129, 0.4);
          border-radius: 50%;
          filter: blur(2px);
          animation: float-up linear infinite;
        }
        @keyframes float-up {
          0% {
            transform: translateY(0) translateX(0) scale(0.5);
            opacity: 0;
          }
          10% {
            opacity: 0.8;
          }
          90% {
            opacity: 0.5;
          }
          100% {
            transform: translateY(-110vh) translateX(50px) scale(1.5);
            opacity: 0;
          }
        }
      `}</style>
    </AbsoluteFill>
  );
};

// ── Shopee Premium Product Badge Overlay ─────────────────────────────────────
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
