// ============================================
// content.js (Content Script for Scraping) - ENHANCED VERSION
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
});

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

    // Scrape passkey dengan multiple methods
    let passkey = null;

    // Method 1: Dari PIN Bidding text
    if (lotDetails.pinBidding) {
        const pinMatch = lotDetails.pinBidding.match(/(\d{6})/);
        if (pinMatch) {
            passkey = pinMatch[1];
        }
    }

    // Method 2: Dari disclosure panel
    if (!passkey) {
        const selectors = [
            '#headlessui-disclosure-panel-\\:r8\\:',
            '[id^="headlessui-disclosure-panel"]'
        ];

        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                const text = el.textContent;
                if (text.includes('PIN Bidding')) {
                    const match = text.match(/(\d{6})/);
                    if (match) {
                        passkey = match[1];
                    }
                }
            });
            if (passkey) break;
        }
    }

    // Method 3: Dari tombol "Salin PIN Bidding"
    if (!passkey) {
        const copyButton = Array.from(document.querySelectorAll('button'))
            .find(btn => btn.textContent.includes('Salin PIN Bidding'));

        if (copyButton) {
            const parent = copyButton.closest('.flex.flex-col.justify-center.gap-2');
            if (parent) {
                const pinText = parent.textContent;
                const match = pinText.match(/(\d{6})/);
                if (match) {
                    passkey = match[1];
                }
            }
        }
    }


    // Ambil waktu server
    const serverTimeHour = getText('.fixed.bottom-\\[5\\%\\].left-0 .font-bold');
    const serverTimeDate = getText('.fixed.bottom-\\[5\\%\\].left-0 .text-xs:last-child');

    // Ambil nama user
    const userButton = document.querySelector('#headlessui-menu-button-\\:r2\\: .flex.items-center');
    const userName = userButton ? userButton.textContent.trim() : null;

    // Check login status
    const isLoggedIn = userName && userName !== 'LOGIN';

    // Ambil UUID dari URL
    const urlMatch = window.location.href.match(/detail-open-bidding\/([a-f0-9-]+)/);
    const auctionUuid = urlMatch ? urlMatch[1] : null;

    // Ambil token dari localStorage
    const token = localStorage.getItem('token-FO');

    return {
        success: true,
        isLoggedIn: isLoggedIn,
        userName: userName,
        auctionUuid: auctionUuid,
        passkey: passkey,
        token: token ? token.substring(0, 20) + '...' : null, // Partial token untuk security

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

// Auto-refresh data setiap 3 detik
let lastLoginStatus = null;

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

    // lastLoginStatus = data.isLoggedIn;

    // chrome.runtime.sendMessage({
    //     action: 'autoRefreshData',
    //     data: data
    // }).catch(() => {
    //     // Extension mungkin tidak listening, abaikan error
    // });
}, 3000); // Setiap 3 detik untuk real-time

console.log('Lelang.go.id content script loaded - Enhanced version');