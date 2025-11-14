// server.js
import express from "express";
import axios from "axios";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// ---------- Load environment variables ----------
dotenv.config();

// ---------- Initialize Express ----------
const app = express();

// ---------- Resolve __dirname for ESM ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Safaricom MPESA Sandbox config ----------
const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;
const shortCode = process.env.SHORT_CODE;
const passkey = process.env.PASSKEY;
const TEST_MSISDN = process.env.TEST_MSISDN || "254705809412";
const CALLBACK_URL = process.env.CALLBACK_URL || "https://starkville.loca.lt/callback";

// ---------- Middleware ----------

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies (limit 10kb)
app.use(express.json({ limit: "10kb" }));

// HTTP request logging
app.use(morgan("combined"));

// Rate limiting: 30 requests/minute per IP
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: "Too many requests, try again later.",
  })
);

// ---------- Helmet Security Headers (CSP included) ----------


app.use(
  helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],

      // JS: your own scripts + CDNs + inline scripts for modals
      scriptSrc: [
        "'self'",
        
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net",
        "https://cdn.emailjs.com"
      ],

      // CSS: your own + Google Fonts + FontAwesome
      styleSrc: [
        "'self'",
        
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com",
        "'unsafe-inline'"
      ],

      // Style elements (like <link> tags) - unlock Google Fonts fully
      styleSrcElem: [
        "'self'",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com",
        "'unsafe-inline'"
      ],

      // Fonts: Google Fonts + FontAwesome
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com"
      ],

      // Images: self + data + Cloudinary + Unsplash + Wikimedia + Icons8
      imgSrc: [
        "'self'",
        "data:",
        "https://res.cloudinary.com",
        "https://images.unsplash.com",
        "https://upload.wikimedia.org",
        "https://img.icons8.com"
      ],

      // Connect: EmailJS API + your SSE endpoint
      connectSrc: [
        "'self'",
        "https://api.emailjs.com",
        "https://starkville.loca.lt",
        "http://localhost:10000",
        "https://starkville.co.ke",
        "https://cdnjs.cloudflare.com"
      ],

      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
})

);


// ---------- Serve static files ----------
app.use(express.static(__dirname));

// ---------- In-memory storage for transactions ----------
const transactionStatus = {}; // keyed by CheckoutRequestID
const sseClients = new Set();

// ---------- SSE endpoint for front-end ----------
app.get("/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  sseClients.add(newClient);

  req.on("close", () => {
    sseClients.delete(newClient);
  });
});

// Broadcast updates to connected SSE clients
function broadcastTransactionUpdate(checkoutId, data) {
  const payload = JSON.stringify({ checkoutId, ...data });
  sseClients.forEach((client) => client.res.write(`data: ${payload}\n\n`));
}

// ---------- Helper Functions ----------

// Get Safaricom OAuth token
async function getAccessToken() {
  try {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const resp = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      { headers: { Authorization: `Basic ${auth}` } }
    );
    console.log("Access token acquired:", resp.data.access_token);
    return resp.data.access_token;
  } catch (err) {
    console.error("Failed to get access token:", err.response?.data || err.message);
    throw err;
  }
}

// Generate timestamp YYYYMMDDHHMMSS
function getTimestamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
}

// Build Base64 password for STK Push
function buildPassword(shortcode, passkey, timestamp) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

// ---------- STK Push Endpoint ----------
app.post("/stkpush", async (req, res) => {
  try {
    const amount = Number(req.body.amount) || 1;
    const phone = (req.body.phone && req.body.phone.trim()) || TEST_MSISDN;

    if (!/^\d{12}$/.test(phone)) {
      return res.status(400).json({ error: "Phone must be 12 digits, e.g., 2547XXXXXXXX" });
    }

    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = buildPassword(shortCode, passkey, timestamp);

    const payload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: shortCode,
      PhoneNumber: phone,
      CallBackURL: CALLBACK_URL,
      AccountReference: "Starkville Adventures",
      TransactionDesc: "STK Push - Starkville",
    };

    console.log("STK Push payload:", payload);

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.data.CheckoutRequestID) {
      transactionStatus[response.data.CheckoutRequestID] = { status: "pending", details: response.data };
    }

    broadcastTransactionUpdate(response.data.CheckoutRequestID, transactionStatus[response.data.CheckoutRequestID]);

    return res.json({ success: true, mpesa: response.data });
  } catch (err) {
    console.error("Error initiating STK push:", err.response?.data || err.message);
    return res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

// ---------- Transaction Status Endpoint ----------
app.get("/transaction-status/:id", (req, res) => {
  const id = req.params.id;
  if (!transactionStatus[id]) return res.status(404).json({ status: "unknown" });
  return res.json(transactionStatus[id]);
});

// ---------- Callback Endpoint ----------
app.post("/callback", (req, res) => {
  console.log("Received M-Pesa callback:", JSON.stringify(req.body, null, 2));

  const callbackData = req.body?.Body?.stkCallback;
  if (!callbackData) return res.sendStatus(400);

  const checkoutId = callbackData.CheckoutRequestID;
  if (!transactionStatus[checkoutId]) return res.sendStatus(404);

  let status = "pending";
  if (callbackData.ResultCode === 0) status = "success";
  else if (callbackData.ResultCode === 1) status = "cancelled";
  else status = "failed";

  transactionStatus[checkoutId] = {
    ...transactionStatus[checkoutId],
    status,
    resultCode: callbackData.ResultCode,
    resultDesc: callbackData.ResultDesc,
    callback: req.body,
  };

  broadcastTransactionUpdate(checkoutId, transactionStatus[checkoutId]);
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// ---------- Health check ----------
app.get("/", (req, res) => res.send("MPESA STK Sandbox Server running"));

// ---------- Error handling middleware ----------
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// ---------- Start server ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
