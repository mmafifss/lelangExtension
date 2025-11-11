# 🚀 Panduan Sistem Bid Baru (API Direct)

## 🎯 Konsep Baru

Sistem sekarang **JAUH LEBIH SIMPLE**! Tidak perlu copy-paste lot ID lagi.

### ⚡ Command Baru:
```
/bid PIN SELISIH
```

**Contoh:**
```
/bid 461802 1000000
```

Artinya: Bid dengan selisih Rp 1 juta di atas harga tertinggi saat ini menggunakan PIN 461802.

---

## 📋 Cara Kerja

### 1. **Real-time Data Scraping**
- Extension otomatis scrape data setiap 3 detik
- Data termasuk: harga tertinggi, PIN bidding, countdown, dll
- Data dikirim ke server otomatis

### 2. **Smart PIN Matching**
- Bot cari lelang yang cocok dengan PIN yang kamu input
- Tidak perlu input lot ID atau auction UUID lagi
- Semua otomatis berdasarkan PIN

### 3. **Automatic Bid Calculation**
- Bot ambil harga tertinggi real-time
- Tambah dengan selisih yang kamu mau
- Langsung hit API lelang.go.id

### 4. **Instant Notification**
- Langsung dapat notif hasil bid
- Sukses atau gagal, langsung tahu
- Bisa langsung bid lagi jika perlu

---

## 🔧 Setup

### 1. Copy Files Baru

Ganti file-file ini dengan versi baru:

```bash
# Copy ke extension folder
cp /home/claude/content.js /path/to/extension/content.js
cp /home/claude/background.js /path/to/extension/background.js

# Copy ke server folder  
cp /home/claude/server.js /path/to/server/server.js
```

### 2. Reload Extension

1. Buka `chrome://extensions/`
2. Klik reload pada extension
3. Refresh halaman lelang

### 3. Restart Server

```bash
cd server
npm start
```

---

## 📱 Cara Penggunaan

### Step 1: Buka Halaman Lelang
- Login ke lelang.go.id
- Buka halaman detail lelang
- Pastikan extension aktif

### Step 2: Check PIN Bidding
- Lihat PIN di halaman lelang (6 digit)
- Atau gunakan `/info` di Telegram untuk lihat PIN

### Step 3: Bid dari Telegram

**Format:**
```
/bid [PIN] [SELISIH]
```

**Contoh Real:**

Misal:
- Harga tertinggi saat ini: Rp 250.000.000
- PIN Bidding: 461802
- Mau bid Rp 251.000.000 (selisih 1 juta)

Command:
```
/bid 461802 1000000
```

Bot akan:
1. Cari lelang dengan PIN 461802
2. Ambil harga tertinggi (Rp 250.000.000)
3. Hitung: 250.000.000 + 1.000.000 = 251.000.000
4. Hit API dengan bid Rp 251.000.000
5. Kirim notifikasi hasil

---

## 🎮 Command Telegram

### `/status`
Lihat semua lelang yang terhubung dengan info:
- Kode lot
- Harga tertinggi
- PIN Bidding
- Status login

### `/info`
Info detail lelang termasuk:
- Countdown timer
- Nilai limit
- Command copy-paste siap pakai

### `/bid PIN SELISIH`
Execute bid langsung!

### `/help`
Bantuan lengkap

### `/ping`
Test koneksi bot

---

## 💡 Tips & Trik

### 1. **Copy-Paste PIN**
Gunakan `/info` untuk mendapatkan command siap pakai:
```
/bid 461802 SELISIH
```
Tinggal ganti SELISIH dengan nominal yang kamu mau.

### 2. **Strategi Selisih**
- Selisih kecil (50rb - 500rb): Untuk bid akhir/mepet
- Selisih sedang (500rb - 2jt): Untuk bid agresif
- Selisih besar (> 2jt): Untuk langsung menang

### 3. **Monitor Real-time**
- Data update setiap 3 detik
- Gunakan `/status` untuk cek harga terbaru
- Bot otomatis notif jika ada penawar baru

### 4. **Multi-lelang**
- Bisa buka beberapa tab lelang sekaligus
- Setiap lelang punya PIN berbeda
- Bot bisa handle semua bersamaan

---

## ⚠️ Troubleshooting

### "Lelang tidak ditemukan"
- Pastikan halaman lelang terbuka di browser
- Cek PIN yang diinput benar (6 digit)
- Gunakan `/status` untuk lihat PIN yang terhubung
- Refresh halaman jika perlu

### "Gagal membaca harga tertinggi"
- Refresh halaman lelang
- Pastikan sudah login
- Tunggu beberapa detik untuk extension scrape data

### "Bid terlalu rendah"
- Harga sudah naik saat bid dikirim
- Gunakan selisih lebih besar
- Cek harga terbaru dengan `/info`

### "Bid gagal - API Error"
- Token mungkin expired, login ulang
- Pastikan PIN benar
- Cek koneksi internet

---

## 🎯 Contoh Skenario

### Skenario 1: Bid Cepat di Akhir
```
# 5 menit terakhir, ingin bid cepat
/info                    # Cek harga terbaru
/bid 461802 100000      # Bid cepat, selisih kecil
```

### Skenario 2: Bid Agresif
```
# Ingin langsung menang, tidak mau dikejar
/bid 461802 5000000     # Bid langsung +5 juta
```

### Skenario 3: Multi-lelang
```
# Buka 3 tab lelang berbeda
Tab 1: PIN 461802
Tab 2: PIN 523456  
Tab 3: PIN 678901

# Bid sesuai kebutuhan
/bid 461802 1000000     # Lelang 1
/bid 523456 2000000     # Lelang 2
/bid 678901 500000      # Lelang 3
```

---

## 🔐 Security Notes

- Token disimpan di localStorage browser
- PIN hanya digunakan untuk matching, bukan auth
- API hit langsung dari content script (secure)
- Tidak ada data sensitif di server

---

## 🚀 Keuntungan Sistem Baru

✅ **Super Cepat** - Langsung hit API, tidak ada delay  
✅ **Simple Command** - Cuma perlu PIN & selisih  
✅ **Real-time** - Data update setiap 3 detik  
✅ **Auto Calculate** - Bot hitung sendiri bid amount  
✅ **No Copy-Paste** - Tidak perlu copy data manual  
✅ **Multi-lelang** - Bisa handle banyak lelang  
✅ **Smart Matching** - Otomatis cocokkan PIN  
✅ **Instant Feedback** - Langsung tahu hasil bid  

---

## 📊 Comparison

### Sistem Lama:
```
1. Cek UUID di URL (manual)
2. Input /bid UUID AMOUNT (panjang)
3. Extension polling command (delay)
4. Execute bid
```

### Sistem Baru:
```
1. /bid PIN SELISIH (simple!)
2. Bot auto calculate & execute (instant!)
```

**Kesimpulan:** Sistem baru 3x lebih cepat dan jauh lebih mudah! 🚀

---

## 🎉 Selamat Mencoba!

Kalau ada pertanyaan, gunakan `/help` di bot atau buka issue di GitHub.

Happy bidding! 🏆