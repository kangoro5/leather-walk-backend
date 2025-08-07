const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    // --- User Information ---
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to your User model
        required: true,
        index: true // Index for efficient lookup by user
    },

    // --- Products in the Order ---
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
            // Crucial: Store the product details at the time of order
            // This prevents issues if product prices, names, or images change later
            priceAtTimeOfOrder: {
                type: Number,
                required: true
            },
            nameAtTimeOfOrder: {
                type: String,
                required: true
            },
            imageUrlAtTimeOfOrder: {
                type: String,
                default: '' // Can be empty if no image
            },
            sizeAtTimeOfOrder: {
                type: String,
                trim: true,
                default: 'N/A' // e.g., 'M', 'XL', or 'N/A'
            },
            colorAtTimeOfOrder: {
                type: String,
                trim: true,
                default: 'N/A' // e.g., 'Red', 'Blue', or 'N/A'
            }
        }
    ],

    // --- Shipping Information ---
    shippingInfo: {
        fullName: {
            type: String,
            required: true,
            trim: true
        },
        phone: {
            type: String,
            required: true,
            trim: true
        },
        county: {
            type: String,
            required: true,
            trim: true
        },
        pickupStation: {
            type: String,
            required: true,
            trim: true
        }
    },

    // --- Payment Details ---
    paymentMethod: {
        type: String,
        required: true,
        enum: ['cod', 'card', 'mpesa'], // Enforce allowed payment methods
        default: 'cod'
    },
    mpesaNumber: { // Only applicable if paymentMethod is 'mpesa'
        type: String,
        trim: true,
        sparse: true // Allows null values and won't create an index for every document
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
        default: 'Pending'
    },
    // You might want to add a transactionId field here for payment gateway references

    // --- Financial Summary ---
    subtotalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    shippingCost: {
        type: Number,
        required: true,
        min: 0
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },

    // --- Order Status & Timestamps ---
    orderStatus: {
        type: String,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],
        default: 'Pending',
        index: true // Index for efficient filtering by status
    },
    // Optional: Add a field for a tracking number once shipped
    trackingNumber: {
        type: String,
        trim: true,
        sparse: true
    },
    // Optional: Date of delivery
    deliveredAt: {
        type: Date
    }

}, {
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

module.exports = mongoose.model('Order', OrderSchema);