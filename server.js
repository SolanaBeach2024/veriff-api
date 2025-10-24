// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import basicAuth from "express-basic-auth";

dotenv.config();

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(cors({
  origin: ["https://0x.agency", process.env.FRONTEND_URL].filter(Boolean),
  credentials: false,
}));

// ---------- Database Setup ----------
const dataDir = path.resolve("./data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

let db;
async function initDB() {
  db = await open({
    filename: path.join(dataDir, "clients.db"),
    driver: sqlite3.Database,
  });

  await db.exec(`
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
}
await initDB();

// ---------- Routes ----------

// Test route
app.get("/", (req, res) => {
  res.send("✅ Veriff API + Admin Dashboard (sqlite3 version) Live");
});

// Save client info
app.post("/api/clients", async (req, res) => {
  try {
    const {
      kycId, fullname, email, company, website, projectType, description,
      timestamp_iso, ip, timezone, user_agent,
    } = req.body || {};

    if (!kycId || !fullname || !email)
      return res.status(400).json({ error: "Missing required fields" });

    await db.run(
      `INSERT OR IGNORE INTO clients 
       (kycId, fullname, email, company, website, projectType, description, status, createdAt, ip, timezone, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [kycId, fullname, email, company, website, projectType, description,
       timestamp_iso || new Date().toISOString(), ip || null, timezone || null, user_agent || null]
    );

    res.json({ status: "ok" });
  } catch (err) {
    console.error("❌ /api/clients:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// Create Veriff session
app.post("/api/create-session", async (req, res) => {
  try {
    const { kycId } = req.body || {};
    if (!kycId) return res.status(400).json({ error: "Missing kycId" });

    const response = await fetch("https://stationapi.veriff.com/v1/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AUTH-CLIENT": process.env.VERIFF_API_KEY,
      },
      body: JSON.stringify({
        verification: {
          vendorData: kycId,
          person: { firstName: "Client", lastName: "Onboarding" },
          document: { type: "ID_CARD" },
          callback: `${process.env.BASE_URL}/callback`,
        },
      }),
    });

    const data = await response.json();

    if (response.ok && data.verification?.url) {
      await db.run(
        `UPDATE clients SET veriff_session_id=? WHERE kycId=?`,
        [data.verification.id, kycId]
      );
      return res.json({
        status: "success",
        verification: {
          id: data.verification.id,
          url: data.verification.url,
          vendorData: kycId,
        },
      });
    } else {
      console.error("❌ Veriff error:", data);
      return res.status(400).json({ error: "Veriff API error", details: data });
    }
  } catch (err) {
    console.error("⚠️ /api/create-session:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// Callback (webhook)
app.post("/callback", async (req, res) => {
  try {
    const vendorData = req.body?.vendorData || req.body?.verification?.vendorData;
    const status = req.body?.status || req.body?.verification?.status;

    if (vendorData && status?.toLowerCase() === "approved") {
      await db.run(
        `UPDATE clients SET status='verified', verifiedAt=? WHERE kycId=?`,
        [new Date().toISOString(), vendorData]
      );
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Callback error:", err);
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

// ---------- Admin Dashboard ----------

const adminUser = process.env.ADMIN_USER || "admin";
const adminPass = process.env.ADMIN_PASS || "password";

const adminAuth = basicAuth({
  users: { [adminUser]: adminPass },
  challenge: true,
  realm: "0xAgencyAdmin",
});

app.get("/admin", adminAuth, (_req, res) => {
  res.sendFile(path.join(process.cwd(), "admin.html"));
});

app.get("/api/admin/clients", adminAuth, async (req, res) => {
  const status = req.query.status || null;
  const q = req.query.q || null;

  let sql = "SELECT * FROM clients WHERE 1=1";
  const params = [];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (q) {
    sql += " AND (kycId LIKE ? OR fullname LIKE ? OR email LIKE ? OR company LIKE ?)";
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  sql += " ORDER BY createdAt DESC";
  const rows = await db.all(sql, params);
  res.json({ items: rows });
});

// ---------- Start ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 ${process.env.BASE_URL}`);
  console.log(`🔐 Admin login: ${adminUser} / ${adminPass}`);
});
