import React from "react";
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Bell, Search, Plus, Menu,
  Pencil, Trash2, ArrowUpRight, RefreshCw, Leaf, CircleHelp,
  ScanLine, Sparkles, WifiOff, Wifi, UserCheck, Shield, Users, AlertCircle, Barcode
} from 'lucide-react';
import StatCard from './components/StatCard.jsx';
import ProductForm from './components/ProductForm.jsx';
import SaleForm from './components/SaleForm.jsx';
import BarcodeScannerModal from './components/BarcodeScannerModal.jsx';
import TrendCharts from './components/TrendCharts.jsx';
import PredictiveRestockView from './components/PredictiveRestockView.jsx';
import {
  getProducts, getDashboard, getSales, addProduct, editProduct,
  deleteProduct, recordSale, getPredictiveRestock, getTrends,
  setSessionUser, getSessionUser, syncOfflineQueue
} from './api.js';
import { offlineDb } from './offlineDb.js';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function App() {
  const [page, setPage] = useState('Dashboard');
  const [products, setProducts] = useState([]);
  const [dashboard, setDashboard] = useState({
    totalProducts: 0,
    totalUnits: 0,
    lowStockProducts: [],
    totalSales: 0,
    maxItemsLimit: 100000,
    limitUsagePercent: 0
  });
  const [sales, setSales] = useState([]);
  const [trends, setTrends] = useState({ salesTrend: [], stockHealth: {} });
  const [predictionsData, setPredictionsData] = useState({ summary: {}, predictions: [] });

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All categories');
  const [productToEdit, setProductToEdit] = useState(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [preselectedSaleProduct, setPreselectedSaleProduct] = useState(null);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [crossingAlert, setCrossingAlert] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Role-based access state
  const sessionUser = getSessionUser();
  const [currentRole, setCurrentRole] = useState(sessionUser.role || 'admin');

  // Offline-first state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState(offlineDb.getQueue().length);
  const [isOfflineData, setIsOfflineData] = useState(false);

  // Check offline queue and network connectivity
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      showNotice('Network connection restored. Syncing pending transactions…');
      handleSyncOffline();
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  function handleRoleChange(newRole) {
    setCurrentRole(newRole);
    setSessionUser(newRole, newRole === 'admin' ? 'Shop Owner (Admin)' : 'Shop Staff');
    showNotice(`Switched active role to: ${newRole === 'admin' ? 'Administrator' : 'Staff'}`);
  }

  async function handleSyncOffline() {
    try {
      const result = await syncOfflineQueue();
      setOfflineQueueCount(offlineDb.getQueue().length);
      if (result.syncedCount > 0) {
        showNotice(`Synced ${result.syncedCount} queued transactions with cloud database!`);
        await loadData();
      }
    } catch (e) {
      console.warn('Sync attempt failed:', e);
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [productRes, dashboardRes, salesRes, trendsRes, predictionsRes] = await Promise.all([
        getProducts({ limit: 1000 }),
        getDashboard(),
        getSales({ limit: 100 }),
        getTrends({ days: 7 }),
        getPredictiveRestock({ days: 14 })
      ]);

      const rawProducts = productRes?.products || productRes;
      const productList = Array.isArray(rawProducts)
        ? rawProducts
        : (rawProducts && typeof rawProducts === 'object'
            ? Object.values(rawProducts).filter((x) => x && typeof x === 'object' && (x.name || x._id))
            : []);
      setProducts(productList);
      setDashboard(dashboardRes || {});

      const rawSales = salesRes?.sales || salesRes;
      const salesList = Array.isArray(rawSales)
        ? rawSales
        : (rawSales && typeof rawSales === 'object'
            ? Object.values(rawSales).filter((x) => x && typeof x === 'object' && (x.productName || x._id))
            : []);
      setSales(salesList);
      setTrends(trendsRes || { salesTrend: [], stockHealth: {} });
      setPredictionsData(predictionsRes || { summary: {}, predictions: [] });

      if (productRes._isOffline || dashboardRes._isOffline) {
        setIsOfflineData(true);
      } else {
        setIsOfflineData(false);
      }

      setOfflineQueueCount(offlineDb.getQueue().length);
    } catch (requestError) {
      setError(`${requestError.message} (Using offline fallback if available).`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, currentRole]);

  const safeProducts = useMemo(() => {
    if (Array.isArray(products)) return products;
    if (products && typeof products === 'object') {
      return Object.values(products).filter((x) => x && typeof x === 'object' && (x.name || x._id));
    }
    return [];
  }, [products]);

  const safeSales = useMemo(() => {
    if (Array.isArray(sales)) return sales;
    if (sales && typeof sales === 'object') {
      return Object.values(sales).filter((x) => x && typeof x === 'object' && (x.productName || x._id));
    }
    return [];
  }, [sales]);

  const categories = useMemo(() => {
    return ['All categories', ...new Set(safeProducts.map((p) => p?.category).filter(Boolean))];
  }, [safeProducts]);

  const filteredProducts = useMemo(() => {
    return safeProducts.filter((product) => {
      if (!product || !product.name) return false;
      const q = (search || '').toLowerCase();
      const matchesSearch =
        product.name.toLowerCase().includes(q) ||
        (product.barcode && product.barcode.toLowerCase().includes(q));
      const matchesCategory = category === 'All categories' || product.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [safeProducts, search, category]);

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4500);
  }

  async function handleSaveProduct(formData) {
    setSaving(true);
    try {
      if (productToEdit) {
        await editProduct(productToEdit._id, formData);
        showNotice('Product details updated.');
      } else {
        await addProduct(formData);
        showNotice('Product registered to inventory.');
      }
      setShowProductForm(false);
      setProductToEdit(null);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct(product) {
    // Role-based permission guard
    if (currentRole !== 'admin') {
      setError('Staff role restriction: Only Administrators can delete products from inventory. To delete, switch your active role to Admin in the bottom-left sidebar.');
      return;
    }

    const shouldDelete = window.confirm(`Delete ${product.name}? This cannot be undone.`);
    if (!shouldDelete) return;
    try {
      await deleteProduct(product._id);
      showNotice(`${product.name} was removed from catalogue.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleRecordSale(productId, quantity, barcode) {
    setSaving(true);
    try {
      const response = await recordSale(productId, quantity, barcode);
      setShowSaleForm(false);
      setPreselectedSaleProduct(null);

      // Low stock alert check when threshold crossed
      if (response.alert && response.alert.triggered) {
        setCrossingAlert(response.alert);
      } else {
        showNotice(response.message || 'Sale recorded and inventory updated.');
      }

      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function openAddProduct() {
    setProductToEdit(null);
    setShowProductForm(true);
  }

  function openEditProduct(product) {
    setProductToEdit(product);
    setShowProductForm(true);
  }

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Products', icon: Package },
    { label: 'AI Restock', icon: Sparkles },
    { label: 'Low stock', icon: Bell },
    { label: 'Sales', icon: ShoppingCart }
  ];

  function changePage(label) {
    setPage(label);
    setMobileMenuOpen(false);
    setError('');
  }

  const displayedProducts = page === 'Low stock'
    ? filteredProducts.filter((product) => product.quantity <= product.lowStockLimit)
    : filteredProducts;

  const lowStockCount = dashboard.lowStockProducts ? dashboard.lowStockProducts.length : 0;
  const criticalRunoutCount = predictionsData?.summary?.criticalCount || 0;

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#dashboard" onClick={() => changePage('Dashboard')}>
          <span className="brand-mark"><Leaf size={23} /></span>
          <span><strong>stockwise</strong><small>Smart Inventory System</small></span>
        </a>

        <p className="nav-caption">WORKSPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${page === label ? 'active' : ''}`}
              onClick={() => changePage(label)}
            >
              <Icon size={19} strokeWidth={1.9} />
              <span>{label}</span>
              {label === 'Low stock' && lowStockCount > 0 && (
                <span className="nav-count">{lowStockCount}</span>
              )}
              {label === 'AI Restock' && criticalRunoutCount > 0 && (
                <span className="nav-count" style={{ background: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5' }}>
                  {criticalRunoutCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Barcode Quick Action */}
        <div style={{ padding: '12px 13px 0' }}>
          <button
            type="button"
            className="button button-secondary full-width"
            style={{ width: '100%', margin: 0, justifyContent: 'flex-start', padding: '9px 12px' }}
            onClick={() => setShowScannerModal(true)}
          >
            <ScanLine size={16} /> Scan Barcode
          </button>
        </div>

        {/* Sidebar Bottom: Role Switcher & Profile */}
        <div className="sidebar-bottom">
          {/* Active Role Switcher */}
          <div style={{ background: '#f4f8f5', padding: '10px 12px', borderRadius: 10, border: '1px solid #e1ebe3', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#68776f' }}>ACTIVE ROLE:</span>
              <span className={`role-pill ${currentRole === 'admin' ? 'role-admin' : 'role-staff'}`}>
                {currentRole === 'admin' ? 'Admin' : 'Staff'}
              </span>
            </div>
            <select
              className="role-select"
              style={{ width: '100%' }}
              value={currentRole}
              onChange={(e) => handleRoleChange(e.target.value)}
              aria-label="Switch active role"
            >
              <option value="admin">Administrator (Full CRUD)</option>
              <option value="staff">Store Staff (Restricted Delete)</option>
            </select>
          </div>

          <div className="profile-row">
            <div className="avatar">{currentRole === 'admin' ? 'A' : 'S'}</div>
            <div>
              <strong>{currentRole === 'admin' ? 'Admin Workspace' : 'Staff Terminal'}</strong>
              <small>{currentRole === 'admin' ? 'Full Business Rights' : 'Checkout & Stock Rights'}</small>
            </div>
            <span className={isOnline ? 'online-dot' : 'offline-dot-active'} title={isOnline ? 'Online' : 'Offline Mode'} />
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Main Content Area */}
      <main className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <button
            className="mobile-menu-button icon-button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation"
          >
            <Menu size={21} />
          </button>

          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{page}</strong>
            <span style={{ marginLeft: 12 }} className="capacity-pill">
              Limit: {dashboard.totalProducts || 0} / {(dashboard.maxItemsLimit || 100000).toLocaleString()} items
            </span>
          </div>

          <div className="topbar-right">
            {/* Offline & Sync Status */}
            {!isOnline && (
              <span className="role-pill" style={{ background: '#ffedd5', color: '#c2410c' }}>
                <WifiOff size={13} /> Offline Mode
              </span>
            )}
            {offlineQueueCount > 0 && (
              <button
                type="button"
                className="button button-warning-outline"
                style={{ padding: '5px 10px', fontSize: 11 }}
                onClick={handleSyncOffline}
              >
                Sync Outbox <span className="sync-badge">{offlineQueueCount}</span>
              </button>
            )}

            <button
              type="button"
              className="button button-secondary"
              style={{ padding: '7px 12px', fontSize: 11 }}
              onClick={() => setShowScannerModal(true)}
            >
              <ScanLine size={15} /> Barcode Scan
            </button>

            <div className="avatar top-avatar">{currentRole === 'admin' ? 'A' : 'S'}</div>
          </div>
        </header>

        <div className="page-content">
          {/* Offline Banner when disconnected */}
          {(!isOnline || isOfflineData) && (
            <div className="offline-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="offline-dot-active" />
                <span>
                  <strong>Offline-First Active:</strong> Serving from local storage. You can continue recording sales and stock; changes will auto-sync when online.
                </span>
              </div>
              {offlineQueueCount > 0 && (
                <button type="button" className="text-button" onClick={handleSyncOffline}>
                  Sync Now ({offlineQueueCount} pending)
                </button>
              )}
            </div>
          )}

          {/* Proactive Low Stock Alert Toast */}
          {crossingAlert && (
            <div className="alert-banner warning-banner" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertCircle size={20} style={{ color: '#d97706', flexShrink: 0 }} />
                <div>
                  <strong>{crossingAlert.message}</strong>
                  <p style={{ margin: '2px 0 0', fontSize: 11 }}>
                    Product: {crossingAlert.product?.name} (Only {crossingAlert.product?.quantity} left). Consider restocking soon.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="button button-primary"
                  style={{ padding: '5px 10px', fontSize: 11 }}
                  onClick={() => {
                    setCrossingAlert(null);
                    changePage('AI Restock');
                  }}
                >
                  Restock Suggestions
                </button>
                <button onClick={() => setCrossingAlert(null)} aria-label="Dismiss">×</button>
              </div>
            </div>
          )}

          {/* Feedback & Error Banners */}
          {error && (
            <div className="alert-banner error-banner">
              <span>{error}</span>
              <button onClick={() => setError('')} aria-label="Dismiss error">×</button>
            </div>
          )}
          {notice && (
            <div className="alert-banner success-banner">
              <span>{notice}</span>
              <button onClick={() => setNotice('')} aria-label="Dismiss message">×</button>
            </div>
          )}

          {/* PAGE: Dashboard */}
          {page === 'Dashboard' && (
            <>
              <section className="welcome-row">
                <div>
                  <p className="eyebrow">HIGH-THROUGHPUT INVENTORY ENGINE</p>
                  <h1>Smart Operations Dashboard <span className="wave">✳</span></h1>
                  <p className="page-subtitle">Real-time stock monitoring, automated low-stock triggers, and predictive restocking analytics.</p>
                </div>
                <div className="welcome-actions">
                  <button className="button button-secondary" onClick={loadData}>
                    <RefreshCw size={16} /> Refresh
                  </button>
                  <button className="button button-secondary" onClick={() => setShowScannerModal(true)}>
                    <ScanLine size={16} /> Barcode Scan
                  </button>
                  <button className="button button-primary" onClick={openAddProduct}>
                    <Plus size={17} /> Add product
                  </button>
                </div>
              </section>

              {/* Stat Cards Grid */}
              <section className="stats-grid" aria-label="Inventory summary">
                <StatCard
                  type="products"
                  title="Total products"
                  value={dashboard.totalProducts}
                  note={`Cap: ${(dashboard.maxItemsLimit || 100000).toLocaleString()} items max`}
                />
                <StatCard
                  type="units"
                  title="Units in stock"
                  value={Number(dashboard.totalUnits || 0).toLocaleString('en-IN')}
                  note="Inventory in warehouse & shelves"
                />
                <StatCard
                  type="low"
                  title="Low-stock alerts"
                  value={lowStockCount}
                  note={lowStockCount ? `${lowStockCount} items crossed threshold` : 'All stock above safety limits'}
                />
                <StatCard
                  type="sales"
                  title="Sales recorded"
                  value={money(dashboard.totalSales)}
                  note={`Today: ${money(dashboard.todaySales || 0)}`}
                />
              </section>

              {/* Responsive Trend Charts: Sales & Restocking Needs */}
              <TrendCharts trends={trends} dashboard={dashboard} />

              {/* Main Content Grid */}
              <section className="content-grid" style={{ marginTop: 20 }}>
                {/* Products Quick View */}
                <div className="panel product-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Products overview</h2>
                      <p>Top catalogue items with barcodes and real-time levels.</p>
                    </div>
                    <button className="text-button" onClick={() => changePage('Products')}>
                      View all <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <ProductTable
                    products={safeProducts.slice(0, 5)}
                    onEdit={openEditProduct}
                    onDelete={handleDeleteProduct}
                    onSell={(p) => {
                      setPreselectedSaleProduct(p);
                      setShowSaleForm(true);
                    }}
                    currentRole={currentRole}
                    compact
                  />
                  {safeProducts.length === 0 && !loading && <EmptyProducts onAdd={openAddProduct} />}
                </div>

                {/* Low Stock Alerts Attention Panel */}
                <div className="panel low-stock-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Threshold Alerts</h2>
                      <p>Products running low or out of stock</p>
                    </div>
                    <span className="soft-count">{lowStockCount}</span>
                  </div>

                  {lowStockCount === 0 ? (
                    <div className="empty-small">
                      <span className="empty-check">✓</span>
                      <strong>All stocked up!</strong>
                      <p>No products have breached their low-stock thresholds.</p>
                    </div>
                  ) : (
                    <div className="low-stock-list">
                      {(dashboard.lowStockProducts || []).slice(0, 6).map((product) => (
                        <div className="low-stock-item" key={product._id}>
                          <div
                            className="product-initial"
                            style={{
                              background: product.quantity === 0 ? '#fee2e2' : '#fef3c7',
                              color: product.quantity === 0 ? '#dc2626' : '#d97706'
                            }}
                          >
                            {product.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="low-stock-info">
                            <strong>{product.name}</strong>
                            <small>{product.category} {product.barcode && `• ${product.barcode}`}</small>
                          </div>
                          <div className="stock-amount">
                            <strong style={{ color: product.quantity === 0 ? '#dc2626' : '#b87822' }}>
                              {product.quantity}
                            </strong>
                            <small>left (limit: {product.lowStockLimit})</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {lowStockCount > 0 && (
                    <button
                      className="button button-warning-outline full-width"
                      onClick={() => changePage('Low stock')}
                    >
                      Review All {lowStockCount} Low Stock Items
                    </button>
                  )}
                </div>
              </section>

              {/* Recent Sales History Preview */}
              <section className="panel recent-sales-panel" style={{ marginTop: 20 }}>
                <div className="panel-heading">
                  <div>
                    <h2>Recent transactions</h2>
                    <p>Live transaction stream.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="button button-primary" style={{ padding: '6px 12px', fontSize: 11 }} onClick={() => setShowSaleForm(true)}>
                      <Plus size={14} /> Record Sale
                    </button>
                    <button className="text-button" onClick={() => changePage('Sales')}>
                      Sales log <ArrowUpRight size={15} />
                    </button>
                  </div>
                </div>
                <SalesTable sales={safeSales.slice(0, 5)} />
              </section>
            </>
          )}

          {/* PAGE: Products */}
          {page === 'Products' && (
            <>
              <PageHeading
                eyebrow="PRODUCT CATALOGUE & BARCODES"
                title="Products"
                subtitle="Manage stock items, scan barcodes, and enforce business item limits."
                action={
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="button button-secondary" onClick={() => setShowScannerModal(true)}>
                      <ScanLine size={16} /> Scan Barcode
                    </button>
                    <button className="button button-primary" onClick={openAddProduct}>
                      <Plus size={17} /> Add product
                    </button>
                  </div>
                }
              />
              <ProductFilters
                search={search}
                setSearch={setSearch}
                category={category}
                setCategory={setCategory}
                categories={categories}
              />
              <section className="panel full-table-panel">
                <div className="table-heading">
                  <div>
                    <h2>All products ({displayedProducts.length})</h2>
                    <p>Capacity: {safeProducts.length} / {(dashboard.maxItemsLimit || 100000).toLocaleString()} items</p>
                  </div>
                  <span className="table-label">CATALOGUE</span>
                </div>
                <ProductTable
                  products={displayedProducts}
                  onEdit={openEditProduct}
                  onDelete={handleDeleteProduct}
                  onSell={(p) => {
                    setPreselectedSaleProduct(p);
                    setShowSaleForm(true);
                  }}
                  currentRole={currentRole}
                />
              </section>
            </>
          )}

          {/* PAGE: AI Predictive Restock */}
          {page === 'AI Restock' && (
            <PredictiveRestockView
              predictionsData={predictionsData}
              onRefresh={loadData}
              onNotice={showNotice}
              onError={setError}
            />
          )}

          {/* PAGE: Low stock */}
          {page === 'Low stock' && (
            <>
              <PageHeading
                eyebrow="THRESHOLD ALERTS"
                title="Low-stock items"
                subtitle="Products where current quantity is at or below the alert threshold."
                action={
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="button button-primary" onClick={() => changePage('AI Restock')}>
                      <Sparkles size={16} /> AI Restock Suggestions
                    </button>
                    <button className="button button-secondary" onClick={loadData}>
                      <RefreshCw size={16} /> Refresh
                    </button>
                  </div>
                }
              />
              <ProductFilters
                search={search}
                setSearch={setSearch}
                category={category}
                setCategory={setCategory}
                categories={categories}
              />
              <section className="panel full-table-panel">
                <div className="table-heading">
                  <div>
                    <h2>Items Requiring Attention ({displayedProducts.length})</h2>
                    <p>Reorder these items to prevent sales interruptions.</p>
                  </div>
                  <span className="status-pill status-low">Alert Active</span>
                </div>
                <ProductTable
                  products={displayedProducts}
                  onEdit={openEditProduct}
                  onDelete={handleDeleteProduct}
                  onSell={(p) => {
                    setPreselectedSaleProduct(p);
                    setShowSaleForm(true);
                  }}
                  currentRole={currentRole}
                />
              </section>
            </>
          )}

          {/* PAGE: Sales */}
          {page === 'Sales' && (
            <>
              <PageHeading
                eyebrow="TRANSACTION HISTORY"
                title="Sales Log"
                subtitle="Audit log of sales transactions and automated stock reductions."
                action={
                  <button className="button button-primary" onClick={() => setShowSaleForm(true)}>
                    <Plus size={17} /> Record a sale
                  </button>
                }
              />
              <section className="panel full-table-panel">
                <div className="table-heading">
                  <div>
                    <h2>Recent transactions ({safeSales.length})</h2>
                    <p>High-throughput indexed sales entries.</p>
                  </div>
                  <span className="table-label">SALES LEDGER</span>
                </div>
                <SalesTable sales={safeSales} />
              </section>
            </>
          )}

          {/* Footer */}
          <footer className="page-footer">
            <span>© 2026 Stockwise Smart Inventory System</span>
            <span>
              <span className="footer-dot" /> High-Performance MERN Stack • Offline-Ready
            </span>
          </footer>
        </div>
      </main>

      {/* Modals */}
      {loading && (
        <div className="loading-indicator">
          <span className="spinner" /> Loading inventory…
        </div>
      )}

      {showProductForm && (
        <ProductForm
          product={productToEdit}
          onSave={handleSaveProduct}
          onClose={() => {
            setShowProductForm(false);
            setProductToEdit(null);
          }}
          saving={saving}
        />
      )}

      {showSaleForm && (
        <SaleForm
          products={safeProducts}
          preselectedProduct={preselectedSaleProduct}
          onSave={handleRecordSale}
          onClose={() => {
            setShowSaleForm(false);
            setPreselectedSaleProduct(null);
          }}
          saving={saving}
        />
      )}

      {showScannerModal && (
        <BarcodeScannerModal
          onClose={() => setShowScannerModal(false)}
          onStockUpdated={loadData}
          onSelectProductForSale={(prod) => {
            setPreselectedSaleProduct(prod);
            setShowSaleForm(true);
          }}
        />
      )}
    </div>
  );
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return (
    <section className="welcome-row page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <div className="welcome-actions">{action}</div>
    </section>
  );
}

function ProductFilters({ search, setSearch, category, setCategory, categories }) {
  return (
    <div className="filter-row">
      <label className="search-box">
        <Search size={18} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by product name or barcode..."
          aria-label="Search products"
        />
      </label>
      <select
        className="category-select"
        value={category}
        onChange={(event) => setCategory(event.target.value)}
        aria-label="Filter by category"
      >
        {categories.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </div>
  );
}

function ProductTable({ products, onEdit, onDelete, onSell, currentRole, compact = false }) {
  if (products.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><Package size={22} /></div>
        <strong>No products found</strong>
        <p>Add a product or try changing your search query.</p>
      </div>
    );
  }

  const isAdmin = currentRole === 'admin';

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>PRODUCT</th>
            <th>BARCODE</th>
            <th>CATEGORY</th>
            <th>PRICE</th>
            <th>IN STOCK</th>
            <th>STATUS</th>
            {!compact && <th>ADDED</th>}
            <th className="actions-heading">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const isLow = product.quantity <= product.lowStockLimit;
            const isOut = product.quantity === 0;

            return (
              <tr key={product._id}>
                <td>
                  <div className="product-cell">
                    <div
                      className="product-initial"
                      style={{
                        background: isOut ? '#fee2e2' : isLow ? '#fef3c7' : '#eef6ef',
                        color: isOut ? '#dc2626' : isLow ? '#d97706' : '#42815a'
                      }}
                    >
                      {product.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <strong>{product.name}</strong>
                      <small>Alert at {product.lowStockLimit} {product.unit || 'units'}</small>
                    </div>
                  </div>
                </td>

                <td>
                  {product.barcode ? (
                    <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#f0f4f1', padding: '3px 6px', borderRadius: 4 }}>
                      {product.barcode}
                    </span>
                  ) : (
                    <span style={{ color: '#abb4ae', fontSize: 11 }}>—</span>
                  )}
                </td>

                <td><span className="category-tag">{product.category}</span></td>

                <td className="price-cell">{money(product.price)}</td>

                <td>
                  <strong className={isOut ? 'quantity-low' : isLow ? 'quantity-low' : 'quantity-normal'} style={{ color: isOut ? '#dc2626' : undefined }}>
                    {product.quantity}
                  </strong>
                  <span className="unit-label"> {product.unit || 'units'}</span>
                </td>

                <td>
                  <span className={`status-pill ${isOut ? 'status-low' : isLow ? 'status-low' : 'status-good'}`} style={{ color: isOut ? '#b91c1c' : undefined, background: isOut ? '#fee2e2' : undefined }}>
                    <span className="status-dot" />
                    {isOut ? 'Out of stock' : isLow ? 'Low stock' : 'In stock'}
                  </span>
                </td>

                {!compact && <td className="date-cell">{formatDate(product.createdAt)}</td>}

                <td>
                  <div className="row-actions">
                    {onSell && product.quantity > 0 && (
                      <button
                        className="button button-secondary"
                        style={{ padding: '4px 8px', fontSize: 10, height: 28 }}
                        onClick={() => onSell(product)}
                        title="Record a sale"
                      >
                        <ShoppingCart size={13} /> Sell
                      </button>
                    )}
                    <button
                      className="icon-button action-edit"
                      onClick={() => onEdit(product)}
                      aria-label={`Edit ${product.name}`}
                      title="Edit product"
                    >
                      <Pencil size={15} />
                    </button>
                    {isAdmin ? (
                      <button
                        className="icon-button action-delete"
                        onClick={() => onDelete(product)}
                        aria-label={`Delete ${product.name}`}
                        title="Delete product (Admin only)"
                      >
                        <Trash2 size={15} />
                      </button>
                    ) : (
                      <button
                        className="icon-button"
                        style={{ opacity: 0.45, cursor: 'pointer' }}
                        onClick={() => onDelete(product)}
                        title="Staff role: Only Administrators can delete (click to view details)"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SalesTable({ sales }) {
  if (sales.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><ShoppingCart size={22} /></div>
        <strong>No sales recorded yet</strong>
        <p>When you record a sale, it will appear here in the live transaction audit stream.</p>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table className="data-table sales-table">
        <thead>
          <tr>
            <th>PRODUCT</th>
            <th>BARCODE</th>
            <th>DATE</th>
            <th>RECORDED BY</th>
            <th>QUANTITY</th>
            <th>UNIT PRICE</th>
            <th>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale._id}>
              <td>
                <div className="product-cell">
                  <div className="product-initial sale-initial">
                    <ShoppingCart size={16} />
                  </div>
                  <div>
                    <strong>{sale.productName}</strong>
                    <small>{sale._offline ? '⚡ Offline Transaction' : 'Processed'}</small>
                  </div>
                </div>
              </td>
              <td>
                {sale.barcode ? (
                  <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#f0f4f1', padding: '3px 6px', borderRadius: 4 }}>
                    {sale.barcode}
                  </span>
                ) : (
                  <span style={{ color: '#abb4ae', fontSize: 11 }}>—</span>
                )}
              </td>
              <td className="date-cell">{formatDate(sale.createdAt)}</td>
              <td>
                <span className="role-pill" style={{ background: '#f4f6f4', color: '#56665c' }}>
                  {sale.soldByName || 'Staff'}
                </span>
              </td>
              <td>{sale.quantity} units</td>
              <td>{money(sale.unitPrice)}</td>
              <td className="price-cell">{money(sale.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyProducts({ onAdd }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Package size={22} /></div>
      <strong>Your inventory starts here</strong>
      <p>Add products or scan barcodes to begin tracking stock.</p>
      <button className="button button-primary" onClick={onAdd}>
        <Plus size={16} /> Add first product
      </button>
    </div>
  );
}
