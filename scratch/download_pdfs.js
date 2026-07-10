const fs = require('fs');
const path = require('path');
const axios = require('axios');

const pdfs = [
  {
    name: 'kinh-dia-tang.pdf',
    url: 'https://daotranglienhoa.com/wp-content/uploads/2020/05/Kinh-Dia-Tang-HT-Thich-Tri-Tinh.pdf'
  },
  {
    name: 'kinh-phap-hoa.pdf',
    url: 'https://daotranglienhoa.com/wp-content/uploads/2020/05/Kinh-Phap-Hoa-HT-Thich-Tri-Tinh.pdf'
  },
  {
    name: 'kinh-phap-cu.pdf',
    url: 'https://daotranglienhoa.com/wp-content/uploads/2020/05/Kinh-Phap-Cu-HT-Thich-Minh-Chau.pdf'
  },
  {
    name: 'kinh-kim-cang.pdf',
    url: 'https://daotranglienhoa.com/wp-content/uploads/2020/05/Kinh-Kim-Cang-HT-Thich-Tri-Tinh.pdf'
  },
  {
    name: 'kinh-a-di-da.pdf',
    url: 'https://daotranglienhoa.com/wp-content/uploads/2020/05/Kinh-A-Di-Da-HT-Thich-Tri-Tinh.pdf'
  },
  {
    name: 'buoc-dau-hoc-phat.pdf',
    url: 'https://thuvienhoasen.org/images/file/GKrurg03GkzWjACY/buoc-dau-hoc-phat.pdf'
  },
  {
    name: 'phat-hoc-pho-thong-khoa-1.pdf',
    url: 'https://thuvienhoasen.org/images/file/GcfriO7hhcJA-7O8/phat-hoc-pho-thong-khoa-1.pdf'
  }
];

const destDir = path.join(__dirname, '..', 'pdf_references');
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

async function download() {
  for (const item of pdfs) {
    const destPath = path.join(destDir, item.name);
    console.log(`Downloading ${item.name} from ${item.url}...`);
    try {
      const response = await axios({
        url: item.url,
        method: 'GET',
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const writer = fs.createWriteStream(destPath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      console.log(`Successfully downloaded ${item.name}`);
    } catch (err) {
      console.error(`Failed to download ${item.name}: ${err.message}`);
    }
  }
}

download();
