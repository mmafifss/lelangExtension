// ============================================
// server-api-direct-debug.js - Debug Version
// Versi dengan enhanced debugging untuk diagnosa masalah
// ============================================

require('dotenv').config({ path: './config.env' });
const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const https = require('https');
const dns = require('dns').promises;

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
// ENHANCED DEBUGGING UTILITIES
// ============================================

const DEBUG = true;

function debugLog(title, data) {
    if (!DEBUG) return;
    console.log('\n' + '='.repeat(60));
    console.log(`🔍 DEBUG: ${title}`);
    console.log('='.repeat(60));
    if (typeof data === 'object') {
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.log(data);
    }
    console.log('='.repeat(60) + '\n');
}

async function testDNS(hostname) {
    try {
        debugLog('DNS Resolution Test', `Resolving: ${hostname}`);
        const addresses = await dns.resolve4(hostname);
        debugLog('DNS Resolution Success', {
            hostname: hostname,
            addresses: addresses,
            firstIP: addresses[0]
        });
        return { success: true, addresses };
    } catch (error) {
        debugLog('DNS Resolution Failed', {
            hostname: hostname,
            error: error.message,
            code: error.code
        });
        return { success: false, error: error.message };
    }
}

async function testTCPConnection(hostname, port = 443) {
    return new Promise((resolve) => {
        const net = require('net');
        const socket = new net.Socket();
        const timeout = 10000;

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            debugLog('TCP Connection Success', {
                hostname: hostname,
                port: port,
                localAddress: socket.localAddress,
                localPort: socket.localPort
            });
            socket.destroy();
            resolve({ success: true });
        });

        socket.on('timeout', () => {
            debugLog('TCP Connection Timeout', {
                hostname: hostname,
                port: port,
                timeout: timeout
            });
            socket.destroy();
            resolve({ success: false, error: 'Connection timeout' });
        });

        socket.on('error', (error) => {
            debugLog('TCP Connection Error', {
                hostname: hostname,
                port: port,
                error: error.message,
                code: error.code
            });
            resolve({ success: false, error: error.message });
        });

        debugLog('Attempting TCP Connection', {
            hostname: hostname,
            port: port,
            timeout: timeout
        });

        socket.connect(port, hostname);
    });
}

// ============================================
// AXIOS CONFIGURATION WITH DEBUG
// ============================================

const axiosInstance = axios.create({
    timeout: 30000,
    httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true,
        keepAliveMsecs: 1000
    }),
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"'
    }
});

// Request interceptor untuk debug
axiosInstance.interceptors.request.use(
    (config) => {
        debugLog('Axios Request Starting', {
            method: config.method?.toUpperCase(),
            url: config.url,
            timeout: config.timeout,
            headers: {
                ...config.headers,
                Authorization: config.headers.Authorization ? '[REDACTED]' : undefined,
                Cookie: config.headers.Cookie ? '[REDACTED]' : undefined
            }
        });
        config.metadata = { startTime: new Date() };
        return config;
    },
    (error) => {
        debugLog('Axios Request Error', error);
        return Promise.reject(error);
    }
);

// Response interceptor untuk debug
axiosInstance.interceptors.response.use(
    (response) => {
        const duration = new Date() - response.config.metadata.startTime;
        debugLog('Axios Response Success', {
            status: response.status,
            statusText: response.statusText,
            duration: `${duration}ms`,
            dataSize: JSON.stringify(response.data).length,
            headers: response.headers
        });
        return response;
    },
    (error) => {
        if (error.config && error.config.metadata) {
            const duration = new Date() - error.config.metadata.startTime;
            debugLog('Axios Response Error', {
                duration: `${duration}ms`,
                message: error.message,
                code: error.code,
                requestURL: error.config?.url,
                requestMethod: error.config?.method?.toUpperCase(),
                responseStatus: error.response?.status,
                responseData: error.response?.data,
                errno: error.errno,
                syscall: error.syscall,
                address: error.address,
                port: error.port
            });
        } else {
            debugLog('Axios Error (No Config)', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
        }
        return Promise.reject(error);
    }
);

// Retry logic dengan detailed logging
const axiosRetry = async (config, maxRetries = 3) => {
    debugLog('Retry Logic Start', {
        maxRetries: maxRetries,
        url: config.url
    });

    for (let i = 0; i < maxRetries; i++) {
        try {
            debugLog(`Attempt ${i + 1}/${maxRetries}`, 'Starting request...');
            const response = await axiosInstance(config);
            debugLog(`Attempt ${i + 1}/${maxRetries}`, '✅ SUCCESS');
            return response;
        } catch (error) {
            debugLog(`Attempt ${i + 1}/${maxRetries}`, {
                status: '❌ FAILED',
                error: error.message,
                code: error.code,
                willRetry: i < maxRetries - 1
            });

            if (i === maxRetries - 1) {
                debugLog('All Retries Exhausted', {
                    totalAttempts: maxRetries,
                    finalError: error.message
                });
                throw error;
            }

            const waitTime = Math.pow(2, i) * 1000;
            debugLog('Waiting Before Retry', {
                waitTime: `${waitTime}ms`,
                nextAttempt: i + 2
            });
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
};

// ============================================
// STORAGE & STATE MANAGEMENT
// ============================================

const userSessions = new Map();
const activeMonitoring = new Map();

// ============================================
// API INTEGRATION FUNCTIONS WITH DEBUG
// ============================================

async function fetchBidHistory(auctionId, cookies = null, bearerToken = null) {
    debugLog('fetchBidHistory Called', {
        auctionId: auctionId,
        hasCookies: !!cookies,
        hasToken: !!bearerToken
    });

    try {
        const headers = {
            'Origin': 'https://lelang.go.id',
            'Referer': 'https://lelang.go.id/'
        };

        if (cookies) headers['Cookie'] = cookies;
        if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;

        const url = `https://bidding.lelang.go.id/api/v1/pelaksanaan/lelang/${auctionId}/riwayat`;

        console.log(`📡 Fetching bid history for auction: ${auctionId}`);

        const response = await axiosRetry({
            method: 'GET',
            url: url,
            headers: headers
        });

        console.log('✅ Bid history fetched successfully');
        return { success: true, data: response.data };
    } catch (error) {
        console.error('❌ Error fetching bid history:', error.message);
        debugLog('fetchBidHistory Full Error', {
            message: error.message,
            code: error.code,
            response: error.response?.data,
            stack: error.stack
        });
        return { success: false, error: error.message, fullError: error };
    }
}

async function fetchAuctionStatus(auctionId, cookies = null, bearerToken = null) {
    debugLog('fetchAuctionStatus Called', {
        auctionId: auctionId,
        hasCookies: !!cookies,
        hasToken: !!bearerToken
    });

    try {
        const headers = {
            'Origin': 'https://lelang.go.id',
            'Referer': 'https://lelang.go.id/'
        };

        if (cookies) headers['Cookie'] = cookies;
        if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;

        const url = `https://api.lelang.go.id/api/v1/pelaksanaan/${auctionId}/status-lelang?dcp=true`;

        console.log(`📡 Fetching auction status for: ${auctionId}`);

        const response = await axiosRetry({
            method: 'GET',
            url: url,
            headers: headers
        });

        console.log('✅ Auction status fetched successfully');
        return { success: true, data: response.data };
    } catch (error) {
        console.error('❌ Error fetching auction status:', error.message);
        debugLog('fetchAuctionStatus Full Error', {
            message: error.message,
            code: error.code,
            response: error.response?.data,
            stack: error.stack
        });
        return { success: false, error: error.message, fullError: error };
    }
}

async function sendBidToAPI(auctionId, passkey, amount, cookies, bearerToken) {
    debugLog('sendBidToAPI Called', {
        auctionId: auctionId,
        amount: amount,
        hasCookies: !!cookies,
        hasToken: !!bearerToken,
        hasPasskey: !!passkey
    });

    try {
        const headers = {
            'Content-Type': 'application/json',
            'Origin': 'https://lelang.go.id',
            'Referer': 'https://lelang.go.id/'
        };

        if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
        if (cookies) headers['Cookie'] = cookies;

        console.log('=== Starting Bid Process ===');
        console.log('Auction ID:', auctionId);
        console.log('Amount:', amount);

        // 1. Mulai sesi bid
        const startSessionPayload = {
            auctionId: String(auctionId)
        };

        console.log('📤 Starting bid session...');

        const startSessionResponse = await axiosRetry({
            method: 'POST',
            url: 'https://bidding.lelang.go.id/api/v1/pelaksanaan/lelang/mulai-sesi',
            headers: headers,
            data: startSessionPayload
        });

        console.log('✅ Session started:', startSessionResponse.status);

        // 2. Kirim bid
        const bidPayload = {
            auctionId: String(auctionId),
            bidAmount: parseInt(amount),
            bidTime: new Date().toISOString(),
            passkey: String(passkey)
        };

        console.log('📤 Sending bid...');

        const bidResponse = await axiosRetry({
            method: 'POST',
            url: 'https://bidding.lelang.go.id/api/v1/pelaksanaan/lelang/pengajuan-penawaran',
            headers: headers,
            data: bidPayload
        });

        console.log('✅ Bid sent successfully:', bidResponse.status);
        return { success: true, result: bidResponse.data };

    } catch (error) {
        console.error('❌ Error sending bid:', error.message);
        debugLog('sendBidToAPI Full Error', {
            message: error.message,
            code: error.code,
            response: error.response?.data,
            stack: error.stack
        });
        return { success: false, error: error.message, fullError: error };
    }
}

function formatAuctionStatus(statusData) {
    if (!statusData || !statusData.data) {
        return '❌ Data lelang tidak tersedia';
    }

    const data = statusData.data.data;
    const lot = data?.lotLelang;
    const status = data?.status;
    const peserta = data?.peserta;

    let message = `📦 *STATUS LELANG*\n\n`;
    message += `🚦 *Status:* ${status?.statusLelang}\n`;
    message += `👤 *Status Peserta:* ${status?.statusPeserta}\n\n`;
    message += `🏷️ *Info Lot:*\n`;
    message += `• Kode Lot: *${lot?.kodeLot}*\n`;
    message += `• Nama Lot: ${lot?.namaLotLelang}\n\n`;

    const nilaiLimit = lot.nilaiLimit ? parseInt(lot.nilaiLimit.toString().replace(/\D/g, '')) : 0;
    const kelipatanBid = parseInt(lot?.kelipatanBid);

    message += `💰 *Info Harga:*\n`;
    message += `• Nilai Limit: Rp ${nilaiLimit?.toLocaleString('id-ID')}\n`;
    message += `• Kelipatan Bid: Rp ${kelipatanBid?.toLocaleString('id-ID')}\n\n`;
    message += `🔗 *Lot ID:* \`${lot?.lotLelangId || 'N/A'}\``;

    return message;
}

// ============================================
// TELEGRAM BOT COMMANDS
// ============================================

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `🎉 *Debug Version - Lelang Bot*

Versi ini memiliki enhanced debugging untuk diagnosa masalah koneksi.

*Perintah Diagnostik:*
• \`/diagnose\` - Full diagnostic test
• \`/testdns\` - Test DNS resolution
• \`/testtcp\` - Test TCP connection
• \`/testapi\` - Test API endpoint

*Perintah Normal:*
• \`/settoken <token>\`
• \`/setcookies <cookies>\`
• \`/setauction <id>\`
• \`/setPassBidding <pin>\`
• \`/status\`
• \`/help\`

Semua operasi akan menampilkan debug log detail di console.`;

    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// Command: /diagnose - Full diagnostic
bot.onText(/\/diagnose/, async (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(chatId, '🔍 Running full diagnostic...\n\nCheck server console for detailed logs.');

    debugLog('Full Diagnostic Started', 'Testing all components...');

    // Test 1: DNS Resolution
    bot.sendMessage(chatId, '1️⃣ Testing DNS resolution...');
    const dns1 = await testDNS('api.lelang.go.id');
    const dns2 = await testDNS('bidding.lelang.go.id');

    let dnsResult = dns1.success && dns2.success ? '✅ DNS OK' : '❌ DNS FAILED';
    bot.sendMessage(chatId, `DNS Test: ${dnsResult}`);

    // Test 2: TCP Connection
    bot.sendMessage(chatId, '2️⃣ Testing TCP connection...');
    const tcp1 = await testTCPConnection('api.lelang.go.id', 443);
    const tcp2 = await testTCPConnection('bidding.lelang.go.id', 443);

    let tcpResult = tcp1.success && tcp2.success ? '✅ TCP OK' : '❌ TCP FAILED';
    bot.sendMessage(chatId, `TCP Test: ${tcpResult}`);

    // Test 3: HTTPS Request
    bot.sendMessage(chatId, '3️⃣ Testing HTTPS request...');
    try {
        await axiosRetry({
            method: 'GET',
            url: 'https://api.lelang.go.id',
            timeout: 10000
        }, 2);
        bot.sendMessage(chatId, 'HTTPS Test: ✅ OK');
    } catch (error) {
        bot.sendMessage(chatId, `HTTPS Test: ❌ FAILED\nError: ${error.message}`);
    }

    // Summary
    bot.sendMessage(chatId, `
📊 *Diagnostic Summary:*

DNS: ${dnsResult}
TCP: ${tcpResult}

Check server console for detailed logs.
    `, { parse_mode: 'Markdown' });
});

// Command: /testdns
bot.onText(/\/testdns/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '🔍 Testing DNS...\n\nCheck console for details.');

    await testDNS('api.lelang.go.id');
    await testDNS('bidding.lelang.go.id');
    await testDNS('lelang.go.id');

    bot.sendMessage(chatId, '✅ DNS test complete. Check server console.');
});

// Command: /testtcp
bot.onText(/\/testtcp/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '🔍 Testing TCP...\n\nCheck console for details.');

    const result1 = await testTCPConnection('api.lelang.go.id', 443);
    const result2 = await testTCPConnection('bidding.lelang.go.id', 443);

    bot.sendMessage(chatId, `TCP Test Results:\n\napi.lelang.go.id: ${result1.success ? '✅' : '❌'}\nbidding.lelang.go.id: ${result2.success ? '✅' : '❌'}\n\nCheck console for details.`);
});

// Command: /testapi
bot.onText(/\/testapi/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '🔍 Testing API...\n\nCheck console for details.');

    try {
        const response = await axiosRetry({
            method: 'GET',
            url: 'https://api.lelang.go.id',
            timeout: 10000
        }, 2);
        bot.sendMessage(chatId, `✅ API Test SUCCESS\n\nStatus: ${response.status}\n\nCheck console for details.`);
    } catch (error) {
        bot.sendMessage(chatId, `❌ API Test FAILED\n\nError: ${error.message}\nCode: ${error.code}\n\nCheck console for details.`);
    }
});

bot.onText(/\/settoken (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const bearerToken = match[1].trim();

    if (!userSessions.has(chatId)) {
        userSessions.set(chatId, {});
    }

    const session = userSessions.get(chatId);
    session.bearerToken = bearerToken;
    userSessions.set(chatId, session);

    bot.sendMessage(chatId, '✅ Bearer token saved!', { parse_mode: 'Markdown' });
});

bot.onText(/\/setcookies (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const cookies = match[1].trim();

    if (!userSessions.has(chatId)) {
        userSessions.set(chatId, {});
    }

    const session = userSessions.get(chatId);
    session.cookies = cookies;
    userSessions.set(chatId, session);

    bot.sendMessage(chatId, '✅ Cookies saved!', { parse_mode: 'Markdown' });
});

bot.onText(/\/setauction ([a-f0-9-]+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const auctionId = match[1].trim();

    if (!userSessions.has(chatId)) {
        userSessions.set(chatId, {});
    }

    const session = userSessions.get(chatId);
    session.auctionId = auctionId;
    userSessions.set(chatId, session);

    bot.sendMessage(chatId, `✅ Auction ID set: \`${auctionId}\``, { parse_mode: 'Markdown' });
});

bot.onText(/\/setPassBidding (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const passkey = match[1].trim();

    if (!userSessions.has(chatId)) {
        userSessions.set(chatId, {});
    }

    const session = userSessions.get(chatId);
    session.passBidding = passkey;
    userSessions.set(chatId, session);

    bot.sendMessage(chatId, `✅ Pass bidding set!`, { parse_mode: 'Markdown' });
});

bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const session = userSessions.get(chatId);

    if (!session || !session.auctionId) {
        bot.sendMessage(chatId, '❌ Auction ID not set!');
        return;
    }

    bot.sendMessage(chatId, '🔄 Fetching status...\n\nCheck console for detailed logs.');

    const statusResult = await fetchAuctionStatus(
        session.auctionId,
        session.cookies,
        session.bearerToken
    );

    if (!statusResult.success) {
        bot.sendMessage(chatId, `❌ Failed to fetch status:\n${statusResult.error}\n\nCheck console for detailed error logs.`);
        return;
    }

    const formattedStatus = formatAuctionStatus(statusResult);
    bot.sendMessage(chatId, formattedStatus, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const message = `🤖 *Debug Version Help*

*Diagnostic Commands:*
• \`/diagnose\` - Run full diagnostic
• \`/testdns\` - Test DNS resolution  
• \`/testtcp\` - Test TCP connection
• \`/testapi\` - Test API endpoint

*Setup Commands:*
• \`/settoken <token>\`
• \`/setcookies <cookies>\`
• \`/setauction <id>\`
• \`/setPassBidding <pin>\`

*Main Commands:*
• \`/status\` - Check auction status

All operations will show detailed debug logs in the server console.`;

    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// ============================================
// SERVER START
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log('\n' + '='.repeat(60));
    console.log('🐛 DEBUG MODE ENABLED');
    console.log('='.repeat(60));
    console.log('✅ Server running on http://localhost:' + PORT);
    console.log('✅ Telegram bot active (DEBUG MODE)');
    console.log('📱 Send /start to bot');
    console.log('🔍 All operations will show detailed debug logs');
    console.log('='.repeat(60) + '\n');

    // Auto-run diagnostic on startup
    debugLog('Auto Diagnostic on Startup', 'Testing connectivity...');

    await testDNS('api.lelang.go.id');
    await testDNS('bidding.lelang.go.id');
    await testTCPConnection('api.lelang.go.id', 443);
    await testTCPConnection('bidding.lelang.go.id', 443);

    console.log('\n✅ Startup diagnostic complete. Bot ready.\n');
});

bot.on('error', (error) => {
    debugLog('Bot Error', error);
});

bot.on('polling_error', (error) => {
    debugLog('Polling Error', error);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Stopping server...');
    bot.stopPolling();
    process.exit(0);
});