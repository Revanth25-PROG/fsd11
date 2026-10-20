const mongoose = require('mongoose');

// One document represents one product in the shop.
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, default: 'Other' },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    lowStockLimit: { type: Number, required: true, min: 0, default: 5 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
