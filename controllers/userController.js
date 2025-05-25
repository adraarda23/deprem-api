const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Vault = require('node-vault');
const crypto = require('crypto');
const { User, ScrapedData, FilteredData, VolunteerData,Hashtag } = require('../models/userModel');
require('dotenv').config();

const vault = require("node-vault")({
  endpoint: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
  token: process.env.VAULT_TOKEN
});


// AES şifreleme fonksiyonu
async function encryptData(data, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'base64'), iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');
  return { iv: iv.toString('base64'), encryptedData: encrypted, authTag };
}

// AES şifre çözme fonksiyonu
async function decryptData(encryptedData, key, iv, authTag) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

// POST /scraped-datas
const createScrapedData = async (req, res) => {
  try {
    const { text, img_link, username, tweetedTime } = req.body;
    if (!text) {
      return res.status(400).json({ message: 'Text alanı zorunlu' });
    }

    // Vault’tan anahtarı al (Key/Value Secrets Engine)
    const keyResult = await vault.read('secret/data/aes-key');
    const key = keyResult.data.data.master_key;

    // Text ve img_link alanlarını şifrele
    const encryptedText = await encryptData(text, key);
    const encryptedImageUrl = img_link ? await encryptData(img_link, key) : undefined;

    const scrapedData = new ScrapedData({
      encryptedText: {
        encryptedData: encryptedText.encryptedData,
        iv: encryptedText.iv,
        authTag: encryptedText.authTag,
      },
      encryptedImageUrl: encryptedImageUrl
        ? {
            encryptedData: encryptedImageUrl.encryptedData,
            iv: encryptedImageUrl.iv,
            authTag: encryptedImageUrl.authTag,
          }
        : undefined,
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
const getScrapedDatas = async (req, res) => {
  try {
    // Vault’tan anahtarı al (Key/Value Secrets Engine)
    const keyResult = await vault.read('secret/data/aes-key');
    const key = keyResult.data.data.master_key;

    const scrapedDatas = await ScrapedData.find({ isUsed: false });
    const decryptedDatas = await Promise.all(
      scrapedDatas.map(async (data) => {
        const decryptedData = { ...data._doc };
        if (data.encryptedText) {
          decryptedData.text = await decryptData(
            data.encryptedText.encryptedData,
            key,
            data.encryptedText.iv,
            data.encryptedText.authTag
          );
          delete decryptedData.encryptedText;
        }
        if (data.encryptedImageUrl) {
          decryptedData.image_url = await decryptData(
            data.encryptedImageUrl.encryptedData,
            key,
            data.encryptedImageUrl.iv,
            data.encryptedImageUrl.authTag
          );
          delete decryptedData.encryptedImageUrl;
        }
        return decryptedData;
      })
    );
    res.status(200).json(decryptedDatas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /filtered-datas
const createFilteredData = async (req, res) => {
  try {
    const { summary_note, address_link, address } = req.body;
    if (!summary_note || !address || !address.il || !address.ilce || !address.mahalle) {
      return res.status(400).json({ message: 'summary_note, address_link ve address (il, ilce, mahalle) zorunlu' });
    }

    // Vault’tan anahtarı al (Key/Value Secrets Engine)
    const keyResult = await vault.read('secret/data/aes-key');
    const key = keyResult.data.data.master_key;

    // Hassas alanları şifrele
    const encryptedSummary = await encryptData(summary_note, key);
    const encryptedAddress = await encryptData(address, key);
    const encryptedAddressLink = address_link ? await encryptData(address_link, key) : undefined;

    const filteredData = new FilteredData({
      scrapedDataId: req.body.scrapedDataId,
      encryptedSummary: {
        encryptedData: encryptedSummary.encryptedData,
        iv: encryptedSummary.iv,
        authTag: encryptedSummary.authTag,
      },
      encryptedAddressLink: encryptedAddressLink
        ? {
            encryptedData: encryptedAddressLink.encryptedData,
            iv: encryptedAddressLink.iv,
            authTag: encryptedAddressLink.authTag,
          }
        : undefined,
      encryptedAddress: {
        encryptedData: encryptedAddress.encryptedData,
        iv: encryptedAddress.iv,
        authTag: encryptedAddress.authTag,
      },
    });

    await filteredData.save();
    res.status(201).json(filteredData);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// DELETE /filtered-datas/:id
const deleteFilteredData = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedData = await FilteredData.findByIdAndDelete(id);

    if (!deletedData) {
      return res.status(404).json({ message: 'Filtered data not found' });
    }

    res.status(200).json({ message: 'Filtered data deleted successfully', deletedData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// POST /create-admin
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
      workArea,
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
const getCityCases = async (req, res) => {
  try {
    // Vault’tan anahtarı al (Key/Value Secrets Engine)
    const keyResult = await vault.read('secret/data/aes-key');
    const key = keyResult.data.data.master_key;

    const cases = await FilteredData.find({ 'encryptedAddress.encryptedData': { $exists: true } });
    const decryptedCases = await Promise.all(
      cases.map(async (doc) => {
        const decryptedAddress = await decryptData(
          doc.encryptedAddress.encryptedData,
          key,
          doc.encryptedAddress.iv,
          doc.encryptedAddress.authTag
        );
        const decryptedAddressLink = doc.encryptedAddressLink
          ? await decryptData(
              doc.encryptedAddressLink.encryptedData,
              key,
              doc.encryptedAddressLink.iv,
              doc.encryptedAddressLink.authTag
            )
          : undefined;
        return { ...doc._doc, address: decryptedAddress, address_link: decryptedAddressLink };
      })
    );

    const aggregatedCases = decryptedCases.reduce((acc, doc) => {
      const il = doc.address.il;
      acc[il] = (acc[il] || 0) + 1;
      return acc;
    }, {});

    const result = Object.keys(aggregatedCases)
      .map((il) => ({ il, count: aggregatedCases[il] }))
      .sort((a, b) => a.il.localeCompare(b.il));

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /filtered-datas/districts/:il
const getDistrictCasesByCity = async (req, res) => {
  const il = req.params.il;

  try {
    // Vault’tan anahtarı al (Key/Value Secrets Engine)
    const keyResult = await vault.read('secret/data/aes-key');
    const key = keyResult.data.data.master_key;

    const cases = await FilteredData.find({ 'encryptedAddress.encryptedData': { $exists: true } });
    const decryptedCases = await Promise.all(
      cases.map(async (doc) => {
        const decryptedAddress = await decryptData(
          doc.encryptedAddress.encryptedData,
          key,
          doc.encryptedAddress.iv,
          doc.encryptedAddress.authTag
        );
        const decryptedAddressLink = doc.encryptedAddressLink
          ? await decryptData(
              doc.encryptedAddressLink.encryptedData,
              key,
              doc.encryptedAddressLink.iv,
              doc.encryptedAddressLink.authTag
            )
          : undefined;
        return { ...doc._doc, address: decryptedAddress, address_link: decryptedAddressLink };
      })
    );

    const filteredCases = decryptedCases.filter((doc) => doc.address.il === il);
    const aggregatedCases = filteredCases.reduce((acc, doc) => {
      const ilce = doc.address.ilce;
      acc[ilce] = (acc[ilce] || 0) + 1;
      return acc;
    }, {});

    const result = Object.keys(aggregatedCases)
      .map((ilce) => ({ ilce, count: aggregatedCases[ilce] }))
      .sort((a, b) => a.ilce.localeCompare(b.ilce));

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /filtered-datas/district
const getDistrictData = async (req, res) => {
  try {
    const { il, ilce } = req.body;
    if (!il || !ilce) {
      return res.status(400).json({ message: 'il ve ilce alanları zorunlu' });
    }

    // Vault’tan anahtarı al
    const keyResult = await vault.read('secret/data/aes-key');
    const key = keyResult.data.data.master_key;

    const data = await FilteredData.find({ 'encryptedAddress.encryptedData': { $exists: true } });
    const decryptedDatas = await Promise.all(
      data.map(async (item) => {
        const decryptedAddress = await decryptData(
          item.encryptedAddress.encryptedData,
          key,
          item.encryptedAddress.iv,
          item.encryptedAddress.authTag
        );
        // Büyük/küçük harfe duyarsız karşılaştırma
        if (
          decryptedAddress.il.toLowerCase() === il.toLowerCase() &&
          decryptedAddress.ilce.toLowerCase() === ilce.toLowerCase()
        ) {
          const decryptedData = { ...item._doc };
          decryptedData.address = decryptedAddress;
          if (item.encryptedSummary) {
            decryptedData.summary_note = await decryptData(
              item.encryptedSummary.encryptedData,
              key,
              item.encryptedSummary.iv,
              item.encryptedSummary.authTag
            );
            delete decryptedData.encryptedSummary;
          }
          if (item.encryptedAddressLink) {
            decryptedData.address_link = await decryptData(
              item.encryptedAddressLink.encryptedData,
              key,
              item.encryptedAddressLink.iv,
              item.encryptedAddressLink.authTag
            );
            delete decryptedData.encryptedAddressLink;
          }
          delete decryptedData.encryptedAddress;
          return decryptedData;
        }
        return null;
      })
    );

    const filteredDatas = decryptedDatas.filter((item) => item !== null);
    if (!filteredDatas.length) {
      return res.status(404).json({ message: 'Bu il ve ilçeye ait veri bulunamadı' });
    }
    res.status(200).json(filteredDatas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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

    // Vault’tan anahtarı al
    const keyResult = await vault.read('secret/data/aes-key');
    const key = keyResult.data.data.master_key;

    // Mevcut gönüllüleri kontrol et
    const volunteers = await VolunteerData.find();
    for (const volunteer of volunteers) {
      if (volunteer.encryptedTc) {
        const decryptedTc = await decryptData(
          volunteer.encryptedTc.encryptedData,
          key,
          volunteer.encryptedTc.iv,
          volunteer.encryptedTc.authTag
        );
        if (decryptedTc === tc.toString()) {
          return res.status(400).json({ message: 'Bu TC zaten kullanılıyor' });
        }
      }
      if (volunteer.encryptedEposta) {
        const decryptedEposta = await decryptData(
          volunteer.encryptedEposta.encryptedData,
          key,
          volunteer.encryptedEposta.iv,
          volunteer.encryptedEposta.authTag
        );
        if (decryptedEposta === eposta) {
          return res.status(400).json({ message: 'Bu e-posta zaten kullanılıyor' });
        }
      }
    }

    // Hassas alanları şifrele
    const encryptedAdSoyad = await encryptData(ad_soyad, key);
    const encryptedTc = await encryptData(tc.toString(), key);
    const encryptedTel = await encryptData(tel.toString(), key);
    const encryptedEposta = await encryptData(eposta, key);
    const encryptedAddress = address ? await encryptData(address, key) : undefined;

    const volunteerData = new VolunteerData({
      encryptedAdSoyad: {
        encryptedData: encryptedAdSoyad.encryptedData,
        iv: encryptedAdSoyad.iv,
        authTag: encryptedAdSoyad.authTag,
      },
      encryptedTc: {
        encryptedData: encryptedTc.encryptedData,
        iv: encryptedTc.iv,
        authTag: encryptedTc.authTag,
      },
      encryptedTel: {
        encryptedData: encryptedTel.encryptedData,
        iv: encryptedTel.iv,
        authTag: encryptedTel.authTag,
      },
      encryptedEposta: {
        encryptedData: encryptedEposta.encryptedData,
        iv: encryptedEposta.iv,
        authTag: encryptedEposta.authTag,
      },
      yas,
      cinsiyet,
      il,
      ilce,
      encryptedAddress: encryptedAddress
        ? {
            encryptedData: encryptedAddress.encryptedData,
            iv: encryptedAddress.iv,
            authTag: encryptedAddress.authTag,
          }
        : undefined,
      yardimSertifikasi,
      alanlar,
      ozel_yetenekler,
    });

    await volunteerData.save();
    res.status(201).json(volunteerData);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET /volunteer-datas
const getVolunteerDatas = async (req, res) => {
  try {
    // Vault’tan anahtarı al (Key/Value Secrets Engine)
    const keyResult = await vault.read('secret/data/aes-key');
    const key = keyResult.data.data.master_key;

    const volunteerDatas = await VolunteerData.find();
    const decryptedDatas = await Promise.all(
      volunteerDatas.map(async (data) => {
        const decryptedData = { ...data._doc };
        if (data.encryptedAdSoyad) {
          decryptedData.ad_soyad = await decryptData(
            data.encryptedAdSoyad.encryptedData,
            key,
            data.encryptedAdSoyad.iv,
            data.encryptedAdSoyad.authTag
          );
          delete decryptedData.encryptedAdSoyad;
        }
        if (data.encryptedTc) {
          decryptedData.tc = await decryptData(
            data.encryptedTc.encryptedData,
            key,
            data.encryptedTc.iv,
            data.encryptedTc.authTag
          );
          delete decryptedData.encryptedTc;
        }
        if (data.encryptedTel) {
          decryptedData.tel = await decryptData(
            data.encryptedTel.encryptedData,
            key,
            data.encryptedTel.iv,
            data.encryptedTel.authTag
          );
          delete decryptedData.encryptedTel;
        }
        if (data.encryptedEposta) {
          decryptedData.eposta = await decryptData(
            data.encryptedEposta.encryptedData,
            key,
            data.encryptedEposta.iv,
            data.encryptedEposta.authTag
          );
          delete decryptedData.encryptedEposta;
        }
        if (data.encryptedAddress) {
          decryptedData.address = await decryptData(
            data.encryptedAddress.encryptedData,
            key,
            data.encryptedAddress.iv,
            data.encryptedAddress.authTag
          );
          delete decryptedData.encryptedAddress;
        }
        return decryptedData;
      })
    );
    res.status(200).json(decryptedDatas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /mark-scraped-data
const markScrapedDataAsUsed = async (req, res) => {
  try {
    const { scrapedDataId } = req.body;

    if (!scrapedDataId) {
      return res.status(400).json({ message: 'scrapedDataId gerekli' });
    }

    const updatedScrapedData = await ScrapedData.findByIdAndUpdate(
      scrapedDataId,
      { isUsed: true },
      { new: true }
    );

    if (!updatedScrapedData) {
      return res.status(404).json({ message: 'Scraped data bulunamadı' });
    }

    // Şifreli text ve image_url alanlarını çöz
    const keyResult = await vault.read('secret/data/aes-key');
    const key = keyResult.data.data.master_key;
    const decryptedData = { ...updatedScrapedData._doc };
    if (updatedScrapedData.encryptedText) {
      decryptedData.text = await decryptData(
        updatedScrapedData.encryptedText.encryptedData,
        key,
        updatedScrapedData.encryptedText.iv,
        updatedScrapedData.encryptedText.authTag
      );
      delete decryptedData.encryptedText;
    }
    if (updatedScrapedData.encryptedImageUrl) {
      decryptedData.image_url = await decryptData(
        updatedScrapedData.encryptedImageUrl.encryptedData,
        key,
        updatedScrapedData.encryptedImageUrl.iv,
        updatedScrapedData.encryptedImageUrl.authTag
      );
      delete decryptedData.encryptedImageUrl;
    }

    res.status(200).json(decryptedData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// CREATE - Yeni hashtag ekle
const createHashtag = async (req, res) => {
  try {
    const { tag } = req.body;

    if (!tag || !tag.startsWith('#')) {
      return res.status(400).json({ message: 'Hashtag # ile başlamalı ve boş olmamalı' });
    }

    const existing = await Hashtag.findOne({ tag });
    if (existing) {
      return res.status(409).json({ message: 'Hashtag zaten mevcut' });
    }

    const newHashtag = new Hashtag({ tag });
    await newHashtag.save();
    res.status(201).json(newHashtag);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// READ - Tüm hashtagleri getir
const getAllHashtags = async (req, res) => {
  try {
    const hashtags = await Hashtag.find().sort({ createdAt: -1 });
    res.status(200).json(hashtags);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE - Bir hashtag’i güncelle (örneğin yazım hatası düzeltme)
const updateHashtag = async (req, res) => {
  try {
    const { id } = req.params;
    const { tag } = req.body;

    if (!tag || !tag.startsWith('#')) {
      return res.status(400).json({ message: 'Hashtag # ile başlamalı ve boş olmamalı' });
    }

    const updated = await Hashtag.findByIdAndUpdate(id, { tag }, { new: true });

    if (!updated) {
      return res.status(404).json({ message: 'Hashtag bulunamadı' });
    }

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE - Hashtag’i sil
const deleteHashtag = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Hashtag.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Hashtag bulunamadı' });
    }

    res.status(200).json({ message: 'Hashtag silindi', deleted });
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
  markScrapedDataAsUsed,
  deleteFilteredData,
  createHashtag,
  getAllHashtags,
  updateHashtag,
  deleteHashtag
};