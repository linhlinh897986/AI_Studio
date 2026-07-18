import { useCurrentFrame, useVideoConfig, interpolate, Img, Video } from 'remotion';

export const Slide = ({ imageUrl, index, type }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // 1. Ken Burns Zoom Effect: alternate zoom-in and zoom-out based on slide index
  const startScale = index % 2 === 0 ? 1.0 : 1.15;
  const endScale = index % 2 === 0 ? 1.15 : 1.0;
  
  const scale = interpolate(
    frame,
    [0, durationInFrames],
    [startScale, endScale],
    { extrapolateRight: 'clamp' }
  );

  // 2. Slow panning effect (adds motion feel)
  const startX = index % 3 === 0 ? -10 : index % 3 === 1 ? 10 : 0;
  const endX = index % 3 === 0 ? 10 : index % 3 === 1 ? -10 : 0;
  const translateX = interpolate(
    frame,
    [0, durationInFrames],
    [startX, endX],
    { extrapolateRight: 'clamp' }
  );

  // 3. Smooth Fade-in transition
  const opacity = interpolate(
    frame,
    [0, 10], // first 10 frames (approx 0.33s)
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  const isVideo = imageUrl && (imageUrl.endsWith('.mp4') || imageUrl.includes('.mp4') || imageUrl.includes('veo_web_render') || imageUrl.includes('video'));

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {isVideo ? (
        <Video
          src={imageUrl}
          muted
          loop
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale}) translateX(${translateX}px)`,
            opacity: opacity,
          }}
        />
      ) : (
        <Img
          src={imageUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale}) translateX(${translateX}px)`,
            opacity: opacity,
          }}
        />
      )}
    </div>
  );
};
