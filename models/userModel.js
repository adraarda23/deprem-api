const mongoose = require('mongoose');

// User Schema (değişmedi)
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
  },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'worker'],
    required: [true, 'Role is required'],
  },
  workArea: {
    type: {
      il: {
        type: String,
        required: [true, 'İl is required for workArea'],
      },
      ilce: {
        type: String,
        required: [true, 'İlçe is required for workArea'],
      },
    },
    required: function () {
      return this.role === 'worker'; // Sadece worker için zorunlu
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Address Sub-Schema (değişmedi)
const addressSchema = new mongoose.Schema({
  il: {
    type: String,
    required: [true, 'City (il) is required'],
  },
  ilce: {
    type: String,
    required: [true, 'District (ilçe) is required'],
  },
  mahalle: {
    type: String,
    required: [true, 'Neighborhood (mahalle) is required'],
  },
  cadde: {
    type: String,
  },
  sokak: {
    type: String,
  },
  No: {
    type: mongoose.Schema.Types.Mixed,
    validate: {
      validator: function (value) {
        return value == null || typeof value === 'string' || typeof value === 'number';
      },
      message: 'No must be a string or number',
    },
  },
});

// Scraped Data Schema (değişmedi)
const scrapedDataSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Text is required'],
  },
  image_url: {
    type: String,
    required: [true, 'Image URL is required'],
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
  },
  tweetCreatedAt: {
    type: Date,
    required: [true, 'Tweet creation time is required'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isUsed: {
    type: Boolean,
    default: false, // Varsayılan olarak kullanılmamış
  },
});

// Filtered Data Schema (değişmedi)
const filteredDataSchema = new mongoose.Schema({
  summary_note: {
    type: String,
    required: [true, 'Summary note is required'],
  },
  address_link: {
    type: String,
    required: [true, 'Address link is required'],
  },
  address: {
    type: addressSchema,
    required: [true, 'Address is required'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Volunteer Data Schema (alanlar required kaldırıldı)
const volunteerDatasSchema = new mongoose.Schema({
  ad_soyad: {
    type: String,
    required: [true, 'Ad Soyad is required'],
    trim: true,
  },
  tc: {
    type: Number,
    required: [true, 'TC is required'],
    unique: true,
    validate: {
      validator: function (value) {
        return value.toString().length === 11;
      },
      message: 'TC must be an 11-digit number',
    },
  },
  tel: {
    type: Number,
    required: [true, 'Telefon is required'],
    validate: {
      validator: function (value) {
        return value.toString().length >= 10;
      },
      message: 'Telefon must be at least a 10-digit number',
    },
  },
  eposta: {
    type: String,
    required: [true, 'E-posta is required'],
    trim: true,
    lowercase: true,
    validate: {
      validator: function (value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      },
      message: 'Invalid e-posta format',
    },
  },
  yas: {
    type: Number,
    required: [true, 'Yaş is required'],
    min: [0, 'Yaş cannot be negative'],
    max: [120, 'Yaş cannot exceed 120'],
  },
  cinsiyet: {
    type: String,
    enum: ['erkek', 'kadın'],
    required: [true, 'Cinsiyet is required'],
  },
  il: {
    type: String,
    required: [true, 'İl is required'],
    trim: true,
  },
  ilce: {
    type: String,
    required: [true, 'İlçe is required'],
    trim: true,
  },
  address: {
    type: String,
    trim: true,
  },
  yardimSertifikasi: {
    type: Boolean,
    required: [true, 'Yardım sertifikası durumu is required'],
  },
  alanlar: {
    type: [String] // String dizisi, required kaldırıldı, isteğe bağlı
  },
  ozel_yetenekler: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Modelleri oluştur
const User = mongoose.model('User', userSchema);
const ScrapedData = mongoose.model('ScrapedData', scrapedDataSchema);
const FilteredData = mongoose.model('FilteredData', filteredDataSchema);
const VolunteerData = mongoose.model('VolunteerData', volunteerDatasSchema);

module.exports = { User, ScrapedData, FilteredData, VolunteerData };