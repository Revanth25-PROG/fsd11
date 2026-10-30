const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const { verifyAuth } = require('../middleware/auth');

const router = express.Router();

router.use(verifyAuth);

// GET /api/analytics/predictive-restock — Predictive restocking suggestions based on sales trends
router.get('/predictive-restock', async (req, res) => {
  try {
    const businessId = req.user.businessId || 'biz_default';
    const daysWindow = Number(req.query.days) || 14;
    const targetBufferDays = Number(req.query.buffer) || 14; // How many days of stock we want on hand

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysWindow);

    // 1. Group sales by product over the evaluation period using MongoDB aggregation
    const salesVelocity = await Sale.aggregate([
      {
        $match: {
          businessId,
          createdAt: { $gte: cutoffDate }
        }
      },
      {
        $group: {
          _id: '$product',
          totalQuantitySold: { $sum: '$quantity' },
          totalRevenue: { $sum: '$total' },
          transactionCount: { $sum: 1 }
        }
      }
    ]);

    const velocityMap = new Map();
    for (const item of salesVelocity) {
      if (item._id) {
        velocityMap.set(item._id.toString(), {
          totalSold: item.totalQuantitySold,
          revenue: item.totalRevenue,
          transactions: item.transactionCount,
          dailyRate: item.totalQuantitySold / daysWindow
        });
      }
    }

    // 2. Fetch all products for this business
    const products = await Product.find({ businessId }).sort({ quantity: 1 }).lean();

    // 3. Compute predictive indicators for each product
    const predictions = products.map((product) => {
      const stats = velocityMap.get(product._id.toString()) || {
        totalSold: 0,
        revenue: 0,
        transactions: 0,
        dailyRate: 0
      };

      const dailyRate = Number(stats.dailyRate.toFixed(2));
      let daysUntilStockout = 999;
      if (dailyRate > 0) {
        daysUntilStockout = Number((product.quantity / dailyRate).toFixed(1));
      } else if (product.quantity === 0) {
        daysUntilStockout = 0;
      }

      // Reorder quantity calculation based on target buffer days + minimum threshold
      const targetQuantity = Math.ceil(dailyRate * targetBufferDays);
      const neededForBuffer = Math.max(0, targetQuantity - product.quantity);
      // If below lowStockLimit, ensure we at least reorder up to 2x lowStockLimit
      const neededForSafety = Math.max(0, (product.lowStockLimit * 2) - product.quantity);
      const suggestedReorder = Math.max(neededForBuffer, neededForSafety);

      // Urgency determination
      let urgency = 'HEALTHY';
      let urgencyColor = 'good';
      if (product.quantity === 0) {
        urgency = 'OUT_OF_STOCK';
        urgencyColor = 'critical';
      } else if (daysUntilStockout <= 3 || product.quantity <= product.lowStockLimit) {
        urgency = 'CRITICAL';
        urgencyColor = 'critical';
      } else if (daysUntilStockout <= 7) {
        urgency = 'REORDER_SOON';
        urgencyColor = 'warning';
      } else if (daysUntilStockout > 60 && dailyRate > 0) {
        urgency = 'OVERSTOCKED';
        urgencyColor = 'info';
      }

      return {
        productId: product._id,
        name: product.name,
        category: product.category,
        barcode: product.barcode,
        currentStock: product.quantity,
        lowStockLimit: product.lowStockLimit,
        price: product.price,
        costPrice: product.costPrice || 0,
        unitsSoldInWindow: stats.totalSold,
        dailySalesRate: dailyRate,
        daysUntilStockout,
        suggestedReorderQuantity: suggestedReorder,
        estimatedReorderCost: Number((suggestedReorder * (product.costPrice || product.price * 0.7)).toFixed(2)),
        urgency,
        urgencyColor
      };
    });

    // Sort predictions: Most urgent (critical/out of stock) first
    const urgencyWeight = { OUT_OF_STOCK: 0, CRITICAL: 1, REORDER_SOON: 2, HEALTHY: 3, OVERSTOCKED: 4 };
    predictions.sort((a, b) => {
      const diff = urgencyWeight[a.urgency] - urgencyWeight[b.urgency];
      if (diff !== 0) return diff;
      return a.daysUntilStockout - b.daysUntilStockout;
    });

    const summary = {
      evaluatedDays: daysWindow,
      criticalCount: predictions.filter((p) => p.urgency === 'CRITICAL' || p.urgency === 'OUT_OF_STOCK').length,
      reorderSoonCount: predictions.filter((p) => p.urgency === 'REORDER_SOON').length,
      healthyCount: predictions.filter((p) => p.urgency === 'HEALTHY').length,
      overstockedCount: predictions.filter((p) => p.urgency === 'OVERSTOCKED').length,
      totalSuggestedUnits: predictions.reduce((sum, p) => sum + p.suggestedReorderQuantity, 0)
    };

    res.json({ summary, predictions });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate predictive restocking suggestions: ' + error.message });
  }
});

// GET /api/analytics/trends — Trend charts data (7-day/30-day sales and restocking needs)
router.get('/trends', async (req, res) => {
  try {
    const businessId = req.user.businessId || 'biz_default';
    const days = Math.min(Number(req.query.days) || 7, 30);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    // Daily sales trend aggregation
    const salesTrend = await Sale.aggregate([
      {
        $match: {
          businessId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          totalRevenue: { $sum: '$total' },
          unitsSold: { $sum: '$quantity' },
          transactionCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Build complete date range even for days with 0 sales
    const trendMap = new Map(salesTrend.map((d) => [d._id, d]));
    const dailyData = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      const record = trendMap.get(key) || { totalRevenue: 0, unitsSold: 0, transactionCount: 0 };
      dailyData.push({
        date: key,
        label,
        revenue: record.totalRevenue,
        unitsSold: record.unitsSold,
        transactions: record.transactionCount
      });
    }

    // Stock health distribution
    const [allProducts, lowStockProducts] = await Promise.all([
      Product.find({ businessId }).select('category quantity lowStockLimit').lean(),
      Product.find({
        businessId,
        $expr: { $lte: ['$quantity', '$lowStockLimit'] }
      }).lean()
    ]);

    const stockHealth = {
      outOfStock: allProducts.filter((p) => p.quantity === 0).length,
      lowStock: allProducts.filter((p) => p.quantity > 0 && p.quantity <= p.lowStockLimit).length,
      healthy: allProducts.filter((p) => p.quantity > p.lowStockLimit && p.quantity <= p.lowStockLimit * 5).length,
      highStock: allProducts.filter((p) => p.quantity > p.lowStockLimit * 5).length
    };

    res.json({
      salesTrend: dailyData,
      stockHealth,
      lowStockAlertsCount: lowStockProducts.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate trend data: ' + error.message });
  }
});

module.exports = router;
