import React, { useState, useEffect } from 'react';
import { Compass, Loader, AlertTriangle, BookOpen, Sun, Wind, Type, FileText, Upload, Layers } from 'lucide-react';
import VideoPlayerPanel from './VideoPlayerPanel';

const { ipcRenderer } = window.require('electron');

const CURATED_SCRIPTURES = [
  {
    title: "Kinh Địa Tạng Bồ Tát Bổn Nguyện (Bản dịch HT. Thích Trí Tịnh)",
    desc: "Kinh về hiếu đạo, công đức độ sinh cứu khổ chúng sinh chốn u minh.",
    chapters: [
      {
        name: "Phẩm Thứ Nhất: Thần Thông Trên Cung Trời Đao Lợi (Lòng Hiếu Hạnh)",
        text: "Ta nghe như thế này: Một thuở nọ, tại cung trời Đao Lợi, Đức Phật vì Thánh Mẫu mà thuyết pháp. Lúc đó, tất cả chư Phật và đại Bồ Tát trong vô lượng thế giới đều đến hội họp. Đức Phật khen ngợi Bồ Tát Địa Tạng đã từ lâu xa lập nguyện lớn độ thoát tất cả chúng sinh đau khổ. Bồ Tát Địa Tạng phát lời thệ nguyện vĩ đại: 'Địa ngục vị không, thệ bất thành Phật; chúng sinh độ tận, phương chứng Bồ Đề.' Nghĩa là địa ngục chưa trống rỗng, ta thề chưa thành Phật; độ hết chúng sinh đau khổ mới chứng quả Bồ Đề. Lòng hiếu hạnh của Ngài là tấm gương sáng soi cho trời người học tập."
      },
      {
        name: "Phẩm Thứ Ba: Quán Chúng Sinh Nghiệp Duyên (Nhân quả địa ngục)",
        text: "Bà Ma Da Phu Nhân chắp tay hỏi Bồ Tát Địa Tạng về quả báo ác nghiệp ở thế gian. Bồ Tát đáp: 'Những kẻ bất hiếu với cha mẹ, hủy báng Tam Bảo, tạo các ác nghiệp sát sinh, trộm cắp, vọng ngữ, khi thác xuống sẽ đọa vào ngục Vô Gián. Ở ngục này, một người chịu khổ cũng chật ngục, muôn người chịu khổ cũng chật ngục. Thời gian chịu tội kéo dài vô số kiếp, chịu đủ mọi sự thiêu đốt hành hạ không một giây phút hưu息. Nghiệp lực vô hình dẫn dắt chúng sinh thọ quả báo tương xứng, tơ hào không sai chạy. Vì vậy chúng sinh phải cẩn trọng giữ gìn thân khẩu ý lành.'"
      }
    ]
  },
  {
    title: "Kinh Diệu Pháp Liên Hoa (Kinh Pháp Hoa - HT. Thích Trí Tịnh dịch)",
    desc: "Vua của các kinh điển Đại Thừa, khai mở Phật tánh tự thân.",
    chapters: [
      {
        name: "Phẩm Thứ Hai: Phương Tiện (Khai mở tri kiến Phật)",
        text: "Đức Phật từ chánh định an lành thức dậy, bảo ngài Xá Lợi Phất: 'Trí tuệ của các đức Phật rất sâu vô lượng, khó hiểu khó vào. Sở dĩ chư Phật xuất hiện ở đời là vì một đại sự nhân duyên duy nhất: Khai thị ngộ nhập tri kiến Phật cho chúng sinh. Nghĩa là mở bày, chỉ rõ cho chúng sinh ngộ được và đi vào tri kiến thanh tịnh của tự tánh Phật sẵn có nơi mình. Chư Phật chỉ dùng một Phật Thừa duy nhất để hóa độ, không có hai cũng không có ba. Các pháp phương tiện khác đều chỉ là nấc thang dẫn dắt chúng sinh tiến tới nhất thừa thanh tịnh.'"
      },
      {
        name: "Phẩm Thứ Hai Mươi Lăm: Quán Thế Âm Bồ Tát Phổ Môn (Cứu Khổ Cứu Nạn)",
        text: "Lúc bấy giờ, Vô Tận Ý Bồ Tát bạch Phật: 'Bạch Thế Tôn, Bồ Tát Quán Thế Âm vì nhân duyên gì tên là Quán Thế Âm?' Phật bảo: 'Chúng sinh chịu các khổ não, nghe danh hiệu Bồ Tát Quán Thế Âm, một lòng xưng danh, Bồ Tát tức thời quán xét âm thanh kia, đều được giải thoát. Nếu có người rơi vào lửa dữ, xưng danh hiệu Ngài lửa chẳng cháy được; rơi vào nước lớn, xưng danh hiệu Ngài liền được đến chỗ cạn. Bồ Tát dùng sức thần thông diệu dụng cứu khổ cứu nạn cứu độ trời người, hiện ba mươi hai hóa thân tùy duyên độ chúng sinh.'"
      }
    ]
  },
  {
    title: "Kinh Pháp Cú (Dhammapada - Bản dịch HT. Thích Minh Châu)",
    desc: "423 câu thi kệ ngắn gọn chứa đựng tinh hoa triết lý giải thoát.",
    chapters: [
      {
        name: "Phẩm Song Yếu (Ý dẫn đầu các pháp)",
        text: "Ý dẫn đầu các pháp. Ý làm chủ, ý tạo. Nếu với ý ô nhiễm, nói năng hay hành động, khổ não bước theo sau, như xe chân vật kéo. Ý dẫn đầu các pháp. Ý làm chủ, ý tạo. Nếu với ý thanh tịnh, nói năng hay hành động, an lạc bước theo sau, như bóng không rời hình. Kẻ thù hại kẻ thù, hay oan gia hại nhau, không bằng tâm hướng ác, gây ác nghiệp cho mình. Mẹ cha hay bà con, không làm được việc gì, bằng tâm hướng lương thiện, đưa ta tới an vui."
      },
      {
        name: "Phẩm Không Phóng Dật (Tỉnh giác và tự chế)",
        text: "Không phóng dật là đường sống, phóng dật là đường chết. Người không phóng dật không chết, kẻ phóng dật như đã chết. Biết rõ điều này, người trí không phóng dật, hoan hỷ trong không phóng dật, an vui cõi thánh nhân. Bằng nỗ lực, tỉnh giác, tự chế và giữ giới, người trí tự xây dựng, hòn đảo nước không chìm. Hãy vui trong chánh niệm, tự bảo vệ tâm mình. Hãy tự kéo mình lên khỏi vũng bùn đau khổ."
      }
    ]
  },
  {
    title: "Kinh Kim Cang Bát Nhã Ba La Mật (HT. Thích Trí Tịnh dịch)",
    desc: "Kinh điển luận giải về Tính Không và trí tuệ vô trụ bám chấp.",
    chapters: [
      {
        name: "Phần Ưng Vô Sở Trụ (Tâm không dính mắc hình tướng)",
        text: "Đức Phật bảo ngài Tu Bồ Đề: 'Các vị đại Bồ Tát nên như thế này mà phát tâm thanh tịnh: Không nên trụ vào sắc sinh tâm, không nên trụ vào thanh, hương, vị, xúc, pháp sinh tâm. Nên không có chỗ trụ mà sinh tâm đó (Ưng vô sở trụ nhi sinh kỳ tâm). Tất cả các tướng đều là hư vọng. Nếu thấy các tướng chẳng phải là tướng, tức là thấy Như Lai. Phàm sở hữu tướng, giai thị hư vọng. Nhược kiến chư tướng phi tướng, tức kiến Như Lai. Người hành giả không dính mắc vào hình tướng thì tự đạt đến bờ giải thoát.'"
      },
      {
        name: "Phần Quán Chiếu Hữu Vi (Vạn pháp mộng huyễn vô thường)",
        text: "Tất cả pháp hữu vi, như mộng, huyễn, bọt, bóng. Như sương sa, điện chớp, nên quán chiếu như thế. (Nhất thiết hữu vi pháp, như mộng huyễn bào ảnh, như lộ diệc như điện, ưng tác như thị quán). Thế giới vật chất và các hiện tượng sinh diệt đều giả tạm, biến đổi không ngừng như giấc mơ, như bọt nước trên dòng sông, như giọt sương buổi sáng dễ tan. Nhận chân được tính vô thường của vạn vật giúp tâm hành giả buông bỏ bám chấp, đạt đến bình an tự tại."
      }
    ]
  },
  {
    title: "Kinh A Di Đà (Bản dịch HT. Thích Trí Tịnh)",
    desc: "Mô tả cõi Tây Phương Cực Lạc thanh tịnh trang nghiêm.",
    chapters: [
      {
        name: "Cảnh Giới Cực Lạc (Mô tả cõi tịnh độ trang nghiêm)",
        text: "Từ đây đi về hướng Tây quá mười muôn ức cõi Phật, có thế giới tên là Cực Lạc. Cõi đó có Đức Phật hiệu là A Di Đà hiện đang thuyết pháp. Cõi Cực Lạc có bảy lớp lan can, bảy lớp lưới giăng, bảy lớp hàng cây, đều bằng bốn chất báu bao bọc. Lại có ao bằng bảy chất báu, nước bát công đức tràn trề. Đáy ao thuần cát vàng trải làm đất. Hoa sen trong ao lớn như bánh xe, hoa sắc xanh ánh sáng xanh, sắc vàng ánh sáng vàng, sắc đỏ ánh sáng đỏ, sắc trắng ánh sáng trắng, hương vị thơm tho trong sạch trang nghiêm."
      }
    ]
  },
  {
    title: "Bước Đầu Học Phật (HT. Thích Thanh Từ soạn)",
    desc: "Cẩm nang hướng dẫn căn bản về luật nhân quả luân hồi.",
    chapters: [
      {
        name: "Quy Luật Nhân Quả (Gieo nhân lành gặt quả ngọt)",
        text: "Nhân là nguyên nhân, Quả là kết quả. Nhân quả là định luật khách quan điều khiển vạn vật. Muốn gặt quả ngọt phải gieo nhân lành. Gieo hạt cam được quả cam, gieo ác nghiệp chịu báo ứng đau khổ. Định luật nhân quả rất công bằng, không thiên vị ai, không thần linh nào can thiệp được. Người học Phật hiểu rõ nhân quả sẽ tự làm chủ cuộc đời mình, không làm điều ác nghiệp, siêng năng làm các việc thiện lành, tích đức hành thiện giúp đời."
      }
    ]
  },
  {
    title: "Phật Học Phổ Thông (HT. Thích Thiện Hoa soạn)",
    desc: "Giáo trình Phật giáo cơ bản về năm giới đạo đức trời người.",
    chapters: [
      {
        name: "Năm Giới Đạo Đức Căn Bản (Ngũ giới Phật tử tại gia)",
        text: "Ngũ giới là năm điều đạo đức căn bản của người Phật tử tại gia: Không sát sinh (bảo vệ sự sống), không trộm cướp (tôn trọng tài sản người khác), không tà dâm (giữ gìn hạnh phúc gia đình), không nói dối (tôn trọng sự thật), không uống rượu và dùng chất kích thích (giữ gìn sự sáng suốt của tâm trí). Thực hành năm giới này không chỉ đem lại bình an cho cá nhân mà còn xây dựng một xã hội hòa hợp, lương thiện và đầy lòng trắc ẩn thương yêu."
      }
    ]
  }
];

export default function BuddhistTab({ onLog }) {
  // Configuration
  const [numVideos, setNumVideos] = useState(1); // 1, 5, 10, 15
  const [selectedRefKey, setSelectedRefKey] = useState('free'); // free, local, or index of CURATED_SCRIPTURES
  const [selectedChapterIdx, setSelectedChapterIdx] = useState(0);

  const [sourceType, setSourceType] = useState('prompt'); // prompt, pdf
  const [topic, setTopic] = useState('Sự buông bỏ trong cuộc sống để tâm an nhiên, không tranh giành đố kỵ');
  const [voice, setVoice] = useState('vi-VN-NamMinhNeural');
  const [bgMusic, setBgMusic] = useState('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3');
  
  // Custom mechanisms states
  const [mood, setMood] = useState('nature');
  const [ambientSfx, setAmbientSfx] = useState('bell');
  const [particleType, setParticleType] = useState('dust');
  const [subtitleStyle, setSubtitleStyle] = useState('modern');

  // PDF local uploading states
  const [pdfFile, setPdfFile] = useState(null); // { name, path }
  const [pdfText, setPdfText] = useState('');
  const [pdfPagesCount, setPdfPagesCount] = useState(0);
  const [pdfStartPage, setPdfStartPage] = useState(1);
  const [pdfEndPage, setPdfEndPage] = useState(2);
  const [extractedExcerpt, setExtractedExcerpt] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  // Core status states
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState('');

  // Batch rendering logs
  const [batchLogs, setBatchLogs] = useState([]);
  const [currentBatchIdx, setCurrentBatchIdx] = useState(null);

  // Preview panel states
  const [slides, setSlides] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [audioUrl, setAudioUrl] = useState('');

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);

  // Approximate page slicer for local PDF parsing
  const extractPagesExcerpt = (fullText, totalPages, start, end) => {
    if (!fullText) return '';
    const cleanStart = Math.max(1, start);
    const cleanEnd = Math.max(cleanStart, end);

    const pages = fullText.split(/\x0c|\f/);
    if (pages.length >= totalPages - 1 && pages.length > 1) {
      const sliceStart = Math.max(0, cleanStart - 1);
      const sliceEnd = Math.min(pages.length, cleanEnd);
      return pages.slice(sliceStart, sliceEnd).join('\n').trim();
    }
    const charPerPage = Math.floor(fullText.length / (totalPages || 1));
    const startIndex = Math.max(0, (cleanStart - 1) * charPerPage);
    const endIndex = Math.min(fullText.length, cleanEnd * charPerPage);
    return fullText.substring(startIndex, endIndex).trim();
  };

  // Sync page range slices for uploaded PDFs
  useEffect(() => {
    if (selectedRefKey === 'local' && pdfText) {
      const excerpt = extractPagesExcerpt(pdfText, pdfPagesCount, pdfStartPage, pdfEndPage);
      setExtractedExcerpt(excerpt);
    }
  }, [pdfStartPage, pdfEndPage, pdfText, selectedRefKey]);

  // Sync pre-embedded scriptures text
  useEffect(() => {
    if (selectedRefKey !== 'free' && selectedRefKey !== 'local') {
      const bookIdx = parseInt(selectedRefKey);
      const book = CURATED_SCRIPTURES[bookIdx];
      if (book && book.chapters[selectedChapterIdx]) {
        setExtractedExcerpt(book.chapters[selectedChapterIdx].text);
      }
    }
  }, [selectedRefKey, selectedChapterIdx]);

  // Handle reference material change
  const handleRefMaterialChange = async (val) => {
    setSelectedRefKey(val);
    setSelectedChapterIdx(0);
    setError('');

    if (val === 'free') {
      setSourceType('prompt');
      setPdfFile(null);
      setPdfText('');
      setExtractedExcerpt('');
    } else if (val === 'local') {
      setSourceType('pdf');
      await handleLoadLocalPdf();
    } else {
      setSourceType('pdf');
      const bookIdx = parseInt(val);
      const book = CURATED_SCRIPTURES[bookIdx];
      if (book && book.chapters[0]) {
        setExtractedExcerpt(book.chapters[0].text);
        onLog('Buddhist', `Đã nạp tài liệu tích hợp: "${book.title}"`, 'success');
      }
    }
  };

  const handleLoadLocalPdf = async () => {
    setPdfLoading(true);
    setError('');
    try {
      const res = await ipcRenderer.invoke('open-pdf-dialog');
      if (!res.success) {
        setSelectedRefKey('free');
        setSourceType('prompt');
        if (res.error !== 'Cancelled') setError(res.error);
        return;
      }
      const filePath = res.filePath;
      onLog('Buddhist', `Đang giải mã file PDF cục bộ: ${filePath.split('\\').pop()}...`, 'info');
      
      const parseRes = await ipcRenderer.invoke('buddhist-parse-pdf', { filePath });
      if (!parseRes.success) throw new Error(parseRes.error);
      
      setPdfFile({ name: filePath.split('\\').pop(), path: filePath });
      setPdfText(parseRes.text);
      setPdfPagesCount(parseRes.numpages);
      setPdfStartPage(1);
      setPdfEndPage(Math.min(parseRes.numpages, 2));
      
      onLog('Buddhist', `Đọc PDF thành công! Gồm ${parseRes.numpages} trang.`, 'success');
    } catch (e) {
      setError(`Lỗi đọc file PDF: ${e.message}`);
      setSelectedRefKey('free');
      setSourceType('prompt');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (sourceType === 'prompt' && !topic) {
      setError('Vui lòng nhập ý tưởng chủ đề.');
      return;
    }
    if (sourceType === 'pdf' && !extractedExcerpt) {
      setError('Vui lòng chọn tài liệu tham khảo.');
      return;
    }

    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      setError('Vui lòng cấu hình Gemini API Key trong Tab Cấu Hình trước.');
      return;
    }

    setLoading(true);
    setError('');
    setBatchLogs([]);

    const totalToGenerate = numVideos;
    onLog('Buddhist', `Khởi chạy sản xuất hàng loạt ${totalToGenerate} video Phật pháp...`, 'info');

    try {
      for (let i = 0; i < totalToGenerate; i++) {
        setCurrentBatchIdx(i);
        const stagePrefix = `[Video ${i + 1}/${totalToGenerate}]`;
        onLog('Buddhist', `${stagePrefix} Bắt đầu khởi tạo...`, 'info');

        // 1. Gemini script generator
        setLoadingStage(`${stagePrefix} AI đang biên soạn kịch bản Phật pháp...`);
        const systemPrompt = `Bạn là một thiền sư hiền triết, am hiểu Phật Pháp sâu sắc. Hãy viết các câu triết lý sống bằng tiếng Việt mang tính thanh tịnh, chậm rãi, thư thái và bình yên. Trả về cấu trúc JSON bắt buộc.`;
        
        let moodVisualDetail = '';
        if (mood === 'temple') {
          moodVisualDetail = 'ancient misty temple, stone lanterns, slow rising incense smoke, warm golden morning sun, highly detailed vertical format';
        } else if (mood === 'nature') {
          moodVisualDetail = 'serene lush green bamboo forest, fresh morning dew drops, clear flowing stream water, slow zoom vertical format';
        } else if (mood === 'meditation') {
          moodVisualDetail = 'a dark silhouette of a Buddhist monk meditating peacefully under a giant bodhi tree, giant red sunset, absolute silence vertical format';
        } else if (mood === 'mystical') {
          moodVisualDetail = 'mystical glowing pink lotus flower floating on calm sacred water, galaxy stardust nebula night background, glowing rays vertical format';
        }

        let userPrompt = '';
        if (sourceType === 'prompt') {
          userPrompt = `Hãy viết một bài giảng thiền ngắn gọn (khoảng 80-100 từ) về chủ đề "${topic}". 
Đây là video số ${i + 1} trên tổng số ${totalToGenerate} video độc lập. Hãy viết kịch bản này khai thác một khía cạnh riêng biệt, hoàn toàn không trùng lặp ý tưởng với các video khác trong chuỗi.
Chia bài viết làm 4 phân đoạn. Với mỗi phân đoạn, hãy cung cấp một mô tả hình ảnh tiếng Anh chi tiết để tạo ảnh thiền định.
Hãy luôn kết hợp các phân cảnh hình ảnh với phong cách không gian trực quan sau: "${moodVisualDetail}".

Trả về duy nhất định dạng JSON có cấu trúc sau:
{
  "title": "${topic.substring(0, 20)} - Phần ${i + 1}",
  "script": [
    {
      "text": "Câu triết lý tiếng Việt (khoảng 20 từ, giọng điệu thiền tịnh chậm rãi)",
      "imagePrompt": "Mô tả ảnh tiếng Anh chi tiết tích hợp hoàn hảo với phong cách không gian được cung cấp"
    }
  ]
}`;
        } else {
          userPrompt = `Hãy viết một bài giảng thiền ngắn gọn (khoảng 80-100 từ) đúc kết các triết lý sâu sắc nhất từ tài liệu Phật pháp trích dẫn dưới đây:

NỘI DUNG TÀI LIỆU TRÍCH DẪN:
"""
${extractedExcerpt.substring(0, 1500)}
"""

Đây là video số ${i + 1} trên tổng số ${totalToGenerate} video. Hãy đúc kết một chủ đề, câu kệ hoặc bài học sâu sắc riêng biệt trong tài liệu trích dẫn để soạn bài giảng này, tránh trùng lặp nội dung với các video khác.
Hãy chia bài viết làm 4 phân đoạn ngắn gọn. Với mỗi phân đoạn cung cấp mô tả hình ảnh tiếng Anh chi tiết.
Hãy kết hợp hình ảnh với phong cách không gian sau: "${moodVisualDetail}".

Trả về duy nhất định dạng JSON có cấu trúc sau:
{
  "title": "Lời Phật Dạy - Tập ${i + 1}",
  "script": [
    {
      "text": "Câu triết lý tiếng Việt đúc kết từ tài liệu (khoảng 20 từ, chậm rãi)",
      "imagePrompt": "Mô tả ảnh tiếng Anh chi tiết tích hợp hoàn hảo với phong cách không gian được cung cấp"
    }
  ]
}`;
        }

        const geminiModel = localStorage.getItem('gemini_model') || 'gemini-3.1-flash-lite';
        const geminiRes = await ipcRenderer.invoke('gemini-generate', { apiKey, systemPrompt, userPrompt, geminiModel });
        if (!geminiRes.success) throw new Error(geminiRes.error);
        const generatedData = geminiRes.data.script;

        // 2. Synthesize Vocals
        setLoadingStage(`${stagePrefix} Đang lồng tiếng thiền sư...`);
        const fullText = generatedData.map(item => item.text).join(' ');
        const ttsRes = await ipcRenderer.invoke('edge-tts-synthesize', { 
          text: fullText, 
          options: { voice, rate: '-15%' }
        });
        if (!ttsRes.success) throw new Error(ttsRes.error);
        const localAudioUrl = ttsRes.filePath;

        // 3. Caption sync
        setLoadingStage(`${stagePrefix} Đang đồng bộ phụ đề karaoke...`);
        const asrRes = await ipcRenderer.invoke('capcut-asr-transcribe', {
          audioPath: localAudioUrl,
          options: { language: 'vi-VN', needWordTimestamp: true }
        });
        if (!asrRes.success) throw new Error(asrRes.error);
        const asrSegments = asrRes.segments;

        // 4. Image downloads
        setLoadingStage(`${stagePrefix} Đang kết xuất ảnh thiền AI...`);
        const localImages = [];
        for (let j = 0; j < generatedData.length; j++) {
          const rawPrompt = generatedData[j].imagePrompt;
          const formattedPrompt = `${rawPrompt}, vertical aspect ratio, vertical frame, 1080x1920, zen, ultra high resolution, digital art`;
          const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(formattedPrompt)}?width=1080&height=1920&nologo=true`;
          
          const dlRes = await ipcRenderer.invoke('download-image', { imageUrl: pollinationsUrl });
          if (dlRes.success) {
            localImages.push(dlRes.filePath);
          } else {
            localImages.push(localImages[0] || '');
          }
        }

        // 5. Slide mapping
        const lastWordSeg = asrSegments[asrSegments.length - 1];
        const audioDurationMs = lastWordSeg ? lastWordSeg.end_time : 15000;
        const audioDurationFrames = Math.ceil((audioDurationMs / 1000) * 30);

        const computedSlides = [];
        let currentFrame = 0;
        const segmentDurationFrames = Math.floor(audioDurationFrames / generatedData.length);

        generatedData.forEach((item, idx) => {
          computedSlides.push({
            imageUrl: localImages[idx % localImages.length] || localImages[0],
            startFrame: currentFrame,
            durationFrames: idx === generatedData.length - 1 
              ? (audioDurationFrames - currentFrame) 
              : segmentDurationFrames
          });
          currentFrame += segmentDurationFrames;
        });

        // Update preview panel states
        setSlides(computedSlides);
        setSubtitles(asrSegments);
        setAudioUrl(localAudioUrl);

        onLog('Buddhist', `${stagePrefix} Tạo thành công cấu trúc video!`, 'success');

        // 6. Bulk compilation to MP4 file
        if (totalToGenerate > 1) {
          setLoadingStage(`${stagePrefix} Đang lưu video thành tệp MP4...`);
          onLog('Buddhist', `${stagePrefix} Đang kết xuất video MP4 tự động...`, 'info');

          const inputProps = {
            slides: computedSlides,
            subtitles: asrSegments,
            audioUrl: localAudioUrl,
            bgMusicUrl: bgMusic,
            type: 'buddhist',
            shopeeProps: {
              ambientSfx,
              particleType,
              subtitleStyle
            }
          };

          const renderRes = await ipcRenderer.invoke('remotion-render', {
            inputProps,
            compositionId: 'BuddhistVideo'
          });

          if (renderRes.success) {
            setBatchLogs(prev => [...prev, { success: true, path: renderRes.filePath }]);
            onLog('Buddhist', `${stagePrefix} Kết xuất MP4 thành công! File: ${renderRes.filePath}`, 'success');
          } else {
            setBatchLogs(prev => [...prev, { success: false, error: renderRes.error }]);
            onLog('Buddhist', `${stagePrefix} Lỗi kết xuất MP4: ${renderRes.error}`, 'error');
          }
        }
      }

      if (totalToGenerate > 1) {
        onLog('Buddhist', `Sản xuất hàng loạt hoàn thành! Số lượng: ${totalToGenerate} video.`, 'success');
        alert(`Đã hoàn tất sản xuất hàng loạt ${totalToGenerate} video!\nTất cả tệp MP4 đã được lưu trữ trong thư mục tạm.`);
      } else {
        onLog('Buddhist', `Khởi tạo video Phật pháp thành công! Bấm 'Xuất Video MP4' ở bên phải để lưu.`, 'success');
      }

    } catch (err) {
      setError(err.message);
      onLog('Buddhist', `Lỗi: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setLoadingStage('');
      setCurrentBatchIdx(null);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress({ percent: 0, message: 'Khởi chạy kết xuất video Phật pháp...' });
    onLog('Buddhist', 'Bắt đầu kết xuất video MP4 thành phẩm...', 'info');

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
        type: 'buddhist',
        shopeeProps: {
          ambientSfx,
          particleType,
          subtitleStyle
        }
      };

      const res = await ipcRenderer.invoke('remotion-render', {
        inputProps,
        compositionId: 'BuddhistVideo'
      });

      if (res.success) {
        onLog('Buddhist', `Kết xuất video thành công! File: ${res.filePath}`, 'success');
        alert(`Xuất video thành công! File lưu tại: ${res.filePath}`);
      } else {
        throw new Error(res.error);
      }
    } catch (e) {
      onLog('Buddhist', `Lỗi xuất video: ${e.message}`, 'error');
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
      updatedSubtitles[segmentIdx].text = updatedSubtitles[segmentIdx].words
        .map(w => w.text)
        .join(' ');
      setSubtitles(updatedSubtitles);
      onLog('Editor', `Cập nhật từ phụ đề: "${newValue}"`, 'info');
    }
  };

  return (
    <div className="tab-content">
      {/* Input panel */}
      <div className="workspace-left">
        <div className="glass-panel">
          <h2 style={{ fontSize: 18, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Compass size={20} style={{ color: 'var(--success)' }} /> Sản Xuất Video Phật Pháp Hàng Loạt
          </h2>

          {/* 1. Batch Quantity Selector */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={14} /> Số lượng video muốn sản xuất hàng loạt
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[1, 5, 10, 15].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setNumVideos(num)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: numVideos === num ? 'var(--success)' : 'var(--bg-surface-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    color: numVideos === num ? '#fff' : 'var(--text-primary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 13,
                    transition: 'all 200ms'
                  }}
                >
                  {num} Video{num > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Unified Reference Materials Dropdown Selector */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BookOpen size={14} /> Chọn tài liệu Kinh điển Phật Pháp
            </label>
            <select
              className="form-input"
              value={selectedRefKey}
              onChange={(e) => handleRefMaterialChange(e.target.value)}
              disabled={loading || pdfLoading}
            >
              <option value="free">✍️ Ý tưởng tự do (Không dùng tài liệu, tự gõ chủ đề)</option>
              <option value="local">📂 Nạp tệp PDF cục bộ từ máy tính của bạn...</option>
              <optgroup label="Tủ Sách Kinh Điển Phật Giáo Tích Hợp Sẵn (Chạy Offline 100%)">
                {CURATED_SCRIPTURES.map((item, idx) => (
                  <option key={idx} value={idx}>
                    📖 {item.title}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Chapter select dropdown (only show if integrated book selected) */}
          {selectedRefKey !== 'free' && selectedRefKey !== 'local' && (
            <div className="form-group">
              <label className="form-label">Chọn Chương / Phân đoạn Kinh</label>
              <select
                className="form-input"
                value={selectedChapterIdx}
                onChange={(e) => setSelectedChapterIdx(parseInt(e.target.value))}
                disabled={loading}
              >
                {CURATED_SCRIPTURES[parseInt(selectedRefKey)]?.chapters.map((ch, idx) => (
                  <option key={idx} value={idx}>
                    📌 {ch.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Prompt free text input */}
          {selectedRefKey === 'free' && (
            <div className="form-group">
              <label className="form-label">Chủ đề bài giảng chi tiết (Gõ ý tưởng tự do)</label>
              <input
                type="text"
                className="form-input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading}
                placeholder="Nhập chủ đề triết lý..."
              />
            </div>
          )}

          {/* Excerpt text box (shows read-only preview of selected/parsed text) */}
          {selectedRefKey !== 'free' && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)' }}>
                  📄 Tài liệu tham khảo đang dùng:
                </span>
                {selectedRefKey === 'local' && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Tổng: {pdfPagesCount} trang
                  </span>
                )}
              </div>

              {selectedRefKey === 'local' && (
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Từ trang:</span>
                    <input 
                      type="number" 
                      min="1" 
                      max={pdfPagesCount} 
                      value={pdfStartPage}
                      onChange={(e) => setPdfStartPage(parseInt(e.target.value) || 1)}
                      style={{ width: 60, padding: 6, background: 'var(--bg-dark)', border: '1px solid var(--border)', borderRadius: 8, color: '#fff', fontSize: 12 }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Đến trang:</span>
                    <input 
                      type="number" 
                      min={pdfStartPage} 
                      max={pdfPagesCount} 
                      value={pdfEndPage}
                      onChange={(e) => setPdfEndPage(parseInt(e.target.value) || pdfStartPage)}
                      style={{ width: 60, padding: 6, background: 'var(--bg-dark)', border: '1px solid var(--border)', borderRadius: 8, color: '#fff', fontSize: 12 }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea
                  className="form-input"
                  value={extractedExcerpt}
                  readOnly
                  style={{ height: 100, fontSize: 11, background: 'var(--bg-dark)', resize: 'none', padding: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}
                  placeholder="Không có dữ liệu trích xuất."
                />
              </div>
            </div>
          )}

          {pdfLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, color: 'var(--success)', fontSize: 13, marginBottom: 20 }}>
              <Loader size={16} className="spin" /> Đang giải mã file PDF của bạn...
            </div>
          )}

          {/* Visual configurations */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sun size={14} /> Không gian (Visual Mood)
              </label>
              <select 
                className="form-input"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                disabled={loading}
              >
                <option value="nature">Trúc xanh & Suối chảy (Serene Nature)</option>
                <option value="temple">Chùa cổ & Khói sương (Ancient Temple)</option>
                <option value="meditation">Nhà sư & Bóng hoàng hôn (Bodhi Meditation)</option>
                <option value="mystical">Hồ sen phát sáng (Mystical Zen)</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Type size={14} /> Kiểu chữ phụ đề
              </label>
              <select 
                className="form-input"
                value={subtitleStyle}
                onChange={(e) => setSubtitleStyle(e.target.value)}
                disabled={loading}
              >
                <option value="modern">Hiện đại (TikTok Karaoke nằm ngang)</option>
                <option value="calligraphy">Cổ kính (Thư pháp cuộn chạy dọc)</option>
              </select>
            </div>
          </div>

          {/* Audio ambient and particle selections */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wind size={14} /> Âm thanh hòa âm (Ambient SFX)
              </label>
              <select 
                className="form-input"
                value={ambientSfx}
                onChange={(e) => setAmbientSfx(e.target.value)}
                disabled={loading}
              >
                <option value="bell">Chuông chùa & Gõ mõ ngân vang</option>
                <option value="stream">Tiếng suối chảy róc rách</option>
                <option value="rain">Tiếng mưa rơi nhẹ rừng trúc</option>
                <option value="none">Không có âm thanh ngầm</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Hiệu ứng hạt bay (Particles)</label>
              <select 
                className="form-input"
                value={particleType}
                onChange={(e) => setParticleType(e.target.value)}
                disabled={loading}
              >
                <option value="dust">Bụi vàng thiền định lấp lánh</option>
                <option value="lotus">Cánh hoa sen rơi lơ lửng</option>
                <option value="rays">Tia nắng mặt trời lung linh</option>
                <option value="none">Không dùng hiệu ứng hạt</option>
              </select>
            </div>
          </div>

          {/* Voice configuration */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Giọng thiền sư</label>
              <select 
                className="form-input"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                disabled={loading}
              >
                <option value="vi-VN-NamMinhNeural">Nam Minh (Giọng nam trầm ấm - Khuyên dùng)</option>
                <option value="vi-VN-HoaiMyNeural">Hoài My (Giọng nữ chậm rãi, nhẹ nhàng)</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Nhạc nền (Zen Music)</label>
              <select 
                className="form-input"
                value={bgMusic}
                onChange={(e) => setBgMusic(e.target.value)}
                disabled={loading}
              >
                <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3">Thiền tịch thanh tao 1</option>
                <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3">Suối thiền tĩnh tâm 2</option>
                <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3">Chuông chùa an nhiên 3</option>
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={loading || pdfLoading}
            style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, var(--success) 0%, #15803d 100%)', boxShadow: '0 4px 15px rgba(34, 197, 94, 0.25)' }}
          >
            {loading ? (
              <>
                <Loader size={18} className="spin" style={{ marginRight: 8 }} />
                <span>{loadingStage}</span>
              </>
            ) : (
              `Bắt đầu Sản xuất Hàng loạt (${numVideos} Video)`
            )}
          </button>

          {/* Batch Logs Display */}
          {batchLogs.length > 0 && (
            <div style={{ marginTop: 20, background: 'rgba(0,0,0,0.2)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
              <strong style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                BÁO CÁO SẢN XUẤT HÀNG LOẠT:
              </strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 100, overflowY: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                {batchLogs.map((log, idx) => (
                  <div key={idx} style={{ color: log.success ? 'var(--success)' : '#ef4444' }}>
                    {log.success 
                      ? `✓ Video ${idx + 1}: Thành công -> ${log.path.split('/').pop() || log.path.split('\\').pop()}` 
                      : `✗ Video ${idx + 1}: Thất bại -> ${log.error}`
                    }
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontSize: 13, background: 'rgba(239, 68, 68, 0.08)', padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Video Panel */}
      <div className="workspace-right">
        <VideoPlayerPanel 
          slides={slides}
          subtitles={subtitles}
          audioUrl={audioUrl}
          bgMusicUrl={bgMusic}
          type="buddhist"
          shopeeProps={{
            ambientSfx,
            particleType,
            subtitleStyle
          }}
          onSubtitleUpdate={handleSubtitleUpdate}
          onExport={handleExport}
          isExporting={isExporting}
          exportProgress={exportProgress}
        />
      </div>
    </div>
  );
}
