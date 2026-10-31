const express = require('express');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const { verifyAuth } = require('../middleware/auth');

const router = express.Router();

router.use(verifyAuth);

// GET /api/sales — fetch recent sales history (paginated & indexed)
router.get('/', async (req, res) => {
  try {
    const businessId = req.user.businessId || 'biz_default';
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const skip = Number(req.query.skip) || 0;

    const query = { businessId };
    if (req.query.productId) {
      query.product = req.query.productId;
    }

    const [sales, totalSalesCount] = await Promise.all([
      Sale.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Sale.countDocuments(query)
    ]);

    res.set('X-Total-Sales-Count', totalSalesCount);
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Could not load sales history.' });
  }
});

// POST /api/sales — record single sale with atomic decrement & threshold crossing alert
router.post('/', async (req, res) => {
  try {
    const businessId = req.user.businessId || 'biz_default';
    const { productId, barcode, quantity } = req.body;
    const soldQuantity = Number(quantity);

    if ((!productId && !barcode) || !Number.isInteger(soldQuantity) || soldQuantity < 1) {
      return res.status(400).json({ message: 'Specify a product or barcode and enter a quantity of at least 1.' });
    }

    const productQuery = { businessId };
    if (productId) productQuery._id = productId;
    else if (barcode) productQuery.barcode = barcode.trim();

    // 1. Fetch current product state before reduction to verify threshold crossing
    const existingProduct = await Product.findOne(productQuery);
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found.' });
    }
    if (existingProduct.quantity < soldQuantity) {
      return res.status(400).json({
        message: `Insufficient stock. Only ${existingProduct.quantity} units available.`
      });
    }

    const previousQuantity = existingProduct.quantity;

    // 2. Atomic decrement ensuring concurrency safety under high transaction load
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: existingProduct._id, quantity: { $gte: soldQuantity } },
      { $inc: { quantity: -soldQuantity } },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(400).json({ message: 'Concurrent sale conflict or insufficient stock.' });
    }

    // 3. Record transaction in sales history
    const sale = await Sale.create({
      businessId,
      product: updatedProduct._id,
      productName: updatedProduct.name,
      barcode: updatedProduct.barcode || '',
      quantity: soldQuantity,
      unitPrice: updatedProduct.price,
      total: soldQuantity * updatedProduct.price,
      soldBy: req.user.id !== 'demo-user-id' ? req.user.id : undefined,
      soldByName: req.user.name || 'Staff'
    });

    // 4. Low Stock Alert Logic: Did this sale cross the threshold?
    const crossedThreshold = previousQuantity > updatedProduct.lowStockLimit && updatedProduct.quantity <= updatedProduct.lowStockLimit;
    const isCurrentlyLow = updatedProduct.quantity <= updatedProduct.lowStockLimit;

    let alert = null;
    if (crossedThreshold || isCurrentlyLow) {
      alert = {
        triggered: true,
        crossedThreshold,
        severity: updatedProduct.quantity === 0 ? 'CRITICAL' : 'WARNING',
        message: updatedProduct.quantity === 0
          ? `CRITICAL ALERT: "${updatedProduct.name}" is completely OUT OF STOCK!`
          : `LOW STOCK ALERT: "${updatedProduct.name}" crossed threshold (${updatedProduct.quantity} left, limit is ${updatedProduct.lowStockLimit})!`,
        product: updatedProduct
      };
    }

    res.status(201).json({ sale, product: updatedProduct, alert });
  } catch (error) {
    res.status(500).json({ message: 'Could not record sale: ' + error.message });
  }
});

// POST /api/sales/batch — High-throughput batch sales ingestion (1M daily transactions handling)
router.post('/batch', async (req, res) => {
  try {
    const businessId = req.user.businessId || 'biz_default';
    const { items } = req.body; // array of { productId, barcode, quantity }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items array is required for batch transaction.' });
    }

    const results = [];
    const alerts = [];

    // Process transactions sequentially or in atomic chunks
    for (const item of items) {
      const soldQuantity = Number(item.quantity);
      if (!soldQuantity || soldQuantity < 1) continue;

      const query = { businessId };
      if (item.productId) query._id = item.productId;
      else if (item.barcode) query.barcode = item.barcode.trim();
      else continue;

      const product = await Product.findOne(query);
      if (!product || product.quantity < soldQuantity) continue;

      const prevQty = product.quantity;
      const updated = await Product.findOneAndUpdate(
        { _id: product._id, quantity: { $gte: soldQuantity } },
        { $inc: { quantity: -soldQuantity } },
        { new: true }
      );

      if (!updated) continue;

      const sale = await Sale.create({
        businessId,
        product: updated._id,
        productName: updated.name,
        barcode: updated.barcode || '',
        quantity: soldQuantity,
        unitPrice: updated.price,
        total: soldQuantity * updated.price,
        soldByName: req.user.name || 'Staff'
      });

      results.push(sale);

      if (prevQty > updated.lowStockLimit && updated.quantity <= updated.lowStockLimit) {
        alerts.push({
          productName: updated.name,
          quantity: updated.quantity,
          limit: updated.lowStockLimit
        });
      }
    }

    res.status(201).json({
      processedCount: results.length,
      sales: results,
      alerts
    });
  } catch (error) {
    res.status(500).json({ message: 'Batch transaction failed: ' + error.message });
  }
});

module.exports = router;
