const express = require('express');
const Product = require('../models/Product');
const Sale = require('../models/Sale');

const router = express.Router();

// GET /api/sales - show recent sales first.
router.get('/', async (req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 }).limit(100);
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Could not load sales.' });
  }
});

// POST /api/sales - record sale and decrease product stock.
router.post('/', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const soldQuantity = Number(quantity);

    if (!productId || !Number.isInteger(soldQuantity) || soldQuantity < 1) {
      return res.status(400).json({ message: 'Choose a product and enter a whole quantity of at least 1.' });
    }

    // This conditional update prevents a sale from reducing stock below zero.
    const product = await Product.findOneAndUpdate(
      { _id: productId, quantity: { $gte: soldQuantity } },
      { $inc: { quantity: -soldQuantity } },
      { new: true }
    );

    if (!product) {
      const exists = await Product.exists({ _id: productId });
      return res.status(exists ? 400 : 404).json({
        message: exists ? 'Not enough stock for this sale.' : 'Product not found.'
      });
    }

    const sale = await Sale.create({
      product: product._id,
      productName: product.name,
      quantity: soldQuantity,
      unitPrice: product.price,
      total: soldQuantity * product.price
    });

    res.status(201).json({ sale, product });
  } catch (error) {
    res.status(500).json({ message: 'Could not record sale.' });
  }
});

module.exports = router;
