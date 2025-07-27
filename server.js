// --- Import các thư viện cần thiết ---
require('dotenv').config(); // Để đọc biến môi trường từ file .env (khi chạy local)
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const OpenAI = require('openai');
const axios = require('axios');
const stream = require('stream');
const { promisify } = require('util');

// --- Cấu hình ---
const app = express();
const upload = multer({ storage: multer.memoryStorage() }); // Lưu file vào bộ nhớ RAM
const pipeline = promisify(stream.pipeline);

// --- Khởi tạo OpenAI Client ---
// Rất quan trọng: Lấy API Key từ biến môi trường, không bao giờ viết trực tiếp vào code.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Cấu hình Middleware ---
app.use(cors());
app.use(express.json());

// --- Hàm xử lý chính ---

/**
 * Hàm này nhận một buffer file âm thanh và gửi đến OpenAI Whisper để xử lý.
 * @param {Buffer} audioBuffer - Dữ liệu file âm thanh.
 * @param {string} originalname - Tên file gốc để OpenAI biết định dạng.
 * @returns {Promise<string>} - Văn bản đã được chuyển đổi.
 */
async function transcribeAudio(audioBuffer, originalname) {
  // OpenAI cần file được gửi dưới dạng stream, chúng ta tạo một stream từ buffer
  const audioStream = new stream.Readable();
  audioStream.push(audioBuffer);
  audioStream.push(null); 
  
  // Gán tên file cho stream để OpenAI nhận dạng được định dạng (mp3, wav, mp4...)
  audioStream.path = originalname;

  console.log('Bắt đầu gửi file đến OpenAI Whisper...');
  const transcription = await openai.audio.transcriptions.create({
    file: audioStream,
    model: 'whisper-1', // Sử dụng model Whisper-1
  });
  console.log('OpenAI đã xử lý xong.');

  return transcription.text;
}

// --- Định nghĩa các API Endpoint ---

// API để xử lý file tải lên từ máy tính
app.post('/transcribe-file', upload.single('mediafile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Không có file nào được tải lên.' });
    }
    console.log(`Đã nhận file: ${req.file.originalname}`);
    const transcriptText = await transcribeAudio(req.file.buffer, req.file.originalname);
    res.json({ transcription: transcriptText });
  } catch (error) {
    console.error('Lỗi khi xử lý file:', error);
    res.status(500).json({ message: 'Đã có lỗi xảy ra phía máy chủ.' });
  }
});

// API để xử lý link (chỉ hoạt động với link tải trực tiếp)
app.post('/transcribe-from-link', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ message: 'Không tìm thấy URL trong yêu cầu.' });
  }

  try {
    console.log(`Đang tải file từ link: ${url}`);
    // Tải file từ URL về dưới dạng buffer
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const audioBuffer = Buffer.from(response.data);
    
    // Lấy tên file từ URL để xác định định dạng
    const filename = url.split('/').pop().split('?')[0] || 'audio.mp3';

    const transcriptText = await transcribeAudio(audioBuffer, filename);
    res.json({ transcription: transcriptText });
  } catch (error) {
    console.error('Lỗi khi xử lý link:', error);
    res.status(500).json({ message: 'Không thể tải hoặc xử lý file từ link được cung cấp.' });
  }
});


// --- Khởi động máy chủ ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Máy chủ đang lắng nghe tại cổng ${PORT}`);
});
