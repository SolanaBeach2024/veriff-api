import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Root check
app.get("/", (req, res) => {
  res.send("✅ Veriff API Live and running");
});

// -----------------------------------------
// 🔹 CREATE VERIFF SESSION
// -----------------------------------------
app.post("/api/create-session", async (req, res) => {
  try {
    const response = await fetch("https://stationapi.veriff.com/v1/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AUTH-CLIENT": process.env.VERIFF_API_KEY,
      },
      body: JSON.stringify({
        verification: {
          callback: `${process.env.BASE_URL}/callback`,
          person: { givenName: "Client" },
          vendorData: "0x.agency-client",
          timestamp: new Date().toISOString(),
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Veriff session creation failed:", data);
      return res.status(500).json({ error: "Veriff API error", details: data });
    }

    console.log("✅ Veriff Session Created:", data.verification.id);
    res.json({ status: "success", verification: data.verification });
  } catch (error) {
    console.error("⚠️ Veriff Session Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// -----------------------------------------
// 🔹 CHECK KYC STATUS
// -----------------------------------------
app.get("/api/status/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const response = await fetch(`https://stationapi.veriff.com/v1/sessions/${id}`, {
      headers: { "X-AUTH-CLIENT": process.env.VERIFF_API_KEY },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Veriff Status Fetch Failed:", data);
      return res.status(500).json({ error: "Veriff status check failed", details: data });
    }

    const status = data.verification?.status || "pending";
    console.log(`📡 Status for ${id}: ${status}`);
    res.json({ status });
  } catch (error) {
    console.error("⚠️ Status check error:", error);
    res.status(500).json({ status: "error" });
  }
});

// -----------------------------------------
// 🔹 CALLBACK HANDLER (Veriff POST callback)
// -----------------------------------------
app.post("/callback", express.json(), (req, res) => {
  console.log("📩 Callback from Veriff Station:", req.body);

  const verification = req.body?.verification || {};
  const status = verification.status || req.body.status || "unknown";

  console.log(`🧾 Callback Status: ${status} | ID: ${verification.id || "N/A"}`);

  // ✅ Log successful verification
  if (status === "approved") {
    console.log("✅ KYC Approved for:", verification.id);
  } else {
    console.log("ℹ️ KYC Update:", status);
  }

  res.sendStatus(200);
});

// -----------------------------------------
// 🔹 START SERVER
// -----------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Base URL: ${process.env.BASE_URL}`);
  console.log(`✅ Your service is live`);
});
