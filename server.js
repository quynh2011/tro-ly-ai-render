// --- Import các thư viện cần thiết ---
const express = require("express");
const cors = require("cors");
const multer = require("multer");

// --- Khởi tạo ứng dụng Express ---
const app = express();

// --- Cấu hình Middleware ---
app.use(cors()); 
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// --- MÔ PHỎNG KẾT QUẢ TỪ AI ---
const MOCK_TRANSCRIPTION_FROM_FILE = "Đây là văn bản được AI 'dịch' từ file bạn đã tải lên. Quá trình xử lý trên máy chủ đã thành công!";
const MOCK_TRANSCRIPTION_FROM_LINK = "Đây là văn bản được AI 'dịch' từ liên kết. Máy chủ đã nhận và xử lý link thành công!";

// --- Định nghĩa các API Endpoint ---
app.post("/transcribe-file", upload.single("mediafile"), (req, res) => {
  console.log("Đã nhận được file:", req.file.originalname);
  setTimeout(() => {
    res.json({ transcription: MOCK_TRANSCRIPTION_FROM_FILE });
  }, 3000);
});

app.post("/transcribe-from-link", (req, res) => {
  const { url } = req.body;
  console.log("Đã nhận được link:", url);
  if (!url) {
    return res.status(400).json({ message: "Không tìm thấy URL trong yêu cầu." });
  }
  setTimeout(() => {
    res.json({ transcription: MOCK_TRANSCRIPTION_FROM_LINK });
  }, 3000);
});

// --- Khởi động máy chủ ---
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Máy chủ của bạn đang lắng nghe tại cổng " + listener.address().port);
});
