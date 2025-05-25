const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const https = require('https'); // HTTPS modülü eklendi
const fs = require('fs'); // Dosya sistemi modülü eklendi

// Ortam değişkenlerini yükle
dotenv.config();

// Express uygulamasını oluştur
const app = express();

// CORS middleware (herkese izin ver)
app.use(cors());

// Middleware
app.use(express.json());

// Veritabanı bağlantısı
connectDB();

// Routes
app.use('/api', userRoutes);

// Hata yakalama middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Sunucu hatası!' });
});

// SSL sertifikası ve anahtarını oku
const options = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert'),
};

// HTTPS sunucusunu başlat
const PORT = process.env.PORT || 3000;
https.createServer(options, app).listen(PORT, "0.0.0.0", () => {
  console.log(`HTTPS sunucusu ${PORT} portunda çalışıyor`);
});
