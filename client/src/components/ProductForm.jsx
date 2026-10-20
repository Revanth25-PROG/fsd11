import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const emptyProduct = {
  name: '', category: 'Grocery', price: '', quantity: '', lowStockLimit: 5
};

export default function ProductForm({ product, onSave, onClose, saving }) {
  const [form, setForm] = useState(emptyProduct);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        category: product.category,
        price: product.price,
        quantity: product.quantity,
        lowStockLimit: product.lowStockLimit
      });
    } else {
      setForm(emptyProduct);
    }
  }, [product]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave({
      ...form,
      price: Number(form.price),
      quantity: Number(form.quantity),
      lowStockLimit: Number(form.lowStockLimit)
    });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">PRODUCT DETAILS</p>
            <h2 id="product-form-title">{product ? 'Edit product' : 'Add a product'}</h2>
            <p className="muted">Fill in the details below.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close form"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="product-form">
          <label>Product name<input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Basmati rice" required maxLength="80" /></label>
          <label>Category
            <select name="category" value={form.category} onChange={handleChange}>
              <option>Grocery</option><option>Beverages</option><option>Household</option><option>Personal care</option><option>Stationery</option><option>Other</option>
            </select>
          </label>
          <div className="form-row">
            <label>Price (₹)<input type="number" name="price" min="0" step="0.01" value={form.price} onChange={handleChange} placeholder="0.00" required /></label>
            <label>Quantity<input type="number" name="quantity" min="0" step="1" value={form.quantity} onChange={handleChange} placeholder="0" required /></label>
          </div>
          <label>Low-stock alert when quantity is at or below
            <input type="number" name="lowStockLimit" min="0" step="1" value={form.lowStockLimit} onChange={handleChange} required />
          </label>
          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : product ? 'Save changes' : 'Add product'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
