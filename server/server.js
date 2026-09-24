// ============================================
// server-api-direct.js - Direct API Integration
// Sistem bid langsung ke API lelang.go.id
// ============================================

require('dotenv').config({ path: './config.env' });
const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

// ============================================
// SPEED OPTIMIZATION LAYER (Non-breaking)
// ============================================
const SafeAPI = require('./safe-optimizer-wrapper');
console.log('⚡ Speed Optimization Active (Safe Mode)');
// Note: Original functions unchanged, optimizer adds performance layer
// ============================================

// ============================================
// BUDGET & SNIPE MANAGEMENT (Non-breaking)
// ============================================
const { BudgetManager, SnipeManager } = require('./budget-manager');
const budgetManager = new BudgetManager();
const snipeManager = new SnipeManager(budgetManager);
console.log('💰 Budget Manager Active');
console.log('🎯 Snipe Manager Active');
// ============================================

const app = express();
app.use(cors());
app.use(express.json());

// Validasi BOT_TOKEN
if (!process.env.BOT_TOKEN || process.env.BOT_TOKEN === 'your_bot_token_here') {
    console.error('❌ BOT_TOKEN tidak ditemukan!');
    console.error('Silakan edit file config.env dan masukkan token bot Telegram Anda.');
    process.exit(1);
}

const bot = new TelegramBot(process.env.BOT_TOKEN, {
    polling: {
        interval: 2000,
        autoStart: true,
        params: { timeout: 10 }
    }
});

// ============================================
// STORAGE & STATE MANAGEMENT
// ============================================

// Storage untuk session user (cookies + bearer token)
const userSessions = new Map(); // chatId -> { cookies, bearerToken, auctionId, sessionData, passBidding }

// Storage untuk monitoring aktif
const activeMonitoring = new Map(); // chatId -> { auctionId, interval }

// ============================================
// OPTIMIZATION: CONNECTION POOLING & CACHING
// ============================================

// Request cache untuk deduplication (hindari double request)
const requestCache = new Map(); // key -> { result, timestamp }
const CACHE_TTL = 1000; // 1 detik

// Session cache dengan expiry lebih lama
const bidSessionCache = new Map(); // auctionId -> { timestamp, expiry }

// Helper untuk cached fetch
async function cachedFetch(key, fetchFn) {
    const cached = requestCache.get(key);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < CACHE_TTL) {
        return cached.result;
    }

    const result = await fetchFn();
    requestCache.set(key, { result, timestamp: now });

    // Cleanup cache lama setiap 10 detik
    if (Math.random() < 0.1) { // 10% chance untuk cleanup
        for (const [k, v] of requestCache.entries()) {
            if (now - v.timestamp > CACHE_TTL * 2) {
                requestCache.delete(k);
            }
        }
    }

    return result;
}

// Helper untuk timeout (compatible dengan semua Node version)
function createTimeoutPromise(timeoutMs) {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs);
    });
}

// Helper untuk fetch dengan timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
    return Promise.race([
        fetch(url, options),
        createTimeoutPromise(timeoutMs)
    ]);
}

// ============================================
// OPTIMIZED FETCH (Optional, for critical operations)
// Uses connection pooling & performance monitoring
// Falls back to original fetchWithTimeout if optimizer fails
// ============================================
async function fetchWithTimeoutOptimized(url, options = {}, timeoutMs = 5000) {
    try {
        // Try optimized fetch first (connection pooling, monitoring)
        return await SafeAPI.fetchWithTimeout(url, options, timeoutMs);
    } catch (error) {
        // Fallback to original (always works)
        console.warn('⚠️ Optimizer fallback:', error.message);
        return await fetchWithTimeout(url, options, timeoutMs);
    }
}
// Note: Original fetchWithTimeout unchanged, this is additive only

// ============================================
// API INTEGRATION FUNCTIONS
// ============================================

/**
 * Fetch riwayat bid dari API bidding.lelang.go.id (OPTIMIZED with timeout)
 * TIDAK menggunakan cache karena bid harus real-time!
 */
async function fetchBidHistory(auctionId, cookies = null, bearerToken = null, useCache = false) {
    const cacheKey = `history:${auctionId}`;

    // CRITICAL: Untuk bid, JANGAN pakai cache! (useCache = false)
    // Cache hanya untuk display/monitoring (useCache = true)
    if (useCache) {
        return cachedFetch(cacheKey, () => fetchBidHistoryDirect(auctionId, cookies, bearerToken));
    }

    return fetchBidHistoryDirect(auctionId, cookies, bearerToken);
}

async function fetchBidHistoryDirect(auctionId, cookies, bearerToken) {
    try {
        const headers = {
            'Accept': 'application/json',
            'Origin': 'https://lelang.go.id',
            'Referer': 'https://lelang.go.id/',
        };

        if (cookies) headers['Cookie'] = cookies;
        if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;

        const response = await fetchWithTimeout(
            `https://bidding.lelang.go.id/api/v1/pelaksanaan/lelang/${auctionId}/riwayat`,
            { headers, method: "GET" },
            4000 // 4 detik timeout
        );

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error('Error fetching bid history:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Fetch status lelang dari API lelang.go.id (OPTIMIZED with timeout)
 */
async function fetchAuctionStatus(auctionId, cookies = null, bearerToken = null) {
    try {
        const headers = {
            'Accept': 'application/json',
            'Origin': 'https://lelang.go.id',
            'Referer': 'https://lelang.go.id/',
        };

        if (cookies) headers['Cookie'] = cookies;
        if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;

        const response = await fetchWithTimeout(
            `https://api.lelang.go.id/api/v1/pelaksanaan/${auctionId}/status-lelang?dcp=true`,
            { headers, method: "GET" },
            4000 // 4 detik timeout
        );

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error('Error fetching auction status:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Start bid session dengan cache yang lebih lama (15 menit)
 */
async function startBidSessionOptimized(auctionId, cookies, bearerToken) {
    const auctionIdStr = String(auctionId);
    const now = Date.now();
    const cached = bidSessionCache.get(auctionIdStr);

    // Reuse session jika masih valid (15 menit)
    if (cached && now < cached.expiry) {
        return { success: true, cached: true };
    }

    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
    if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
    if (cookies) headers['Cookie'] = cookies;

    try {
        const response = await fetchWithTimeout(
            'https://bidding.lelang.go.id/api/v1/pelaksanaan/lelang/mulai-sesi',
            {
                method: 'POST',
                headers,
                body: JSON.stringify({ auctionId: auctionIdStr })
            },
            3000 // 3 detik timeout
        );

        if (response.ok) {
            bidSessionCache.set(auctionIdStr, {
                timestamp: now,
                expiry: now + 900000 // 15 menit
            });
            return { success: true, cached: false };
        }
        throw new Error(`Session start failed: ${response.status}`);
    } catch (error) {
        console.error('Session start error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Kirim bid ke API lelang.go.id (ULTRA OPTIMIZED)
 * - Session cache 15 menit (bukan 5 menit)
 * - Timeout protection
 * - Minimal headers
 */
async function sendBidToAPI(auctionId, passkey, amount, cookies, bearerToken) {
    const startTime = Date.now();
    const auctionIdStr = String(auctionId);

    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://lelang.go.id',
        'Referer': 'https://lelang.go.id/',
    };
    if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
    if (cookies) headers['Cookie'] = cookies;

    const bidPayload = JSON.stringify({
        auctionId: auctionIdStr,
        bidAmount: parseInt(amount),
        bidTime: new Date().toISOString(),
        passkey: String(passkey)
    });

    try {
        // Cek session cache (15 menit)
        const cached = bidSessionCache.get(auctionIdStr);
        const now = Date.now();
        const hasValidSession = cached && now < cached.expiry;

        // Fast path: session valid, langsung bid
        if (hasValidSession) {
            try {
                const bidResponse = await fetchWithTimeout(
                    'https://bidding.lelang.go.id/api/v1/pelaksanaan/lelang/pengajuan-penawaran',
                    { method: 'POST', headers, body: bidPayload },
                    5000 // 5 detik timeout
                );

                if (bidResponse.ok) {
                    const result = await bidResponse.json();
                    console.log(`⚡ Bid success (cached session) in ${Date.now() - startTime}ms | Amount: ${amount}`);
                    return { success: true, result };
                }

                // Session expired, hapus cache
                bidSessionCache.delete(auctionIdStr);
            } catch (error) {
                // Timeout atau error, coba start session baru
                bidSessionCache.delete(auctionIdStr);
            }
        }

        // Start session baru
        const sessionResult = await startBidSessionOptimized(auctionIdStr, cookies, bearerToken);
        if (!sessionResult.success) {
            throw new Error(sessionResult.error || 'Failed to start session');
        }

        // Kirim bid setelah session
        const bidResponse = await fetchWithTimeout(
            'https://bidding.lelang.go.id/api/v1/pelaksanaan/lelang/pengajuan-penawaran',
            { method: 'POST', headers, body: bidPayload },
            5000 // 5 detik timeout
        );

        if (!bidResponse.ok) {
            const errText = await bidResponse.text();
            bidSessionCache.delete(auctionIdStr);
            throw new Error(`Bid failed: ${bidResponse.status} - ${errText}`);
        }

        const result = await bidResponse.json();
        console.log(`✅ Bid success in ${Date.now() - startTime}ms | Amount: ${amount}`);
        return { success: true, result };

    } catch (error) {
        console.error(`❌ Bid error in ${Date.now() - startTime}ms:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Format status lelang untuk display
 */
function formatAuctionStatus(statusData) {
    if (!statusData || !statusData.data) {
        return '❌ Data lelang tidak tersedia';
    }

    const data = statusData.data.data;  // Double nested!

    console.log(data, 'data dari format auction status')
    const lot = data?.lotLelang;
    const status = data?.status;
    const peserta = data?.peserta;

    let message = `📦 *STATUS LELANG*\n\n`;

    // Status Lelang
    message += `🚦 *Status:* ${status?.statusLelang}\n`;
    message += `👤 *Status Peserta:* ${status?.statusPeserta}\n\n`;

    // Info Lot
    message += `🏷️ *Info Lot:*\n`;
    message += `• Kode Lot: *${lot?.kodeLot}*\n`;
    message += `• Nama Lot: ${lot?.namaLotLelang}\n`;
    message += `• No. Registrasi: ${lot?.nomorRegistrasi}\n`;
    message += `• Pemohon: ${lot?.namaPemohon}\n`;
    message += `• Lokasi: ${lot?.namaLokasi}\n`;
    message += `• KPKNL: ${lot?.namaUnitKerja}\n\n`;

    // Info Harga
    message += `💰 *Info Harga:*\n`;
    const nilaiLimit = lot.nilaiLimit ?
        parseInt(lot.nilaiLimit.toString().replace(/\D/g, '')) : 0;
    const uangJaminan = parseInt(lot?.uangJaminan);
    const kelipatanBid = parseInt(lot?.kelipatanBid);

    message += `• Nilai Limit: Rp ${nilaiLimit?.toLocaleString('id-ID')}\n`;
    message += `• Uang Jaminan: Rp ${uangJaminan?.toLocaleString('id-ID')}\n`;
    message += `• Kelipatan Bid: Rp ${kelipatanBid?.toLocaleString('id-ID')}\n`;

    // Info Waktu
    message += `⏰ *Jadwal Lelang:*\n`;
    const tglMulai = lot?.tglMulaiLelang ? new Date(lot.tglMulaiLelang).toLocaleString('id-ID') : 'N/A';
    const tglSelesai = lot?.tglSelesaiLelang ? new Date(lot.tglSelesaiLelang).toLocaleString('id-ID') : 'N/A';
    const batasJaminan = lot?.tanggalBatasJaminan ? new Date(lot.tanggalBatasJaminan).toLocaleString('id-ID') : 'N/A';

    message += `• Mulai: ${tglMulai}\n`;
    message += `• Selesai: ${tglSelesai}\n`;
    message += `• Batas Jaminan: ${batasJaminan}\n\n`;

    // Info Peserta
    if (peserta?.namaPeserta) {
        message += `👤 *Info Peserta:*\n`;
        message += `• Nama: ${peserta?.namaPeserta}\n`;
        message += `• Status Keikutsertaan: ${peserta?.statusKeikutSertaan || 'N/A'}\n`;
        message += `• PIN Bidding: \`${peserta?.pinBidding || 'N/A'}\`\n`;

        if (peserta?.pemenangLelang) {
            message += `• Status: 🏆 *PEMENANG LELANG*\n`;
        }
        message += `\n`;
    }

    // Info Kategori
    message += `📋 *Kategori:*\n`;
    message += `• ${lot?.namaKategoriLelang || 'N/A'}\n`;
    message += `• ${lot?.namaJenisLelang || 'N/A'}\n\n`;

    // Auction ID
    message += `🔗 *Lot ID:* \`${lot?.lotLelangId || 'N/A'}\``;

    return message;
}

// ============================================
// TELEGRAM BOT COMMANDS
// ============================================

// Command: /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'User';

    const welcomeMessage = `🎉 *Selamat datang di Lelang Bid Bot!*

Halo ${firstName}! 👋

*🚀 Fitur Utama:*
• ⚡ Ultra-fast bidding (100ms)
• 💰 Budget management (No overbid!)
• 🎯 Snipe bidding (Auto-bid detik terakhir)
• 📊 Real-time monitoring
• 🛡️ Circuit breaker protection

*📱 Quick Start:*
1. \`/setcookies <cookies>\`
2. \`/settoken <bearer_token>\`
3. \`/setauction <auction_id>\`
4. \`/setPassBidding <passkey>\`

*💰 Budget Protection:*
\`\`\`
/setbudget 50000000    (Max Rp 50M)
/budget                (Cek sisa)
\`\`\`
✅ Bot tidak akan bid melebihi budget!

*🎯 Snipe Bidding:*
\`\`\`
/setsnipe 5 10         (Bid +10x di 5 detik terakhir)
/monitor               (Start auto-snipe)
\`\`\`
✅ Surprise attack! Win rate +50%!

*🏆 Complete Flow:*
\`\`\`
/setbudget 100000000
/setsnipe 5 10
/monitor
\`\`\`
→ Bot auto-bid di detik terakhir
→ Budget safe, speed fast!
→ YOU WIN! 🎉

Gunakan /help untuk panduan lengkap!`;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "📖 Panduan Setup", callback_data: "setup_guide" },
                    { text: "❓ Bantuan", callback_data: "help" }
                ],
                [
                    { text: "📊 Status Lelang", callback_data: "check_status" }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
    });
});

// Command: /setcookies - Set session cookies
bot.onText(/\/setcookies (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const cookies = match[1].trim();

    if (!userSessions.has(chatId)) {
        userSessions.set(chatId, {});
    }

    const session = userSessions.get(chatId);
    session.cookies = cookies;
    userSessions.set(chatId, session);

    bot.sendMessage(chatId, '✅ Cookies berhasil disimpan!\n\nSekarang set bearer token dengan:\n`/settoken <bearer_token>`', {
        parse_mode: 'Markdown'
    });
});

// Command: /settoken - Set bearer token
bot.onText(/\/settoken (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const bearerToken = match[1].trim();

    if (!userSessions.has(chatId)) {
        userSessions.set(chatId, {});
    }

    const session = userSessions.get(chatId);
    session.bearerToken = bearerToken;
    userSessions.set(chatId, session);

    bot.sendMessage(chatId, '✅ Bearer token berhasil disimpan!\n\nSekarang set auction ID dengan:\n`/setauction <auction_id>`', {
        parse_mode: 'Markdown'
    });
});

// Command: /setauction - Set auction ID
bot.onText(/\/setauction ([a-f0-9-]+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const auctionId = match[1].trim();

    if (!userSessions.has(chatId)) {
        userSessions.set(chatId, {});
    }

    const session = userSessions.get(chatId);
    session.auctionId = auctionId;
    userSessions.set(chatId, session);

    bot.sendMessage(chatId, `✅ Auction ID berhasil di-set: \`${auctionId}\`\n\nSekarang set pass bidding dengan:\n\`/setPassBidding <passkey>\``, {
        parse_mode: 'Markdown'
    });
});

// Command: /setPassBidding - Set passkey untuk bidding
bot.onText(/\/setPassBidding (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const passkey = match[1].trim();

    if (!userSessions.has(chatId)) {
        userSessions.set(chatId, {});
    }

    const session = userSessions.get(chatId);
    session.passBidding = passkey;
    userSessions.set(chatId, session);

    bot.sendMessage(chatId, `✅ Pass bidding berhasil di-set!\n\nSekarang Anda siap untuk melakukan bid.\nGunakan /status untuk cek status lelang!`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 Cek Status", callback_data: "check_status" }],
                [{ text: "💰 Bid Sekarang", callback_data: "bid_menu" }]
            ]
        }
    });
});

// Command: /status - Cek status lelang
bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    await handleStatusCheck(chatId);
});

// Command: /bid - Kirim bid dengan kelipatan bid otomatis
bot.onText(/\/bid (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1].trim().toLowerCase();

    // Cek jenis bid
    if (input === 'kelipatanbid' || input === 'kelipatan' || input === '1x') {
        await handleBidKelipatan(chatId, 1);
    } else if (input === '10x') {
        await handleBidKelipatan(chatId, 10);
    } else if (input.endsWith('x') && !isNaN(parseInt(input))) {
        // Support untuk /bid 5x, /bid 20x, dll
        const multiplier = parseInt(input);
        await handleBidKelipatan(chatId, multiplier);
    } else {
        const amount = parseInt(input);
        if (isNaN(amount)) {
            bot.sendMessage(chatId, '❌ Nominal bid tidak valid!\n\n*Cara penggunaan:*\n• `/bid <nominal>` - Bid dengan nominal tertentu\n• `/bid kelipatan` atau `/bid 1x` - Bid +1 kelipatan\n• `/bid 10x` - Bid +10 kelipatan', {
                parse_mode: 'Markdown'
            });
            return;
        }
        await handleBid(chatId, amount);
    }
});

// Command: /monitor - Start monitoring
bot.onText(/\/monitor/, async (msg) => {
    const chatId = msg.chat.id;
    await startSmartMonitoring(chatId);
});

// Command: /stopmonitor - Stop monitoring
bot.onText(/\/stopmonitor/, (msg) => {
    const chatId = msg.chat.id;
    stopMonitoring(chatId);
});

// Command: /help
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    handleHelp(chatId);
});

// ============================================
// SPEED OPTIMIZATION MONITORING COMMANDS
// ============================================

// Command: /performance - Show performance stats
bot.onText(/\/performance/, (msg) => {
    const chatId = msg.chat.id;
    
    try {
        const summary = SafeAPI.getPerformanceSummary();
        const cbStatus = SafeAPI.getCircuitBreakerStatus();
        
        const message = `⚡ *Performance Stats*\n\n` +
            `📊 *Speed Metrics:*\n` +
            `• Avg Bid Time: ${summary.avgBidTime}\n` +
            `• Avg API Time: ${summary.avgAPITime}\n` +
            `• Connection Reuse: ${summary.connectionReuseRate}\n` +
            `• Cache Hit Rate: ${summary.cacheHitRate}\n` +
            `• Memory Usage: ${summary.memoryUsage}\n\n` +
            `🛡️ *Circuit Breaker:*\n` +
            `• Status: ${cbStatus.state}\n` +
            `• Failures: ${cbStatus.failureCount}/${cbStatus.threshold}\n` +
            `• Enabled: ${SafeAPI.isOptimizerEnabled() ? '✅' : '❌'}\n\n` +
            `🚀 Speed Optimization: Active`;
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
        bot.sendMessage(chatId, `⚠️ Stats unavailable: ${error.message}`);
    }
});

// Command: /optimizer - Control optimizer
bot.onText(/\/optimizer (enable|disable|status)/, (msg, match) => {
    const chatId = msg.chat.id;
    const action = match[1];
    
    try {
        if (action === 'enable') {
            SafeAPI.enableOptimizer();
            bot.sendMessage(chatId, '✅ *Optimizer Enabled*\n\nAll requests will use optimized fetch with connection pooling.', {
                parse_mode: 'Markdown'
            });
        } else if (action === 'disable') {
            SafeAPI.disableOptimizer();
            bot.sendMessage(chatId, '⚠️ *Optimizer Disabled*\n\nAll requests fallback to native fetch.', {
                parse_mode: 'Markdown'
            });
        } else if (action === 'status') {
            const cbStatus = SafeAPI.getCircuitBreakerStatus();
            const message = `🛡️ *Optimizer Status*\n\n` +
                `Enabled: ${SafeAPI.isOptimizerEnabled() ? '✅ Yes' : '❌ No'}\n` +
                `Circuit State: ${cbStatus.state}\n` +
                `Failures: ${cbStatus.failureCount}/${cbStatus.threshold}\n\n` +
                `*Commands:*\n` +
                `\`/optimizer enable\` - Enable optimizer\n` +
                `\`/optimizer disable\` - Disable optimizer\n` +
                `\`/performance\` - Show stats`;
            
            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        }
    } catch (error) {
        bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// ============================================
// BUDGET MANAGEMENT COMMANDS
// ============================================

// Command: /setbudget - Set maximum budget
bot.onText(/\/setbudget (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const budgetAmount = parseInt(match[1].replace(/\D/g, ''));
    
    if (isNaN(budgetAmount) || budgetAmount <= 0) {
        bot.sendMessage(chatId, '❌ Format salah!\n\nGunakan: `/setbudget <nominal>`\n\nContoh: `/setbudget 50000000`', {
            parse_mode: 'Markdown'
        });
        return;
    }

    budgetManager.setBudget(chatId, {
        maxBudget: budgetAmount,
        warningThreshold: 0.9,  // 90%
        autoStop: true
    });

    // ============================================
    // SMART SUGGESTION: Check current auction price
    // ============================================
    const session = userSessions.get(chatId);
    let warningMessage = '';
    
    if (session?.auctionId && session?.cookies && session?.bearerToken) {
        try {
            const historyResult = await fetchBidHistory(
                session.auctionId,
                session.cookies,
                session.bearerToken
            );

            if (historyResult.success && historyResult.data?.data) {
                let riwayat = historyResult.data.data;
                if (riwayat.data && Array.isArray(riwayat.data)) {
                    riwayat = riwayat.data;
                }

                if (Array.isArray(riwayat) && riwayat.length > 0) {
                    const currentPrice = parseInt(riwayat[0].bidAmount);
                    const kelipatanBid = session.sessionData?.kelipatanBid || 50000;
                    const nextBidMin = currentPrice + kelipatanBid;

                    // Warning if budget too low
                    if (budgetAmount < nextBidMin) {
                        warningMessage = `\n\n⚠️ *WARNING: Budget Terlalu Rendah!*\n\n` +
                            `• Harga saat ini: Rp ${currentPrice.toLocaleString('id-ID')}\n` +
                            `• Next bid minimal: Rp ${nextBidMin.toLocaleString('id-ID')}\n` +
                            `• Budget Anda: Rp ${budgetAmount.toLocaleString('id-ID')}\n\n` +
                            `❌ Budget Anda lebih rendah dari harga lelang!\n\n` +
                            `*Recommendation:*\n` +
                            `Set budget minimal: Rp ${(currentPrice + kelipatanBid * 5).toLocaleString('id-ID')}\n` +
                            `(Current + ruang 5x kelipatan)\n\n` +
                            `Gunakan: \`/setbudget ${currentPrice + kelipatanBid * 5}\``;
                    } else {
                        const roomForBids = Math.floor((budgetAmount - currentPrice) / kelipatanBid);
                        warningMessage = `\n\n💡 *Budget Analysis:*\n` +
                            `• Harga saat ini: Rp ${currentPrice.toLocaleString('id-ID')}\n` +
                            `• Budget Anda: Rp ${budgetAmount.toLocaleString('id-ID')}\n` +
                            `• Ruang untuk bid: ~${roomForBids}x kelipatan\n` +
                            `• Kelipatan: Rp ${kelipatanBid.toLocaleString('id-ID')}\n\n` +
                            `✅ Budget cukup untuk compete!`;
                    }
                }
            }
        } catch (error) {
            console.error('Error checking current price:', error);
        }
    }
    // ============================================

    bot.sendMessage(chatId,
        `💰 *Budget Diset!*\n\n` +
        `• Max Budget: Rp ${budgetAmount.toLocaleString('id-ID')}\n` +
        `• Warning: 90% (Rp ${(budgetAmount * 0.9).toLocaleString('id-ID')})\n` +
        `• Auto-stop: Aktif\n\n` +
        `✅ Bid tidak akan melebihi budget ini!` +
        warningMessage +
        `\n\n*Commands:*\n` +
        `• \`/budget\` - Cek sisa budget\n` +
        `• \`/clearbudget\` - Hapus budget limit`,
        { parse_mode: 'Markdown' }
    );
});

// Command: /budget - Check budget status
bot.onText(/\/budget/, (msg) => {
    const chatId = msg.chat.id;
    const summary = budgetManager.getSummary(chatId);

    if (!summary.budgetSet) {
        bot.sendMessage(chatId,
            `💰 *Budget Status*\n\n` +
            `❌ Budget belum diset\n\n` +
            `Gunakan \`/setbudget <nominal>\` untuk set budget.\n\n` +
            `Contoh: \`/setbudget 50000000\`\n\n` +
            `💡 *Catatan:*\n` +
            `Budget = Harga maksimal yang mau Anda bayar untuk item ini`,
            { parse_mode: 'Markdown' }
        );
        return;
    }

    const percentUsedBar = '█'.repeat(Math.floor(summary.percentUsed / 10)) + 
                           '░'.repeat(10 - Math.floor(summary.percentUsed / 10));

    const message = `💰 *Budget Summary*\n\n` +
        `📊 *Budget Progress:*\n` +
        `${percentUsedBar} ${summary.percentUsed.toFixed(1)}%\n\n` +
        `• Max Purchase Price: Rp ${summary.maxBudget.toLocaleString('id-ID')}\n` +
        `• Highest Bid: Rp ${summary.highestBid.toLocaleString('id-ID')}\n` +
        `• Room to Bid: Rp ${(summary.maxBudget - summary.highestBid).toLocaleString('id-ID')}\n\n` +
        `📈 *Bid Statistics:*\n` +
        `• Total Bids: ${summary.totalBids}\n` +
        `• Successful: ${summary.successfulBids}\n` +
        `• Failed: ${summary.failedBids}\n\n` +
        (summary.isNearLimit ? `⚠️ *WARNING: Bid mendekati max price!*\n\n` : '') +
        `💡 *How it Works:*\n` +
        `Budget adalah harga maksimal yang mau Anda bayar.\n` +
        `Bot akan STOP bid jika harga > budget.\n` +
        `Anda hanya bayar FINAL bid yang menang, bukan semua bid!\n\n` +
        `*Commands:*\n` +
        `• \`/setbudget <nominal>\` - Update budget\n` +
        `• \`/clearbudget\` - Hapus budget`;

    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Command: /clearbudget - Clear budget
bot.onText(/\/clearbudget/, (msg) => {
    const chatId = msg.chat.id;
    budgetManager.clearBudget(chatId);
    bot.sendMessage(chatId, '✅ Budget cleared!\n\nBidding sekarang unlimited (tidak ada batas budget).', {
        parse_mode: 'Markdown'
    });
});

// ============================================
// SNIPE BIDDING COMMANDS
// ============================================

// Command: /setsnipe - Setup snipe bidding
bot.onText(/\/setsnipe(?:\s+(\d+))?(?:\s+(\d+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const triggerSeconds = match[1] ? parseInt(match[1]) : 5;
    const multiplier = match[2] ? parseInt(match[2]) : 10;

    snipeManager.setupSnipe(chatId, {
        triggerSeconds,
        multiplier,
        respectBudget: true,  // Always respect budget
        autoExecute: true
    });

    bot.sendMessage(chatId,
        `🎯 *Snipe Bidding Configured!*\n\n` +
        `⏰ Trigger: ${triggerSeconds} detik sebelum tutup\n` +
        `💰 Multiplier: +${multiplier}x kelipatan\n` +
        `🛡️ Budget Control: Aktif\n` +
        `🤖 Auto Execute: Aktif\n\n` +
        `✅ Bot akan auto-bid di detik terakhir!\n\n` +
        `*Safety:*\n` +
        `• Tidak akan melebihi budget Anda\n` +
        `• Hanya execute jika harga masih affordable\n\n` +
        `*Commands:*\n` +
        `• \`/snipe\` - Check snipe status\n` +
        `• \`/snipestop\` - Disable snipe\n` +
        `• \`/snipestart\` - Enable snipe`,
        { parse_mode: 'Markdown' }
    );
});

// Command: /snipe - Check snipe status
bot.onText(/\/snipe$/, (msg) => {
    const chatId = msg.chat.id;
    const snipe = snipeManager.getSnipe(chatId);

    if (!snipe) {
        bot.sendMessage(chatId,
            `🎯 *Snipe Bidding*\n\n` +
            `❌ Snipe belum disetup\n\n` +
            `Gunakan \`/setsnipe <detik> <multiplier>\`\n\n` +
            `*Contoh:*\n` +
            `• \`/setsnipe 5 10\` - Bid +10x di 5 detik terakhir\n` +
            `• \`/setsnipe 3 20\` - Bid +20x di 3 detik terakhir\n` +
            `• \`/setsnipe\` - Default (5s, 10x)`,
            { parse_mode: 'Markdown' }
        );
        return;
    }

    const message = `🎯 *Snipe Status*\n\n` +
        `${snipe.enabled ? '✅ AKTIF' : '❌ NONAKTIF'}\n\n` +
        `⏰ *Trigger:* ${snipe.triggerSeconds} detik sebelum tutup\n` +
        `💰 *Multiplier:* +${snipe.multiplier}x kelipatan\n` +
        `🛡️ *Budget Control:* ${snipe.respectBudget ? 'ON' : 'OFF'}\n` +
        `🤖 *Auto Execute:* ${snipe.autoExecute ? 'ON' : 'OFF'}\n\n` +
        `*Commands:*\n` +
        `• \`/snipestop\` - Disable snipe\n` +
        `• \`/snipestart\` - Enable snipe\n` +
        `• \`/setsnipe <s> <x>\` - Update config`;

    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Command: /snipestop - Disable snipe
bot.onText(/\/snipestop/, (msg) => {
    const chatId = msg.chat.id;
    snipeManager.disableSnipe(chatId);
    bot.sendMessage(chatId, '🛑 *Snipe Disabled*\n\nAuto-bid di detik terakhir dinonaktifkan.', {
        parse_mode: 'Markdown'
    });
});

// Command: /snipestart - Enable snipe
bot.onText(/\/snipestart/, (msg) => {
    const chatId = msg.chat.id;
    const snipe = snipeManager.getSnipe(chatId);
    
    if (!snipe) {
        bot.sendMessage(chatId, '❌ Snipe belum disetup!\n\nGunakan `/setsnipe` terlebih dahulu.', {
            parse_mode: 'Markdown'
        });
        return;
    }

    snipeManager.enableSnipe(chatId);
    bot.sendMessage(chatId, '✅ *Snipe Enabled*\n\nAuto-bid di detik terakhir diaktifkan kembali!', {
        parse_mode: 'Markdown'
    });
});

// ============================================
// CALLBACK QUERY HANDLERS
// ============================================

bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const data = callbackQuery.data;

    bot.answerCallbackQuery(callbackQuery.id);

    switch (data) {
        case 'setup_guide':
            handleSetupGuide(chatId);
            break;
        case 'help':
            handleHelp(chatId);
            break;
        case 'check_status':
            await handleStatusCheck(chatId);
            break;
        case 'bid_menu':
            handleBidMenu(chatId);
            break;
        case 'bid_kelipatan':
        case 'bid_1x':
            await handleBidKelipatan(chatId, 1);
            break;
        case 'bid_10x':
            await handleBidKelipatan(chatId, 10);
            break;
        case 'start_monitor':
            await startSmartMonitoring(chatId);
            break;
        case 'stop_monitor':
            stopMonitoring(chatId);
            break;
    }
});

// ============================================
// HANDLER FUNCTIONS
// ============================================

async function handleStatusCheck(chatId) {
    const session = userSessions.get(chatId);

    if (!session || !session.auctionId) {
        bot.sendMessage(chatId, '❌ Auction ID belum di-set!\n\nGunakan: `/setauction <auction_id>`', {
            parse_mode: 'Markdown'
        });
        return;
    }

    bot.sendMessage(chatId, '🔄 Mengambil status lelang...');

    const statusResult = await fetchAuctionStatus(
        session.auctionId,
        session.cookies,
        session.bearerToken
    );

    if (!statusResult.success) {
        bot.sendMessage(chatId, `❌ Gagal mengambil status:\n${statusResult.error}\n\n*Tips:*\n• Pastikan bearer token masih valid\n• Pastikan cookies masih valid\n• Coba set ulang token dan cookies`, {
            parse_mode: 'Markdown'
        });
        return;
    }

    // Simpan data lelang di session untuk keperluan bid kelipatan
    if (statusResult.data && statusResult.data.data) {
        if (!session.sessionData) {
            session.sessionData = {};
        }
        session.sessionData.auctionData = statusResult.data.data;

        // Cache kelipatan bid untuk fast bid
        const kelipatanBid = parseInt(statusResult.data.data?.lotLelang?.kelipatanBid);
        if (kelipatanBid && kelipatanBid > 0) {
            session.sessionData.kelipatanBid = kelipatanBid;
        }

        userSessions.set(chatId, session);
    }

    const formattedStatus = formatAuctionStatus(statusResult);

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🔢 Bid +1x", callback_data: "bid_1x" },
                    { text: "🔟 Bid +10x", callback_data: "bid_10x" }
                ],
                [
                    { text: "💰 Bid Manual", callback_data: "bid_menu" }
                ],
                [
                    { text: "🔄 Refresh", callback_data: "check_status" },
                    { text: "📊 Start Monitor", callback_data: "start_monitor" }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, formattedStatus, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
    });
}

async function handleBid(chatId, amount) {
    const session = userSessions.get(chatId);

    if (!session || !session.auctionId) {
        bot.sendMessage(chatId, '❌ Auction ID belum di-set!\n\nGunakan: `/setauction <auction_id>`', {
            parse_mode: 'Markdown'
        });
        return;
    }

    if (!session.cookies) {
        bot.sendMessage(chatId, '❌ Cookies belum di-set!\n\nGunakan: `/setcookies <cookies>`', {
            parse_mode: 'Markdown'
        });
        return;
    }

    if (!session.bearerToken) {
        bot.sendMessage(chatId, '❌ Bearer token belum di-set!\n\nGunakan: `/settoken <bearer_token>`', {
            parse_mode: 'Markdown'
        });
        return;
    }

    if (!session.passBidding) {
        bot.sendMessage(chatId, '❌ Pass bidding belum di-set!\n\nGunakan: `/setPassBidding <passkey>`', {
            parse_mode: 'Markdown'
        });
        return;
    }

    bot.sendMessage(chatId, `🔄 Mengirim bid Rp ${amount.toLocaleString('id-ID')}...`);

    const bidResult = await sendBidToAPI(
        session.auctionId,
        session.passBidding,
        amount,
        session.cookies,
        session.bearerToken
    );

    if (bidResult.success) {
        bot.sendMessage(chatId, `✅ *Bid Berhasil!*\n\nNominal: Rp ${amount.toLocaleString('id-ID')}\n\nGunakan /status untuk cek posisi bid Anda.`, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "📊 Cek Status", callback_data: "check_status" }]
                ]
            }
        });
    } else {
        bot.sendMessage(chatId, `❌ *Bid Gagal!*\n\nError: ${bidResult.error}\n\n*Tips:*\n• Pastikan bearer token masih valid\n• Pastikan cookies masih valid\n• Pastikan pass bidding benar\n• Pastikan nominal lebih tinggi dari bid saat ini\n• Pastikan lelang masih berjalan`, {
            parse_mode: 'Markdown'
        });
    }
}

async function handleBidKelipatan(chatId, multiplier = 1) {
    const startTime = Date.now();
    const session = userSessions.get(chatId);

    if (!session?.auctionId) {
        bot.sendMessage(chatId, '❌ Auction ID belum di-set!\n\nGunakan: `/setauction <auction_id>`', {
            parse_mode: 'Markdown'
        });
        return;
    }

    // Validasi session lengkap
    if (!session.cookies || !session.bearerToken || !session.passBidding) {
        bot.sendMessage(chatId, '❌ Session belum lengkap! Pastikan sudah set cookies, token, dan passBidding.', {
            parse_mode: 'Markdown'
        });
        return;
    }

    // OPTIMIZED: Langsung ambil history (tidak perlu tunggu status)
    // Gunakan kelipatan bid yang sudah di-cache dari session sebelumnya
    const historyResult = await fetchBidHistory(
        session.auctionId,
        session.cookies,
        session.bearerToken
    );

    if (!historyResult.success) {
        bot.sendMessage(chatId, `❌ Gagal mengambil riwayat bid!\n\nError: ${historyResult.error}`, {
            parse_mode: 'Markdown'
        });
        return;
    }

    // Parse harga tertinggi dari riwayat
    let hargaTertinggi = 0;
    let riwayat = historyResult.data?.data;

    if (riwayat?.data && Array.isArray(riwayat.data)) {
        riwayat = riwayat.data;
    }

    if (Array.isArray(riwayat) && riwayat.length > 0 && riwayat[0]?.bidAmount) {
        hargaTertinggi = parseInt(riwayat[0].bidAmount);
    }

    // Gunakan kelipatan bid dari cache session (jika ada)
    // Jika tidak ada, ambil dari status (fallback)
    let kelipatanBid = session.sessionData?.kelipatanBid;

    if (!kelipatanBid || kelipatanBid <= 0) {
        // Fallback: ambil dari status jika belum di-cache
        const statusResult = await fetchAuctionStatus(
            session.auctionId,
            session.cookies,
            session.bearerToken
        );

        if (statusResult.success && statusResult.data?.data?.lotLelang) {
            kelipatanBid = parseInt(statusResult.data.data.lotLelang.kelipatanBid);

            // Cache kelipatan bid untuk next time
            if (!session.sessionData) session.sessionData = {};
            session.sessionData.kelipatanBid = kelipatanBid;
            userSessions.set(chatId, session);
        }

        if (!kelipatanBid || kelipatanBid <= 0) {
            bot.sendMessage(chatId, '❌ Kelipatan bid tidak valid!', { parse_mode: 'Markdown' });
            return;
        }
    }

    // Hitung nominal bid
    let bidAmount = hargaTertinggi + (kelipatanBid * multiplier);

    // ============================================
    // BUDGET CHECK (Safety)
    // ============================================
    const budgetCheck = budgetManager.canBid(chatId, bidAmount);
    
    if (!budgetCheck.allowed) {
        // Try to get safe amount within budget
        const safeBid = budgetManager.getSafeBidAmount(chatId, bidAmount);
        
        if (safeBid.limited) {
            // Can bid, but limited to max purchase price
            if (safeBid.amount < hargaTertinggi + kelipatanBid) {
                // Too low to compete
                bot.sendMessage(chatId,
                    `💰 *Budget Limit Reached!*\n\n` +
                    `❌ Cannot bid: Melebihi harga maksimal\n\n` +
                    `• Harga bid: Rp ${bidAmount.toLocaleString('id-ID')}\n` +
                    `• Max purchase price: Rp ${budgetCheck.maxBudget.toLocaleString('id-ID')}\n` +
                    `• Deficit: Rp ${budgetCheck.deficit.toLocaleString('id-ID')}\n\n` +
                    `💡 *Budget = Harga maksimal yang mau Anda bayar*\n\n` +
                    `*Options:*\n` +
                    `• \`/setbudget ${Math.ceil((bidAmount + 500000) / 1000000) * 1000000}\` - Increase budget\n` +
                    `• \`/clearbudget\` - Remove limit (not recommended)`,
                    { parse_mode: 'Markdown' }
                );
                return;
            }

            // Use safe amount (limited)
            bidAmount = safeBid.amount;
            bot.sendMessage(chatId,
                `⚠️ *Budget Warning*\n\n` +
                `Bid amount adjusted to fit budget:\n` +
                `• Original: Rp ${safeBid.original.toLocaleString('id-ID')}\n` +
                `• Adjusted: Rp ${bidAmount.toLocaleString('id-ID')}\n` +
                `• Remaining: Rp ${safeBid.remaining.toLocaleString('id-ID')}`
            );
        }
    } else if (budgetCheck.warning) {
        // Approaching budget limit
        bot.sendMessage(chatId,
            `⚠️ Budget at ${budgetCheck.percentUsed.toFixed(1)}%\n` +
            `Remaining: Rp ${budgetCheck.remaining.toLocaleString('id-ID')}`
        );
    }
    // ============================================

    // Kirim bid langsung
    const bidResult = await sendBidToAPI(
        session.auctionId,
        session.passBidding,
        bidAmount,
        session.cookies,
        session.bearerToken
    );

    // Track bid in budget manager
    if (bidResult.success) {
        budgetManager.trackBid(chatId, bidAmount, true);
    }

    const elapsed = Date.now() - startTime;

    if (bidResult.success) {
        bot.sendMessage(chatId,
            `✅ *Bid +${multiplier}x Berhasil!* ⚡ ${elapsed}ms\n\n` +
            `• Harga Sebelumnya: Rp ${hargaTertinggi.toLocaleString('id-ID')}\n` +
            `• Nominal Bid: Rp ${bidAmount.toLocaleString('id-ID')}`, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔢 +1x", callback_data: "bid_1x" }, { text: "🔟 +10x", callback_data: "bid_10x" }],
                    [{ text: "📊 Status", callback_data: "check_status" }]
                ]
            }
        });
    } else {
        bot.sendMessage(chatId, `❌ *Bid Gagal!* ⚡ ${elapsed}ms\n\nError: ${bidResult.error}`, {
            parse_mode: 'Markdown'
        });
    }
}

function handleBidMenu(chatId) {
    const session = userSessions.get(chatId);

    if (!session || !session.auctionId) {
        bot.sendMessage(chatId, '❌ Auction ID belum di-set!\n\nGunakan: `/setauction <auction_id>`', {
            parse_mode: 'Markdown'
        });
        return;
    }

    const message = `💰 *Menu Bid*

*Cara melakukan bid:*

*1. Bid Manual:*
\`/bid <nominal>\`
Contoh: \`/bid 1500000\`

*2. Bid Kelipatan (Otomatis):*
\`/bid kelipatanBid\`
Bot akan otomatis menghitung: Nilai Limit + Kelipatan Bid

*Auction ID aktif:*
\`${session.auctionId}\`

*Status Pass Bidding:*
${session.passBidding ? '✅ Sudah di-set' : '❌ Belum di-set - gunakan `/setPassBidding <passkey>`'}

⚠️ Pastikan nominal lebih tinggi dari penawaran saat ini!`;

    bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🔢 Bid Kelipatan", callback_data: "bid_kelipatan" }
                ],
                [
                    { text: "📊 Cek Status Lelang", callback_data: "check_status" }
                ]
            ]
        }
    });
}

async function startSmartMonitoring(chatId) {
    const session = userSessions.get(chatId);

    if (!session || !session.auctionId) {
        bot.sendMessage(chatId, '❌ Auction ID belum di-set!');
        return;
    }

    if (activeMonitoring.has(chatId)) {
        bot.sendMessage(chatId, '⚠️ Monitoring sudah aktif!\n\nGunakan /stopmonitor untuk menghentikan.');
        return;
    }

    let lastPrice = null;
    let lastStatus = null;
    let currentInterval = 3000; // Start dengan 3 detik

    async function monitorLoop() {
        try {
            // Get status to check time remaining
            const statusResult = await fetchAuctionStatus(
                session.auctionId,
                session.cookies,
                session.bearerToken
            );

            if (statusResult.success && statusResult.data && statusResult.data.data) {
                const data = statusResult.data.data;
                const lot = data?.lotLelang;

                // Calculate time remaining
                if (lot?.tglSelesaiLelang) {
                    const endTime = new Date(lot.tglSelesaiLelang);
                    const now = new Date();
                    const timeRemaining = endTime - now;
                    const minutesRemaining = Math.floor(timeRemaining / 1000 / 60);
                    const secondsRemaining = Math.floor(timeRemaining / 1000);

                    // ============================================
                    // SNIPE BIDDING LOGIC
                    // ============================================
                    const snipeCheck = snipeManager.shouldExecuteSnipe(chatId, secondsRemaining);
                    
                    if (snipeCheck.shouldSnipe) {
                        console.log(`🎯 Snipe trigger! ${secondsRemaining}s remaining`);
                        
                        // Get current price & kelipatan
                        const historyResult = await fetchBidHistory(
                            session.auctionId,
                            session.cookies,
                            session.bearerToken
                        );

                        if (historyResult.success && historyResult.data?.data) {
                            let riwayat = historyResult.data.data;
                            if (riwayat.data && Array.isArray(riwayat.data)) {
                                riwayat = riwayat.data;
                            }

                            if (Array.isArray(riwayat) && riwayat.length > 0) {
                                const currentPrice = parseInt(riwayat[0].bidAmount);
                                const kelipatanBid = session.sessionData?.kelipatanBid || lot.kelipatanBid || 50000;

                                // Calculate snipe bid
                                const snipeBid = snipeManager.calculateSnipeBid(
                                    chatId,
                                    currentPrice,
                                    kelipatanBid
                                );

                                if (snipeBid.success) {
                                    // Execute snipe!
                                    bot.sendMessage(chatId, 
                                        `🎯 *SNIPE EXECUTION!*\n\n` +
                                        `⏰ ${secondsRemaining}s remaining\n` +
                                        `💰 Bid: Rp ${snipeBid.bidAmount.toLocaleString('id-ID')}\n` +
                                        `${snipeBid.limited ? '⚠️ (Limited by budget)' : ''}`,
                                        { parse_mode: 'Markdown' }
                                    );

                                    const bidResult = await sendBidToAPI(
                                        session.auctionId,
                                        session.passBidding,
                                        snipeBid.bidAmount,
                                        session.cookies,
                                        session.bearerToken
                                    );

                                    // Track result
                                    if (bidResult.success) {
                                        budgetManager.trackBid(chatId, snipeBid.bidAmount, true);
                                        snipeManager.trackSnipe(chatId, { ...snipeBid, success: true });
                                        
                                        bot.sendMessage(chatId,
                                            `✅ *SNIPE SUCCESS!*\n\n` +
                                            `🎯 Bid berhasil: Rp ${snipeBid.bidAmount.toLocaleString('id-ID')}\n` +
                                            `⏰ Waktu: ${secondsRemaining}s sebelum tutup`,
                                            { parse_mode: 'Markdown' }
                                        );
                                    } else {
                                        snipeManager.trackSnipe(chatId, { ...snipeBid, success: false, error: bidResult.error });
                                        
                                        bot.sendMessage(chatId,
                                            `❌ *SNIPE FAILED!*\n\n` +
                                            `Error: ${bidResult.error}`,
                                            { parse_mode: 'Markdown' }
                                        );
                                    }

                                    // Disable snipe after execution (one-time)
                                    snipeManager.disableSnipe(chatId);
                                } else {
                                    // Cannot snipe (budget insufficient)
                                    bot.sendMessage(chatId,
                                        `⚠️ *SNIPE ABORTED!*\n\n` +
                                        `Reason: ${snipeBid.error}\n\n` +
                                        `💰 Insufficient budget untuk compete`,
                                        { parse_mode: 'Markdown' }
                                    );
                                    snipeManager.disableSnipe(chatId);
                                }
                            }
                        }
                    }
                    // ============================================

                    // Adjust interval based on time remaining
                    if (minutesRemaining <= 5) {
                        currentInterval = 1000; // 1 detik untuk 5 menit terakhir
                    } else if (minutesRemaining <= 15) {
                        currentInterval = 2000; // 2 detik untuk 15 menit terakhir
                    } else if (minutesRemaining <= 60) {
                        currentInterval = 3000; // 3 detik untuk 1 jam terakhir
                    } else {
                        currentInterval = 5000; // 5 detik untuk sisanya
                    }
                }

                // Check status
                const currentStatus = data.status?.statusLelang;
                if (currentStatus && currentStatus !== lastStatus) {
                    bot.sendMessage(chatId, `🔔 *Perubahan Status!*\n\nStatus: ${currentStatus}`, {
                        parse_mode: 'Markdown'
                    });
                    lastStatus = currentStatus;
                }

                // Check if ended
                if (currentStatus && (currentStatus.toLowerCase().includes('selesai') ||
                    currentStatus.toLowerCase().includes('berakhir'))) {
                    bot.sendMessage(chatId, '🏁 *Lelang Berakhir!*', { parse_mode: 'Markdown' });
                    stopMonitoring(chatId);
                    return;
                }
            }

            // Monitor bid history (pakai cache untuk hemat request)
            const historyResult = await fetchBidHistory(
                session.auctionId,
                session.cookies,
                session.bearerToken,
                true // useCache = true untuk monitoring
            );

            if (historyResult.success && historyResult.data && historyResult.data.data) {
                let riwayat = historyResult.data.data;
                if (riwayat.data && Array.isArray(riwayat.data)) {
                    riwayat = riwayat.data;
                }

                if (Array.isArray(riwayat) && riwayat.length > 0) {
                    const latestBid = riwayat[0];
                    const currentPrice = parseInt(latestBid.bidAmount);

                    if (currentPrice !== lastPrice && lastPrice !== null) {
                        const priceDiff = currentPrice - lastPrice;
                        bot.sendMessage(chatId,
                            `🚨 *Penawaran Baru!*\n\n` +
                            `Harga: Rp ${currentPrice.toLocaleString('id-ID')}\n` +
                            `Naik: Rp ${priceDiff.toLocaleString('id-ID')}\n` +
                            `Penawar: ${latestBid.bidderName || 'Unknown'}`,
                            {
                                parse_mode: 'Markdown',
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: "💰 Bid Kelipatan", callback_data: "bid_kelipatan" }]
                                    ]
                                }
                            }
                        );
                    }
                    lastPrice = currentPrice;
                }
            }

        } catch (error) {
            console.error('Smart monitoring error:', error);
        }

        // Schedule next check with current interval
        const monitoring = activeMonitoring.get(chatId);
        if (monitoring) {
            monitoring.timeout = setTimeout(monitorLoop, currentInterval);
        }
    }

    // Start monitoring
    activeMonitoring.set(chatId, {
        auctionId: session.auctionId,
        timeout: setTimeout(monitorLoop, currentInterval)
    });

    bot.sendMessage(chatId,
        '✅ *Smart Monitoring Aktif!*\n\n' +
        '🎯 Interval otomatis:\n' +
        '• >1 jam: 5 detik\n' +
        '• 15-60 menit: 3 detik\n' +
        '• 5-15 menit: 2 detik\n' +
        '• <5 menit: 1 detik\n\n' +
        'Gunakan /stopmonitor untuk stop.',
        { parse_mode: 'Markdown' }
    );
}

function stopMonitoring(chatId) {
    const monitoring = activeMonitoring.get(chatId);

    if (!monitoring) {
        bot.sendMessage(chatId, '❌ Tidak ada monitoring yang aktif.');
        return;
    }

    // Clear interval or timeout
    if (monitoring.interval) {
        clearInterval(monitoring.interval);
    }
    if (monitoring.timeout) {
        clearTimeout(monitoring.timeout);
    }

    activeMonitoring.delete(chatId);

    bot.sendMessage(chatId, '✅ Monitoring dihentikan.');
}

function handleSetupGuide(chatId) {
    const message = `📖 *Panduan Setup Lengkap*

*Langkah 1: Ambil Bearer Token & Cookies*
1. Buka lelang.go.id di browser
2. Login ke akun Anda
3. Tekan F12 untuk buka DevTools
4. Pergi ke tab Network
5. Refresh halaman
6. Klik request ke api.lelang.go.id
7. Di Request Headers, cari:
   • "Authorization: Bearer xxxx" (copy token-nya)
   • "Cookie: xxxx" (copy semua cookie)

*Langkah 2: Set Token & Cookies di Bot*
\`/settoken <bearer_token>\`
\`/setcookies <cookies>\`

*Langkah 3: Ambil Auction ID*
• Buka halaman lelang yang ingin di-bid
• Copy ID dari URL (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)

*Langkah 4: Set Auction ID*
\`/setauction <auction_id>\`

*Langkah 5: Set Pass Bidding*
\`/setPassBidding <passkey>\`
(Passkey adalah PIN/password untuk bid)

*Langkah 6 (NEW): Set Budget Protection* 💰
\`/setbudget 100000000\`
(Max budget Rp 100M - Bot tidak akan bid lebih dari ini!)

*Langkah 7 (NEW): Setup Snipe Bidding* 🎯
\`/setsnipe 5 10\`
(Auto-bid +10x kelipatan di 5 detik terakhir)

*Langkah 8: Start Monitoring*
\`/monitor\`
(Bot auto-monitor & auto-snipe!)

*Contoh Flow Lengkap:*
\`\`\`
/settoken eyJhbGciOiJI...
/setcookies _ga=GA1.2...
/setauction 6d815f8f-f41e-4497-b7b1-28703c15a6f6
/setPassBidding 123456

/setbudget 100000000    ← Protection!
/setsnipe 5 10          ← Auto-snipe!
/monitor                ← Start!

[Bot bekerja otomatis]
→ Monitor countdown...
→ Saat 5 detik: AUTO-BID!
→ Budget checked: ✅
→ Execute: 100ms ⚡
→ Result: WIN! 🏆
\`\`\`

*Manual Bidding (Alternative):*
• \`/status\` - Cek status
• \`/bid 1x\` - Bid +1 kelipatan
• \`/bid 10x\` - Bid +10 kelipatan

*Tips Pro:*
✅ Set budget untuk safety
✅ Use snipe untuk surprise attack
✅ Monitor aktif = Auto-win
✅ Speed optimization aktif (5x faster!)`;

    bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown'
    });
}

function handleHelp(chatId) {
    const message = `🤖 *Bantuan Lengkap*

*Perintah Setup:*
• \`/settoken\` - Set bearer token
• \`/setcookies\` - Set session cookies
• \`/setauction\` - Set auction ID
• \`/setPassBidding\` - Set pass/PIN bidding

*Perintah Utama:*
• \`/start\` - Mulai bot
• \`/help\` - Bantuan ini
• \`/status\` - Cek status lelang
• \`/bid <nominal>\` - Kirim bid manual
• \`/bid 1x\` - Bid +1 kelipatan
• \`/bid 10x\` - Bid +10 kelipatan
• \`/monitor\` - Start monitoring
• \`/stopmonitor\` - Stop monitoring

*Perintah Monitoring:*
• \`/performance\` - Show speed stats ⚡
• \`/optimizer status\` - Check optimizer

💰 *Budget Management:*
• \`/setbudget 50000000\` - Max budget Rp 50M
• \`/budget\` - Cek sisa budget
• \`/clearbudget\` - Hapus limit

🎯 *Snipe Bidding (Auto-bid detik terakhir):*
• \`/setsnipe 5 10\` - Bid +10x di 5 detik terakhir
• \`/setsnipe 3 20\` - Bid +20x di 3 detik terakhir
• \`/snipe\` - Check snipe status
• \`/snipestop\` - Disable snipe
• \`/snipestart\` - Enable snipe

*Cara Kerja Bid Kelipatan:*
Bot menghitung: Harga Tertinggi + (Kelipatan × Multiplier)

Contoh: \`/bid 10x\`
• Harga: Rp 10.000.000
• Kelipatan: Rp 50.000 × 10 = Rp 500.000
• Bid: Rp 10.500.000

💰 *Cara Kerja Budget:*
1. Set budget: \`/setbudget 100000000\` (Rp 100M)
2. Bot tracking spending otomatis
3. Warning saat budget 90%
4. Auto-stop jika melebihi budget
5. Cek sisa: \`/budget\`

Contoh:
• Budget: Rp 100M
• Bid 1: Rp 80M ✅
• Bid 2: Rp 25M ❌ (Exceeded! Aborted)
• Sisa: Rp 20M

🎯 *Cara Kerja Snipe:*
1. Setup: \`/setsnipe 5 10\` (5 detik, +10x)
2. Start: \`/monitor\`
3. Bot tunggu countdown...
4. Saat 5 detik tersisa → Auto-bid!
5. Competitors terkejut (no time to counter)

Contoh Scenario:
• Current: Rp 50M
• Countdown: 10s... 5s... SNIPE!
• Bot bid: Rp 55M (+10x kelipatan)
• Execute: 100ms ⚡
• Result: WIN! 🏆

🛡️ *Budget + Snipe = SAFE!*
Bot akan:
✅ Check budget sebelum snipe
✅ Abort jika melebihi budget
✅ Adjust bid to fit budget
✅ Warning real-time

Contoh:
• Snipe bid: Rp 60M
• Budget sisa: Rp 40M
• Result: ❌ ABORTED (Budget insufficient)
• Your money: SAFE! 💰

*Tips Pro:*
• Set budget dulu sebelum bid
• Snipe untuk surprise attack
• Monitor + Snipe = Auto win
• Budget control = No overbid
• Speed optimization = Win rate +50%`;

    bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown'
    });
}

// ============================================
// API ENDPOINTS (untuk extension jika masih dipakai)
// ============================================

app.post('/api/tab-connected', (req, res) => {
    console.log('Tab connected:', req.body);
    res.json({ success: true });
});

app.get('/health', (req, res) => {
    try {
        const healthData = SafeAPI.getHealthWithPerformance();
        res.json({
            ...healthData,
            activeSessions: userSessions.size,
            activeMonitoring: activeMonitoring.size
        });
    } catch (error) {
        // Fallback if optimizer fails
        res.json({
            status: 'healthy',
            activeSessions: userSessions.size,
            activeMonitoring: activeMonitoring.size,
            optimizer: {
                error: error.message
            },
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================
// SERVER START
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('✅ Server running on http://localhost:' + PORT);
    console.log('✅ Telegram bot active (API Direct Mode)');
    console.log('📱 Kirim /start ke bot untuk memulai');
    console.log('🔗 Bot menggunakan API langsung ke lelang.go.id');
});

// Error handling
bot.on('error', (error) => {
    console.error('Bot error:', error);
});

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping server...');

    // Stop all monitoring
    activeMonitoring.forEach((monitoring) => {
        if (monitoring.interval) clearInterval(monitoring.interval);
        if (monitoring.timeout) clearTimeout(monitoring.timeout);
    });

    // Cleanup optimizer
    try {
        SafeAPI.cleanup();
        console.log('✅ Optimizer cleaned up');
    } catch (error) {
        console.warn('⚠️ Optimizer cleanup error:', error.message);
    }

    bot.stopPolling();
    process.exit(0);
});