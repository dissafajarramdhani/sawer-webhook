// ============================================================
//   webhook-server.js
//   Server perantara: Saweria Webhook → Roblox Open Cloud
//
//   Setup:
//   1. npm install express axios crypto dotenv
//   2. Buat file .env (lihat bagian CONFIG di bawah)
//   3. node webhook-server.js
//
//   Deploy gratis: Railway / Render / Glitch
// ============================================================

require("dotenv").config();
const express = require("express");
const axios   = require("axios");
const crypto  = require("crypto");

const app  = express();
app.use(express.json());

// ============================================================
//   CONFIG — Isi di file .env kamu
//   SAWERIA_TOKEN    = token rahasia dari dashboard Saweria
//   ROBLOX_API_KEY   = API Key dari Roblox Creator Dashboard
//   ROBLOX_UNIVERSE  = Universe ID game kamu
//   ROBLOX_DATASTORE = nama DataStore (bebas, contoh: SaweriaDonations)
//   PORT             = port server (default 3000)
// ============================================================
const SAWERIA_TOKEN    = process.env.SAWERIA_TOKEN    || "TOKEN_SAWERIA_KAMU";
const ROBLOX_API_KEY   = process.env.ROBLOX_API_KEY   || "/eSDbTFvEkyLYnhgI2nFujLs3Shym9esF5Utr9t5yILpcWxHZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaGRXUWlPaUpTYjJKc2IzaEpiblJsY201aGJDSXNJbWx6Y3lJNklrTnNiM1ZrUVhWMGFHVnVkR2xqWVhScGIyNVRaWEoyYVdObElpd2lZbUZ6WlVGd2FVdGxlU0k2SWk5bFUwUmlWRVoyUld0NVRGbHVhR2RKTW01R2RXcE1jek5UYUhsdE9XVnpSalZWZEhJNWREVjVTVXh3WTFkNFNDSXNJbTkzYm1WeVNXUWlPaUl4TURRNE9EWXdPVEl4TWlJc0ltVjRjQ0k2TVRjM01UVXlOelk1Tml3aWFXRjBJam94TnpjeE5USTBNRGsyTENKdVltWWlPakUzTnpFMU1qUXdPVFo5LkNLa2ZnZEFvZmZ0T2Utd1lQU3JMR2xDRnVqS01DS09MSy1SckRmU0poZE95S1FhY1RkZ3RIcWFSTFFMVDRrVWVGNUdPMG9wQmRiUDJ5X2lrX3VqWjhSR0xWN05UalY3MER5S2JtalFMLWNMdVdneUVFVWZTQUVrVGd2dFM1OWM0Q2lvckdyLXp0WllMMTVxNGhXbVUyenZCRFRreU95TGJyejV0VXZ5VnVzd3NWYmF1d2hYNloyYU5YRldLZ1VNNXNqRkVielRxZFJPYkJ3Z0tyaGxneTJqalpTN011WE1remNEejJFTXpDZk13MUgyc2p3NUxHcTIwS19WX3FCcEFoZXFSbVVVWGRIMWtfVzVjTUZlT0NMb1FfS2xEd3pxM1M4TUptNmVfdjFuT1d1RHhEaHNVeEc0VFpQZEFZam55WDF3YmxOR2V0Vk50RTNEUFZGQVVtUQ==";
const ROBLOX_UNIVERSE  = process.env.ROBLOX_UNIVERSE  || "9758628300";
const ROBLOX_DATASTORE = process.env.ROBLOX_DATASTORE || "SaweriaDonations";
const PORT             = process.env.PORT             || 3000;

// ============================================================
//   VERIFIKASI SIGNATURE SAWERIA
//   Saweria mengirim header X-Saweria-Token
// ============================================================
function verifySaweriaToken(req) {
    const receivedToken = req.headers["x-saweria-token"];
    return receivedToken === SAWERIA_TOKEN;
}

// ============================================================
//   KIRIM DATA KE ROBLOX VIA MESSAGING SERVICE
//   Menggunakan Roblox Open Cloud Messaging API
// ============================================================
async function sendToRoblox(topic, data) {
    const url = `https://apis.roblox.com/messaging-service/v1/universes/${ROBLOX_UNIVERSE}/topics/${topic}`;
    try {
        const response = await axios.post(url, {
            message: JSON.stringify(data)
        }, {
            headers: {
                "x-api-key": ROBLOX_API_KEY,
                "Content-Type": "application/json"
            }
        });
        console.log(`[Roblox] Pesan terkirim ke topic '${topic}':`, response.status);
        return true;
    } catch (err) {
        console.error("[Roblox] Gagal kirim pesan:", err.response?.data || err.message);
        return false;
    }
}

// ============================================================
//   SIMPAN KE ROBLOX DATASTORE (untuk leaderboard)
//   Menggunakan Roblox Open Cloud DataStore API
// ============================================================
async function saveToDataStore(donorName, amount) {
    const key    = encodeURIComponent(donorName);
    const getUrl = `https://apis.roblox.com/datastores/v1/universes/${ROBLOX_UNIVERSE}/standard-datastores/datastore/entries/entry?datastoreName=${ROBLOX_DATASTORE}&entryKey=${key}`;

    let currentTotal = 0;

    // Ambil nilai lama dulu
    try {
        const getRes = await axios.get(getUrl, {
            headers: { "x-api-key": ROBLOX_API_KEY }
        });
        currentTotal = parseInt(getRes.data) || 0;
    } catch (_) {
        // Key belum ada, mulai dari 0
    }

    const newTotal   = currentTotal + amount;
    const newValue   = JSON.stringify(newTotal);
    const md5Hash    = crypto.createHash("md5").update(newValue).digest("base64");

    // Simpan nilai baru
    const setUrl = `https://apis.roblox.com/datastores/v1/universes/${ROBLOX_UNIVERSE}/standard-datastores/datastore/entries/entry?datastoreName=${ROBLOX_DATASTORE}&entryKey=${key}`;
    try {
        await axios.post(setUrl, newValue, {
            headers: {
                "x-api-key"      : ROBLOX_API_KEY,
                "Content-Type"   : "application/json",
                "content-md5"    : md5Hash
            }
        });
        console.log(`[DataStore] ${donorName} total donasi: Rp ${newTotal.toLocaleString("id-ID")}`);
    } catch (err) {
        console.error("[DataStore] Gagal simpan:", err.response?.data || err.message);
    }

    return newTotal;
}

// ============================================================
//   ENDPOINT WEBHOOK — Saweria akan POST ke sini
//   URL: https://domain-kamu.com/saweria-webhook
// ============================================================
app.post("/saweria-webhook", async (req, res) => {
    // Verifikasi token
    if (!verifySaweriaToken(req)) {
        console.warn("[Webhook] Token tidak valid! Request ditolak.");
        return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body;
    console.log("[Webhook] Data masuk dari Saweria:", JSON.stringify(body, null, 2));

    // Ekstrak data dari payload Saweria
    // Struktur payload Saweria: https://saweria.co/developers
    const donorName = body.donator_name  || "Anonim";
    const amount    = parseInt(body.amount_raw) || 0; // amount dalam Rupiah (tanpa desimal)
    const message   = body.message       || "";
    const type      = body.type          || "donation"; // donation / subscription / dll

    if (amount <= 0) {
        return res.status(200).json({ status: "ignored", reason: "amount 0" });
    }

    // 1. Kirim notifikasi real-time ke semua player via Messaging Service
    await sendToRoblox("SaweriaNotif", {
        donorName : donorName,
        amount    : amount,
        message   : message,
        type      : type,
        timestamp : Date.now()
    });

    // 2. Update leaderboard di DataStore
    const newTotal = await saveToDataStore(donorName, amount);

    // 3. Kirim update leaderboard ke semua player
    await sendToRoblox("SaweriaLeaderboard", {
        donorName : donorName,
        total     : newTotal
    });

    return res.status(200).json({ status: "ok", donor: donorName, amount });
});

// ============================================================
//   HEALTH CHECK
// ============================================================
app.get("/", (req, res) => {
    res.json({ status: "Saweria-Roblox Bridge berjalan!", time: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`\n🚀 Server berjalan di port ${PORT}`);
    console.log(`📡 Webhook URL: http://localhost:${PORT}/saweria-webhook\n`);
});
