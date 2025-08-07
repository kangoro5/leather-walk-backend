// admin user model
const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true }, // Correctly set to unique
    email: { type: String, required: true, unique: true },   // Correctly set to unique
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  });
  
  const User = mongoose.model('Admin', adminSchema);
  module.exports = User;