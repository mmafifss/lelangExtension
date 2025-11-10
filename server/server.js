// ============================================
// server.js (Backend untuk Extension <-> Bot)
// ============================================

// Load environment variables from config.env
require('dotenv').config({ path: './config.env' });
const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());

// Check if bot token is provided
if (!process.env.BOT_TOKEN || process.env.BOT_TOKEN === 'your_bot_token_here') {
    console.log(process.env.BOT_TOKEN)
    console.error('❌ BOT_TOKEN tidak ditemukan!');
    console.error('Silakan edit file config.env dan masukkan token bot Telegram Anda.');
    process.exit(1);
}

const botOptions = {
    polling: {
        interval: 2000,
        autoStart: true,
        params: {
            timeout: 10
        }
    },
    request: {
        family: 4 // force IPv4 to avoid ECONNRESET on some networks
    }
};

const bot = new TelegramBot(process.env.BOT_TOKEN, botOptions);

// Storage untuk perintah bid yang pending
let pendingCommands = [];
let connectedTabs = new Map(); // lotId -> tabData

// Command: /start - Welcome message dengan keyboard
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'User';

    const welcomeMessage = `🎉 *Selamat datang di Lelang Remote Bid Bot!*

Halo ${firstName}! 👋

Saya adalah bot yang akan membantu Anda melakukan bid otomatis di lelang.go.id melalui Chrome extension.

*🚀 Fitur yang tersedia:*
• Bid otomatis via Telegram
• Monitoring harga real-time  
• Status browser terhubung
• Notifikasi hasil bid

*📱 Cara menggunakan:*
1. Install Chrome extension
2. Buka lelang.go.id dan login
3. Buka halaman lelang yang ingin di-bid
4. Gunakan menu di bawah untuk navigasi

*⚠️ Pastikan:*
• Extension sudah terinstall dan aktif
• Browser sudah login di lelang.go.id
• Halaman lelang sudah terbuka

Pilih menu di bawah untuk memulai! 👇`;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "📊 Status Browser", callback_data: "status" },
                    { text: "💰 Bid Sekarang", callback_data: "bid_menu" }
                ],
                [
                    { text: "❓ Bantuan", callback_data: "help" },
                    { text: "🔧 Menu Utama", callback_data: "main_menu" }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
    });
});

// Handler untuk callback query dari inline keyboard
bot.on('callback_query', (callbackQuery) => {
    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const data = callbackQuery.data;

    // Answer callback query untuk menghilangkan loading
    bot.answerCallbackQuery(callbackQuery.id);

    switch (data) {
        case 'status':
            handleStatusCommand(chatId);
            break;
        case 'bid_menu':
            showBidMenu(chatId);
            break;
        case 'help':
            handleHelpCommand(chatId);
            break;
        case 'main_menu':
            showMainMenu(chatId);
            break;
        case 'back_to_main':
            showMainMenu(chatId);
            break;
        default:
            bot.sendMessage(chatId, '❌ Perintah tidak dikenali. Gunakan /start untuk memulai.');
    }
});

// Function untuk menampilkan status browser
function handleStatusCommand(chatId) {
    const connected = Array.from(connectedTabs.values());

    if (connected.length === 0) {
        const noConnectionMessage = `⚠️ *Tidak ada browser yang terhubung*

Pastikan:
• Chrome extension sudah terinstall dan aktif
• Buka halaman lelang di lelang.go.id
• Sudah login ke akun Anda
• Refresh halaman jika perlu

Gunakan tombol di bawah untuk kembali ke menu utama.`;

        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔙 Kembali ke Menu", callback_data: "back_to_main" }]
                ]
            }
        };

        bot.sendMessage(chatId, noConnectionMessage, {
            parse_mode: 'Markdown',
            reply_markup: keyboard.reply_markup
        });
        return;
    }

    let message = '✅ *Browser Terhubung:*\n\n';
    connected.forEach((tab, index) => {
        message += `📦 *Lelang ${index + 1}:*\n`;
        message += `• Judul: ${tab.data.title || 'Unknown Title'}\n`;
        message += `• Harga: Rp ${tab.data.currentPrice.toLocaleString('id-ID')}\n`;
        message += `• Status: ${tab.data.isLoggedIn ? '✅ Sudah Login' : '❌ Belum Login'}\n`;
        message += `• Lot ID: \`${tab.data.lotId}\`\n\n`;
    });

    message += '💡 *Tips:* Gunakan Lot ID untuk melakukan bid dengan command `/bid <lot_id> <amount>`';

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "💰 Bid Sekarang", callback_data: "bid_menu" }],
                [{ text: "🔙 Kembali ke Menu", callback_data: "back_to_main" }]
            ]
        }
    };

    bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
    });
}

// Function untuk menampilkan menu bid
function showBidMenu(chatId) {
    const connected = Array.from(connectedTabs.values());
    console.log(connected, "connected")

    if (connected.length === 0) {
        bot.sendMessage(chatId, '❌ Tidak ada browser yang terhubung. Pastikan extension aktif dan sudah login di lelang.go.id');
        return;
    }

    const bidMenuMessage = `💰 *Menu Bid*

*Cara melakukan bid:*
1. Gunakan command: \`/bid <lot_id> <amount>\`
2. Contoh: \`/bid 12345 1000000\`

*Lot ID yang tersedia:*
${connected.map((tab, index) => `• \`${tab.data.lotId}\` - ${tab.data.title || 'Unknown Title'}`).join('\n')}

*Contoh penggunaan:*
\`/bid ${connected[0].data.lotId} 1500000\`

⚠️ *Pastikan nominal bid valid dan lebih tinggi dari harga saat ini!*`;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 Cek Status Browser", callback_data: "status" }],
                [{ text: "❓ Bantuan Lengkap", callback_data: "help" }],
                [{ text: "🔙 Menu Utama", callback_data: "back_to_main" }]
            ]
        }
    };

    bot.sendMessage(chatId, bidMenuMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
    });
}

// Function untuk menampilkan menu utama
function showMainMenu(chatId) {
    const mainMenuMessage = `🔧 *Menu Utama*

Pilih opsi yang ingin Anda gunakan:`;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "📊 Status Browser", callback_data: "status" },
                    { text: "💰 Bid Sekarang", callback_data: "bid_menu" }
                ],
                [
                    { text: "❓ Bantuan", callback_data: "help" },
                    { text: "🔄 Refresh", callback_data: "main_menu" }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, mainMenuMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
    });
}

// Extension report tab connected
app.post('/api/tab-connected', (req, res) => {
    const { lotId, tabId, data } = req.body;
    connectedTabs.set(lotId, { tabId, data, timestamp: Date.now() });
    console.log(`Tab connected for lot ${lotId}`);
    res.json({ success: true });
});

// Extension polling untuk perintah bid
app.get('/api/pending-commands', (req, res) => {
    const commands = pendingCommands.splice(0); // Ambil dan kosongkan
    res.json(commands);
});

// Extension kirim hasil bid
app.post('/api/bid-result', (req, res) => {
    const { commandId, result } = req.body;

    // Kirim notif ke Telegram user
    const command = pendingCommands.find(c => c.id === commandId);
    if (command) {
        const message = result.success
            ? `✅ Bid berhasil! Rp ${command.amount.toLocaleString('id-ID')}`
            : `❌ Bid gagal: ${result.error}`;

        bot.sendMessage(command.chatId, message).catch(err => {
            console.error('Failed to send message to Telegram:', err);
        });
    }

    res.json({ success: true });
});

// Telegram bot command: /bid
bot.onText(/\/bid (\d+) (\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const lotId = match[1];
    const amount = parseInt(match[2]);

    // Cek apakah tab untuk lot ini terhubung
    if (!connectedTabs.has(lotId)) {
        bot.sendMessage(chatId, '❌ Browser extension belum terhubung untuk lelang ini.\n\nBuka halaman lelang di browser dan pastikan extension aktif!');
        return;
    }

    // Tambahkan ke queue
    const commandId = Date.now();
    pendingCommands.push({
        id: commandId,
        lotId,
        amount,
        chatId,
        timestamp: Date.now()
    });

    bot.sendMessage(chatId, `🔄 Mengirim perintah bid Rp ${amount.toLocaleString('id-ID')}...\n\nMenunggu konfirmasi dari browser...`);
});

// Command: /help
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    handleHelpCommand(chatId);
});

// Function untuk menampilkan bantuan
function handleHelpCommand(chatId) {
    const helpMessage = `🤖 *Lelang Remote Bid Bot - Bantuan Lengkap*

*📱 Perintah yang tersedia:*

• \`/start\` - Mulai bot dan tampilkan menu utama
• \`/bid <lot_id> <amount>\` - Kirim bid untuk lelang tertentu
• \`/status\` - Cek status tab browser yang terhubung
• \`/help\` - Tampilkan bantuan ini
• \`/menu\` - Tampilkan menu utama

*🚀 Cara penggunaan:*
1. Install Chrome extension dari folder \`extension/\`
2. Buka lelang.go.id dan login ke akun Anda
3. Buka halaman lelang yang ingin di-bid
4. Gunakan menu bot atau command langsung

*💡 Tips penggunaan:*
• Lot ID bisa dilihat dari URL halaman lelang
• Pastikan extension aktif dan browser terhubung
• Nominal bid harus lebih tinggi dari harga saat ini
• Gunakan menu interaktif untuk navigasi yang mudah

*⚠️ Troubleshooting:*
• Extension tidak connect? Pastikan server running
• Bid gagal? Cek apakah sudah login dan nominal valid
• Browser tidak terdeteksi? Refresh halaman lelang

*🔧 Setup:*
• Server: \`npm run start-server\`
• Extension: Load unpacked dari folder \`extension/\``;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 Cek Status Browser", callback_data: "status" }],
                [{ text: "💰 Menu Bid", callback_data: "bid_menu" }],
                [{ text: "🔙 Menu Utama", callback_data: "back_to_main" }]
            ]
        }
    };

    bot.sendMessage(chatId, helpMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
    });
}

// Command: /status
bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    handleStatusCommand(chatId);
});

// Command: /menu
bot.onText(/\/menu/, (msg) => {
    const chatId = msg.chat.id;
    showMainMenu(chatId);
});

// Command: /ping - Test koneksi
bot.onText(/\/ping/, (msg) => {
    const chatId = msg.chat.id;
    const startTime = Date.now();

    bot.sendMessage(chatId, '🏓 Pong! Bot aktif dan responsif.', {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🔙 Menu Utama", callback_data: "back_to_main" }]
            ]
        }
    });
});

// Handler untuk pesan yang tidak dikenali
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Skip jika sudah ada handler untuk command
    if (text && text.startsWith('/')) {
        return;
    }

    // Jika pesan tidak dikenali, berikan bantuan
    const unknownMessage = `❓ *Pesan tidak dikenali*

Saya tidak mengerti pesan Anda. Gunakan command atau menu di bawah untuk navigasi.

*Perintah yang tersedia:*
• \`/start\` - Mulai bot
• \`/menu\` - Menu utama
• \`/help\` - Bantuan
• \`/status\` - Status browser
• \`/ping\` - Test koneksi`;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🚀 Mulai Bot", callback_data: "main_menu" },
                    { text: "❓ Bantuan", callback_data: "help" }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, unknownMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('✅ Server running on http://localhost:' + PORT);
    console.log('✅ Telegram bot active');
    console.log('📱 Kirim /help ke bot untuk melihat perintah yang tersedia');
});

// Bot error handling
bot.on('error', (error) => {
    console.error('Bot error:', error);
});

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});