const fetch = global.fetch || require("node-fetch"); // Fallback if needed, but usually works on Node 18+

const BASE_URL = "http://localhost:5000/api";
const SUFFIX = Math.floor(Math.random() * 100000);

const pharmacy = {
    role: "pharmacist",
    name: "Test Pharma",
    email: `pharma${SUFFIX}@test.com`,
    password: "password123",
    pharmacyName: "Pharma One",
    license: "LIC123",
    address: "0,0 Origin",
    location: { lat: 0, lon: 0 }
};

const user = {
    role: "user",
    name: "Test User",
    email: `user${SUFFIX}@test.com`,
    password: "password123",
    address: "User Address",
    location: { lat: 0.05, lon: 0.05 } // Very close
};

const driverNear = {
    role: "delivery",
    name: "Driver Near",
    email: `driverNear${SUFFIX}@test.com`,
    password: "password123",
    vehicleType: "Bike",
    vehicleNumber: "KA01",
    area: "Central",
    location: { lat: 0.01, lon: 0.01 } // ~1.5km from pharmacy
};

const driverFar = {
    role: "delivery",
    name: "Driver Far",
    email: `driverFar${SUFFIX}@test.com`,
    password: "password123",
    vehicleType: "Bike",
    vehicleNumber: "KA02",
    area: "North",
    location: { lat: 1.0, lon: 1.0 } // ~150km away
};

let tokens = {};
let ids = {};
let orderId = null;

async function req(method, path, body, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}${path}`, opts);
    const json = await res.json();
    if (res.status >= 400) {
        console.log(`❌ ERROR ${method} ${path}`, json);
    }
    return { status: res.status, json };
}

async function run() {
    console.log("🚀 Starting Verification Flow...");

    // 1. REGISTER
    console.log("1. Registering users...");
    await req("POST", "/auth/signup", pharmacy);
    await req("POST", "/auth/signup", user);
    await req("POST", "/auth/signup", driverNear);
    await req("POST", "/auth/signup", driverFar);

    // 2. LOGIN
    console.log("2. Logging in...");
    const pLogin = await req("POST", "/auth/login", { email: pharmacy.email, password: pharmacy.password, role: "pharmacist" });
    tokens.pharmacy = pLogin.json.token;

    const uLogin = await req("POST", "/auth/login", { email: user.email, password: user.password, role: "user" });
    tokens.user = uLogin.json.token;

    const d1Login = await req("POST", "/auth/login", { email: driverNear.email, password: driverNear.password, role: "delivery" });
    tokens.driverNear = d1Login.json.token;
    ids.driverNear = JSON.parse(atob(tokens.driverNear.split('.')[1])).id; // decode jwt simply

    const d2Login = await req("POST", "/auth/login", { email: driverFar.email, password: driverFar.password, role: "delivery" });
    tokens.driverFar = d2Login.json.token;
    ids.driverFar = JSON.parse(atob(tokens.driverFar.split('.')[1])).id;

    // 3. SET ONLINE STATUS
    console.log("3. Setting drivers online...");
    await req("POST", "/delivery/status", { status: true }, tokens.driverNear);
    await req("POST", "/delivery/status", { status: true }, tokens.driverFar); // Both online

    // 4. ADD STOCK (Real Data)
    console.log("4. Pharmacy adding stock with Real Data (Category, Image)...");
    const medName = `RealMed${SUFFIX}`;
    await req("POST", "/stock/add", {
        medicineName: medName,
        quantity: 100,
        price: 50.0,
        category: "Pain Relief",
        description: "Effective for headaches",
        image: "http://example.com/med.jpg",
        batchNo: "BATCH-101"
    }, tokens.pharmacy);

    // 4.1 Verify Categories Fetch
    console.log("4.1 Verifying Categories...");
    const catsRes = await req("GET", "/stock/categories");
    const cats = catsRes.json;
    if (!cats.includes("Pain Relief")) console.error("❌ Stock Category ('Pain Relief') not found in list!", cats);
    else console.log("✅ Category 'Pain Relief' found.");

    // 5. ADD TO CART
    console.log("5. User adding to cart...");
    const pId = JSON.parse(atob(tokens.pharmacy.split('.')[1])).id;

    await req("POST", "/cart/add", {
        medicineName: medName,
        quantity: 2,
        pharmacyId: pId,
        price: 50.0
    }, tokens.user);
    console.log("   Cart Add Response:", (await req("GET", "/cart", null, tokens.user)).json);

    // 6. PLACE ORDER
    console.log("6. Placing order...");
    const orderRes = await req("POST", "/order/place", { location: user.location }, tokens.user);
    orderId = orderRes.json.order._id;
    console.log("   Order ID:", orderId);

    // 7. MARK READY (Trigger Auto-Assign)
    console.log("7. Pharmacy marking ready (expecting auto-assign)...");
    const updateRes = await req("PUT", `/order/status/${orderId}`, { status: "ready" }, tokens.pharmacy);

    const updatedOrder = updateRes.json.order;
    console.log("   Order Delivery ID:", updatedOrder.deliveryId);
    console.log("   Near Driver ID:   ", ids.driverNear);
    console.log("   Far Driver ID:    ", ids.driverFar);

    if (updatedOrder.deliveryId === ids.driverNear) {
        console.log("✅ SUCCESS: Auto-assigned to NEAREST driver.");
    } else {
        console.log("❌ FAILURE: Assigned to wrong driver or none.");
        console.log(updatedOrder);
    }

    // 7.1 VERIFY VISIBILITY
    console.log("7.1 Checking visibility for Far Driver...");
    const farList = await req("GET", "/order/delivery/ready", null, tokens.driverFar);
    const farSeesIt = farList.json.find(o => o._id === orderId);
    if (!farSeesIt) {
        console.log("✅ SUCCESS: Far driver does NOT see the order.");
    } else {
        console.log("❌ FAILURE: Far driver SEES the order (should be hidden).");
    }

    // 8. VERIFY ACCEPT RESTRICTION
    console.log("8. Testing Accept restrictions...");

    // Wrong driver tries
    const failAccept = await req("PUT", `/order/delivery/accept/${orderId}`, {}, tokens.driverFar);
    if (failAccept.status === 403) {
        console.log("✅ SUCCESS: Far driver rejected (403).");
    } else {
        console.log("❌ FAILURE: Far driver allowed or wrong error.", failAccept.status, failAccept.json);
    }

    // Right driver tries
    const successAccept = await req("PUT", `/order/delivery/accept/${orderId}`, {}, tokens.driverNear);
    if (successAccept.status === 200) {
        console.log("✅ SUCCESS: Near driver accepted.");
    } else {
        console.log("❌ FAILURE: Near driver failed.", successAccept.status, successAccept.json);
    }

    // 9. CHECK REAL DATA APIS (Earnings & Shifts)
    console.log("9. Verifying Delivery Real Data APIs...");
    const earnings = await req("GET", "/delivery/earnings", null, tokens.driverNear);
    console.log("   Earnings Data:", earnings.json);
    if (earnings.json.error) console.error("❌ Earnings API Failed");

    const shifts = await req("GET", "/delivery/shifts", null, tokens.driverNear);
    console.log("   Shifts Data (Count):", shifts.json.length);
    if (!Array.isArray(shifts.json)) console.error("❌ Shifts API Failed (Not Array)");

    // 10. Book a shift
    if (shifts.json.length > 0) {
        console.log("10. Booking a Shift...");
        const shiftId = shifts.json[0]._id;
        const bookRes = await req("POST", `/delivery/shifts/book/${shiftId}`, {}, tokens.driverNear);
        console.log("    Book Response:", bookRes.json);
    }

    console.log("🏁 Verification Complete.");
}

run().catch(console.error);
