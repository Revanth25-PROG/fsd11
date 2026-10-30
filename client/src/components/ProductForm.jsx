import { useEffect, useState } from 'react';
import { X, Barcode, Sparkles } from 'lucide-react';

const emptyProduct = {
  name: '',
  category: 'Grocery',
  barcode: '',
  sku: '',
  price: '',
  costPrice: '',
  quantity: '',
  lowStockLimit: 5,
  unit: 'units'
};

export default function ProductForm({ product, onSave, onClose, saving }) {
  const [form, setForm] = useState(emptyProduct);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        category: product.category || 'Grocery',
        barcode: product.barcode || '',
        sku: product.sku || '',
        price: product.price ?? '',
        costPrice: product.costPrice ?? '',
        quantity: product.quantity ?? '',
        lowStockLimit: product.lowStockLimit ?? 5,
        unit: product.unit || 'units'
      });
    } else {
      setForm(emptyProduct);
    }
  }, [product]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  }

  function generateRandomBarcode() {
    const randomCode = '890' + Math.floor(1000000000 + Math.random() * 9000000000);
    setForm({ ...form, barcode: randomCode });
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave({
      ...form,
      price: Number(form.price),
      costPrice: Number(form.costPrice || 0),
      quantity: Number(form.quantity),
      lowStockLimit: Number(form.lowStockLimit)
    });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">INVENTORY CONTROL</p>
            <h2 id="product-form-title">{product ? 'Edit product' : 'Add product to inventory'}</h2>
            <p className="muted">Enter product information and barcode details.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close form">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="product-form">
          <label>
            Product name
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Basmati Rice (5kg)"
              required
              maxLength="80"
            />
          </label>

          <div className="form-row">
            <label>
              Category
              <select name="category" value={form.category} onChange={handleChange}>
                <option>Grocery</option>
                <option>Beverages</option>
                <option>Household</option>
                <option>Personal care</option>
                <option>Stationery</option>
                <option>Other</option>
              </select>
            </label>

            <label>
              Unit type
              <select name="unit" value={form.unit} onChange={handleChange}>
                <option value="units">units (pcs)</option>
                <option value="kg">kilograms (kg)</option>
                <option value="litres">litres (L)</option>
                <option value="packs">packs / boxes</option>
              </select>
            </label>
          </div>

          <label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Barcode / SKU (for Scanner Gun / Camera)</span>
              <button
                type="button"
                className="text-button"
                onClick={generateRandomBarcode}
                style={{ fontSize: 10 }}
              >
                <Sparkles size={11} /> Auto-generate
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                name="barcode"
                value={form.barcode}
                onChange={handleChange}
                placeholder="e.g. 8901030383748"
                style={{ paddingLeft: 34 }}
              />
              <Barcode size={17} style={{ position: 'absolute', left: 10, top: 12, color: '#88988e' }} />
            </div>
          </label>

          <div className="form-row">
            <label>
              Selling Price (₹)
              <input
                type="number"
                name="price"
                min="0"
                step="0.01"
                value={form.price}
                onChange={handleChange}
                placeholder="0.00"
                required
              />
            </label>
            <label>
              Cost / Buy Price (₹)
              <input
                type="number"
                name="costPrice"
                min="0"
                step="0.01"
                value={form.costPrice}
                onChange={handleChange}
                placeholder="0.00"
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Current Quantity in Stock
              <input
                type="number"
                name="quantity"
                min="0"
                step="1"
                value={form.quantity}
                onChange={handleChange}
                placeholder="0"
                required
              />
            </label>
            <label>
              Low-Stock Alert Threshold
              <input
                type="number"
                name="lowStockLimit"
                min="0"
                step="1"
                value={form.lowStockLimit}
                onChange={handleChange}
                required
              />
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button button-primary" disabled={saving}>
              {saving ? 'Saving…' : product ? 'Save changes' : 'Add product'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
