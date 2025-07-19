const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const app = express();
const dbConfig= require('./database/db');
const bodyParser = require('body-parser');
const userRoutes= require('./routes/userRoute');
const productRoutes = require('./routes/productRoute');
const cors = require('cors');

// Middleware to parse JSON requests
app.use(express.json());
// Middleware to handle CORS
app.use(cors());
// Middleware to parse URL-encoded data
app.use(bodyParser.urlencoded({ extended: true }));
// databse configuration
dbConfig;



app.use('/api', userRoutes);
app.use('/api', productRoutes);

app.get('/', (req, res) => {
  res.send('welcome to the Leather walk online shop API');
}
);

app.listen(8000, () => {
  console.log('Server is running on http://localhost:8000');
});
