// ============================================
// background.js - FIXED with proper server reporting
// ============================================

const SERVER_URL = 'http://localhost:3000';
let currentAuctionData = null;
let reportInterval = null;

// Listen untuk pesan dari content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'autoRefreshData') {
        // Simpan data terbaru
        currentAuctionData = request.data;

        console.log('📥 Received data from content script:', {
            auctionUuid: request.data.auctionUuid,
            passkey: request.data.passkey,
            currentPrice: request.data.currentPrice
        });

        // Simpan ke storage
        chrome.storage.local.set({
            latestLotData: request.data,
            lastUpdate: new Date().toISOString(),
            tabId: sender.tab?.id
        });

        // Report ke server jika data valid
        if (request.data.auctionUuid && request.data.passkey) {
            reportToServer(request.data, sender.tab?.id);
        } else {
            console.warn('⚠️ Data tidak lengkap:', {
                hasUuid: !!request.data.auctionUuid,
                hasPasskey: !!request.data.passkey
            });
        }

        // Kirim notifikasi jika ada perubahan penting
        checkForImportantChanges(request.data);
    }

    if (request.action === 'userLoggedOut') {
        handleLogoutNotification();
    }

    return true;
});

// Report data ke server dengan retry mechanism
async function reportToServer(data, tabId) {
    if (!data.auctionUuid) {
        console.error('❌ Cannot report: No auctionUuid');
        return;
    }

    const reportData = {
        auctionId: data.auctionUuid,
        tabId: tabId,
        data: {
            kode: data.kode,
            title: data.title,
            currentPrice: data.currentPrice,
            passkey: data.passkey,
            isYourBid: data.isYourBid,
            isLoggedIn: data.isLoggedIn,
            countdown: data.countdown,
            kpknl: data.kpknl,
            nilaiLimitText: data.nilaiLimitText,
            tanggalSelesai: data.tanggalSelesai
        }
    };

    console.log('📤 Reporting to server:', reportData);

    try {
        const response = await fetch(`${SERVER_URL}/api/tab-connected`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(reportData)
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Successfully reported to server:', result);

    } catch (error) {
        console.error('❌ Failed to report to server:', error);

        // Retry setelah 5 detik
        setTimeout(() => {
            console.log('🔄 Retrying report to server...');
            reportToServer(data, tabId);
        }, 5000);
    }
}

// Polling untuk bid commands dari server
setInterval(async () => {
    if (!currentAuctionData || !currentAuctionData.auctionUuid) {
        return;
    }

    try {
        const response = await fetch(
            `${SERVER_URL}/api/pending-bids?auctionId=${currentAuctionData.auctionUuid}`
        );

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const { bids } = await response.json();

        if (bids && bids.length > 0) {
            console.log('📥 Got pending bids:', bids.length);
            for (const bid of bids) {
                await executeBid(bid);
            }
        }
    } catch (error) {
        console.error('❌ Failed to poll bids:', error);
    }
}, 2000); // Poll setiap 2 detik

// Execute bid via API
async function executeBid(bidCommand) {
    const { commandId, bidAmount, passkey, auctionId } = bidCommand;

    console.log('🚀 Executing bid:', bidCommand);

    try {
        // Ambil tab yang sesuai
        const tabs = await chrome.tabs.query({
            url: '*://lelang.go.id/*'
        });

        const targetTab = tabs.find(tab =>
            tab.url.includes(auctionId)
        );

        if (!targetTab) {
            throw new Error('Tab tidak ditemukan');
        }

        // Execute bid via content script
        const result = await chrome.tabs.sendMessage(targetTab.id, {
            action: 'executeBid',
            data: {
                auctionId: auctionId,
                bidAmount: bidAmount,
                passkey: passkey
            }
        });

        // Report result ke server
        await fetch(`${SERVER_URL}/api/bid-result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                commandId: commandId,
                success: result.success,
                error: result.error,
                data: {
                    lotCode: currentAuctionData?.kode,
                    isHighest: result.success ? true : false
                }
            })
        });

        if (result.success) {
            showNotification(
                '✅ Bid Berhasil!',
                `Rp ${bidAmount.toLocaleString('id-ID')}`
            );
        } else {
            showNotification(
                '❌ Bid Gagal',
                result.error || 'Unknown error'
            );
        }

    } catch (error) {
        console.error('❌ Bid execution failed:', error);

        // Report error ke server
        await fetch(`${SERVER_URL}/api/bid-result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                commandId: commandId,
                success: false,
                error: error.message
            })
        });
    }
}

function handleLogoutNotification() {
    console.log('🚨 User logged out - sending notification');

    showNotification(
        '🚨 Sesi Berakhir!',
        'Anda telah logout dari lelang.go.id. Silakan login kembali untuk melanjutkan.'
    );

    chrome.storage.local.remove(['latestLotData', 'lastUpdate']);
    previousData = null;
    currentAuctionData = null;
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

    // Cek jika mendekati akhir lelang (< 10 menit)
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
        console.log('✅ Lelang Monitor Extension installed - Enhanced version');
    } else if (details.reason === 'update') {
        console.log('✅ Lelang Monitor Extension updated to version', chrome.runtime.getManifest().version);
    }
});

// Cleanup data lama setiap jam
setInterval(() => {
    chrome.storage.local.get(['lastUpdate'], (result) => {
        if (result.lastUpdate) {
            const lastUpdate = new Date(result.lastUpdate);
            const now = new Date();
            const hoursDiff = (now - lastUpdate) / (1000 * 60 * 60);

            if (hoursDiff > 24) {
                chrome.storage.local.remove(['latestLotData', 'lastUpdate']);
                console.log('Old data cleaned up');
            }
        }
    });
}, 60 * 60 * 1000);

console.log('✅ Lelang Monitor background service worker started - Enhanced version with debug');
console.log('🔧 Server URL:', SERVER_URL);