// ============================================
// server-api-direct.js - Direct API Integration
// Sistem bid langsung ke API lelang.go.id
// ============================================

require('dotenv').config({ path: './config.env' });
const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

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
// API INTEGRATION FUNCTIONS
// ============================================

/**
 * Fetch riwayat bid dari API bidding.lelang.go.id
 */
async function fetchBidHistory(auctionId, cookies = null, bearerToken = null) {
    try {
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            'Origin': 'https://lelang.go.id',
            'Referer': 'https://lelang.go.id/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
        };

        if (cookies) {
            headers['Cookie'] = cookies;
        }

        if (bearerToken) {
            headers['Authorization'] = `Bearer ${bearerToken}`;
        }

        const response = await fetch(
            `https://bidding.lelang.go.id/api/v1/pelaksanaan/lelang/${auctionId}/riwayat`,
            { headers, method: "GET" }
        );

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error('Error fetching bid history:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetch status lelang dari API lelang.go.id
 */
async function fetchAuctionStatus(auctionId, cookies = null, bearerToken = null) {
    try {
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            'Authorization': `Bearer ${bearerToken}`,
            'Origin': 'https://lelang.go.id',
            'Referer': 'https://lelang.go.id/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
        };

        if (cookies) {
            headers['Cookie'] = cookies;
        }

        if (bearerToken) {
            headers['Authorization'] = `Bearer ${bearerToken}`;
        }

        const response = await fetch(
            `https://api.lelang.go.id/api/v1/pelaksanaan/${auctionId}/status-lelang?dcp=true`,
            { headers, method: "GET" }
        );

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error('Error fetching auction status:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Kirim bid ke API lelang.go.id
 */
async function sendBidToAPI(auctionId, passkey, amount, cookies, bearerToken) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            'Origin': 'https://lelang.go.id',
            'Referer': 'https://lelang.go.id/',
            'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"'
        };

        if (bearerToken) {
            headers['Authorization'] = `Bearer ${bearerToken}`;
        }

        if (cookies) {
            headers['Cookie'] = cookies;
        }

        console.log('=== Starting Bid Process ===');
        console.log('Auction ID:', auctionId);
        console.log('Amount:', amount);
        console.log('Passkey:', passkey);

        // 1. Mulai sesi bid
        const startSessionPayload = {
            auctionId: String(auctionId) // Pastikan string
        };

        console.log('Start session payload:', JSON.stringify(startSessionPayload));

        const startSessionResponse = await fetch(
            'https://bidding.lelang.go.id/api/v1/pelaksanaan/lelang/mulai-sesi',
            {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(startSessionPayload)
            }
        );

        const startSessionText = await startSessionResponse.text();
        console.log('Start session response status:', startSessionResponse.status);
        console.log('Start session response:', startSessionText);

        if (!startSessionResponse.ok) {
            throw new Error(`Failed to start session: ${startSessionResponse.status} - ${startSessionText}`);
        }

        // 2. Kirim bid
        const bidPayload = {
            auctionId: String(auctionId),
            bidAmount: parseInt(amount),
            bidTime: new Date().toISOString(),
            passkey: String(passkey)
        };

        console.log('Bid payload:', JSON.stringify(bidPayload));

        const bidResponse = await fetch(
            'https://bidding.lelang.go.id/api/v1/pelaksanaan/lelang/pengajuan-penawaran',
            {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(bidPayload)
            }
        );

        const bidText = await bidResponse.text();
        console.log('Bid response status:', bidResponse.status);
        console.log('Bid response:', bidText);

        if (!bidResponse.ok) {
            throw new Error(`Bid failed: ${bidResponse.status} - ${bidText}`);
        }

        const result = JSON.parse(bidText);
        return { success: true, result };

    } catch (error) {
        console.error('Error sending bid:', error);
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

    const welcomeMessage = `🎉 *Selamat datang di Lelang Bid Bot (API Direct)!*

Halo ${firstName}! 👋

Bot ini terhubung langsung ke API lelang.go.id untuk bid otomatis.

*🚀 Fitur:*
• Cek status lelang real-time
• Bid langsung via API
• Monitoring otomatis
• Notifikasi perubahan harga

*📱 Setup Cepat:*
1. Set cookies: \`/setcookies <cookies>\`
2. Set bearer token: \`/settoken <bearer_token>\`
3. Set auction: \`/setauction <auction_id>\`
4. Set pass bidding: \`/setPassBidding <passkey>\`
5. Cek status: \`/status\`
6. Bid: \`/bid <amount>\`

*💡 Tips:*
• Cookies & token bisa diambil dari browser (F12 → Network)
• Auction ID ada di URL lelang
• Pass bidding adalah PIN/password untuk bid
• Pastikan sudah login di lelang.go.id

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
    const input = match[1].trim();

    // Cek apakah input adalah angka atau "kelipatanBid"
    if (input.toLowerCase() === 'kelipatanbid' || input.toLowerCase() === 'kelipatan') {
        await handleBidKelipatan(chatId);
    } else {
        const amount = parseInt(input);
        if (isNaN(amount)) {
            bot.sendMessage(chatId, '❌ Nominal bid tidak valid!\n\n*Cara penggunaan:*\n• `/bid <nominal>` - Bid dengan nominal tertentu\n• `/bid kelipatanBid` - Bid otomatis sesuai kelipatan', {
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
    await startMonitoring(chatId);
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
            await handleBidKelipatan(chatId);
            break;
        case 'start_monitor':
            await startMonitoring(chatId);
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
        userSessions.set(chatId, session);
    }

    const formattedStatus = formatAuctionStatus(statusResult);

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "💰 Bid Manual", callback_data: "bid_menu" },
                    { text: "🔢 Bid Kelipatan", callback_data: "bid_kelipatan" }
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

async function handleBidKelipatan(chatId) {
    const session = userSessions.get(chatId);

    if (!session || !session.auctionId) {
        bot.sendMessage(chatId, '❌ Auction ID belum di-set!\n\nGunakan: `/setauction <auction_id>`', {
            parse_mode: 'Markdown'
        });
        return;
    }

    // Ambil status lelang terbaru
    bot.sendMessage(chatId, '🔄 Mengambil info kelipatan bid dan riwayat...');

    const statusResult = await fetchAuctionStatus(
        session.auctionId,
        session.cookies,
        session.bearerToken
    );

    if (!statusResult.success || !statusResult.data || !statusResult.data.data) {
        bot.sendMessage(chatId, `❌ Gagal mengambil info lelang!\n\nError: ${statusResult.error}\n\nSilakan coba lagi atau gunakan /bid <nominal> untuk bid manual.`, {
            parse_mode: 'Markdown'
        });
        return;
    }

    const data = statusResult.data.data;
    const lot = data?.lotLelang;

    if (!lot) {
        bot.sendMessage(chatId, '❌ Data lot tidak ditemukan!');
        return;
    }

    // Ambil kelipatan bid
    const kelipatanBid = parseInt(lot?.kelipatanBid);
    const nilaiLimit = lot.nilaiLimit ? parseInt(lot.nilaiLimit.toString().replace(/\D/g, '')) : 0;

    if (!kelipatanBid || kelipatanBid <= 0) {
        bot.sendMessage(chatId, '❌ Kelipatan bid tidak valid!\n\nSilakan gunakan /bid <nominal> untuk bid manual.', {
            parse_mode: 'Markdown'
        });
        return;
    }

    // Ambil riwayat bid untuk mendapatkan harga tertinggi
    const historyResult = await fetchBidHistory(
        session.auctionId,
        session.cookies,
        session.bearerToken
    );

    let hargaTertinggi = nilaiLimit; // Default ke nilai limit jika belum ada bid

    if (historyResult.success && historyResult.data.data) {
        console.log('=== DEBUG RIWAYAT BID ===');
        console.log('Full response:', JSON.stringify(historyResult.data.data, null, 2));

        // Response bisa langsung array atau wrapped di dalam data
        let riwayat = historyResult.data.data;

        // Cek jika response wrapped dalam object dengan key 'data'
        if (riwayat.data && Array.isArray(riwayat.data)) {
            riwayat = riwayat.data;
            console.log('Response wrapped, mengambil dari .data');
        }

        console.log('Is Array?', Array.isArray(riwayat));
        console.log('Length:', Array.isArray(riwayat) ? riwayat.length : 'N/A');

        // Ambil bid tertinggi dari riwayat (index 0 karena sudah terurut dari tertinggi)
        if (Array.isArray(riwayat) && riwayat.length > 0) {
            console.log('Item pertama (tertinggi):', JSON.stringify(riwayat[0], null, 2));
            const bidTertinggi = riwayat[0];

            if (bidTertinggi.bidAmount) {
                hargaTertinggi = parseInt(bidTertinggi.bidAmount);
                console.log('✅ Harga tertinggi berhasil diambil:', hargaTertinggi);
            } else {
                console.log('❌ bidAmount tidak ditemukan di object');
            }
        } else {
            console.log('❌ Riwayat kosong atau bukan array');
            console.log('Type of riwayat:', typeof riwayat);
        }
    } else {
        console.log('❌ Gagal ambil riwayat, menggunakan nilai limit sebagai default');
        console.log('Error:', historyResult.error);
    }

    console.log('=== PERHITUNGAN BID ===');
    console.log('Nilai Limit:', nilaiLimit);
    console.log('Harga Tertinggi (final):', hargaTertinggi);
    console.log('Kelipatan Bid:', kelipatanBid);

    // Hitung nominal bid: harga tertinggi saat ini + kelipatan bid
    const bidAmount = hargaTertinggi + kelipatanBid;

    console.log('Bid Amount (hasil):', bidAmount);
    console.log('=========================');

    const confirmMessage = `💰 *Bid Dengan Kelipatan*\n\n` +
        `📊 Info:\n` +
        `• Nilai Limit: Rp ${nilaiLimit.toLocaleString('id-ID')}\n` +
        `• Harga Tertinggi: Rp ${hargaTertinggi.toLocaleString('id-ID')}\n` +
        `• Kelipatan Bid: Rp ${kelipatanBid.toLocaleString('id-ID')}\n` +
        `• Nominal Bid Anda: Rp ${bidAmount.toLocaleString('id-ID')}\n\n` +
        `❓ Lanjutkan bid dengan nominal ini?`;

    bot.sendMessage(chatId, confirmMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "✅ Ya, Kirim Bid", callback_data: `confirm_bid_${bidAmount}` },
                    { text: "❌ Batal", callback_data: "check_status" }
                ]
            ]
        }
    });

    // Simpan bid amount sementara untuk konfirmasi
    session.pendingBidAmount = bidAmount;
    userSessions.set(chatId, session);
}

// Handler untuk konfirmasi bid
bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;

    if (data.startsWith('confirm_bid_')) {
        bot.answerCallbackQuery(callbackQuery.id);

        const session = userSessions.get(chatId);
        if (session && session.pendingBidAmount) {
            await handleBid(chatId, session.pendingBidAmount);

            // Hapus pending bid amount
            delete session.pendingBidAmount;
            userSessions.set(chatId, session);
        }
    }
});

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

async function startMonitoring(chatId) {
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

    const monitorInterval = setInterval(async () => {
        const statusResult = await fetchAuctionStatus(
            session.auctionId,
            session.cookies,
            session.bearerToken
        );

        if (statusResult.success && statusResult.data && statusResult.data.data) {
            const data = statusResult.data.data;
            const currentStatus = data.status?.statusLelang;

            // Monitor perubahan status lelang
            if (currentStatus && currentStatus !== lastStatus) {
                bot.sendMessage(chatId, `🔔 *Perubahan Status Lelang!*\n\nStatus Baru: ${currentStatus}`, {
                    parse_mode: 'Markdown'
                });
                lastStatus = currentStatus;
            }

            // Monitor jika ada data bidding (untuk penawaran)
            // Note: Data ini mungkin perlu disesuaikan dengan struktur response API bidding
        }
    }, 10000); // Check setiap 10 detik

    activeMonitoring.set(chatId, {
        auctionId: session.auctionId,
        interval: monitorInterval
    });

    bot.sendMessage(chatId, '✅ *Monitoring Aktif!*\n\nAnda akan menerima notifikasi jika ada perubahan status.\n\nGunakan /stopmonitor untuk menghentikan.', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "🛑 Stop Monitor", callback_data: "stop_monitor" }]
            ]
        }
    });
}

function stopMonitoring(chatId) {
    const monitoring = activeMonitoring.get(chatId);

    if (!monitoring) {
        bot.sendMessage(chatId, '❌ Tidak ada monitoring yang aktif.');
        return;
    }

    clearInterval(monitoring.interval);
    activeMonitoring.delete(chatId);

    bot.sendMessage(chatId, '✅ Monitoring dihentikan.');
}

function handleSetupGuide(chatId) {
    const message = `📖 *Panduan Setup*

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

*Langkah 6: Mulai Bid!*
• Cek status: \`/status\`
• Bid manual: \`/bid <nominal>\`
• Bid kelipatan: \`/bid kelipatanBid\`

*Contoh Lengkap:*
\`\`\`
/settoken eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
/setcookies _ga=GA1.2.123456789...
/setauction 6d815f8f-f41e-4497-b7b1-28703c15a6f6
/setPassBidding 123456
/status
/bid kelipatanBid
\`\`\``;

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
• \`/bid kelipatanBid\` - Bid otomatis (limit + kelipatan)
• \`/monitor\` - Start monitoring
• \`/stopmonitor\` - Stop monitoring

*Cara Kerja Bid Kelipatan:*
Bot akan otomatis menghitung:
Nominal Bid = Nilai Limit + Kelipatan Bid

Contoh:
• Nilai Limit: Rp 10.000.000
• Kelipatan Bid: Rp 50.000
• Nominal Bid: Rp 10.050.000

*Cara Kerja Bot:*
Bot ini terhubung langsung ke API lelang.go.id untuk:
1. Mengambil status lelang real-time
2. Mengirim bid otomatis
3. Monitoring perubahan status

*Keuntungan:*
✅ Tidak perlu extension
✅ Lebih stabil
✅ Lebih cepat
✅ Bisa dari mana saja
✅ Bid kelipatan otomatis

*Tips:*
• Token & cookies hanya valid beberapa jam, perlu di-update berkala
• Auction ID bisa dilihat dari URL halaman lelang
• Pass bidding adalah PIN yang Anda gunakan di website
• Gunakan /monitor untuk notifikasi otomatis
• Pastikan sudah membayar uang jaminan sebelum bid
• Bid kelipatan lebih cepat dan praktis`;

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
    res.json({
        status: 'healthy',
        activeSessions: userSessions.size,
        activeMonitoring: activeMonitoring.size,
        timestamp: new Date().toISOString()
    });
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
        clearInterval(monitoring.interval);
    });

    bot.stopPolling();
    process.exit(0);
});