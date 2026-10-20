// Keep all backend requests in one place so they are easy to find and change.
const API_URL = 'http://localhost:5000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong.');
  }
  return data;
}

export const getProducts = () => request('/products');
export const getDashboard = () => request('/dashboard');
export const getSales = () => request('/sales');
export const addProduct = (product) => request('/products', {
  method: 'POST', body: JSON.stringify(product)
});
export const editProduct = (id, product) => request(`/products/${id}`, {
  method: 'PUT', body: JSON.stringify(product)
});
export const deleteProduct = (id) => request(`/products/${id}`, { method: 'DELETE' });
export const recordSale = (productId, quantity) => request('/sales', {
  method: 'POST', body: JSON.stringify({ productId, quantity })
});
