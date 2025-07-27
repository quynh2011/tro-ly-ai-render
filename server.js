// --- Import các thư viện cần thiết ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const OpenAI = require('openai');
const axios = require('axios');
const stream = require('stream');
const { promisify } = require('util');

// --- Cấu hình ---
const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const pipeline = promisify(stream.pipeline);

// --- Cấu hình CORS chi tiết ---
// Danh sách các tên miền được phép truy cập máy chủ
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

// --- Hàm xử lý chính ---

async function transcribeAudio(audioBuffer, originalname) {
  const audioStream = new stream.Readable();
  audioStream.push(audioBuffer);
  audioStream.push(null); 
  audioStream.path = originalname;

  console.log('Bắt đầu gửi file đến OpenAI Whisper...');
  const transcription = await openai.audio.transcriptions.create({
    file: audioStream,
    model: 'whisper-1',
  });
  console.log('OpenAI đã xử lý xong.');

  return transcription.text;
}

// --- Định nghĩa các API Endpoint ---

app.post('/transcribe-file', upload.single('mediafile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Không có file nào được tải lên.' });
    }
    console.log(`Đã nhận file: ${req.file.originalname}`);
    const transcriptText = await transcribeAudio(req.file.buffer, req.file.originalname);
    res.json({ transcription: transcriptText });
  } catch (error) {
    console.error('Lỗi khi xử lý file:', error.message);
    res.status(500).json({ message: 'Đã có lỗi xảy ra phía máy chủ khi xử lý file.' });
  }
});

app.post('/transcribe-from-link', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ message: 'Không tìm thấy URL trong yêu cầu.' });
  }

  try {
    console.log(`Đang tải file từ link: ${url}`);
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const audioBuffer = Buffer.from(response.data);
    const filename = url.split('/').pop().split('?')[0] || 'audio.mp3';

    const transcriptText = await transcribeAudio(audioBuffer, filename);
    res.json({ transcription: transcriptText });
  } catch (error) {
    console.error('Lỗi khi xử lý link:', error.message);
    res.status(500).json({ message: 'Không thể tải hoặc xử lý file từ link được cung cấp.' });
  }
});


// --- Khởi động máy chủ ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Máy chủ đang lắng nghe tại cổng ${PORT}`);
});
