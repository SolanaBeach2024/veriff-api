import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

app.post("/api/create-session", async (req, res) => {
  try {
    const response = await fetch("https://stationapi.veriff.com/v1/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AUTH-CLIENT": process.env.VERIFF_API_KEY
      },
      body: JSON.stringify({
        verification: {
          vendorData: "0xAgency",
          callback: "https://0x.agency/onboarding.html?kyc=done"
        }
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Veriff API Error:", err);
    res.status(500).json({ error: "Failed to create session" });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Veriff API live and running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server started on port ${PORT}`));
