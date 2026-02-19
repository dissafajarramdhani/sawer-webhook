// ============================================================
//   webhook-server.js
//   Server perantara: Saweria Webhook → Roblox Open Cloud
//
//   PENTING: Jangan hardcode API Key di sini!
//   Semua config diisi lewat Railway Variables / .env
// ============================================================

require("dotenv").config();
const express = require("express");
const axios   = require("axios");
const crypto  = require("crypto");

const app = express();
app.use(express.json());

// ============================================================
//   CONFIG — Diambil dari Railway Variables (JANGAN diubah!)
// ============================================================
const ROBLOX_API_KEY   = process.env.ROBLOX_API_KEY   || "/eSDbTFvEkyLYnhgI2nFujLs3Shym9esF5Utr9t5yILpcWxHZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaGRXUWlPaUpTYjJKc2IzaEpiblJsY201aGJDSXNJbWx6Y3lJNklrTnNiM1ZrUVhWMGFHVnVkR2xqWVhScGIyNVRaWEoyYVdObElpd2lZbUZ6WlVGd2FVdGxlU0k2SWk5bFUwUmlWRVoyUld0NVRGbHVhR2RKTW01R2RXcE1jek5UYUhsdE9XVnpSalZWZEhJNWREVjVTVXh3WTFkNFNDSXNJbTkzYm1WeVNXUWlPaUl4TURRNE9EWXdPVEl4TWlJc0ltVjRjQ0k2TVRjM01UVXlOelk1Tml3aWFXRjBJam94TnpjeE5USTBNRGsyTENKdVltWWlPakUzTnpFMU1qUXdPVFo5LkNLa2ZnZEFvZmZ0T2Utd1lQU3JMR2xDRnVqS01DS09MSy1SckRmU0poZE95S1FhY1RkZ3RIcWFSTFFMVDRrVWVGNUdPMG9wQmRiUDJ5X2lrX3VqWjhSR0xWN05UalY3MER5S2JtalFMLWNMdVdneUVFVWZTQUVrVGd2dFM1OWM0Q2lvckdyLXp0WllMMTVxNGhXbVUyenZCRFRreU95TGJyejV0VXZ5VnVzd3NWYmF1d2hYNloyYU5YRldLZ1VNNXNqRkVielRxZFJPYkJ3Z0tyaGxneTJqalpTN011WE1remNEejJFTXpDZk13MUgyc2p3NUxHcTIwS19WX3FCcEFoZXFSbVVVWGRIMWtfVzVjTUZlT0NMb1FfS2xEd3pxM1M4TUptNmVfdjFuT1d1RHhEaHNVeEc0VFpQZEFZam55WDF3YmxOR2V0Vk50RTNEUFZGQVVtUQ==";
const ROBLOX_UNIVERSE  = process.env.ROBLOX_UNIVERSE  || "9758628300";
const ROBLOX_DATASTORE = process.env.ROBLOX_DATASTORE || "SaweriaDonations";
const PORT             = process.env.PORT             || 3000;

// ============================================================
//   KIRIM NOTIFIKASI KE ROBLOX VIA MESSAGING SERVICE
// ============================================================
async function sendToRoblox(topic, data) {
    const url = `https://apis.roblox.com/messaging-service/v1/universes/${ROBLOX_UNIVERSE}/topics/${topic}`;
    try {
        const response = await axios.post(url, {
            message: JSON.stringify(data)
        }, {
            headers: {
                "x-api-key"   : ROBLOX_API_KEY,
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
// ============================================================
async function saveToDataStore(donorName, amount) {
    const key    = encodeURIComponent(donorName);
    const getUrl = `https://apis.roblox.com/datastores/v1/universes/${ROBLOX_UNIVERSE}/standard-datastores/datastore/entries/entry?datastoreName=${ROBLOX_DATASTORE}&entryKey=${key}`;

    let currentTotal = 0;

    try {
        const getRes = await axios.get(getUrl, {
            headers: { "x-api-key": ROBLOX_API_KEY }
        });
        currentTotal = parseInt(getRes.data) || 0;
    } catch (_) {
        // Key belum ada, mulai dari 0
    }

    const newTotal = currentTotal + amount;
    const newValue = JSON.stringify(newTotal);
    const md5Hash  = crypto.createHash("md5").update(newValue).digest("base64");

    const setUrl = `https://apis.roblox.com/datastores/v1/universes/${ROBLOX_UNIVERSE}/standard-datastores/datastore/entries/entry?datastoreName=${ROBLOX_DATASTORE}&entryKey=${key}`;
    try {
        await axios.post(setUrl, newValue, {
            headers: {
                "x-api-key"    : ROBLOX_API_KEY,
                "Content-Type" : "application/json",
                "content-md5"  : md5Hash
            }
        });
        console.log(`[DataStore] ${donorName} total: Rp ${newTotal.toLocaleString("id-ID")}`);
    } catch (err) {
        console.error("[DataStore] Gagal simpan:", err.response?.data || err.message);
    }

    return newTotal;
}

// ============================================================
//   ENDPOINT WEBHOOK — Saweria POST ke sini
//   Tidak ada verifikasi token karena Saweria tidak support
// ============================================================
app.post("/saweria-webhook", async (req, res) => {
    console.log("[Webhook] Request masuk:", JSON.stringify(req.body, null, 2));

    const body = req.body;

    const donorName = body.donator_name        || "Anonim";
    const amount    = parseInt(body.amount_raw) || 0;
    const message   = body.message             || "";
    const type      = body.type                || "donation";

    console.log(`[Webhook] Donasi dari ${donorName}: Rp ${amount} | Pesan: ${message}`);

    if (amount <= 0) {
        return res.status(200).json({ status: "ignored", reason: "amount 0" });
    }

    // 1. Kirim notifikasi real-time ke semua player
    await sendToRoblox("SaweriaNotif", {
        donorName : donorName,
        amount    : amount,
        message   : message,
        type      : type,
        timestamp : Date.now()
    });

    // 2. Update leaderboard di DataStore
    const newTotal = await saveToDataStore(donorName, amount);

    // 3. Broadcast update leaderboard ke semua player
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
    res.json({
        status  : "Saweria-Roblox Bridge aktif!",
        time    : new Date().toISOString(),
        universe: ROBLOX_UNIVERSE || "belum diset"
    });
});

app.listen(PORT, () => {
    console.log(`\n🚀 Server berjalan di port ${PORT}`);
    console.log(`📡 Webhook: http://localhost:${PORT}/saweria-webhook\n`);
});
