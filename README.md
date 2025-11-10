# Sistem Bid Lelang.go.id dengan Chrome Extension & Bot Telegram

Sistem lengkap untuk melakukan bid otomatis di lelang.go.id melalui bot Telegram dengan Chrome extension.

## 🚀 Fitur

- ✅ Bid otomatis melalui bot Telegram
- ✅ Monitoring harga real-time
- ✅ Deteksi login status
- ✅ Error handling yang robust
- ✅ Interface popup untuk monitoring
- ✅ Struktur project yang terorganisir

## 📁 Struktur Project

```
lelangExtension/
├── extension/                 # Chrome Extension
│   ├── manifest.json         # Konfigurasi extension
│   ├── background.js         # Service worker
│   ├── content.js           # Script untuk halaman lelang
│   ├── popup.html          # Interface popup
│   ├── popup.js            # Logic popup
│   └── package.json        # Dependencies extension
├── server/                   # Backend Server
│   ├── server.js           # Main server file
│   ├── config.env          # Konfigurasi bot token
│   └── package.json        # Dependencies server
├── package.json            # Root package.json
├── setup.sh               # Script setup otomatis
├── .gitignore             # Git ignore rules
└── README.md              # Dokumentasi
```

## 📋 Prerequisites

1. **Node.js** (versi 14 atau lebih baru)
2. **Bot Telegram** (dari @BotFather)
3. **Chrome Browser**

## 🛠️ Instalasi Cepat

### Opsi 1: Setup Otomatis
```bash
# Clone atau download project
cd lelangExtension

# Jalankan script setup
./setup.sh
```

### Opsi 2: Setup Manual

#### 1. Setup Bot Telegram
1. Buka Telegram dan cari `@BotFather`
2. Kirim `/newbot` dan ikuti instruksi
3. Simpan token bot yang diberikan

#### 2. Setup Server
```bash
# Install dependencies server
cd server
npm install

# Edit file config.env
# Ganti 'your_bot_token_here' dengan token bot Anda
BOT_TOKEN='your_bot_token_here'
PORT=3000

# Jalankan server
npm start
```

#### 3. Install Chrome Extension
1. Buka Chrome dan pergi ke `chrome://extensions/`
2. Aktifkan "Developer mode" (toggle di kanan atas)
3. Klik "Load unpacked"
4. Pilih folder `extension/`
5. Extension akan muncul di toolbar Chrome

## 📱 Cara Penggunaan

### 1. Setup Awal

1. **Jalankan server**: `npm run start-server` (dari root) atau `cd server && npm start`
2. **Buka lelang.go.id** di browser
3. **Login** ke akun Anda
4. **Buka halaman lelang** yang ingin di-bid
5. **Klik icon extension** untuk cek status

### 2. Menggunakan Bot Telegram

1. **Cari bot Anda** di Telegram
2. **Kirim `/start`** untuk memulai
3. **Kirim `/help`** untuk melihat perintah

### 3. Perintah Bot

```
/bid <lot_id> <amount>
```
Contoh: `/bid 12345 1000000`

```
/status
```
Cek status tab browser yang terhubung

```
/help
```
Tampilkan bantuan

## 🔧 Troubleshooting

### Server tidak bisa start
- Pastikan port 3000 tidak digunakan aplikasi lain
- Cek apakah BOT_TOKEN sudah benar di `server/config.env`
- Jalankan `cd server && npm install` untuk install dependencies

### Error: "409 Conflict: terminated by other getUpdates request"
- **Penyebab**: Ada multiple instance bot yang berjalan bersamaan
- **Solusi**: 
  ```bash
  # Gunakan script yang sudah diperbaiki
  ./start.sh    # Otomatis stop instance lama
  
  # Atau stop manual
  ./stop.sh     # Stop semua instance
  pkill -f "node server.js"  # Force stop
  ```

### Extension tidak terhubung
- Pastikan server sudah running (`npm run start-server`)
- Cek apakah sudah login di lelang.go.id
- Refresh halaman lelang
- Pastikan extension di-load dari folder `extension/`

### Bid gagal
- Pastikan sudah login
- Cek apakah nominal bid valid
- Pastikan halaman lelang masih aktif
- Cek console browser untuk error messages

## 🚀 Perintah yang Tersedia

### Script Otomatis (Recommended)
```bash
./start.sh    # Start server dengan auto-stop instance lama
./stop.sh     # Stop semua instance server
./setup.sh    # Setup dependencies
```

### Perintah NPM
```bash
# Dari root directory
npm run start-server    # Jalankan server
npm run dev-server      # Jalankan server dengan nodemon
npm run install-all     # Install semua dependencies
npm run install-server  # Install dependencies server saja
npm run install-extension # Install dependencies extension saja

# Dari server directory
cd server
npm start              # Jalankan server
npm run dev            # Jalankan dengan nodemon
```

### Perintah Manual
```bash
# Stop server manual
pkill -f "node server.js"        # Stop semua instance
pkill -9 -f "node server.js"     # Force stop

# Cek instance yang berjalan
ps aux | grep "node server.js" | grep -v grep
```

## ⚠️ Disclaimer

Extension ini dibuat untuk keperluan edukasi dan testing. Penggunaan untuk tujuan komersial atau ilegal adalah tanggung jawab pengguna sendiri.

## 🐛 Bug Report

Jika menemukan bug atau masalah, silakan buat issue di repository ini.

## 📄 License

MIT License
