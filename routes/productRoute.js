// routes/product.js
const express = require('express');
const Product = require('../models/ProductModel');
const cloudinary = require('cloudinary').v2; // Ensure this is imported here for use in this file
const multer = require('multer'); // Multer needs to be initialized where you use it

const router = express.Router();

// --- Multer setup for this router ---
// This is now self-contained within this route file.
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, and WEBP image formats are allowed!'), false);
    }
  }
});


// Route to create a new product WITH an image upload
router.post('/products/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ error: 'No image file provided for product.' });
    }

    const result = await cloudinary.uploader.upload(
      `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
      {
        folder: 'product-images', // Optional: specific folder for product images
      }
    );

    const productData = {
      ...req.body, // This will contain 'name', 'color', 'quantity', etc.
      imageUrl: result.secure_url,
      imagePublicId: result.public_id // Store public ID for potential deletion later
    };

    const product = new Product(productData);
    await product.save();

    res.status(201).send(product);

  } catch (error) {
    console.error('Error creating product with image:', error);

    // If Cloudinary upload fails or Mongoose save fails
    if (error.result && error.result.public_id) {
        console.log(`Attempting to delete orphaned image: ${error.result.public_id}`);
        // Consider uncommenting this if you want to clean up failed DB saves
        // await cloudinary.uploader.destroy(error.result.public_id).catch(delErr => console.error("Failed to delete orphaned image from Cloudinary:", delErr));
    }

    // This catches Mongoose validation errors or other general errors
    res.status(400).send({ error: error.message || 'Failed to create product with image.' });
  }
});


// --- IMPORTANT CONSIDERATION FOR YOUR TWO POST /products ROUTES ---
// You have two POST routes for '/products'.
// - `/products/upload` expects `multipart/form-data` with an 'image' field.
// - `/products` expects `application/json` for product data without an image.
// This setup is fine as long as your frontend explicitly uses the correct endpoint
// and Content-Type for each operation.
// If you intend for *all* product creations to involve an image, you can remove the
// `router.post('/products', ...)` route without `upload.single('image')`.

// Create a new product (without image upload, assuming JSON body)
router.post('/products', async (req, res) => {
    try {
        const product = new Product(req.body);
        await product.save();
        res.status(201).send(product);
    } catch (error) {
        res.status(400).send(error);
    }
});


// Get all products
router.get('/products', async (req, res) => {
    try {
        const products = await Product.find({});
        res.status(200).send(products);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Get a product by ID
router.get('/products/:id', async (req, res) => {
    const _id = req.params.id;
    try {
        const product = await Product.findById(_id);
        if (!product) {
            return res.status(404).send();
        }
        res.status(200).send(product);
    } catch (error) {
        res.status(500).send(error);
    }
});

// Update a product by ID (consider how image updates would work here)
// If you want to update the image, you'd need a separate route like PUT /products/:id/image
// or make this PATCH route accept multipart/form-data with `upload.single('image')`
// and handle conditional image upload/deletion.
router.patch('/products/:id', async (req, res) => {
    const _id = req.params.id;
    const updates = Object.keys(req.body);
    const allowedUpdates = ['name', 'color', 'quantity', 'size', 'price', 'imageUrl', 'imagePublicId'];
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

    if (!isValidOperation) {
        return res.status(400).send({ error: 'Invalid updates!' });
    }

    try {
        const product = await Product.findByIdAndUpdate(_id, req.body, { new: true, runValidators: true });
        if (!product) {
            return res.status(404).send();
        }
        res.status(200).send(product);
    } catch (error) {
        res.status(400).send(error);
    }
});

// Delete a product by ID (and its associated image from Cloudinary)
router.delete('/products/:id', async (req, res) => {
    const _id = req.params.id;
    try {
        const product = await Product.findByIdAndDelete(_id);
        if (!product) {
            return res.status(404).send();
        }

        // OPTIONAL: Delete image from Cloudinary when product is deleted
        if (product.imagePublicId) {
            await cloudinary.uploader.destroy(product.imagePublicId);
            console.log(`Deleted image from Cloudinary: ${product.imagePublicId}`);
        }

        res.status(200).send(product);
    } catch (error) {
        console.error('Error deleting product or image:', error);
        res.status(500).send({ error: 'Failed to delete product or associated image.' });
    }
});

module.exports = router;