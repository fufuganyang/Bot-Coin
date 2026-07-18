/*
 * ============================================================
 *  COIN SCRIPT BOT — ALL-IN-ONE VERSION (v3)
 *  Fitur:
 *    ✅ Sistem Coin & Script
 *    ✅ AnimeLovers VIP Activator (1bulan, 3bulan, 1tahun)
 *    ✅ Alight Motion Premium Activator (via API Key)
 *    ✅ Obfuscate JavaScript (NEW /enc via file upload, extra-protected)
 *    ✅ Force Join Channel/Grup
 *    ✅ Admin Chat (dua arah)
 *    ✅ Owner Dashboard
 *    ✅ Auto-install dependency
 * ============================================================
 */

// ============================================================
// AUTO-INSTALL DEPENDENCIES
// ============================================================
(function autoInstallDependencies() {
  const { execSync } = require("child_process");
  const path = require("path");
  const fs = require("fs");

  const requiredPackages = [
    "node-telegram-bot-api",
    "fs-extra",
    "dotenv",
    "javascript-obfuscator",
  ];

  const missing = [];
  for (const pkg of requiredPackages) {
    try {
      require.resolve(pkg);
    } catch (_) {
      missing.push(pkg);
    }
  }

  if (missing.length === 0) return;

  console.log("📦 Beberapa dependency belum terinstall:");
  missing.forEach((pkg) => console.log(`   ❌ ${pkg}`));
  console.log("🔄 Menjalankan npm install ...");

  try {
    const cwd = path.resolve(__dirname);
    execSync("npm install", { cwd, stdio: "inherit" });
  } catch (err) {
    console.error("❌ Gagal menjalankan npm install:", err.message);
    process.exit(1);
  }

  const stillMissing = [];
  for (const pkg of requiredPackages) {
    try {
      require.resolve(pkg);
    } catch (_) {
      stillMissing.push(pkg);
    }
  }

  if (stillMissing.length > 0) {
    console.error("❌ Masih ada dependency yang hilang:");
    stillMissing.forEach((pkg) => console.error(`   ❌ ${pkg}`));
    console.error("Silakan install secara manual: npm install");
    process.exit(1);
  }

  console.log("✅ Semua dependency terinstall dengan baik.");
})();
// ============================================================

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const JavaScriptObfuscator = require('javascript-obfuscator');
require('dotenv').config();

// ============================================================
//  KONFIGURASI & DATABASE
// ============================================================
const bot = new TelegramBot(config.botToken, { polling: true });

// === PATCH: Abaikan error "message is not modified" ===
const originalEditMessageCaption = bot.editMessageCaption.bind(bot);
bot.editMessageCaption = function(caption, options) {
  return originalEditMessageCaption(caption, options).catch((err) => {
    if (err.response?.statusCode === 400 && err.response?.body?.description?.includes('message is not modified')) {
      return;
    }
    throw err;
  });
};

const originalEditMessageText = bot.editMessageText.bind(bot);
bot.editMessageText = function(text, options) {
  return originalEditMessageText(text, options).catch((err) => {
    if (err.response?.statusCode === 400 && err.response?.body?.description?.includes('message is not modified')) {
      return;
    }
    throw err;
  });
};
// ============================================================

const dbFile = config.dbFile || './database.json';
const TMP_DIR = config.tmpDir || './tmp';
const BOT_START_TIME = Date.now();
const MAX_FILE_SIZE = config.maxFileSize || 5 * 1024 * 1024;
const COPYRIGHT = "\n\n© 2026 @jsobfuscator | @polsekjaktim";

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

let db = { users: {}, scripts: [], redeemCodes: {}, alightSessions: {}, maintenance: false, usedEmails: {} };

async function loadDB() {
  try {
    if (await fs.pathExists(dbFile)) {
      const data = await fs.readFile(dbFile, 'utf8');
      if (data.trim().length > 0) {
        const parsed = JSON.parse(data);
        db.users = parsed.users || {};
        db.scripts = parsed.scripts || [];
        db.redeemCodes = parsed.redeemCodes || {};
        db.alightSessions = parsed.alightSessions || {};
        db.maintenance = parsed.maintenance || false;
        db.usedEmails = parsed.usedEmails || {};

        Object.keys(db.users).forEach(id => {
          const u = db.users[id];
          if (u.coin === null || u.coin === undefined) u.coin = 0;
          if (u.lastClaim === undefined) u.lastClaim = 0;
          if (u.isBanned === undefined) u.isBanned = false;
          if (u.isVip === undefined) u.isVip = false;
          if (u.misiSelesai === undefined) u.misiSelesai = false;
          if (u.registered === undefined) u.registered = false;
          if (u.alightApiKey === undefined) u.alightApiKey = null;
          if (u.lastAnimeloversVipUse === undefined) u.lastAnimeloversVipUse = 0;
          if (u.vip === undefined) u.vip = false;
          if (u.refCount === undefined) u.refCount = 0;
          if (u.referredBy === undefined) u.referredBy = null;
          if (u.joinedAt === undefined) u.joinedAt = Date.now();
          if (u.awaitingAdminMessage === undefined) u.awaitingAdminMessage = false;
        });
      }
    } else {
      await saveDB();
    }
    console.log("✅ Database Berhasil Dimuat & Diperbaiki");
  } catch (err) {
    console.error("❌ Gagal load database:", err);
    db = { users: {}, scripts: [], redeemCodes: {}, alightSessions: {}, maintenance: false, usedEmails: {} };
  }
}

async function saveDB() {
  try {
    await fs.writeJson(dbFile, db, { spaces: 2 });
  } catch (err) {
    console.error("❌ Gagal simpan database:", err);
  }
}

loadDB();

let ownerState = {};
let encState = {}; // State untuk listener document per user

// ============================================================
//  HELPER FUNCTIONS
// ============================================================
function isOwner(userId) {
  const id = String(userId);
  return config.ownerIds.includes(id) || Number(id) === config.ownerId;
}

function getUser(userId) {
  const id = String(userId);
  if (!db.users[id]) {
    db.users[id] = {
      coin: 0,
      registered: false,
      joined: false,
      refCount: 0,
      referredBy: null,
      joinedAt: Date.now(),
      lastClaim: 0,
      isBanned: false,
      isVip: false,
      vip: false,
      lastAnimeloversVipUse: 0,
      alightApiKey: null,
      misiSelesai: false,
      awaitingAdminMessage: false,
      nama: null,
      password: null,
    };
    saveDB();
  }
  return db.users[id];
}

function getAlightSession(userId) {
  const id = String(userId);
  if (!db.alightSessions[id]) {
    db.alightSessions[id] = { step: null, email: null, link: null };
    saveDB();
  }
  return db.alightSessions[id];
}

function clearAlightSession(userId) {
  const id = String(userId);
  if (db.alightSessions[id]) {
    delete db.alightSessions[id];
    saveDB();
  }
}

function totalUsers() {
  return Object.keys(db.users || {}).length;
}

function formatUptime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const hari = Math.floor(totalSec / 86400);
  const jam = Math.floor((totalSec % 86400) / 3600);
  const menit = Math.floor((totalSec % 3600) / 60);
  const detik = totalSec % 60;
  const parts = [];
  if (hari > 0) parts.push(`${hari} hari`);
  if (jam > 0) parts.push(`${jam} jam`);
  if (menit > 0) parts.push(`${menit} menit`);
  parts.push(`${detik} detik`);
  return parts.join(" ");
}

function vipDate(epoch) {
  if (!epoch || epoch === 0) return "-";
  return new Date(epoch * 1000).toLocaleString("id-ID");
}

async function checkJoin(userId) {
  try {
    const allChats = [...config.channels, config.group];
    for (let chat of allChats) {
      if (!chat) continue;
      const member = await bot.getChatMember(chat, userId);
      if (['left', 'kicked', 'restricted'].includes(member.status)) return false;
    }
    return true;
  } catch (e) { return false; }
}

async function sendErrorToOwner(error, context) {
  const ownerId = config.ownerId;
  if (!ownerId) return;
  const msg = `🚨 *ERROR BOT DETEKSI!*\n\n` +
    `📌 *Context:* ${context || 'Unknown'}\n` +
    `❌ *Error:* ${error.message || error}\n` +
    `📅 *Time:* ${new Date().toISOString()}\n\n` +
    `\`\`\`\n${error.stack || 'No stack trace'}\n\`\`\``;
  try {
    await bot.sendMessage(ownerId, msg, { parse_mode: 'Markdown' });
  } catch (e) { console.error('Gagal kirim error ke owner:', e); }
}

// === Helper: Periksa saldo koin ===
function checkCoins(userId, required, customMessage = null) {
  const user = getUser(userId);
  const balance = user.coin || 0;
  if (balance < required) {
    const defaultMsg = `❌ Saldo koin kamu tidak cukup! (Butuh ${required.toLocaleString()}, saldo: ${balance.toLocaleString()})\n\n💡 Kumpulkan koin dengan:\n• Klaim harian (/start → 🎁 Klaim Harian)\n• Ajak teman (Referral)\n• Selesaikan Misi Coin\n• Tebak Angka / Lucky Spin`;
    return { success: false, message: customMessage || defaultMsg };
  }
  return { success: true };
}

// ============================================================
//  ANIMELOVERS VIP API HELPERS
// ============================================================
const AL_HEADERS = config.animeloversApiHeaders || {
  "Content-Type": "text/plain; charset=utf-8",
  "Accept": "application/json"
};
const AL_NAME = config.animeloversName || "wibu";
const AL_PROFILE = config.animeloversProfile || "https://lh3.googleusercontent.com/a/ACg8ocIk6mQVP02KEycB9_MYhhtyiN8eyDaz_N3dp3OwwIDN30ri0XYS=s288-c-no";

async function animeloversLogin(email) {
  const payload = { user: AL_NAME, email, profil: AL_PROFILE };
  const res = await fetch("https://apps.animekita.org/api/v1.1.6/model/login.php", {
    method: "POST",
    headers: AL_HEADERS,
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!json.data || !json.data[0]) throw new Error("Login gagal atau data tidak ditemukan.");
  return json.data[0].token;
}

async function animeloversGetData(token) {
  const res = await fetch("https://apps.animekita.org/api/v1.1.6/model/app-config.php", {
    method: "POST",
    headers: AL_HEADERS,
    body: JSON.stringify({ token })
  });
  const json = await res.json();
  if (!json.data || !json.data[0]) throw new Error("Data user kosong");
  return json.data[0];
}

async function animeloversSetPremium(token, vipCode) {
  const body = new URLSearchParams({ token, vip: vipCode });
  const res = await fetch("https://apps.animekita.org/api/v1.1.6/model/vip.php", {
    method: "POST",
    headers: AL_HEADERS,
    body
  });
  const json = await res.json();
  if (json.status !== "success" && json.status !== 1) throw new Error("Gagal aktivasi VIP.");
  return json;
}

function formatAnimeloversStatus(data, title = "") {
  let lines = [];
  lines.push(`╭───〔 📊 ${title.toUpperCase()} 〕───╮`);
  lines.push(`│`);
  lines.push(`│ • *Level:* ${data.level}`);
  lines.push(`│ • *Rank:* ${data.rank}`);
  lines.push(`│ • *VIP:* ${data.vipLevel}`);
  lines.push(`│ • *Expired:* ${vipDate(data.vipExp)}`);
  lines.push(`│`);
  lines.push(`╰────────────────────────────────────╯`);
  return lines.join("\n");
}

// ============================================================
//  ALIGHT MOTION API HELPERS
// ============================================================
const ALIGHT_API_BASE = config.alightApiBase || "https://am-prem.vxz.my.id";
const ALIGHT_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'AlightMotion-API-Client/1.0 (TelegramBot)',
  'X-Requested-With': 'XMLHttpRequest',
  'Origin': ALIGHT_API_BASE,
  'Referer': ALIGHT_API_BASE + '/',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

function generatePermanentCaptchaToken() {
  return 'BYPASS_UEVSTUFORU5UX1RPS0VOX1dJVEhfQVBJX0tFWQ==';
}

async function fetchWithRetry(url, options, retries = 2, timeoutMs = 30000) {
  let lastError;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if ((res.status === 429 || res.status >= 500) && attempt <= retries) {
        const waitMs = 2000 * attempt;
        console.log(`[Retry] Attempt ${attempt}/${retries+1} got status ${res.status}, waiting ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        lastError = new Error(`Request timeout after ${timeoutMs}ms`);
      } else {
        lastError = err;
      }
      if (attempt <= retries) {
        console.log(`[Retry] Attempt ${attempt}/${retries+1} failed: ${err.message}, retrying...`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError;
}

async function alightSend(email, apiKey) {
  const url = `${ALIGHT_API_BASE}/api/send`;
  const params = new URLSearchParams({
    email,
    apikey: apiKey,
    captchaToken: generatePermanentCaptchaToken()
  });
  try {
    const res = await fetchWithRetry(`${url}?${params}`, {
      method: "GET",
      headers: ALIGHT_HEADERS
    }, 2, 30000);

    const status = res.status;
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      return {
        success: false,
        message: `Server mengembalikan HTML/teks (HTTP ${status})`,
        raw: text.slice(0, 200),
        status
      };
    }

    if (status !== 200) {
      return {
        success: false,
        message: json.message || json.error || `HTTP ${status}`,
        status,
        raw: json
      };
    }

    const success = json.success === true || json.status === "success" || json.status === 1;
    return {
      success,
      message: json.message || json.error || json.msg || (success ? "OK" : "Gagal"),
      data: json,
      status
    };
  } catch (e) {
    return {
      success: false,
      message: `Gagal terhubung ke server: ${e.message}`
    };
  }
}

async function alightVerify(email, link, apiKey) {
  const url = `${ALIGHT_API_BASE}/api/verify`;
  const params = new URLSearchParams({
    email,
    link,
    apply: "true",
    apikey: apiKey,
    captchaToken: generatePermanentCaptchaToken()
  });
  try {
    const res = await fetchWithRetry(`${url}?${params}`, {
      method: "GET",
      headers: ALIGHT_HEADERS
    }, 2, 30000);

    const status = res.status;
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      return {
        success: false,
        message: `Server mengembalikan HTML/teks (HTTP ${status})`,
        raw: text.slice(0, 200),
        status
      };
    }

    if (status !== 200) {
      return {
        success: false,
        message: json.message || json.error || `HTTP ${status}`,
        status,
        raw: json
      };
    }

    const success = json.success === true || json.status === "success" || json.status === 1;
    return {
      success,
      message: json.message || json.error || json.msg || (success ? "OK" : "Gagal"),
      data: json,
      status
    };
  } catch (e) {
    return {
      success: false,
      message: `Gagal terhubung ke server: ${e.message}`
    };
  }
}

// ============================================================
//  MENU UTAMA
// ============================================================
function mainMenu(userId) {
  const user = getUser(userId);
  const saldo = (user.coin || 0).toLocaleString();
  const isVip = user.vip || user.isVip || false;

  const caption = `<b>─〔 🤖 BOT COIN SCRIPT 〕─</b>\n\n` +
    `👋 Selamat Datang, <b>${user.nama || userId}</b>!\n` +
    `┣ 💰 <b>Saldo :</b> ${saldo} Coins\n` +
    `┣ 👥 <b>Referral :</b> ${user.refCount || 0} Orang\n` +
    `┣ 🆔 <b>Status :</b> ${isOwner(userId) ? 'Owner' : isVip ? 'VIP ⭐' : 'Member'}\n` +
    `┗ 📅 <b>Bergabung :</b> ${new Date(user.joinedAt).toLocaleDateString('id-ID')}\n\n` +
    `<blockquote>Kumpulkan koin dengan mengajak teman bergabung dan tukarkan dengan script premium!</blockquote>\n` +
    `<b>──────────────────────</b>`;

  const buttons = [
    [{ text: "🛒 Tukar Coin", callback_data: "tukar_coin" }, { text: "📜 List Script", callback_data: "list_script" }],
    [{ text: "🎁 Klaim Harian", callback_data: "daily_claim" }, { text: "🎰 Lucky Spin", callback_data: "lucky_spin" }],
    [{ text: "📦 Mystery Box", callback_data: "gacha_script" }, { text: "🎮 Tebak Angka", callback_data: "tebak_angka" }],
    [{ text: "📝 Misi Coin", callback_data: "list_misi" }, { text: "💰 Beli Coin", callback_data: "beli_coin" }],
    [{ text: "💳 Ambil Coin", callback_data: "referral" }, { text: "🏆 Top Sultan", callback_data: "leaderboard" }],
    [{ text: "📊 Statistik", callback_data: "bot_stats" }, { text: "💸 Transfer Coin", callback_data: "transfer_coin" }],
    [{ text: "🆓 Coin Gratis", callback_data: "coin_gratis" }],
    [{ text: "🔓 AnimeLovers VIP", callback_data: "menu_animelovers" }],
    [{ text: "🛡️ Obfuscate JS", callback_data: "menu_obfuscate" }],
    [{ text: "✨ Alight Langganan", callback_data: "menu_alight" }],
    [{ text: "📊 Info Akun Saya", callback_data: "menu_infoakun" }],
    [{ text: "☕ Dukung Kami", callback_data: "menu_dukung" }],
    [{ text: "💬 Code Redeem", url: "https://t.me/inpoapkmod" }]
  ];

  if (isOwner(userId)) {
    buttons.push([{ text: "⚙️ OWNER DASHBOARD", callback_data: "owner_menu" }]);
  }

  return {
    caption: caption,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons }
  };
}

// ============================================================
//  HANDLER: ERROR GLOBAL
// ============================================================
const originalEmit = bot.emit.bind(bot);
bot.emit = function(event, ...args) {
  try {
    return originalEmit(event, ...args);
  } catch (err) {
    sendErrorToOwner(err, `Event: ${event}`);
    console.error('Unhandled error in bot.emit:', err);
    return false;
  }
};

// ============================================================
//  HANDLER: /start
// ============================================================
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  try {
    const userId = msg.from.id;
    const referralArg = match ? match[1] : null;

    if (db.maintenance && !isOwner(userId)) {
      return bot.sendMessage(userId, "🚧 <b>BOT SEDANG MAINTENANCE</b>\n\nSabar ya, bot lagi diperbaiki!", { parse_mode: 'HTML' });
    }

    const user = getUser(userId);
    if (user.isBanned) {
      return bot.sendMessage(userId, "🚫 <b>AKUN KAMU DI BANNED!</b>\nKamu tidak bisa lagi menggunakan layanan bot ini.", { parse_mode: 'HTML' });
    }

    const isJoined = await checkJoin(userId);
    if (!isJoined) {
      const allChats = [...config.channels, config.group];
      const buttons = allChats.filter(c => c).map(c => {
        const link = c.replace('@', '');
        return [{ text: `📢 ${c}`, url: `https://t.me/${link}` }];
      });
      buttons.push([{ text: "✅ Saya Sudah Join", callback_data: "check_join" }]);
      return bot.sendMessage(userId,
        `<b>⚠️ AKSES TERBATAS</b>\n\n` +
        `Maaf, kamu harus bergabung ke komunitas kami terlebih dahulu.\n\n` +
        `<blockquote>Pastikan sudah join semua channel di bawah, lalu tekan tombol verifikasi.</blockquote>`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } }
      );
    }

    if (!user.joined) {
      user.coin = (user.coin || 0) + (config.welcomeBonus || 2000);
      user.joined = true;
      await saveDB();
      bot.sendMessage(userId, `<b>🎉 WELCOME BONUS!</b>\n<blockquote>Bonus ${(config.welcomeBonus || 2000).toLocaleString()} koin cair!</blockquote>`, { parse_mode: 'HTML' });
    }

    if (!user.registered) {
      ownerState[userId] = { step: 'reg_name' };
      return bot.sendMessage(userId,
        "👋 <b>SELAMAT DATANG!</b>\n\nKamu belum memiliki akun. Silahkan buat akun terlebih dahulu.\n\n👤 <b>Masukkan Nama kamu:</b>",
        { parse_mode: 'HTML' }
      );
    }

    if (referralArg && !user.referredBy && String(referralArg) !== String(userId)) {
      const referrer = getUser(referralArg);
      if (referrer) {
        referrer.coin = (referrer.coin || 0) + (config.referralBonus || 30000);
        referrer.refCount = (referrer.refCount || 0) + 1;
        user.referredBy = String(referralArg);
        user.coin = (user.coin || 0) + (config.referralBonusNewUser || 2000);
        await saveDB();
        bot.sendMessage(referralArg,
          `<b>🔔 NOTIFIKASI REFERRAL</b>\n\n<blockquote>Teman bergabung!\n💰 +${(config.referralBonus || 30000).toLocaleString()} Coins ditambahkan.</blockquote>`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    }

    bot.sendPhoto(userId, config.startImage, mainMenu(userId))
      .catch(() => {
        bot.sendMessage(userId, mainMenu(userId).caption, { parse_mode: 'HTML', reply_markup: mainMenu(userId).reply_markup });
      });
  } catch (err) {
    sendErrorToOwner(err, '/start');
    console.error('Error di /start:', err);
  }
});

// ============================================================
//  HANDLER: MESSAGE (State, Admin Chat, Alight Flow)
// ============================================================
const forwardMap = new Map();

bot.on('message', async (msg) => {
  try {
    const userId = msg.from.id;
    const text = msg.text;
    const chatId = msg.chat.id;

    if (db.maintenance && !isOwner(userId)) {
      if (text && text.startsWith('/maint')) return;
      return bot.sendMessage(userId, "🚧 <b>BOT SEDANG MAINTENANCE</b>\n\nSabar ya, bot lagi diperbaiki!", { parse_mode: 'HTML' });
    }

    // Admin chat: balasan ke user
    if (config.adminId && chatId === config.adminId && msg.reply_to_message) {
      const originalUserChatId = forwardMap.get(msg.reply_to_message.message_id);
      if (originalUserChatId) {
        await bot.sendMessage(originalUserChatId, `💬 *Balasan dari Admin:*\n${text}`, { parse_mode: 'Markdown' });
        await bot.sendMessage(chatId, "✅ Balasan terkirim ke user.");
        return;
      }
    }

    // STATE HANDLER
    const state = ownerState[userId] || null;

    if (state) {
      // REGISTRASI: NAMA
      if (state.step === 'reg_name' && text) {
        ownerState[userId] = { step: 'reg_pass', name: text };
        return bot.sendMessage(userId,
          `👤 Nama diterima: <b>${text}</b>\n\nSekarang masukkan <b>Password</b> untuk akun kamu:`,
          { parse_mode: 'HTML' }
        );
      }
      // REGISTRASI: PASSWORD
      if (state.step === 'reg_pass' && text) {
        const user = getUser(userId);
        user.registered = true;
        user.nama = state.name;
        user.password = text;
        await saveDB();
        delete ownerState[userId];
        return bot.sendMessage(userId,
          `✅ <b>AKUN BERHASIL DIBUAT!</b>\n\n👤 Nama: <code>${state.name}</code>\n🔑 Password: <code>${text}</code>\n\nSilahkan /start untuk masuk ke menu.`,
          { parse_mode: 'HTML' }
        );
      }

      // TRANSFER KOIN
      if (state.step === 'tf_id' && text) {
        const targetId = text.trim();
        if (targetId == userId) return bot.sendMessage(userId, "❌ Tidak bisa transfer ke diri sendiri!");
        if (!db.users[targetId]) return bot.sendMessage(userId, "❌ ID User tidak ditemukan!");
        state.targetId = targetId;
        state.step = 'tf_amount';
        return bot.sendMessage(userId, `💰 Masukkan jumlah koin untuk ID ${targetId}:`);
      }
      if (state.step === 'tf_amount' && text) {
        const amount = parseInt(text.replace(/\./g, ''));
        if (isNaN(amount) || amount < 100) return bot.sendMessage(userId, "❌ Minimal transfer 100!");
        const user = getUser(userId);
        if ((user.coin || 0) < amount) {
          return bot.sendMessage(userId, `❌ Koin tidak cukup! (Butuh ${amount.toLocaleString()}, saldo: ${(user.coin||0).toLocaleString()})`);
        }
        user.coin -= amount;
        const targetUser = getUser(state.targetId);
        targetUser.coin = (targetUser.coin || 0) + amount;
        await saveDB();
        bot.sendMessage(userId, `✅ Transfer ${amount.toLocaleString()} koin ke ${state.targetId} berhasil!`);
        bot.sendMessage(state.targetId, `📩 Terima ${amount.toLocaleString()} koin dari ${userId}`).catch(() => {});
        delete ownerState[userId];
        return;
      }

      // REDEEM CODE (Owner)
      if (state.step === 'rd_code' && text) {
        state.code = text.trim().toUpperCase();
        state.step = 'rd_reward';
        return bot.sendMessage(userId, `✅ Kode <b>${state.code}</b> disimpan.\n\n💰 Sekarang masukkan jumlah hadiah koinnya:`, { parse_mode: 'HTML' });
      }
      if (state.step === 'rd_reward' && text) {
        const reward = parseInt(text.replace(/\./g, ''));
        if (isNaN(reward)) return bot.sendMessage(userId, "❌ Masukkan angka saja!");
        if (!db.redeemCodes) db.redeemCodes = {};
        db.redeemCodes[state.code] = { reward, limit: 5, claimedBy: [] };
        await saveDB();
        const botInfo = await bot.getMe();
        const textChannel =
          `<b>🎁 KODE REDEEM BARU!</b>\n\n` +
          `┣ 🔑 <b>Kode :</b> <code>${state.code}</code>\n` +
          `┣ 💰 <b>Hadiah :</b> ${reward.toLocaleString()} Koin\n` +
          `┗ 👥 <b>Kuota :</b> 5 Orang\n\n` +
          `<b>📌 Cara Klaim:</b>\n` +
          `Buka bot @${botInfo.username} lalu ketik:\n` +
          `<code>/redeem ${state.code}</code>`;
        bot.sendMessage("@inpoapkmod", textChannel, { parse_mode: 'HTML' }).catch(() => {});
        bot.sendMessage(userId, `✅ Kode <b>${state.code}</b> aktif dan sudah diposting ke channel.`, { parse_mode: 'HTML' });
        delete ownerState[userId];
        return;
      }

      // TAMBAH KOIN USER (Owner)
      if (state.step === 'waiting_user_id' && text) {
        state.targetId = text.trim();
        if (!db.users[state.targetId]) return bot.sendMessage(userId, "❌ ID tidak ada!");
        state.step = 'waiting_user_amount';
        return bot.sendMessage(userId, `👤 ID: ${state.targetId}. Masukkan jumlah koin:`);
      }
      if (state.step === 'waiting_user_amount' && text) {
        const amount = parseInt(text.replace(/\./g, ''));
        const targetUser = getUser(state.targetId);
        targetUser.coin = (targetUser.coin || 0) + amount;
        await saveDB();
        bot.sendMessage(state.targetId, `🎁 Kamu dapat ${amount.toLocaleString()} koin dari Owner!`).catch(() => {});
        bot.sendMessage(userId, "✅ Terkirim!");
        delete ownerState[userId];
        return;
      }

      // TAMBAH SCRIPT (BULK UPLOAD)
      if (state.step === 'waiting_file') {
        if (msg.document) {
          if (!state.tempFiles) state.tempFiles = [];
          state.tempFiles.push({
            name: msg.document.file_name,
            fileId: msg.document.file_id
          });
          bot.sendMessage(userId, `📥 File <b>${msg.document.file_name}</b> diterima. Kirim lagi atau ketik <b>DONE</b> jika selesai.`, { parse_mode: 'HTML' });
        } else if (text && text.toUpperCase() === 'DONE') {
          if (!state.tempFiles || state.tempFiles.length === 0) return bot.sendMessage(userId, "❌ Kirim filenya dulu!");
          state.step = 'waiting_price_bulk';
          bot.sendMessage(userId, `📦 Total <b>${state.tempFiles.length} Script</b> diterima.\n💰 Masukkan Harga untuk semua script ini:`, { parse_mode: 'HTML' });
        }
        return;
      }
      if (state.step === 'waiting_price_bulk' && text) {
        const price = parseInt(text.replace(/\./g, ''));
        if (isNaN(price)) return bot.sendMessage(userId, "❌ Masukkan angka saja!");
        state.tempFiles.forEach(f => {
          db.scripts.push({ name: f.name, fileId: f.fileId, price: price });
        });
        await saveDB();
        const uids = Object.keys(db.users);
        for (const id of uids) {
          await new Promise(r => setTimeout(r, 100));
          bot.sendMessage(id,
            `<b>🆕 NEW UPDATE!</b>\n\nSebanyak <b>${state.tempFiles.length} Script baru</b> telah ditambahkan!\n💰 Harga: ${price.toLocaleString()} Coins\n\nCek sekarang di menu Store!`,
            { parse_mode: 'HTML' }
          ).catch(() => {});
        }
        bot.sendMessage(userId, `✅ Berhasil menambah ${state.tempFiles.length} script!`);
        delete ownerState[userId];
        return;
      }

      // COIN GRATIS (MISI SHARE)
      if (state.step === 'waiting_bukti_share') {
        if (!msg.photo) return bot.sendMessage(userId, "❌ Kirim dalam bentuk <b>FOTO</b> (Screenshot)!", { parse_mode: 'HTML' });
        state.fotoBukti = msg.photo[msg.photo.length - 1].file_id;
        state.step = 'waiting_id_gratis';
        return bot.sendMessage(userId, "✅ Bukti diterima! Sekarang masukkan ID Akun kamu:");
      }
      if (state.step === 'waiting_id_gratis' && text) {
        const targetId = text.trim();
        await bot.sendPhoto(config.ownerId, state.fotoBukti, {
          caption: `<b>🚨 LAPORAN MISI COIN GRATIS</b>\n\n👤 Pengirim: <code>${userId}</code>\n🆔 ID Target: <code>${targetId}</code>\n💰 Reward: 5.000 Coin`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ ACC", callback_data: `acc_share_${targetId}` }],
              [{ text: "❌ TOLAK", callback_data: `tolak_share_${targetId}` }]
            ]
          }
        });
        delete ownerState[userId];
        return bot.sendMessage(userId, "✅ <b>Bukti Berhasil Dikirim ke Owner!</b>\n\nSilahkan Tunggu konfirmasi dari Owner.", { parse_mode: 'HTML' });
      }

      // BUAT MISI (Owner)
      if (state.step === 'create_misi_link' && text && text.includes('t.me/')) {
        state.linkMisi = text;
        state.step = 'create_misi_reward';
        return bot.sendMessage(userId, "💰 <b>Berapa hadiah coin untuk misi ini?</b>\nKirim dalam bentuk angka saja.", { parse_mode: 'HTML' });
      }
      if (state.step === 'create_misi_reward' && text) {
        const reward = parseInt(text);
        if (isNaN(reward)) return bot.sendMessage(userId, "❌ Masukkan angka saja!");
        const linkTujuan = state.linkMisi;
        const channelUsername = linkTujuan.split('/').pop().replace('@', '');
        const uids = Object.keys(db.users);
        for (const id of uids) {
          await new Promise(r => setTimeout(r, 100));
          bot.sendMessage(id,
            `📢 <b>MISI BARU: JOIN & EARN</b>\n\nBergabunglah ke channel/grup di bawah ini untuk mendapatkan koin gratis!\n\n💰 <b>Hadiah:</b> ${reward.toLocaleString()} Coin`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🔗 Gabung Sekarang", url: linkTujuan }],
                  [{ text: "✅ Saya Sudah Join", callback_data: `check_join|${channelUsername}|${reward}` }]
                ]
              }
            }
          ).catch(() => {});
        }
        delete ownerState[userId];
        return bot.sendMessage(userId, "✅ <b>Misi berhasil disebar!</b>");
      }
    }

    // --- ALIGHT FLOW ---
    const session = getAlightSession(userId);
    if (session && session.step) {
      try {
        if (session.step === 'email') {
          const email = text.trim();
          if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
            return bot.sendMessage(userId, "❌ Format email tidak valid. Masukkan email yang benar.\nContoh: `user@gmail.com`\n\nKetik /alightcancel untuk membatalkan.", { parse_mode: 'Markdown' });
          }
          session.email = email;
          session.step = 'processing';
          await saveDB();

          const user = getUser(userId);
          const apiKey = user.alightApiKey;
          if (!apiKey) {
            clearAlightSession(userId);
            return bot.sendMessage(userId, "❌ API Key tidak ditemukan. Gunakan /setalightkey terlebih dahulu.");
          }

          await bot.sendMessage(userId, "⏳ Mengirim permintaan aktivasi dengan API Key...");
          const result = await alightSend(email, apiKey);

          if (result.success) {
            session.step = 'link';
            await saveDB();
            await bot.sendMessage(userId,
              `✅ **Permintaan berhasil!**\n\n📧 Sebuah *magic link* telah dikirim ke email kamu.\n📌 **Langkah 2:** Salin **seluruh** magic link dari email dan kirimkan ke sini.\n⚠️ Link hanya berlaku 15-30 menit.\n\nKetik /alightcancel untuk membatalkan.` + COPYRIGHT,
              { parse_mode: 'Markdown' }
            );
          } else {
            let errorMsg = `❌ **Gagal:** ${result.message}`;
            if (result.status) errorMsg += ` (HTTP ${result.status})`;
            if (result.raw) {
              const rawStr = typeof result.raw === 'string' ? result.raw : JSON.stringify(result.raw);
              errorMsg += `\n\nDetail server:\n\`\`\`\n${rawStr.slice(0, 300)}\n\`\`\``;
            }
            errorMsg += `\n\n💡 Coba lagi dengan /alight setelah beberapa saat.`;
            clearAlightSession(userId);
            await bot.sendMessage(userId, errorMsg + COPYRIGHT, { parse_mode: 'Markdown' });
          }
        } else if (session.step === 'link') {
          const link = text.trim();
          if (link.length < 20) {
            return bot.sendMessage(userId, "❌ Link terlalu pendek. Pastikan kamu menyalin **seluruh** magic link dari email.\n\nKetik /alightcancel untuk membatalkan.", { parse_mode: 'Markdown' });
          }
          session.link = link;
          session.step = 'processing';
          await saveDB();

          const user = getUser(userId);
          const apiKey = user.alightApiKey;

          await bot.sendMessage(userId, "⏳ Memverifikasi dan mengaktifkan...");
          const result = await alightVerify(session.email, link, apiKey);

          if (result.success) {
            clearAlightSession(userId);
            await bot.sendMessage(userId,
              `🎉 **AKTIVASI BERHASIL!**\n\n✅ Lisensi Premium Alight Motion telah diaktifkan.\n🚀 Buka aplikasi dan nikmati semua fitur Pro!` + COPYRIGHT,
              { parse_mode: 'Markdown' }
            );
          } else {
            let errorMsg = `❌ **Gagal verifikasi link:** ${result.message}`;
            if (result.status) errorMsg += ` (HTTP ${result.status})`;
            const rawStr = result.raw ? (typeof result.raw === 'string' ? result.raw : JSON.stringify(result.raw)) : '';
            if (rawStr.includes('INVALID_OOB_CODE')) {
              errorMsg = `❌ **Link tidak valid atau sudah kadaluwarsa!**\n\n🔹 Magic link hanya berlaku **15-30 menit** dan hanya bisa dipakai **sekali**.\n🔄 **Solusi:** Jalankan kembali /alight dan gunakan link baru.`;
            } else if (result.raw) {
              errorMsg += `\n\nDetail server:\n\`\`\`\n${rawStr.slice(0, 300)}\n\`\`\``;
            }
            clearAlightSession(userId);
            await bot.sendMessage(userId, errorMsg + COPYRIGHT, { parse_mode: 'Markdown' });
          }
        }
      } catch (e) {
        clearAlightSession(userId);
        sendErrorToOwner(e, 'Alight Flow');
        await bot.sendMessage(userId, `❌ Terjadi kesalahan: ${e.message}\n\nSilakan coba lagi dengan /alight.` + COPYRIGHT, { parse_mode: 'Markdown' });
      }
      return;
    }

    // --- ADMIN CHAT: user mengirim pesan ke admin ---
    const user = getUser(userId);
    if (user.awaitingAdminMessage && text && !text.startsWith('/')) {
      user.awaitingAdminMessage = false;
      await saveDB();
      if (!config.adminId) {
        return bot.sendMessage(userId, "⚠️ Fitur chat admin belum dikonfigurasi.");
      }
      const forwarded = await bot.forwardMessage(config.adminId, userId, msg.message_id);
      forwardMap.set(forwarded.message_id, userId);
      await bot.sendMessage(config.adminId,
        `👤 Pesan dari:\nID: ${userId}\nUsername: ${msg.from.username ? '@' + msg.from.username : '-'}\n\nBalas pesan ini (reply) untuk membalas.`
      );
      return bot.sendMessage(userId, "✅ Pesan kamu sudah dikirim ke Admin.");
    }

    // --- REDEEM CODE (User) ---
    if (text && text.startsWith('/redeem ')) {
      const inputCode = text.replace('/redeem ', '').trim().toUpperCase();
      if (!db.redeemCodes || !db.redeemCodes[inputCode]) {
        return bot.sendMessage(userId, "❌ Kode redeem tidak valid atau sudah kedaluwarsa!");
      }
      const codeData = db.redeemCodes[inputCode];
      if (codeData.claimedBy.includes(userId)) {
        return bot.sendMessage(userId, "❌ Kamu sudah pernah klaim kode ini!");
      }
      if (codeData.claimedBy.length >= codeData.limit) {
        delete db.redeemCodes[inputCode];
        await saveDB();
        return bot.sendMessage(userId, "❌ Kode ini sudah habis diklaim!");
      }
      const userData = getUser(userId);
      userData.coin = (userData.coin || 0) + codeData.reward;
      codeData.claimedBy.push(userId);
      if (codeData.claimedBy.length >= codeData.limit) {
        delete db.redeemCodes[inputCode];
      }
      await saveDB();
      return bot.sendMessage(userId, `🎉 Selamat! Kamu berhasil mendapatkan <b>${codeData.reward.toLocaleString()}</b> koin!`, { parse_mode: 'HTML' });
    }

  } catch (err) {
    sendErrorToOwner(err, 'on("message")');
    console.error('Error di handler message:', err);
  }
});

// ============================================================
//  CALLBACK QUERY HANDLER
// ============================================================
bot.on('callback_query', async (query) => {
  try {
    const userId = query.from.id;
    const data = query.data;
    const msgId = query.message.message_id;
    await bot.answerCallbackQuery(query.id).catch(() => {});

    if (db.maintenance && !isOwner(userId)) {
      return bot.answerCallbackQuery(query.id, {
        text: "🚧 Bot sedang Maintenance!",
        show_alert: true
      });
    }

    const user = getUser(userId);
    if (user.isBanned) {
      return bot.answerCallbackQuery(query.id, {
        text: "🚫 Akun kamu di-banned!",
        show_alert: true
      });
    }

    // === CHECK JOIN ===
    if (data === "check_join") {
      if (await checkJoin(userId)) {
        await bot.deleteMessage(userId, msgId).catch(() => {});
        bot.sendPhoto(userId, config.startImage, mainMenu(userId));
      } else {
        bot.answerCallbackQuery(query.id, { text: "❌ Belum join semua channel!", show_alert: true });
      }
      return;
    }

    // === BACK HOME ===
    if (data === "back_home") {
      bot.editMessageCaption(mainMenu(userId).caption, {
        chat_id: userId,
        message_id: msgId,
        parse_mode: 'HTML',
        reply_markup: mainMenu(userId).reply_markup
      });
      return;
    }

    // === KOIN & REWARD ===
    if (data === "daily_claim") {
      const now = Date.now();
      const last = user.lastClaim || 0;
      const cooldown = config.dailyClaimCooldownMs || 86400000;
      if (now - last < cooldown) {
        const sisa = cooldown - (now - last);
        const jam = Math.floor(sisa / (1000 * 60 * 60));
        return bot.answerCallbackQuery(query.id, { text: `⏳ Tunggu ${jam} jam lagi!`, show_alert: true });
      }
      user.coin += (config.dailyClaimAmount || 5000);
      user.lastClaim = now;
      await saveDB();
      bot.answerCallbackQuery(query.id, { text: `🎉 +${(config.dailyClaimAmount || 5000).toLocaleString()} Koin Harian!`, show_alert: true });
      bot.editMessageCaption(mainMenu(userId).caption, { chat_id: userId, message_id: msgId, parse_mode: 'HTML', reply_markup: mainMenu(userId).reply_markup });
      return;
    }

    if (data === "lucky_spin") {
      const check = checkCoins(userId, 2000);
      if (!check.success) {
        return bot.answerCallbackQuery(query.id, { text: check.message, show_alert: true });
      }
      user.coin -= 2000;
      const r = Math.random();
      let win = 0;
      let txt = "💀 Zonk!";
      if (r > 0.9) { win = 5000; txt = "🔥 JACKPOT 5.000!"; }
      else if (r > 0.6) { win = 3000; txt = "🎉 MENANG 3.000!"; }
      else if (r > 0.3) { win = 2000; txt = "⚖️ Balik Modal!"; }
      user.coin += win;
      await saveDB();
      bot.answerCallbackQuery(query.id, { text: txt, show_alert: true });
      bot.editMessageCaption(mainMenu(userId).caption, { chat_id: userId, message_id: msgId, parse_mode: 'HTML', reply_markup: mainMenu(userId).reply_markup });
      return;
    }

    if (data === "transfer_coin") {
      ownerState[userId] = { step: 'tf_id' };
      bot.sendMessage(userId, "👤 <b>TRANSFER KOIN</b>\n\nMasukkan ID user tujuan:");
      return;
    }

    if (data === "referral") {
      const botInfo = await bot.getMe();
      const link = `https://t.me/${botInfo.username}?start=${userId}`;
      bot.editMessageCaption(
        `<b>───〔 👥 REFERRAL 〕───</b>\n\n🔗 <b>Link :</b> <code>${link}</code>\n👥 <b>Total :</b> ${user.refCount || 0} Orang`,
        {
          chat_id: userId,
          message_id: msgId,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: "⬅️ Kembali", callback_data: "back_home" }]] }
        }
      );
      return;
    }

    if (data === "leaderboard") {
      const topUsers = Object.entries(db.users).sort(([, a], [, b]) => (b.coin || 0) - (a.coin || 0)).slice(0, 10);
      let text = "<b>🏆 TOP 10 SULTAN KOIN</b>\n\n";
      topUsers.forEach(([id, data], index) => {
        const nama = data.nama || id;
        text += `${index + 1}. ${nama} — 💰 <b>${(data.coin || 0).toLocaleString()}</b>\n`;
      });
      bot.editMessageCaption(text, {
        chat_id: userId,
        message_id: msgId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: "⬅️ Kembali", callback_data: "back_home" }]] }
      });
      return;
    }

    if (data === "bot_stats") {
      const total = totalUsers();
      const scriptCount = db.scripts.length;
      const redeemCount = Object.keys(db.redeemCodes || {}).length;
      const uptime = formatUptime(Date.now() - BOT_START_TIME);
      bot.editMessageCaption(
        `<b>📊 STATISTIK BOT</b>\n\n┣ 👥 Total User: ${total}\n┣ 📂 Script: ${scriptCount}\n┣ 🎫 Redeem: ${redeemCount}\n┗ ⏳ Uptime: ${uptime}`,
        {
          chat_id: userId,
          message_id: msgId,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: "⬅️ Kembali", callback_data: "back_home" }]] }
        }
      );
      return;
    }

    // === LIST SCRIPT & TUKAR ===
    if (data === "list_script" || data === "tukar_coin" || data.startsWith("page_")) {
      if (db.scripts.length === 0) {
        return bot.answerCallbackQuery(query.id, { text: "Kosong!", show_alert: true });
      }
      const page = data.startsWith("page_") ? parseInt(data.split("_")[1]) : 0;
      const perPage = 5;
      const start = page * perPage;
      const end = start + perPage;
      const items = db.scripts.slice(start, end);

      let buttons = items.map((s, index) => [
        { text: `📂 ${s.name} [ ${s.price.toLocaleString()} ]`, callback_data: `buy_${start + index}` }
      ]);

      let navRow = [];
      if (page > 0) navRow.push({ text: "⬅️ Back", callback_data: `page_${page - 1}` });
      else navRow.push({ text: "⬛", callback_data: "none" });
      navRow.push({ text: "🏠 HOME", callback_data: "back_home" });
      if (end < db.scripts.length) navRow.push({ text: "Next ➡️", callback_data: `page_${page + 1}` });
      else navRow.push({ text: "⬛", callback_data: "none" });
      buttons.push(navRow);

      bot.editMessageCaption(`<b>📂 LIST SCRIPT (Hal: ${page + 1})</b>\n\nPilih script yang ingin ditukar:`, {
        chat_id: userId,
        message_id: msgId,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      }).catch(() => {});
      return;
    }

    if (data.startsWith('buy_')) {
      const index = parseInt(data.split('_')[1]);
      const script = db.scripts[index];
      if (!script) return bot.answerCallbackQuery(query.id, { text: "Script tidak ditemukan!", show_alert: true });
      const check = checkCoins(userId, script.price);
      if (!check.success) {
        return bot.answerCallbackQuery(query.id, { text: check.message, show_alert: true });
      }
      user.coin -= script.price;
      await saveDB();
      await bot.sendDocument(userId, script.fileId, {
        caption: `<b>✅ PENUKARAN BERHASIL</b>\n\n┣ 📂 <b>Nama:</b> ${script.name}\n┗ 💸 <b>Harga:</b> ${script.price.toLocaleString()} Coins`,
        parse_mode: 'HTML'
      }).catch(() => {});
      if (config.notifChannel) {
        bot.sendMessage(config.notifChannel,
          `<b>🚀 LOG PENUKARAN</b>\n👤 User: <code>${userId}</code>\n📂 Script: ${script.name}\n💰 Harga: ${script.price.toLocaleString()}`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
      bot.answerCallbackQuery(query.id, { text: "✅ Berhasil!", show_alert: true });
      return;
    }

    // === BELI COIN ===
    if (data === "beli_coin") {
      const textBeli =
        `<b>💎 TOP UP COIN SCRIPT</b>\n\n` +
        `Silahkan pilih paket koin yang ingin kamu beli:\n\n` +
        `┣ 🔴 10.000 Koin = Rp 2.000\n` +
        `┣ 🟠 20.000 Koin = Rp 4.000\n` +
        `┣ 🟡 30.000 Koin = Rp 6.000\n` +
        `┣ 🔵 40.000 Koin = Rp 8.000\n` +
        `┗ 🟢 50.000 Koin = Rp 10.000\n\n` +
        `<i>Klik tombol di bawah untuk instruksi pembayaran.</i>`;
      bot.editMessageCaption(textBeli, {
        chat_id: userId,
        message_id: msgId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: "💳 Bayar Sekarang", callback_data: "bayar_koin" }],
            [{ text: "⬅️ Kembali", callback_data: "back_home" }]
          ]
        }
      });
      return;
    }

    if (data === "bayar_koin") {
      const textBayar =
        `<b>📸 PROSES PEMBAYARAN</b>\n\n` +
        `1. Scan QRIS di atas atau transfer ke DANA.\n` +
        `2. <b>DANA:</b> <code>081329451402</code>\n` +
        `3. Sertakan bukti transfer & <b>ID: ${userId}</b>.\n` +
        `4. Kirim bukti ke Owner: @jsobfuscator\n\n` +
        `<blockquote>Koin akan diproses manual oleh owner setelah bukti transfer dicek.</blockquote>`;
      bot.sendPhoto(userId, "https://athars.space/uploads/30fa2c79.png", {
        caption: textBayar,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: "👨‍💻 Hubungi Owner", url: "https://t.me/jsobfuscator" }],
            [{ text: "⬅️ Kembali", callback_data: "beli_coin" }]
          ]
        }
      });
      return;
    }

    // === COIN GRATIS (MISI SHARE) ===
    if (data === "coin_gratis") {
      const promoText = `🚀 *PENGEN SCRIPT VIP GRATIS?*\n\nAYO CUY TUKAR KOIN MU MENJADI SCRIPT VIP!\n\n🔗 *Link Bot:* @botcoinscriptarabotGyzen\n🎁 *Bonus:* 5.000 Coin buat kamu yang share!`;
      await bot.sendPhoto(userId, "https://files.catbox.moe/zv70sm.jpg", {
        caption: `<b>💰 MISI SHARE & DAPAT KOIN</b>\n\nShare foto di atas ke grup atau teman kamu dengan teks di bawah ini:\n\n<code>${promoText}</code>\n\n<b>Setelah share, silakan screenshot dan kirim fotonya ke sini!</b>`,
        parse_mode: 'HTML'
      });
      ownerState[userId] = { step: 'waiting_bukti_share' };
      return bot.sendMessage(userId, "📸 <b>Silahkan kirim FOTO bukti screenshot kamu sekarang:</b>", { parse_mode: 'HTML' });
    }

    // === MISI COIN ===
    if (data === "list_misi") {
      const txtMisi =
        `<b>📝 MISI KOIN GRATIS</b>\n\n` +
        `Selesaikan misi di bawah ini untuk mendapatkan koin tambahan:\n\n` +
        `1. Join Channel 1\n🎁 Hadiah: <b>5.000 Koin</b>\n\n` +
        `2. Join Channel 2\n🎁 Hadiah: <b>5.000 Koin</b>\n\n` +
        `3. Join Channel 3\n🎁 Hadiah: <b>5.000 Koin</b>\n\n` +
        `4. Join Group\n🎁 Hadiah: <b>5.000 Koin</b>\n\n` +
        `<i>Klik tombol di bawah untuk mengambil hadiah misi!</i>`;
      bot.editMessageCaption(txtMisi, {
        chat_id: userId,
        message_id: msgId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Information", url: "https://t.me/inpoapkmod" }],
            [{ text: "📢 About Gyzen", url: "https://t.me/yatimpiatu1" }],
            [{ text: "📢 Family", url: "https://t.me/datahngz" }],
            [{ text: "👥 Group", url: "https://t.me/disscussionpolsekjaktim" }],
            [{ text: "✅ Ambil Hadiah", callback_data: "claim_misi" }],
            [{ text: "⬅️ Kembali", callback_data: "back_home" }]
          ]
        }
      });
      return;
    }

    if (data === "claim_misi") {
      const isJoined = await checkJoin(userId);
      if (!isJoined) {
        return bot.answerCallbackQuery(query.id, { text: "❌ Kamu belum join semua channel di atas!", show_alert: true });
      }
      if (user.misiSelesai) {
        return bot.answerCallbackQuery(query.id, { text: "❌ Kamu sudah mengambil hadiah misi ini!", show_alert: true });
      }
      user.coin += 5000;
      user.misiSelesai = true;
      await saveDB();
      bot.sendMessage(userId, "<b>🎉 MISI SELESAI!</b>\n+5.000 koin telah ditambahkan.", { parse_mode: 'HTML' });
      bot.editMessageCaption(mainMenu(userId).caption, { chat_id: userId, message_id: msgId, parse_mode: 'HTML', reply_markup: mainMenu(userId).reply_markup });
      return;
    }

    // === GAME TEBAK ANGKA ===
    if (data === "tebak_angka") {
      const txtGame =
        `<b>🎮 GAME TEBAK ANGKA</b>\n\n` +
        `Pilih satu angka dari 1 - 5.\n` +
        `┣ 💰 Biaya Main : 1.000 Koin\n` +
        `┗ 🎁 Hadiah : 5.000 Koin\n\n` +
        `<i>Jika tebakanmu sama dengan angka Bot, kamu menang!</i>`;
      bot.editMessageCaption(txtGame, {
        chat_id: userId,
        message_id: msgId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: "1", callback_data: "bet_1" }, { text: "2", callback_data: "bet_2" }, { text: "3", callback_data: "bet_3" }],
            [{ text: "4", callback_data: "bet_4" }, { text: "5", callback_data: "bet_5" }],
            [{ text: "⬅️ Kembali", callback_data: "back_home" }]
          ]
        }
      });
      return;
    }

    if (data.startsWith('bet_')) {
      const userGuess = parseInt(data.split('_')[1]);
      const biaya = 1000;
      const check = checkCoins(userId, biaya);
      if (!check.success) {
        return bot.answerCallbackQuery(query.id, { text: check.message, show_alert: true });
      }
      user.coin -= biaya;
      const botNumber = Math.floor(Math.random() * 5) + 1;
      let resultTxt = "";
      if (userGuess === botNumber) {
        const hadiah = 5000;
        user.coin += hadiah;
        resultTxt = `🎉 <b>MENANG JACKPOT!</b>\n\n🤖 Angka Bot: <b>${botNumber}</b>\n👤 Tebakanmu: <b>${userGuess}</b>\n\nSelamat! Kamu mendapatkan <b>5.000 Koin</b>!`;
      } else {
        resultTxt = `💀 <b>ZONK / KALAH</b>\n\n🤖 Angka Bot: <b>${botNumber}</b>\n👤 Tebakanmu: <b>${userGuess}</b>\n\nYah... tebakanmu salah. Coba lagi!`;
      }
      await saveDB();
      bot.editMessageCaption(resultTxt, {
        chat_id: userId,
        message_id: msgId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎮 Main Lagi", callback_data: "tebak_angka" }],
            [{ text: "⬅️ Menu Utama", callback_data: "back_home" }]
          ]
        }
      });
      return;
    }

    // === MYSTERY BOX (GACHA) ===
    if (data === "gacha_script") {
      const biayaGacha = 10000;
      const check = checkCoins(userId, biayaGacha);
      if (!check.success) {
        return bot.answerCallbackQuery(query.id, { text: check.message, show_alert: true });
      }
      if (db.scripts.length === 0) {
        return bot.answerCallbackQuery(query.id, { text: "❌ Belum ada script di dalam box.", show_alert: true });
      }
      user.coin -= biayaGacha;
      const scriptAcak = db.scripts[Math.floor(Math.random() * db.scripts.length)];
      await saveDB();
      bot.editMessageCaption("🌀 <b>SEDANG MENGACAK BOX...</b>", { chat_id: userId, message_id: msgId, parse_mode: 'HTML' });
      setTimeout(() => {
        bot.sendDocument(userId, scriptAcak.fileId, {
          caption: `<b>📦 MYSTERY BOX BERHASIL DIBUKA!</b>\n\nSelamat! Kamu mendapatkan:\n📂 Script: <b>${scriptAcak.name}</b>\n💰 Harga Asli: ${scriptAcak.price.toLocaleString()} Koin`,
          parse_mode: 'HTML'
        });
        if (config.notifChannel) {
          bot.sendMessage(config.notifChannel, `📦 <b>GACHA BOX</b>\nUser: <code>${userId}</code>\nHadiah: ${scriptAcak.name}`, { parse_mode: 'HTML' }).catch(() => {});
        }
        bot.sendMessage(userId, mainMenu(userId).caption, mainMenu(userId));
      }, 3000);
      return;
    }

    // === MENU ANIMELOVERS VIP ===
    if (data === "menu_animelovers") {
      const menu = `
        🔓 *AnimeLovers VIP Activator*\n\n
        Gunakan perintah:\n
        • \`/animeloversvip <email> 1bulan\` — User biasa / VIP (batasan berlaku)\n
        • \`/animeloversvip <email> 3bulan\` — Owner only\n
        • \`/animeloversvip <email> 1tahun\` — Owner only\n\n
        Atau pilih menu di bawah:
      `;
      bot.editMessageCaption(menu, {
        chat_id: userId,
        message_id: msgId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎯 Aktivasi VIP (1bulan)", callback_data: "alvip_activate_1" }],
            [{ text: "📋 Cek Status VIP", callback_data: "alvip_status" }],
            [{ text: "🔙 Kembali", callback_data: "back_home" }]
          ]
        }
      });
      return;
    }

    if (data === "alvip_activate_1") {
      return bot.sendMessage(userId, "📝 Kirimkan perintah:\n`/animeloversvip <email> 1bulan`\n\nContoh: `/animeloversvip user@gmail.com 1bulan`", { parse_mode: 'Markdown' });
    }

    if (data === "alvip_status") {
      const isVip = user.vip || user.isVip || false;
      const lastUsed = user.lastAnimeloversVipUse ? new Date(user.lastAnimeloversVipUse).toLocaleDateString('id-ID') : "-";
      bot.sendMessage(userId, `📋 *Status VIP Anda*\n\nStatus: ${isVip ? '✅ VIP' : '❌ Bukan VIP'}\nTerakhir aktivasi: ${lastUsed}`, { parse_mode: 'Markdown' });
      return;
    }

    // === MENU ALIGHT MOTION ===
    if (data === "menu_alight") {
      const menu = `
        ✨ *Alight Motion Premium Activator*\n\n
        Gunakan perintah:\n
        • \`/setalightkey <api_key>\` — Simpan API Key\n
        • \`/cekkey\` — Lihat API Key tersimpan\n
        • \`/alight\` — Mulai aktivasi (3 langkah)\n
        • \`/alightcancel\` — Batalkan sesi\n
        • \`/testkey\` — Uji validitas API Key\n\n
        Atau pilih menu di bawah:
      `;
      bot.editMessageCaption(menu, {
        chat_id: userId,
        message_id: msgId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔑 Set API Key", callback_data: "alight_setkey" }],
            [{ text: "🔍 Cek API Key", callback_data: "alight_cekkey" }],
            [{ text: "🚀 Mulai Aktivasi", callback_data: "alight_start" }],
            [{ text: "❌ Batalkan Sesi", callback_data: "alight_cancel" }],
            [{ text: "🔙 Kembali", callback_data: "back_home" }]
          ]
        }
      });
      return;
    }

    if (data === "alight_setkey") {
      return bot.sendMessage(userId, "🔑 Kirimkan perintah:\n`/setalightkey <api_key>`\n\nContoh: `/setalightkey dkf_xxxxx`", { parse_mode: 'Markdown' });
    }

    if (data === "alight_cekkey") {
      const key = user.alightApiKey;
      if (!key) {
        return bot.sendMessage(userId, "❌ Kamu belum menyimpan API Key.\n\nGunakan `/setalightkey <api_key>` untuk menyimpan.", { parse_mode: 'Markdown' });
      }
      bot.sendMessage(userId, `╭───〔 🔑 API KEY ANDA 〕───╮\n│\n│ Key: \`${key}\`\n│\n╰──────────────────────────────╯\n\n© 2026 @jsobfuscator | @polsekjaktim`, { parse_mode: 'Markdown' });
      return;
    }

    // === PERBAIKAN: Tombol Mulai Aktivasi & Batal Sesi (Hanya VIP) ===
    if (data === "alight_start") {
      const isVip = user.vip || user.isVip || false;
      if (!isVip) {
        return bot.answerCallbackQuery(query.id, {
          text: "❌ Fitur ini hanya untuk pengguna VIP!",
          show_alert: true
        });
      }
      bot.answerCallbackQuery(query.id, { text: "⏳ Memulai aktivasi..." });
      bot.emit('text', { chat: { id: userId }, from: { id: userId }, text: '/alight' });
      return;
    }

    if (data === "alight_cancel") {
      const isVip = user.vip || user.isVip || false;
      if (!isVip) {
        return bot.answerCallbackQuery(query.id, {
          text: "❌ Fitur ini hanya untuk pengguna VIP!",
          show_alert: true
        });
      }
      bot.answerCallbackQuery(query.id, { text: "⏳ Membatalkan sesi..." });
      bot.emit('text', { chat: { id: userId }, from: { id: userId }, text: '/alightcancel' });
      return;
    }

    // === MENU OBFUSCATE (diperbarui) ===
    if (data === "menu_obfuscate") {
      const instruction = `
        🛡️ *Obfuscate JavaScript*\n\n
        Ketik perintah \`/enc\`, lalu kirim file .js yang ingin diobfuscate.\n
        Bot akan memproses dan mengembalikan file yang sudah di-obfuscate dengan prefix \`HangzPediaEncrypted_0x...\`.\n
        Proteksi ekstra: Anti-Debug, Self-Defending, String RC4+Base64, Control Flow Flattening.\n\n
        𝙴𝚗𝚌𝚛𝚢𝚙𝚝 𝙱𝚢 𝙷𝚊𝚗𝚐𝚣𝙿𝚎𝚍𝚒𝚊!
      `;
      bot.editMessageCaption(instruction, {
        chat_id: userId,
        message_id: msgId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Kembali", callback_data: "back_home" }]
          ]
        }
      });
      return;
    }

    // === INFO AKUN ===
    if (data === "menu_infoakun") {
      const saldo = (user.coin || 0).toLocaleString();
      const isVip = user.vip || user.isVip || false;
      bot.editMessageCaption(
        `📊 *Info Akun Kamu*\n\n` +
        `🆔 ID: \`${userId}\`\n` +
        `👤 Nama: ${user.nama || '-'}\n` +
        `💰 Koin: ${saldo}\n` +
        `⭐ VIP: ${isVip ? '✅ Aktif' : '❌ Tidak'}\n` +
        `📅 Bergabung: ${new Date(user.joinedAt).toLocaleString('id-ID')}`,
        {
          chat_id: userId,
          message_id: msgId,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_home" }]] }
        }
      );
      return;
    }

    // === DUKUNG KAMI ===
    if (data === "menu_dukung") {
      bot.editMessageCaption(
        "☕ Terima kasih sudah mau mendukung! Kamu bisa share bot ini ke teman-temanmu atau donasi lewat link yang akan diumumkan di channel kami.",
        {
          chat_id: userId,
          message_id: msgId,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_home" }]] }
        }
      );
      return;
    }

    // === OWNER DASHBOARD ===
    if (data === "owner_menu" && isOwner(userId)) {
      const total = totalUsers();
      const scriptCount = db.scripts.length;
      const redeemCount = Object.keys(db.redeemCodes || {}).length;
      const uptime = formatUptime(Date.now() - BOT_START_TIME);
      bot.editMessageCaption(
        `<b>──〔 🛠 OWNER DASHBOARD 〕───</b>\n\n` +
        `📊 *Statistik:*\n` +
        `┣ 👥 Total User: ${total}\n` +
        `┣ 📂 Script: ${scriptCount}\n` +
        `┣ 🎫 Redeem: ${redeemCount}\n` +
        `┗ ⏳ Uptime: ${uptime}\n\n` +
        `Gunakan menu di bawah untuk mengelola database bot kamu.`,
        {
          chat_id: userId,
          message_id: msgId,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: "➕ Tambah Script", callback_data: "add_script" }, { text: "🗑 Hapus Script", callback_data: "del_script" }],
              [{ text: "💰 Koin Per User", callback_data: "add_coin_user" }, { text: "🎁 Buat Redeem", callback_data: "create_redeem" }],
              [{ text: "📢 Buat Misi Join", callback_data: "create_misi_ads" }, { text: "📥 Backup DB", callback_data: "backup_db" }],
              [{ text: "👑 Tambah VIP", callback_data: "owner_addprem" }, { text: "👑 Hapus VIP", callback_data: "owner_delprem" }],
              [{ text: "📋 Daftar VIP", callback_data: "owner_listprem" }, { text: "🔑 Set Alight Key", callback_data: "owner_setkey" }],
              [{ text: "🔍 Cek Alight Key", callback_data: "owner_cekkey" }, { text: "🧪 Test Alight Key", callback_data: "owner_testkey" }],
              [{ text: "🎯 Aktivasi 3bulan", callback_data: "owner_alvip_3" }, { text: "🎯 Aktivasi 1tahun", callback_data: "owner_alvip_12" }],
              [{ text: "🔥 RESET DATABASE", callback_data: "ask_reset" }],
              [{ text: "⬅️ Kembali", callback_data: "back_home" }]
            ]
          }
        }
      );
      return;
    }

    // === OWNER ACTIONS ===
    if (data === "add_script" && isOwner(userId)) {
      ownerState[userId] = { step: 'waiting_file', tempFiles: [] };
      bot.sendMessage(userId, "📤 Silahkan kirim semua file script sekaligus.\n\nJika sudah selesai, ketik: <b>DONE</b>", { parse_mode: 'HTML' });
      return;
    }

    if (data === "del_script" && isOwner(userId)) {
      if (db.scripts.length === 0) return bot.answerCallbackQuery(query.id, { text: "Kosong!", show_alert: true });
      let buttons = db.scripts.map((s, index) => [{ text: `🗑 Hapus: ${s.name}`, callback_data: `confirm_del_${index}` }]);
      buttons.push([{ text: "⬅️ Batal", callback_data: "owner_menu" }]);
      bot.editMessageCaption(`🗑 Hapus script yang mana?`, {
        chat_id: userId,
        message_id: msgId,
        reply_markup: { inline_keyboard: buttons }
      });
      return;
    }

    if (data.startsWith('confirm_del_') && isOwner(userId)) {
      const index = parseInt(data.split('_')[2]);
      db.scripts.splice(index, 1);
      await saveDB();
      bot.sendMessage(userId, "✅ Terhapus.");
      return;
    }

    if (data === "add_coin_user" && isOwner(userId)) {
      ownerState[userId] = { step: 'waiting_user_id' };
      bot.sendMessage(userId, "👤 Masukkan ID Target:");
      return;
    }

    if (data === "create_redeem" && isOwner(userId)) {
      ownerState[userId] = { step: 'rd_code' };
      bot.sendMessage(userId, "🎁 <b>BUAT REDEEM</b>\nMasukkan Kode (Contoh: ara2026):", { parse_mode: 'HTML' });
      return;
    }

    if (data === "create_misi_ads" && isOwner(userId)) {
      ownerState[userId] = { step: 'create_misi_link' };
      bot.sendMessage(userId, "🔗 <b>MASUKKAN LINK MISI</b>\n\nSilahkan kirim link Channel atau Grup yang ingin dipromosikan.", { parse_mode: 'HTML' });
      return;
    }

    if (data === "backup_db" && isOwner(userId)) {
      await saveDB();
      bot.sendDocument(userId, dbFile, { caption: "📂 <b>BACKUP DATABASE</b>", parse_mode: 'HTML' });
      return;
    }

    // === RESET DATABASE ===
    if (data === "ask_reset" && isOwner(userId)) {
      bot.editMessageCaption(
        `<b>⚠️ PERINGATAN KERAS!</b>\n\nApakah kamu yakin ingin menghapus <b>SEMUA DATA</b>? (User, Koin, Script, & Redeem).\n\n<i>Tindakan ini tidak dapat dibatalkan!</i>`,
        {
          chat_id: userId,
          message_id: msgId,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ YA, HAPUS SEMUA", callback_data: "confirm_reset_all" }],
              [{ text: "❌ BATALKAN", callback_data: "owner_menu" }]
            ]
          }
        }
      );
      return;
    }

    if (data === "confirm_reset_all" && isOwner(userId)) {
      db = { users: {}, scripts: [], redeemCodes: {}, alightSessions: {}, maintenance: false, usedEmails: {} };
      await saveDB();
      bot.answerCallbackQuery(query.id, { text: "💥 Database telah dikosongkan!", show_alert: true });
      bot.sendMessage(userId, "✅ <b>RESET SUKSES!</b>\nDatabase sekarang kosong. Silahkan ketik /start untuk mendaftarkan ulang akun owner kamu.", { parse_mode: 'HTML' });
      return;
    }

    // === OWNER: ANIMELOVERS VIP ===
    if (data === "owner_addprem" && isOwner(userId)) {
      return bot.sendMessage(userId, "👑 *Tambah VIP*\n\nKirimkan perintah:\n`/addprem <user_id>`", { parse_mode: 'Markdown' });
    }

    if (data === "owner_delprem" && isOwner(userId)) {
      return bot.sendMessage(userId, "👑 *Hapus VIP*\n\nKirimkan perintah:\n`/delprem <user_id>`", { parse_mode: 'Markdown' });
    }

    if (data === "owner_listprem" && isOwner(userId)) {
      bot.emit('text', { chat: { id: userId }, from: { id: userId }, text: '/listprem' });
      return;
    }

    if (data === "owner_setkey" && isOwner(userId)) {
      return bot.sendMessage(userId, "🔑 *Set Alight API Key*\n\nKirimkan perintah:\n`/setalightkey <api_key>`", { parse_mode: 'Markdown' });
    }

    if (data === "owner_cekkey" && isOwner(userId)) {
      bot.emit('text', { chat: { id: userId }, from: { id: userId }, text: '/cekkey' });
      return;
    }

    if (data === "owner_testkey" && isOwner(userId)) {
      bot.emit('text', { chat: { id: userId }, from: { id: userId }, text: '/testkey' });
      return;
    }

    if (data === "owner_alvip_3" && isOwner(userId)) {
      return bot.sendMessage(userId, "🎯 *Aktivasi VIP 3 Bulan*\n\nKirimkan perintah:\n`/animeloversvip <email> 3bulan`", { parse_mode: 'Markdown' });
    }

    if (data === "owner_alvip_12" && isOwner(userId)) {
      return bot.sendMessage(userId, "🎯 *Aktivasi VIP 1 Tahun*\n\nKirimkan perintah:\n`/animeloversvip <email> 1tahun`", { parse_mode: 'Markdown' });
    }

    // === ACC / TOLAK SHARE (Owner) ===
    if (data.startsWith('acc_share_')) {
      const targetId = data.split('_')[2];
      if (!db.users[targetId]) return bot.answerCallbackQuery(query.id, { text: "User tidak ditemukan!", show_alert: true });
      const targetUser = getUser(targetId);
      targetUser.coin = (targetUser.coin || 0) + 5000;
      await saveDB();
      bot.sendMessage(targetId, "✅ MISI DISETUJUI!\nAdmin telah memverifikasi bukti share kamu.\n+5.000 Coin telah ditambahkan ke saldo kamu.");
      bot.editMessageCaption(`✅ <b>MISI BERHASIL (ACC)</b>\nTarget ID: <code>${targetId}</code>\nKoin sudah ditambahkan otomatis.`, {
        chat_id: userId,
        message_id: msgId,
        parse_mode: 'HTML'
      });
      return;
    }

    if (data.startsWith('tolak_share_')) {
      const targetId = data.split('_')[2];
      bot.sendMessage(targetId, "❌ <b>MISI DITOLAK</b>\nMohon maaf, bukti share kamu tidak valid.");
      bot.editMessageCaption(`❌ <b>MISI DITOLAK</b>\nUser ID: <code>${targetId}</code> sudah diberitahu.`, {
        chat_id: userId,
        message_id: msgId,
        parse_mode: 'HTML'
      });
      return;
    }

    // === MISI JOIN (dengan reward dinamis) ===
    if (data.startsWith('check_join|')) {
      const [_, channel, reward] = data.split('|');
      const rewardAmount = parseInt(reward);
      try {
        const chatMember = await bot.getChatMember(`@${channel}`, userId);
        const status = chatMember.status;
        if (status === 'member' || status === 'administrator' || status === 'creator') {
          user.coin = (user.coin || 0) + rewardAmount;
          await saveDB();
          await bot.answerCallbackQuery(query.id, { text: `🎉 Berhasil! +${rewardAmount} Koin masuk.`, show_alert: true });
          return bot.editMessageText(`✅ <b>MISI SELESAI</b>\n\nKamu sudah bergabung ke channel dan mendapatkan <b>${rewardAmount.toLocaleString()}</b> koin.`, {
            chat_id: userId,
            message_id: msgId,
            parse_mode: 'HTML'
          });
        } else {
          return bot.answerCallbackQuery(query.id, { text: "❌ Kamu belum join! Silahkan join dulu.", show_alert: true });
        }
      } catch (err) {
        sendErrorToOwner(err, 'check_join callback');
        return bot.answerCallbackQuery(query.id, { text: "⚠️ Gagal cek status! Pastikan Bot sudah menjadi ADMIN.", show_alert: true });
      }
    }

  } catch (err) {
    sendErrorToOwner(err, 'callback_query');
    console.error('Error di callback_query:', err);
  }
});

// ============================================================
//  COMMAND HANDLERS (Text Commands)
// ============================================================
// === NEW OBFUSCATE COMMAND (/enc) - HARD DESIGN + EXPIRATION + INVISIBLE ===
bot.onText(/^\/enc(?:\s+(\d{4}-\d{2}-\d{2}))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const expiryDate = match && match[1] ? match[1] : null; // Format: YYYY-MM-DD

  if (encState[userId]) {
    bot.removeListener('document', encState[userId]);
    delete encState[userId];
  }

  bot.sendMessage(chatId, 
    expiryDate 
      ? `📤 Silakan kirim file .js yang ingin diobfuscate.\n⏳ *Expired date:* ${expiryDate} (kode akan mati setelah tanggal ini)`
      : '📤 Silakan kirim file .js yang ingin diobfuscate. (tanpa batas waktu)'
  , { parse_mode: 'Markdown' });

  const documentHandler = async (docMsg) => {
    if (docMsg.chat.id !== chatId) return;
    if (docMsg.from.id !== userId) return;

    const fileId = docMsg.document.file_id;
    const fileName = docMsg.document.file_name;
    if (!fileName.endsWith('.js')) {
      bot.sendMessage(chatId, '❌ Harap kirim file dengan format .js untuk diobfuscate.');
      bot.removeListener('document', documentHandler);
      delete encState[userId];
      return;
    }

    bot.removeListener('document', documentHandler);
    delete encState[userId];
    let outputPath = '';

    try {
      await bot.sendMessage(chatId, '⏳ Memproses obfuscation dengan proteksi ekstrem... (ini akan memakan waktu)');

      const file = await bot.getFile(fileId);
      const filePath = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
      const response = await fetch(filePath);
      let code = await response.text();

      // === Jika ada expiry date, sisipkan blok pengecekan waktu di awal ===
      if (expiryDate) {
        const expiryTimestamp = new Date(expiryDate).getTime();
        if (isNaN(expiryTimestamp)) {
          return bot.sendMessage(chatId, '❌ Format tanggal salah! Gunakan YYYY-MM-DD, contoh: /enc 2026-12-31');
        }
        const expiryGuard = `
          (function() {
            const now = Date.now();
            const expire = ${expiryTimestamp};
            if (now > expire) {
              console.error('⛔ Script ini sudah kadaluwarsa pada ' + new Date(expire).toISOString().split('T')[0]);
              process.exit(1); // atau throw new Error jika di browser
            }
          })();
        `;
        code = expiryGuard + '\n' + code;
      }

      // === KONFIGURASI OBFUSCATOR - HARDEST ===
      const options = {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 1,          // maksimal
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        debugProtection: true,
        debugProtectionInterval: 4000,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'mangled',       // menghasilkan nama pendek acak, sulit dibaca
        renameGlobals: true,
        selfDefending: true,
        simplify: true,
        splitStrings: true,
        splitStringsChunkLength: 3,
        stringArray: true,
        stringArrayEncoding: ['rc4', 'base64'],    // enkripsi ganda
        stringArrayThreshold: 1,
        transformObjectKeys: true,
        unicodeEscapeSequence: false,
        // Tambahan untuk membuat lebih “invisible”:
        numbersToExpressions: true,
        stringArrayWrappersCount: 5,
        stringArrayWrappersChainedCalls: true,
        stringArrayWrappersParametersMaxCount: 5,
      };

      let obfuscatedCode = JavaScriptObfuscator.obfuscate(code, options).getObfuscatedCode();

      // === Opsional: tambahkan lapisan "invisible" dengan eval wrapper (opsional) ===
      // Kita bungkus hasil dalam eval agar deobfuscator statis kesulitan
      // (ini membuat beberapa tool crash)
      // obfuscatedCode = `(function(){${obfuscatedCode}})();` // sudah IIFE

      outputPath = path.join(TMP_DIR, `result_${userId}.js`);
      fs.writeFileSync(outputPath, obfuscatedCode);

      await bot.sendDocument(chatId, fs.createReadStream(outputPath), {
        caption: `✅ **Obfuscation Selesai!**\n\n` +
          `📦 *Proteksi:* Anti-Debug, Self-Defending, RC4+Base64, Control Flow maksimal, Dead Code.\n` +
          `🔒 *Expired:* ${expiryDate ? expiryDate : 'Tidak ada'}\n` +
          `🛡️ *Anti Webcrack:* Mangled identifiers + string array wrapper\n` +
          `🧩 *Invisible:* Format tidak mudah dikenali deobfuscator.\n\n` +
          `⚠️ Kode ini sangat berat – pastikan environment mendukung.`,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('[ERROR /enc]', error);
      bot.sendMessage(chatId, `❌ Terjadi kesalahan: ${error.message}`);
    } finally {
      try {
        if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch (e) {}
    }
  };

  bot.on('document', documentHandler);
  encState[userId] = documentHandler;
});

// --- ANIMELOVERS VIP (Free 1bulan untuk semua user, cooldown 3 hari, 1 email per bulan) ---
bot.onText(/^\/(animeloversvip|alvip|animelovers)(?:\s+(.+))?$/i, async (msg, match) => {
  try {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const isOwnerUser = isOwner(userId);
    const user = getUser(userId); // ✅ Sudah diperbaiki: dideklarasikan sebelum isVip
    const isVip = user.vip || user.isVip || false;

    if (user.isBanned) {
      return bot.sendMessage(chatId, "🚫 Akun kamu di-banned!", { parse_mode: 'Markdown' });
    }

    if (!match[2]) {
      const durasiList = ["1bulan", "3bulan", "1tahun"].map(k => `│ • \`${k}\``).join("\n");
      const usage =
        `╭───〔 🔓 ANIMELOVERS VIP 〕───╮\n` +
        `│\n` +
        `│ 🛠️ *Penggunaan*:\n` +
        `│ • \`/${match[1]} <email> <durasi>\`\n` +
        `│\n` +
        `│ 📅 *Durasi Tersedia*:\n` +
        `${durasiList}\n` +
        `│\n` +
        `│ 📝 *Contoh*:\n` +
        `│ • \`/${match[1]} contoh@gmail.com 1bulan\`\n` +
        `│\n` +
        `╰──────────────────────────────╯\n\n© 2026 @jsobfuscator | @polsekjaktim`;
      return bot.sendMessage(chatId, usage, { parse_mode: "Markdown" });
    }

    const args = match[2].trim().split(/\s+/);
    const email = args[0];
    const durasiRaw = args[1] ? args[1].toLowerCase() : "";
    const durasiMap = config.animeloversDurasiMap || {
      '1bulan': 'Mzk3MjA4NDM3NjFfM18x',
      '3bulan': 'Mzk3MjA4NDM3NjFfM18z',
      '1tahun': 'Mzk3MjA4NDM3NjFfM18xMg=='
    };
    let vipCode;

    // --- CEK VALIDASI UNTUK MEMBER (Non-Owner, Non-VIP) ---
    if (!isOwnerUser) {
      // 1. Cek durasi: Member hanya boleh 1bulan
      if (durasiRaw !== "1bulan") {
        return bot.sendMessage(chatId,
          `╭───〔 ❌ AKSES DITOLAK 〕───╮\n│\n│ Kamu hanya bisa menggunakan durasi \`1bulan\`.\n│\n╰──────────────────────────────╯\n\n© 2026 @jsobfuscator | @polsekjaktim`,
          { parse_mode: "Markdown" }
        );
      }

      // 2. Cek COOLDOWN 3 HARI (3×24 jam) untuk user biasa
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
      const lastUse = user.lastAnimeloversVipUse || 0;
      const timeDiff = Date.now() - lastUse;
      if (timeDiff < THREE_DAYS_MS) {
        const remaining = THREE_DAYS_MS - timeDiff;
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        return bot.sendMessage(chatId,
          `⏳ Kamu harus menunggu ${hours} jam ${minutes} menit lagi untuk menggunakan fitur ini (Cooldown 3 hari).\n\n© 2026 @jsobfuscator | @polsekjaktim`,
          { parse_mode: "Markdown" }
        );
      }

      // 3. Cek EMAIL (1 email hanya 1x per bulan, global)
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      if (db.usedEmails && db.usedEmails[email] === currentMonth) {
        return bot.sendMessage(chatId,
          `❌ Email \`${email}\` sudah digunakan untuk aktivasi bulan ini. Gunakan email lain.\n\n© 2026 @jsobfuscator | @polsekjaktim`,
          { parse_mode: "Markdown" }
        );
      }
      vipCode = durasiMap["1bulan"];
    }

    // --- CEK VALIDASI UNTUK VIP ---
    else if (isVip && !isOwnerUser) {
      const today = new Date().toDateString();
      if (user.lastAnimeloversVipUse && new Date(user.lastAnimeloversVipUse).toDateString() === today) {
        return bot.sendMessage(chatId, "╭───〔 ⏳ LIMIT HARIAN 〕───╮\n│\n│ Anda sudah mencapai batas harian (1x sehari untuk VIP).\n│\n╰──────────────────────────────╯\n\n© 2026 @jsobfuscator | @polsekjaktim", { parse_mode: "Markdown" });
      }
      if (!email || durasiRaw !== "1bulan") {
        return bot.sendMessage(chatId,
          `╭───〔 🔓 ANIMELOVERS VIP 〕───╮\n` +
          `│\n` +
          `│ ❌ *Format salah atau tidak valid!*\n` +
          `│ Sebagai VIP, Anda hanya bisa durasi \`1bulan\`.\n` +
          `│\n` +
          `│ 🛠️ *Penggunaan*:\n` +
          `│ • \`/${match[1]} <email> 1bulan\`\n` +
          `│\n` +
          `╰──────────────────────────────╯\n\n© 2026 @jsobfuscator | @polsekjaktim`,
          { parse_mode: "Markdown" }
        );
      }
      vipCode = durasiMap["1bulan"];
    }

    // --- CEK UNTUK OWNER ---
    else if (isOwnerUser) {
      if (!email || !durasiRaw || !durasiMap[durasiRaw]) {
        const durasiList = Object.keys(durasiMap).map(k => `│ • \`${k}\``).join("\n");
        const errorText =
          `╭───〔 ❌ ERROR FORMAT 〕───╮\n` +
          `│\n` +
          `│ Format email atau durasi salah!\n` +
          `│\n` +
          `│ 📅 *Durasi Tersedia*:\n` +
          `${durasiList}\n` +
          `│\n` +
          `╰──────────────────────────────╯\n\n© 2026 @jsobfuscator | @polsekjaktim`;
        return bot.sendMessage(chatId, errorText, { parse_mode: "Markdown" });
      }
      vipCode = durasiMap[durasiRaw];
    }

    // --- PROSES AKTIVASI ---
    const processMsg = await bot.sendMessage(chatId,
      `╭───〔 🔐 STATUS PROSES 〕───╮\n│\n│ • Login ke AnimeLovers...\n│ • Target: \`${email}\`\n│\n╰──────────────────────────────╯\n\n© 2026 @jsobfuscator | @polsekjaktim`,
      { parse_mode: "Markdown" }
    );

    try {
      const token = await animeloversLogin(email);
      const before = await animeloversGetData(token);

      await bot.editMessageText(
        formatAnimeloversStatus(before, "Detail User (Sebelum)") +
        "\n\n" +
        `╭───〔 ⚡ PROSES VIP 〕───╮\n│\n│ • Mengaktifkan VIP...\n│\n╰──────────────────────────╯\n\n© 2026 @jsobfuscator | @polsekjaktim`,
        { chat_id: chatId, message_id: processMsg.message_id, parse_mode: "Markdown" }
      );

      await animeloversSetPremium(token, vipCode);
      const after = await animeloversGetData(token);

      const finalText =
        formatAnimeloversStatus(before, "Detail User (Sebelum)") +
        "\n\n" +
        formatAnimeloversStatus(after, "Detail User (Sesudah)") +
        "\n\n© 2026 @jsobfuscator | @polsekjaktim";

      await bot.editMessageText(finalText, {
        chat_id: chatId,
        message_id: processMsg.message_id,
        parse_mode: "Markdown"
      });

      // --- UPDATE DATABASE USER ---
      // Simpan timestamp aktivasi untuk cooldown (Member) atau batas harian (VIP)
      user.lastAnimeloversVipUse = Date.now();
      user.vip = true;
      user.isVip = true;
      await saveDB();

      // --- UPDATE DATABASE EMAIL (untuk member biasa) ---
      if (!isOwnerUser && !isVip) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        db.usedEmails[email] = currentMonth;
        await saveDB();
      }

    } catch (e) {
      sendErrorToOwner(e, 'animeloversvip');
      const failedText =
        `╭───〔 ❌ GAGAL PROSES 〕───╮\n│\n│ Gagal:\n│ \`${e.message}\`\n│\n╰──────────────────────────────╯\n\n© 2026 @jsobfuscator | @polsekjaktim`;
      await bot.editMessageText(failedText, {
        chat_id: chatId,
        message_id: processMsg.message_id,
        parse_mode: "Markdown"
      });
    }
  } catch (err) {
    sendErrorToOwner(err, 'animeloversvip outer');
  }
});

// --- OWNER COMMANDS: addprem / delprem / listprem ---
bot.onText(/^\/(addprem|delprem|listprem)(?:\s+(.+))?$/i, async (msg, match) => {
  try {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    if (!isOwner(userId)) {
      return bot.sendMessage(chatId, "❌ Perintah ini hanya untuk Owner.\n\n© 2026 @jsobfuscator | @polsekjaktim", { parse_mode: "Markdown" });
    }

    const action = match[1].toLowerCase();

    if (action === "listprem") {
      const vipUsers = Object.entries(db.users || {}).filter(([id, data]) => data.vip === true || data.isVip === true);
      if (vipUsers.length === 0) {
        return bot.sendMessage(chatId, "📋 Tidak ada user VIP terdaftar.\n\n© 2026 @jsobfuscator | @polsekjaktim", { parse_mode: "Markdown" });
      }
      let listText = "╭───〔 👑 DAFTAR VIP 〕───╮\n│\n";
      const today = new Date().toDateString();
      vipUsers.forEach(([id, data]) => {
        const usedToday = data.lastAnimeloversVipUse && new Date(data.lastAnimeloversVipUse).toDateString() === today;
        const statusIcon = usedToday ? "❌" : "✅";
        const statusLabel = usedToday ? "Sudah" : "Belum";
        const lastUsed = data.lastAnimeloversVipUse ? new Date(data.lastAnimeloversVipUse).toLocaleDateString('id-ID') : "-";
        listText += `│ • ID: \`${id}\`\n`;
        listText += `│   Status: ${statusIcon} ${statusLabel} (hari ini)\n`;
        listText += `│   Terakhir: ${lastUsed}\n`;
        listText += `│\n`;
      });
      listText += `╰──────────────────────────────╯\n\n© 2026 @jsobfuscator | @polsekjaktim`;
      return bot.sendMessage(chatId, listText, { parse_mode: "Markdown" });
    }

    const targetId = match[2] ? match[2].trim() : "";
    if (!targetId || !/^\d+$/.test(targetId)) {
      return bot.sendMessage(chatId, "❌ Format user ID salah. Gunakan ID numerik.\n\n© 2026 @jsobfuscator | @polsekjaktim", { parse_mode: "Markdown" });
    }

    const targetUser = getUser(targetId);

    if (action === "addprem") {
      if (targetUser.vip || targetUser.isVip) {
        return bot.sendMessage(chatId, `✅ User \`${targetId}\` sudah menjadi VIP.\n\n© 2026 @jsobfuscator | @polsekjaktim`, { parse_mode: "Markdown" });
      }
      targetUser.vip = true;
      targetUser.isVip = true;
      targetUser.lastAnimeloversVipUse = null;
      await saveDB();
      return bot.sendMessage(chatId, `✅ User \`${targetId}\` berhasil ditambahkan sebagai VIP.\n\n© 2026 @jsobfuscator | @polsekjaktim`, { parse_mode: "Markdown" });
    }

    if (action === "delprem") {
      if (!targetUser.vip && !targetUser.isVip) {
        return bot.sendMessage(chatId, `❌ User \`${targetId}\` bukan VIP.\n\n© 2026 @jsobfuscator | @polsekjaktim`, { parse_mode: "Markdown" });
      }
      targetUser.vip = false;
      targetUser.isVip = false;
      targetUser.lastAnimeloversVipUse = null;
      await saveDB();
      return bot.sendMessage(chatId, `✅ User \`${targetId}\` berhasil dihapus dari VIP.\n\n© 2026 @jsobfuscator | @polsekjaktim`, { parse_mode: "Markdown" });
    }
  } catch (err) {
    sendErrorToOwner(err, 'addprem/delprem/listprem');
  }
});

// --- ALIGHT MOTION: setalightkey ---
bot.onText(/^\/setalightkey(?:\s+(\S+))?$/i, async (msg, match) => {
  try {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    const apiKey = match[1] ? match[1].trim() : null;
    if (!apiKey) {
      return bot.sendMessage(chatId,
        `╭───〔 🔑 SET API KEY 〕───╮\n` +
        `│\n` +
        `│ Gunakan: \`/setalightkey <api_key>\`\n` +
        `│\n` +
        `│ 📌 Contoh: \`/setalightkey dkf_xxxxx\`\n` +
        `│\n` +
        `│ ❓ Belum punya API Key? Dapatkan gratis di:\n` +
        `│ @DezzAmPremBot dengan perintah \`/createkey\`\n` +
        `│\n` +
        `╰──────────────────────────────╯\n\n© 2026 @jsobfuscator | @polsekjaktim`,
        { parse_mode: "Markdown" }
      );
    }

    const user = getUser(userId);
    user.alightApiKey = apiKey;
    await saveDB();

    await bot.sendMessage(chatId,
      `✅ API Key berhasil disimpan!\n\nKey: \`${apiKey}\`\n\nSekarang kamu bisa menggunakan /alight untuk aktivasi Alight Motion.\n\n© 2026 @jsobfuscator | @polsekjaktim`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    sendErrorToOwner(err, 'setalightkey');
  }
});

// --- ALIGHT MOTION: cekkey ---
bot.onText(/^\/cekkey$/i, async (msg) => {
  try {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    const user = getUser(userId);
    if (!user.alightApiKey) {
      return bot.sendMessage(chatId,
        `❌ Kamu belum menyimpan API Key.\n\nGunakan \`/setalightkey <api_key>\` untuk menyimpan.\nDapatkan key gratis di @DezzAmPremBot dengan \`/createkey\`.\n\n© 2026 @jsobfuscator | @polsekjaktim`,
        { parse_mode: "Markdown" }
      );
    }

    await bot.sendMessage(chatId,
      `╭───〔 🔑 API KEY ANDA 〕───╮\n│\n│ Key: \`${user.alightApiKey}\`\n│\n╰──────────────────────────────╯\n\n© 2026 @jsobfuscator | @polsekjaktim`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    sendErrorToOwner(err, 'cekkey');
  }
});

// --- ALIGHT MOTION: testkey ---
bot.onText(/^\/testkey$/i, async (msg) => {
  try {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    const user = getUser(userId);
    if (!user.alightApiKey) {
      return bot.sendMessage(chatId,
        `❌ Kamu belum menyimpan API Key.\n\nGunakan \`/setalightkey <api_key>\` terlebih dahulu.\n\n© 2026 @jsobfuscator | @polsekjaktim`,
        { parse_mode: "Markdown" }
      );
    }

    await bot.sendMessage(chatId, "⏳ Mengecek validitas API Key...");
    try {
      const testEmail = "test@example.com";
      const result = await alightSend(testEmail, user.alightApiKey);
      if (result.success) {
        await bot.sendMessage(chatId,
          `✅ **API Key valid!**\n\nResponse dari server:\n\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\`` +
          `\n\n© 2026 @jsobfuscator | @polsekjaktim`,
          { parse_mode: "Markdown" }
        );
      } else {
        let detail = `❌ **API Key tidak valid atau error**\n\n`;
        detail += `Pesan: ${result.message}\n`;
        if (result.status) detail += `Status HTTP: ${result.status}\n`;
        if (result.raw) {
          const rawStr = typeof result.raw === 'string' ? result.raw : JSON.stringify(result.raw);
          detail += `\n\nDetail server:\n\`\`\`\n${rawStr.slice(0, 300)}\n\`\`\``;
        }
        detail += `\n\n💡 Pastikan API Key benar dan belum kedaluwarsa.\n\n© 2026 @jsobfuscator | @polsekjaktim`;
        await bot.sendMessage(chatId, detail, { parse_mode: "Markdown" });
      }
    } catch (e) {
      sendErrorToOwner(e, 'testkey');
      await bot.sendMessage(chatId,
        `❌ Error saat mengetes key: ${e.message}\n\n© 2026 @jsobfuscator | @polsekjaktim`,
        { parse_mode: "Markdown" }
      );
    }
  } catch (err) {
    sendErrorToOwner(err, 'testkey outer');
  }
});

// --- ALIGHT MOTION: alight (Hanya VIP) ---
bot.onText(/^\/alight$/i, async (msg) => {
  try {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    const user = getUser(userId);
    const isVip = user.vip || user.isVip || false;

    if (!isVip) {
      return bot.sendMessage(chatId,
        `╭───〔 ❌ AKSES DITOLAK 〕───╮\n` +
        `│\n` +
        `│ Fitur Alight Motion Premium hanya untuk VIP.\n` +
        `│\n` +
        `│ 💡 Upgrade ke VIP untuk mengakses.\n` +
        `│\n` +
        `╰──────────────────────────────╯\n\n© 2026 @jsobfuscator | @polsekjaktim`,
        { parse_mode: "Markdown" }
      );
    }

    if (!user.alightApiKey) {
      return bot.sendMessage(chatId,
        `╭───〔 ⚠️ API KEY BELUM DISET 〕───╮\n` +
        `│\n` +
        `│ Untuk menggunakan /alight, kamu harus punya API Key.\n` +
        `│\n` +
        `│ Dapatkan gratis di @DezzAmPremBot dengan \`/createkey\`\n` +
        `│ Lalu simpan dengan \`/setalightkey <key>\`\n` +
        `│\n` +
        `╰────────────────────────────────────╯\n\n© 2026 @jsobfuscator | @polsekjaktim`,
        { parse_mode: "Markdown" }
      );
    }

    const session = getAlightSession(userId);
    if (session.step) clearAlightSession(userId);

    const startMsg =
      `╭───〔 ✨ ALIGHT MOTION PREMIUM 〕───╮\n` +
      `│\n` +
      `│ 🔑 API Key terdeteksi: \`${user.alightApiKey.substring(0, 10)}...\`\n` +
      `│\n` +
      `│ 📌 **Langkah 1:** Masukkan email yang terdaftar di Alight Motion.\n` +
      `│\n` +
      `│ *Contoh:* \`user@gmail.com\`\n` +
      `│\n` +
      `│ ⚠️ *Catatan:* Magic link hanya berlaku 15-30 menit. Jangan tunggu lama.\n` +
      `│\n` +
      `│ Ketik /alightcancel untuk membatalkan kapan saja.\n` +
      `│\n` +
      `╰────────────────────────────────────╯\n\n© 2026 @jsobfuscator | @polsekjaktim`;

    session.step = "email";
    await saveDB();
    await bot.sendMessage(chatId, startMsg, { parse_mode: "Markdown" });
  } catch (err) {
    sendErrorToOwner(err, 'alight');
  }
});

// --- ALIGHT MOTION: alightcancel (Hanya VIP) ---
bot.onText(/^\/alightcancel$/i, async (msg) => {
  try {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    const user = getUser(userId);
    const isVip = user.vip || user.isVip || false;

    if (!isVip) {
      return bot.sendMessage(chatId,
        `╭───〔 ❌ AKSES DITOLAK 〕───╮\n` +
        `│\n` +
        `│ Fitur Alight Motion Premium hanya untuk VIP.\n` +
        `│\n` +
        `│ 💡 Upgrade ke VIP untuk mengakses.\n` +
        `│\n` +
        `╰──────────────────────────────╯\n\n© 2026 @jsobfuscator | @polsekjaktim`,
        { parse_mode: "Markdown" }
      );
    }

    if (db.alightSessions && db.alightSessions[userId]) {
      clearAlightSession(userId);
      await bot.sendMessage(chatId, "❌ Proses Alight Motion dibatalkan.\n\n© 2026 @jsobfuscator | @polsekjaktim", { parse_mode: "Markdown" });
    } else {
      await bot.sendMessage(chatId, "Tidak ada sesi Alight Motion yang aktif.\n\n© 2026 @jsobfuscator | @polsekjaktim", { parse_mode: "Markdown" });
    }
  } catch (err) {
    sendErrorToOwner(err, 'alightcancel');
  }
});

// --- BROADCAST ---
bot.onText(/\/bc (.+)/, async (msg, match) => {
  try {
    const userId = msg.from.id;
    if (!isOwner(userId)) return;

    const textToBroadcast = match[1];
    const userIds = Object.keys(db.users);
    bot.sendMessage(userId, `🚀 <b>Memulai Broadcast...</b>\nTarget: ${userIds.length} User.`, { parse_mode: 'HTML' });

    let sukses = 0, gagal = 0;
    for (const id of userIds) {
      try {
        await new Promise(resolve => setTimeout(resolve, 60));
        await bot.sendMessage(id, textToBroadcast, { parse_mode: 'HTML' });
        sukses++;
      } catch (err) { gagal++; }
    }
    bot.sendMessage(userId, `✅ <b>Broadcast Selesai!</b>\n\n🟢 Sukses: ${sukses}\n🔴 Gagal: ${gagal}`, { parse_mode: 'HTML' });
  } catch (err) {
    sendErrorToOwner(err, 'broadcast');
  }
});

// --- BAN / UNBAN ---
bot.onText(/\/ban (.+)/, async (msg, match) => {
  try {
    if (!isOwner(msg.from.id)) return;
    const targetId = match[1].trim();
    if (!db.users[targetId]) return bot.sendMessage(msg.from.id, "❌ ID tidak ditemukan.");
    const targetUser = getUser(targetId);
    targetUser.isBanned = true;
    await saveDB();
    bot.sendMessage(msg.from.id, `✅ User <code>${targetId}</code> berhasil di-BANNED.`, { parse_mode: 'HTML' });
    bot.sendMessage(targetId, "🚫 <b>AKUN KAMU DI BANNED!</b>\nKamu tidak bisa lagi menggunakan layanan bot ini.", { parse_mode: 'HTML' }).catch(() => {});
  } catch (err) {
    sendErrorToOwner(err, 'ban');
  }
});

bot.onText(/\/unban (.+)/, async (msg, match) => {
  try {
    if (!isOwner(msg.from.id)) return;
    const targetId = match[1].trim();
    if (!db.users[targetId]) return bot.sendMessage(msg.from.id, "❌ ID tidak ditemukan.");
    const targetUser = getUser(targetId);
    targetUser.isBanned = false;
    await saveDB();
    bot.sendMessage(msg.from.id, `✅ User <code>${targetId}</code> telah di-UNBAN.`, { parse_mode: 'HTML' });
    bot.sendMessage(targetId, "✅ <b>AKUN KEMBALI AKTIF!</b>\nSekarang kamu bisa menggunakan bot lagi.", { parse_mode: 'HTML' }).catch(() => {});
  } catch (err) {
    sendErrorToOwner(err, 'unban');
  }
});

// --- MAINTENANCE ---
bot.onText(/\/maint on/, async (msg) => {
  try {
    if (!isOwner(msg.from.id)) return;
    db.maintenance = true;
    await saveDB();
    bot.sendMessage(msg.from.id, "🔴 <b>Maintenance DIAKTIFKAN.</b>\nUser biasa tidak bisa mengakses bot sekarang.", { parse_mode: 'HTML' });
  } catch (err) {
    sendErrorToOwner(err, 'maint on');
  }
});

bot.onText(/\/maint off/, async (msg) => {
  try {
    if (!isOwner(msg.from.id)) return;
    db.maintenance = false;
    await saveDB();
    bot.sendMessage(msg.from.id, "🟢 <b>Maintenance DIMATIKAN.</b>\nBot kembali normal untuk semua user.", { parse_mode: 'HTML' });
  } catch (err) {
    sendErrorToOwner(err, 'maint off');
  }
});

// ============================================================
//  STARTUP
// ============================================================
console.log(`🤖 Bot ${config.botName || 'Sano Official'} berjalan...`);
console.log(`👥 Owner ID: ${config.ownerId}`);
console.log(`👥 Owner IDs: ${config.ownerIds.join(', ') || '(none)'}`);
console.log(`📂 Database: ${dbFile}`);
console.log(`📂 Temporary folder: ${TMP_DIR}`);
console.log(`📝 Copyright © 2026 @jsobfuscator | @polsekjaktim`);

// ============================================================
//  ERROR HANDLING GLOBAL
// ============================================================
process.on('uncaughtException', (err) => {
  sendErrorToOwner(err, 'uncaughtException');
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  sendErrorToOwner(reason, 'unhandledRejection');
  console.error('Unhandled Rejection:', reason);
});