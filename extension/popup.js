// ============================================
// popup.js - FINAL VERSION WITH LOGOUT DETECTION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    const statusDiv = document.getElementById('status');
    const lotInfo = document.getElementById('lotInfo');
    const lotTitleEl = document.getElementById('lotTitle');
    const lotPriceEl = document.getElementById('lotPrice');
    const loginStatusEl = document.getElementById('loginStatus');
    const lotCodeEl = document.getElementById('lotCode');
    const kpknlEl = document.getElementById('kpknl');
    const countdownEl = document.getElementById('countdown');
    const nilaiLimitEl = document.getElementById('nilaiLimit');
    const bidStatusEl = document.getElementById('bidStatus');
    const loadingStateEl = document.getElementById('loadingState');

    // ===== VARIABEL GLOBAL =====
    let countdownInterval = null;
    let targetEndTime = null;
    let loginCheckInterval = null;
    let lastLoginStatus = null;

    // ===== FUNGSI HELPER =====
    async function ensureContentScript(tabId) {
        if (!chrome.scripting) return;
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content.js']
            });
        } catch (error) {
            console.error('Failed to inject content script:', error);
        }
    }

    function sendMessageWithRetry(tabId, payload, retries = 1) {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, payload, async (response) => {
                if (chrome.runtime.lastError) {
                    const message = chrome.runtime.lastError.message || 'Unknown error';
                    console.warn('sendMessage error:', message);

                    if (retries > 0) {
                        await ensureContentScript(tabId);
                        setTimeout(() => {
                            sendMessageWithRetry(tabId, payload, retries - 1).then(resolve);
                        }, 200);
                        return;
                    }
                    resolve({ error: message });
                    return;
                }
                resolve(response);
            });
        });
    }

    function getCookie(url, name) {
        return new Promise((resolve) => {
            chrome.cookies.get({ url, name }, (cookie) => {
                resolve(cookie || null);
            });
        });
    }

    function parseSessionCookie(value) {
        if (!value) return null;
        try {
            const decoded = decodeURIComponent(value);
            if (decoded.startsWith('{') || decoded.startsWith('[')) {
                return JSON.parse(decoded);
            }
            return { raw: value };
        } catch (err) {
            return { raw: value };
        }
    }

    function resolveLoginStatus(sessionData) {
        if (!sessionData) return null;

        if (typeof sessionData === 'object') {
            if (sessionData.isLoggedIn !== undefined) {
                return Boolean(sessionData.isLoggedIn);
            }
            if (sessionData.statusLogin !== undefined) {
                return sessionData.statusLogin === true ||
                    sessionData.statusLogin === 'true' ||
                    sessionData.statusLogin === '1' ||
                    sessionData.statusLogin === 1 ||
                    sessionData.statusLogin === 'LOGIN';
            }
            if (sessionData.status !== undefined) {
                return ['login', 'loggedin', 'active', 'true', '1', 'LOGIN']
                    .includes(String(sessionData.status).toLowerCase());
            }
        }

        if (typeof sessionData === 'string') {
            const normalized = sessionData.toLowerCase();
            if (['login', 'loggedin', 'true', '1', 'active'].includes(normalized)) {
                return true;
            }
            return sessionData.length > 0;
        }

        if (sessionData.raw) {
            const raw = sessionData.raw.toLowerCase();
            if (['login', 'loggedin', 'true', '1', 'active'].includes(raw)) {
                return true;
            }
            return sessionData.raw.length > 0;
        }

        return null;
    }

    async function getSessionInfo() {
        const domainUrls = ['https://lelang.go.id/', 'https://www.lelang.go.id/'];
        const cookieNames = ['cookiesSession', 'cookiesSession1', 'cookiesession1'];

        for (const url of domainUrls) {
            for (const name of cookieNames) {
                const cookie = await getCookie(url, name);
                if (cookie && cookie.value) {
                    const data = parseSessionCookie(cookie.value);
                    return { data, url, name };
                }
            }
        }
        return null;
    }

    async function updateStatusFromSession() {
        const session = await getSessionInfo();
        if (!session) {
            return null;
        }

        const isLoggedIn = resolveLoginStatus(session.data);
        let statusText = 'Terhubung';

        if (session.data && typeof session.data === 'object') {
            if (session.data.nama || session.data.username) {
                statusText += ` sebagai ${session.data.nama || session.data.username}`;
            }
            if (session.data.statusMessage) {
                statusText += ` ${session.data.statusMessage}`;
            }
        }

        statusDiv.className = `status ${isLoggedIn ? 'connected' : 'disconnected'}`;

        if (session.data && session.data.raw && session.data.raw.length > 8) {
            const masked = `${session.data.raw.slice(0, 4)}…${session.data.raw.slice(-4)}`;
            statusText += ` (ID ${masked})`;
        }

        statusDiv.textContent = isLoggedIn ? statusText : '⚠️ Belum Login (cookieSession tidak valid)';
        loginStatusEl.textContent = isLoggedIn ? 'Sudah Login (via cookie)' : 'Belum Login';

        return Boolean(isLoggedIn);
    }

    // ===== FUNGSI LOGOUT DETECTION (BARU!) =====
    async function checkLoginStatus() {
        try {
            const session = await getSessionInfo();
            const cookieLogin = session ? resolveLoginStatus(session.data) : false;

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url || !tab.url.includes('lelang.go.id/')) {
                return null;
            }

            const response = await sendMessageWithRetry(tab.id, { action: 'getLotData' }, 1);
            const pageLogin = response && !response.error ? Boolean(response.isLoggedIn) : false;

            const currentLoginStatus = cookieLogin || pageLogin;

            // 🚨 DETEKSI LOGOUT
            if (lastLoginStatus === true && currentLoginStatus === false) {
                handleLogout();
            }

            lastLoginStatus = currentLoginStatus;
            return currentLoginStatus;

        } catch (error) {
            console.error('Error checking login status:', error);
            return null;
        }
    }

    function handleLogout() {
        console.log('🚨 User logged out detected!');

        // Update UI jadi merah
        statusDiv.className = 'status disconnected';
        statusDiv.textContent = '🚨 Anda Telah Logout!';
        loginStatusEl.textContent = '❌ Sesi Berakhir';

        // Sembunyikan data lelang
        if (lotInfo) {
            lotInfo.style.display = 'none';
        }

        // Tampilkan loading dengan pesan logout
        if (loadingStateEl) {
            loadingStateEl.style.display = 'block';
            loadingStateEl.innerHTML = '<p style="color: #dc3545; font-weight: bold;">🚨 Sesi berakhir!<br>Silakan login kembali.</p>';
        }

        // Kirim notifikasi desktop
        if (chrome.notifications) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: '🚨 Logout Terdeteksi',
                message: 'Sesi Anda telah berakhir. Silakan login kembali di lelang.go.id',
                priority: 2
            });
        }

        // Stop countdown timer
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        // Stop login monitoring
        if (loginCheckInterval) {
            clearInterval(loginCheckInterval);
        }

        // Hapus data dari storage
        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.remove(['latestLotData']);
        }
    }

    function startLoginMonitoring() {
        // Cek login status setiap 10 detik
        loginCheckInterval = setInterval(async () => {
            await checkLoginStatus();
        }, 10000); // 10 detik
    }

    // ===== FUNGSI COUNTDOWN TIMER =====
    function parseCountdown(countdownText) {
        if (!countdownText) return null;

        const parts = countdownText.split(':').map(p => parseInt(p.replace(/\D/g, '')) || 0);
        if (parts.length !== 4) return null;

        const [days, hours, minutes, seconds] = parts;

        const now = new Date();
        const targetTime = new Date(now.getTime() +
            (days * 24 * 60 * 60 * 1000) +
            (hours * 60 * 60 * 1000) +
            (minutes * 60 * 1000) +
            (seconds * 1000)
        );

        return targetTime;
    }

    function startCountdown(initialCountdown) {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        targetEndTime = parseCountdown(initialCountdown);
        if (!targetEndTime || !countdownEl) return;

        countdownInterval = setInterval(() => {
            const now = new Date();
            const diff = targetEndTime - now;

            if (diff <= 0) {
                countdownEl.textContent = '00:00:00:00';
                countdownEl.style.background = '#dc3545';
                clearInterval(countdownInterval);
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            const formatted =
                String(days).padStart(2, '0') + ':' +
                String(hours).padStart(2, '0') + ':' +
                String(minutes).padStart(2, '0') + ':' +
                String(seconds).padStart(2, '0');

            countdownEl.textContent = formatted;

            // Ubah warna jika < 10 menit
            if (days === 0 && hours === 0 && minutes < 10) {
                countdownEl.style.background = '#ffc107';
            }
        }, 1000);
    }

    // ===== FUNGSI UPDATE DISPLAY =====
    function updateLotDisplay(response) {
        if (loadingStateEl) {
            loadingStateEl.style.display = 'none';
        }

        lotInfo.style.display = 'block';

        lotTitleEl.textContent = response.title || 'Tidak diketahui';
        lotPriceEl.textContent = response.currentPrice
            ? `Rp ${response.currentPrice.toLocaleString('id-ID')}`
            : '-';

        if (lotCodeEl) {
            lotCodeEl.textContent = response.kode || '-';
        }

        if (kpknlEl) {
            kpknlEl.textContent = response.kpknl || '-';
        }

        if (countdownEl && response.countdown) {
            countdownEl.textContent = response.countdown;
            startCountdown(response.countdown);
        }

        if (nilaiLimitEl) {
            nilaiLimitEl.textContent = response.nilaiLimitText ||
                (response.nilaiLimit ? `Rp ${response.nilaiLimit.toLocaleString('id-ID')}` : '-');
        }

        if (bidStatusEl) {
            if (response.isYourBid) {
                bidStatusEl.textContent = '🎯 Anda Penawar Tertinggi!';
                bidStatusEl.className = 'bid-status winning';
            } else {
                bidStatusEl.textContent = '⚠️ Ada penawar lain lebih tinggi';
                bidStatusEl.className = 'bid-status losing';
            }
        }

        console.log('Lot Data:', response);

        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({
                latestLotData: response,
                lastUpdate: new Date().toISOString()
            });
        }
    }

    // ===== INISIALISASI =====
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

        const cookieLogin = await updateStatusFromSession();
        const response = await sendMessageWithRetry(tab.id, { action: 'getLotData' }, 2);

        if (response && !response.error) {
            updateLotDisplay(response);

            if (cookieLogin === null) {
                const isLoggedIn = Boolean(response.isLoggedIn);
                statusDiv.className = `status ${isLoggedIn ? 'connected' : 'disconnected'}`;

                if (isLoggedIn && response.userName) {
                    statusDiv.textContent = `✅ Terhubung sebagai ${response.userName}`;
                } else if (isLoggedIn) {
                    statusDiv.textContent = '✅ Terhubung & Login';
                } else {
                    statusDiv.textContent = '⚠️ Belum Login';
                }

                loginStatusEl.textContent = isLoggedIn ? '✅ Sudah Login' : '❌ Belum Login';
                lastLoginStatus = isLoggedIn;
            } else {
                lastLoginStatus = cookieLogin;
            }

            // 🚀 MULAI MONITORING LOGOUT
            startLoginMonitoring();

        } else if (response && response.error) {
            console.error('Failed to get lot data:', response.error);
            if (loadingStateEl) loadingStateEl.style.display = 'none';

            if (cookieLogin === null) {
                statusDiv.className = 'status disconnected';
                statusDiv.textContent = `⚠️ Tidak dapat membaca status (${response.error})`;
            }
        } else {
            if (loadingStateEl) loadingStateEl.style.display = 'none';

            if (cookieLogin === null) {
                lotInfo.style.display = 'block';
                lotTitleEl.textContent = 'Tidak diketahui';
                lotPriceEl.textContent = '-';
                statusDiv.className = 'status disconnected';
                statusDiv.textContent = '⚠️ Tidak dapat membaca status dari halaman';
            }
        }
    } catch (error) {
        console.error('Popup initialization error:', error);
        statusDiv.className = 'status disconnected';
        statusDiv.textContent = '⚠️ Gagal memuat status';
        if (loadingStateEl) loadingStateEl.style.display = 'none';
    }

    // ===== EVENT LISTENERS =====
    const testBidBtn = document.getElementById('testBid');
    if (testBidBtn) {
        testBidBtn.addEventListener('click', async () => {
            if (chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['latestLotData'], (result) => {
                    if (result.latestLotData) {
                        console.log('Data untuk bot Telegram:', result.latestLotData);
                        alert(`Extension aktif!\n\nLot: ${result.latestLotData.kode}\nHarga: Rp ${result.latestLotData.currentPrice?.toLocaleString('id-ID') || '-'}\n\nSekarang buka bot Telegram untuk bid.`);
                    } else {
                        alert('Extension aktif! Sekarang buka bot Telegram untuk bid.');
                    }
                });
            } else {
                alert('Extension aktif! Sekarang buka bot Telegram untuk bid.');
            }
        });
    }

    // ===== CLEANUP =====
    window.addEventListener('unload', () => {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        if (loginCheckInterval) {
            clearInterval(loginCheckInterval);
        }
    });
});