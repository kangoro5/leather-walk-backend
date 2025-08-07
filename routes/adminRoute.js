// admin routes

// user routes

const express = require('express');
const router = express.Router();
const User = require('../models/AdminModel');

// Create a new user
router.post('/users', async (req, res) => {
    try {
        const { email, username, phone } = req.body; // Destructure all unique fields

        // Check if a user with the provided email already exists
        const existingUserByEmail = await User.findOne({ email });
        if (existingUserByEmail) {
            return res.status(409).send({ error: 'User with this email already exists.' });
        }

        // Check if a user with the provided username already exists
        const existingUserByUsername = await User.findOne({ username });
        if (existingUserByUsername) {
            return res.status(409).send({ error: 'User with this username already exists.' });
        }

        // Check if a user with the provided phone already exists
        const existingUserByPhone = await User.findOne({ phone });
        if (existingUserByPhone) {
            return res.status(409).send({ error: 'User with this phone number already exists.' });
        }

        const user = new User(req.body);
        await user.save();
        res.status(201).send(user);
    } catch (error) {
        // This catches Mongoose unique constraint errors (code 11000)
        // as a fallback, providing a more generic but still informative message
        // if the `findOne` checks above were somehow bypassed or raced.
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0]; // Get the field that caused the unique error
            return res.status(409).send({ error: `${field} already exists.` });
        }
        // Handle other potential validation errors or unexpected issues
        res.status(400).send(error);
    }
});

// Get all users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).send(users);
    } catch (error) {
        res.status(500)
        .send({ error: 'Failed to fetch users' });
    }
});

// Get a user by ID
router.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).send({ error: 'User not found' });
        }
        res.status(200).send(user);
    } catch (error) {
        res.status(500).send({ error: 'Failed to fetch user' });
    }
});

//get user by email 
router.get('/users/email/:email', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email });
        if (!user) {
            return res.status(404).send({ error: 'User not found' });
        }
        res.status(200).send(user);
    } catch (error) {
        res.status(500).send({ error: 'Failed to fetch user by email' });
    }
});

// Update a user by ID
router.put('/users/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!user) {
            return res.status(404).send({ error: 'User not found' });
        }
        res.status(200).send(user);
    } catch (error) {
        res.status(400).send({ error: 'Failed to update user' });
    }
});

// Delete a user by ID
router.delete('/users/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).send({ error: 'User not found' });
        }
        res.status(200).send({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).send({ error: 'Failed to delete user' });
    }
});

// Login with username or email and password use jwt token
router.post('/login', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const user = await User.findOne({
            $or: [{ username }, { email }]
        });
        if (!user || user.password !== password) {
            return res.status(401).send({ error: 'Invalid credentials' });
        }
        // Here you would typically generate a JWT token and send it back
        res.status(200).send({ message: 'Login successful', user });
    } catch (error) {
        res.status(500).send({ error: 'Login failed' });
    }
});

// Export the router
module.exports = router;
