const express = require('express');
const Product = require('../models/Product');
const { verifyAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const MAX_ITEMS_PER_BUSINESS = 100000;

// Apply authentication to all product routes
router.use(verifyAuth);

// GET /api/products — list products with search, category, barcode filter, and pagination
router.get('/', async (req, res) => {
  try {
    const businessId = req.user.businessId || 'biz_default';
    const filter = { businessId };

    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { barcode: { $regex: req.query.search, $options: 'i' } },
        { sku: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    if (req.query.category && req.query.category !== 'All categories') {
      filter.category = req.query.category;
    }
    if (req.query.lowStock === 'true') {
      filter.$expr = { $lte: ['$quantity', '$lowStockLimit'] };
    }

    const limit = Math.min(Number(req.query.limit) || 1000, 2000);
    const skip = Number(req.query.skip) || 0;

    const [products, totalCount] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter)
    ]);

    res.json({
      products,
      totalCount,
      businessId,
      maxItemsLimit: MAX_ITEMS_PER_BUSINESS,
      remainingSlots: Math.max(0, MAX_ITEMS_PER_BUSINESS - totalCount)
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not load products: ' + error.message });
  }
});

// GET /api/products/barcode/:barcode — fast barcode lookup for scanning
router.get('/barcode/:barcode', async (req, res) => {
  try {
    const businessId = req.user.businessId || 'biz_default';
    const product = await Product.findOne({
      businessId,
      barcode: req.params.barcode.trim()
    });

    if (!product) {
      return res.status(404).json({ message: `No product found with barcode ${req.params.barcode}` });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Barcode lookup failed.' });
  }
});

// POST /api/products/stock-entry — Barcode scanning for fast stock entry / replenishment
router.post('/stock-entry', async (req, res) => {
  try {
    const businessId = req.user.businessId || 'biz_default';
    const { barcode, productId, quantityToAdd } = req.body;
    const amount = Number(quantityToAdd);

    if (!amount || amount < 1 || !Number.isInteger(amount)) {
      return res.status(400).json({ message: 'Quantity to add must be a whole number of at least 1.' });
    }

    const query = { businessId };
    if (barcode) {
      query.barcode = barcode.trim();
    } else if (productId) {
      query._id = productId;
    } else {
      return res.status(400).json({ message: 'Provide either a barcode or productId.' });
    }

    const product = await Product.findOneAndUpdate(
      query,
      { $inc: { quantity: amount } },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found for stock entry.' });
    }

    res.json({
      message: `Successfully added ${amount} units to "${product.name}".`,
      product
    });
  } catch (error) {
    res.status(500).json({ message: 'Stock entry failed.' });
  }
});

// POST /api/products — add a product (Enforces 100K item limit per business)
router.post('/', async (req, res) => {
  try {
    const businessId = req.user.businessId || 'biz_default';

    // Enforce 100K items limit per business
    const currentCount = await Product.countDocuments({ businessId });
    if (currentCount >= MAX_ITEMS_PER_BUSINESS) {
      return res.status(400).json({
        message: `Inventory capacity reached. Maximum limit of ${MAX_ITEMS_PER_BUSINESS.toLocaleString()} items per business is reached.`
      });
    }

    const { name, category, barcode, sku, price, costPrice, quantity, lowStockLimit, unit } = req.body;

    if (!name || price === '' || price === undefined || quantity === '' || quantity === undefined) {
      return res.status(400).json({ message: 'Name, price, and quantity are required.' });
    }
    if (Number(price) < 0 || Number(quantity) < 0 || Number(lowStockLimit ?? 5) < 0) {
      return res.status(400).json({ message: 'Price and quantities cannot be negative.' });
    }

    // Check if barcode already exists in this business
    if (barcode && barcode.trim()) {
      const existingBarcode = await Product.findOne({ businessId, barcode: barcode.trim() });
      if (existingBarcode) {
        return res.status(400).json({ message: `Barcode "${barcode}" is already assigned to "${existingBarcode.name}".` });
      }
    }

    const product = await Product.create({
      businessId,
      name: name.trim(),
      category: category || 'Other',
      barcode: barcode ? barcode.trim() : '',
      sku: sku ? sku.trim() : '',
      price: Number(price),
      costPrice: Number(costPrice || 0),
      quantity: Number(quantity),
      lowStockLimit: Number(lowStockLimit ?? 5),
      unit: unit || 'units'
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: 'Could not create product: ' + error.message });
  }
});

// PUT /api/products/:id — edit a product
router.put('/:id', async (req, res) => {
  try {
    const businessId = req.user.businessId || 'biz_default';
    const updates = { ...req.body };

    ['price', 'costPrice', 'quantity', 'lowStockLimit'].forEach((key) => {
      if (updates[key] !== undefined && updates[key] !== '') {
        updates[key] = Number(updates[key]);
      }
    });

    if (updates.price < 0 || updates.quantity < 0 || updates.lowStockLimit < 0) {
      return res.status(400).json({ message: 'Price and quantities cannot be negative.' });
    }

    // Check barcode conflict if changing barcode
    if (updates.barcode && updates.barcode.trim()) {
      const conflict = await Product.findOne({
        businessId,
        barcode: updates.barcode.trim(),
        _id: { $ne: req.params.id }
      });
      if (conflict) {
        return res.status(400).json({ message: `Barcode "${updates.barcode}" is already assigned to "${conflict.name}".` });
      }
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, businessId },
      updates,
      { new: true, runValidators: true }
    );

    if (!product) return res.status(404).json({ message: 'Product not found.' });
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: 'Could not update product: ' + error.message });
  }
});

// DELETE /api/products/:id — remove a product (Role-based: ADMIN ONLY)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const businessId = req.user.businessId || 'biz_default';
    const product = await Product.findOneAndDelete({ _id: req.params.id, businessId });

    if (!product) return res.status(404).json({ message: 'Product not found.' });
    res.json({ message: `Product "${product.name}" deleted successfully.` });
  } catch (error) {
    res.status(400).json({ message: 'Could not delete product.' });
  }
});

module.exports = router;
