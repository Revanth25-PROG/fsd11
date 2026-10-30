import { offlineDb } from './offlineDb.js';

const API_URL = 'http://localhost:5000/api';

// Current session configuration
let currentRole = localStorage.getItem('stockwise_user_role') || 'admin';
let currentUserName = localStorage.getItem('stockwise_user_name') || 'Shop Owner (Admin)';
let authToken = localStorage.getItem('stockwise_auth_token') || '';

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

// Master request wrapper with offline-first caching and fallback
async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-user-role': currentRole,
    'x-user-name': currentUserName,
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers
  };

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Server returned an error.');
    }
    return data;
  } catch (error) {
    // If it's a network error (server down or client is offline)
    const isNetworkError =
      !navigator.onLine ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('network');

    if (isNetworkError) {
      return handleOfflineFallback(path, options, error);
    }
    throw error;
  }
}

// Offline fallback logic
function handleOfflineFallback(path, options, originalError) {
  const method = (options.method || 'GET').toUpperCase();

  // If GET request, return cached data
  if (method === 'GET') {
    if (path.startsWith('/products')) {
      const cached = offlineDb.get(offlineDb.KEYS.PRODUCTS);
      if (cached) return { ...cached, _isOffline: true };
    }
    if (path.startsWith('/dashboard')) {
      const cached = offlineDb.get(offlineDb.KEYS.DASHBOARD);
      if (cached) return { ...cached, _isOffline: true };
    }
    if (path.startsWith('/sales')) {
      const cached = offlineDb.get(offlineDb.KEYS.SALES);
      if (cached) return { ...cached, _isOffline: true };
    }
    if (path.startsWith('/analytics/predictive-restock')) {
      const cached = offlineDb.get(offlineDb.KEYS.PREDICTIONS);
      if (cached) return { ...cached, _isOffline: true };
    }
    if (path.startsWith('/analytics/trends')) {
      const cached = offlineDb.get(offlineDb.KEYS.TRENDS);
      if (cached) return { ...cached, _isOffline: true };
    }
  }

  // If POST /sales request while offline, queue action locally
  if (method === 'POST' && path === '/sales') {
    const payload = JSON.parse(options.body || '{}');
    const queueItem = offlineDb.enqueue({ type: 'SALE', payload });
    // Also adjust local cached product quantity so UI reflects stock decrease immediately
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

  // If POST /products/stock-entry while offline
  if (method === 'POST' && path === '/products/stock-entry') {
    const payload = JSON.parse(options.body || '{}');
    offlineDb.enqueue({ type: 'STOCK_ENTRY', payload });
    return {
      _isOffline: true,
      message: 'Stock entry queued offline. It will sync automatically once reconnected.'
    };
  }

  throw new Error(`Offline mode: Unable to complete this action without network connectivity.`);
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

  // Cache products for offline access
  if (!data._isOffline) {
    offlineDb.set(offlineDb.KEYS.PRODUCTS, data);
  }
  return data;
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

  if (!data._isOffline) {
    offlineDb.set(offlineDb.KEYS.SALES, data);
  }
  return data;
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
      }
    } catch (err) {
      console.error('Failed to sync queue item:', item, err);
      remaining.push(item);
    }
  }

  localStorage.setItem(offlineDb.KEYS.OFFLINE_QUEUE, JSON.stringify(remaining));
  return { syncedCount: successCount, remainingCount: remaining.length };
}
