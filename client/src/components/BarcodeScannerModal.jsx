import { useState, useEffect, useRef } from 'react';
import { X, ScanLine, Camera, Check, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { getProductByBarcode, stockEntry } from '../api';

export default function BarcodeScannerModal({ onClose, onStockUpdated, onSelectProductForSale }) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [quantityToAdd, setQuantityToAdd] = useState('1');
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Fast test barcodes to simulate scanner gun for demo/testing
  const sampleBarcodes = [
    { code: '8901030383748', name: 'Basmati Rice 5kg' },
    { code: '8901725181122', name: 'Sunflower Oil 1L' },
    { code: '8901058852615', name: 'Wheat Flour 10kg' }
  ];

  // Start / stop camera
  async function toggleCamera() {
    if (isCameraActive) {
      stopCamera();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setIsCameraActive(true);
        setStatusMessage({ text: 'Camera active. Point at barcode.', type: 'info' });

        // If BarcodeDetector is available in this browser
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
          });
          detectBarcodeLoop(barcodeDetector);
        }
      } catch (err) {
        setStatusMessage({
          text: 'Camera access denied or unavailable. You can use manual entry or scanner device below.',
          type: 'error'
        });
      }
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }

  async function detectBarcodeLoop(detector) {
    if (!videoRef.current || !streamRef.current) return;
    try {
      const barcodes = await detector.detect(videoRef.current);
      if (barcodes.length > 0) {
        const detected = barcodes[0].rawValue;
        setBarcodeInput(detected);
        handleLookup(detected);
        stopCamera();
        return;
      }
    } catch (e) {
      // frame detect error
    }
    if (streamRef.current) {
      requestAnimationFrame(() => detectBarcodeLoop(detector));
    }
  }

  useEffect(() => {
    return () => stopCamera();
  }, []);

  async function handleLookup(codeToLookup) {
    const code = (codeToLookup || barcodeInput).trim();
    if (!code) return;

    setScanning(true);
    setStatusMessage({ text: 'Searching product catalogue…', type: 'info' });

    try {
      const product = await getProductByBarcode(code);
      setScannedProduct(product);
      setStatusMessage({ text: `Found "${product.name}" (${product.quantity} units currently in stock).`, type: 'success' });
    } catch (err) {
      setScannedProduct(null);
      setStatusMessage({ text: `Barcode ${code} is not registered yet. You can add it in the Products page.`, type: 'error' });
    } finally {
      setScanning(false);
    }
  }

  async function handleAddStock(event) {
    event.preventDefault();
    if (!scannedProduct) return;

    try {
      const result = await stockEntry({
        barcode: scannedProduct.barcode,
        productId: scannedProduct._id,
        quantityToAdd: Number(quantityToAdd)
      });
      setStatusMessage({
        text: `Stock Updated! Added ${quantityToAdd} units to "${scannedProduct.name}". New balance: ${result.product?.quantity || (scannedProduct.quantity + Number(quantityToAdd))} units.`,
        type: 'success'
      });
      setScannedProduct((prev) => ({
        ...prev,
        quantity: result.product?.quantity || prev.quantity + Number(quantityToAdd)
      }));
      if (onStockUpdated) onStockUpdated();
    } catch (err) {
      setStatusMessage({ text: 'Stock entry failed: ' + err.message, type: 'error' });
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal scanner-modal" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">SMART INVENTORY • HARDWARE INTEGRATION</p>
            <h2>Barcode Stock Entry</h2>
            <p className="muted">Scan or enter barcode for instant replenishment or checkout.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close modal"><X size={20} /></button>
        </div>

        {/* Camera stream view with laser guide */}
        <div className="camera-viewfinder-container">
          {isCameraActive ? (
            <div className="video-wrapper">
              <video ref={videoRef} className="camera-stream" playsInline />
              <div className="laser-guide"><div className="laser-beam" /></div>
            </div>
          ) : (
            <div className="camera-placeholder">
              <ScanLine size={48} className="scanner-icon-pulse" />
              <p>Camera is currently off. Ready for USB scanner gun or webcam.</p>
              <button type="button" className="button button-secondary" onClick={toggleCamera}>
                <Camera size={16} /> Turn On Camera Scanner
              </button>
            </div>
          )}
        </div>

        {isCameraActive && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button type="button" className="button button-secondary" onClick={stopCamera}>
              Stop Camera
            </button>
          </div>
        )}

        {/* Barcode input & action */}
        <div className="scanner-input-section" style={{ marginTop: 16 }}>
          <label><strong>Barcode / SKU Number</strong></label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup(barcodeInput)}
              placeholder="e.g. 8901030383748 or scan with laser gun"
              autoFocus
            />
            <button
              type="button"
              className="button button-primary"
              onClick={() => handleLookup(barcodeInput)}
              disabled={scanning || !barcodeInput.trim()}
            >
              {scanning ? <RefreshCw size={15} className="spinner" /> : <ScanLine size={15} />}
              Lookup
            </button>
          </div>

          {/* Quick sample barcodes for demo */}
          <div className="quick-barcodes">
            <small className="muted">Quick Test Barcodes:</small>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {sampleBarcodes.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  className="barcode-chip"
                  onClick={() => {
                    setBarcodeInput(item.code);
                    handleLookup(item.code);
                  }}
                >
                  {item.name} ({item.code})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Status message */}
        {statusMessage.text && (
          <div className={`alert-banner ${statusMessage.type === 'error' ? 'error-banner' : statusMessage.type === 'success' ? 'success-banner' : 'info-banner'}`} style={{ marginTop: 14 }}>
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Scanned product card & stock replenishment */}
        {scannedProduct && (
          <div className="scanned-product-card" style={{ marginTop: 14, padding: 14, border: '1px solid #d9e6dc', borderRadius: 10, background: '#f8fbf9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <strong style={{ fontSize: 16, color: '#1f3427' }}>{scannedProduct.name}</strong>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#68776f' }}>
                  Category: {scannedProduct.category} | Barcode: <code>{scannedProduct.barcode}</code>
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#68776f' }}>
                  Current In Stock: <strong style={{ color: scannedProduct.quantity <= scannedProduct.lowStockLimit ? '#b87822' : '#258454' }}>{scannedProduct.quantity} units</strong> (Alert threshold: {scannedProduct.lowStockLimit})
                </p>
              </div>
              <span className={`status-pill ${scannedProduct.quantity <= scannedProduct.lowStockLimit ? 'status-low' : 'status-good'}`}>
                {scannedProduct.quantity <= scannedProduct.lowStockLimit ? 'Low Stock' : 'In Stock'}
              </span>
            </div>

            {/* Quick stock replenishment form */}
            <form onSubmit={handleAddStock} style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #e3ede6' }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334339', display: 'block', marginBottom: 6 }}>
                Stock Entry (Add units to inventory):
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantityToAdd}
                  onChange={(e) => setQuantityToAdd(e.target.value)}
                  style={{ width: 100 }}
                  required
                />
                <button type="submit" className="button button-primary">
                  <Plus size={15} /> Add to Stock
                </button>
                {onSelectProductForSale && (
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => {
                      onSelectProductForSale(scannedProduct);
                      onClose();
                    }}
                  >
                    Record Sale
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button type="button" className="button button-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </section>
    </div>
  );
}
