const express = require('express');
const Product = require('../models/Product');

const router = express.Router();

// GET /api/products?search=rice&category=Food
router.get('/', async (req, res) => {
  try {
    const filter = {};

    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' };
    }
    if (req.query.category && req.query.category !== 'All categories') {
      filter.category = req.query.category;
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Could not load products.' });
  }
});

// POST /api/products - add a product.
router.post('/', async (req, res) => {
  try {
    const { name, category, price, quantity, lowStockLimit } = req.body;

    if (!name || price === '' || price === undefined || quantity === '' || quantity === undefined) {
      return res.status(400).json({ message: 'Name, price, and quantity are required.' });
    }
    if (Number(price) < 0 || Number(quantity) < 0 || Number(lowStockLimit ?? 5) < 0) {
      return res.status(400).json({ message: 'Price and quantities cannot be negative.' });
    }

    const product = await Product.create({
      name,
      category: category || 'Other',
      price: Number(price),
      quantity: Number(quantity),
      lowStockLimit: Number(lowStockLimit ?? 5)
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: 'Could not create product. Check the entered values.' });
  }
});

// PUT /api/products/:id - edit a product.
router.put('/:id', async (req, res) => {
  try {
    const updates = { ...req.body };
    ['price', 'quantity', 'lowStockLimit'].forEach((key) => {
      if (updates[key] !== undefined) updates[key] = Number(updates[key]);
    });

    if (updates.price < 0 || updates.quantity < 0 || updates.lowStockLimit < 0) {
      return res.status(400).json({ message: 'Price and quantities cannot be negative.' });
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: 'Could not update product.' });
  }
});

// DELETE /api/products/:id - remove a product.
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    res.json({ message: 'Product deleted.' });
  } catch (error) {
    res.status(400).json({ message: 'Could not delete product.' });
  }
});

module.exports = router;
