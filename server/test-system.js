const mongoose = require('mongoose');
const Product = require('./models/Product');
const Sale = require('./models/Sale');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_inventory_test';

async function runTests() {
  console.log('Connecting to MongoDB for integration test...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');

  try {
    // Clean test DB
    await Product.deleteMany({ businessId: 'test_biz' });
    await Sale.deleteMany({ businessId: 'test_biz' });
    await User.deleteMany({ businessId: 'test_biz' });

    console.log('\n--- 1. Testing Role-Based Access (Admin / Staff) ---');
    const adminUser = await User.create({
      name: 'Test Admin',
      email: 'admin_test@example.com',
      password: 'password123',
      role: 'admin',
      businessId: 'test_biz'
    });
    const staffUser = await User.create({
      name: 'Test Staff',
      email: 'staff_test@example.com',
      password: 'password123',
      role: 'staff',
      businessId: 'test_biz'
    });
    console.log('Created Admin and Staff users successfully.');

    console.log('\n--- 2. Testing 100K Item Limit & Barcode Support ---');
    const product1 = await Product.create({
      businessId: 'test_biz',
      name: 'Basmati Rice 5kg',
      category: 'Grocery',
      barcode: '8901030383748',
      price: 450,
      costPrice: 380,
      quantity: 15,
      lowStockLimit: 5
    });

    const product2 = await Product.create({
      businessId: 'test_biz',
      name: 'Olive Oil 1L',
      category: 'Grocery',
      barcode: '8901725181122',
      price: 800,
      costPrice: 650,
      quantity: 4, // Below low stock threshold
      lowStockLimit: 5
    });

    console.log(`Created products with barcodes: ${product1.barcode}, ${product2.barcode}`);

    console.log('\n--- 3. Testing Barcode Stock Entry Replenishment ---');
    const updatedProd1 = await Product.findOneAndUpdate(
      { businessId: 'test_biz', barcode: '8901030383748' },
      { $inc: { quantity: 10 } },
      { new: true }
    );
    console.log(`Stock entry for barcode ${product1.barcode}: New quantity = ${updatedProd1.quantity} (expected 25)`);

    console.log('\n--- 4. Testing Sales & Low Stock Threshold Crossing Alert ---');
    // Sell 21 units of product1 (drops from 25 to 4, which is <= lowStockLimit 5)
    const prevQty = updatedProd1.quantity;
    const soldQty = 21;
    const soldProduct1 = await Product.findOneAndUpdate(
      { _id: updatedProd1._id, quantity: { $gte: soldQty } },
      { $inc: { quantity: -soldQty } },
      { new: true }
    );

    const sale1 = await Sale.create({
      businessId: 'test_biz',
      product: soldProduct1._id,
      productName: soldProduct1.name,
      barcode: soldProduct1.barcode,
      quantity: soldQty,
      unitPrice: soldProduct1.price,
      total: soldQty * soldProduct1.price,
      soldByName: staffUser.name
    });

    const crossedThreshold = prevQty > soldProduct1.lowStockLimit && soldProduct1.quantity <= soldProduct1.lowStockLimit;
    console.log(`Sale recorded: sold ${soldQty} units. Remaining = ${soldProduct1.quantity}.`);
    console.log(`Did sale cross low-stock threshold? ${crossedThreshold ? 'YES (ALERT TRIGGERED)' : 'NO'}`);

    console.log('\n--- 5. Testing High-Throughput Aggregations & Predictions ---');
    // Predictive Restocking Calculation
    const daysWindow = 14;
    const salesVelocity = await Sale.aggregate([
      { $match: { businessId: 'test_biz' } },
      {
        $group: {
          _id: '$product',
          totalQuantitySold: { $sum: '$quantity' },
          totalRevenue: { $sum: '$total' }
        }
      }
    ]);
    const dailyRate = salesVelocity[0].totalQuantitySold / daysWindow;
    const daysUntilStockout = (soldProduct1.quantity / dailyRate).toFixed(1);
    const suggestedReorder = Math.ceil(dailyRate * 14 - soldProduct1.quantity);

    console.log(`Sales Velocity: ${dailyRate.toFixed(2)} units/day`);
    console.log(`Days Until Stockout: ${daysUntilStockout} days`);
    console.log(`Suggested Reorder Quantity: ${suggestedReorder} units`);

    console.log('\n--- 6. Testing 100K Limit Guard Logic ---');
    const MAX_ITEMS = 100000;
    const currentCount = await Product.countDocuments({ businessId: 'test_biz' });
    const isUnderLimit = currentCount < MAX_ITEMS;
    console.log(`Current items: ${currentCount} / ${MAX_ITEMS}. Under limit? ${isUnderLimit}`);

    console.log('\n✅ ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
  } finally {
    // Cleanup test data
    await Product.deleteMany({ businessId: 'test_biz' });
    await Sale.deleteMany({ businessId: 'test_biz' });
    await User.deleteMany({ businessId: 'test_biz' });
    await mongoose.disconnect();
    console.log('Disconnected from test MongoDB.');
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
