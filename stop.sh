#!/bin/bash

# Script untuk menghentikan server

echo "🛑 Stopping Lelang Bid Server..."
echo "================================"

# Cek apakah ada instance yang berjalan
if pgrep -f "node server.js" > /dev/null; then
    echo "🔄 Menghentikan server..."
    pkill -f "node server.js"
    sleep 2
    
    # Cek apakah berhasil dihentikan
    if pgrep -f "node server.js" > /dev/null; then
        echo "❌ Gagal menghentikan server. Coba dengan force:"
        echo "   pkill -9 -f 'node server.js'"
        exit 1
    else
        echo "✅ Server berhasil dihentikan"
    fi
else
    echo "ℹ️  Tidak ada server yang berjalan"
fi
