#!/bin/bash

# Script untuk setup dan menjalankan sistem lelang bid

echo "🚀 Setup Lelang Bid System"
echo "=========================="

# Install dependencies untuk server
echo "📦 Installing server dependencies..."
cd server
npm install
cd ..

echo "✅ Setup completed!"
echo ""
echo "📋 Cara menjalankan:"
echo "1. Edit file server/config.env dengan bot token Anda"
echo "2. Jalankan server: npm run start-server"
echo "3. Install extension di Chrome dari folder extension/"
echo "4. Buka lelang.go.id dan mulai bid via Telegram!"
echo ""
echo "🔧 Perintah yang tersedia:"
echo "  npm run start-server    - Jalankan server"
echo "  npm run dev-server      - Jalankan server dengan nodemon"
echo "  npm run install-all     - Install semua dependencies"
