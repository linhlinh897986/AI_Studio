import React, { useState } from 'react';
import { ShoppingBag, Loader, AlertTriangle, Play } from 'lucide-react';
import VideoPlayerPanel from './VideoPlayerPanel';

const { ipcRenderer } = window.require('electron');

export default function ShopeeTab({ onLog }) {
  const [shopeeLink, setShopeeLink] = useState('');
  const [voice, setVoice] = useState('vi-VN-HoaiMyNeural'); // Female review voice
  const [bgMusic, setBgMusic] = useState('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'); // Mock bgmusic URL
  
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState('');

  // Generated state to pass to VideoPlayerPanel
  const [slides, setSlides] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [audioUrl, setAudioUrl] = useState('');
  const [shopeeProps, setShopeeProps] = useState(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);

  const handleGenerate = async () => {
    if (!shopeeLink) {
      setError('Vui lòng nhập liên kết sản phẩm Shopee.');
      return;
    }
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      setError('Vui lòng cài đặt và xác thực Gemini API Key trong Tab Cấu Hình trước.');
      return;
    }

    setLoading(true);
    setError('');
    setSlides([]);
    setSubtitles([]);
    setAudioUrl('');
    setShopeeProps(null);

    try {
      // Stage 1: Fetch Shopee Details
      setLoadingStage('Đang lấy thông tin sản phẩm từ Shopee...');
      onLog('Shopee', 'Bắt đầu cào dữ liệu liên kết Shopee...', 'info');
      const shopeeRes = await ipcRenderer.invoke('shopee-fetch', { shopeeLink });
      if (!shopeeRes.success) throw new Error(shopeeRes.error);
      const product = shopeeRes.product;
      setShopeeProps(product);
      onLog('Shopee', `Cào thành công: ${product.title.substring(0, 40)}...`, 'success');

      // Stage 2: Call Gemini to write script
      setLoadingStage('Gemini đang sáng tạo kịch bản review tiếp thị...');
      onLog('Shopee', 'Đang yêu cầu Gemini viết kịch bản quảng cáo tiếp thị liên kết...', 'info');
      
      const numImages = Math.min(product.images.length, 5); // Use up to 5 images
      const systemPrompt = `Bạn là chuyên gia tiếp thị liên kết video ngắn (Affiliate) chuyên nghiệp. Hãy viết kịch bản review tiếng Việt ngắn gọn, cuốn hút, giật gân để đẩy doanh số. Định dạng JSON bắt buộc.`;
      
      const userPrompt = `Hãy viết một kịch bản review ngắn gọn (khoảng 100-120 từ), chia làm 4-5 phân đoạn phù hợp với ${numImages} hình ảnh sản phẩm.
Tên sản phẩm: ${product.title}
Mô tả sản phẩm: ${product.description.substring(0, 400)}...
Giá bán: ${product.price.toLocaleString()} VND
Xếp hạng: ${product.ratingStar} sao.

Hãy trả về duy nhất một đối tượng JSON có thuộc tính "script" là một mảng, mỗi phần tử gồm:
- "text": câu nói tiếp thị vui nhộn, súc tích (khoảng 20-30 từ).
- "imageIndex": số chỉ mục của ảnh (từ 0 đến ${numImages - 1}).`;

      const geminiModel = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
      const geminiRes = await ipcRenderer.invoke('gemini-generate', { apiKey, systemPrompt, userPrompt, geminiModel });
      if (!geminiRes.success) throw new Error(geminiRes.error);
      const scriptData = geminiRes.data.script;
      onLog('Shopee', `Viết kịch bản hoàn tất. Gồm ${scriptData.length} phân đoạn nói.`, 'success');

      // Stage 3: Synthesize Speech Voiceover
      setLoadingStage('Đang chuyển đổi kịch bản thành giọng nói lồng tiếng AI...');
      onLog('Shopee', 'Đang kết nối tới Edge-TTS để tạo giọng nói lồng tiếng...', 'info');
      const fullText = scriptData.map(item => item.text).join(' ');
      const ttsRes = await ipcRenderer.invoke('edge-tts-synthesize', { 
        text: fullText, 
        options: { voice, rate: '+5%' } // slightly faster for high-retention review style
      });
      if (!ttsRes.success) throw new Error(ttsRes.error);
      const localAudioUrl = ttsRes.filePath;
      setAudioUrl(localAudioUrl);
      onLog('Shopee', 'Tạo giọng nói lồng tiếng thành công.', 'success');

      // Stage 4: Run CapCut ASR to get word timings
      setLoadingStage('Đang phân tích ASR CapCut để tạo phụ đề Karaoke...');
      onLog('Shopee', 'Đang tải âm thanh lên CapCut ASR để tách từ khóa động...', 'info');
      const asrRes = await ipcRenderer.invoke('capcut-asr-transcribe', {
        audioPath: localAudioUrl,
        options: { language: 'vi-VN', needWordTimestamp: true }
      });
      if (!asrRes.success) throw new Error(asrRes.error);
      
      const asrSegments = asrRes.segments;
      setSubtitles(asrSegments);
      onLog('Shopee', `Tách phụ đề thành công! Ghi nhận ${asrSegments.length} câu nói.`, 'success');

      // Stage 5: Download images to local system (for Remotion load)
      setLoadingStage('Đang tải và tối ưu hình ảnh sản phẩm về máy...');
      onLog('Shopee', 'Đang tải hình ảnh sản phẩm về thư mục cục bộ...', 'info');
      const localImages = [];
      for (let i = 0; i < numImages; i++) {
        const imgUrl = product.images[i];
        const dlRes = await ipcRenderer.invoke('download-image', { imageUrl: imgUrl });
        if (dlRes.success) {
          localImages.push(dlRes.filePath);
        } else {
          onLog('Shopee', `Lỗi tải ảnh ${i}: ${dlRes.error}`, 'error');
        }
      }
      onLog('Shopee', `Đã tải xuống ${localImages.length} hình ảnh cục bộ.`, 'success');

      // Stage 6: Calculate slide sequence timings
      // Find duration of the voiceover audio. Let's look at the end_time of the last ASR segment
      const lastWordSeg = asrSegments[asrSegments.length - 1];
      const audioDurationMs = lastWordSeg ? lastWordSeg.end_time : 10000;
      const audioDurationFrames = Math.ceil((audioDurationMs / 1000) * 30);

      // Now align slides to their corresponding image indices
      // We will map segments to slides. Since Gemini associated each segment with a specific "imageIndex",
      // we can map the timing of each segment directly to the display of that image!
      const computedSlides = [];
      let currentFrame = 0;

      scriptData.forEach((item, index) => {
        // Calculate sentence duration based on text length percentage or divide evenly
        // Let's divide audioDurationFrames based on word timing mapping!
        // We find the words in this sentence segment to get exact start and end frame.
        // If we just divide evenly for N segments:
        const segmentDurationFrames = Math.floor(audioDurationFrames / scriptData.length);
        
        computedSlides.push({
          imageUrl: localImages[item.imageIndex % localImages.length] || localImages[0],
          startFrame: currentFrame,
          durationFrames: index === scriptData.length - 1 
            ? (audioDurationFrames - currentFrame) 
            : segmentDurationFrames
        });
        currentFrame += segmentDurationFrames;
      });

      setSlides(computedSlides);
      onLog('Shopee', 'Đã đồng bộ hóa hình ảnh sản phẩm với âm thanh.', 'success');
      onLog('Shopee', 'Khởi tạo Video thành công! Bạn có thể xem trước.', 'success');

    } catch (err) {
      setError(err.message);
      onLog('Shopee', `Lỗi tạo video: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress({ percent: 0, message: 'Khởi chạy tiến trình kết xuất...' });
    onLog('Shopee', 'Bắt đầu tiến trình xuất video MP4...', 'info');

    // Handle progress updates from Electron
    const progressListener = (event, progress) => {
      setExportProgress(progress);
    };
    ipcRenderer.on('render-progress', progressListener);

    try {
      const inputProps = {
        slides,
        subtitles,
        audioUrl,
        bgMusicUrl: bgMusic,
        type: 'shopee',
        shopeeProps
      };

      const res = await ipcRenderer.invoke('remotion-render', {
        inputProps,
        compositionId: 'ShopeeVideo'
      });

      if (res.success) {
        onLog('Shopee', `Xuất video MP4 thành công! Lưu tại: ${res.filePath}`, 'success');
        alert(`Xuất video thành công! File lưu tại: ${res.filePath}`);
      } else {
        throw new Error(res.error);
      }
    } catch (e) {
      onLog('Shopee', `Lỗi xuất video: ${e.message}`, 'error');
      alert(`Lỗi xuất video: ${e.message}`);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
      ipcRenderer.removeListener('render-progress', progressListener);
    }
  };

  const handleSubtitleUpdate = (segmentIdx, wordIdx, newValue) => {
    const updatedSubtitles = [...subtitles];
    if (updatedSubtitles[segmentIdx] && updatedSubtitles[segmentIdx].words[wordIdx]) {
      updatedSubtitles[segmentIdx].words[wordIdx].text = newValue;
      
      // Also reconstruct the full text for the segment
      updatedSubtitles[segmentIdx].text = updatedSubtitles[segmentIdx].words
        .map(w => w.text)
        .join(' ');

      setSubtitles(updatedSubtitles);
      onLog('Editor', `Đã cập nhật từ tại câu ${segmentIdx + 1}: "${newValue}"`, 'info');
    }
  };

  return (
    <div className="tab-content">
      {/* Configuration Column */}
      <div className="workspace-left">
        <div className="glass-panel">
          <h2 style={{ fontSize: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShoppingBag size={20} style={{ color: 'var(--shpee-orange)' }} /> Tạo Video Shopee Review
          </h2>

          <div className="form-group">
            <label className="form-label">Liên kết sản phẩm Shopee</label>
            <input
              type="text"
              className="form-input"
              placeholder="Nhập link Shopee VN (ví dụ: https://shopee.vn/...)"
              value={shopeeLink}
              onChange={(e) => setShopeeLink(e.target.value)}
              disabled={loading}
            />
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Chọn Giọng Đọc</label>
              <select 
                className="form-input"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                disabled={loading}
              >
                <option value="vi-VN-HoaiMyNeural">Hoài My (Nữ tính, tràn đầy năng lượng - Khuyên dùng)</option>
                <option value="vi-VN-NamMinhNeural">Nam Minh (Nam tính, rõ ràng)</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Nhạc Nền</label>
              <select 
                className="form-input"
                value={bgMusic}
                onChange={(e) => setBgMusic(e.target.value)}
                disabled={loading}
              >
                <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3">Năng động sôi nổi 1</option>
                <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3">Thúc đẩy tươi vui 2</option>
                <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3">Hiphop vui tươi 3</option>
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={loading}
            style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, var(--shpee-orange) 0%, #ea580c 100%)', boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)' }}
          >
            {loading ? (
              <>
                <Loader size={18} className="spin" style={{ marginRight: 8 }} />
                <span>{loadingStage}</span>
              </>
            ) : (
              'Bắt đầu Tạo Video AI Shopee'
            )}
          </button>

          {error && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: 13, background: 'rgba(239, 68, 68, 0.08)', padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Preview Player & Subtitle Editor Column */}
      <div className="workspace-right">
        <VideoPlayerPanel 
          slides={slides}
          subtitles={subtitles}
          audioUrl={audioUrl}
          bgMusicUrl={bgMusic}
          type="shopee"
          shopeeProps={shopeeProps}
          onSubtitleUpdate={handleSubtitleUpdate}
          onExport={handleExport}
          isExporting={isExporting}
          exportProgress={exportProgress}
        />
      </div>
      <style>{`
        .spin {
          animation: spin 1.2s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
