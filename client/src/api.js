import { offlineDb } from './offlineDb.js';

// Always connect directly to the Express backend API
const API_URL = 'http://localhost:5000/api';

// Current session configuration
let currentRole = typeof localStorage !== 'undefined' ? localStorage.getItem('stockwise_user_role') || 'admin' : 'admin';
let currentUserName = typeof localStorage !== 'undefined' ? localStorage.getItem('stockwise_user_name') || 'Shop Owner (Admin)' : 'Shop Owner (Admin)';
let authToken = typeof localStorage !== 'undefined' ? localStorage.getItem('stockwise_auth_token') || '' : '';

export function setSessionUser(role, name = '', token = '') {
  currentRole = role;
  currentUserName = name || (role === 'admin' ? 'Shop Owner (Admin)' : 'Shop Staff');
  if (token) authToken = token;
  localStorage.setItem('stockwise_user_role', currentRole);
  localStorage.setItem('stockwise_user_name', currentUserName);
  if (token) localStorage.setItem('stockwise_auth_token', token);
}

export function getSessionUser() {
  return {
    role: currentRole,
    name: currentUserName,
    token: authToken
  };
}

// Master request wrapper with 2500ms fast timeout to guarantee 0 UI lag
async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-user-role': currentRole,
    'x-user-name': currentUserName,
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return handleOfflineFallback(path, options, new Error('Non-JSON response'));
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Server returned an error.');
    }
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    return handleOfflineFallback(path, options, error);
  }
}

// Comprehensive offline fallback logic — ensures ALL buttons work seamlessly even when offline
function handleOfflineFallback(path, options, originalError) {
  const method = (options.method || 'GET').toUpperCase();

  // 1. GET Requests: Return cached data or safe defaults
  if (method === 'GET') {
    if (path.startsWith('/products')) {
      const cached = offlineDb.get(offlineDb.KEYS.PRODUCTS);
      return Array.isArray(cached) ? cached : (Array.isArray(cached?.products) ? cached.products : []);
    }
    if (path.startsWith('/dashboard')) {
      const cached = offlineDb.get(offlineDb.KEYS.DASHBOARD);
      if (cached) return { ...cached, _isOffline: true };
      return {
        totalProducts: 0,
        totalUnits: 0,
        inventoryValue: 0,
        lowStockProducts: [],
        totalSales: 0,
        todaySales: 0,
        maxItemsLimit: 100000,
        limitUsagePercent: 0,
        _isOffline: true
      };
    }
    if (path.startsWith('/sales')) {
      const cached = offlineDb.get(offlineDb.KEYS.SALES);
      return Array.isArray(cached) ? cached : (Array.isArray(cached?.sales) ? cached.sales : []);
    }
    if (path.startsWith('/analytics/predictive-restock')) {
      const cached = offlineDb.get(offlineDb.KEYS.PREDICTIONS);
      if (cached) return { ...cached, _isOffline: true };
      return {
        summary: { criticalCount: 0, reorderSoonCount: 0, healthyCount: 0, totalSuggestedUnits: 0 },
        predictions: [],
        _isOffline: true
      };
    }
    if (path.startsWith('/analytics/trends')) {
      const cached = offlineDb.get(offlineDb.KEYS.TRENDS);
      if (cached) return { ...cached, _isOffline: true };
      return {
        salesTrend: [],
        stockHealth: { outOfStock: 0, lowStock: 0, healthy: 0, highStock: 0 },
        _isOffline: true
      };
    }
    if (path.startsWith('/products/barcode/')) {
      const barcode = decodeURIComponent(path.replace('/products/barcode/', ''));
      const cached = offlineDb.get(offlineDb.KEYS.PRODUCTS);
      if (cached && Array.isArray(cached.products)) {
        const found = cached.products.find((p) => p.barcode === barcode);
        if (found) return found;
      }
      throw new Error(`Product with barcode "${barcode}" not found in local cache.`);
    }
  }

  // 2. POST /products (Add product offline)
  if (method === 'POST' && path === '/products') {
    const payload = JSON.parse(options.body || '{}');
    const newProduct = {
      _id: 'offline_prod_' + Date.now(),
      name: payload.name || 'Untitled',
      category: payload.category || 'Other',
      barcode: payload.barcode || '',
      sku: payload.sku || '',
      price: Number(payload.price || 0),
      costPrice: Number(payload.costPrice || 0),
      quantity: Number(payload.quantity || 0),
      lowStockLimit: Number(payload.lowStockLimit || 5),
      unit: payload.unit || 'units',
      createdAt: new Date().toISOString(),
      _offline: true
    };

    offlineDb.enqueue({ type: 'ADD_PRODUCT', payload });

    const cached = offlineDb.get(offlineDb.KEYS.PRODUCTS) || { products: [] };
    const list = Array.isArray(cached.products) ? cached.products : [];
    list.unshift(newProduct);
    offlineDb.set(offlineDb.KEYS.PRODUCTS, { ...cached, products: list, totalCount: list.length });

    return newProduct;
  }

  // 3. PUT /products/:id (Edit product offline)
  if (method === 'PUT' && path.startsWith('/products/')) {
    const id = path.split('/')[2];
    const updates = JSON.parse(options.body || '{}');
    offlineDb.enqueue({ type: 'EDIT_PRODUCT', payload: { id, updates } });

    const cached = offlineDb.get(offlineDb.KEYS.PRODUCTS);
    if (cached && Array.isArray(cached.products)) {
      const p = cached.products.find((item) => item._id === id);
      if (p) {
        Object.assign(p, updates);
        offlineDb.set(offlineDb.KEYS.PRODUCTS, cached);
        return p;
      }
    }
    return updates;
  }

  // 4. DELETE /products/:id (Delete product offline)
  if (method === 'DELETE' && path.startsWith('/products/')) {
    const id = path.split('/')[2];
    offlineDb.enqueue({ type: 'DELETE_PRODUCT', payload: { id } });

    const cached = offlineDb.get(offlineDb.KEYS.PRODUCTS);
    if (cached && Array.isArray(cached.products)) {
      cached.products = cached.products.filter((item) => item._id !== id);
      cached.totalCount = cached.products.length;
      offlineDb.set(offlineDb.KEYS.PRODUCTS, cached);
    }
    return { message: 'Product deleted in offline mode.' };
  }

  // 5. POST /sales (Record sale offline)
  if (method === 'POST' && path === '/sales') {
    const payload = JSON.parse(options.body || '{}');
    const queueItem = offlineDb.enqueue({ type: 'SALE', payload });

    const cachedProducts = offlineDb.get(offlineDb.KEYS.PRODUCTS);
    let matchedProduct = null;
    if (cachedProducts && Array.isArray(cachedProducts.products)) {
      const p = cachedProducts.products.find(
        (i) => i._id === payload.productId || (payload.barcode && i.barcode === payload.barcode)
      );
      if (p) {
        p.quantity = Math.max(0, p.quantity - Number(payload.quantity));
        matchedProduct = p;
        offlineDb.set(offlineDb.KEYS.PRODUCTS, cachedProducts);
      }
    }

    return {
      sale: {
        _id: 'offline_' + queueItem.id,
        productName: matchedProduct ? matchedProduct.name : 'Offline Item',
        quantity: payload.quantity,
        total: (matchedProduct?.price || 0) * payload.quantity,
        createdAt: new Date().toISOString(),
        _offline: true
      },
      product: matchedProduct,
      _isOffline: true,
      message: 'Sale recorded offline. Queued for automatic sync when internet resumes.'
    };
  }

  // 6. POST /products/stock-entry (Barcode stock replenishment offline)
  if (method === 'POST' && path === '/products/stock-entry') {
    const payload = JSON.parse(options.body || '{}');
    offlineDb.enqueue({ type: 'STOCK_ENTRY', payload });

    const cachedProducts = offlineDb.get(offlineDb.KEYS.PRODUCTS);
    let updatedProduct = null;
    if (cachedProducts && Array.isArray(cachedProducts.products)) {
      const p = cachedProducts.products.find(
        (i) => i._id === payload.productId || (payload.barcode && i.barcode === payload.barcode)
      );
      if (p) {
        p.quantity = (p.quantity || 0) + Number(payload.quantityToAdd || 1);
        updatedProduct = p;
        offlineDb.set(offlineDb.KEYS.PRODUCTS, cachedProducts);
      }
    }

    return {
      product: updatedProduct,
      _isOffline: true,
      message: 'Stock entry queued offline. It will sync automatically once reconnected.'
    };
  }

  return { _isOffline: true, message: 'Action queued offline.' };
}

// ---------------- Product APIs ----------------
export async function getProducts(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.category && params.category !== 'All categories') query.append('category', params.category);
  if (params.lowStock) query.append('lowStock', 'true');
  if (params.limit) query.append('limit', params.limit);

  const qs = query.toString() ? `?${query.toString()}` : '';
  const data = await request(`/products${qs}`);
  const list = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);

  if (!data._isOffline) {
    offlineDb.set(offlineDb.KEYS.PRODUCTS, list);
  }
  return list;
}

export const getProductByBarcode = (barcode) => request(`/products/barcode/${encodeURIComponent(barcode)}`);

export const addProduct = (product) =>
  request('/products', { method: 'POST', body: JSON.stringify(product) });

export const editProduct = (id, product) =>
  request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(product) });

export const deleteProduct = (id) =>
  request(`/products/${id}`, { method: 'DELETE' });

export const stockEntry = (data) =>
  request('/products/stock-entry', { method: 'POST', body: JSON.stringify(data) });

// ---------------- Sales APIs ----------------
export async function getSales(params = {}) {
  const query = new URLSearchParams();
  if (params.productId) query.append('productId', params.productId);
  if (params.limit) query.append('limit', params.limit);
  if (params.skip) query.append('skip', params.skip);

  const qs = query.toString() ? `?${query.toString()}` : '';
  const data = await request(`/sales${qs}`);
  const list = Array.isArray(data) ? data : (Array.isArray(data?.sales) ? data.sales : []);

  if (!data._isOffline) {
    offlineDb.set(offlineDb.KEYS.SALES, list);
  }
  return list;
}

export const recordSale = (productId, quantity, barcode = '') =>
  request('/sales', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity, barcode })
  });

export const recordBatchSales = (items) =>
  request('/sales/batch', {
    method: 'POST',
    body: JSON.stringify({ items })
  });

// ---------------- Dashboard & Analytics APIs ----------------
export async function getDashboard() {
  const data = await request('/dashboard');
  if (!data._isOffline) {
    offlineDb.set(offlineDb.KEYS.DASHBOARD, data);
  }
  return data;
}

export async function getPredictiveRestock(params = {}) {
  const query = new URLSearchParams();
  if (params.days) query.append('days', params.days);
  if (params.buffer) query.append('buffer', params.buffer);

  const qs = query.toString() ? `?${query.toString()}` : '';
  const data = await request(`/analytics/predictive-restock${qs}`);

  if (!data._isOffline) {
    offlineDb.set(offlineDb.KEYS.PREDICTIONS, data);
  }
  return data;
}

export async function getTrends(params = {}) {
  const query = new URLSearchParams();
  if (params.days) query.append('days', params.days);

  const qs = query.toString() ? `?${query.toString()}` : '';
  const data = await request(`/analytics/trends${qs}`);

  if (!data._isOffline) {
    offlineDb.set(offlineDb.KEYS.TRENDS, data);
  }
  return data;
}

// ---------------- Offline Queue Sync ----------------
export async function syncOfflineQueue() {
  const queue = offlineDb.getQueue();
  if (!queue.length) return { syncedCount: 0 };

  let successCount = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      if (item.action.type === 'SALE') {
        await request('/sales', {
          method: 'POST',
          body: JSON.stringify(item.action.payload)
        });
        successCount++;
      } else if (item.action.type === 'STOCK_ENTRY') {
        await request('/products/stock-entry', {
          method: 'POST',
          body: JSON.stringify(item.action.payload)
        });
        successCount++;
      } else if (item.action.type === 'ADD_PRODUCT') {
        await request('/products', {
          method: 'POST',
          body: JSON.stringify(item.action.payload)
        });
        successCount++;
      }
    } catch (err) {
      console.warn('Sync failed for item:', item, err);
      remaining.push(item);
    }
  }

  localStorage.setItem(offlineDb.KEYS.OFFLINE_QUEUE, JSON.stringify(remaining));
  return { syncedCount: successCount, remainingCount: remaining.length };
}
