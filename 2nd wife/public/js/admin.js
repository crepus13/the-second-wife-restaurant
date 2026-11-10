/**
 * THE SECOND WIFE FAMILY RESTAURANT - Admin Portal Logic
 * Real-time Menu Editor (Price, Photos, Stock), Discounts/Coupons Manager,
 * Live Orders Pipeline, Reservations & Restaurant Branding Settings.
 */

const API_BASE = '/api';

const adminState = {
  stats: {},
  menuItems: [],
  categories: [],
  coupons: [],
  orders: [],
  reservations: [],
  config: {},
  currentTab: 'menu',
  activeEditItem: null
};

// UI Helper: Toast Notifications
function showAdminToast(message, type = 'success') {
  const container = document.getElementById('admin-toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✅' : (type === 'error' ? '⚠️' : 'ℹ️');
  toast.innerHTML = `
    <div class="flex items-center gap-3">
      <span>${icon}</span>
      <span class="font-medium text-sm">${message}</span>
    </div>
    <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-white ml-3 text-lg">&times;</button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Check Admin Authentication
async function verifyAdmin() {
  try {
    const token = localStorage.getItem('xyz_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/auth/me`, { headers });
    const data = await res.json();
    if (!data.user || data.user.role !== 'admin') {
      alert("Access Denied: You must be logged in as an Administrator to view this dashboard.\n\nDefault Admin Login:\nEmail: admin@xyz.com\nPassword: admin123");
      window.location.href = '/index.html';
      return false;
    }
    document.getElementById('admin-profile-name').textContent = data.user.name;
    return true;
  } catch (err) {
    window.location.href = '/index.html';
    return false;
  }
}

// Initial Data Load
async function initAdmin() {
  const isAuth = await verifyAdmin();
  if (!isAuth) return;

  await Promise.all([
    fetchStats(),
    fetchConfig(),
    fetchCategories(),
    fetchMenu(),
    fetchCoupons(),
    fetchOrders(),
    fetchReservations()
  ]);

  switchTab('menu');
}

// 1. Fetch Stats
async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    if (res.ok) {
      adminState.stats = await res.json();
      renderStats();
    }
  } catch (e) {
    console.error(e);
  }
}

function renderStats() {
  document.getElementById('stat-revenue').textContent = `₹${adminState.stats.total_revenue || 0}`;
  document.getElementById('stat-orders').textContent = adminState.stats.total_orders || 0;
  document.getElementById('stat-pending-orders').textContent = adminState.stats.pending_orders || 0;
  document.getElementById('stat-dishes').textContent = adminState.stats.total_items || 0;
  document.getElementById('stat-reservations').textContent = adminState.stats.total_reservations || 0;
}

// 2. Fetch Restaurant Settings
async function fetchConfig() {
  try {
    const res = await fetch(`${API_BASE}/config`);
    if (res.ok) {
      adminState.config = await res.json();
      applyConfigToForm();
    }
  } catch (e) {
    console.error(e);
  }
}

function applyConfigToForm() {
  const brandName = adminState.config.restaurant_name || "THE SECOND WIFE FAMILY RESTAURANT";
  document.querySelectorAll('.admin-brand-name').forEach(el => el.textContent = brandName);

  const setVal = (id, key) => {
    const el = document.getElementById(id);
    if (el && adminState.config[key] !== undefined) el.value = adminState.config[key];
  };

  setVal('setting-name', 'restaurant_name');
  setVal('setting-tagline', 'restaurant_tagline');
  setVal('setting-phone', 'restaurant_phone');
  setVal('setting-email', 'restaurant_email');
  setVal('setting-address', 'restaurant_address');
  setVal('setting-delivery-fee', 'delivery_fee');
  setVal('setting-free-delivery', 'free_delivery_threshold');
  setVal('setting-tax-rate', 'tax_rate_percent');
  setVal('setting-packaging', 'packaging_charge');
}

async function handleSaveSettings(e) {
  e.preventDefault();
  const payload = {
    restaurant_name: document.getElementById('setting-name').value.trim(),
    restaurant_tagline: document.getElementById('setting-tagline').value.trim(),
    restaurant_phone: document.getElementById('setting-phone').value.trim(),
    restaurant_email: document.getElementById('setting-email').value.trim(),
    restaurant_address: document.getElementById('setting-address').value.trim(),
    delivery_fee: document.getElementById('setting-delivery-fee').value,
    free_delivery_threshold: document.getElementById('setting-free-delivery').value,
    tax_rate_percent: document.getElementById('setting-tax-rate').value,
    packaging_charge: document.getElementById('setting-packaging').value
  };

  try {
    const res = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      adminState.config = { ...adminState.config, ...payload };
      applyConfigToForm();
      showAdminToast("Restaurant branding & settings saved successfully! 🎉");
    }
  } catch (err) {
    showAdminToast("Failed to save settings", "error");
  }
}

// 3. Fetch Categories
async function fetchCategories() {
  try {
    const res = await fetch(`${API_BASE}/categories`);
    if (res.ok) {
      adminState.categories = await res.json();
      populateCategoryDropdowns();
    }
  } catch (e) {
    console.error(e);
  }
}

function populateCategoryDropdowns() {
  const selects = [document.getElementById('dish-category'), document.getElementById('edit-dish-category')];
  selects.forEach(select => {
    if (!select) return;
    select.innerHTML = adminState.categories
      .filter(c => c.slug !== 'all')
      .map(c => `<option value="${c.id}">${c.name}</option>`)
      .join('');
  });
}

// 4. Menu Management (Price, Pics, Availability Editor)
async function fetchMenu() {
  try {
    const res = await fetch(`${API_BASE}/menu?category=all`);
    if (res.ok) {
      adminState.menuItems = await res.json();
      renderMenuTable();
    }
  } catch (e) {
    console.error(e);
  }
}

function renderMenuTable() {
  const tbody = document.getElementById('menu-items-tbody');
  if (!tbody) return;

  const search = (document.getElementById('admin-menu-search')?.value || '').toLowerCase();
  const filterCat = document.getElementById('admin-menu-cat-filter')?.value || 'all';

  const items = adminState.menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search) || (item.description || '').toLowerCase().includes(search);
    const matchesCat = filterCat === 'all' || item.category_slug === filterCat;
    return matchesSearch && matchesCat;
  });

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-gray-500 font-medium">No dishes found</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(item => `
    <tr class="border-b border-gray-100 hover:bg-gray-50/80 transition">
      <!-- Dish Image & Name -->
      <td class="py-3 px-4">
        <div class="flex items-center gap-3">
          <img src="${item.image_url}" alt="${item.name}" 
               class="w-14 h-14 rounded-xl object-cover border border-gray-200 flex-shrink-0"
               onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80'" />
          <div>
            <div class="flex items-center gap-1.5">
              <span class="${item.is_veg ? 'food-symbol-veg' : 'food-symbol-nonveg'}"></span>
              <span class="font-bold text-gray-900 text-sm">${item.name}</span>
            </div>
            <p class="text-xs text-gray-500 line-clamp-1 mt-0.5">${item.category_name || 'Category'}</p>
          </div>
        </div>
      </td>

      <!-- Price & Strikethrough -->
      <td class="py-3 px-4">
        ${item.has_half_full ? `
          <div>
            <div class="flex items-center gap-1.5">
              <span class="font-extrabold text-xs text-gray-900">H: ₹${item.half_price}</span>
              <span class="text-gray-300">/</span>
              <span class="font-extrabold text-xs text-gray-900">F: ₹${item.full_price}</span>
            </div>
            <span class="text-[10px] bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded inline-block mt-0.5">Half/Full</span>
          </div>
        ` : `
          <div class="flex items-baseline gap-1.5">
            <span class="font-extrabold text-sm text-gray-900">₹${item.price}</span>
            ${item.original_price > item.price ? `<span class="text-xs text-gray-400 line-through">₹${item.original_price}</span>` : ''}
          </div>
        `}
      </td>

      <!-- Badges -->
      <td class="py-3 px-4">
        <div class="flex flex-wrap gap-1">
          ${item.is_bestseller ? '<span class="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">Bestseller</span>' : ''}
          ${item.spice_level > 1 ? `<span class="text-xs">${'🌶️'.repeat(item.spice_level)}</span>` : ''}
        </div>
      </td>

      <!-- Availability Switch -->
      <td class="py-3 px-4">
        <button onclick="toggleAvailability(${item.id}, ${item.is_available === 1 ? 0 : 1})" 
                class="px-2.5 py-1 rounded-full text-xs font-bold transition flex items-center gap-1 ${item.is_available === 1 ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-red-100 text-red-800 hover:bg-red-200'
    }">
          <span class="w-2 h-2 rounded-full ${item.is_available === 1 ? 'bg-emerald-600' : 'bg-red-600'}"></span>
          ${item.is_available === 1 ? 'In Stock' : 'Sold Out'}
        </button>
      </td>

      <!-- Rating -->
      <td class="py-3 px-4 text-xs font-bold text-gray-700">
        ★ ${item.rating || 4.7}
      </td>

      <!-- Actions (Edit Price/Pic, Delete) -->
      <td class="py-3 px-4 text-right">
        <div class="flex items-center justify-end gap-2">
          <button onclick="openEditDishModal(${item.id})" 
                  class="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1">
            <span>✏️</span> Edit Price & Pic
          </button>
          <button onclick="deleteMenuItem(${item.id}, '${item.name.replace(/'/g, "\\'")}')" 
                  class="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-2.5 py-1.5 rounded-lg transition">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// In-place Dish Editor Modal
function openEditDishModal(itemId) {
  const item = adminState.menuItems.find(m => m.id === itemId);
  if (!item) return;

  adminState.activeEditItem = item;
  document.getElementById('edit-dish-id').value = item.id;
  document.getElementById('edit-dish-name').value = item.name;
  document.getElementById('edit-dish-category').value = item.category_id;
  document.getElementById('edit-dish-price').value = item.price;
  document.getElementById('edit-dish-orig-price').value = item.original_price || item.price;
  document.getElementById('edit-dish-image').value = item.image_url;
  document.getElementById('edit-dish-desc').value = item.description || '';
  document.getElementById('edit-dish-veg').checked = item.is_veg === 1;
  document.getElementById('edit-dish-bestseller').checked = item.is_bestseller === 1;
  document.getElementById('edit-dish-available').checked = item.is_available === 1;

  // Half & Full Plate Sizing
  const hasHf = item.has_half_full === 1;
  const hfCheckbox = document.getElementById('edit-dish-has-hf');
  if (hfCheckbox) {
    hfCheckbox.checked = hasHf;
    document.getElementById('edit-dish-half-price').value = item.half_price || item.price;
    document.getElementById('edit-dish-full-price').value = item.full_price || item.price;
    toggleEditHalfFullFields();
  }

  // Preview Image
  updateImagePreview('edit-dish-image', 'edit-image-preview');

  document.getElementById('edit-dish-modal').classList.remove('hidden');
}

function toggleEditHalfFullFields() {
  const isChecked = document.getElementById('edit-dish-has-hf')?.checked;
  const box = document.getElementById('edit-dish-hf-fields');
  const singlePriceBox = document.getElementById('edit-single-price-box');
  if (!box) return;
  if (isChecked) {
    box.classList.remove('hidden');
    if (singlePriceBox) singlePriceBox.classList.add('opacity-50');
  } else {
    box.classList.add('hidden');
    if (singlePriceBox) singlePriceBox.classList.remove('opacity-50');
  }
}

function toggleAddHalfFullFields() {
  const isChecked = document.getElementById('dish-has-hf')?.checked;
  const box = document.getElementById('dish-hf-fields');
  if (!box) return;
  if (isChecked) box.classList.remove('hidden');
  else box.classList.add('hidden');
}

function closeEditDishModal() {
  document.getElementById('edit-dish-modal').classList.add('hidden');
}

function updateImagePreview(inputId, imgId) {
  const url = document.getElementById(inputId).value.trim();
  const img = document.getElementById(imgId);
  if (img && url) {
    img.src = url;
  }
}

async function handleEditDishSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-dish-id').value;
  const hfCheckbox = document.getElementById('edit-dish-has-hf');
  const hasHf = hfCheckbox && hfCheckbox.checked ? 1 : 0;
  const halfPrice = parseFloat(document.getElementById('edit-dish-half-price')?.value || 0);
  const fullPrice = parseFloat(document.getElementById('edit-dish-full-price')?.value || 0);
  const price = hasHf ? halfPrice : parseFloat(document.getElementById('edit-dish-price').value);

  const payload = {
    name: document.getElementById('edit-dish-name').value.trim(),
    category_id: parseInt(document.getElementById('edit-dish-category').value),
    price: price,
    original_price: parseFloat(document.getElementById('edit-dish-orig-price').value || price),
    image_url: document.getElementById('edit-dish-image').value.trim(),
    description: document.getElementById('edit-dish-desc').value.trim(),
    is_veg: document.getElementById('edit-dish-veg').checked ? 1 : 0,
    is_bestseller: document.getElementById('edit-dish-bestseller').checked ? 1 : 0,
    is_available: document.getElementById('edit-dish-available').checked ? 1 : 0,
    has_half_full: hasHf,
    half_price: halfPrice,
    full_price: fullPrice
  };

  try {
    const res = await fetch(`${API_BASE}/menu/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showAdminToast("Dish updated successfully! Price & photo are live. 🌟");
      closeEditDishModal();
      await fetchMenu();
      fetchStats();
    } else {
      showAdminToast("Failed to update dish", "error");
    }
  } catch (err) {
    showAdminToast("Network error updating dish", "error");
  }
}

// Add New Dish Modal
function openAddDishModal() {
  document.getElementById('add-dish-modal').classList.remove('hidden');
  updateImagePreview('dish-image', 'add-image-preview');
}

function closeAddDishModal() {
  document.getElementById('add-dish-modal').classList.add('hidden');
}

async function handleAddDishSubmit(e) {
  e.preventDefault();
  const hfCheckbox = document.getElementById('dish-has-hf');
  const hasHf = hfCheckbox && hfCheckbox.checked ? 1 : 0;
  const halfPrice = parseFloat(document.getElementById('dish-half-price')?.value || 0);
  const fullPrice = parseFloat(document.getElementById('dish-full-price')?.value || 0);
  const price = hasHf ? halfPrice : parseFloat(document.getElementById('dish-price').value);

  const payload = {
    name: document.getElementById('dish-name').value.trim(),
    category_id: parseInt(document.getElementById('dish-category').value),
    price: price,
    original_price: parseFloat(document.getElementById('dish-orig-price').value || price),
    image_url: document.getElementById('dish-image').value.trim(),
    description: document.getElementById('dish-desc').value.trim(),
    is_veg: document.getElementById('dish-veg').checked,
    is_bestseller: document.getElementById('dish-bestseller').checked,
    preparation_time: document.getElementById('dish-prep-time').value.trim() || '20-25 mins',
    has_half_full: hasHf,
    half_price: halfPrice,
    full_price: fullPrice
  };

  try {
    const res = await fetch(`${API_BASE}/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showAdminToast(`Added "${payload.name}" to menu! 🍽️`);
      closeAddDishModal();
      e.target.reset();
      await fetchMenu();
      fetchStats();
    } else {
      showAdminToast("Error adding dish", "error");
    }
  } catch (err) {
    showAdminToast("Network error adding dish", "error");
  }
}

async function toggleAvailability(id, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/menu/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_available: newStatus })
    });
    if (res.ok) {
      showAdminToast(`Updated dish availability status`);
      await fetchMenu();
    }
  } catch (e) {
    showAdminToast("Error toggling status", "error");
  }
}

async function deleteMenuItem(id, name) {
  if (!confirm(`Are you sure you want to remove "${name}" from the menu?`)) return;

  try {
    const res = await fetch(`${API_BASE}/menu/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showAdminToast(`Removed "${name}" from menu`);
      await fetchMenu();
      fetchStats();
    }
  } catch (e) {
    showAdminToast("Error deleting item", "error");
  }
}

// 5. Coupons & Promo Code Manager
async function fetchCoupons() {
  try {
    const res = await fetch(`${API_BASE}/coupons?active=0`);
    if (res.ok) {
      adminState.coupons = await res.json();
      renderCouponsTable();
    }
  } catch (e) {
    console.error(e);
  }
}

function renderCouponsTable() {
  const tbody = document.getElementById('coupons-tbody');
  if (!tbody) return;

  if (adminState.coupons.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-10 text-center text-gray-500">No promo codes created yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = adminState.coupons.map(c => `
    <tr class="border-b border-gray-100 hover:bg-gray-50">
      <td class="py-3 px-4 font-mono font-bold text-red-600">${c.code}</td>
      <td class="py-3 px-4">
        <p class="font-bold text-gray-900 text-sm">${c.title}</p>
        <p class="text-xs text-gray-500">${c.description}</p>
      </td>
      <td class="py-3 px-4 text-xs font-semibold">
        ${c.discount_type === 'percentage' ? `${c.discount_value}% OFF (Max ₹${c.max_discount})` : `Flat ₹${c.discount_value} OFF`}
      </td>
      <td class="py-3 px-4 text-xs font-semibold text-gray-700">₹${c.min_order_amount}</td>
      <td class="py-3 px-4">
        <button onclick="toggleCouponActive(${c.id})" 
                class="px-2 py-0.5 rounded text-xs font-bold ${c.is_active === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}">
          ${c.is_active === 1 ? 'Active' : 'Disabled'}
        </button>
      </td>
      <td class="py-3 px-4 text-right">
        <button onclick="deleteCoupon(${c.id}, '${c.code}')" class="text-red-600 hover:text-red-800 text-xs font-bold">
          Delete 🗑️
        </button>
      </td>
    </tr>
  `).join('');
}

async function handleAddCouponSubmit(e) {
  e.preventDefault();
  const payload = {
    code: document.getElementById('coupon-code').value.trim().toUpperCase(),
    title: document.getElementById('coupon-title').value.trim(),
    description: document.getElementById('coupon-desc').value.trim(),
    discount_type: document.getElementById('coupon-type').value,
    discount_value: parseFloat(document.getElementById('coupon-value').value),
    max_discount: parseFloat(document.getElementById('coupon-max').value || 0),
    min_order_amount: parseFloat(document.getElementById('coupon-min-order').value || 199)
  };

  try {
    const res = await fetch(`${API_BASE}/coupons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      showAdminToast(`Created Promo Code "${payload.code}"! 🏷️`);
      e.target.reset();
      await fetchCoupons();
    } else {
      showAdminToast(data.error || "Failed to create coupon", "error");
    }
  } catch (e) {
    showAdminToast("Network error creating coupon", "error");
  }
}

async function toggleCouponActive(id) {
  try {
    await fetch(`${API_BASE}/coupons/${id}/toggle`, { method: 'PUT' });
    await fetchCoupons();
    showAdminToast("Coupon status updated");
  } catch (e) {
    showAdminToast("Error toggling coupon", "error");
  }
}

async function deleteCoupon(id, code) {
  if (!confirm(`Delete coupon "${code}"?`)) return;
  try {
    await fetch(`${API_BASE}/coupons/${id}`, { method: 'DELETE' });
    await fetchCoupons();
    showAdminToast(`Coupon "${code}" deleted`);
  } catch (e) {
    showAdminToast("Error deleting coupon", "error");
  }
}

// 6. Live Orders Pipeline
async function fetchOrders() {
  try {
    const res = await fetch(`${API_BASE}/orders`);
    if (res.ok) {
      adminState.orders = await res.json();
      renderOrdersList();
    }
  } catch (e) {
    console.error(e);
  }
}

function renderOrdersList() {
  const container = document.getElementById('admin-orders-container');
  if (!container) return;

  const filterStatus = document.getElementById('admin-order-status-filter')?.value || 'all';
  const orders = adminState.orders.filter(o => filterStatus === 'all' || o.order_status === filterStatus);

  if (orders.length === 0) {
    container.innerHTML = `<div class="py-16 text-center text-gray-500 font-medium">No orders found matching this filter.</div>`;
    return;
  }

  container.innerHTML = orders.map(ord => `
    <div class="border border-gray-100 rounded-2xl p-5 bg-white shadow-sm hover:shadow-md transition">
      <!-- Order Header -->
      <div class="flex flex-wrap items-center justify-between pb-3 border-b border-gray-100 gap-2">
        <div>
          <span class="font-mono font-bold text-sm text-gray-800">${ord.order_number}</span>
          <span class="text-xs text-gray-400 ml-2">${new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${new Date(ord.created_at).toLocaleDateString()}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold uppercase px-2.5 py-1 rounded-full ${ord.order_status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
      ord.order_status === 'Cancelled' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
    }">${ord.order_status}</span>
          
          <!-- Quick Status Changer Dropdown -->
          <select onchange="updateOrderStatus('${ord.order_number}', this.value)" 
                  class="text-xs font-bold border border-gray-200 rounded-lg px-2.5 py-1 bg-gray-50 focus:bg-white text-gray-700">
            <option value="Placed" ${ord.order_status === 'Placed' ? 'selected' : ''}>📝 Order Placed</option>
            <option value="Preparing" ${ord.order_status === 'Preparing' ? 'selected' : ''}>👨‍🍳 Preparing</option>
            <option value="Out for Delivery" ${ord.order_status === 'Out for Delivery' ? 'selected' : ''}>🛵 Out for Delivery</option>
            <option value="Delivered" ${ord.order_status === 'Delivered' ? 'selected' : ''}>🎉 Delivered</option>
            <option value="Cancelled" ${ord.order_status === 'Cancelled' ? 'selected' : ''}>❌ Cancelled</option>
          </select>
        </div>
      </div>

      <!-- Customer & Address -->
      <div class="py-3 text-xs text-gray-600 flex flex-wrap gap-4 border-b border-gray-50">
        <div>👤 <b>Customer:</b> ${ord.customer_name} (${ord.customer_phone})</div>
        <div>📍 <b>Address:</b> ${ord.delivery_address || 'Takeaway Pickup'}</div>
        <div>💳 <b>Payment:</b> ${ord.payment_method} (${ord.payment_status})</div>
        ${ord.coupon_code ? `<div>🏷️ <b>Coupon:</b> <span class="font-mono text-red-600 font-bold">${ord.coupon_code}</span></div>` : ''}
      </div>

      <!-- Items List -->
      <div class="py-3 space-y-1">
        ${(ord.items || []).map(i => `
          <div class="flex justify-between text-xs text-gray-700">
            <span><b>${i.quantity}x</b> ${i.name}</span>
            <span class="font-semibold">₹${i.price * i.quantity}</span>
          </div>
        `).join('')}
      </div>

      <!-- Bill Total Footer -->
      <div class="pt-3 border-t border-gray-100 flex justify-between items-center text-sm">
        <span class="text-xs text-gray-500">Order Type: <b class="uppercase">${ord.order_type}</b></span>
        <span class="font-extrabold text-base text-gray-900">Total: ₹${ord.grand_total}</span>
      </div>
    </div>
  `).join('');
}

async function updateOrderStatus(orderNumber, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderNumber}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      showAdminToast(`Order ${orderNumber} status changed to "${newStatus}"!`);
      await fetchOrders();
      fetchStats();
    }
  } catch (e) {
    showAdminToast("Error updating order status", "error");
  }
}

// 7. Table Reservations Manager
async function fetchReservations() {
  try {
    const res = await fetch(`${API_BASE}/reservations`);
    if (res.ok) {
      adminState.reservations = await res.json();
      renderReservationsTable();
    }
  } catch (e) {
    console.error(e);
  }
}

function renderReservationsTable() {
  const tbody = document.getElementById('reservations-tbody');
  if (!tbody) return;

  if (adminState.reservations.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-gray-500">No reservations received yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = adminState.reservations.map(r => `
    <tr class="border-b border-gray-100 hover:bg-gray-50">
      <td class="py-3 px-4 font-bold text-gray-900 text-sm">
        ${r.guest_name}
        <p class="text-xs text-gray-400 font-normal">${r.guest_phone} • ${r.guest_email}</p>
      </td>
      <td class="py-3 px-4 text-xs font-semibold text-gray-800">
        📅 ${r.reservation_date} <br/>
        ⏰ ${r.reservation_time}
      </td>
      <td class="py-3 px-4 text-xs font-bold text-gray-800">
        ${r.guest_count} Persons
      </td>
      <td class="py-3 px-4 text-xs text-gray-600">
        ${r.seating_preference}
      </td>
      <td class="py-3 px-4 text-xs text-gray-500 italic max-w-xs truncate">
        ${r.special_requests || 'None'}
      </td>
      <td class="py-3 px-4">
        <select onchange="updateReservationStatus(${r.id}, this.value)" 
                class="text-xs font-bold rounded-lg border border-gray-200 px-2 py-1 ${r.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-50 text-gray-700'
    }">
          <option value="Confirmed" ${r.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="Completed" ${r.status === 'Completed' ? 'selected' : ''}>Completed</option>
          <option value="Cancelled" ${r.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
    </tr>
  `).join('');
}

async function updateReservationStatus(id, status) {
  try {
    const res = await fetch(`${API_BASE}/reservations/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      showAdminToast(`Reservation marked as ${status}`);
      await fetchReservations();
      fetchStats();
    }
  } catch (e) {
    showAdminToast("Error updating reservation", "error");
  }
}

// Tab Switching
function switchTab(tab) {
  adminState.currentTab = tab;
  const tabs = ['menu', 'orders', 'coupons', 'reservations', 'settings'];

  tabs.forEach(t => {
    const section = document.getElementById(`tab-section-${t}`);
    const navBtn = document.getElementById(`nav-tab-${t}`);
    if (section) {
      if (t === tab) section.classList.remove('hidden');
      else section.classList.add('hidden');
    }
    if (navBtn) {
      if (t === tab) {
        navBtn.className = "flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-sm bg-red-600 text-white shadow-sm transition";
      } else {
        navBtn.className = "flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-semibold text-sm text-gray-600 hover:bg-gray-100 transition";
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', initAdmin);
