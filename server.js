import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("✅ Veriff API Live and running (Multi-document mode active)");
});

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
          vendorData: "0x.agency-client",
          person: {
            firstName: "Client",
            lastName: "Onboarding",
          },
          // document type omitted => Veriff shows all available types
          timestamp: new Date().toISOString(),
          redirect: `${process.env.FRONTEND_URL}?kyc=done`,
        },
      }),
    });

    const data = await response.json();

    if (response.ok && data.verification?.url) {
      console.log("✅ Veriff session created:", data.verification.id);
      res.json({ status: "success", verification: data.verification });
    } else {
      console.error("❌ Veriff API error:", data);
      res.status(400).json({ error: "Veriff API error", details: data });
    }
  } catch (error) {
    console.error("⚠️ Server error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

app.post("/callback", (req, res) => {
  console.log("📩 Veriff callback received:", req.body);
  res.status(200).send("OK");
});

app.get("/callback", (req, res) => {
  console.log("🔁 Redirecting to onboarding success page");
  res.redirect(`${process.env.FRONTEND_URL}?kyc=done`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Live URL: ${process.env.BASE_URL}`);
});
