// Example: models/Cart.js
const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to your User model
        required: true,
        unique: true // A user should only have one cart
    },
    products: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product', // Reference to your Product model
                required: true
            },
            quantity: {
                type: Number,
                required: true,
                min: 1
            },
            priceAtTimeOfAddition: { // Store the price when added to cart
                type: Number,
                required: true
            }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);

// Example: models/Product.js (relevant fields)
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0 }, // Stock quantity
    imageUrl: { type: String },
    size: { type: String },
    color: { type: String },
    // ... other fields
});
module.exports = mongoose.model('Product', productSchema);