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

console.log("✅ Veriff Station API Starting...");
console.log("Base URL:", BASE_URL);
console.log("Frontend URL:", FRONTEND_URL);
console.log("Port:", PORT);

// ---------- CREATE SESSION ----------
app.post("/api/create-session", async (req, res) => {
  console.log("➡️ KYC Session Request Received...");

  const payload = {
    verification: {
      callback: `${BASE_URL}/callback`,
      vendorData: "0xAgency"
    }
  };

  try {
    const response = await fetch("https://stationapi.veriff.com/v1/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AUTH-CLIENT": VERIFF_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok && data.verification?.url) {
      console.log("✅ Veriff Station session created successfully");
      return res.json({ status: "success", verification: data.verification });
    } else {
      console.error("⚠️ Veriff Station API response error:", data);
      return res.status(500).json({
        status: "error",
        message: data.message || "Unexpected response from Veriff Station API"
      });
    }
  } catch (err) {
    console.error("❌ Veriff Station API request failed:", err.message);
    return res.status(500).json({
      status: "error",
      message: "Error connecting to Veriff Station API"
    });
  }
});

// ---------- HEALTH CHECK ----------
app.get("/", (req, res) => {
  res.send("✅ Veriff Station API Live and Running");
});

// ---------- CALLBACK ENDPOINT ----------
app.post("/callback", (req, res) => {
  console.log("📩 Callback from Veriff Station:", req.body);
  res.sendStatus(200);
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
  console.log("🌍 Your service is live at:", BASE_URL);
  console.log("//////////////////////////////////////////////////////");
});
