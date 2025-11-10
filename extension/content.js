// ============================================
// content.js (Content Script for Scraping)
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
});

function scrapeLotData() {
    // Helper function untuk mengambil text dari selector
    const getText = (selector) => {
        const element = document.querySelector(selector);
        return element ? element.textContent.trim() : null;
    };

    // Helper function untuk mengambil semua text dari selector
    const getAllText = (selector) => {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements).map(el => el.textContent.trim());
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

    // Ambil data lot lelang dari disclosure panel - try multiple selectors
    const lotDetails = {};

    // Try berbagai cara untuk mendapatkan data detail
    let detailRows = document.querySelectorAll('.text-primary-500 .flex.flex-col.justify-center.gap-2');

    // Jika tidak ada, coba selector alternatif
    if (detailRows.length === 0) {
        detailRows = document.querySelectorAll('[class*="flex-col"][class*="justify-center"][class*="gap-2"]');
    }

    // Jika masih tidak ada, coba dari parent
    if (detailRows.length === 0) {
        const disclosurePanel = document.querySelector('[id^="headlessui-disclosure-panel"]');
        if (disclosurePanel) {
            detailRows = disclosurePanel.querySelectorAll('.flex.flex-col.justify-center.gap-2');
        }
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

    // Fallback: jika data masih kosong, coba scrape langsung dari text
    if (!lotDetails.kode) {
        const allText = document.body.innerText;
        const kodeMatch = allText.match(/Kode[\s\n]+([A-Z0-9]+)/);
        if (kodeMatch) lotDetails.kode = kodeMatch[1];
    }

    if (!lotDetails.kpknl) {
        const allText = document.body.innerText;
        const kpknlMatch = allText.match(/KPKNL[\s\n]+(KPKNL [A-Za-z\s]+)/);
        if (kpknlMatch) lotDetails.kpknl = kpknlMatch[1];
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

    return {
        success: true,
        isLoggedIn: isLoggedIn,
        userName: userName,
        auctionUuid: auctionUuid,

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
        currentUrl: window.location.href
    };
}

// Auto-refresh data setiap 5 detik jika ada listener
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

    lastLoginStatus = data.isLoggedIn;

    chrome.runtime.sendMessage({
        action: 'autoRefreshData',
        data: data
    }).catch(() => {
        // Extension mungkin tidak listening, abaikan error
    });
}, 5000);

console.log('Lelang.go.id content script loaded');