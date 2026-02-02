/* ------------------------------
   PHARMACIST PORTAL SCRIPT
------------------------------ */

// 🔒 FRONTEND AUTH GUARD
if (!localStorage.getItem("token")) {
    window.location.href = "/user/login.html";
}


/* ------------------------------
   LOGOUT POPUP
------------------------------ */
const logoutBtn = document.getElementById("logoutBtn");
const logoutConfirmBox = document.getElementById("logoutConfirmBox");
const confirmLogoutYes = document.getElementById("confirmLogoutYes");
const confirmLogoutNo = document.getElementById("confirmLogoutNo");

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        logoutConfirmBox.style.display = "flex";
    });

    if (confirmLogoutNo) {
        confirmLogoutNo.addEventListener("click", () => {
            logoutConfirmBox.style.display = "none";
        });
    }

    if (confirmLogoutYes) {
        confirmLogoutYes.addEventListener("click", () => {
            localStorage.clear();
            window.location.href = "/";
        });
    }
}


/* ------------------------------
   ERROR POPUP
------------------------------ */
const errorPopup = document.getElementById("errorPopup");
const errorMessage = document.getElementById("errorMessage");
const errorOk = document.getElementById("errorOk");

function showError(msg) {
    if (errorMessage && errorPopup) {
        errorMessage.textContent = msg;
        errorPopup.style.display = "flex";
    }
}

if (errorOk) {
    errorOk.addEventListener("click", () => {
        errorPopup.style.display = "none";
    });
}


/* ------------------------------
   STATUS BADGE HELPER
------------------------------ */
function statusBadge(status) {
    switch (status) {
        case "pending": return "🕒 Pending";
        case "ready": return "📦 Ready";
        case "out-for-delivery": return "🚚 Out for delivery";
        case "delivered": return "✔️ Delivered";
        case "rejected": return "❌ Rejected";
        default: return status;
    }
}

function formatDate(date) {
    if (!date) return "Unavailable";
    const d = new Date(date);
    return isNaN(d.getTime()) ? "Unavailable" : d.toLocaleString();
}


/* ------------------------------
   LOAD PHARMACY ORDERS
------------------------------ */
async function loadPharmacyOrders() {
    const list = document.getElementById("ordersList");
    if (!list) return;   // ← IMPORTANT FIX

    const token = localStorage.getItem("token");

    const res = await fetch("/api/order/pharmacy", {
        headers: { "Authorization": "Bearer " + token }
    });

    const data = await res.json();

    list.innerHTML =
        data.map(o => `
            <div class="order-card" style="margin-bottom: 2rem;">

                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:0.5rem; margin-bottom:1rem;">
                    <h3>Order #${o._id.slice(-6).toUpperCase()}</h3>
                    <span style="font-size:0.9rem; color:#666;">${formatDate(o.orderedAt || o.createdAt)}</span>
                </div>

                <table style="width:100%; border-collapse: collapse; margin-bottom: 1rem;">
                    <thead>
                        <tr style="text-align:left; background:#f9fafb; font-size:0.9rem; color:#555;">
                            <th style="padding:8px;">Item</th>
                            <th style="padding:8px;">Qty</th>
                            <th style="padding:8px;">Price</th>
                            <th style="padding:8px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${o.items.map(i => {
            const price = i.price || 0;
            const total = price * i.quantity;
            return `
                            <tr style="border-bottom:1px solid #f0f0f0;">
                                <td style="padding:8px; display:flex; align-items:center; gap:8px;">
                                    <div style="width:30px; height:30px; background:#eee; border-radius:4px; overflow:hidden;">
                                         <img src="${i.image || '/user/default.jpg'}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='/user/default.jpg'">
                                    </div>
                                    <span style="font-weight:600;">${i.medicineName}</span>
                                </td>
                                <td style="padding:8px;">${i.quantity}</td>
                                <td style="padding:8px;">₹${price}</td>
                                <td style="padding:8px; font-weight:bold;">₹${total}</td>
                            </tr>`;
        }).join("")}
                    </tbody>
                </table>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem;">
                    <div>
                        <div style="font-size:0.9rem; color:#666;">Status</div>
                        <div style="font-weight:bold; font-size:1rem;">${statusBadge(o.status)}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:0.9rem; color:#666;">Total Amount</div>
                        <div style="font-size:1.4rem; font-weight:800; color:var(--primary);">
                            ₹${o.totalAmount || o.items.reduce((s, i) => s + (i.price || 0) * i.quantity, 0)}
                        </div>
                    </div>
                </div>

                ${o.status === "pending" ? `
                    <div style="display:flex; gap:1rem; margin-top:1.5rem;">
                        <button onclick="markStatus('${o._id}', 'ready')" class="btn-ready" style="flex:1;">
                            ✅ Accept & Mark Ready
                        </button>
                        <button onclick="markStatus('${o._id}', 'rejected')" class="btn-reject" style="flex:1; background:#ef4444; color:white;">
                            ❌ Reject
                        </button>
                    </div>
                ` : ``}
            </div>
        `).join("");
}


/* ------------------------------
   UPDATE ORDER STATUS
------------------------------ */
async function markStatus(id, status) {
    const token = localStorage.getItem("token");

    const res = await fetch(`/api/order/status/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ status })
    });

    const data = await res.json();

    if (data.error) {
        showError(data.error);
        return;
    }

    loadPharmacyOrders();
}


/* ------------------------------
   ADD STOCK (FULLY WORKING)
------------------------------ */
/* ------------------------------
   ADD STOCK
------------------------------ */
async function addStock() {
    const token = localStorage.getItem("token");

    const medicineName = document.getElementById("medicineName")?.value.trim();
    const quantity = parseInt(document.getElementById("quantity")?.value.trim(), 10);
    const batchNo = document.getElementById("batchNo")?.value.trim();
    const price = parseFloat(document.getElementById("price")?.value.trim());
    const image = document.getElementById("image")?.value.trim();
    const category = document.getElementById("category")?.value.trim();
    const description = document.getElementById("description")?.value.trim();

    if (!medicineName || !quantity || !batchNo || !category || isNaN(price)) {
        showError("Name, quantity, batch, category, and price are required.");
        return;
    }

    const body = {
        medicineName,
        quantity,
        batchNo,
        price,
        category,
        description,
        image
    };

    const res = await fetch("/api/stock/add", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify(body)
    });

    const data = await res.json();

    if (data.error) {
        showToast(data.error, "error");
        return;
    }

    showToast("Stock added successfully!", "success");

    document.getElementById("medicineName").value = "";
    document.getElementById("quantity").value = "";
    document.getElementById("batchNo").value = "";
    document.getElementById("price").value = "";
    document.getElementById("image").value = "";
    document.getElementById("category").value = "";
    document.getElementById("description").value = "";
}



function updateAuthUI() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (!logoutBtn) return;

    const loggedIn = !!localStorage.getItem("token");
    logoutBtn.style.display = loggedIn ? "block" : "none";
}


/* ------------------------------
   SEARCH ON PHARMA PORTAL
------------------------------ */
async function searchOnPharma() {
    const query = document.getElementById("pharmaSearchBox").value.trim();
    const resultsEl = document.getElementById("pharmaResults");

    if (!query) {
        resultsEl.innerHTML = "";
        return;
    }

    try {
        const res = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
            resultsEl.innerHTML = "<p>No medicines found.</p>";
            return;
        }

        resultsEl.innerHTML = data.map(item => `
            <div class="product-card">
                <div style="height:120px; background:#f9fafb; display:flex; align-items:center; justify-content:center; margin-bottom:1rem; border-radius:8px; overflow:hidden;">
                     <img src="${item.image || '/user/default.jpg'}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='/user/default.jpg'">
                </div>
                <h3>${item.medicineName}</h3>
                <p>Qty: ${item.quantity} | Batch: ${item.batchNo || 'N/A'}</p>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
                    <span style="font-weight:bold; color:var(--primary);">₹${item.price}</span>
                    <button onclick="editStock('${item._id}', ${item.quantity})" class="btn-ready" style="padding:4px 10px; font-size:12px;">Update Qty</button>
                </div>
            </div>
        `).join("");

    } catch (err) {
        console.error("Search error:", err);
        resultsEl.innerHTML = "<p>Search failed.</p>";
    }

}

async function editStock(id, oldQty) {
    const newQty = prompt("Enter quantity to ADD (e.g. 10) or REMOVE (e.g. -5):");
    if (!newQty) return;

    const val = parseInt(newQty);
    if (isNaN(val)) return alert("Invalid number");

    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`/api/stock/update/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ qty: val })
        });
        const d = await res.json();
        if (d.error) showToast(d.error, "error");
        else {
            showToast("Stock updated!", "success");
            searchOnPharma(); // refresh
        }
    } catch (e) {
        console.error(e);
        showToast("Update failed", "error");
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


/* ------------------------------
   INIT ON PAGE LOAD
------------------------------ */
window.addEventListener("DOMContentLoaded", () => {

    updateAuthUI();  // 👈 VERY IMPORTANT

    // Check if we are on orders page
    if (document.getElementById("ordersList")) {
        loadPharmacyOrders();
    }

    const addBtn = document.getElementById("addStockBtn");
    if (addBtn) {
        addBtn.addEventListener("click", addStock);
    }
});