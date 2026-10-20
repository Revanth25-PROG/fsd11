import { useState } from 'react';
import { X } from 'lucide-react';

export default function SaleForm({ products, onSave, onClose, saving }) {
  const availableProducts = products.filter((product) => product.quantity > 0);
  const [productId, setProductId] = useState(availableProducts[0]?._id || '');
  const [quantity, setQuantity] = useState('1');
  const selectedProduct = availableProducts.find((product) => product._id === productId);

  function handleSubmit(event) {
    event.preventDefault();
    onSave(productId, Number(quantity));
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="sale-form-title">
        <div className="modal-heading">
          <div><p className="eyebrow">CHECKOUT</p><h2 id="sale-form-title">Record a sale</h2><p className="muted">Stock will be updated automatically.</p></div>
          <button className="icon-button" onClick={onClose} aria-label="Close form"><X size={20} /></button>
        </div>
        {availableProducts.length === 0 ? <div className="empty-state">There are no products in stock to sell.</div> : (
          <form onSubmit={handleSubmit} className="product-form">
            <label>Choose product
              <select value={productId} onChange={(event) => setProductId(event.target.value)} required>
                {availableProducts.map((product) => <option key={product._id} value={product._id}>{product.name} — {product.quantity} in stock</option>)}
              </select>
            </label>
            <label>Quantity sold<input type="number" min="1" max={selectedProduct?.quantity || 1} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
            {selectedProduct && <div className="sale-total"><span>Sale total</span><strong>₹{(selectedProduct.price * Number(quantity || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></div>}
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Recording…' : 'Record sale'}</button></div>
          </form>
        )}
      </section>
    </div>
  );
}
