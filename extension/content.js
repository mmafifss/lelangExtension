// ============================================
// content.js (Content Script for Scraping) - ENHANCED VERSION WITH BETTER PASSKEY DETECTION
// Scrapes data yang dibutuhkan untuk bot Telegram:
// - Cookies session
// - Bearer token
// - Auction ID
// - Passkey untuk bidding (dengan multiple detection methods)
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getLotData') {
        try {
            const lotData = scrapeLotData();
            sendResponse(lotData);
        } catch (error) {
            console.error('Error scraping lot data:', error);
            sendResponse({ error: error.message });
        }
        return true;
    }

    if (request.action === 'executeBid') {
        try {
            executeBidAPI(request.data).then(result => {
                sendResponse(result);
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
        return true; // Async response
    }

    if (request.action === 'clickShowPin') {
        try {
            // Coba klik tombol show/hide PIN
            clickShowPinButton();
            sendResponse({ success: true });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
});

// Function untuk klik tombol show PIN
function clickShowPinButton() {
    // Cari tombol eye icon untuk show/hide PIN
    const pinSection = Array.from(document.querySelectorAll('.flex.flex-col.justify-center.gap-2'))
        .find(el => {
            const label = el.querySelector('p.font-medium');
            return label && label.textContent.trim() === 'PIN Bidding';
        });

    if (pinSection) {
        const eyeIcon = pinSection.querySelector('.pi-eye, .pi-eye-slash');
        if (eyeIcon) {
            eyeIcon.click();
            console.log('✅ Clicked show PIN button');
            return true;
        }
    }

    console.log('⚠️ Show PIN button not found');
    return false;
}

// Function untuk execute bid via API
async function executeBidAPI(bidData) {
    const { auctionId, bidAmount, passkey } = bidData;

    // Ambil token dari localStorage
    const token = localStorage.getItem('token-FO');
    if (!token) {
        throw new Error('Token tidak ditemukan. Pastikan sudah login.');
    }

    const apiUrl = 'https://bidding.lelang.go.id/api/v1/pelaksanaan/lelang/pengajuan-penawaran';

    const payload = {
        auctionId: auctionId,
        bidAmount: bidAmount,
        bidTime: new Date().toISOString(),
        passkey: passkey
    };

    console.log('🔄 Sending bid to API:', payload);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ Bid response:', result);

        return {
            success: true,
            data: result,
            message: 'Bid berhasil dikirim!'
        };

    } catch (error) {
        console.error('❌ Bid error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

function scrapeLotData() {
    // Helper function untuk mengambil text dari selector
    const getText = (selector) => {
        const element = document.querySelector(selector);
        return element ? element.textContent.trim() : null;
    };

    // ============================================
    // 1. AMBIL BEARER TOKEN dari localStorage
    // ============================================
    const bearerToken = localStorage.getItem('token-FO');

    // ============================================
    // 2. AMBIL COOKIES SESSION
    // ============================================
    const cookies = document.cookie;

    // ============================================
    // 3. AMBIL AUCTION ID dari URL
    // ============================================
    const urlMatch = window.location.href.match(/detail-open-bidding\/([a-f0-9-]+)/);
    const auctionId = urlMatch ? urlMatch[1] : null;

    // ============================================
    // 4. AMBIL PASSKEY (PIN Bidding) - ENHANCED DETECTION
    // ============================================
    let passkey = null;
    let passkeyStatus = 'not_found';

    // Method 1: Dari section "PIN Bidding" yang visible (jika sudah di-show)
    const pinBiddingSection = Array.from(document.querySelectorAll('.flex.flex-col.justify-center.gap-2'))
        .find(el => {
            const label = el.querySelector('p.font-medium');
            return label && label.textContent.trim() === 'PIN Bidding';
        });

    if (pinBiddingSection) {
        const valueContainer = pinBiddingSection.querySelector('.md\\:w-4\\/6, [class*="md:w-4/6"]');
        if (valueContainer) {
            const pinText = valueContainer.textContent.trim();
            console.log('PIN Bidding text found:', pinText);

            // Cek apakah PIN masih tersembunyi (4***** atau *****1 dll)
            if (pinText.includes('*')) {
                passkeyStatus = 'hidden';
                console.log('⚠️ PIN masih tersembunyi, perlu klik tombol show');
            } else {
                // PIN sudah terlihat, extract angkanya
                const match = pinText.match(/(\d{6})/);
                if (match) {
                    passkey = match[1];
                    passkeyStatus = 'found';
                    console.log('✅ PIN Bidding found (visible):', passkey);
                }
            }
        }
    }

    // Method 2: Dari input field PIN (jika user sudah input)
    if (!passkey) {
        const pinInput = document.querySelector('#pin');
        if (pinInput && pinInput.value && pinInput.value.length === 6) {
            passkey = pinInput.value;
            passkeyStatus = 'found_from_input';
            console.log('✅ PIN found from input field:', passkey);
        }
    }

    // Method 3: Coba dari disclosure panel yang expanded
    if (!passkey) {
        const disclosurePanels = document.querySelectorAll('[id^="headlessui-disclosure-panel"]');
        disclosurePanels.forEach(panel => {
            const text = panel.textContent;
            if (text.includes('PIN Bidding')) {
                // Cek apakah ada angka 6 digit yang tidak tersembunyi
                const allMatches = text.match(/\b\d{6}\b/g);
                if (allMatches && allMatches.length > 0) {
                    // Ambil yang terakhir (biasanya PIN paling baru)
                    passkey = allMatches[allMatches.length - 1];
                    passkeyStatus = 'found_from_panel';
                    console.log('✅ PIN found from disclosure panel:', passkey);
                }
            }
        });
    }

    // Method 4: Dari data attribute atau hidden field
    if (!passkey) {
        const hiddenFields = document.querySelectorAll('input[type="hidden"]');
        hiddenFields.forEach(field => {
            if (field.name && field.name.toLowerCase().includes('pin') && field.value && field.value.length === 6) {
                passkey = field.value;
                passkeyStatus = 'found_from_hidden';
                console.log('✅ PIN found from hidden field:', passkey);
            }
        });
    }

    // ============================================
    // 5. AMBIL DATA LELANG LAINNYA
    // ============================================

    // Ambil countdown timer
    const countdown = document.querySelector('.rounded-md.bg-ternary-green-100 .flex.items-center');
    const countdownText = countdown ? countdown.textContent.trim() : null;

    // Ambil penawaran tertinggi
    const highestBidElement = document.querySelector('.bg-primary-500.p-2.text-white .text-center.text-lg.font-bold');
    const highestBidText = highestBidElement ? highestBidElement.textContent.trim() : null;

    // Parse harga tertinggi
    let currentPrice = null;
    let isYourBid = false;
    if (highestBidText) {
        const priceMatch = highestBidText.match(/Rp([\d.,]+)/);
        if (priceMatch) {
            currentPrice = parseInt(priceMatch[1].replace(/\./g, ''));
        }
        isYourBid = highestBidText.includes('(Anda)');
    }

    // Ambil riwayat penawaran
    const bidHistory = [];
    const historyElements = document.querySelectorAll('.custom-scrollbar .border-b.border-primary-500');
    historyElements.forEach(el => {
        const text = el.textContent.trim();
        const priceMatch = text.match(/Rp([\d.,]+)/);
        if (priceMatch) {
            bidHistory.push({
                price: parseInt(priceMatch[1].replace(/\./g, '')),
                isYours: text.includes('(Anda)')
            });
        }
    });

    // Ambil input penawaran saat ini
    const bidInputElement = document.querySelector('#bidAmount');
    const currentBidInput = bidInputElement ? bidInputElement.value : null;
    let currentBidAmount = null;
    if (currentBidInput) {
        currentBidAmount = parseInt(currentBidInput.replace(/\./g, ''));
    }

    // Ambil terbilang
    const terbilangElement = document.querySelector('small.text-ternary-red-100');
    const terbilang = terbilangElement ? terbilangElement.textContent.trim() : null;

    // Ambil data lot lelang
    const lotDetails = {};
    let detailRows = document.querySelectorAll('.text-primary-500 .flex.flex-col.justify-center.gap-2');

    // Jika tidak ada, coba selector alternatif
    if (detailRows.length === 0) {
        detailRows = document.querySelectorAll('[class*="flex-col"][class*="justify-center"][class*="gap-2"]');
    }

    detailRows.forEach(row => {
        const label = row.querySelector('p.font-medium');
        const valueContainer = row.querySelector('.md\\:w-4\\/6, [class*="md:w-4/6"]');

        if (label && valueContainer) {
            const labelText = label.textContent.trim();
            const valueText = valueContainer.textContent.trim();

            switch (labelText) {
                case 'Kode':
                    lotDetails.kode = valueText;
                    break;
                case 'KPKNL':
                    lotDetails.kpknl = valueText;
                    break;
                case 'Uraian Lot Lelang':
                    const link = valueContainer.querySelector('a');
                    lotDetails.uraian = link ? link.textContent.trim() : valueText;
                    lotDetails.detailUrl = link ? link.href : null;
                    break;
                case 'Cara Penawaran':
                    lotDetails.caraPenawaran = valueText;
                    break;
                case 'Nilai Limit':
                    const limitMatch = valueText.match(/Rp([\d.,]+)/);
                    lotDetails.nilaiLimit = limitMatch ? parseInt(limitMatch[1].replace(/\./g, '')) : null;
                    lotDetails.nilaiLimitText = valueText;
                    break;
                case 'Batas Penerimaan Uang Jaminan':
                    lotDetails.batasJaminan = valueText;
                    break;
                case 'Tanggal Mulai':
                    lotDetails.tanggalMulai = valueText;
                    break;
                case 'Tanggal Selesai (ditutup)':
                    lotDetails.tanggalSelesai = valueText;
                    break;
                case 'PIN Bidding':
                    lotDetails.pinBidding = valueText;
                    break;
            }
        }
    });

    // Ambil waktu server
    const serverTimeHour = getText('.fixed.bottom-\\[5\\%\\].left-0 .font-bold');
    const serverTimeDate = getText('.fixed.bottom-\\[5\\%\\].left-0 .text-xs:last-child');

    // Ambil nama user
    const userButton = document.querySelector('#headlessui-menu-button-\\:r2\\: .flex.items-center');
    const userName = userButton ? userButton.textContent.trim() : null;

    // Check login status
    const isLoggedIn = userName && userName !== 'LOGIN';

    // ============================================
    // RETURN DATA LENGKAP UNTUK BOT TELEGRAM
    // ============================================
    return {
        success: true,
        isLoggedIn: isLoggedIn,
        userName: userName,

        // ✅ DATA PENTING UNTUK BOT TELEGRAM
        auctionId: auctionId,           // Untuk /setauction
        passkey: passkey,                // Untuk /setPassBidding
        passkeyStatus: passkeyStatus,    // Status detection: found, hidden, not_found
        bearerToken: bearerToken,        // Untuk /settoken
        cookies: cookies,                // Untuk /setcookies

        // Timer
        countdown: countdownText,

        // Penawaran
        currentPrice: currentPrice,
        highestBidText: highestBidText,
        isYourBid: isYourBid,
        currentBidInput: currentBidAmount,
        terbilang: terbilang,
        bidHistory: bidHistory,

        // Detail Lot
        title: lotDetails.uraian,
        kode: lotDetails.kode,
        kpknl: lotDetails.kpknl,
        caraPenawaran: lotDetails.caraPenawaran,
        nilaiLimit: lotDetails.nilaiLimit,
        nilaiLimitText: lotDetails.nilaiLimitText,
        batasJaminan: lotDetails.batasJaminan,
        tanggalMulai: lotDetails.tanggalMulai,
        tanggalSelesai: lotDetails.tanggalSelesai,
        pinBidding: lotDetails.pinBidding,
        detailUrl: lotDetails.detailUrl,

        // Server time
        serverTime: serverTimeHour,
        serverDate: serverTimeDate,

        // URL
        currentUrl: window.location.href,

        // Timestamp
        scrapedAt: new Date().toISOString()
    };
}

// Auto-refresh data setiap 3 detik dan kirim ke background
let lastLoginStatus = null;
let autoClickAttempted = false;

setInterval(() => {
    const data = scrapeLotData();

    // Detect logout
    if (lastLoginStatus === true && data.isLoggedIn === false) {
        console.log('🚨 Logout detected in content script!');
        chrome.runtime.sendMessage({
            action: 'userLoggedOut',
            timestamp: new Date().toISOString()
        }).catch(() => { });
    }

    // Auto-click show PIN jika masih hidden (hanya sekali)
    if (!autoClickAttempted && data.passkeyStatus === 'hidden') {
        console.log('🔄 Attempting to auto-click show PIN button...');
        clickShowPinButton();
        autoClickAttempted = true;

        // Reset flag setelah 5 detik untuk retry
        setTimeout(() => {
            autoClickAttempted = false;
        }, 5000);
    }

    lastLoginStatus = data.isLoggedIn;

    // Kirim data ke background script
    chrome.runtime.sendMessage({
        action: 'autoRefreshData',
        data: data
    }).catch(() => {
        // Extension mungkin tidak listening, abaikan error
    });
}, 3000); // Setiap 3 detik untuk real-time

console.log('✅ Lelang.go.id content script loaded - Enhanced version with auto PIN detection');
console.log('📊 Auto-scraping: Bearer Token, Cookies, Auction ID, Passkey');
console.log('🔍 Passkey auto-detection with multiple methods');