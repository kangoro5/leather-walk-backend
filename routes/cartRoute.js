// cartRoutes.js
const express = require('express');
const router = express.Router();
const Cart = require('../models/CartModel');
const User = require('../models/UserModel'); // Ensure this path is correct
const Product = require('../models/ProductModel'); // Ensure this path is correct
const mongoose = require('mongoose'); // Import mongoose to use isValidObjectId

// IMPORTANT: Assume you have an authentication middleware that attaches req.user._id
// For simplicity, these routes use req.params.userId. In a real app,
// consider using req.user._id for logged-in users to prevent one user from manipulating another's cart.
// For now, if you're using req.params.userId, ensure your frontend is passing the correct _id.

// Helper function to validate products array for PUT/POST requests
// It validates product existence, quantity, and ensures priceAtTimeOfAddition is present.
async function validateCartItems(productsData) {
    const validatedProducts = [];

    for (const item of productsData) {
        if (!item.productId) {
            throw { status: 400, message: 'Product ID is required for all cart items.' };
        }
        // Validate product ID format
        if (!mongoose.Types.ObjectId.isValid(item.productId)) {
            throw { status: 400, message: `Invalid Product ID format for ${item.productId}.` };
        }
        
        if (typeof item.quantity !== 'number' || item.quantity < 0) { // Allow 0 for removal via PUT
            throw { status: 400, message: `Quantity for product ID ${item.productId} must be a number and at least 0.` };
        }
        if (typeof item.priceAtTimeOfAddition !== 'number' || item.priceAtTimeOfAddition < 0) {
            throw { status: 400, message: `Price at time of addition is required and must be a non-negative number for product ID ${item.productId}.` };
        }

        // Fetch product to validate against current stock and get actual price
        const product = await Product.findById(item.productId);
        if (!product) {
            throw { status: 404, message: `Product with ID ${item.productId} not found.` };
        }

        // Only check stock if quantity is greater than 0
        if (item.quantity > 0 && item.quantity > product.quantity) {
            throw { status: 400, message: `Insufficient stock for product '${product.name}'. Available: ${product.quantity}, Requested: ${item.quantity}.` };
        }

        validatedProducts.push({
            productId: product._id, // Ensure it's the actual ID from DB
            quantity: item.quantity,
            priceAtTimeOfAddition: item.priceAtTimeOfAddition // Use the price provided by the frontend for this field
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

        // Basic validation for userId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid User ID format.' });
        }

        // Find the cart and populate product details
        const cart = await Cart.findOne({ user: userId }) // Ensure your CartModel has a 'user' field that stores the userId
            .populate({
                path: 'products.productId', // Path to the field you want to populate
                model: 'Product',           // The model to use for population
                select: 'name price imageUrl quantity size color' // Select specific fields from the Product
            })
            .exec();

        if (!cart) {
            // If no cart found, return an empty cart object for consistency on the frontend
            // You might want to consider if you want to create a cart upon first fetch if it doesn't exist.
            // For now, returning an empty array is common.
            return res.status(200).json({ userId: userId, products: [] }); // Omit createdAt/updatedAt for non-existent cart
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
 * This is typically used when a user clicks "Add to Cart" on a product detail/listing page.
 */
router.post('/:userId/add', async (req, res) => {
    try {
        const { userId } = req.params;
        const { productId, quantity } = req.body;

        // Input validation
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid User ID format.' });
        }
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Valid Product ID is required.' });
        }
        if (typeof quantity !== 'number' || quantity < 1) {
            return res.status(400).json({ message: 'Quantity must be a positive number (at least 1).' });
        }

        // 1. Find the product to get its current price and stock
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        // 2. Find or create the user's cart
        // Ensure your CartModel has a 'user' field that stores the userId
        let cart = await Cart.findOne({ user: userId }); 

        if (!cart) {
            // If no cart exists, create a new one
            cart = new Cart({ user: userId, products: [] }); // Initialize with userId
        }

        // 3. Check if product already exists in cart
        const existingItemIndex = cart.products.findIndex(
            item => item.productId.toString() === productId
        );

        if (existingItemIndex > -1) {
            // Product exists, update quantity
            const currentCartQuantity = cart.products[existingItemIndex].quantity;
            const newTotalQuantity = currentCartQuantity + quantity;

            if (product.quantity < newTotalQuantity) {
                return res.status(400).json({ 
                    message: `Adding ${quantity} units exceeds available stock for ${product.name}. Current stock: ${product.quantity}. You currently have ${currentCartQuantity} in your cart.` 
                });
            }

            cart.products[existingItemIndex].quantity = newTotalQuantity;
            // It's a good practice to update priceAtTimeOfAddition here as well if the price changes over time
            cart.products[existingItemIndex].priceAtTimeOfAddition = product.price; 
        } else {
            // Product does not exist, add as new item
            if (product.quantity < quantity) {
                return res.status(400).json({ message: `Insufficient stock for ${product.name}. Available: ${product.quantity}` });
            }
            cart.products.push({
                productId: productId,
                quantity: quantity,
                priceAtTimeOfAddition: product.price // Use the product's current price
            });
        }

        const updatedCart = await cart.save();

        // Populate the product details before sending response to frontend
        const populatedCart = await Cart.findById(updatedCart._id)
            .populate({
                path: 'products.productId',
                model: 'Product',
                select: 'name price imageUrl quantity size color'
            });

        res.status(200).json(populatedCart);
    } catch (error) {
        console.error("Error adding item to cart:", error);
        // Catch and respond to specific errors from helper function or Mongoose
        if (error.status && error.message) {
            return res.status(error.status).json({ message: error.message });
        }
        res.status(500).json({ message: 'Failed to add item to cart.', error: error.message });
    }
});


/**
 * @desc Update user's cart by replacing its entire products array
 * @route PUT /api/carts/:userId
 * @access Public (or Private with authentication)
 * @body { products: [{ productId: string, quantity: number, priceAtTimeOfAddition: number }] }
 * This route is intended for the payload sent by your frontend's `updateCartOnBackend`
 * (e.g., after quantity changes or item removals on the cart page).
 */
router.put('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { products } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid User ID format.' });
        }

        if (!Array.isArray(products)) {
            return res.status(400).json({ message: 'Products must be an array.' });
        }

        // Validate incoming products array using the helper
        const validatedProducts = await validateCartItems(products);

        // Filter out items with quantity 0, as they are considered "removed"
        const productsToSave = validatedProducts.filter(item => item.quantity > 0);

        // Use findOneAndUpdate with upsert:true to create if cart doesn't exist
        // Ensure your CartModel has a 'user' field that stores the userId
        let cart = await Cart.findOneAndUpdate(
            { user: userId }, 
            { $set: { products: productsToSave } }, // Replace the entire products array
            { new: true, upsert: true, runValidators: true } // new: returns updated doc, upsert: creates if not exists, runValidators: validates updates
        );

        // Populate the product details before sending response
        cart = await Cart.findById(cart._id)
            .populate({
                path: 'products.productId',
                model: 'Product',
                select: 'name price imageUrl quantity size color'
            });

        res.status(200).json(cart);
    } catch (error) {
        console.error("Error updating cart items:", error);
        if (error.status && error.message) { // Handle errors from validateCartItems helper
            return res.status(error.status).json({ message: error.message });
        }
        if (error.name === 'ValidationError') { // Mongoose validation errors
            return res.status(400).json({ message: error.message, errors: error.errors });
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

        // Ensure your CartModel has a 'user' field that stores the userId
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