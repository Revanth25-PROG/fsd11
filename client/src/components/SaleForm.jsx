import { useState, useEffect } from 'react';
import { X, AlertTriangle, ScanLine, ShoppingCart } from 'lucide-react';

export default function SaleForm({ products, onSave, onClose, saving, preselectedProduct }) {
  const availableProducts = products.filter((product) => product.quantity > 0);
  const [productId, setProductId] = useState(
    preselectedProduct?._id || availableProducts[0]?._id || ''
  );
  const [quantity, setQuantity] = useState('1');

  useEffect(() => {
    if (preselectedProduct) {
      setProductId(preselectedProduct._id);
    }
  }, [preselectedProduct]);

  const selectedProduct = products.find((product) => product._id === productId);
  const soldQty = Number(quantity || 0);
  const remainingStock = selectedProduct ? selectedProduct.quantity - soldQty : 0;
  const willCrossThreshold =
    selectedProduct &&
    selectedProduct.quantity > selectedProduct.lowStockLimit &&
    remainingStock <= selectedProduct.lowStockLimit;

  function handleSubmit(event) {
    event.preventDefault();
    if (!productId || soldQty < 1) return;
    onSave(productId, soldQty, selectedProduct?.barcode);
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="sale-form-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">POS CHECKOUT TRANSACTION</p>
            <h2 id="sale-form-title">Record Sale</h2>
            <p className="muted">Stock will be atomically updated. Alerts trigger on low stock.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close form">
            <X size={20} />
          </button>
        </div>

        {availableProducts.length === 0 ? (
          <div className="empty-state">
            <AlertTriangle size={32} style={{ color: '#c94e4e', marginBottom: 10 }} />
            <strong>No products in stock</strong>
            <p>All items have 0 quantity. Please restock products before selling.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="product-form">
            <label>
              Choose product
              <select
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                required
              >
                {availableProducts.map((product) => (
                  <option key={product._id} value={product._id}>
                    {product.name} — {product.quantity} in stock (₹{product.price})
                    {product.barcode ? ` [${product.barcode}]` : ''}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-row">
              <label>
                Quantity sold
                <input
                  type="number"
                  min="1"
                  max={selectedProduct?.quantity || 1}
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  required
                />
              </label>
              <label>
                Stock After Sale
                <input
                  type="text"
                  disabled
                  value={selectedProduct ? `${remainingStock} ${selectedProduct.unit || 'units'}` : ''}
                  style={{ background: '#f5f7f5' }}
                />
              </label>
            </div>

            {/* Threshold crossing proactive alert */}
            {willCrossThreshold && (
              <div className="alert-banner warning-banner" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 11 }}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Threshold Alert:</strong> This transaction will drop stock to {remainingStock} units, crossing the alert limit ({selectedProduct.lowStockLimit})!
                </span>
              </div>
            )}

            {selectedProduct && (
              <div className="sale-total">
                <div>
                  <small style={{ display: 'block', color: '#6d7b72' }}>Total Transaction Value</small>
                  <strong>
                    ₹{(selectedProduct.price * soldQty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <small style={{ display: 'block', color: '#6d7b72' }}>Unit Price</small>
                  <span>₹{selectedProduct.price}</span>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? 'Processing…' : 'Record sale'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
