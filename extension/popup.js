// ============================================
// popup.js - READY TO USE VERSION
// Bot Username: @Lelangkpkbot
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    const statusDiv = document.getElementById('status');
    const lotInfo = document.getElementById('lotInfo');
    const loadingStateEl = document.getElementById('loadingState');

    // Bot Telegram Username (sudah di-set)
    const BOT_USERNAME = 'Lelangkpk1bot';

    // ============================================
    // FUNGSI: AMBIL COOKIES MENGGUNAKAN CHROME API
    // ============================================
    async function getCookiesFromChromeAPI() {
        try {
            const cookies = await chrome.cookies.getAll({ 
                domain: 'lelang.go.id' 
            });
            
            // Format cookies menjadi string seperti Cookie header
            const cookieString = cookies
                .map(cookie => `${cookie.name}=${cookie.value}`)
                .join('; ');
            
            return cookieString;
        } catch (error) {
            console.error('Error getting cookies from Chrome API:', error);
            return null;
        }
    }

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
        <div style="display: flex; gap: 6px; margin-top: 10px; align-items: center;">
            <input id="chatIdInput" type="text" placeholder="Telegram Chat ID kamu" style="flex:1; padding:6px 8px; font-size:12px; border:1px solid #90caf9; border-radius:6px; outline:none;" />
            <button id="sendToServer" class="button button-primary" style="font-size:12px; background:#1565c0; white-space:nowrap; padding:6px 10px;">
                🚀 Kirim ke Bot
            </button>
        </div>
        <div id="sendStatus" style="font-size:11px; margin-top:4px; min-height:16px; color:#555;"></div>
        <div style="display: flex; gap: 8px; margin-top: 6px; flex-direction: column;">
            <div style="display: flex; gap: 8px;">
                <button id="copyCommands" class="button button-primary" style="flex: 1; font-size: 12px;">
                    📋 Salin Command
                </button>
                <button id="refreshData" class="button button-primary" style="flex: 1; font-size: 12px; background: #4caf50;">
                    🔄 Refresh
                </button>
            </div>
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
        // Inject content script jika belum ada (MV3: tab yang sudah terbuka sebelum install)
        async function ensureContentScript() {
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
            } catch (_) {
                // Content script belum inject, inject sekarang
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
                // Tunggu sebentar biar content script siap
                await new Promise(r => setTimeout(r, 500));
            }
        }

        async function renderData() {
            // Pastikan content script sudah inject sebelum kirim pesan
            await ensureContentScript();
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

                    // 1. Cookies (ambil dari Chrome API)
                    telegramHTML += '<div style="margin-bottom: 8px;">';
                    telegramHTML += '<strong style="color: #1976d2;">1. Cookies:</strong><br>';
                    
                    // Prioritas: Ambil dari Chrome Cookies API
                    const cookiesFromAPI = await getCookiesFromChromeAPI();
                    const cookiesToDisplay = cookiesFromAPI || response.cookies;
                    
                    if (cookiesToDisplay) {
                        telegramHTML += `<code style="font-size: 9px; background: #fff; padding: 4px; border-radius: 3px; display: block; word-break: break-all; max-height: 60px; overflow-y: auto;">${cookiesToDisplay}</code>`;
                        telegramHTML += `<span style="color: #4caf50; font-size: 11px;">✅ Tersedia (${cookiesToDisplay.length} chars)${cookiesFromAPI ? ' 🍪 via Chrome API' : ''}</span>`;
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

                    // 4. Passkey (tampilkan langsung tanpa hide)
                    telegramHTML += '<div style="margin-bottom: 8px;">';
                    telegramHTML += '<strong style="color: #1976d2;">4. Passkey (PIN):</strong><br>';

                    if (response.passkey) {
                        telegramHTML += `<code style="font-size: 14px; background: #fff; padding: 4px 8px; border-radius: 3px; font-weight: bold; color: #1976d2;">${response.passkey}</code>`;
                        telegramHTML += '<br><span style="color: #4caf50; font-size: 11px;">✅ Tersedia</span>';
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
                        copyCommandsBtn.addEventListener('click', async () => {
                            let commands = '';

                            // Ambil cookies dari Chrome API atau fallback ke response.cookies
                            const cookiesFromAPI = await getCookiesFromChromeAPI();
                            const cookiesToUse = cookiesFromAPI || response.cookies;

                            if (cookiesToUse) {
                                commands += `/setcookies ${cookiesToUse}\n\n`;
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
                    // TOMBOL KIRIM KE SERVER (no Telegram formatting dialog)
                    // ============================================
                    const sendToServerBtn = document.getElementById('sendToServer');
                    const chatIdInput = document.getElementById('chatIdInput');
                    const sendStatus = document.getElementById('sendStatus');

                    // Load saved chatId
                    chrome.storage.local.get(['telegramChatId'], (saved) => {
                        if (saved.telegramChatId) chatIdInput.value = saved.telegramChatId;
                    });

                    if (sendToServerBtn) {
                        sendToServerBtn.addEventListener('click', async () => {
                            const chatId = chatIdInput.value.trim();
                            if (!chatId) {
                                sendStatus.textContent = '? Masukkan Chat ID dulu';
                                sendStatus.style.color = 'red';
                                return;
                            }

                            // Simpan chatId ke storage
                            chrome.storage.local.set({ telegramChatId: chatId });

                            const cookiesFromAPI = await getCookiesFromChromeAPI();
                            const cookiesToUse = cookiesFromAPI || response.cookies;

                            sendToServerBtn.disabled = true;
                            sendStatus.textContent = '? Mengirim...';
                            sendStatus.style.color = '#555';

                            try {
                                const res = await fetch('http://localhost:3000/api/set-session', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        chatId,
                                        cookies:     cookiesToUse || undefined,
                                        bearerToken: response.bearerToken || undefined,
                                        auctionId:   response.auctionId || undefined,
                                        passkey:     response.passkey || undefined,
                                    })
                                });
                                const json = await res.json();
                                if (json.success) {
                                    sendStatus.textContent = '? Terkirim! Cek Telegram.';
                                    sendStatus.style.color = 'green';
                                } else {
                                    sendStatus.textContent = '? ' + (json.error || 'Gagal');
                                    sendStatus.style.color = 'red';
                                }
                            } catch (err) {
                                sendStatus.textContent = '? Server tidak aktif?';
                                sendStatus.style.color = 'red';
                            } finally {
                                sendToServerBtn.disabled = false;
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