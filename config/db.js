const mongoose = require('mongoose');
const { User } = require('../models/userModel'); // Model dosyanızın yolu
const bcrypt = require('bcrypt');

const initializeSuperAdmin = async () => {
  try {
    // Superadmin var mı kontrol et
    const superAdminExists = await User.findOne({ role: 'superadmin' });
    if (superAdminExists) {
      console.log('Superadmin zaten mevcut:', superAdminExists.email);
      return;
    }

    // Superadmin yoksa oluştur
    const hashedPassword = await bcrypt.hash(
      process.env.SUPERADMIN_PASSWORD || 'superadmin123', // Varsayılan veya .env'den
      10
    );
    const superAdmin = new User({
      email: process.env.SUPERADMIN_EMAIL || 'superadmin@example.com',
      password: hashedPassword,
      role: 'superadmin',
    });
    await superAdmin.save();
    console.log('Superadmin oluşturuldu:', superAdmin.email);
  } catch (error) {
    console.error('Superadmin oluşturma hatası:', error.message);
  }
};

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB bağlantısı başarılı');
    await initializeSuperAdmin(); // Superadmin'i başlat
  } catch (error) {
    console.error('MongoDB bağlantı hatası:', error);
    process.exit(1);
  }
};

module.exports = connectDB;