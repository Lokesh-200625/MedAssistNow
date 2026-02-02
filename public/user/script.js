/* Robust script.js for multi-page setup
   - Safe checks for missing elements
   - Binds handlers after DOMContentLoaded
   - Preserves search, cart, signup/login, map functions
*/

let map;
let markers = [];
let selectedRole = null;

function el(id) { return document.getElementById(id); }

/* ---------------------------
   NAV + PAGE NAVIGATION
   --------------------------- */
function showPage(id) {
  // Navigate to the separate html file (home.html, cart.html, etc.)
  window.location.href = id + ".html";
}

/* ---------------------------
   SEARCH
   --------------------------- */
async function searchMedicine() {
  const resultsEl = document.getElementById("results");
  const query = document.getElementById("searchBox").value.trim();

  if (!query) {
    resultsEl.innerHTML = "<li>Please enter a search term</li>";
    return;
  }

  try {
    const res = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      resultsEl.innerHTML = "<li>No medicines found</li>";
      return;
    }

    resultsEl.innerHTML = data.map(item =>
      `<li>
                <b>${escapeHtml(item.medicineName)}</b>
                (Qty: ${item.quantity})
                <button onclick="addToCart('${escapeHtml(item.medicineName)}')">Add</button>
            </li>`
    ).join("");

  } catch (err) {
    console.error("Search Error:", err);
    resultsEl.innerHTML = "<li>Error searching medicines</li>";
  }
}


function goToSearch() {
  const input = el("homeSearchBox");
  const q = input ? input.value.trim() : "";
  window.location.href = `search.html${q ? `?q=${encodeURIComponent(q)}` : ""}`;
}

/* When on search.html, populate query from URL if given */
function initSearchFromQuery() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("q") && el("searchBox")) {
    el("searchBox").value = params.get("q");
    searchMedicine();
  }
}

/* ---------------------------
   CART
   --------------------------- */
async function addToCart(medicineName) {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch("/api/cart/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        medicineName,
        quantity: 1
      })
    });

    const data = await res.json();

    if (data.error) {
      showToast(data.error, "error");
    } else {
      showToast("Added to cart", "success");
    }
  } catch (err) {
    console.error(err);
    showToast("Error adding to cart", "error");
  }
}


// In /public/user/script.js

async function loadCart() {
  const listEl = document.getElementById("cart-items");
  const emptyEl = document.getElementById("emptyCart");

  // Not on the cart page → nothing to do
  if (!listEl) return;

  const token = localStorage.getItem("token");

  try {
    const res = await fetch("/api/cart", {
      headers: {
        "Authorization": "Bearer " + token
      }
    });

    const data = await res.json();

    // If the backend returned an error object, handle gracefully
    if (!Array.isArray(data)) {
      console.warn("Cart API did not return array:", data);
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.style.display = "block";
      return;
    }

    if (data.length === 0) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.style.display = "block";
      // Hide checkout bar if empty
      const totalDisplay = document.querySelector(".checkout-bar");
      if (totalDisplay) totalDisplay.style.display = "none";
    } else {
      if (emptyEl) emptyEl.style.display = "none";
      const totalDisplayContainer = document.querySelector(".checkout-bar");
      if (totalDisplayContainer) totalDisplayContainer.style.display = "flex";

      listEl.innerHTML = data.map(i => {
        const price = i.price || 0;
        const total = price * i.quantity;
        return `
            <li class="cart-item" style="display: flex; gap: 1rem; align-items: center; padding: 1rem; background: white; border-radius: 12px; margin-bottom: 1rem; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                <div style="width: 60px; height: 60px; background: #f3f4f6; border-radius: 8px; overflow: hidden; flex-shrink: 0;">
                    <img src="${i.image || '/user/default.jpg'}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/user/default.jpg'">
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: bold; font-size: 1.1rem; color: #333;">${escapeHtml(i.medicineName)}</div>
                    <div style="color: #666; font-size: 0.9rem;">₹${price} / unit</div>
                </div>
                
                <div style="display:flex; align-items:center; gap:0.5rem; background:#f0f0f0; padding:4px 8px; border-radius:8px;">
                     <button onclick="updateCartQty('${escapeHtml(i.medicineName)}', ${i.quantity - 1})" style="border:none;background:none;cursor:pointer;font-weight:bold;color:var(--primary);font-size:1.2rem;">−</button>
                     <span style="font-weight:600; min-width:20px; text-align:center;">${i.quantity}</span>
                     <button onclick="updateCartQty('${escapeHtml(i.medicineName)}', ${i.quantity + 1})" style="border:none;background:none;cursor:pointer;font-weight:bold;color:var(--primary);font-size:1.2rem;">+</button>
                </div>

                <div style="font-weight: bold; color: #0d9488; font-size: 1.1rem; min-width:60px; text-align:right;">
                    ₹${total}
                </div>
                
                <button onclick="removeCartItem('${escapeHtml(i.medicineName)}')" style="background:#ffebee; color:#d32f2f; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; margin-left:0.5rem;" title="Remove">
                    🗑️
                </button>
            </li >
          `;
      }).join("");

      // Calculate Grand Total
      const grandTotal = data.reduce((sum, i) => sum + ((i.price || 0) * i.quantity), 0);
      const totalDisplay = document.getElementById("cartTotalDisplay");
      if (totalDisplay) {
        totalDisplay.innerText = `Total: ₹${grandTotal} `;
      }
    }

  } catch (err) {
    console.error("Cart load error:", err);
    listEl.innerHTML = "<p>Error loading cart.</p>";
  }
}

// Update Cart Quantity
async function updateCartQty(medicineName, newQty) {
  if (newQty < 1) {
    removeCartItem(medicineName);
    return;
  }
  const token = localStorage.getItem("token");

  try {
    const res = await fetch("/api/cart/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ medicineName, quantity: newQty })
    });
    const data = await res.json();
    if (data.error) alert(data.error);
    else loadCart(); // Refresh
  } catch (e) { console.error(e); }
}

// Remove Item
async function removeCartItem(medicineName) {
  if (!confirm("Remove this item?")) return;
  const token = localStorage.getItem("token");

  try {
    const res = await fetch("/api/cart/remove", {
      method: "POST", // using POST for body support
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ medicineName })
    });
    const data = await res.json();
    if (data.error) alert(data.error);
    else loadCart(); // Refresh
  } catch (e) { console.error(e); }
}



/* ---------------------------
   SIGNUP / LOGIN UI
   --------------------------- */
function showLoginForm(role) {
  selectedRole = role;
  const cards = document.querySelector(".login-cards");
  if (cards) cards.style.display = "none";
  const roleSignup = el("roleSignupForm"), roleLogin = el("roleLoginForm");
  if (roleSignup) roleSignup.style.display = "none";
  if (roleLogin) roleLogin.style.display = "block";

  const titles = { user: "User Login", pharmacist: "Pharmacist Login", delivery: "Delivery Partner Login" };
  if (el("roleTitle")) el("roleTitle").innerText = titles[role] || "";
}

function showSignupForm(role) {
  selectedRole = role;

  const cards = document.querySelector(".login-cards");
  if (cards) cards.style.display = "none";

  const roleSignup = el("roleSignupForm");
  const roleLogin = el("roleLoginForm");
  if (roleLogin) roleLogin.style.display = "none";
  if (roleSignup) roleSignup.style.display = "block";

  const titles = {
    user: "User Signup",
    pharmacist: "Pharmacist Signup",
    delivery: "Delivery Partner Signup"
  };
  if (el("signupTitle")) el("signupTitle").innerText = titles[role] || "";

  const fields = {
    user: `
          <div class="form-row"><label>Full Name:</label><input id="user-fullname"></div>
            <div class="form-row"><label>Email:</label><input id="user-email" type="email"></div>
            <div class="form-row"><label>Phone:</label><input id="user-phone"></div>
            <div class="form-row"><label>Password:</label><input id="user-password" type="password"></div>
            <div class="form-row"><label>Confirm:</label><input id="user-confirm" type="password"></div>
            <div class="form-row"><label>Address:</label><input id="user-address"></div>
        `,
    pharmacist: `
          <div class="form-row"><label>Pharmacy Name:</label><input id="pharmacy-name"></div>
            <div class="form-row"><label>Pharmacist Name:</label><input id="pharmacist-name"></div>
            <div class="form-row"><label>Email:</label><input id="pharmacist-email" type="email"></div>
            <div class="form-row"><label>Phone:</label><input id="pharmacist-phone"></div>
            <div class="form-row"><label>Password:</label><input id="pharmacist-password" type="password"></div>
            <div class="form-row"><label>License #:</label><input id="license-number"></div>
            <div class="form-row"><label>Address:</label><input id="pharmacy-address"></div>

            <div class="form-row"><label>Latitude:</label>
                <input id="pharmacy-lat" type="number" step="0.000001" placeholder="Auto get...">
            </div>
            <div class="form-row"><label>Longitude:</label>
                <input id="pharmacy-lon" type="number" step="0.000001" placeholder="Auto get...">
            </div>
        `,
    delivery: `
          <div class="form-row"><label>Full Name:</label><input id="delivery-name"></div>
            <div class="form-row"><label>Email:</label><input id="delivery-email" type="email"></div>
            <div class="form-row"><label>Phone:</label><input id="delivery-phone"></div>
            <div class="form-row"><label>Password:</label><input id="delivery-password" type="password"></div>
            <div class="form-row"><label>Vehicle Type:</label>
                <select id="vehicle-type">
                    <option>Bike</option>
                    <option>Scooter</option>
                    <option>Bicycle</option>
                </select>
            </div>
            <div class="form-row"><label>Vehicle Number:</label><input id="vehicle-number"></div>
            <div class="form-row"><label>Area:</label><input id="delivery-area"></div>
        `
  };

  if (el("signupFields")) {
    el("signupFields").innerHTML = fields[role] || "";
  }
  if (role === "pharmacist") {
    setTimeout(() => {
      getCurrentLocation().then((loc) => {
        if (!loc) {
          console.warn("⚠️ No location returned");
          alert("Could not auto-detect location. Please turn on GPS or enter Latitude/Longitude manually.");
          return;
        }

        console.log("📍 SIGNUP GPS:", loc);

        const latInput = el("pharmacy-lat");
        const lonInput = el("pharmacy-lon");

        if (latInput) latInput.value = loc.lat.toFixed(6);
        if (lonInput) lonInput.value = loc.lon.toFixed(6);
      });
    }, 800);  // allow form to render
  }
}



async function signupUser() {
  if (!selectedRole) return alert("Select a role first.");

  const payload = { role: selectedRole };

  try {
    if (selectedRole === "user") {
      payload.name = el("user-fullname")?.value || "";
      payload.email = el("user-email")?.value || "";
      payload.phone = el("user-phone")?.value || "";
      payload.password = el("user-password")?.value || "";
      payload.address = el("user-address")?.value || "";

      if (payload.password !== (el("user-confirm")?.value || "")) {
        return alert("Passwords do not match.");
      }

    } else if (selectedRole === "pharmacist") {
      payload.pharmacyName = el("pharmacy-name")?.value || "";
      payload.name = el("pharmacist-name")?.value || "";
      payload.email = el("pharmacist-email")?.value || "";
      payload.phone = el("pharmacist-phone")?.value || "";
      payload.password = el("pharmacist-password")?.value || "";
      payload.license = el("license-number")?.value || "";
      payload.address = el("pharmacy-address")?.value || "";

      const lat = parseFloat(el("pharmacy-lat")?.value);
      const lon = parseFloat(el("pharmacy-lon")?.value);
      if (!isNaN(lat) && !isNaN(lon)) {
        payload.location = { lat, lon };   // 🌍 store pharmacy location
      }

    } else if (selectedRole === "delivery") {
      payload.name = el("delivery-name")?.value || "";
      payload.email = el("delivery-email")?.value || "";
      payload.phone = el("delivery-phone")?.value || "";
      payload.password = el("delivery-password")?.value || "";
      payload.vehicleType = el("vehicle-type")?.value || "";
      payload.vehicleNumber = el("vehicle-number")?.value || "";
      payload.area = el("delivery-area")?.value || "";
    }

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.error) return alert(data.error);

    if (data.token) {
      localStorage.setItem("token", data.token);
      alert("Signup Successful!");
      window.location.href = "home.html";
    } else {
      alert("Signup completed.");
      window.location.href = "home.html";
    }
  } catch (err) {
    console.error("Signup error:", err);
    alert("Signup failed.");
  }
}


/* ---------------------------
   LOGIN
   --------------------------- */
async function loginUser() {
  const email = el("loginEmail")?.value || "";
  const password = el("loginPassword")?.value || "";

  if (!selectedRole) {
    showError("Please select a role.");
    return;
  }

  try {
    let location = null;

    // Only Users need location update on login, and we shouldn't block for more than 2s
    if (selectedRole === "user") {
      const getLocationPromise = getCurrentLocation();
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 2500));

      // Race: if location takes too long, we proceed without it
      location = await Promise.race([getLocationPromise, timeoutPromise]);
    }

    const body = { email, password, role: selectedRole };
    if (location && selectedRole === "user") {
      body.location = location;   // update user location on login
    }

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.error) {
      showError(data.error);
      return;
    }

    if (data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("userRole", selectedRole); // Store Role
    }

    showLoginSuccess();

    setTimeout(() => {
      if (selectedRole === "pharmacist") {
        window.location.href = "/pharmacist/index.html";
      } else if (selectedRole === "delivery") {
        window.location.href = "/delivery/index.html";
      } else if (selectedRole === "user") {
        window.location.href = "/user/home.html";
      } else {
        window.location.href = "pharmacist/home.html";
      }
    }, 700);

  } catch (err) {
    console.error("Login error:", err);
    showError("Login failed.");
  }
}


function backToRoleCards() {
  selectedRole = null;
  const cards = document.querySelector(".login-cards");
  if (cards) cards.style.display = "flex";
  if (el("roleLoginForm")) el("roleLoginForm").style.display = "none";
  if (el("roleSignupForm")) el("roleSignupForm").style.display = "none";
}

/* ---------------------------
   AUTH UI
   --------------------------- */
function updateAuthUI() {
  const loginBtn = el("loginBtn");
  const logoutBtn = el("logoutBtn");
  if (!loginBtn || !logoutBtn) return;

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("userRole");

  // Only consider logged in if token exists AND role is 'user'
  const loggedIn = token && role === "user";

  loginBtn.style.display = loggedIn ? "none" : "block";
  logoutBtn.style.display = loggedIn ? "block" : "none";
}

/* ---------------------------
   LOGOUT popup handlers
   --------------------------- */
function logoutUser() {
  const box = el("logoutConfirmBox");
  if (box) box.style.display = "flex";
}

function confirmLogout() {
  localStorage.removeItem("token");
  updateAuthUI();
  const box = el("logoutConfirmBox");
  if (box) box.style.display = "none";
  window.location.href = "home.html";
}

function cancelLogout() {
  const box = el("logoutConfirmBox");
  if (box) box.style.display = "none";
}

/* ---------------------------
   POPUPS
   --------------------------- */
function showLoginSuccess() {
  const box = el("loginSuccessBox");
  if (box) box.style.display = "flex";
}
function hideLoginSuccess() {
  const box = el("loginSuccessBox");
  if (box) box.style.display = "none";
}
function showError(message) {
  if (el("errorMessage")) el("errorMessage").innerText = message;
  const box = el("errorPopup");
  if (box) box.style.display = "flex";
}
function hideError() {
  const box = el("errorPopup");
  if (box) box.style.display = "none";
}

/* ---------------------------
   MAP / PHARMACIES
   --------------------------- */
function initMap(lat, lon) {
  const container = el("map");
  if (!container) return;
  if (!map) {
    map = L.map("map").setView([lat, lon], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
  } else {
    map.setView([lat, lon], 14);
    // if map was hidden earlier, invalidate size
    setTimeout(() => map.invalidateSize(), 200);
  }
}

function addMarker(lat, lon, name) {
  if (!map) return;
  const marker = L.marker([lat, lon]).addTo(map);
  marker.bindPopup(`<b>${escapeHtml(name)}</b>`);
  markers.push(marker);
}

// Global user marker reference
let userMarker = null;

async function findPharmacies(lat, lon) {
  // Clear existing pharmacy markers (but not the user marker)
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  // Query Overpass
  // ⭐ REAL PHARMACY QUERY (properly encoded)
  const query = `[out:json]; node["amenity" = "pharmacy"](around: 3000, ${lat}, ${lon}); out; `;
  const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

  try {
    const res = await fetch(url, { method: "GET", headers: { "Accept": "application/json" } });
    const data = await res.json();

    if (!data.elements || data.elements.length === 0) {
      alert("No nearby pharmacies found in this area.");
      return;
    }

    data.elements.forEach(pharmacy => {
      addMarker(
        pharmacy.lat,
        pharmacy.lon,
        (pharmacy.tags && pharmacy.tags.name) ? pharmacy.tags.name : "Unnamed Pharmacy"
      );
    });

  } catch (e) {
    console.error("Pharmacy API error:", e);
    alert("Could not load nearby pharmacies.");
  }
}

function locatePharmacies() {
  const btn = document.querySelector("button[onclick='locatePharmacies()']");
  if (btn) btn.innerText = "⏳ Locating...";

  if (!navigator.geolocation) return alert("Geolocation not supported.");

  navigator.geolocation.getCurrentPosition(async pos => {
    if (btn) btn.innerText = "📍 Find Nearby Pharmacies";

    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    initMap(lat, lon);

    // Add or Move User Marker
    if (userMarker) {
      userMarker.setLatLng([lat, lon]);
    } else {
      userMarker = L.circleMarker([lat, lon], {
        color: 'blue',
        fillColor: '#30f',
        fillOpacity: 0.5,
        radius: 8
      }).addTo(map).bindPopup("<b>You are here</b><br>Click anywhere to move me").openPopup();
    }

    // Initial Search
    findPharmacies(lat, lon);

    // Setup Map Click to Move
    map.off('click'); // remove old listeners if any
    map.on('click', (e) => {
      const { lat: newLat, lng: newLon } = e.latlng;

      // Move User Marker
      if (userMarker) userMarker.setLatLng([newLat, newLon]);

      // Search again
      findPharmacies(newLat, newLon);
    });

    alert("Location found. If it's wrong, CLICK ON THE MAP to set your correct location.");

  }, (err) => {
    console.warn("Geolocation error or insecure origin:", err);
    if (btn) btn.innerText = "📍 Find Nearby Pharmacies";

    // Fallback for HTTP/Mobile testing where Geo is blocked
    alert("GPS unavailable (requires HTTPS). Using default location. \n\n👉 Click on the map to set your real location.");

    // Default to Mumbai (or any central location)
    const defLat = 19.0760;
    const defLon = 72.8777;

    initMap(defLat, defLon);

    if (userMarker) {
      userMarker.setLatLng([defLat, defLon]);
    } else {
      userMarker = L.circleMarker([defLat, defLon], {
        color: 'blue',
        fillColor: '#30f',
        fillOpacity: 0.5,
        radius: 8
      }).addTo(map).bindPopup("<b>Default Location</b><br>Click anywhere to move me").openPopup();
    }

    findPharmacies(defLat, defLon);

    // Setup Map Click to Move (ensure this is bound)
    map.off('click');
    map.on('click', (e) => {
      const { lat: newLat, lng: newLon } = e.latlng;
      if (userMarker) userMarker.setLatLng([newLat, newLon]);
      findPharmacies(newLat, newLon);
    });

  }, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  });
}


/* ---------------------------
   Helpers
   --------------------------- */
/* ---------------------------
   TOAST NOTIFICATION HELPER
   --------------------------- */
function showToast(message, type = "success") {
  let toast = document.getElementById("toast-notification");

  // Create toast container if not exists
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-notification";
    toast.style.position = "fixed";
    toast.style.top = "20px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.padding = "12px 24px";
    toast.style.borderRadius = "8px";
    toast.style.color = "#fff";
    toast.style.fontSize = "1rem";
    toast.style.fontWeight = "600";
    toast.style.zIndex = "10000";
    toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    document.body.appendChild(toast);
  }

  // Set Color based on type
  if (type === "success") toast.style.backgroundColor = "#10B981"; // Green
  else if (type === "error") toast.style.backgroundColor = "#EF4444"; // Red
  else toast.style.backgroundColor = "#333"; // Default

  // Show
  toast.textContent = message;
  toast.style.display = "block";
  // Trigger reflow
  void toast.offsetWidth;
  toast.style.opacity = "1";
  toast.style.transform = "translateX(-50%) translateY(0)";

  // Hide after 3s
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(-20px)";
    setTimeout(() => toast.style.display = "none", 300);
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#39;" }[c]));
}

/* ---------------------------
   DOMContentLoaded: bind handlers safely
   --------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  // Init search if query present
  initSearchFromQuery();

  // Load cart content if on cart page
  loadCart();

  // Auth UI update
  updateAuthUI();

  // Bind buttons only if present
  if (el("confirmLogoutYes")) el("confirmLogoutYes").onclick = confirmLogout;
  if (el("confirmLogoutNo")) el("confirmLogoutNo").onclick = cancelLogout;
  if (el("loginSuccessOk")) el("loginSuccessOk").onclick = hideLoginSuccess;
  if (el("errorOk")) el("errorOk").onclick = hideError;

  // Bind logout button if present (navbar)
  if (el("logoutBtn")) el("logoutBtn").addEventListener("click", logoutUser);

  // Bind searchBox keyup to searchMedicine (if present)
  if (el("searchBox")) el("searchBox").addEventListener("keyup", () => searchMedicine());

  // If on pharmacies page and map container present, ensure map resizes when page loaded
  if (el("map") && typeof L !== "undefined") {
    // If you want to auto-locate on page load uncomment next line:
    // locatePharmacies();
    setTimeout(() => { if (map) map.invalidateSize(); }, 300);
  }

  // Load Categories on Home Page
  if (el("categoryList")) {
    loadCategories();
  }

  // Init Search Dropdown
  initSearchDropdown();
});



/* ===========================
   LOAD CATEGORIES (Dynamic)
=========================== */
async function loadCategories() {
  const box = document.getElementById("categoryList");
  if (!box) return;

  try {
    const res = await fetch("/api/stock/categories");
    const categories = await res.json();

    if (!categories || categories.length === 0) {
      box.innerHTML = "<p>No categories found.</p>";
      return;
    }

    box.innerHTML = categories.map(cat => `
        <div onclick="searchCategory('${cat}')"
        style="padding: 1rem 2rem; background: white; border: 1px solid var(--border-light); border-radius: 50px; cursor: pointer; font-weight: 600; color: var(--primary);">
          ${cat}
        </div>
          `).join("");

  } catch (err) {
    console.error("Categories error:", err);
    box.innerHTML = "<p>Failed to load categories.</p>";
  }
}

/* ===========================
   SEARCH DROPDOWN (AUTOCOMPLETE)
=========================== */
function initSearchDropdown() {
  const input = document.getElementById("homeSearchBox");
  const dropdown = document.getElementById("searchDropdown");

  if (!input || !dropdown) return;

  // Hide on click outside
  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = "none";
    }
  });

  input.addEventListener("input", async () => {
    const q = input.value.trim();
    if (q.length < 2) {
      dropdown.style.display = "none";
      return;
    }

    try {
      // Reuse backend search API
      const res = await fetch(`/api/stock/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        dropdown.innerHTML = `<div class="dropdown-item" style="cursor:default; color:#888;">No results found</div>`;
        dropdown.style.display = "block";
        return;
      }

      dropdown.innerHTML = data.slice(0, 6).map(item => `
          <div class="dropdown-item" onclick="selectSearchItem('${escapeHtml(item.medicineName)}')">
              <div class="item-info">
                  <img src="${item.image || '/user/default.jpg'}" onerror="this.src='/user/default.jpg'">
                  <div>
                      <div style="font-weight:600; color:#333;">${escapeHtml(item.medicineName)}</div>
                      <div style="font-size:12px; color:#888;">${item.category || 'General'} • ₹${item.price || 0}</div>
                  </div>
              </div>
              <button class="cta-btn-secondary" style="padding: 4px 12px; font-size: 12px;" onclick="event.stopPropagation(); addToCart('${escapeHtml(item.medicineName)}')">
                  Add
              </button>
          </div>
          `).join("");

      dropdown.style.display = "block";

    } catch (err) {
      console.error("Dropdown error:", err);
    }
  });
}

function selectSearchItem(name) {
  const input = document.getElementById("homeSearchBox");
  if (input) input.value = name;
  document.getElementById("searchDropdown").style.display = "none";
  // Optionally redirect to search results or just stay
  searchOnHome();
}

function searchCategory(catName) {
  // Populate the search box with category name (simple filter strategy)
  const input = document.getElementById("homeSearchBox");
  if (input) {
    input.value = catName;
    searchOnHome();
  }
}

async function searchOnHome() {
  const query = document.getElementById("homeSearchBox").value.trim();
  const resultsEl = document.getElementById("homeResults");

  // Hide dropdown if open
  const dropdown = document.getElementById("searchDropdown");
  if (dropdown) dropdown.style.display = "none";

  if (!query) {
    if (resultsEl) resultsEl.innerHTML = "";
    return;
  }

  // If we are NOT on home page (resultsEl missing), then redirect
  if (!resultsEl) {
    window.location.href = `/user/search.html?q=${encodeURIComponent(query)}`;
    return;
  }

  try {
    resultsEl.innerHTML = Array.from({ length: 6 }).map(() => `
      <div class="skeleton-card">
        <div class="skeleton-img"></div>
        <div class="skeleton-line long"></div>
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line short"></div>
      </div>
    `).join("");

    const res = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      resultsEl.innerHTML = "<p style='text-align:center; width:100%; color:var(--text-muted);'>No medicines found</p>";
      return;
    }

    resultsEl.innerHTML = data.map(item => `
          <div class="product-card">
        <div style="height:150px; background:#f9fafb; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-sm); margin-bottom:1rem; overflow:hidden;">
            <img src="${item.image || '/user/default.jpg'}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='/user/default.jpg'">
        </div>

        <div class="product-name" style="font-weight:bold; margin-bottom:0.25rem;">${escapeHtml(item.medicineName)}</div>
        <div style="color:var(--text-muted); font-size:0.9rem; margin-bottom:0.5rem;">${item.category || 'General'}</div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
             <div style="font-weight:800; color:var(--primary);">₹${item.price || '0'}</div>
             <div class="product-qty" style="font-size:0.8rem;">Qty: ${item.quantity}</div>
        </div>

        <button class="product-btn" style="margin-top:1rem; width:100%;" onclick="addToCart('${escapeHtml(item.medicineName)}')">
          Add to Cart
        </button>
      </div>
          `).join("");

    // Scroll to results
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    console.error("Search Error:", err);
    resultsEl.innerHTML = "<p>Search failed</p>";
  }
}


/* ===========================
   PLACE ORDER
=========================== */
async function placeOrder() {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Please login first.");
    return;
  }

  try {
    const res = await fetch("/api/order/place", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token
      }
    });

    const data = await res.json();

    if (data.error) {
      showToast(data.error, "error");
      return;
    }

    showToast("Order placed successfully!", "success");

    // Refresh cart
    loadCart();

  } catch (err) {
    console.error("Place order error:", err);
    showToast("Failed to place order.", "error");
  }
}

async function placeOrderWithLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please login first.");
      return;
    }

    const body = {
      location: {
        lat: position.coords.latitude,
        lon: position.coords.longitude
      }
    };

    try {
      const res = await fetch("/api/order/place", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (data.error) {
        showToast(data.error, "error");
      } else {
        showToast("Order placed!", "success");
        // cart will refresh via /api/cart in cart page
        setTimeout(() => window.location.href = "/user/home.html", 1500);
      }
    } catch (err) {
      console.error("Place order error:", err);
      showToast("Failed to place order.", "error");
    }
  });
}



/* ===========================
   RECENT ORDERS ON HOME PAGE
=========================== */
async function loadRecentOrders() {
  const box = document.getElementById("recentOrders");
  if (!box) return;  // safety

  const token = localStorage.getItem("token");

  if (!token) {
    box.innerHTML = `<p style="text-align:center;color:#777;">Login to see recent orders.</p>`;
    return;
  }

  // Fetch order history
  const res = await fetch("/api/order/history/user", {
    headers: {
      "Authorization": "Bearer " + token
    }
  });

  const data = await res.json();

  box.innerHTML = "";

  if (!Array.isArray(data) || data.length === 0) {
    box.innerHTML = `<p style="text-align:center;color:#777;">No recent orders.</p>`;
    return;
  }

  data.slice(0, 3).forEach(o => {
    const status = o.status || "pending";

    const icon = {
      pending: "⏳",
      ready: "📦",
      "out-for-delivery": "🚚",
      delivered: "✅"
    }[status] || "⏳";

    box.innerHTML += `
      <div class="order-card">
        <div class="order-row">
          <span class="status-chip ${status}">
            ${icon} ${status}
          </span>
        </div>

        <div class="order-items">
          ${o.items.map(i => `<span class="pill">${i.medicineName}</span>`).join("")}
        </div>
      </div>
    `;
  });

}

// Get current browser location as Promise
function getCurrentLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);

    const opts = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => {
        console.warn("High accuracy location failed, trying low accuracy...", err);
        // Retry with low accuracy
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
          () => resolve(null), // specific failure
          { enableHighAccuracy: false, timeout: 10000 }
        );
      },
      opts
    );
  });
}

function getCurrentLocationForSignup() {
  getCurrentLocation().then((loc) => {
    if (!loc) {
      console.warn("No location returned");
      return;
    }

    console.log("📍 SIGNUP GPS:", loc);

    const latInput = el("pharmacy-lat");
    const lonInput = el("pharmacy-lon");

    if (latInput) latInput.value = loc.lat.toFixed(6);
    if (lonInput) lonInput.value = loc.lon.toFixed(6);
  });
}



/* ===========================
   REAL-TIME ORDER UPDATES
=========================== */
let homeSocket = null;

function initHomeSocket() {
  const token = localStorage.getItem("token");
  if (!token) return; // user not logged in

  // Decode token to get user ID (safe client-side trick)
  const payload = JSON.parse(atob(token.split(".")[1]));
  const userId = payload.id;

  // Connect socket
  homeSocket = io("http://172.22.16.1:5000");

  // Listen for user-specific updates
  homeSocket.on("user:ordersChanged", (data) => {
    if (!data || data.userId !== userId) return;

    // 🔥 reload recent orders automatically
    loadRecentOrders();
  });
}

initHomeSocket();
