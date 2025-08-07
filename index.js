const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const app = express();
const mongoose = require('mongoose'); // <-- IMPORTANT: Make sure mongoose is imported here

// --- Cloudinary Configuration (can be early) ---
const cloudinary = require('cloudinary').v2;
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- Multer Configuration (can be early, but export separately if needed) ---
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, GIF, and WEBP image formats are allowed!'), false);
        }
    }
});
// If productRoute.js needs this 'upload' instance, consider exporting it from a dedicated middleware file:
// For example, in 'middleware/upload.js': module.exports = upload;
// Then in productRoute.js: const upload = require('../middleware/upload');


// --- Connect to Database ---
// Your dbConfig.js should export a function to connect, or this logic should be here.
// Example: Assuming db.js exports a function `connectDB`
require('./database/db'); // This will connect automatically

// Or, if your db.js simply connects on require, ensure it's required AFTER dotenv.config()
// require('./database/db'); // If this connects automatically

// --- AFTER Database Connection: Require Models ---
// It's crucial that models are required *after* the database connection is initiated,
// but before any routes that use them.
// This ensures Mongoose context is ready.
require('./models/UserModel');    // Just require them to ensure they are compiled
require('./models/ProductModel'); // This will compile the Product model
require('./models/CartModel');    // This will compile the Cart model (and reference Product)
require('./models/AdminModel');
// --- Express Middleware ---
const cors = require('cors');
app.use(cors()); // CORS should be early

// Body parsing middleware - MUST come before routes that use req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// --- Require Routes (after models are compiled) ---
const userRoutes = require('./routes/userRoute');
const productRoutes = require('./routes/productRoute');
const cartRoutes = require('./routes/cartRoute');
const orderRoutes = require('./routes/ordersRoute');
const adminRoutes = require('./routes/adminRoute');
// --- Mount Routes ---
app.use('/api', userRoutes);
app.use('/api', productRoutes); // Corrected line 71
app.use('/api/carts', cartRoutes); // <-- Add '/carts' here
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);


// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large! Maximum allowed size is 5MB.' });
        }
        return res.status(400).json({ error: err.message || 'File upload error.' });
    }
    if (err.message) {
        // Use error.status if it's a custom error with a status code
        const statusCode = err.status || 400;
        return res.status(statusCode).json({ error: err.message });
    }
    console.error('Unhandled Server Error:', err.stack);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
});

// --- Basic Root Route ---
app.get('/', (req, res) => {
    res.send('Welcome to the Leather walk online shop API');
});

// --- Catch-all 404 JSON handler ---
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});