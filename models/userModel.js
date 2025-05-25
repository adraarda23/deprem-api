const mongoose = require('mongoose');

// Şifrelenmiş veri için alt şema
const encryptedFieldSchema = new mongoose.Schema({
  encryptedData: String,
  iv: String,
  authTag: String,
});

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
      return this.role === 'worker';
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Address Sub-Schema (şifrelenmiş olarak saklanacak)
const addressSchema = new mongoose.Schema({
  encryptedAddress: encryptedFieldSchema, // Şifrelenmiş adres
});

// Scraped Data Schema
const scrapedDataSchema = new mongoose.Schema({
  encryptedText: encryptedFieldSchema, // Şifrelenmiş text
  encryptedImageUrl: encryptedFieldSchema, // Şifrelenmiş image_url
  username: {
    type: String,
  },
  tweetCreatedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isUsed: {
    type: Boolean,
    default: false,
  },
});

// Filtered Data Schema
const filteredDataSchema = new mongoose.Schema({
  scrapedDataId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScrapedData' },
  encryptedSummary: encryptedFieldSchema, // Şifrelenmiş summary_note
  encryptedAddressLink: encryptedFieldSchema, // Şifrelenmiş address_link
  encryptedAddress: encryptedFieldSchema, // Şifrelenmiş adres
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Volunteer Data Schema
const volunteerDataSchema = new mongoose.Schema({
  encryptedAdSoyad: encryptedFieldSchema,
  encryptedTc: encryptedFieldSchema, // unique: true kaldırıldı
  encryptedTel: encryptedFieldSchema,
  encryptedEposta: encryptedFieldSchema, // unique: true kaldırıldı
  yas: { type: Number, required: true, min: 0, max: 120 },
  cinsiyet: { type: String, enum: ['erkek', 'kadın'], required: true },
  il: { type: String, required: true, trim: true },
  ilce: { type: String, required: true, trim: true },
  encryptedAddress: encryptedFieldSchema,
  yardimSertifikasi: { type: Boolean, required: true },
  alanlar: [String],
  ozel_yetenekler: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
});

const HashtagSchema = new mongoose.Schema({
  tag: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
}, { timestamps: true });

// Modelleri oluştur
const User = mongoose.model('User', userSchema);
const ScrapedData = mongoose.model('ScrapedData', scrapedDataSchema);
const FilteredData = mongoose.model('FilteredData', filteredDataSchema);
const VolunteerData = mongoose.model('VolunteerData', volunteerDataSchema);
const Hashtag = mongoose.model('Hashtag', HashtagSchema);

module.exports = { User, ScrapedData, FilteredData, VolunteerData,Hashtag };