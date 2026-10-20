# Smart Inventory Management System (MERN)

A beginner-friendly inventory app built with MongoDB, Express, React, and Node.js.

## Features
- Dashboard summary cards and low-stock alerts
- Add, edit, delete, search, and filter products
- Record a sale; stock is reduced automatically
- Sales history
- Responsive white-and-green UI

## Requirements
- Node.js 18 or newer
- MongoDB running locally, or a MongoDB Atlas connection string

## 1. Start the backend
Open a terminal in `server`:
```bash
npm install
```

Copy `.env.example` to `.env`, then check `MONGO_URI`.

```bash
npm run dev
```

The API runs at `http://localhost:5000`.

## 2. Start the frontend
Open a second terminal in `client`:

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).

## MongoDB setup
If using local MongoDB, make sure the MongoDB service is running. The example URI is:
`mongodb://127.0.0.1:27017/smart_inventory`

If using MongoDB Atlas, replace `MONGO_URI` in `server/.env` with your Atlas connection string.

## Main API routes
- `GET /api/products` — list products; optional `search` and `category` query parameters
- `POST /api/products` — create product
- `PUT /api/products/:id` — update product
- `DELETE /api/products/:id` — delete product
- `POST /api/sales` — record a sale and reduce stock
- `GET /api/sales` — latest sales
- `GET /api/dashboard` — dashboard totals and low-stock products

## Beginner notes
- `client/src/App.jsx` controls page navigation and loads data.
- `client/src/api.js` contains the frontend's API calls.
- `server/models` defines MongoDB document shapes.
- `server/routes` contains the API logic.
- `client/src/styles.css` controls the design.

This is a learning/demo application. It does not yet include production-grade authentication, role permissions, or payment processing. Do not expose it publicly with real business data before adding security and validation appropriate for production.
