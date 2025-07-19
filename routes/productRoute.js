// product route

const express = require('express');
const Product = require('../models/ProductModel');

const router = express.Router();

// Create a new product
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
        res.status(500)
        .send(error);
    }
});

// Update a product by ID
router.patch('/products/:id', async (req, res) => {
    const _id = req.params.id;
    const updates = Object.keys(req.body);
    const allowedUpdates = ['name', 'color', 'quantity', 'size', 'price', 'image'];
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

// Delete a product by ID
router.delete('/products/:id', async (req, res) => {
    const _id = req.params.id;
    try {
        const product = await Product.findByIdAndDelete(_id);
        if (!product) {
            return res.status(404).send();
        }
        res.status(200).send(product);
    } catch (error) {
        res.status(500).send(error);
    }
});

module.exports = router;