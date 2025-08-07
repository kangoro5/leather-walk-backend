// cartRoutes.js
const express = require('express');
const router = express.Router();
const Cart = require('../models/CartModel');
const Product = require('../models/ProductModel');
const mongoose = require('mongoose');

// Helper function to validate products array for PUT/POST requests
async function validateCartItems(productsData) {
    const validatedProducts = [];
    for (const item of productsData) {
        if (!item.productId) {
            throw { status: 400, message: 'Product ID is required for all cart items.' };
        }
        if (!mongoose.Types.ObjectId.isValid(item.productId)) {
            throw { status: 400, message: `Invalid Product ID format for ${item.productId}.` };
        }
        if (typeof item.quantity !== 'number' || item.quantity < 0) {
            throw { status: 400, message: `Quantity for product ID ${item.productId} must be a number and at least 0.` };
        }
        if (typeof item.priceAtTimeOfAddition !== 'number' || item.priceAtTimeOfAddition < 0) {
            throw { status: 400, message: `Price at time of addition is required and must be a non-negative number for product ID ${item.productId}.` };
        }
        const product = await Product.findById(item.productId);
        if (!product) {
            throw { status: 404, message: `Product with ID ${item.productId} not found.` };
        }
        if (item.quantity > 0 && item.quantity > product.quantity) {
            throw { status: 400, message: `Insufficient stock for product '${product.name}'. Available: ${product.quantity}, Requested: ${item.quantity}.` };
        }
        validatedProducts.push({
            productId: product._id,
            quantity: item.quantity,
            priceAtTimeOfAddition: item.priceAtTimeOfAddition
        });
    }
    return validatedProducts;
}

/**
 * @desc Get user's cart
 * @route GET /api/carts/:userId
 * @access Public (or Private with authentication)
 */
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid User ID format.' });
        }
        const cart = await Cart.findOne({ user: userId })
            .populate({
                path: 'products.productId',
                model: 'Product',
                select: 'name price imageUrl quantity size color'
            })
            .exec();

        if (!cart) {
            return res.status(200).json({ user: userId, products: [] });
        }
        res.status(200).json(cart);
    } catch (error) {
        console.error("Error fetching cart:", error);
        res.status(500).json({ message: 'Server error fetching cart.', error: error.message });
    }
});


/**
 * @desc Add a single item to cart or update its quantity if it already exists
 * @route POST /api/carts/:userId/add
 * @access Public (or Private with authentication)
 * @body { productId: string, quantity: number }
 */
router.post('/:userId/add', async (req, res) => {
    try {
        const { userId } = req.params;
        const { productId, quantity } = req.body;

        // 1. Strict validation to prevent userId: null errors
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Valid User ID is required.' });
        }
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Valid Product ID is required.' });
        }
        if (typeof quantity !== 'number' || quantity < 1) {
            return res.status(400).json({ message: 'Quantity must be a positive number (at least 1).' });
        }

        // 2. Find the product to get its price and check stock
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        // 3. Find the cart to get the current quantity, if any
        const cart = await Cart.findOne({ user: userId });
        let newQuantity = quantity;

        if (cart) {
            const existingItem = cart.products.find(p => p.productId.toString() === productId);
            if (existingItem) {
                newQuantity += existingItem.quantity;
            }
        }
        
        // 4. Check for sufficient stock based on the new total quantity
        if (product.quantity < newQuantity) {
            return res.status(400).json({ message: `Insufficient stock for ${product.name}. Available: ${product.quantity}, Requested: ${newQuantity}.` });
        }
        
        // 5. Use findOneAndUpdate with $set and $push/arrayFilters to handle all cases
        // The core logic is here to prevent duplicate carts.
        const priceAtTimeOfAddition = product.price;

        // Try to find the cart and update the quantity of an existing product
        let updatedCart = await Cart.findOneAndUpdate(
            { user: userId, 'products.productId': productId },
            { $inc: { 'products.$.quantity': quantity }, $set: { 'products.$.priceAtTimeOfAddition': priceAtTimeOfAddition } },
            { new: true, runValidators: true }
        );

        if (!updatedCart) {
            // If the product wasn't found in the cart (or the cart didn't exist),
            // then we push a new product to the products array.
            updatedCart = await Cart.findOneAndUpdate(
                { user: userId },
                { $push: { products: { productId, quantity, priceAtTimeOfAddition } } },
                { new: true, upsert: true, runValidators: true } // upsert: true creates the cart if it doesn't exist
            );
        }

        // 6. Populate the product details and send the response
        const populatedCart = await updatedCart
            .populate('products.productId', 'name price imageUrl quantity size color');

        res.status(200).json(populatedCart);

    } catch (error) {
        console.error("Error adding item to cart:", error);
        res.status(500).json({ message: 'Failed to add item to cart.', error: error.message });
    }
});


/**
 * @desc Update user's cart by replacing its entire products array
 * @route PUT /api/carts/:userId
 * @access Public (or Private with authentication)
 * @body { products: [{ productId: string, quantity: number, priceAtTimeOfAddition: number }] }
 */
router.put('/:userId', async (req, res) => {
    const { userId } = req.params;
    const { products } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'User ID is required and must be valid.' });
    }
    if (!Array.isArray(products)) {
        return res.status(400).json({ message: 'Products must be an array.' });
    }

    try {
        const validatedProducts = await validateCartItems(products);
        const productsToSave = validatedProducts.filter(item => item.quantity > 0);

        let cart = await Cart.findOneAndUpdate(
            { user: userId },
            { $set: { products: productsToSave } },
            { new: true, upsert: true, runValidators: true }
        );

        cart = await Cart.findById(cart._id)
            .populate({
                path: 'products.productId',
                model: 'Product',
                select: 'name price imageUrl quantity size color'
            });

        res.status(200).json(cart);
    } catch (error) {
        console.error("Error updating cart items:", error);
        if (error.status && error.message) {
            return res.status(error.status).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to update cart items.', error: error.message });
    }
});


/**
 * @desc Clear a user's entire cart
 * @route DELETE /api/carts/:userId
 * @access Public (or Private with authentication)
 */
router.delete('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid User ID format.' });
        }
        const cart = await Cart.findOneAndDelete({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found for this user.' });
        }
        res.status(200).json({ message: 'Cart deleted successfully.' });
    } catch (error) {
        console.error("Error clearing cart:", error);
        res.status(500).json({ message: 'Failed to clear cart.', error: error.message });
    }
});

module.exports = router;