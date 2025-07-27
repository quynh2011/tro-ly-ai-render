// --- Import các thư viện cần thiết ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const OpenAI = require('openai');
const axios = require('axios');
const stream = require('stream');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');

// --- Cấu hình ---
const app = express();
// Cấu hình multer để lưu file tạm thời xuống ổ đĩa thay vì vào bộ nhớ
const upload = multer({ dest: os.tmpdir() });
const pipeline = promisify(stream.pipeline);

// --- Cấu hình CORS chi tiết ---
const allowedOrigins = [
  'https://quynh2011.github.io', // Link GitHub Pages của bạn
  // Bạn có thể thêm các link khác ở đây nếu cần, ví dụ: 'http://localhost:3000' để test ở máy
];

const corsOptions = {
  origin: function (origin, callback) {
    // Nếu request không có origin (ví dụ: từ Postman) hoặc origin nằm trong danh sách cho phép
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200
};

// Sử dụng middleware CORS với cấu hình đã tạo
app.use(cors(corsOptions));

// --- Khởi tạo OpenAI Client ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Cấu hình Middleware khác ---
app.use(express.json());

// --- Định nghĩa các API Endpoint ---

app.post('/transcribe-file', upload.single('mediafile'), async (req, res) => {
  let tempFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Không có file nào được tải lên.' });
    }
    // Lấy đường dẫn của file tạm đã được multer lưu lại
    tempFilePath = req.file.path;
    console.log(`Đã nhận file và lưu tạm tại: ${tempFilePath}`);

    console.log('Bắt đầu gửi file đến OpenAI Whisper...');
    const transcription = await openai.audio.transcriptions.create({
      // Tạo một luồng đọc từ file tạm và gửi đi
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
    });
    console.log('OpenAI đã xử lý xong.');

    res.json({ transcription: transcription.text });
  } catch (error) {
    console.error('Lỗi khi xử lý file:', error.message);
    res.status(500).json({ message: 'Đã có lỗi xảy ra phía máy chủ khi xử lý file.' });
  } finally {
    // Luôn luôn dọn dẹp file tạm sau khi xử lý xong (dù thành công hay thất bại)
    if (tempFilePath) {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error(`Lỗi khi xóa file tạm: ${tempFilePath}`, err);
        else console.log(`Đã xóa file tạm: ${tempFilePath}`);
      });
    }
  }
});

app.post('/transcribe-from-link', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ message: 'Không tìm thấy URL trong yêu cầu.' });
  }

  let tempFilePath = null;
  try {
    console.log(`Đang tải file từ link: ${url}`);
    
    // Tạo một đường dẫn file tạm
    const filename = url.split('/').pop().split('?')[0] || 'audio.tmp';
    tempFilePath = path.join(os.tmpdir(), `${Date.now()}-${filename}`);

    // Tải file từ link bằng cách stream thẳng vào file tạm trên ổ đĩa
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
    });
    await pipeline(response.data, fs.createWriteStream(tempFilePath));
    console.log(`Đã tải file từ link và lưu tạm tại: ${tempFilePath}`);

    // Bắt đầu chuyển đổi file từ đường dẫn tạm
    console.log('Bắt đầu gửi file đến OpenAI Whisper...');
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
    });
    console.log('OpenAI đã xử lý xong.');

    res.json({ transcription: transcription.text });

  } catch (error) {
    console.error('Lỗi khi xử lý link:', error.message);
    res.status(500).json({ message: 'Không thể tải hoặc xử lý file từ link được cung cấp.' });
  } finally {
    // Luôn luôn dọn dẹp file tạm
    if (tempFilePath) {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error(`Lỗi khi xóa file tạm: ${tempFilePath}`, err);
        else console.log(`Đã xóa file tạm: ${tempFilePath}`);
      });
    }
  }
});


// --- Khởi động máy chủ ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Máy chủ đang lắng nghe tại cổng ${PORT}`);
});
