// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import basicAuth from "express-basic-auth";

dotenv.config();

const app = express();

// Ensure /data directory for SQLite
const dataDir = path.resolve("./data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// Initialize SQLite
const db = new Database(path.join(dataDir, "clients.db"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kycId TEXT UNIQUE,
  fullname TEXT,
  email TEXT,
  company TEXT,
  website TEXT,
  projectType TEXT,
  description TEXT,
  status TEXT CHECK(status IN ('pending','verified')) DEFAULT 'pending',
  veriff_session_id TEXT,
  createdAt TEXT,
  verifiedAt TEXT,
  ip TEXT,
  timezone TEXT,
  user_agent TEXT
);
`);

// Prepared queries
const insertClient = db.prepare(`
  INSERT OR IGNORE INTO clients
  (kycId, fullname, email, company, website, projectType, description, status, createdAt, ip, timezone, user_agent)
  VALUES (@kycId, @fullname, @email, @company, @website, @projectType, @description, @status, @createdAt, @ip, @timezone, @user_agent)
`);

const updateSessionForKyc = db.prepare(`
  UPDATE clients SET veriff_session_id=@sessionId WHERE kycId=@kycId
`);

const markVerifiedByVendor = db.prepare(`
  UPDATE clients
  SET status='verified', verifiedAt=@verifiedAt
  WHERE kycId=@kycId
`);

const listClients = db.prepare(`
  SELECT * FROM clients
  WHERE (@status IS NULL OR status=@status)
    AND (
      @q IS NULL
      OR kycId LIKE '%' || @q || '%'
      OR fullname LIKE '%' || @q || '%'
      OR email LIKE '%' || @q || '%'
      OR company LIKE '%' || @q || '%'
    )
  ORDER BY createdAt DESC
`);

// Middleware
app.use(express.json({ type: "*/*", limit: "2mb" }));
app.use(cors({
  origin: [
    "https://0x.agency",
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: false
}));

/* ---------------------------
   API ROUTES
--------------------------- */

// Test route
app.get("/", (_req, res) => {
  res.send("✅ Veriff API + Admin Dashboard Live");
});

// Save new client (Step 1)
app.post("/api/clients", (req, res) => {
  try {
    const {
      kycId, fullname, email, company, website, projectType, description,
      timestamp_iso, ip, timezone, user_agent
    } = req.body || {};

    if (!kycId || !fullname || !email) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    insertClient.run({
      kycId, fullname, email, company: company || "", website: website || "",
      projectType: projectType || "", description: description || "",
      status: "pending",
      createdAt: timestamp_iso || new Date().toISOString(),
      ip: ip || null, timezone: timezone || null, user_agent: user_agent || null
    });

    return res.json({ status: "ok" });
  } catch (e) {
    console.error("❌ /api/clients:", e);
    res.status(500).json({ error: "Internal error" });
  }
});

// Create Veriff session (Step 2)
app.post("/api/create-session", async (req, res) => {
  try {
    const { kycId } = req.body || {};
    if (!kycId) return res.status(400).json({ error: "Missing kycId" });

    const response = await fetch("https://stationapi.veriff.com/v1/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AUTH-CLIENT": process.env.VERIFF_API_KEY
      },
      body: JSON.stringify({
        verification: {
          vendorData: kycId,
          person: { firstName: "Client", lastName: "Onboarding" },
          document: { type: "ID_CARD" },
          callback: `${process.env.BASE_URL}/callback`
        }
      })
    });

    const data = await response.json();

    if (response.ok && data.verification?.url) {
      const sessionId = data.verification.id;
      updateSessionForKyc.run({ sessionId, kycId });
      return res.json({
        status: "success",
        verification: { id: sessionId, url: data.verification.url, vendorData: kycId }
      });
    } else {
      console.error("❌ Veriff error:", data);
      return res.status(400).json({ error: "Veriff API error", details: data });
    }
  } catch (e) {
    console.error("⚠️ /api/create-session:", e);
    res.status(500).json({ error: "Internal server error", details: e.message });
  }
});

// Veriff callback (server webhook)
app.post("/callback", (req, res) => {
  try {
    const vendorData = req.body?.vendorData || req.body?.verification?.vendorData;
    const status = req.body?.status || req.body?.verification?.status;

    if (vendorData && status?.toLowerCase() === "approved") {
      markVerifiedByVendor.run({ kycId: vendorData, verifiedAt: new Date().toISOString() });
    }

    res.status(200).send("OK");
  } catch (e) {
    console.error("❌ Callback error:", e);
    res.status(200).send("OK");
  }
});

// Redirect after verification
app.get("/callback", (req, res) => {
  const clientId = req.query?.client_id || "";
  const front = new URL(process.env.FRONTEND_URL);
  front.searchParams.set("kyc", "done");
  if (clientId) front.searchParams.set("client_id", clientId);
  res.redirect(front.toString());
});

/* ---------------------------
   ADMIN DASHBOARD
--------------------------- */

const adminUser = process.env.ADMIN_USER || "0xAgency25";
const adminPass = process.env.ADMIN_PASS || "LetsDoThis0x2525@$@$";

const adminAuth = basicAuth({
  users: { [adminUser]: adminPass },
  challenge: true,
  realm: "0xAgencyAdmin"
});

// Serve admin.html (protected)
app.get("/admin", adminAuth, (_req, res) => {
  res.sendFile(path.join(process.cwd(), "admin.html"));
});

// Admin API for dashboard
app.get("/api/admin/clients", adminAuth, (req, res) => {
  const status = req.query.status || null;
  const q = req.query.q || null;
  const rows = listClients.all({ status, q });
  res.json({ items: rows });
});

/* ---------------------------
   Start server
--------------------------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 ${process.env.BASE_URL}`);
  console.log(`🔐 Admin login: ${adminUser} / ${adminPass}`);
});
