import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// 🟢 Root health check
app.get("/", (req, res) => {
  res.send("✅ Veriff API Live and running");
});

// 🟣 Create Veriff session
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
          person: {
            firstName: "Client",
            lastName: "Onboarding",
          },
          vendorData: "0x.agency-client",
          document: {
            type: "PASSPORT", // required by Station API
          },
          timestamp: new Date().toISOString(),
        },
      }),
    });

    const data = await response.json();

    // 🧠 Debug logs for Render console
    console.log("📨 Veriff API Response:", JSON.stringify(data, null, 2));

    if (!response.ok || !data.verification?.id) {
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

// 🔵 Veriff callback route
app.post("/callback", async (req, res) => {
  console.log("📥 Received callback from Veriff:", JSON.stringify(req.body, null, 2));
  res.status(200).json({ message: "Callback received" });
});

// 🟢 Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Your service is live at: ${process.env.BASE_URL}`);
});
