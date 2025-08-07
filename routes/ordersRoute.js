const express = require('express');
const router = express.Router();

// Import your Mongoose models
const Order = require('../models/OdersModel'); // Ensure this path is correct
const Product = require('../models/ProductModel'); // Ensure this path is correct
const User = require('../models/UserModel'); // Ensure this path is correct

// NOTE: Authentication/Authorization middleware is NOT used as per request.
// const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// --- Inlined Controller Logic (Route Handlers) ---

// @desc    Create new order
// @route   POST /api/orders
// @access  Public (WARNING: Highly insecure without authentication)
router.post('/', async (req, res) => {
    // IMPORTANT: Without 'protect' middleware, req.user will NOT exist.
    // You MUST now send 'userId' in the request body from the frontend,
    // or handle user identification differently (e.g., session-based).
    // For this example, we'll assume userId is passed in the body.
    const { userId, products, shippingInfo, paymentMethod, mpesaNumber, subtotalAmount, shippingCost, totalAmount } = req.body;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required to create an order.' });
    }
    if (!products || products.length === 0) {
        return res.status(400).json({ message: 'No order items' });
    }

    try {
        // You might want to validate if the userId actually exists in your User model
        const existingUser = await User.findById(userId);
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        let calculatedSubtotal = 0;
        const orderProducts = [];

        // --- Price Verification & Stock Check ---
        for (const item of products) {
            const product = await Product.findById(item.productId);

            if (!product) {
                return res.status(404).json({ message: `Product with ID ${item.productId} not found.` });
            }

            if (product.stock < item.quantity) {
                return res.status(400).json({ message: `Insufficient stock for ${product.name}. Available: ${product.stock}` });
            }

            // Verify price (still crucial for data integrity)
            if (Math.abs(product.price - item.price) > 0.01) {
                console.warn(`Price mismatch for product ${product.name}: Frontend sent ${item.price}, Backend has ${product.price}`);
            }

            calculatedSubtotal += product.price * item.quantity;

            // Prepare product data for the order schema (historical pricing)
            orderProducts.push({
                productId: product._id,
                quantity: item.quantity,
                priceAtTimeOfOrder: product.price,
                nameAtTimeOfOrder: product.name,
                imageUrlAtTimeOfOrder: product.imageUrl,
                sizeAtTimeOfOrder: item.size || 'N/A',
                colorAtTimeOfOrder: item.color || 'N/A'
            });

            // Decrement stock immediately (consider a transaction for robustness in production)
            product.stock -= item.quantity;
            await product.save();
        }

        const backendCalculatedTotal = calculatedSubtotal + shippingCost;

        // --- Payment Processing (Mock/Placeholder) ---
        let paymentStatus = 'Pending';
        if (paymentMethod === 'mpesa') {
            console.log(`Initiating Mpesa STK Push for ${mpesaNumber} with amount ${backendCalculatedTotal}`);
        } else if (paymentMethod === 'card') {
            console.log(`Processing card payment for ${backendCalculatedTotal}`);
        }

        // --- Create Order in DB ---
        const order = new Order({
            userId, // Now taken from req.body
            products: orderProducts,
            shippingInfo,
            paymentMethod,
            mpesaNumber: paymentMethod === 'mpesa' ? mpesaNumber : null,
            subtotalAmount: calculatedSubtotal,
            shippingCost,
            totalAmount: backendCalculatedTotal,
            paymentStatus,   
            orderStatus: 'Pending'
        });

        const createdOrder = await order.save();

        // --- Clear User's Cart ---
        // Assuming you store cart items within the User model or a separate Cart model
        await User.findByIdAndUpdate(userId, { $set: { cart: [] } }); // Example if cart is an array in User model

        res.status(201).json(createdOrder);

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

// @desc    Get orders for a specific user (WARNING: Now public, anyone can view any user's orders if they know the userId)
// @route   GET /api/orders/myorders/:userId
// @access  Public (Highly insecure)
router.get('/myorders/:userId', async (req, res) => {
    try {
        const { userId } = req.params; // Get userId from URL parameter

        const orders = await Order.find({ userId: userId })
                                   .populate('products.productId', 'name imageUrl price')
                                   .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

// @desc    Get a single order by ID (WARNING: Now public, anyone can view any order if they know its ID)
// @route   GET /api/orders/:id
// @access  Public (Highly insecure)
router.get('/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
                                 .populate('userId', 'username email')
                                 .populate('products.productId', 'name imageUrl price');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // No authorization check here as per request
        res.json(order);
    } catch (error) {
        console.error('Error fetching order by ID:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

// @desc    Get all orders (WARNING: Now public, anyone can view all orders)
// @route   GET /api/orders
// @access  Public (Highly insecure)
router.get('/', async (req, res) => {
    try {
        const orders = await Order.find()
                                   .populate('userId', 'username email')
                                   .populate('products.productId', 'name imageUrl price')
                                   .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

// @desc    Update order status (WARNING: Now public, anyone can change any order's status)
// @route   PUT /api/orders/:id/status
// @access  Public (Highly insecure)
router.put('/:id/status', async (req, res) => {
    const { orderStatus, trackingNumber, deliveredAt } = req.body;

    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (orderStatus) {
            order.orderStatus = orderStatus;
        }
        if (trackingNumber !== undefined) {
            order.trackingNumber = trackingNumber;
        }
        if (deliveredAt) {
            order.deliveredAt = deliveredAt;
        } else if (orderStatus === 'Delivered' && !order.deliveredAt) {
            order.deliveredAt = new Date();
        }

        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

// @desc    Update order payment status (WARNING: Now public, anyone can change any order's payment status)
// @route   PUT /api/orders/:id/payment-status
// @access  Public (Highly insecure)
router.put('/:id/payment-status', async (req, res) => {
    const { paymentStatus } = req.body;

    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (!['Pending', 'Paid', 'Failed', 'Refunded'].includes(paymentStatus)) {
            return res.status(400).json({ message: 'Invalid payment status' });
        }

        order.paymentStatus = paymentStatus;
        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

module.exports = router;