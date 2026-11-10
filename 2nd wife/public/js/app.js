/**
 * THE 2ND WIFE FAMILY RESTAURANT - Client Application Logic
 */

const API_BASE = '/api';

// Application State
const state = {
  config: {
    restaurant_name: "THE 2ND WIFE FAMILY RESTAURANT",
    restaurant_tagline: "GOOD FOOD GOOD MOOD ",
    restaurant_phone: "+91 98765 43210",
    restaurant_email: "support@xyzrestaurant.com",
    restaurant_address: "42 Gourmet Boulevard, Food District, City",
    delivery_fee: "40",
    free_delivery_threshold: "499",
    tax_rate_percent: "5.0",
    packaging_charge: "25"
  },
  currentUser: null,
  categories: [],
  menuItems: [],
  coupons: [],
  cart: JSON.parse(localStorage.getItem('xyz_cart') || '[]'),
  selectedCategory: 'all',
  vegOnly: false,
  bestsellerOnly: false,
  searchQuery: '',
  sortBy: 'popularity',
  activeCoupon: JSON.parse(localStorage.getItem('xyz_active_coupon') || 'null'),
  orderType: 'delivery', // 'delivery' or 'takeaway'
  deliveryAddress: localStorage.getItem('xyz_address') || 'Apt 4B, Sunshine Towers, Sector 14, Downtown',
  deliveryInstructions: '',
  activeTrackingOrder: null,
  trackingInterval: null
};

// UI Helper: Toast Notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
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

// Persist Cart
function saveCart() {
  localStorage.setItem('xyz_cart', JSON.stringify(state.cart));
  if (state.activeCoupon) {
    localStorage.setItem('xyz_active_coupon', JSON.stringify(state.activeCoupon));
  } else {
    localStorage.removeItem('xyz_active_coupon');
  }
  updateCartBadge();
  renderCartDrawer();
  renderMenuItems(); // To update in-card steppers
}

// Fetch Initial Data
async function initApp() {
  try {
    // 1. Fetch Config
    const configRes = await fetch(`${API_BASE}/config`);
    if (configRes.ok) {
      state.config = await configRes.json();
      applyBranding();
    }

    // 2. Fetch Auth User
    await checkAuth();

    // 3. Fetch Categories
    const catRes = await fetch(`${API_BASE}/categories`);
    if (catRes.ok) {
      state.categories = await catRes.json();
      renderCategoryFilters();
    }

    // 4. Fetch Coupons
    const coupRes = await fetch(`${API_BASE}/coupons`);
    if (coupRes.ok) {
      state.coupons = await coupRes.json();
      renderOfferBanners();
      renderCartCoupons();
    }

    // 5. Fetch Menu Items
    await fetchMenuItems();

    // 6. Setup Initial UI State
    updateCartBadge();
    setupEventListeners();

  } catch (err) {
    console.error("Initialization error:", err);
  }
}

// Apply Restaurant Config Branding
function applyBranding() {
  const brandName = state.config.restaurant_name || "THE SECOND WIFE FAMILY RESTAURANT";
  document.title = `${brandName} | Order Food Online & Table Reservations`;

  document.querySelectorAll('.brand-name').forEach(el => el.textContent = brandName);
  document.querySelectorAll('.brand-tagline').forEach(el => el.textContent = state.config.restaurant_tagline || "");
  document.querySelectorAll('.brand-phone').forEach(el => el.textContent = state.config.restaurant_phone || "");
  document.querySelectorAll('.brand-address').forEach(el => el.textContent = state.config.restaurant_address || "");
}

// Auth State Check
async function checkAuth() {
  try {
    const token = localStorage.getItem('xyz_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/auth/me`, { headers });
    const data = await res.json();
    state.currentUser = data.user;
    renderUserNav();
  } catch (e) {
    state.currentUser = null;
    renderUserNav();
  }
}

function renderUserNav() {
  const container = document.getElementById('user-nav-container');
  if (!container) return;

  if (state.currentUser) {
    const isAdmin = state.currentUser.role === 'admin';
    container.innerHTML = `
      <div class="relative group">
        <button class="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-full text-sm font-semibold transition">
          <div class="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-xs">
            ${state.currentUser.name.charAt(0).toUpperCase()}
          </div>
          <span class="max-w-[120px] truncate">${state.currentUser.name}</span>
          ${isAdmin ? '<span class="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-bold">ADMIN</span>' : ''}
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>

        <!-- Dropdown Menu -->
        <div class="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-xl py-2 hidden group-hover:block border border-gray-100 z-50">
          <div class="px-4 py-2 border-b border-gray-100">
            <p class="text-xs text-gray-400">Signed in as</p>
            <p class="text-sm font-semibold text-gray-800 truncate">${state.currentUser.email}</p>
          </div>
          ${isAdmin ? `
            <a href="/admin.html" class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-50">
              <span>👑</span> Admin Dashboard
            </a>
          ` : ''}
          <button onclick="openOrdersModal()" class="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <span>📦</span> My Orders & Receipts
          </button>
          <button onclick="openReservationsListModal()" class="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <span>🍽️</span> My Reservations
          </button>
          <div class="border-t border-gray-100 my-1"></div>
          <button onclick="handleLogout()" class="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
            <span>🚪</span> Sign Out
          </button>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button onclick="openAuthModal('login')" class="flex items-center gap-2 text-gray-700 hover:text-red-600 font-semibold text-sm px-3 py-2 rounded-lg transition">
        <span>Sign In</span>
      </button>
      <button onclick="openAuthModal('register')" class="bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-4 py-2 rounded-xl shadow-sm transition">
        Register
      </button>
    `;
  }
}

// Fetch Menu Items with active filters
async function fetchMenuItems() {
  const grid = document.getElementById('menu-items-grid');
  if (grid) {
    grid.innerHTML = Array(6).fill(0).map(() => `
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between animate-pulse">
        <div class="w-full h-44 bg-gray-200 rounded-xl mb-4 shimmer"></div>
        <div class="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div class="h-4 bg-gray-100 rounded w-full mb-4"></div>
        <div class="flex justify-between items-center">
          <div class="h-6 bg-gray-200 rounded w-16"></div>
          <div class="h-9 bg-gray-200 rounded-lg w-20"></div>
        </div>
      </div>
    `).join('');
  }

  let url = `${API_BASE}/menu?category=${encodeURIComponent(state.selectedCategory)}`;
  if (state.vegOnly) url += '&veg=1';
  if (state.searchQuery) url += `&search=${encodeURIComponent(state.searchQuery)}`;

  try {
    const res = await fetch(url);
    let items = await res.json();

    // Client-side sort
    if (state.sortBy === 'price-low') {
      items.sort((a, b) => a.price - b.price);
    } else if (state.sortBy === 'price-high') {
      items.sort((a, b) => b.price - a.price);
    } else if (state.sortBy === 'rating') {
      items.sort((a, b) => b.rating - a.rating);
    } else {
      // Popularity (Bestseller first)
      items.sort((a, b) => b.is_bestseller - a.is_bestseller);
    }

    if (state.bestsellerOnly) {
      items = items.filter(i => i.is_bestseller === 1);
    }

    state.menuItems = items;
    renderMenuItems();
  } catch (err) {
    console.error("Failed to load menu:", err);
  }
}

// Render Category Filter Circles
function renderCategoryFilters() {
  const container = document.getElementById('category-filter-container');
  if (!container) return;

  container.innerHTML = state.categories.map(cat => {
    const isActive = state.selectedCategory === cat.slug;
    return `
      <button onclick="setCategory('${cat.slug}')" 
              class="flex flex-col items-center gap-2 group flex-shrink-0 transition-transform active:scale-95">
        <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 p-1 transition-all duration-200 ${isActive ? 'border-red-600 ring-4 ring-red-100 shadow-md scale-105' : 'border-gray-200 group-hover:border-gray-300'
      }">
          <img src="${cat.image_url}" alt="${cat.name}" class="w-full h-full object-cover rounded-full group-hover:scale-110 transition duration-300">
        </div>
        <span class="text-xs sm:text-sm font-semibold text-center whitespace-nowrap ${isActive ? 'text-red-600 font-bold' : 'text-gray-700 group-hover:text-gray-900'
      }">${cat.name}</span>
      </button>
    `;
  }).join('');
}

function setCategory(slug) {
  state.selectedCategory = slug;
  renderCategoryFilters();
  fetchMenuItems();
}

// Render Offer Banners (Zomato / Swiggy Carousel Cards)
function renderOfferBanners() {
  const container = document.getElementById('offer-banners-container');
  if (!container) return;

  container.innerHTML = state.coupons.map(coupon => {
    return `
      <div class="flex-shrink-0 w-72 sm:w-80 bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-2xl p-4 shadow-md flex items-center justify-between relative overflow-hidden group">
        <div class="relative z-10">
          <span class="text-[10px] tracking-wider uppercase font-bold bg-white/20 px-2 py-0.5 rounded-full mb-1 inline-block">Special Offer</span>
          <h4 class="text-lg font-extrabold leading-tight">${coupon.title}</h4>
          <p class="text-xs text-red-100 mt-1 line-clamp-1">${coupon.description}</p>
          <div class="flex items-center gap-2 mt-3">
            <span class="font-mono bg-white text-red-700 font-bold text-xs px-2.5 py-1 rounded-md border border-dashed border-red-300 select-all">${coupon.code}</span>
            <button onclick="applyCouponDirectly('${coupon.code}')" class="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold text-xs px-3 py-1 rounded-md shadow transition">
              Apply Code
            </button>
          </div>
        </div>
        <div class="text-4xl opacity-80 group-hover:scale-110 transition duration-300 pr-1">
          🏷️
        </div>
        <!-- Decorative Circle -->
        <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full pointer-events-none"></div>
      </div>
    `;
  }).join('');
}

// Render Menu Items Grid
function renderMenuItems() {
  const grid = document.getElementById('menu-items-grid');
  const countEl = document.getElementById('items-count-indicator');
  if (!grid) return;

  if (countEl) {
    countEl.textContent = `${state.menuItems.length} delicious items found`;
  }

  if (state.menuItems.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center">
        <div class="text-6xl mb-4">🍽️</div>
        <h3 class="text-xl font-bold text-gray-800">No dishes match your filter</h3>
        <p class="text-gray-500 mt-1">Try switching categories or disabling the "Veg Only" filter.</p>
        <button onclick="resetFilters()" class="mt-4 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
          Reset All Filters
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = state.menuItems.map(item => {
    // Check if this item (or any portion of it) is in cart
    const cartCountForDish = state.cart
      .filter(c => (c.baseId === item.id) || (c.id === item.id) || (String(c.id).startsWith(`${item.id}-`)))
      .reduce((sum, c) => sum + c.quantity, 0);

    const isSingleSize = !item.has_half_full;
    const cartSingleItem = isSingleSize ? state.cart.find(c => c.id === item.id) : null;
    const singleQty = cartSingleItem ? cartSingleItem.quantity : 0;

    const discountPercent = item.original_price > item.price
      ? Math.round(((item.original_price - item.price) / item.original_price) * 100)
      : 0;

    return `
      <div class="dish-card bg-white rounded-2xl overflow-hidden border border-gray-100 flex flex-col justify-between relative group">
        <!-- Dish Image & Ribbons -->
        <div class="relative h-48 w-full overflow-hidden bg-gray-100">
          <img src="${item.image_url}" alt="${item.name}" 
               loading="lazy"
               class="dish-card-img w-full h-full object-cover"
               onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80'" />
          
          <!-- Badges -->
          <div class="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
            ${item.is_bestseller ? '<span class="badge-bestseller text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">⭐ Bestseller</span>' : ''}
            ${item.has_half_full ? '<span class="bg-red-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-sm">Half & Full Sizes</span>' : ''}
            ${discountPercent > 0 ? `<span class="badge-discount text-[10px] px-2 py-0.5 rounded-full shadow-sm">${discountPercent}% OFF</span>` : ''}
          </div>

          <div class="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[11px] px-2 py-0.5 rounded-md font-medium">
            ⏱️ ${item.preparation_time || '20 mins'}
          </div>

          ${item.is_available === 0 ? `
            <div class="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center">
              <span class="bg-red-600 text-white font-bold text-xs uppercase px-3 py-1 rounded-md tracking-wider">Sold Out Today</span>
            </div>
          ` : ''}
        </div>

        <!-- Content Details -->
        <div class="p-4 flex flex-col flex-grow justify-between">
          <div>
            <!-- Veg / Non-Veg & Rating Header -->
            <div class="flex items-center justify-between mb-1.5">
              <div class="flex items-center gap-2">
                <span class="${item.is_veg ? 'food-symbol-veg' : 'food-symbol-nonveg'}" title="${item.is_veg ? 'Vegetarian' : 'Non-Vegetarian'}"></span>
                <span class="text-xs font-semibold ${item.is_veg ? 'text-emerald-700' : 'text-red-700'}">
                  ${item.is_veg ? 'Veg' : 'Non-Veg'}
                </span>
                ${item.spice_level > 1 ? `<span class="text-xs" title="Spiciness">${'🌶️'.repeat(item.spice_level)}</span>` : ''}
              </div>
              <div class="flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md text-xs font-bold border border-emerald-200">
                <span>★</span>
                <span>${item.rating || 4.7}</span>
                <span class="text-[10px] text-gray-500 font-normal">(${item.rating_count || 100}+)</span>
              </div>
            </div>

            <!-- Title & Description -->
            <h3 class="font-bold text-gray-900 text-base leading-snug group-hover:text-red-600 transition">${item.name}</h3>
            <p class="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">${item.description || ''}</p>
          </div>

          <!-- Price & Stepper CTA -->
          <div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <div>
              ${item.has_half_full ? `
                <div>
                  <div class="flex items-baseline gap-1.5">
                    <span class="text-sm font-extrabold text-gray-900">₹${item.half_price}</span>
                    <span class="text-gray-300 text-xs">/</span>
                    <span class="text-sm font-extrabold text-gray-900">₹${item.full_price}</span>
                  </div>
                  <span class="text-[10px] text-red-600 font-bold block mt-0.5">Half / Full Plate</span>
                </div>
              ` : `
                <div class="flex items-baseline gap-1.5">
                  <span class="text-lg font-extrabold text-gray-900">₹${item.price}</span>
                  ${item.original_price > item.price ? `
                    <span class="text-xs text-gray-400 line-through">₹${item.original_price}</span>
                  ` : ''}
                </div>
              `}
            </div>

            <!-- Add to Cart or Stepper -->
            <div class="flex flex-col items-end">
              ${item.is_available === 0 ? `
                <button disabled class="text-xs bg-gray-100 text-gray-400 font-bold px-3 py-1.5 rounded-lg cursor-not-allowed">
                  Unavailable
                </button>
              ` : item.has_half_full ? `
                <button onclick="openPortionModal(${item.id})" 
                        class="add-btn bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-600 font-extrabold text-xs px-4 py-1.5 rounded-xl transition flex items-center gap-1 shadow-sm">
                  ADD <span class="text-xs">+</span>
                </button>
                ${cartCountForDish > 0 ? `<span class="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-extrabold border border-emerald-200 mt-1">${cartCountForDish} in Cart</span>` : ''}
              ` : singleQty === 0 ? `
                <button onclick="addToCart(${item.id})" 
                        class="add-btn bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-600 font-extrabold text-sm px-5 py-1.5 rounded-xl transition flex items-center gap-1 shadow-sm">
                  ADD <span class="text-xs">+</span>
                </button>
              ` : `
                <div class="flex items-center bg-red-600 text-white rounded-xl overflow-hidden shadow-sm">
                  <button onclick="updateQty('${item.id}', -1)" class="px-2.5 py-1 hover:bg-red-700 font-bold transition text-sm">-</button>
                  <span class="px-2 font-bold text-sm select-none">${singleQty}</span>
                  <button onclick="updateQty('${item.id}', 1)" class="px-2.5 py-1 hover:bg-red-700 font-bold transition text-sm">+</button>
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Portion Size Customization Modal (Half & Full Plate Selector)
function openPortionModal(itemId) {
  const item = state.menuItems.find(m => m.id === itemId);
  if (!item) return;

  state.activePortionItem = item;

  document.getElementById('portion-item-img').src = item.image_url;
  document.getElementById('portion-item-name').textContent = item.name;
  document.getElementById('portion-item-desc').textContent = item.description || '';

  const vegEl = document.getElementById('portion-item-veg');
  if (vegEl) {
    vegEl.className = item.is_veg ? 'food-symbol-veg' : 'food-symbol-nonveg';
  }

  document.getElementById('portion-price-half').textContent = `₹${item.half_price}`;
  document.getElementById('portion-price-full').textContent = `₹${item.full_price}`;

  document.getElementById('portion-radio-half').checked = true;
  updatePortionBtnPrice();

  document.getElementById('portion-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closePortionModal() {
  document.getElementById('portion-modal').classList.add('hidden');
  document.body.style.overflow = 'auto';
  state.activePortionItem = null;
}

function updatePortionBtnPrice() {
  if (!state.activePortionItem) return;
  const isFull = document.getElementById('portion-radio-full').checked;
  const price = isFull ? state.activePortionItem.full_price : state.activePortionItem.half_price;
  document.getElementById('portion-add-btn-price').textContent = `Add to Cart • ₹${price}`;
}

function confirmAddPortion() {
  if (!state.activePortionItem) return;
  const isFull = document.getElementById('portion-radio-full').checked;
  const portion = isFull ? 'Full' : 'Half';
  const price = isFull ? state.activePortionItem.full_price : state.activePortionItem.half_price;

  addCustomItemToCart(state.activePortionItem, portion, price);
  closePortionModal();
}

// Cart Logic
function addCustomItemToCart(dish, portion, price) {
  const cartKey = portion ? `${dish.id}-${portion.toLowerCase()}` : `${dish.id}`;
  const displayName = portion ? `${dish.name} (${portion})` : dish.name;

  const existing = state.cart.find(c => c.cartKey === cartKey || String(c.id) === String(cartKey));
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      id: cartKey,
      cartKey: cartKey,
      baseId: dish.id,
      name: displayName,
      price: price,
      original_price: price,
      image_url: dish.image_url,
      is_veg: dish.is_veg,
      portion: portion,
      quantity: 1
    });
  }

  showToast(`Added "${displayName}" to cart! 🛒`);
  saveCart();
}

function addToCart(itemId) {
  const dish = state.menuItems.find(m => m.id === itemId);
  if (!dish) return;

  if (dish.has_half_full === 1) {
    openPortionModal(itemId);
    return;
  }

  addCustomItemToCart(dish, null, dish.price);
}

function updateQty(cartKey, delta) {
  const keyStr = String(cartKey);
  const index = state.cart.findIndex(c => String(c.cartKey) === keyStr || String(c.id) === keyStr);
  if (index === -1) return;

  state.cart[index].quantity += delta;
  if (state.cart[index].quantity <= 0) {
    const itemName = state.cart[index].name;
    state.cart.splice(index, 1);
    showToast(`Removed "${itemName}" from cart`);
  }
  saveCart();
}

function updateCartBadge() {
  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const badgeEls = document.querySelectorAll('.cart-count-badge');
  badgeEls.forEach(el => {
    el.textContent = totalItems;
    el.style.display = totalItems > 0 ? 'inline-flex' : 'none';
  });

  const priceEls = document.querySelectorAll('.cart-price-indicator');
  priceEls.forEach(el => {
    el.textContent = `₹${subtotal}`;
  });

  // Floating bottom bar on mobile
  const mobileBar = document.getElementById('mobile-cart-bar');
  if (mobileBar) {
    if (totalItems > 0) {
      mobileBar.classList.remove('hidden');
      document.getElementById('mobile-cart-items-text').textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'items'} | ₹${subtotal}`;
    } else {
      mobileBar.classList.add('hidden');
    }
  }
}

// Cart Drawer Calculations
function calculateBill() {
  const subtotal = state.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  let discount = 0;

  if (state.activeCoupon) {
    if (subtotal >= state.activeCoupon.min_order_amount) {
      if (state.activeCoupon.discount_type === 'percentage') {
        const calc = (subtotal * state.activeCoupon.discount_value) / 100.0;
        discount = state.activeCoupon.max_discount > 0 ? Math.min(calc, state.activeCoupon.max_discount) : calc;
      } else {
        discount = Math.min(state.activeCoupon.discount_value, subtotal);
      }
    } else {
      // Coupon invalid due to min amount
      discount = 0;
    }
  }

  const freeDeliveryThreshold = parseFloat(state.config.free_delivery_threshold || 499);
  const baseDeliveryFee = parseFloat(state.config.delivery_fee || 40);
  const deliveryFee = (state.orderType === 'takeaway' || subtotal >= freeDeliveryThreshold || (state.activeCoupon && state.activeCoupon.code === 'FREEDEL')) ? 0 : baseDeliveryFee;

  const taxRate = parseFloat(state.config.tax_rate_percent || 5.0) / 100.0;
  const taxes = Math.round(subtotal * taxRate);
  const packaging = state.orderType === 'delivery' ? parseFloat(state.config.packaging_charge || 25) : 0;

  const grandTotal = Math.max(0, Math.round(subtotal - discount + deliveryFee + taxes + packaging));

  return { subtotal, discount, deliveryFee, taxes, packaging, grandTotal };
}

// Render Cart Drawer
function renderCartDrawer() {
  const container = document.getElementById('cart-items-list');
  const emptyView = document.getElementById('cart-empty-view');
  const filledView = document.getElementById('cart-filled-view');
  if (!container) return;

  if (state.cart.length === 0) {
    if (emptyView) emptyView.classList.remove('hidden');
    if (filledView) filledView.classList.add('hidden');
    return;
  }

  if (emptyView) emptyView.classList.add('hidden');
  if (filledView) filledView.classList.remove('hidden');

  container.innerHTML = state.cart.map(item => `
    <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
      <div class="flex items-center gap-3">
        <span class="${item.is_veg ? 'food-symbol-veg' : 'food-symbol-nonveg'} flex-shrink-0"></span>
        <div>
          <h5 class="text-sm font-bold text-gray-800 leading-snug line-clamp-1">${item.name}</h5>
          <span class="text-xs text-gray-500 font-semibold">₹${item.price} each</span>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <!-- Quantity Stepper -->
        <div class="flex items-center bg-gray-100 border border-gray-200 rounded-lg overflow-hidden">
          <button onclick="updateQty('${item.cartKey || item.id}', -1)" class="px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-200">-</button>
          <span class="px-2 text-xs font-bold text-gray-800">${item.quantity}</span>
          <button onclick="updateQty('${item.cartKey || item.id}', 1)" class="px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-200">+</button>
        </div>
        <span class="text-sm font-extrabold text-gray-900 w-16 text-right">₹${item.price * item.quantity}</span>
      </div>
    </div>
  `).join('');

  // Update Bill Details
  const bill = calculateBill();
  document.getElementById('bill-subtotal').textContent = `₹${bill.subtotal}`;
  document.getElementById('bill-delivery').textContent = bill.deliveryFee === 0 ? 'FREE' : `₹${bill.deliveryFee}`;
  document.getElementById('bill-taxes').textContent = `₹${bill.taxes}`;
  document.getElementById('bill-packaging').textContent = `₹${bill.packaging}`;
  document.getElementById('bill-grand-total').textContent = `₹${bill.grandTotal}`;

  // Discount Row
  const discRow = document.getElementById('bill-discount-row');
  if (bill.discount > 0) {
    discRow.classList.remove('hidden');
    document.getElementById('bill-discount').textContent = `-₹${bill.discount}`;
  } else {
    discRow.classList.add('hidden');
  }

  // Active coupon chip in cart
  const appliedBox = document.getElementById('applied-coupon-box');
  if (state.activeCoupon && bill.discount > 0) {
    appliedBox.classList.remove('hidden');
    document.getElementById('applied-coupon-text').textContent = `'${state.activeCoupon.code}' applied! Saved ₹${bill.discount}`;
  } else {
    appliedBox.classList.add('hidden');
  }
}

// Drawer Controls
function openCartDrawer() {
  renderCartDrawer();
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-drawer-overlay');
  if (drawer && overlay) {
    drawer.classList.remove('translate-x-full');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-drawer-overlay');
  if (drawer && overlay) {
    drawer.classList.add('translate-x-full');
    overlay.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }
}

// Coupon Handling
function renderCartCoupons() {
  const container = document.getElementById('cart-coupons-list');
  if (!container) return;

  container.innerHTML = state.coupons.map(c => `
    <div class="flex items-center justify-between p-2.5 rounded-xl border border-dashed border-red-200 bg-red-50/50">
      <div>
        <div class="flex items-center gap-1.5">
          <span class="font-mono font-bold text-xs bg-red-600 text-white px-2 py-0.5 rounded">${c.code}</span>
          <span class="text-xs font-semibold text-gray-800">${c.title}</span>
        </div>
        <p class="text-[11px] text-gray-500 mt-0.5">Min order ₹${c.min_order_amount}</p>
      </div>
      <button onclick="applyCouponDirectly('${c.code}')" class="text-xs font-bold text-red-600 hover:text-red-800">
        Apply
      </button>
    </div>
  `).join('');
}

function applyCouponDirectly(code) {
  const found = state.coupons.find(c => c.code.toUpperCase() === code.toUpperCase());
  if (!found) {
    showToast(`Invalid coupon code "${code}"`, 'error');
    return;
  }

  const subtotal = state.cart.reduce((s, i) => s + (i.price * i.quantity), 0);
  if (subtotal < found.min_order_amount) {
    showToast(`Add ₹${found.min_order_amount - subtotal} more to use coupon "${code}"!`, 'error');
    return;
  }

  state.activeCoupon = found;
  saveCart();
  showToast(`Coupon "${code}" successfully applied! 🎉`);
  openCartDrawer();
}

function handleManualCoupon() {
  const input = document.getElementById('manual-coupon-input');
  if (!input || !input.value.trim()) return;
  applyCouponDirectly(input.value.trim());
  input.value = '';
}

function removeAppliedCoupon() {
  state.activeCoupon = null;
  saveCart();
  showToast('Coupon removed');
}

// Order Type Switch (Delivery vs Takeaway)
function setOrderType(type) {
  state.orderType = type;
  document.getElementById('btn-order-delivery').className = type === 'delivery'
    ? 'flex-1 py-2 text-xs font-bold rounded-lg bg-red-600 text-white shadow-sm transition'
    : 'flex-1 py-2 text-xs font-bold rounded-lg text-gray-600 hover:bg-gray-100 transition';

  document.getElementById('btn-order-takeaway').className = type === 'takeaway'
    ? 'flex-1 py-2 text-xs font-bold rounded-lg bg-red-600 text-white shadow-sm transition'
    : 'flex-1 py-2 text-xs font-bold rounded-lg text-gray-600 hover:bg-gray-100 transition';

  const addressSection = document.getElementById('cart-address-section');
  if (addressSection) {
    if (type === 'delivery') {
      addressSection.classList.remove('hidden');
    } else {
      addressSection.classList.add('hidden');
    }
  }

  renderCartDrawer();
}

// Checkout & Payment
function openCheckoutModal() {
  if (state.cart.length === 0) {
    showToast("Your cart is empty!", "error");
    return;
  }

  // Pre-fill user data if logged in
  if (state.currentUser) {
    const nameEl = document.getElementById('checkout-name');
    const phoneEl = document.getElementById('checkout-phone');
    const addrEl = document.getElementById('checkout-address');
    if (nameEl && !nameEl.value) nameEl.value = state.currentUser.name || '';
    if (phoneEl && !phoneEl.value) phoneEl.value = state.currentUser.phone || '';
    if (addrEl && !addrEl.value) addrEl.value = state.currentUser.address || state.deliveryAddress || '';
  }

  const bill = calculateBill();
  document.getElementById('checkout-grand-total').textContent = `₹${bill.grandTotal}`;
  document.getElementById('checkout-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.add('hidden');
  document.body.style.overflow = 'auto';
}

async function handlePlaceOrder(e) {
  e.preventDefault();

  const name = document.getElementById('checkout-name').value.trim();
  const phone = document.getElementById('checkout-phone').value.trim();
  const address = document.getElementById('checkout-address').value.trim();
  const notes = document.getElementById('checkout-notes').value.trim();
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

  if (!name || !phone) {
    showToast("Please enter your name and contact phone number.", "error");
    return;
  }

  if (state.orderType === 'delivery' && !address) {
    showToast("Please provide your delivery address.", "error");
    return;
  }

  const bill = calculateBill();
  const payload = {
    customer_name: name,
    customer_phone: phone,
    customer_email: state.currentUser ? state.currentUser.email : '',
    delivery_address: address,
    order_type: state.orderType,
    items: state.cart,
    coupon_code: state.activeCoupon ? state.activeCoupon.code : '',
    special_instructions: notes,
    payment_method: paymentMethod
  };

  const btn = document.getElementById('place-order-submit-btn');
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin inline-block mr-2">⏳</span> Processing Order...`;

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || "Failed to place order", "error");
      btn.disabled = false;
      btn.textContent = "Confirm & Place Order";
      return;
    }

    // Success! Clear Cart
    state.cart = [];
    state.activeCoupon = null;
    saveCart();
    closeCheckoutModal();
    closeCartDrawer();

    // Show Celebration & Tracking
    showToast("🎉 Order placed successfully! Chef has received your order.", "success");
    openLiveTrackingModal(data.order_number);

  } catch (err) {
    showToast("Network error placing order.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm & Place Order";
  }
}

// Live Order Tracking (Swiggy / Zomato Realtime UI)
async function openLiveTrackingModal(orderNumber) {
  const modal = document.getElementById('tracking-modal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  document.getElementById('tracking-order-id').textContent = orderNumber;
  fetchTrackingData(orderNumber);

  if (state.trackingInterval) clearInterval(state.trackingInterval);
  state.trackingInterval = setInterval(() => {
    fetchTrackingData(orderNumber);
  }, 4000);
}

function closeLiveTrackingModal() {
  document.getElementById('tracking-modal').classList.add('hidden');
  document.body.style.overflow = 'auto';
  if (state.trackingInterval) {
    clearInterval(state.trackingInterval);
    state.trackingInterval = null;
  }
}

async function fetchTrackingData(orderNumber) {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderNumber}`);
    if (!res.ok) return;
    const order = await res.json();
    state.activeTrackingOrder = order;

    // Update status stepper
    updateTrackingUI(order);
  } catch (err) {
    console.error("Tracking poll failed:", err);
  }
}

function updateTrackingUI(order) {
  const status = order.order_status;
  const statusLevels = {
    'Placed': 1,
    'Preparing': 2,
    'Out for Delivery': 3,
    'Delivered': 4,
    'Cancelled': 0
  };
  const currentLevel = statusLevels[status] || 1;

  // Step 1: Placed
  setStepState('track-step-1', currentLevel >= 1, currentLevel === 1);
  // Step 2: Preparing
  setStepState('track-step-2', currentLevel >= 2, currentLevel === 2);
  // Step 3: Out for Delivery
  setStepState('track-step-3', currentLevel >= 3, currentLevel === 3);
  // Step 4: Delivered
  setStepState('track-step-4', currentLevel >= 4, currentLevel === 4);

  // Status Message & ETA
  const titleEl = document.getElementById('tracking-status-title');
  const descEl = document.getElementById('tracking-status-desc');
  const etaEl = document.getElementById('tracking-eta');

  if (status === 'Placed') {
    titleEl.textContent = "Order Placed & Confirmed";
    descEl.textContent = "The restaurant is reviewing your items.";
    etaEl.textContent = "30-35 mins";
  } else if (status === 'Preparing') {
    titleEl.textContent = "Chef is Preparing Your Feast 👨‍🍳";
    descEl.textContent = "Fresh ingredients are sizzling in the kitchen.";
    etaEl.textContent = "20-25 mins";
  } else if (status === 'Out for Delivery') {
    titleEl.textContent = "Valet is On the Way! 🛵";
    descEl.textContent = "Your delivery partner has picked up your food.";
    etaEl.textContent = "8-12 mins";
  } else if (status === 'Delivered') {
    titleEl.textContent = "Delivered! Enjoy Your Meal 😋";
    descEl.textContent = "Food has reached your doorstep.";
    etaEl.textContent = "Arrived";
  } else if (status === 'Cancelled') {
    titleEl.textContent = "Order Cancelled";
    descEl.textContent = "This order was cancelled by the restaurant or user.";
    etaEl.textContent = "Cancelled";
  }

  // Item List in tracking
  const itemsContainer = document.getElementById('tracking-items-list');
  if (itemsContainer && order.items) {
    itemsContainer.innerHTML = order.items.map(i => `
      <div class="flex justify-between text-xs py-1 text-gray-700">
        <span>${i.quantity}x ${i.name}</span>
        <span class="font-bold">₹${i.price * i.quantity}</span>
      </div>
    `).join('');
  }
}

function setStepState(stepId, isComplete, isCurrent) {
  const el = document.getElementById(stepId);
  if (!el) return;
  if (isCurrent) {
    el.className = "w-9 h-9 rounded-full step-current flex items-center justify-center font-bold text-sm shadow-md transition-all";
  } else if (isComplete) {
    el.className = "w-9 h-9 rounded-full step-complete flex items-center justify-center font-bold text-sm shadow-md transition-all";
  } else {
    el.className = "w-9 h-9 rounded-full step-pending flex items-center justify-center font-bold text-sm transition-all";
  }
}

// Table Reservations Form
async function handleReservationSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('res-name').value.trim();
  const phone = document.getElementById('res-phone').value.trim();
  const email = document.getElementById('res-email').value.trim();
  const date = document.getElementById('res-date').value;
  const time = document.getElementById('res-time').value;
  const guests = document.getElementById('res-guests').value;
  const seating = document.getElementById('res-seating').value;
  const notes = document.getElementById('res-notes').value.trim();

  if (!name || !phone || !date || !time) {
    showToast("Please fill in Name, Phone, Date and Time.", "error");
    return;
  }

  const btn = document.getElementById('res-submit-btn');
  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin inline-block mr-2">⏳</span> Reserving Table...`;

  try {
    const res = await fetch(`${API_BASE}/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guest_name: name,
        guest_phone: phone,
        guest_email: email,
        reservation_date: date,
        reservation_time: time,
        guest_count: guests,
        seating_preference: seating,
        special_requests: notes
      })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || "Reservation failed", "error");
      btn.disabled = false;
      btn.textContent = "Confirm Table Booking";
      return;
    }

    showToast("🎉 Table booked successfully! We can't wait to host you.", "success");
    e.target.reset();
    closeReservationModal();

  } catch (err) {
    showToast("Network error submitting reservation.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirm Table Booking";
  }
}

function openReservationModal() {
  document.getElementById('reservation-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Set min date to today
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('res-date');
  if (dateInput) {
    dateInput.min = today;
    if (!dateInput.value) dateInput.value = today;
  }

  // Pre-fill user data
  if (state.currentUser) {
    const nameInput = document.getElementById('res-name');
    const phoneInput = document.getElementById('res-phone');
    const emailInput = document.getElementById('res-email');
    if (nameInput && !nameInput.value) nameInput.value = state.currentUser.name;
    if (phoneInput && !phoneInput.value) phoneInput.value = state.currentUser.phone || '';
    if (emailInput && !emailInput.value) emailInput.value = state.currentUser.email || '';
  }
}

function closeReservationModal() {
  document.getElementById('reservation-modal').classList.add('hidden');
  document.body.style.overflow = 'auto';
}

// Auth Modal & Logic
function openAuthModal(tab = 'login') {
  document.getElementById('auth-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  switchAuthTab(tab);
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
  document.body.style.overflow = 'auto';
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('auth-login-form');
  const regForm = document.getElementById('auth-register-form');
  const tabLogin = document.getElementById('tab-btn-login');
  const tabReg = document.getElementById('tab-btn-register');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
    tabLogin.className = "flex-1 py-3 text-sm font-bold text-red-600 border-b-2 border-red-600";
    tabReg.className = "flex-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-700";
  } else {
    loginForm.classList.add('hidden');
    regForm.classList.remove('hidden');
    tabLogin.className = "flex-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-700";
    tabReg.className = "flex-1 py-3 text-sm font-bold text-red-600 border-b-2 border-red-600";
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || "Login failed", "error");
      return;
    }

    if (data.token) {
      localStorage.setItem('xyz_token', data.token);
    }
    state.currentUser = data.user;
    renderUserNav();
    closeAuthModal();
    showToast(`Welcome back, ${data.user.name}! 👋`);
  } catch (err) {
    showToast("Network error during login", "error");
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const phone = document.getElementById('reg-phone').value.trim();
  const address = document.getElementById('reg-address').value.trim();

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, phone, address })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || "Registration failed", "error");
      return;
    }

    if (data.token) {
      localStorage.setItem('xyz_token', data.token);
    }
    state.currentUser = data.user;
    renderUserNav();
    closeAuthModal();
    showToast(`Account created! Welcome to ${state.config.restaurant_name}, ${data.user.name}! 🎉`);
  } catch (err) {
    showToast("Network error during registration", "error");
  }
}

// Demo Login Helpers
function fillDemoLogin(role) {
  if (role === 'admin') {
    document.getElementById('login-email').value = 'admin@xyz.com';
    document.getElementById('login-password').value = 'admin123';
  } else {
    document.getElementById('login-email').value = 'customer@xyz.com';
    document.getElementById('login-password').value = 'customer123';
  }
  showToast(`Filled credentials for ${role.toUpperCase()}. Click 'Sign In' or hit Enter!`);
}

async function handleLogout() {
  try {
    const token = localStorage.getItem('xyz_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers });
    localStorage.removeItem('xyz_token');
    state.currentUser = null;
    renderUserNav();
    showToast("Signed out successfully. See you again soon!");
  } catch (e) {
    console.error(e);
  }
}

// User Orders List Modal
async function openOrdersModal() {
  const modal = document.getElementById('orders-modal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const container = document.getElementById('orders-history-list');
  container.innerHTML = `<div class="py-12 text-center text-gray-500">Loading your past feasts...</div>`;

  try {
    const res = await fetch(`${API_BASE}/orders`);
    if (!res.ok) throw new Error();
    const orders = await res.json();

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center">
          <div class="text-5xl mb-3">📦</div>
          <h4 class="font-bold text-gray-800">No orders yet</h4>
          <p class="text-xs text-gray-500 mt-1">Explore our chef special menu and place your first feast!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map(ord => `
      <div class="border border-gray-100 rounded-2xl p-4 mb-3 bg-white hover:shadow-sm transition">
        <div class="flex justify-between items-start pb-2 border-b border-gray-100 mb-2">
          <div>
            <span class="text-xs font-mono font-bold text-gray-500">${ord.order_number}</span>
            <p class="text-xs text-gray-400 mt-0.5">${new Date(ord.created_at).toLocaleString()}</p>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${ord.order_status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
        ord.order_status === 'Cancelled' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
      }">${ord.order_status}</span>
        </div>

        <div class="space-y-1 mb-3">
          ${(ord.items || []).map(i => `
            <div class="flex justify-between text-xs text-gray-600">
              <span>${i.quantity}x ${i.name}</span>
              <span class="font-semibold">₹${i.price * i.quantity}</span>
            </div>
          `).join('')}
        </div>

        <div class="flex justify-between items-center pt-2 border-t border-gray-100">
          <span class="text-sm font-extrabold text-gray-900">Total: ₹${ord.grand_total}</span>
          <button onclick="openLiveTrackingModal('${ord.order_number}')" class="text-xs font-bold text-red-600 hover:text-red-700 underline">
            Track Order 🛵
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="py-8 text-center text-red-500">Failed to load orders history.</div>`;
  }
}

function closeOrdersModal() {
  document.getElementById('orders-modal').classList.add('hidden');
  document.body.style.overflow = 'auto';
}

// User Reservations List Modal
async function openReservationsListModal() {
  const modal = document.getElementById('reservations-list-modal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const container = document.getElementById('reservations-history-list');
  container.innerHTML = `<div class="py-12 text-center text-gray-500">Loading reservations...</div>`;

  try {
    const res = await fetch(`${API_BASE}/reservations`);
    const reservations = await res.json();

    if (reservations.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center">
          <div class="text-5xl mb-3">🍽️</div>
          <h4 class="font-bold text-gray-800">No table bookings yet</h4>
          <button onclick="closeReservationsListModal(); openReservationModal();" class="mt-3 bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-xl">
            Book a Table Now
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = reservations.map(r => `
      <div class="border border-gray-100 rounded-2xl p-4 mb-3 bg-white">
        <div class="flex justify-between items-center mb-2">
          <span class="font-bold text-sm text-gray-800">📅 ${r.reservation_date} at ${r.reservation_time}</span>
          <span class="px-2 py-0.5 rounded text-xs font-bold ${r.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}">${r.status}</span>
        </div>
        <p class="text-xs text-gray-500">Guests: <b>${r.guest_count} persons</b> | Seating: <b>${r.seating_preference}</b></p>
        ${r.special_requests ? `<p class="text-[11px] text-gray-400 mt-1 italic">Note: "${r.special_requests}"</p>` : ''}
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<div class="py-8 text-center text-red-500">Could not load reservations.</div>`;
  }
}

function closeReservationsListModal() {
  document.getElementById('reservations-list-modal').classList.add('hidden');
  document.body.style.overflow = 'auto';
}

// Filters & Search Setup
function setupEventListeners() {
  // Veg Only Toggle
  const vegToggle = document.getElementById('veg-only-toggle');
  if (vegToggle) {
    vegToggle.addEventListener('change', (e) => {
      state.vegOnly = e.target.checked;
      fetchMenuItems();
    });
  }

  // Bestseller Toggle
  const bestToggle = document.getElementById('bestseller-toggle');
  if (bestToggle) {
    bestToggle.addEventListener('change', (e) => {
      state.bestsellerOnly = e.target.checked;
      fetchMenuItems();
    });
  }

  // Sort Dropdown
  const sortSelect = document.getElementById('sort-by-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      fetchMenuItems();
    });
  }

  // Search Input (Debounced)
  const searchInput = document.getElementById('main-search-input');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.searchQuery = e.target.value.trim();
        fetchMenuItems();
      }, 300);
    });
  }
}

function resetFilters() {
  state.selectedCategory = 'all';
  state.vegOnly = false;
  state.bestsellerOnly = false;
  state.searchQuery = '';
  state.sortBy = 'popularity';

  const vegToggle = document.getElementById('veg-only-toggle');
  if (vegToggle) vegToggle.checked = false;

  const bestToggle = document.getElementById('bestseller-toggle');
  if (bestToggle) bestToggle.checked = false;

  const searchInput = document.getElementById('main-search-input');
  if (searchInput) searchInput.value = '';

  const sortSelect = document.getElementById('sort-by-select');
  if (sortSelect) sortSelect.value = 'popularity';

  renderCategoryFilters();
  fetchMenuItems();
}

// Start app once DOM loaded
document.addEventListener('DOMContentLoaded', initApp);
