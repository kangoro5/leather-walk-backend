// databse connection
const mongoose = require('mongoose');
const dbURI = process.env.dbURI;
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Database connected successfully'))
    .catch(err => console.error('Database connection error:', err));
// Export the mongoose connection
module.exports = mongoose.connection;

