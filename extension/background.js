// ============================================
// background.js (Service Worker)
// ============================================

// Listen untuk pesan dari content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'autoRefreshData') {
        // Simpan data ke storage
        chrome.storage.local.set({
            latestLotData: request.data,
            lastUpdate: new Date().toISOString(),
            tabId: sender.tab?.id
        });

        // Kirim notifikasi jika ada perubahan penting
        checkForImportantChanges(request.data);
    }

    if (request.action === 'userLoggedOut') {
        // Handle logout notification
        handleLogoutNotification();
    }

    return true;
});

function handleLogoutNotification() {
    console.log('🚨 User logged out - sending notification');

    showNotification(
        '🚨 Sesi Berakhir!',
        'Anda telah logout dari lelang.go.id. Silakan login kembali untuk melanjutkan.'
    );

    // Clear stored data
    chrome.storage.local.remove(['latestLotData', 'lastUpdate']);

    // Reset previous data
    previousData = null;
}

// Track data sebelumnya untuk deteksi perubahan
let previousData = null;

async function checkForImportantChanges(newData) {
    if (!previousData) {
        previousData = newData;
        return;
    }

    // Cek jika ada penawar baru yang lebih tinggi
    if (newData.currentPrice && previousData.currentPrice) {
        if (newData.currentPrice > previousData.currentPrice) {
            // Cek apakah bukan bid kita sendiri
            if (!newData.isYourBid) {
                showNotification(
                    'Ada Penawar Baru! 🚨',
                    `Harga naik menjadi Rp ${newData.currentPrice.toLocaleString('id-ID')}\nLot: ${newData.kode || 'Unknown'}`
                );
            }
        }
    }

    // Cek jika kita kehilangan posisi tertinggi
    if (previousData.isYourBid && !newData.isYourBid) {
        showNotification(
            'Anda Tersalip! ⚠️',
            `Ada peserta lain bid lebih tinggi\nHarga sekarang: Rp ${newData.currentPrice.toLocaleString('id-ID')}`
        );
    }

    // Cek jika mendekati akhir lelang (misal < 10 menit)
    if (newData.countdown) {
        const parts = newData.countdown.split(':');
        if (parts.length === 4) {
            const [days, hours, minutes] = parts.map(p => parseInt(p.replace(/\D/g, '')) || 0);
            const totalMinutes = (days * 24 * 60) + (hours * 60) + minutes;

            if (totalMinutes <= 10 && totalMinutes > 0) {
                if (!previousData.countdown || previousData.countdown !== newData.countdown) {
                    showNotification(
                        'Lelang Hampir Berakhir! ⏰',
                        `Tinggal ${newData.countdown}\nSegera cek bid Anda!`
                    );
                }
            }
        }
    }

    previousData = { ...newData };
}

function showNotification(title, message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: title,
        message: message,
        priority: 2
    });
}

// Listen untuk instalasi extension
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Lelang Monitor Extension installed');
        // Buka halaman welcome atau setup
    } else if (details.reason === 'update') {
        console.log('Lelang Monitor Extension updated to version', chrome.runtime.getManifest().version);
    }
});

// Cleanup data lama setiap jam
setInterval(() => {
    chrome.storage.local.get(['lastUpdate'], (result) => {
        if (result.lastUpdate) {
            const lastUpdate = new Date(result.lastUpdate);
            const now = new Date();
            const hoursDiff = (now - lastUpdate) / (1000 * 60 * 60);

            // Hapus data jika sudah lebih dari 24 jam
            if (hoursDiff > 24) {
                chrome.storage.local.remove(['latestLotData', 'lastUpdate']);
                console.log('Old data cleaned up');
            }
        }
    });
}, 60 * 60 * 1000); // Setiap jam

console.log('Lelang Monitor background service worker started');