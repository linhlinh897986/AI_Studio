import { registerRoot, Composition, getInputProps } from 'remotion';
import { VideoComposition } from './Video';

registerRoot(() => {
  const inputProps = getInputProps() || {};
  
  // Calculate dynamic duration in frames based on slides.
  // If slides array is empty, fallback to 900 frames (30s)
  const totalDurationFrames = inputProps.slides && inputProps.slides.length > 0
    ? inputProps.slides[inputProps.slides.length - 1].startFrame + inputProps.slides[inputProps.slides.length - 1].durationFrames
    : 900;

  return (
    <>
      {/* ── Portrait 9:16 compositions ── */}
      <Composition
        id="ShopeeVideo"
        component={VideoComposition}
        durationInFrames={totalDurationFrames}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          slides: [],
          subtitles: [],
          audioUrl: '',
          bgMusicUrl: '',
          type: 'shopee',
          shopeeProps: {
            title: 'Mẫu sản phẩm Shopee',
            price: 150000,
            ratingStar: 4.8
          }
        }}
      />
      <Composition
        id="BuddhistVideo"
        component={VideoComposition}
        durationInFrames={totalDurationFrames}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          slides: [],
          subtitles: [],
          audioUrl: '',
          bgMusicUrl: '',
          type: 'buddhist'
        }}
      />
      <Composition
        id="StickmanVideo"
        component={VideoComposition}
        durationInFrames={totalDurationFrames}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          slides: [],
          subtitles: [],
          audioUrl: '',
          bgMusicUrl: '',
          type: 'stickman'
        }}
      />

      {/* ── Landscape 16:9 compositions ── */}
      <Composition
        id="ShopeeVideoLandscape"
        component={VideoComposition}
        durationInFrames={totalDurationFrames}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          slides: [],
          subtitles: [],
          audioUrl: '',
          bgMusicUrl: '',
          type: 'shopee',
          shopeeProps: {
            title: 'Mẫu sản phẩm Shopee',
            price: 150000,
            ratingStar: 4.8
          }
        }}
      />
      <Composition
        id="BuddhistVideoLandscape"
        component={VideoComposition}
        durationInFrames={totalDurationFrames}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          slides: [],
          subtitles: [],
          audioUrl: '',
          bgMusicUrl: '',
          type: 'buddhist'
        }}
      />
      <Composition
        id="StickmanVideoLandscape"
        component={VideoComposition}
        durationInFrames={totalDurationFrames}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          slides: [],
          subtitles: [],
          audioUrl: '',
          bgMusicUrl: '',
          type: 'stickman'
        }}
      />
    </>
  );
});
