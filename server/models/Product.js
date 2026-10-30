const mongoose = require('mongoose');

// One document represents one inventory product in a business
const productSchema = new mongoose.Schema(
  {
    businessId: { type: String, required: true, default: 'biz_default', index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, default: 'Other' },
    barcode: { type: String, trim: true, default: '' },
    sku: { type: String, trim: true, default: '' },
    price: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, min: 0, default: 0 },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    lowStockLimit: { type: Number, required: true, min: 0, default: 5 },
    unit: { type: String, default: 'units' }
  },
  { timestamps: true }
);

// High-performance compound indexes for scale (up to 100K items per business & 1M daily lookups)
productSchema.index({ businessId: 1, barcode: 1 });
productSchema.index({ businessId: 1, quantity: 1, lowStockLimit: 1 });
productSchema.index({ businessId: 1, category: 1 });
productSchema.index({ businessId: 1, name: 1 });
productSchema.index({ businessId: 1, createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);
