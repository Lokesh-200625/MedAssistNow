// ============================
// AUTH GUARD
// ============================
if (!localStorage.getItem("token")) {
  window.location.href = "/user/login.html";
}


// ============================
// LOGOUT POPUP
// ============================
const logoutBtn = document.getElementById("logoutBtn");
const logoutConfirmBox = document.getElementById("logoutConfirmBox");
const confirmLogoutYes = document.getElementById("confirmLogoutYes");
const confirmLogoutNo = document.getElementById("confirmLogoutNo");

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    logoutConfirmBox.style.display = "flex";
  });

  confirmLogoutNo.addEventListener("click", () => {
    logoutConfirmBox.style.display = "none";
  });

  confirmLogoutYes.addEventListener("click", () => {
    localStorage.clear();
    logoutConfirmBox.style.display = "none";
    window.location.href = "/user/login.html";
  });
}


// ============================
// LOAD READY + ACTIVE ORDERS
// ============================
async function loadReadyOrdersOnHome() {
  const token = localStorage.getItem("token");

  const res = await fetch("/api/order/delivery/ready", {
    headers: {
      "Authorization": "Bearer " + token
    }
  });

  const data = await res.json();
  const availableContainer = document.getElementById("availableOrders");
  const activeContainer = document.getElementById("activeOrders");

  if (!availableContainer || !activeContainer) return;

  if (!data.length) {
    availableContainer.innerHTML = "<p>No ready orders.</p>";
    activeContainer.innerHTML = "<p>No active deliveries.</p>";
    return;
  }

  const readyOrders = data.filter(o => o.status === "ready");
  const activeOrders = data.filter(o => o.status === "out-for-delivery");

  // ---------------- READY ----------------
  if (!readyOrders.length) {
    availableContainer.innerHTML = "<p>No ready orders.</p>";
  } else {
    availableContainer.innerHTML = readyOrders.map(o => `
    <div class="order-card">
        <h3>Order #${o._id}</h3>
        <p><b>Status:</b> ${o.status}</p>
        <p><b>Placed:</b> ${new Date(o.orderedAt).toLocaleString()}</p>

        <p><b>Pharmacy → User:</b> ${o.distancePharmacyToUserKm?.toFixed(2) || 0} km</p>
        <p><b>Expected Earning:</b> ₹${o.expectedEarning?.toFixed(2) || 0}</p>

        <ul>
            ${o.items.map(i =>
      `<li>${i.medicineName} (x${i.quantity})</li>`
    ).join("")}
        </ul>

        <button onclick="acceptDelivery('${o._id}')" class="btn-accept">
            Accept Delivery
        </button>
    </div>
`).join("");

  }

  // ---------------- ACTIVE ----------------
  if (!activeOrders.length) {
    activeContainer.innerHTML = "<p>No active deliveries.</p>";
  } else {
    activeContainer.innerHTML = activeOrders.map(o => `
      <div class="order-card">
          <h3>Active Order #${o._id}</h3>
          <p><b>Status:</b> ${o.status}</p>

          <ul>
              ${o.items.map(i =>
      `<li>${i.medicineName} (x${i.quantity})</li>`
    ).join("")}
          </ul>

          ${o.pickedUp
        ? `
                <button onclick="markDelivered('${o._id}')" class="btn-delivered">
                    Mark Delivered ✔
                </button>
              `
        : `
                <button onclick="pickupOrder('${o._id}')" class="btn-accept">
                    Order Pickup
                </button>
              `
      }
      </div>
  `).join("");
  }

}


// -------------------------------------------------------------------------------------
// TOAST NOTIFICATION HELPER
// -------------------------------------------------------------------------------------
function showToast(message, type = "success") {
  let toast = document.getElementById("toast-notification");
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
  if (type === "success") toast.style.backgroundColor = "#10B981";
  else if (type === "error") toast.style.backgroundColor = "#EF4444";
  else toast.style.backgroundColor = "#333";

  toast.textContent = message;
  toast.style.display = "block";
  void toast.offsetWidth;
  toast.style.opacity = "1";
  toast.style.transform = "translateX(-50%) translateY(0)";

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(-20px)";
    setTimeout(() => toast.style.display = "none", 300);
  }, 3000);
}


// ============================
// ACCEPT DELIVERY + NAVIGATION
// ============================
async function acceptDelivery(id) {
  const token = localStorage.getItem("token");

  const res = await fetch(`/api/order/delivery/accept/${id}`, {
    method: "PUT",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    }
  });

  const data = await res.json();

  if (data.error) {
    showToast(data.error, "error");
    return;
  }

  // 🌍 Navigate to PHARMACY first
  if (data.pharmacyLocation && typeof data.pharmacyLocation.lat === "number" && typeof data.pharmacyLocation.lon === "number") {
    const { lat, lon } = data.pharmacyLocation;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    window.open(url, "_blank");
  } else {
    showToast("Order accepted. Proceed to pharmacy.");
  }

  loadReadyOrdersOnHome();
}

async function pickupOrder(id) {
  const token = localStorage.getItem("token");

  const res = await fetch(`/api/order/delivery/pickup/${id}`, {
    method: "PUT",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    }
  });

  const data = await res.json();

  if (data.error) {
    alert(data.error);
    return;
  }

  // 1) Prefer Address (because your GPS is matching your ISP, not your home)
  if (data.userAddress && data.userAddress.length >= 3) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(data.userAddress)}`;
    window.open(url, "_blank");

    // 2) Fallback to GPS
  } else if (data.userLocation &&
    typeof data.userLocation.lat === "number" &&
    typeof data.userLocation.lon === "number" &&
    (data.userLocation.lat !== 0 || data.userLocation.lon !== 0)) {

    const { lat, lon } = data.userLocation;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    window.open(url, "_blank");

  } else {
    alert("Order picked up. Proceed to user location.");
  }

  loadReadyOrdersOnHome();
}





// ============================
// MARK DELIVERED
// ============================
async function markDelivered(id) {
  const token = localStorage.getItem("token");

  await fetch(`/api/order/delivery/delivered/${id}`, {
    method: "PUT",
    headers: {
      "Authorization": "Bearer " + token
    }
  });

  alert("Order delivered!");
  loadReadyOrdersOnHome();
}


// ============================
// EARNINGS DASHBOARD
// ============================
async function loadDeliveryEarnings() {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    const res = await fetch("/api/delivery/earnings", {
      headers: { "Authorization": "Bearer " + token }
    });

    const data = await res.json();

    // Update Stats
    document.getElementById("todayEarnings").innerText = (data.today || 0).toFixed(2);
    document.getElementById("todayDeliveries").innerText = data.completedCount || 0;
    document.getElementById("weekEarnings").innerText = (data.week || 0).toFixed(2);
    document.getElementById("lifetimeEarnings").innerText = (data.total || 0).toFixed(2);

    // Optionally load detailed history list if needed (can keep using order history API for that if strictly needed, 
    // but the summary boxes are now powered by the dedicated endpoint)
  } catch (err) {
    console.error("Failed to load earnings:", err);
  }
}


// ============================
// LIVE DRIVER LOCATION TRACKING
// ============================
function startDeliveryTracking() {
  if (!navigator.geolocation) return;

  setInterval(() => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        await fetch("/api/delivery/update-location", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude
          })
        });
      } catch (err) {
        console.error("Delivery location update failed:", err);
      }
    });
  }, 5000);
}


// ============================
// AUTO LOAD
// ============================
// ============================
// AUTO LOAD
// ============================
document.addEventListener("DOMContentLoaded", () => {
  startDeliveryTracking();

  if (window.location.pathname.includes("earnings")) {
    loadDeliveryEarnings();
  }

  loadReadyOrdersOnHome();
});
