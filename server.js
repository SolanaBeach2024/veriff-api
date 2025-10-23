import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// Create new Veriff session
app.post("/api/create-session", async (req, res) => {
  try {
    const veriffRes = await fetch("https://api.veriff.com/v1/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AUTH-CLIENT": process.env.VERIFF_API_KEY
      },
      body: JSON.stringify({
        verification: {
          callback: `${process.env.BASE_URL}/api/callback`,
          vendorData: "0xAgency",
          person: {
            firstName: req.body.fullName || "Client",
            lastName: "Onboarding"
          },
          document: { type: "PASSPORT" },
          redirectUrl: `${process.env.FRONTEND_URL}?id={sessionId}`
        }
      })
    });

    const data = await veriffRes.json();
    res.json(data);
  } catch (error) {
    console.error("❌ Veriff Session Error:", error);
    res.status(500).json({ status: "error", message: "Failed to create session" });
  }
});

// Check session status by ID
app.get("/api/check-session", async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing session ID" });

  try {
    const response = await fetch(`https://api.veriff.com/v1/sessions/${id}`, {
      headers: { "X-AUTH-CLIENT": process.env.VERIFF_API_KEY }
    });
    const data = await response.json();
    const status = data?.session?.status || "unknown";
    res.json({ status });
  } catch (error) {
    console.error("❌ Veriff Check Error:", error);
    res.status(500).json({ status: "error", message: "Failed to check KYC status" });
  }
});

// Basic route
app.get("/", (req, res) => {
  res.send("✅ Veriff API Server Live and Running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
