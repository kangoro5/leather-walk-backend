// models/ProductModel.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0 }, // This is your stock
    imageUrl: { type: String },
    category: { type: String },
    brand: { type: String },
    size: { type: String },
    color: { type: String },
    // Add other fields as per your product data
}, { timestamps: true });

// --- THE CRITICAL CHANGE ---
// Check if the 'Product' model already exists.
// If it does, use the existing one; otherwise, compile and use the new one.
module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);