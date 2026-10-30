const mongoose = require('mongoose');

// Sales record every transaction for auditing, reports, and predictive restocking
const saleSchema = new mongoose.Schema(
  {
    businessId: { type: String, required: true, default: 'biz_default', index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    barcode: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    soldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    soldByName: { type: String, default: 'Staff' }
  },
  { timestamps: true }
);

// High-performance indexes to handle 1M daily transactions and rapid predictive analytics
saleSchema.index({ businessId: 1, createdAt: -1 });
saleSchema.index({ businessId: 1, product: 1, createdAt: -1 });
saleSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Sale', saleSchema);
