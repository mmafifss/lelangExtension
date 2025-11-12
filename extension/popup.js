// ============================================
// popup.js - READY TO USE VERSION
// Bot Username: @Lelangkpkbot
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    const statusDiv = document.getElementById('status');
    const lotInfo = document.getElementById('lotInfo');
    const loadingStateEl = document.getElementById('loadingState');

    // Bot Telegram Username (sudah di-set)
    const BOT_USERNAME = 'Lelangkpkbot';

    // Tambahkan section untuk data Telegram Bot
    const telegramDataSection = document.createElement('div');
    telegramDataSection.className = 'info-card';
    telegramDataSection.style.backgroundColor = '#e3f2fd';
    telegramDataSection.innerHTML = `
        <h3 style="margin-bottom: 10px; color: #1976d2; font-size: 14px;">
            📱 Data untuk Telegram Bot
        </h3>
        <div id="telegramData" style="font-size: 12px;">
            <p style="margin: 5px 0;">⏳ Memuat data...</p>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 10px; flex-direction: column;">
            <div style="display: flex; gap: 8px;">
                <button id="copyCommands" class="button button-primary" style="flex: 1; font-size: 12px;">
                    📋 Salin Command
                </button>
                <button id="refreshData" class="button button-primary" style="flex: 1; font-size: 12px; background: #4caf50;">
                    🔄 Refresh
                </button>
            </div>
            <button id="openTelegramBot" class="button button-primary" style="width: 100%; font-size: 13px; background: linear-gradient(135deg, #0088cc 0%, #005f8c 100%); padding: 12px;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <svg style="width: 18px; height: 18px; fill: white;" viewBox="0 0 24 24">
                        <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
                    </svg>
                    <span>Buka Bot @${BOT_USERNAME}</span>
                </div>
            </button>
        </div>
    `;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url) {
            statusDiv.textContent = 'Tidak dapat membaca tab aktif.';
            if (loadingStateEl) loadingStateEl.style.display = 'none';
            return;
        }

        const isAuctionPage = tab.url.includes('lelang.go.id/');

        if (!isAuctionPage) {
            statusDiv.textContent = 'Buka halaman lelang dulu';
            if (loadingStateEl) loadingStateEl.style.display = 'none';
            return;
        }

        // Function untuk render data
        async function renderData() {
            // Ambil data dari content script
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getLotData' });

            if (response && !response.error) {
                // Update status
                statusDiv.className = response.isLoggedIn ? 'status connected' : 'status disconnected';
                statusDiv.textContent = response.isLoggedIn ?
                    `✅ Terhubung${response.userName ? ' sebagai ' + response.userName : ''}` :
                    '⚠️ Belum Login';

                // Tampilkan info lot
                if (lotInfo) {
                    lotInfo.style.display = 'block';

                    // Update lot info elements
                    const lotTitleEl = document.getElementById('lotTitle');
                    const lotPriceEl = document.getElementById('lotPrice');
                    const lotCodeEl = document.getElementById('lotCode');
                    const kpknlEl = document.getElementById('kpknl');
                    const countdownEl = document.getElementById('countdown');
                    const nilaiLimitEl = document.getElementById('nilaiLimit');
                    const bidStatusEl = document.getElementById('bidStatus');
                    const loginStatusEl = document.getElementById('loginStatus');

                    if (lotTitleEl) lotTitleEl.textContent = response.title || 'Tidak diketahui';
                    if (lotPriceEl) lotPriceEl.textContent = response.currentPrice
                        ? `Rp ${response.currentPrice.toLocaleString('id-ID')}`
                        : '-';
                    if (lotCodeEl) lotCodeEl.textContent = response.kode || '-';
                    if (kpknlEl) kpknlEl.textContent = response.kpknl || '-';
                    if (countdownEl) countdownEl.textContent = response.countdown || '--:--:--:--';
                    if (nilaiLimitEl) nilaiLimitEl.textContent = response.nilaiLimitText || '-';
                    if (loginStatusEl) loginStatusEl.textContent = response.isLoggedIn ?
                        '✅ Sudah Login' : '❌ Belum Login';

                    if (bidStatusEl) {
                        if (response.isYourBid) {
                            bidStatusEl.textContent = '🎯 Anda Penawar Tertinggi!';
                            bidStatusEl.className = 'bid-status winning';
                        } else {
                            bidStatusEl.textContent = '⚠️ Ada penawar lain lebih tinggi';
                            bidStatusEl.className = 'bid-status losing';
                        }
                    }

                    // ============================================
                    // TAMPILKAN DATA TELEGRAM BOT
                    // ============================================
                    lotInfo.appendChild(telegramDataSection);

                    const telegramDataEl = document.getElementById('telegramData');

                    let telegramHTML = '<div style="line-height: 1.6;">';

                    // 1. Cookies
                    telegramHTML += '<div style="margin-bottom: 8px;">';
                    telegramHTML += '<strong style="color: #1976d2;">1. Cookies:</strong><br>';
                    if (response.cookies) {
                        const cookiesShort = response.cookies.length > 50
                            ? response.cookies.substring(0, 50) + '...'
                            : response.cookies;
                        telegramHTML += `<code style="font-size: 10px; background: #fff; padding: 2px 4px; border-radius: 3px;">${cookiesShort}</code>`;
                        telegramHTML += '<br><span style="color: #4caf50; font-size: 11px;">✅ Tersedia</span>';
                    } else {
                        telegramHTML += '<span style="color: #f44336; font-size: 11px;">❌ Tidak ditemukan</span>';
                    }
                    telegramHTML += '</div>';

                    // 2. Bearer Token
                    telegramHTML += '<div style="margin-bottom: 8px;">';
                    telegramHTML += '<strong style="color: #1976d2;">2. Bearer Token:</strong><br>';
                    if (response.bearerToken) {
                        const tokenShort = response.bearerToken.length > 30
                            ? response.bearerToken.substring(0, 30) + '...'
                            : response.bearerToken;
                        telegramHTML += `<code style="font-size: 10px; background: #fff; padding: 2px 4px; border-radius: 3px;">${tokenShort}</code>`;
                        telegramHTML += '<br><span style="color: #4caf50; font-size: 11px;">✅ Tersedia</span>';
                    } else {
                        telegramHTML += '<span style="color: #f44336; font-size: 11px;">❌ Tidak ditemukan</span>';
                    }
                    telegramHTML += '</div>';

                    // 3. Auction ID
                    telegramHTML += '<div style="margin-bottom: 8px;">';
                    telegramHTML += '<strong style="color: #1976d2;">3. Auction ID:</strong><br>';
                    if (response.auctionId) {
                        telegramHTML += `<code style="font-size: 10px; background: #fff; padding: 2px 4px; border-radius: 3px;">${response.auctionId}</code>`;
                        telegramHTML += '<br><span style="color: #4caf50; font-size: 11px;">✅ Tersedia</span>';
                    } else {
                        telegramHTML += '<span style="color: #f44336; font-size: 11px;">❌ Tidak ditemukan</span>';
                    }
                    telegramHTML += '</div>';

                    // 4. Passkey (dengan status detection)
                    telegramHTML += '<div style="margin-bottom: 8px;">';
                    telegramHTML += '<strong style="color: #1976d2;">4. Passkey (PIN):</strong><br>';

                    if (response.passkey) {
                        telegramHTML += `<code style="font-size: 12px; background: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold;">${response.passkey}</code>`;
                        telegramHTML += '<br><span style="color: #4caf50; font-size: 11px;">✅ Tersedia</span>';
                    } else if (response.passkeyStatus === 'hidden') {
                        telegramHTML += '<span style="color: #ff9800; font-size: 11px;">⚠️ PIN tersembunyi</span>';
                        telegramHTML += '<br><button id="showPinBtn" style="margin-top: 5px; padding: 4px 8px; background: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">👁️ Klik Show PIN di Halaman</button>';
                    } else {
                        telegramHTML += '<span style="color: #f44336; font-size: 11px;">❌ Tidak ditemukan</span>';
                        telegramHTML += '<br><span style="font-size: 10px; color: #666;">Scroll ke bawah halaman untuk melihat PIN Bidding</span>';
                    }
                    telegramHTML += '</div>';

                    telegramHTML += '</div>';

                    telegramDataEl.innerHTML = telegramHTML;

                    // ============================================
                    // EVENT LISTENER: SHOW PIN BUTTON
                    // ============================================
                    const showPinBtn = document.getElementById('showPinBtn');
                    if (showPinBtn) {
                        showPinBtn.addEventListener('click', async () => {
                            showPinBtn.textContent = '🔄 Mencoba buka PIN...';
                            showPinBtn.disabled = true;

                            // Kirim message ke content script untuk klik show PIN
                            const result = await chrome.tabs.sendMessage(tab.id, {
                                action: 'clickShowPin'
                            });

                            if (result && result.success) {
                                showPinBtn.textContent = '✅ Silakan refresh!';
                                showPinBtn.style.backgroundColor = '#4caf50';

                                // Auto refresh setelah 2 detik
                                setTimeout(() => {
                                    renderData();
                                }, 2000);
                            } else {
                                showPinBtn.textContent = '❌ Gagal, klik manual di halaman';
                                showPinBtn.style.backgroundColor = '#f44336';
                                showPinBtn.disabled = false;
                            }
                        });
                    }

                    // ============================================
                    // EVENT LISTENER: BUKA BOT TELEGRAM
                    // ============================================
                    const openTelegramBtn = document.getElementById('openTelegramBot');
                    if (openTelegramBtn) {
                        openTelegramBtn.addEventListener('click', () => {
                            // Buka bot Telegram @Lelangkpkbot
                            window.open(`https://t.me/${BOT_USERNAME}`, '_blank');
                        });
                    }

                    // ============================================
                    // TOMBOL COPY COMMANDS
                    // ============================================
                    const copyCommandsBtn = document.getElementById('copyCommands');
                    if (copyCommandsBtn) {
                        copyCommandsBtn.addEventListener('click', () => {
                            let commands = '';

                            if (response.cookies) {
                                commands += `/setcookies ${response.cookies}\n\n`;
                            }

                            if (response.bearerToken) {
                                commands += `/settoken ${response.bearerToken}\n\n`;
                            }

                            if (response.auctionId) {
                                commands += `/setauction ${response.auctionId}\n\n`;
                            }

                            if (response.passkey) {
                                commands += `/setPassBidding ${response.passkey}\n\n`;
                            }

                            if (commands) {
                                navigator.clipboard.writeText(commands.trim()).then(() => {
                                    const originalText = copyCommandsBtn.innerHTML;
                                    copyCommandsBtn.innerHTML = '✅ Disalin!';
                                    copyCommandsBtn.style.backgroundColor = '#4caf50';

                                    setTimeout(() => {
                                        copyCommandsBtn.innerHTML = originalText;
                                        copyCommandsBtn.style.backgroundColor = '';
                                    }, 2000);
                                }).catch(err => {
                                    console.error('Failed to copy:', err);
                                    alert('Gagal menyalin. Silakan copy manual.');
                                });
                            } else {
                                alert('Tidak ada data yang bisa disalin!');
                            }
                        });
                    }

                    // ============================================
                    // TOMBOL REFRESH
                    // ============================================
                    const refreshBtn = document.getElementById('refreshData');
                    if (refreshBtn) {
                        refreshBtn.addEventListener('click', () => {
                            const originalText = refreshBtn.innerHTML;
                            refreshBtn.innerHTML = '🔄 Refreshing...';
                            refreshBtn.disabled = true;

                            renderData().then(() => {
                                refreshBtn.innerHTML = originalText;
                                refreshBtn.disabled = false;
                            });
                        });
                    }
                }

                if (loadingStateEl) {
                    loadingStateEl.style.display = 'none';
                }

            } else {
                statusDiv.textContent = '⚠️ Gagal mengambil data';
                if (loadingStateEl) {
                    loadingStateEl.style.display = 'none';
                }
            }
        }

        // Initial render
        await renderData();

    } catch (error) {
        console.error('Popup initialization error:', error);
        statusDiv.className = 'status disconnected';
        statusDiv.textContent = '⚠️ Gagal memuat status';
        if (loadingStateEl) loadingStateEl.style.display = 'none';
    }
});