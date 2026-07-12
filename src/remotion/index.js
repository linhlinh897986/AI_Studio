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
    </>
  );
});
