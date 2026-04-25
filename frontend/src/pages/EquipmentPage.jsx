import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { equipmentAPI } from '../api';
import DistrictSelect from '../components/DistrictSelect';

const CONDITION_COLORS = {
  new: 'badge-teal',
  excellent: 'badge-blue',
  good: 'badge-orange',
  fair: 'badge-gray',
};

const BOOKING_STATUS_COLORS = {
  available: 'badge-green',
  reserved: 'badge-orange',
  rented_out: 'badge-blue',
  returned: 'badge-green',
  damaged: 'badge-red',
  cancelled: 'badge-gray',
};

const MODAL_OVERLAY = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, paddingTop: 105
};

const MODAL_CARD = {
  background: '#fff', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
  padding: 32, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto'
};

const EMPTY_FORM = {
  equipmentName: '', equipmentDescription: '', equipmentCondition: 'good',
  rentalPricePerDay: '', quantityAvailable: 1,
  equipmentCategoryId: '',
};

export default function EquipmentPage() {
  const { user } = useAuth();
  const [equipment, setEquipment] = useState([]);
  const [categories, setCategories] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('browse');
  const [search, setSearch] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [bookForm, setBookForm] = useState({ equipmentId: '', rentalStartDate: '', rentalEndDate: '', quantity: 1 });
  const [showBook, setShowBook] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const isSupplier = user?.role === 'supplier';

  useEffect(() => { loadData(); }, []);

  const getEquipmentImage = (eq) => {
    if (eq.imagePath) return eq.imagePath;

    const name = (eq.equipmentName || '').toLowerCase();

    if (name.includes('cement')) return 'https://images.pexels.com/photos/5691502/pexels-photo-5691502.jpeg?auto=compress&cs=tinysrgb&w=600';
    if (name.includes('scaffolding') || name.includes('scaffold')) return 'https://images.pexels.com/photos/5854190/pexels-photo-5854190.jpeg?auto=compress&cs=tinysrgb&w=600';
    if (name.includes('hammer')) return 'https://images.pexels.com/photos/3807388/pexels-photo-3807388.jpeg?auto=compress&cs=tinysrgb&w=600';
    if (name.includes('helmet')) return 'https://images.pexels.com/photos/8486928/pexels-photo-8486928.jpeg?auto=compress&cs=tinysrgb&w=600';
    if (name.includes('sprayer') || name.includes('paint')) return 'https://images.pexels.com/photos/6476584/pexels-photo-6476584.jpeg?auto=compress&cs=tinysrgb&w=600';

    return 'https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg?auto=compress&cs=tinysrgb&w=600';
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [eqRes, catRes, bookRes] = await Promise.allSettled([
        isSupplier ? equipmentAPI.getAll() : equipmentAPI.getAvailable(),
        equipmentAPI.getCategories(),
        isSupplier ? equipmentAPI.getSupplierBookings() : equipmentAPI.getMyBookings(),
      ]);
      setEquipment(eqRes.status === 'fulfilled' ? eqRes.value?.data?.data || [] : []);
      setCategories(catRes.status === 'fulfilled' ? catRes.value?.data?.data || [] : []);
      setMyBookings(bookRes.status === 'fulfilled' ? bookRes.value?.data?.data || [] : []);
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  };

  const handleSubmitEquipment = async (e) => {
    e.preventDefault(); setError('');
    try {
      const payload = {
        categoryId: form.equipmentCategoryId ? parseInt(form.equipmentCategoryId) : null,
        equipmentName: form.equipmentName,
        equipmentDescription: form.equipmentDescription,
        equipmentCondition: form.equipmentCondition,
        rentalPricePerDay: form.rentalPricePerDay ? parseFloat(form.rentalPricePerDay) : null,
        // Use the single quantity field as the total quantity for backend
        quantityTotal: form.quantityAvailable ? parseInt(form.quantityAvailable, 10) : 1,
      };
      if (editId) { await equipmentAPI.update(editId, payload); }
      else { await equipmentAPI.add(payload); }
      setShowForm(false); setForm(EMPTY_FORM); setEditId(null);
      loadData();
    } catch (err) { setError(err.response?.data?.message || 'Failed to save equipment.'); }
  };

  const handleEdit = (eq) => {
    setForm({
      equipmentName: eq.equipmentName || '', equipmentDescription: eq.equipmentDescription || '',
      equipmentCondition: eq.equipmentCondition || 'good',
      rentalPricePerDay: eq.rentalPricePerDay || '',
      quantityAvailable: (eq.quantityAvailable ?? eq.quantityTotal ?? 1),
      equipmentCategoryId: eq.equipmentCategoryId || eq.categoryId || '',
    });
    setEditId(eq.equipmentId || eq.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this equipment?')) return;
    try { await equipmentAPI.delete(id); loadData(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to delete.'); }
  };

  const handleBook = async (e) => {
    e.preventDefault(); setError('');
    try {
      await equipmentAPI.book({
        ...bookForm,
        quantity: bookForm.quantity ? parseInt(bookForm.quantity, 10) : 1,
      });
      setShowBook(false);
      setBookForm({ equipmentId: '', rentalStartDate: '', rentalEndDate: '', quantity: 1 });
      loadData();
    } catch (err) { setError(err.response?.data?.message || 'Failed to book.'); }
  };

  const handleReturn = async (bookingId) => {
    try { await equipmentAPI.returnEquipment(bookingId); loadData(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to return.'); }
  };

  const openBookModal = (eq) => {
    setBookForm({ ...bookForm, equipmentId: eq.equipmentId || eq.id });
    setShowBook(true);
  };

  const TABS = isSupplier
    ? [{ key: 'browse', label: '🛠 My Inventory' }, { key: 'bookings', label: '📅 Rental Bookings' }]
    : [{ key: 'browse', label: '🔍 Browse Tools' }, { key: 'bookings', label: '📦 My Rentals' }];

  const filteredEquipment = equipment.filter((eq) => {
    const term = search.trim().toLowerCase();
    const inSearch = !term
      || (eq.equipmentName || '').toLowerCase().includes(term)
      || (eq.equipmentDescription || '').toLowerCase().includes(term)
      || (eq.categoryName || '').toLowerCase().includes(term);
    const catId = eq.equipmentCategoryId || eq.categoryId || '';
    const inCategory = !filterCategoryId || String(catId) === String(filterCategoryId);
    // For customers, allow filtering by supplier district.
    // For suppliers ("My Inventory" view), ignore the district filter so
    // they always see their own tools regardless of selection.
    const district = eq.supplier?.district || '';
    const inDistrict = isSupplier
      ? true
      : (!filterDistrict || (district && district.toLowerCase() === filterDistrict.toLowerCase()));
    return inSearch && inCategory && inDistrict;
  });

  const activeBookingsCount = myBookings.filter(b => b.bookingStatus === 'reserved' || b.bookingStatus === 'rented_out').length;
  const returnedBookingsCount = myBookings.filter(b => b.bookingStatus === 'returned').length;

  const hasActiveFilters = !!(search.trim() || filterCategoryId || (!isSupplier && filterDistrict));

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isSupplier ? 'Equipment Inventory' : 'Equipment Rentals'}</h1>
          <p className="page-subtitle">{isSupplier ? 'Manage and track the tools you list on SkillConnect' : 'Browse and rent professional tools and equipment for your projects'}</p>
        </div>
        {isSupplier && (
          <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); }} className="btn-primary">
            + Add Equipment
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px', borderRadius: 12, cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              background: tab === t.key ? 'linear-gradient(135deg,#f97316,#ea580c)' : '#fff',
              color: tab === t.key ? '#fff' : '#64748b',
              border: tab === t.key ? 'none' : '1.5px solid #e5e7eb',
              boxShadow: tab === t.key ? '0 4px 16px rgba(0,0,0,0.28)' : 'none',
              transition: 'all 0.2s'
            }}>{t.label}</button>
        ))}
      </div>

      {error && <div className="alert-error" style={{ marginBottom: 20 }}>❌ {error}</div>}

      {/* Equipment Form Modal */}
      {showForm && (
        <div style={MODAL_OVERLAY} onClick={() => setShowForm(false)}>
          <div style={MODAL_CARD} onClick={e => e.stopPropagation()} className="scale-in">
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0c4a6e', marginBottom: 20 }}>
              {editId ? 'Edit Equipment' : 'Add New Equipment'}
            </h2>
            <form onSubmit={handleSubmitEquipment} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="hm-label">Equipment Name</label>
                <input type="text" className="hm-input" required value={form.equipmentName} onChange={e => setForm({ ...form, equipmentName: e.target.value })} placeholder="e.g. Jackhammer" />
              </div>
              <div>
                <label className="hm-label">Description</label>
                <textarea className="hm-input" rows={2} value={form.equipmentDescription} onChange={e => setForm({ ...form, equipmentDescription: e.target.value })} placeholder="Brief details about the tool..." style={{ resize: 'none' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="hm-label">Condition</label>
                  <select className="hm-input" value={form.equipmentCondition} onChange={e => setForm({ ...form, equipmentCondition: e.target.value })}>
                    <option value="new">New</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                  </select>
                </div>
                {categories.length > 0 && (
                  <div>
                    <label className="hm-label">Category</label>
                    <select className="hm-input" value={form.equipmentCategoryId} onChange={e => setForm({ ...form, equipmentCategoryId: e.target.value })}>
                      <option value="">Select</option>
                      {categories.map(c => <option key={c.equipmentCategoryId || c.id} value={c.equipmentCategoryId || c.id}>{c.categoryName}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="hm-label">Daily Rate (LKR)</label>
                <input type="number" className="hm-input" required value={form.rentalPricePerDay} onChange={e => setForm({ ...form, rentalPricePerDay: e.target.value })} />
              </div>
              <div>
                <label className="hm-label">Available Qty</label>
                <input
                  type="number"
                  className="hm-input"
                  min="1"
                  value={form.quantityAvailable}
                  onChange={e => setForm({ ...form, quantityAvailable: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editId ? 'Update Listing' : 'Submit Listing'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rent Modal */}
      {showBook && (
        <div style={MODAL_OVERLAY} onClick={() => setShowBook(false)}>
          <div style={MODAL_CARD} onClick={e => e.stopPropagation()} className="scale-in">
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0c4a6e', marginBottom: 20 }}>Rent Tool</h2>
            <form onSubmit={handleBook} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="hm-label">Start Date</label>
                  <input type="date" className="hm-input" required min={today} value={bookForm.rentalStartDate} onChange={e => setBookForm({ ...bookForm, rentalStartDate: e.target.value })} />
                </div>
                <div>
                  <label className="hm-label">End Date</label>
                  <input type="date" className="hm-input" required min={bookForm.rentalStartDate || today} value={bookForm.rentalEndDate} onChange={e => setBookForm({ ...bookForm, rentalEndDate: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="hm-label">Quantity to Rent</label>
                <input type="number" className="hm-input" min="1" required value={bookForm.quantity} onChange={e => setBookForm({ ...bookForm, quantity: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Confirm Rental</button>
                <button type="button" onClick={() => setShowBook(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#0891b2', gap: 12 }}>
          <span className="spinner" /> Loading inventory...
        </div>
      ) : tab === 'browse' ? (
        filteredEquipment.length === 0 ? (
          <div className="hm-card" style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>📦</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0c4a6e', marginBottom: 4 }}>No equipment found</h3>
            <p style={{ color: '#64748b', marginBottom: hasActiveFilters && !isSupplier ? 16 : 0 }}>
              {isSupplier
                ? 'Start by adding your first tool to the inventory.'
                : (hasActiveFilters
                  ? 'No tools match your current filters.'
                  : 'Try adjusting your search or filters, or check back later.')}
            </p>
            {!isSupplier && hasActiveFilters && (
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: 4 }}
                onClick={() => {
                  setSearch('');
                  setFilterCategoryId('');
                  setFilterDistrict('');
                }}
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Left column: search + results */}
            <div style={{ flex: '1 1 620px', minWidth: 'min(100%, 620px)' }}>
              <div
                style={{
                  marginBottom: 20,
                  padding: 18,
                  borderRadius: 18,
                  background: '#eff4ff',
                  boxShadow: '0 4px 20px rgba(15,23,42,0.04)',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ flex: '1 1 220px', minWidth: 220 }}>
                    <label className="hm-label" style={{ marginBottom: 4 }}>
                      Search tools or equipment
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span
                        style={{
                          position: 'absolute',
                          left: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: 15,
                          color: '#9ca3af',
                        }}
                      >
                        🔍
                      </span>
                      <input
                        className="hm-input"
                        placeholder="Search by name or description"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ paddingLeft: 36, background: '#ffffff' }}
                      />
                    </div>
                  </div>

                  {categories.length > 0 && (
                    <div style={{ flex: '0 1 200px', minWidth: 200 }}>
                      <label className="hm-label" style={{ marginBottom: 4 }}>
                        Category
                      </label>
                      <select
                        className="hm-input"
                        value={filterCategoryId}
                        onChange={e => setFilterCategoryId(e.target.value)}
                        style={{ background: '#ffffff' }}
                      >
                        <option value="">All categories</option>
                        {categories.map(c => (
                          <option
                            key={c.equipmentCategoryId || c.id}
                            value={c.equipmentCategoryId || c.id}
                          >
                            {c.categoryName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {!isSupplier && (
                    <div style={{ flex: '0 1 200px', minWidth: 200 }}>
                      <label className="hm-label" style={{ marginBottom: 4 }}>
                        District
                      </label>
                      <DistrictSelect
                        value={filterDistrict}
                        onChange={(value) => setFilterDistrict(value || '')}
                        required={false}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                  gap: 18,
                }}
              >
                {filteredEquipment.map(eq => (
                  <div
                    key={eq.equipmentId || eq.id}
                    className="hm-card"
                    style={{
                      padding: 16,
                      borderRadius: 22,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: 240,
                    }}
                  >
                    <div style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          width: '100%',
                          height: 130,
                          borderRadius: 18,
                          overflow: 'hidden',
                          background: 'linear-gradient(135deg,#e0f2fe,#f5f5ff)',
                          border: '1px solid #dbeafe',
                          marginBottom: 10,
                        }}
                      >
                        <img
                          src={getEquipmentImage(eq)}
                          alt={eq.equipmentName || 'Equipment photo'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      </div>

                      <h3
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: '#0c4a6e',
                          marginBottom: 2,
                        }}
                      >
                        {eq.equipmentName}
                      </h3>
                      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                        {eq.categoryName || 'General Equipment'}
                      </p>
                      {eq.equipmentDescription && (
                        <p
                          style={{
                            fontSize: 12,
                            color: '#475569',
                            lineHeight: 1.5,
                            marginBottom: 8,
                            maxHeight: 34,
                            overflow: 'hidden',
                          }}
                        >
                          {eq.equipmentDescription}
                        </p>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <span className={`badge ${CONDITION_COLORS[eq.equipmentCondition] || 'badge-gray'}`}>
                          {eq.equipmentCondition}
                        </span>
                        <span className="badge badge-gray">
                          Qty: {eq.quantityAvailable ?? eq.quantityTotal ?? 0}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 4,
                      }}
                    >
                      <div>
                        <div>
                          <span
                            style={{
                              fontSize: 18,
                              fontWeight: 900,
                              color: '#0891b2',
                            }}
                          >
                            Rs.{eq.rentalPricePerDay}
                          </span>
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>
                            /day
                          </span>
                        </div>
                      </div>

                      {isSupplier ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleEdit(eq)}
                            className="btn-secondary"
                            style={{ padding: '6px 10px', fontSize: 12 }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(eq.equipmentId || eq.id)}
                            className="btn-danger"
                            style={{ padding: '6px 10px', fontSize: 12 }}
                          >
                            🗑
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => openBookModal(eq)}
                          className="btn-primary"
                          style={{ padding: '8px 16px', fontSize: 13 }}
                        >
                          Rent Now
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column: snapshot & recent */}
            <div style={{ flex: '1 1 260px', minWidth: 260, maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="hm-card" style={{ padding: 18 }}>
                <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
                  {isSupplier ? 'Inventory snapshot' : 'Rental snapshot'}
                </h3>
                <p className="section-sub" style={{ marginBottom: 14 }}>
                  {isSupplier
                    ? 'Quick view of your listed tools and current bookings.'
                    : 'Overview of your current and past equipment rentals.'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Active
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0c4a6e' }}>{activeBookingsCount}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Returned
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0c4a6e' }}>{returnedBookingsCount}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Total
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0c4a6e' }}>{myBookings.length}</div>
                  </div>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 999,
                    background: '#e5e7eb',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${myBookings.length ? Math.min(100, (activeBookingsCount / myBookings.length) * 100) : 0}%`,
                      height: '100%',
                      background: 'linear-gradient(135deg,#f97316,#ea580c)',
                    }}
                  />
                </div>
              </div>

              <div className="hm-card" style={{ padding: 18 }}>
                <h3 className="section-title" style={{ fontSize: 15, marginBottom: 8 }}>
                  Recent rentals
                </h3>
                {myBookings.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#64748b' }}>
                    {isSupplier
                      ? 'Your latest equipment bookings will appear here.'
                      : 'Your recent rentals will appear here once you book equipment.'}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {myBookings.slice(0, 3).map(b => (
                      <div
                        key={b.equipmentBookingId || b.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: 13,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: '#0c4a6e',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 170,
                            }}
                          >
                            {b.equipmentName || b.equipment?.equipmentName || 'Equipment'}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>
                            {b.rentalStartDate} → {b.rentalEndDate}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                            {b.bookingStatus?.replace('_', ' ') || 'status'}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0891b2' }}>Rs.{b.totalCost || 0}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      ) : (
        /* Bookings Tab */
        myBookings.length === 0 ? (
          <div className="hm-card" style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>📜</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0c4a6e', marginBottom: 4 }}>No rental history</h3>
            <p style={{ color: '#64748b' }}>Your equipment rental activity will be listed here.</p>
          </div>
        ) : (
          <div className="hm-card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '16px 20px', fontWeight: 700, color: '#64748b' }}>Equipment</th>
                    <th style={{ textAlign: 'left', padding: '16px 20px', fontWeight: 700, color: '#64748b' }}>Rental Period</th>
                    <th style={{ textAlign: 'left', padding: '16px 20px', fontWeight: 700, color: '#64748b' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '16px 20px', fontWeight: 700, color: '#64748b' }}>Total Cost</th>
                    <th style={{ textAlign: 'right', padding: '16px 20px', fontWeight: 700, color: '#64748b' }}>Actions</th>
                  </tr>
                </thead>
                <tbody style={{ divideY: '1px solid #f1f5f9' }}>
                  {myBookings.map(b => (
                    <tr key={b.equipmentBookingId || b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 800, color: '#0c4a6e' }}>
                        {b.equipmentName || b.equipment?.equipmentName || `Item #${b.equipmentId || b.equipment?.equipmentId || 'N/A'}`}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#475569' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {b.rentalStartDate} <span style={{ opacity: 0.4 }}>→</span> {b.rentalEndDate}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span className={`badge ${BOOKING_STATUS_COLORS[b.bookingStatus] || 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>
                          {(b.bookingStatus || '').replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 800, color: '#0891b2' }}>Rs.{b.totalCost || 0}</td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        {(b.bookingStatus === 'rented_out' || b.bookingStatus === 'reserved') && (
                          <button onClick={() => handleReturn(b.equipmentBookingId || b.id)} className="btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }}>
                            Return
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
