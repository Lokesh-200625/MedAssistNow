async function loadOrders() {
    const token = localStorage.getItem("token");

    const res = await fetch("/api/order/pharmacy", {
        headers: {
            "Authorization": "Bearer " + token
        }
    });

    const orders = await res.json();
    const container = document.getElementById("orderContainer");

    if (!orders.length) {
        container.innerHTML = "<p>No orders yet.</p>";
        return;
    }

    container.innerHTML = orders.map(o => `
        <div class="order-card" style="margin-bottom: 2rem;">

            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:0.5rem; margin-bottom:1rem;">
                <h3>Order #${o._id.slice(-6).toUpperCase()}</h3>
                <span style="font-size:0.9rem; color:#666;">${new Date(o.createdAt).toLocaleString()}</span>
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
                    <div class="status ${o.status}" style="font-weight:bold; font-size:1rem;">${o.status}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:0.9rem; color:#666;">Total Amount</div>
                    <div style="font-size:1.4rem; font-weight:800; color:var(--primary);">
                        ₹${o.totalAmount || o.items.reduce((s, i) => s + (i.price || 0) * i.quantity, 0)}
                    </div>
                </div>
            </div>

            ${o.status === "pending" ? `
            <div class="action-row" style="margin-top:1.5rem; display:flex; gap:1rem;">
                <button onclick="updateOrder('${o._id}', 'ready')" class="btn-ready" style="flex:1;">✅ Mark Ready</button>
                <button onclick="updateOrder('${o._id}', 'rejected')" class="btn-reject" style="flex:1;">❌ Reject</button>
            </div>
            ` : ``}

        </div>
    `).join("");
}


async function updateOrder(id, status) {
    const token = localStorage.getItem("token");

    await fetch(`/api/order/status/${id}`, {
        method: "PUT",
        headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
    });

    loadOrders(); // refresh
}

window.addEventListener("DOMContentLoaded", loadOrders);
