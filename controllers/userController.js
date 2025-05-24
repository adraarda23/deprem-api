const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, ScrapedData, FilteredData, VolunteerData } = require('../models/userModel'); // Model dosyanızın yolu
require('dotenv').config();



// POST /scraped-datas
// Yeni scraped data ekler
const createScrapedData = async (req, res) => {
  try {
    const { text, img_link, username, tweetedTime } = req.body;
    if (!text) {
      return res.status(400).json({ message: 'Text alanı zorunlu' });
    }
    const scrapedData = new ScrapedData({
      text,
      image_url: img_link,
      username,
      tweetCreatedAt: tweetedTime ? new Date(tweetedTime) : undefined,
    });
    await scrapedData.save();
    res.status(201).json(scrapedData);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET /scraped-datas
// Tüm scraped dataları getirir
const getScrapedDatas = async (req, res) => {
  try {
    const scrapedDatas = await ScrapedData.find();
    res.status(200).json(scrapedDatas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// POST /filtered-datas
// Yeni filtered data ekler
const createFilteredData = async (req, res) => {
  try {
    const { summary_note, address_link, address } = req.body;
    if (!summary_note || !address_link || !address || !address.il || !address.ilce || !address.mahalle) {
      return res.status(400).json({ message: 'summary_note, address_link ve address (il, ilce, mahalle) zorunlu' });
    }
    const filteredData = new FilteredData({
      userId: req.user._id, // JWT'den alınır
      scrapedDataId: req.body.scrapedDataId, // Gerekirse body'den alınır
      summary_note,
      address_link,
      address,
    });
    await filteredData.save();
    res.status(201).json(filteredData);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// POST /create-admin
// Yeni admin kullanıcı oluşturur
const createAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email ve password zorunlu' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      password: hashedPassword,
      role: 'admin',
    });
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Bu email zaten kullanılıyor' });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
};

// POST /create-worker
// Yeni worker kullanıcı oluşturur (sadece admin)
const createWorker = async (req, res) => {
  try {
    const { email, password, workArea } = req.body;
    if (!email || !password || !workArea || !workArea.il || !workArea.ilce) {
      return res.status(400).json({ message: 'Email, password ve workArea (il, ilce) zorunlu' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      password: hashedPassword,
      role: 'worker',
      workArea, // { il: String, ilce: String }
    });
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Bu email zaten kullanılıyor' });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
};

// POST /sign-in
// Kullanıcı girişi yapar
const signIn = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email ve password zorunlu' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Geçersiz email veya şifre' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Geçersiz email veya şifre' });
    }
    const token = jwt.sign(
      { _id: user._id, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1h' }
    );
    res.status(200).json({ token, user: { _id: user._id, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /filtered-datas/cities
// İllere göre vaka sayısını getirir
const getCityCases = async (req, res) => {
  try {
    const cases = await FilteredData.aggregate([
      {
        $group: {
          _id: '$address.il',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);
    res.status(200).json(cases.map(item => ({ il: item._id, count: item.count })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// GET /filtered-datas/districts/:il
// Belirtilen ile ait ilçelere göre vaka sayısını getirir
const getDistrictCasesByCity = async (req, res) => {
  const il = req.params.il;

  try {
    const cases = await FilteredData.aggregate([
      {
        $match: { 'address.il': il },
      },
      {
        $group: {
          _id: '$address.ilce',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.status(200).json(cases.map(item => ({
      ilce: item._id,
      count: item.count,
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



// POST /filtered-datas/district
// Belirli bir il ve ilçeye ait tüm verileri getirir
const getDistrictData = async (req, res) => {
  try {
    const { il, ilce } = req.body;
    if (!il || !ilce) {
      return res.status(400).json({ message: 'il ve ilce alanları zorunlu' });
    }
    const data = await FilteredData.find({ 'address.il': il, 'address.ilce': ilce });
    if (!data.length) {
      return res.status(404).json({ message: 'Bu il ve ilçeye ait veri bulunamadı' });
    }
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /volunteer-datas
// Yeni gönüllü kaydı ekler
const createVolunteerData = async (req, res) => {
  try {
    const {
      ad_soyad,
      tc,
      tel,
      eposta,
      yas,
      cinsiyet,
      il,
      ilce,
      address,
      yardimSertifikasi,
      alanlar,
      ozel_yetenekler,
    } = req.body;
    if (!ad_soyad || !tc || !tel || !eposta || !yas || !cinsiyet || !il || !ilce || yardimSertifikasi === undefined) {
      return res.status(400).json({ message: 'Zorunlu alanlar eksik' });
    }
    const volunteerData = new VolunteerData({
      ad_soyad,
      tc,
      tel,
      eposta,
      yas,
      cinsiyet,
      il,
      ilce,
      address,
      yardimSertifikasi,
      alanlar,
      ozel_yetenekler,
    });
    await volunteerData.save();
    res.status(201).json(volunteerData);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'Bu TC veya e-posta zaten kullanılıyor' });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
};

// GET /volunteer-datas
// Tüm gönüllü verilerini getirir
const getVolunteerDatas = async (req, res) => {
  try {
    const volunteerDatas = await VolunteerData.find();
    res.status(200).json(volunteerDatas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createScrapedData,
  getScrapedDatas,
  createFilteredData,
  createAdmin,
  createWorker,
  signIn,
  getCityCases,
  getDistrictData,
  createVolunteerData,
  getVolunteerDatas,
  getDistrictCasesByCity,
};