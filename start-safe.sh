#!/bin/bash

# Script untuk menjalankan server dengan check instance

echo "🚀 Starting Lelang Bid Server..."
echo "================================"

# Cek apakah ada instance yang sudah berjalan
if pgrep -f "node server.js" > /dev/null; then
    echo "⚠️  Ada instance server yang sudah berjalan!"
    echo "🔄 Menghentikan instance lama..."
    pkill -f "node server.js"
    sleep 2
    
    # Cek lagi apakah masih ada
    if pgrep -f "node server.js" > /dev/null; then
        echo "❌ Gagal menghentikan instance lama. Silakan hentikan manual:"
        echo "   pkill -f 'node server.js'"
        exit 1
    fi
    echo "✅ Instance lama berhasil dihentikan"
fi

# Cek apakah config.env ada
if [ ! -f "server/config.env" ]; then
    echo "❌ File server/config.env tidak ditemukan!"
    echo "📝 Silakan copy server/config.env.example ke server/config.env"
    echo "📝 Dan edit BOT_TOKEN dengan token bot Telegram Anda"
    exit 1
fi

# Cek apakah BOT_TOKEN sudah di-set
if grep -q "8389335047:AAEGk6uja3umCEb-kBOwzKdPSKgTzKgS9_c" server/config.env; then
    echo "❌ BOT_TOKEN belum di-set!"
    echo "📝 Silakan edit server/config.env dan masukkan token bot Telegram Anda"
    exit 1
fi

echo "✅ Konfigurasi ditemukan"
echo "🔄 Starting server..."

# Jalankan server
cd server
npm start
