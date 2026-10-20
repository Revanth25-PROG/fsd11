import React from "react";
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Bell, Search, Plus, Menu,
  Pencil, Trash2, ArrowUpRight, ArrowDownRight, RefreshCw, Leaf, CircleHelp
} from 'lucide-react';
import StatCard from './components/StatCard.jsx';
import ProductForm from './components/ProductForm.jsx';
import SaleForm from './components/SaleForm.jsx';
import {
  getProducts, getDashboard, getSales, addProduct, editProduct,
  deleteProduct, recordSale
} from './api.js';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function App() {
  const [page, setPage] = useState('Dashboard');
  const [products, setProducts] = useState([]);
  const [dashboard, setDashboard] = useState({ totalProducts: 0, totalUnits: 0, lowStockProducts: [], totalSales: 0 });
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All categories');
  const [productToEdit, setProductToEdit] = useState(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [productData, dashboardData, salesData] = await Promise.all([
        getProducts(), getDashboard(), getSales()
      ]);
      setProducts(productData);
      setDashboard(dashboardData);
      setSales(salesData);
    } catch (requestError) {
      setError(`${requestError.message} Make sure the backend and MongoDB are running.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const categories = useMemo(() => ['All categories', ...new Set(products.map((product) => product.category))], [products]);
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === 'All categories' || product.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3500);
  }

  async function handleSaveProduct(formData) {
    setSaving(true);
    try {
      if (productToEdit) {
        await editProduct(productToEdit._id, formData);
        showNotice('Product details updated.');
      } else {
        await addProduct(formData);
        showNotice('Product added successfully.');
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
    const shouldDelete = window.confirm(`Delete ${product.name}? This cannot be undone.`);
    if (!shouldDelete) return;
    try {
      await deleteProduct(product._id);
      showNotice(`${product.name} was deleted.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleRecordSale(productId, quantity) {
    setSaving(true);
    try {
      await recordSale(productId, quantity);
      setShowSaleForm(false);
      showNotice('Sale recorded and stock updated.');
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
    { label: 'Sales', icon: ShoppingCart },
    { label: 'Low stock', icon: Bell }
  ];

  function changePage(label) {
    setPage(label);
    setMobileMenuOpen(false);
    setError('');
  }

  const displayedProducts = page === 'Low stock'
    ? filteredProducts.filter((product) => product.quantity <= product.lowStockLimit)
    : filteredProducts;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#dashboard" onClick={() => changePage('Dashboard')}>
          <span className="brand-mark"><Leaf size={23} /></span>
          <span><strong>stockwise</strong><small>Inventory made simple</small></span>
        </a>
        <p className="nav-caption">WORKSPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} onClick={() => changePage(label)}>
              <Icon size={19} strokeWidth={1.9} /><span>{label}</span>
              {label === 'Low stock' && dashboard.lowStockProducts.length > 0 && <span className="nav-count">{dashboard.lowStockProducts.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon"><CircleHelp size={18} /></span><strong>Need a hand?</strong><p>Keep your stock organised, one product at a time.</p></div>
          <div className="profile-row"><div className="avatar">S</div><div><strong>Shop owner</strong><small>Workspace admin</small></div><span className="online-dot" /></div>
        </div>
      </aside>

      {mobileMenuOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu-button icon-button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle navigation"><Menu size={21} /></button>
          <div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div>
          <div className="topbar-right"><span className="today-label">Your shop at a glance</span><div className="avatar top-avatar">S</div></div>
        </header>

        <div className="page-content">
          {error && <div className="alert-banner error-banner"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
          {notice && <div className="alert-banner success-banner"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}

          {page === 'Dashboard' && (
            <>
              <section className="welcome-row">
                <div><p className="eyebrow">TUESDAY, OCTOBER 20, 2026</p><h1>Good to see you <span className="wave">✳</span></h1><p className="page-subtitle">Here’s what’s happening with your inventory today.</p></div>
                <div className="welcome-actions"><button className="button button-secondary" onClick={loadData}><RefreshCw size={16} /> Refresh</button><button className="button button-primary" onClick={openAddProduct}><Plus size={17} /> Add product</button></div>
              </section>

              <section className="stats-grid" aria-label="Inventory summary">
                <StatCard type="products" title="Total products" value={dashboard.totalProducts} note="Different items in your shop" />
                <StatCard type="units" title="Units in stock" value={dashboard.totalUnits.toLocaleString('en-IN')} note="Across all your products" />
                <StatCard type="low" title="Low-stock items" value={dashboard.lowStockProducts.length} note={dashboard.lowStockProducts.length ? 'Some items need your attention' : 'Everything is looking good'} />
                <StatCard type="sales" title="Sales recorded" value={money(dashboard.totalSales)} note="Total value of recorded sales" />
              </section>

              <section className="content-grid">
                <div className="panel product-panel">
                  <div className="panel-heading"><div><h2>Products overview</h2><p>A quick look at the items you manage.</p></div><button className="text-button" onClick={() => changePage('Products')}>View all <ArrowUpRight size={15} /></button></div>
                  <ProductTable products={products.slice(0, 5)} onEdit={openEditProduct} onDelete={handleDeleteProduct} compact />
                  {products.length === 0 && !loading && <EmptyProducts onAdd={openAddProduct} />}
                </div>
                <div className="panel low-stock-panel">
                  <div className="panel-heading"><div><h2>Needs attention</h2><p>Products running low</p></div><span className="soft-count">{dashboard.lowStockProducts.length}</span></div>
                  {dashboard.lowStockProducts.length === 0 ? <div className="empty-small"><span className="empty-check">✓</span><strong>All stocked up!</strong><p>No products are below their alert limit.</p></div> : <div className="low-stock-list">{dashboard.lowStockProducts.slice(0, 5).map((product) => <div className="low-stock-item" key={product._id}><div className="product-initial">{product.name.charAt(0).toUpperCase()}</div><div className="low-stock-info"><strong>{product.name}</strong><small>{product.category}</small></div><div className="stock-amount"><strong>{product.quantity}</strong><small>left</small></div></div>)}</div>}
                  {dashboard.lowStockProducts.length > 0 && <button className="button button-warning-outline full-width" onClick={() => changePage('Low stock')}>Review low stock</button>}
                </div>
              </section>

              <section className="panel recent-sales-panel"><div className="panel-heading"><div><h2>Recent sales</h2><p>Your latest recorded transactions.</p></div><button className="text-button" onClick={() => changePage('Sales')}>Sales history <ArrowUpRight size={15} /></button></div><SalesTable sales={sales.slice(0, 4)} /></section>
            </>
          )}

          {page === 'Products' && (
            <>
              <PageHeading eyebrow="YOUR CATALOGUE" title="Products" subtitle="Manage the items you keep on your shelves." action={<button className="button button-primary" onClick={openAddProduct}><Plus size={17} /> Add product</button>} />
              <ProductFilters search={search} setSearch={setSearch} category={category} setCategory={setCategory} categories={categories} />
              <section className="panel full-table-panel"><div className="table-heading"><div><h2>All products</h2><p>{displayedProducts.length} {displayedProducts.length === 1 ? 'item' : 'items'} shown</p></div><span className="table-label">LIVE INVENTORY</span></div><ProductTable products={displayedProducts} onEdit={openEditProduct} onDelete={handleDeleteProduct} /></section>
            </>
          )}

          {page === 'Low stock' && (
            <>
              <PageHeading eyebrow="RESTOCK REMINDERS" title="Low-stock items" subtitle="These products have reached their stock alert limit." action={<button className="button button-secondary" onClick={loadData}><RefreshCw size={16} /> Refresh</button>} />
              <ProductFilters search={search} setSearch={setSearch} category={category} setCategory={setCategory} categories={categories} />
              <section className="panel full-table-panel"><div className="table-heading"><div><h2>Items to check</h2><p>{displayedProducts.length} products need attention</p></div><span className="status-pill status-low">Restock soon</span></div><ProductTable products={displayedProducts} onEdit={openEditProduct} onDelete={handleDeleteProduct} /></section>
            </>
          )}

          {page === 'Sales' && (
            <>
              <PageHeading eyebrow="SHOP TRANSACTIONS" title="Sales history" subtitle="Every sale updates your stock automatically." action={<button className="button button-primary" onClick={() => setShowSaleForm(true)}><Plus size={17} /> Record a sale</button>} />
              <section className="panel full-table-panel"><div className="table-heading"><div><h2>Recent transactions</h2><p>Showing the latest 100 sales.</p></div><span className="table-label">SALES LOG</span></div><SalesTable sales={sales} /></section>
            </>
          )}

          <footer className="page-footer"><span>© 2026 Stockwise Inventory</span><span><span className="footer-dot" /> All changes are saved to your database</span></footer>
        </div>
      </main>

      {loading && <div className="loading-indicator"><span className="spinner" /> Loading inventory…</div>}
      {showProductForm && <ProductForm product={productToEdit} onSave={handleSaveProduct} onClose={() => { setShowProductForm(false); setProductToEdit(null); }} saving={saving} />}
      {showSaleForm && <SaleForm products={products} onSave={handleRecordSale} onClose={() => setShowSaleForm(false)} saving={saving} />}
    </div>
  );
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return <section className="welcome-row page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div><div className="welcome-actions">{action}</div></section>;
}

function ProductFilters({ search, setSearch, category, setCategory, categories }) {
  return <div className="filter-row"><label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products..." aria-label="Search products" /></label><select className="category-select" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">{categories.map((item) => <option key={item}>{item}</option>)}</select></div>;
}

function ProductTable({ products, onEdit, onDelete, compact = false }) {
  if (products.length === 0) return <div className="empty-state"><div className="empty-icon"><Package size={22} /></div><strong>No products found</strong><p>Add a product or try changing your search.</p></div>;

  return <div className="table-scroll"><table className="data-table"><thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>PRICE</th><th>IN STOCK</th><th>STATUS</th>{!compact && <th>ADDED</th>}<th className="actions-heading">ACTIONS</th></tr></thead><tbody>{products.map((product) => {
    const isLow = product.quantity <= product.lowStockLimit;
    return <tr key={product._id}><td><div className="product-cell"><div className="product-initial">{product.name.charAt(0).toUpperCase()}</div><div><strong>{product.name}</strong><small>Alert at {product.lowStockLimit} units</small></div></div></td><td><span className="category-tag">{product.category}</span></td><td className="price-cell">{money(product.price)}</td><td><strong className={isLow ? 'quantity-low' : 'quantity-normal'}>{product.quantity}</strong><span className="unit-label"> units</span></td><td><span className={`status-pill ${isLow ? 'status-low' : 'status-good'}`}><span className="status-dot" />{isLow ? 'Low stock' : 'In stock'}</span></td>{!compact && <td className="date-cell">{formatDate(product.createdAt)}</td>}<td><div className="row-actions"><button className="icon-button action-edit" onClick={() => onEdit(product)} aria-label={`Edit ${product.name}`} title="Edit product"><Pencil size={16} /></button><button className="icon-button action-delete" onClick={() => onDelete(product)} aria-label={`Delete ${product.name}`} title="Delete product"><Trash2 size={16} /></button></div></td></tr>;
  })}</tbody></table></div>;
}

function SalesTable({ sales }) {
  if (sales.length === 0) return <div className="empty-state"><div className="empty-icon"><ShoppingCart size={22} /></div><strong>No sales recorded yet</strong><p>When you record a sale, it will appear here.</p></div>;
  return <div className="table-scroll"><table className="data-table sales-table"><thead><tr><th>PRODUCT</th><th>DATE</th><th>QUANTITY</th><th>UNIT PRICE</th><th>TOTAL</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale._id}><td><div className="product-cell"><div className="product-initial sale-initial"><ShoppingCart size={16} /></div><div><strong>{sale.productName}</strong><small>Sale recorded</small></div></div></td><td className="date-cell">{formatDate(sale.createdAt)}</td><td>{sale.quantity} units</td><td>{money(sale.unitPrice)}</td><td className="price-cell">{money(sale.total)}</td></tr>)}</tbody></table></div>;
}

function EmptyProducts({ onAdd }) {
  return <div className="empty-state"><div className="empty-icon"><Package size={22} /></div><strong>Your inventory starts here</strong><p>Add your first product to start keeping track of stock.</p><button className="button button-primary" onClick={onAdd}><Plus size={16} /> Add first product</button></div>;
}
