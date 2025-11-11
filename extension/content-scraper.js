// ============================================
// content-scraper.js - Enhanced scraping with passkey
// ============================================

function getAuthToken() {
    // Ambil token dari localStorage
    const tokenKey = 'token-FO';
    const token = localStorage.getItem(tokenKey);
    return token;
}

function getPasskey() {
    // Method 1: Dari disclosure panel
    let passkey = null;

    // Coba dari berbagai selector PIN Bidding
    const selectors = [
        '#headlessui-disclosure-panel-\\:r8\\:',
        '[id^="headlessui-disclosure-panel"]',
        '.text-primary-500 .flex.flex-col.justify-center.gap-2'
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

    // Method 2: Dari tombol "Salin PIN Bidding"
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

    return passkey;
}

function getCurrentPrice() {
    const highestBidElement = document.querySelector('.bg-primary-500.p-2.text-white .text-center.text-lg.font-bold');
    if (!highestBidElement) return null;

    const text = highestBidElement.textContent.trim();
    const priceMatch = text.match(/Rp([\d.,]+)/);

    if (priceMatch) {
        return parseInt(priceMatch[1].replace(/\./g, ''));
    }
    return null;
}

function getAuctionUuid() {
    const urlMatch = window.location.href.match(/detail-open-bidding\/([a-f0-9-]+)/);
    return urlMatch ? urlMatch[1] : null;
}

function getLotCode() {
    // Dari Data Lot Lelang
    let kode = null;
    const detailRows = document.querySelectorAll('.text-primary-500 .flex.flex-col.justify-center.gap-2');

    detailRows.forEach(row => {
        const label = row.querySelector('p.font-medium');
        if (label && label.textContent.trim() === 'Kode') {
            const valueContainer = row.querySelector('.md\\:w-4\\/6, [class*="md:w-4/6"]');
            if (valueContainer) {
                kode = valueContainer.textContent.trim();
            }
        }
    });

    return kode;
}

// Export function untuk digunakan content.js
window.lelangScraperUtils = {
    getAuthToken,
    getPasskey,
    getCurrentPrice,
    getAuctionUuid,
    getLotCode
};

console.log('Lelang Scraper Utils loaded');