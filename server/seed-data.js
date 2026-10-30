const mongoose = require('mongoose');
const Product = require('./models/Product');
const Sale = require('./models/Sale');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_inventory';

async function seedInitialData() {
  await mongoose.connect(MONGO_URI);

  const existingCount = await Product.countDocuments({ businessId: 'biz_default' });
  if (existingCount > 0) {
    console.log('Catalogue already contains products. Skipping seed.');
    await mongoose.disconnect();
    return;
  }

  console.log('Seeding initial smart inventory catalogue...');

  const products = [
    {
      businessId: 'biz_default',
      name: 'Basmati Rice (5kg Bag)',
      category: 'Grocery',
      barcode: '8901030383748',
      price: 499,
      costPrice: 410,
      quantity: 4, // Below lowStockLimit -> triggers alert!
      lowStockLimit: 10,
      unit: 'packs'
    },
    {
      businessId: 'biz_default',
      name: 'Refined Sunflower Oil (1L)',
      category: 'Grocery',
      barcode: '8901725181122',
      price: 165,
      costPrice: 135,
      quantity: 3, // Low stock!
      lowStockLimit: 8,
      unit: 'litres'
    },
    {
      businessId: 'biz_default',
      name: 'Whole Wheat Flour Atta (10kg)',
      category: 'Grocery',
      barcode: '8901058852615',
      price: 420,
      costPrice: 350,
      quantity: 28,
      lowStockLimit: 6,
      unit: 'packs'
    },
    {
      businessId: 'biz_default',
      name: 'Arabica Roasted Coffee Beans (500g)',
      category: 'Beverages',
      barcode: '8901262010014',
      price: 650,
      costPrice: 480,
      quantity: 14,
      lowStockLimit: 5,
      unit: 'packs'
    },
    {
      businessId: 'biz_default',
      name: 'Organic Green Tea (100 bags)',
      category: 'Beverages',
      barcode: '8901030491023',
      price: 240,
      costPrice: 170,
      quantity: 0, // Out of stock -> critical alert!
      lowStockLimit: 5,
      unit: 'boxes'
    },
    {
      businessId: 'biz_default',
      name: 'Almond Milk Unsweetened (1L)',
      category: 'Beverages',
      barcode: '8902080004128',
      price: 220,
      costPrice: 160,
      quantity: 19,
      lowStockLimit: 6,
      unit: 'litres'
    },
    {
      businessId: 'biz_default',
      name: 'Eco Dishwashing Liquid (500ml)',
      category: 'Household',
      barcode: '8901088052199',
      price: 110,
      costPrice: 75,
      quantity: 42,
      lowStockLimit: 10,
      unit: 'units'
    }
  ];

  const createdProducts = await Product.create(products);
  console.log(`Created ${createdProducts.length} demo products.`);

  // Create sample sales spanning the last 7 days for sales velocity and trend charts
  const sales = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const saleDate = new Date();
    saleDate.setDate(now.getDate() - i);
    saleDate.setHours(10 + (i % 8), (i * 13) % 60, 0, 0);

    // Sales of rice
    sales.push({
      businessId: 'biz_default',
      product: createdProducts[0]._id,
      productName: createdProducts[0].name,
      barcode: createdProducts[0].barcode,
      quantity: 2 + (i % 3),
      unitPrice: createdProducts[0].price,
      total: (2 + (i % 3)) * createdProducts[0].price,
      soldByName: i % 2 === 0 ? 'Shop Owner' : 'Alex Rivera (Staff)',
      createdAt: saleDate
    });

    // Sales of oil
    sales.push({
      businessId: 'biz_default',
      product: createdProducts[1]._id,
      productName: createdProducts[1].name,
      barcode: createdProducts[1].barcode,
      quantity: 3 + (i % 2),
      unitPrice: createdProducts[1].price,
      total: (3 + (i % 2)) * createdProducts[1].price,
      soldByName: 'Shop Owner',
      createdAt: saleDate
    });

    // Sales of coffee
    if (i % 2 === 0) {
      sales.push({
        businessId: 'biz_default',
        product: createdProducts[3]._id,
        productName: createdProducts[3].name,
        barcode: createdProducts[3].barcode,
        quantity: 1,
        unitPrice: createdProducts[3].price,
        total: createdProducts[3].price,
        soldByName: 'Alex Rivera (Staff)',
        createdAt: saleDate
      });
    }
  }

  await Sale.create(sales);
  console.log(`Created ${sales.length} historical sales for velocity & trend forecasting.`);

  await mongoose.disconnect();
  console.log('Seeding completed successfully.');
}

seedInitialData().catch(console.error);
