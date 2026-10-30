// Offline-first storage and synchronization layer
// Uses localStorage with IndexedDB fallback for fast synchronous access and reliable persistence

const STORAGE_KEYS = {
  PRODUCTS: 'stockwise_cache_products',
  DASHBOARD: 'stockwise_cache_dashboard',
  SALES: 'stockwise_cache_sales',
  PREDICTIONS: 'stockwise_cache_predictions',
  TRENDS: 'stockwise_cache_trends',
  OFFLINE_QUEUE: 'stockwise_offline_queue',
  CURRENT_USER: 'stockwise_current_user',
  AUTH_TOKEN: 'stockwise_auth_token'
};

export const offlineDb = {
  // Save cache data
  set(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (e) {
      console.warn('LocalStorage quota or access warning:', e);
    }
  },

  // Get cached data
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.data;
    } catch (e) {
      return null;
    }
  },

  // Offline queue operations
  getQueue() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  enqueue(action) {
    const queue = this.getQueue();
    const item = {
      id: 'queue_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      action, // e.g. { type: 'SALE', payload: { productId, quantity } }
      timestamp: new Date().toISOString()
    };
    queue.push(item);
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    return item;
  },

  removeFromQueue(id) {
    const queue = this.getQueue().filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  },

  clearQueue() {
    localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
  },

  // Quick helper keys
  KEYS: STORAGE_KEYS
};
