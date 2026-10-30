# Smart Inventory Management System (MERN)

A high-performance, real-time smart inventory management platform designed for small businesses to eliminate stockouts, avoid overstocking, and automate predictive restocking.

---

## 🚀 Key Features Implemented

### 1. Functional Constraints
- **Low-Stock Alerts**: Automatic threshold crossing detection when a sale reduces stock to or below the configured `lowStockLimit`. Triggers immediate alert toasts, notification badges, and a dedicated alerts panel.
- **Predictive Restocking Suggestions**: Sales velocity calculation ($V_{\text{daily}} = \frac{\Delta \text{Units}}{\Delta \text{Days}}$) forecasting stockout runout dates and suggesting optimal reorder quantities based on target buffer stock and replenishment lead time.
- **Barcode Scanning for Stock Entry**: Camera viewfinder with live barcode detection (EAN-13, UPC, Code 128), hardware scanner gun detection, and quick stock replenishment (+1, +5, +10 units).
- **100,000 Item Limit per Business**: Hard limit enforcement with real-time capacity meters and quota tracking (`Business Limit: X / 100,000 items`).

### 2. Backend Constraints
- **Full Inventory CRUD**: Add, edit, view, search (by name or barcode), and delete products with business isolation.
- **Sales History & Audit Log**: Permanent sales transaction records storing item details, quantity, price, timestamp, and the staff member who processed the sale.
- **Role-Based Access Control (RBAC)**:
  - **Admin**: Full control (add, edit, delete products, manage quotas, view financial summaries).
  - **Staff**: Operational access (view catalogue, scan barcodes, record sales, replenish stock; item deletion is restricted).
  - Built-in JWT authentication & role-switching header support for flexible point-of-sale environments.
- **Engineered for 1M Daily Transactions**:
  - Replaced in-memory JavaScript loops with database-level MongoDB aggregation pipelines (`$match`, `$group`, `$facet`).
  - High-performance compound indexes:
    - Products: `{ businessId: 1, barcode: 1 }`, `{ businessId: 1, quantity: 1, lowStockLimit: 1 }`
    - Sales: `{ businessId: 1, createdAt: -1 }`, `{ businessId: 1, product: 1, createdAt: -1 }`
  - High-throughput batch sales ingestion endpoint (`POST /api/sales/batch`) for POS terminals and bulk synchronisation.

### 3. Viewing Constraints
- **Real-Time Operations Dashboard**: Summary cards for items, stock units, low-stock alerts, lifetime revenue, and today's sales.
- **Trend Charts**:
  - **Sales Velocity Trend**: Interactive responsive SVG chart showing daily revenue and transaction volume.
  - **Stock Health & Restocking Needs**: Visual distribution of Out-of-Stock, Low Stock, Healthy Stock, and High Supply.
- **Offline-First Support**:
  - Transparent client-side caching (`localStorage` / IndexedDB).
  - Outbox transaction queue (`offlineQueue`): Sales recorded during internet outages are queued locally and automatically synchronised when the connection is restored.
  - Real-time online/offline network indicator.

---

## 🛠️ Project Structure

```
fsd11/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── BarcodeScannerModal.jsx   # Camera & USB scanner integration
│   │   │   ├── PredictiveRestockView.jsx # Sales velocity & stockout forecasting
│   │   │   ├── TrendCharts.jsx           # SVG sales & restocking health charts
│   │   │   ├── ProductForm.jsx           # Product entry with barcode generator
│   │   │   ├── SaleForm.jsx              # POS checkout with threshold warnings
│   │   │   └── StatCard.jsx              # Dashboard KPI metric cards
│   │   ├── api.js                        # Offline-first API client
│   │   ├── offlineDb.js                  # Local caching & sync outbox
│   │   ├── App.jsx                       # Main application shell & role switcher
│   │   ├── main.jsx                      # React 18 bootstrap
│   │   └── styles.css                    # Responsive styling & themes
│   └── package.json
└── server/
    ├── middleware/
    │   └── auth.js                       # JWT auth & role guards
    ├── models/
    │   ├── Product.js                    # Product schema with compound indexes
    │   ├── Sale.js                       # Sales schema for 1M transaction loads
    │   └── User.js                       # RBAC user schema
    ├── routes/
    │   ├── auth.js                       # Authentication & account seeding
    │   ├── products.js                   # Products CRUD & barcode stock entry
    │   ├── sales.js                      # Sales transactions & batch processing
    │   └── analytics.js                  # Predictive restocking & trend charts
    ├── server.js                         # Express server with aggregation endpoints
    ├── test-system.js                    # Automated integration test suite
    └── package.json
```

---

## 🏁 Quickstart Guide

### 1. Prerequisites
- **Node.js**: v18 or newer (tested with v26)
- **MongoDB**: Running locally on `mongodb://127.0.0.1:27017` or a MongoDB Atlas URI

### 2. Start Backend Server
```bash
cd server
npm install
npm run dev
```
*API will start on `http://localhost:5000`.*  
*Default demo accounts are automatically initialized:*
- **Admin**: `admin@stockwise.com` / `admin123`
- **Staff**: `staff@stockwise.com` / `staff123`

### 3. Start Frontend Client
```bash
cd client
npm install
npm run dev
```
*Vite dev server will start on `http://localhost:5173`.*

### 4. Run Automated Integration Tests
```bash
cd server
node test-system.js
```

---

## 📡 API Endpoints Reference

### Authentication & Roles
- `POST /api/auth/register` — Register a new admin or staff user
- `POST /api/auth/login` — Authenticate and receive JWT token
- `GET /api/auth/me` — Retrieve current authenticated user profile

### Products & Inventory
- `GET /api/products` — List products (search, category, pagination, 100K capacity)
- `GET /api/products/barcode/:barcode` — Fast barcode product lookup
- `POST /api/products` — Register new product (enforces 100K item limit)
- `POST /api/products/stock-entry` — Replenish stock by barcode
- `PUT /api/products/:id` — Update product details
- `DELETE /api/products/:id` — Remove product (*Admin only*)

### Sales & High-Volume Transactions
- `POST /api/sales` — Record single transaction with atomic decrement & threshold crossing alert
- `POST /api/sales/batch` — Bulk transaction processing for high throughput (1M daily transactions)
- `GET /api/sales` — Paginated sales audit history

### Analytics & AI Predictions
- `GET /api/analytics/predictive-restock` — Sales velocity, stockout runway, and recommended reorder quantities
- `GET /api/analytics/trends` — 7-day sales trend and inventory health distribution
- `GET /api/dashboard` — Aggregated KPI metrics directly computed via database pipelines
