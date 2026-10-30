import { useState } from 'react';
import {
  Sparkles,
  AlertTriangle,
  TrendingDown,
  PackagePlus,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { stockEntry } from '../api';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function PredictiveRestockView({ predictionsData, onRefresh, onNotice, onError }) {
  const [restockingId, setRestockingId] = useState(null);
  const [customQtyMap, setCustomQtyMap] = useState({});

  const summary = predictionsData?.summary || {
    criticalCount: 0,
    reorderSoonCount: 0,
    healthyCount: 0,
    totalSuggestedUnits: 0
  };
  const predictions = predictionsData?.predictions || [];

  async function handleQuickRestock(product) {
    const qty = Number(customQtyMap[product.productId] || product.suggestedReorderQuantity || 10);
    setRestockingId(product.productId);

    try {
      await stockEntry({
        productId: product.productId,
        quantityToAdd: qty
      });
      onNotice(`Restocked ${qty} units of "${product.name}". Predictive runway updated!`);
      if (onRefresh) onRefresh();
    } catch (err) {
      onError('Restocking failed: ' + err.message);
    } finally {
      setRestockingId(null);
    }
  }

  function handleQtyChange(productId, val) {
    setCustomQtyMap((prev) => ({ ...prev, [productId]: val }));
  }

  return (
    <div className="predictive-view">
      {/* Header Banner */}
      <section className="welcome-row page-heading">
        <div>
          <p className="eyebrow">AI • SALES VELOCITY FORECASTING</p>
          <h1>Predictive Restocking</h1>
          <p className="page-subtitle">
            Smart algorithms analyze sales trends and burn rates to forecast stockouts and suggest optimal reorder quantities.
          </p>
        </div>
        <div className="welcome-actions">
          <button className="button button-secondary" onClick={onRefresh}>
            <RefreshCw size={15} /> Recalculate Forecasts
          </button>
        </div>
      </section>

      {/* Summary KPI Grid */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #c94e4e' }}>
          <div className="stat-icon" style={{ background: '#fee2e2', color: '#c94e4e' }}>
            <AlertTriangle size={20} />
          </div>
          <p className="stat-title">Critical Runout Risk</p>
          <div className="stat-value" style={{ color: '#b91c1c' }}>{summary.criticalCount} items</div>
          <p className="stat-note">Will run out within 3 days based on current sales speed</p>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Clock size={20} />
          </div>
          <p className="stat-title">Reorder Soon (3–7 Days)</p>
          <div className="stat-value" style={{ color: '#b45309' }}>{summary.reorderSoonCount} items</div>
          <p className="stat-note">Approaching low stock threshold this week</p>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #258454' }}>
          <div className="stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
            <PackagePlus size={20} />
          </div>
          <p className="stat-title">Suggested Reorder Volume</p>
          <div className="stat-value" style={{ color: '#166534' }}>{summary.totalSuggestedUnits} units</div>
          <p className="stat-note">To maintain 14-day safety buffer stock</p>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>
            <Sparkles size={20} />
          </div>
          <p className="stat-title">Health Status</p>
          <div className="stat-value" style={{ color: '#1d4ed8' }}>{summary.healthyCount} Adequate</div>
          <p className="stat-note">Stock levels well above safety runway</p>
        </div>
      </div>

      {/* Predictive Restocking Table */}
      <section className="panel full-table-panel">
        <div className="table-heading">
          <div>
            <h2>Restock Recommendations</h2>
            <p>Calculated using 14-day sales velocity and replenishment lead-time models.</p>
          </div>
          <span className="table-label">PREDICTIVE INTELLIGENCE</span>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>CURRENT STOCK</th>
                <th>SALES VELOCITY</th>
                <th>STOCKOUT RUNWAY</th>
                <th>RECOMMENDED ORDER</th>
                <th style={{ textAlign: 'right', paddingRight: 20 }}>QUICK RESTOCK</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((p) => {
                const isCritical = p.urgency === 'CRITICAL' || p.urgency === 'OUT_OF_STOCK';
                const isWarning = p.urgency === 'REORDER_SOON';
                const currentQty = customQtyMap[p.productId] ?? p.suggestedReorderQuantity;

                return (
                  <tr key={p.productId} style={{ background: isCritical ? '#fffbfa' : 'transparent' }}>
                    <td>
                      <div className="product-cell">
                        <div
                          className="product-initial"
                          style={{
                            background: isCritical ? '#fee2e2' : isWarning ? '#fef3c7' : '#eef6ef',
                            color: isCritical ? '#dc2626' : isWarning ? '#d97706' : '#258454'
                          }}
                        >
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong>{p.name}</strong>
                          <small>
                            {p.category} {p.barcode && `• Barcode: ${p.barcode}`}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <strong className={isCritical ? 'quantity-low' : 'quantity-normal'}>
                        {p.currentStock} units
                      </strong>
                      <small style={{ display: 'block', color: '#8c9890', fontSize: 10 }}>
                        Alert limit: {p.lowStockLimit}
                      </small>
                    </td>

                    <td>
                      <span style={{ fontWeight: 600, color: '#2d3b31' }}>
                        {p.dailySalesRate} units/day
                      </span>
                      <small style={{ display: 'block', color: '#8c9890', fontSize: 10 }}>
                        {p.unitsSoldInWindow} sold recently
                      </small>
                    </td>

                    <td>
                      {p.currentStock === 0 ? (
                        <span className="status-pill status-low" style={{ background: '#fee2e2', color: '#dc2626' }}>
                          <AlertTriangle size={12} /> Out of Stock!
                        </span>
                      ) : p.daysUntilStockout <= 3 ? (
                        <span className="status-pill status-low" style={{ background: '#fef2f2', color: '#b91c1c', fontWeight: 700 }}>
                          <TrendingDown size={12} /> {p.daysUntilStockout} days left
                        </span>
                      ) : p.daysUntilStockout <= 7 ? (
                        <span className="status-pill status-low" style={{ background: '#fffbeb', color: '#b45309' }}>
                          <Clock size={12} /> {p.daysUntilStockout} days left
                        </span>
                      ) : (
                        <span className="status-pill status-good">
                          <ShieldCheck size={12} /> {p.daysUntilStockout > 100 ? 'Ample stock' : `${p.daysUntilStockout} days`}
                        </span>
                      )}
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong style={{ fontSize: 13, color: '#1a5937' }}>
                          +{p.suggestedReorderQuantity} units
                        </strong>
                        <small style={{ color: '#819086', fontSize: 10 }}>
                          (~{money(p.estimatedReorderCost)})
                        </small>
                      </div>
                    </td>

                    <td style={{ textAlign: 'right', paddingRight: 20 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="number"
                          min="1"
                          style={{ width: 64, height: 32, fontSize: 11, padding: '2px 6px', borderRadius: 6, border: '1px solid #c9d8ce' }}
                          value={currentQty}
                          onChange={(e) => handleQtyChange(p.productId, e.target.value)}
                        />
                        <button
                          type="button"
                          className="button button-primary"
                          style={{ padding: '6px 12px', fontSize: 11 }}
                          disabled={restockingId === p.productId || Number(currentQty) <= 0}
                          onClick={() => handleQuickRestock(p)}
                        >
                          {restockingId === p.productId ? <RefreshCw size={13} className="spinner" /> : <PackagePlus size={13} />}
                          Restock
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
