import { useCurrentFrame, useVideoConfig, interpolate, Img } from 'remotion';

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

  return (
    <div style={{ width: '1080px', height: '1920px', overflow: 'hidden', position: 'relative' }}>
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
    </div>
  );
};
