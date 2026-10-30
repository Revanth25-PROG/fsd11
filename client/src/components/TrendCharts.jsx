import { useState, useMemo } from 'react';
import { TrendingUp, BarChart2, ShieldAlert, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

export default function TrendCharts({ trends, dashboard }) {
  const [activeTab, setActiveTab] = useState('sales');

  const salesTrend = trends?.salesTrend || [];
  const stockHealth = trends?.stockHealth || {
    outOfStock: 0,
    lowStock: 0,
    healthy: 0,
    highStock: 0
  };

  // Math for SVG Sales Chart
  const chartHeight = 160;
  const chartWidth = 520;
  const padding = 28;

  const maxRevenue = useMemo(() => {
    const max = Math.max(...salesTrend.map((d) => d.revenue || 0), 1000);
    return Math.ceil(max / 1000) * 1000;
  }, [salesTrend]);

  const points = useMemo(() => {
    if (!salesTrend.length) return '';
    return salesTrend
      .map((d, index) => {
        const x = padding + (index / (salesTrend.length - 1 || 1)) * (chartWidth - padding * 2);
        const y = chartHeight - padding - ((d.revenue || 0) / maxRevenue) * (chartHeight - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');
  }, [salesTrend, maxRevenue]);

  const totalStockItems = (stockHealth.outOfStock || 0) + (stockHealth.lowStock || 0) + (stockHealth.healthy || 0) + (stockHealth.highStock || 0) || 1;

  const capacityUsed = dashboard?.totalProducts || 0;
  const maxLimit = dashboard?.maxItemsLimit || 100000;
  const capacityPercent = Math.min(100, ((capacityUsed / maxLimit) * 100)).toFixed(2);

  return (
    <div className="panel trends-panel" style={{ padding: 20 }}>
      <div className="panel-heading" style={{ padding: 0, marginBottom: 18 }}>
        <div>
          <h2>Analytics & Trend Insights</h2>
          <p>Real-time visual trends for sales volume and predictive restocking needs.</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className={`button ${activeTab === 'sales' ? 'button-primary' : 'button-secondary'}`}
            style={{ padding: '6px 12px', fontSize: 11 }}
            onClick={() => setActiveTab('sales')}
          >
            <TrendingUp size={14} /> Sales Trend
          </button>
          <button
            type="button"
            className={`button ${activeTab === 'restock' ? 'button-primary' : 'button-secondary'}`}
            style={{ padding: '6px 12px', fontSize: 11 }}
            onClick={() => setActiveTab('restock')}
          >
            <BarChart2 size={14} /> Restocking Health
          </button>
        </div>
      </div>

      {activeTab === 'sales' && (
        <div className="sales-chart-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12 }}>
            <span style={{ color: '#68776f' }}>
              <strong>7-Day Revenue Velocity:</strong> ₹{salesTrend.reduce((sum, d) => sum + (d.revenue || 0), 0).toLocaleString('en-IN')}
            </span>
            <span style={{ color: '#258454', fontWeight: 600 }}>
              Peak Day: ₹{Math.max(...salesTrend.map((d) => d.revenue || 0), 0).toLocaleString('en-IN')}
            </span>
          </div>

          {/* Responsive SVG Chart */}
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: 'auto', maxHeight: 200 }}>
              {/* Background horizontal grid lines */}
              <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="#eaf0eb" strokeDasharray="4" />
              <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="#eaf0eb" strokeDasharray="4" />
              <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#dbe4dc" strokeWidth="1.5" />

              {/* Axis labels */}
              <text x={padding - 6} y={padding + 4} textAnchor="end" fontSize="9" fill="#90a095">
                ₹{maxRevenue >= 1000 ? `${(maxRevenue / 1000).toFixed(0)}k` : maxRevenue}
              </text>
              <text x={padding - 6} y={chartHeight / 2 + 3} textAnchor="end" fontSize="9" fill="#90a095">
                ₹{maxRevenue >= 2000 ? `${(maxRevenue / 2000).toFixed(0)}k` : (maxRevenue / 2).toFixed(0)}
              </text>
              <text x={padding - 6} y={chartHeight - padding + 3} textAnchor="end" fontSize="9" fill="#90a095">
                0
              </text>

              {/* Sales line & gradient fill */}
              {salesTrend.length > 1 && (
                <>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#258454" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#258454" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <polygon
                    points={`${padding},${chartHeight - padding} ${points} ${chartWidth - padding},${chartHeight - padding}`}
                    fill="url(#salesGrad)"
                  />
                  <polyline
                    fill="none"
                    stroke="#258454"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                  />
                </>
              )}

              {/* Data points & X-axis labels */}
              {salesTrend.map((d, index) => {
                const x = padding + (index / (salesTrend.length - 1 || 1)) * (chartWidth - padding * 2);
                const y = chartHeight - padding - ((d.revenue || 0) / maxRevenue) * (chartHeight - padding * 2);
                return (
                  <g key={d.date}>
                    <circle cx={x} cy={y} r="4" fill="#fff" stroke="#258454" strokeWidth="2.5" />
                    <text x={x} y={chartHeight - 8} textAnchor="middle" fontSize="9" fill="#75857b">
                      {d.label ? d.label.split(' ')[0] : ''}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {activeTab === 'restock' && (
        <div className="restock-chart-wrapper">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#fff0f0', padding: '12px 14px', borderRadius: 10, border: '1px solid #ffd4d4' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c94e4e', fontSize: 11, fontWeight: 700 }}>
                <ShieldAlert size={14} /> Critical Out of Stock
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#a83232', marginTop: 4 }}>
                {stockHealth.outOfStock || 0}
              </div>
              <small style={{ color: '#914949', fontSize: 10 }}>0 units remaining</small>
            </div>

            <div style={{ background: '#fff7ed', padding: '12px 14px', borderRadius: 10, border: '1px solid #fde3c7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c2781b', fontSize: 11, fontWeight: 700 }}>
                <AlertTriangle size={14} /> Low Stock Alert
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#a35f0f', marginTop: 4 }}>
                {stockHealth.lowStock || 0}
              </div>
              <small style={{ color: '#8a5c29', fontSize: 10 }}>Under threshold</small>
            </div>

            <div style={{ background: '#eef8f2', padding: '12px 14px', borderRadius: 10, border: '1px solid #d0ecda' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#258454', fontSize: 11, fontWeight: 700 }}>
                <CheckCircle2 size={14} /> Healthy Stock
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#176640', marginTop: 4 }}>
                {stockHealth.healthy || 0}
              </div>
              <small style={{ color: '#4a755d', fontSize: 10 }}>Optimal runway</small>
            </div>

            <div style={{ background: '#f0f4fa', padding: '12px 14px', borderRadius: 10, border: '1px solid #d4e0f2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3d6ea8', fontSize: 11, fontWeight: 700 }}>
                <Layers size={14} /> High Supply
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#254e80', marginTop: 4 }}>
                {stockHealth.highStock || 0}
              </div>
              <small style={{ color: '#546b8a', fontSize: 10 }}>Over 5x threshold</small>
            </div>
          </div>

          {/* Distribution progress bar */}
          <div style={{ height: 12, display: 'flex', borderRadius: 6, overflow: 'hidden', background: '#e9eee9', marginBottom: 8 }}>
            <div style={{ width: `${((stockHealth.outOfStock || 0) / totalStockItems) * 100}%`, background: '#c94e4e' }} title="Out of stock" />
            <div style={{ width: `${((stockHealth.lowStock || 0) / totalStockItems) * 100}%`, background: '#f59e0b' }} title="Low stock" />
            <div style={{ width: `${((stockHealth.healthy || 0) / totalStockItems) * 100}%`, background: '#10b981' }} title="Healthy stock" />
            <div style={{ width: `${((stockHealth.highStock || 0) / totalStockItems) * 100}%`, background: '#3b82f6' }} title="High supply" />
          </div>

          {/* Limit: 100K items per business capacity meter */}
          <div style={{ marginTop: 14, padding: '12px 16px', background: '#f7faf8', borderRadius: 10, border: '1px solid #e3ede6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
              <span style={{ fontWeight: 700, color: '#34453b' }}>
                Business Catalogue Limit: {capacityUsed.toLocaleString()} / {maxLimit.toLocaleString()} items
              </span>
              <span style={{ color: '#258454', fontWeight: 700 }}>
                {capacityPercent}% used ({Math.max(0, maxLimit - capacityUsed).toLocaleString()} available)
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: '#e1eae3', overflow: 'hidden', marginTop: 6 }}>
              <div style={{ width: `${Math.max(1, Number(capacityPercent))}%`, height: '100%', background: '#258454' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
