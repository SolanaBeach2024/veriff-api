import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// ✅ Root route
app.get("/", (req, res) => {
  res.send("✅ Veriff API Live and running (with client_id passthrough)");
});

// ✅ Create Veriff Session
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
          // Custom data for internal matching
          vendorData: "0x.agency-client",
          person: {
            firstName: "Client",
            lastName: "Onboarding",
          },
          // The callback will redirect back to your onboarding page after verification
          callback: `${process.env.FRONTEND_URL}?kyc=done`,
          document: {
            type: "ID_CARD", // Allow ID, license, passport defaults
          },
        },
      }),
    });

    const data = await response.json();

    if (response.ok && data.verification?.url) {
      const sessionId = data.verification.id;

      // ✅ Append the Veriff session ID to callback and verification URL for reference
      const verificationUrl = `${data.verification.url}?client_id=${sessionId}`;

      console.log("✅ Veriff session created:", sessionId);

      res.json({
        status: "success",
        verification: {
          id: sessionId,
          url: verificationUrl,
          vendorData: data.verification.vendorData,
        },
      });
    } else {
      console.error("❌ Veriff API error:", data);
      res.status(400).json({ error: "Veriff API error", details: data });
    }
  } catch (error) {
    console.error("⚠️ Server error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
});

// ✅ Webhook callback receiver (optional Veriff event logs)
app.post("/callback", (req, res) => {
  console.log("📩 Veriff callback received:", req.body);
  res.status(200).send("OK");
});

// ✅ Redirect after verification completion
app.get("/callback", (req, res) => {
  console.log("🔁 Redirecting to onboarding success page");
  res.redirect(`${process.env.FRONTEND_URL}?kyc=done`);
});

// ✅ Server startup
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Live URL: ${process.env.BASE_URL}`);
});
