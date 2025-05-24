const e = require("express");
require('dotenv').config();
const jwt = require('jsonwebtoken');
const {User} = require('../models/userModel'); // User modelini içe aktar


const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token gerekli' });
  try {

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Geçersiz token' });
  }
};

// Middleware: Sadece admin rolü için
const restrictToAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id); // JWT'den alınan userId
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz yok, sadece admin rolü' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  authenticate,
  restrictToAdmin,
};