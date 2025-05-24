const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');

// Ortam değişkenlerini yükle
dotenv.config();

// Express uygulamasını oluştur
const app = express();

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

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
});