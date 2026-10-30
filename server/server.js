require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const Product = require('./models/Product');
const Sale = require('./models/Sale');
const User = require('./models/User');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const saleRoutes = require('./routes/sales');
const analyticsRoutes = require('./routes/analytics');
const { verifyAuth } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Smart Inventory API is running.');
});

// Mount modular API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/analytics', analyticsRoutes);

// High-performance Dashboard API using database-level aggregations
// (Designed to handle 100K products and 1M transactions without memory exhaustion)
app.get('/api/dashboard', verifyAuth, async (req, res) => {
  try {
    const businessId = req.user.businessId || 'biz_default';
    const MAX_ITEMS = 100000;

    // Run parallel aggregation pipelines directly on the database engine
    const [productStats, lowStockProducts, salesStats, todaySalesStats] = await Promise.all([
      // 1. Total products count and total units in inventory
      Product.aggregate([
        { $match: { businessId } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalUnits: { $sum: '$quantity' },
            inventoryValue: { $sum: { $multiply: ['$quantity', '$price'] } }
          }
        }
      ]),

      // 2. Low stock products list (indexed query)
      Product.find({
        businessId,
        $expr: { $lte: ['$quantity', '$lowStockLimit'] }
      })
        .sort({ quantity: 1 })
        .limit(20)
        .lean(),

      // 3. Lifetime Sales aggregates
      Sale.aggregate([
        { $match: { businessId } },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$total' },
            totalTransactions: { $sum: 1 },
            unitsSold: { $sum: '$quantity' }
          }
        }
      ]),

      // 4. Today's sales aggregates
      Sale.aggregate([
        {
          $match: {
            businessId,
            createdAt: {
              $gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        },
        {
          $group: {
            _id: null,
            todaySales: { $sum: '$total' },
            todayTransactions: { $sum: 1 }
          }
        }
      ])
    ]);

    const pStat = productStats[0] || { totalProducts: 0, totalUnits: 0, inventoryValue: 0 };
    const sStat = salesStats[0] || { totalSales: 0, totalTransactions: 0, unitsSold: 0 };
    const tStat = todaySalesStats[0] || { todaySales: 0, todayTransactions: 0 };

    res.json({
      totalProducts: pStat.totalProducts,
      totalUnits: pStat.totalUnits,
      inventoryValue: pStat.inventoryValue,
      maxItemsLimit: MAX_ITEMS,
      limitUsagePercent: Number(((pStat.totalProducts / MAX_ITEMS) * 100).toFixed(2)),
      lowStockProducts,
      lowStockCount: lowStockProducts.length,
      totalSales: sStat.totalSales,
      totalTransactions: sStat.totalTransactions,
      todaySales: tStat.todaySales,
      todayTransactions: tStat.todayTransactions,
      userRole: req.user.role,
      userName: req.user.name
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not load dashboard: ' + error.message });
  }
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_inventory';

// Auto-seed default accounts on start if empty
async function initDefaultData() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      await User.create([
        {
          name: 'Shop Admin',
          email: 'admin@stockwise.com',
          password: 'admin123',
          role: 'admin',
          businessId: 'biz_default'
        },
        {
          name: 'Store Staff',
          email: 'staff@stockwise.com',
          password: 'staff123',
          role: 'staff',
          businessId: 'biz_default'
        }
      ]);
      console.log('Default accounts initialized: admin@stockwise.com (admin), staff@stockwise.com (staff)');
    }
  } catch (err) {
    console.error('Data initialization notice:', err.message);
  }
}

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await initDefaultData();
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  })
  .catch((error) => {
    console.error('Could not connect to MongoDB:', error.message);
    process.exit(1);
  });
