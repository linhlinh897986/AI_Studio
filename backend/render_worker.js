const path = require('path');
const fs = require('fs');
const { bundle } = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');

process.on('message', async (payload) => {
  const { clonedProps, compositionId, outputPath } = payload;
  
  try {
    process.send({ type: 'progress', stage: 'bundling', percent: 20, message: 'Đang đóng gói mã nguồn Remotion...' });
    
    const entry = path.join(__dirname, '..', 'src', 'remotion', 'index.js');
    const bundleLocation = await bundle({
      entryPoint: entry
    });
    
    process.send({ type: 'progress', stage: 'selecting', percent: 40, message: 'Đang khởi tạo Composition...' });
    
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps: clonedProps,
    });
    
    process.send({ type: 'progress', stage: 'rendering', percent: 60, message: 'Đang kết xuất khung hình và âm thanh...' });
    
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: clonedProps,
      onProgress: ({ progress }) => {
        process.send({
          type: 'progress',
          stage: 'rendering',
          percent: Math.floor(60 + (progress * 40)),
          message: `Đang kết xuất video: ${Math.floor(progress * 100)}%`
        });
      }
    });
    
    process.send({ type: 'success', filePath: outputPath });
  } catch (err) {
    process.send({ type: 'error', error: err.message });
  }
});
