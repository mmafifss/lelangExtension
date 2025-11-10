# 🚀 Quick Start Guide

## Setup Cepat (5 menit)

### 1. Setup Bot Telegram
1. Buka Telegram → cari `@BotFather`
2. Kirim `/newbot` → ikuti instruksi
3. Copy token bot yang diberikan

### 2. Konfigurasi Server
```bash
# Edit file server/config.env
BOT_TOKEN="8389335047:AAEGk6uja3umCEb-kBOwzKdPSKgTzKgS9_c"
PORT=3000
```

### 3. Install & Jalankan
```bash
# Install dependencies
cd server && npm install

# Jalankan server
npm start
```

### 4. Install Extension
1. Buka Chrome → `chrome://extensions/`
2. Aktifkan "Developer mode"
3. Klik "Load unpacked" → pilih folder `extension/`

### 5. Gunakan Bot
1. Buka lelang.go.id → login
2. Buka halaman lelang yang ingin di-bid
3. Kirim ke bot: `/bid <lot_id> <amount>`

## 📱 Perintah Bot
- `/bid 12345 1000000` - Bid Rp 1.000.000 untuk lot 12345
- `/status` - Cek status browser yang terhubung
- `/help` - Bantuan lengkap

## 🔧 Troubleshooting
- Server error? Cek `server/config.env` dan pastikan BOT_TOKEN benar
- Extension tidak connect? Pastikan server running dan sudah login di lelang.go.id
- Bid gagal? Cek console browser untuk error details

## 📁 Struktur File
```
lelangExtension/
├── extension/          # Chrome Extension files
├── server/            # Backend server files
├── package.json       # Root package manager
└── setup.sh          # Auto setup script
```
