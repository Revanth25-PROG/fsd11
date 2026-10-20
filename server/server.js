require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Product = require('./models/Product');
const Sale = require('./models/Sale');
const productRoutes = require('./routes/products');
const saleRoutes = require('./routes/sales');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Smart Inventory API is running.');
});

app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);

// Dashboard numbers are calculated from the current database data.
app.get('/api/dashboard', async (req, res) => {
  try {
    const [totalProducts, products, sales] = await Promise.all([
      Product.countDocuments(),
      Product.find(),
      Sale.find()
    ]);

    const totalUnits = products.reduce((sum, product) => sum + product.quantity, 0);
    const lowStockProducts = products.filter(
      (product) => product.quantity <= product.lowStockLimit
    );
    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);

    res.json({ totalProducts, totalUnits, lowStockProducts, totalSales });
  } catch (error) {
    res.status(500).json({ message: 'Could not load dashboard.' });
  }
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_inventory';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  })
  .catch((error) => {
    console.error('Could not connect to MongoDB:', error.message);
    console.error('Check that MongoDB is running and MONGO_URI in .env is correct.');
    process.exit(1);
  });
