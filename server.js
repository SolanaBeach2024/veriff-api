import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 10000;
const VERIFF_API_KEY = process.env.VERIFF_API_KEY;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://0x.agency/onboarding.html";

console.log("✅ Veriff API Service Starting...");
console.log("Base URL:", BASE_URL);
console.log("Frontend URL:", FRONTEND_URL);
console.log("Port:", PORT);

// ---------- CREATE SESSION ----------
app.post("/api/create-session", async (req, res) => {
  console.log("➡️ KYC Session Request Received...");

  const payload = {
    vendorData: "0xAgency",
    verification: {
      callback: `${BASE_URL}/callback`
    }
  };

  // Try global first, then EU fallback
  const endpoints = [
    "https://api.veriff.com/v1/sessions",
    "https://api.eu.veriff.com/v1/sessions",
    "https://sandbox.veriff.me/v1/sessions"
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AUTH-CLIENT": VERIFF_API_KEY
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.verification?.url) {
        console.log(`✅ Veriff session created successfully via ${endpoint}`);
        return res.json({ status: "success", verification: data.verification });
      } else {
        console.warn(`⚠️ Veriff response not OK from ${endpoint}:`, data);
      }
    } catch (err) {
      console.error(`❌ Veriff Session Error via ${endpoint}:`, err.message);
    }
  }

  res.status(500).json({
    status: "error",
    message: "Failed to create Veriff session. Check logs for details."
  });
});

// ---------- HEALTH CHECK ----------
app.get("/", (req, res) => {
  res.send("✅ Veriff API Live and Running");
});

// ---------- CALLBACK ENDPOINT (Optional) ----------
app.post("/callback", async (req, res) => {
  console.log("📩 Veriff Callback Received:", req.body);
  res.sendStatus(200);
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
  console.log("🌍 Your service is live at:", BASE_URL);
  console.log("//////////////////////////////////////////////////////");
});
