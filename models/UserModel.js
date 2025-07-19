// models/UserModel.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }, // Correctly set to unique
  fullname: { type: String, required: true },
  email: { type: String, required: true, unique: true },   // Correctly set to unique
  phone: { type: String, required: true, unique: true },   // Correctly set to unique
  county: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
module.exports = User;