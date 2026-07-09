import { registerRoot, Composition } from 'remotion';
import { VideoComposition } from './Video';

registerRoot(() => {
  return (
    <>
      <Composition
        id="ShopeeVideo"
        component={VideoComposition}
        durationInFrames={900} // Override dynamically
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
        durationInFrames={900}
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
        durationInFrames={900}
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
