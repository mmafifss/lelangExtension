// ============================================
// DEBUG SCRIPT - Detail Investigation
// ============================================

require('dotenv').config({ path: './config.env' });

async function debugAuctionStatusAPI(auctionId, cookies, bearerToken) {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   DEBUG: Auction Status API            ║');
    console.log('╚════════════════════════════════════════╝\n');

    const endpoints = [
        {
            name: 'Endpoint 1 (with dcp=true)',
            url: `https://api.lelang.go.id/api/v1/pelaksanaan/${auctionId}/status-lelang?dcp=true`
        },
        {
            name: 'Endpoint 2 (without dcp)',
            url: `https://api.lelang.go.id/api/v1/pelaksanaan/${auctionId}/status-lelang`
        },
        {
            name: 'Endpoint 3 (detail lot)',
            url: `https://api.lelang.go.id/api/v1/pelaksanaan/${auctionId}`
        }
    ];

    for (const endpoint of endpoints) {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`Testing: ${endpoint.name}`);
        console.log(`URL: ${endpoint.url}`);
        console.log('='.repeat(50));

        try {
            // Test dengan berbagai kombinasi headers
            const headerVariants = [
                {
                    name: 'With Auth + Cookie',
                    headers: {
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Authorization': `Bearer ${bearerToken}`,
                        'Cookie': cookies,
                        'Origin': 'https://lelang.go.id',
                        'Referer': 'https://lelang.go.id/',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    }
                },
                {
                    name: 'Auth only (no cookie)',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${bearerToken}`,
                        'Origin': 'https://lelang.go.id'
                    }
                },
                {
                    name: 'Cookie only (no auth)',
                    headers: {
                        'Accept': 'application/json',
                        'Cookie': cookies,
                        'Origin': 'https://lelang.go.id'
                    }
                }
            ];

            for (const variant of headerVariants) {
                console.log(`\n  → Trying: ${variant.name}`);

                const response = await fetch(endpoint.url, {
                    method: 'GET',
                    headers: variant.headers
                });

                console.log(`     Status: ${response.status} ${response.statusText}`);

                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    console.log(`     Content-Type: ${contentType}`);

                    const text = await response.text();
                    console.log(`     Response Length: ${text.length} chars`);

                    try {
                        const data = JSON.parse(text);
                        console.log(`     ✅ Valid JSON`);
                        console.log(`\n     📦 Response Structure:`);
                        console.log(JSON.stringify(data, null, 2).substring(0, 500) + '...');

                        // Analyze structure
                        console.log(`\n     🔍 Structure Analysis:`);
                        console.log(`     • Top-level keys: ${Object.keys(data).join(', ')}`);

                        if (data.data) {
                            console.log(`     • data exists: YES`);
                            console.log(`     • data type: ${typeof data.data}`);

                            if (typeof data.data === 'object') {
                                console.log(`     • data keys: ${Object.keys(data.data).join(', ')}`);

                                if (data.data.data) {
                                    console.log(`     • data.data exists: YES`);
                                    console.log(`     • data.data type: ${typeof data.data.data}`);

                                    if (typeof data.data.data === 'object') {
                                        console.log(`     • data.data.data keys: ${Object.keys(data.data.data).join(', ')}`);
                                    }
                                }
                            }
                        }

                        console.log(`\n     ✅ THIS VARIANT WORKS!`);

                        return {
                            success: true,
                            endpoint: endpoint.url,
                            headers: variant.name,
                            data: data
                        };

                    } catch (e) {
                        console.log(`     ❌ Invalid JSON: ${e.message}`);
                        console.log(`     Raw response: ${text.substring(0, 200)}...`);
                    }
                } else {
                    const errorText = await response.text();
                    console.log(`     ❌ Error response: ${errorText.substring(0, 200)}`);
                }
            }

        } catch (error) {
            console.log(`\n  ❌ Request Failed: ${error.message}`);
        }
    }

    return { success: false };
}

async function debugBidHistoryComparison(auctionId, cookies, bearerToken) {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   DEBUG: Bid History Detailed          ║');
    console.log('╚════════════════════════════════════════╝\n');

    const url = `https://bidding.lelang.go.id/api/v1/pelaksanaan/lelang/${auctionId}/riwayat`;

    try {
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Authorization': `Bearer ${bearerToken}`,
            'Cookie': cookies,
            'Origin': 'https://lelang.go.id',
            'Referer': 'https://lelang.go.id/',
        };

        const response = await fetch(url, { headers, method: "GET" });

        if (response.ok) {
            const data = await response.json();

            console.log('✅ Bid History Retrieved\n');

            let riwayat = data.data;
            if (riwayat && riwayat.data && Array.isArray(riwayat.data)) {
                riwayat = riwayat.data;
            }

            if (Array.isArray(riwayat) && riwayat.length > 0) {
                console.log(`📊 Total Bids: ${riwayat.length}\n`);

                // Show top 3 bids
                console.log('Top 3 Bids:');
                console.log('='.repeat(70));

                for (let i = 0; i < Math.min(3, riwayat.length); i++) {
                    const bid = riwayat[i];
                    console.log(`\nBid #${i + 1}:`);
                    console.log(JSON.stringify(bid, null, 2));

                    // Check important fields
                    console.log('\n🔑 Field Check:');
                    const importantFields = [
                        'bidAmount', 'amount', 'nominal', 'harga',
                        'bidderName', 'participantName', 'namaPeserta', 'penawar',
                        'bidTime', 'createdAt', 'timestamp', 'waktu',
                        'isWinning', 'status', 'position'
                    ];

                    importantFields.forEach(field => {
                        if (bid[field] !== undefined) {
                            console.log(`   ✅ ${field}: ${bid[field]}`);
                        }
                    });
                }

                // Analyze field names
                console.log('\n\n📋 All Unique Field Names Across All Bids:');
                const allFields = new Set();
                riwayat.forEach(bid => {
                    Object.keys(bid).forEach(key => allFields.add(key));
                });
                console.log(Array.from(allFields).sort().join(', '));

                // Check if we can identify current user's bid
                console.log('\n\n👤 User Identification Check:');
                const uniqueBidders = new Set(
                    riwayat.map(b =>
                        b.bidderName || b.participantName || b.namaPeserta || 'Unknown'
                    )
                );
                console.log(`Unique bidders: ${Array.from(uniqueBidders).join(', ')}`);

                return { success: true, data: riwayat };
            }
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    return { success: false };
}

async function suggestFixes(statusResult, historyResult) {
    console.log('\n\n╔════════════════════════════════════════╗');
    console.log('║       SUGGESTED CODE FIXES             ║');
    console.log('╚════════════════════════════════════════╝\n');

    if (!statusResult.success) {
        console.log('❌ AUCTION STATUS API FIX:\n');
        console.log('Problem: Cannot get auction status');
        console.log('\nSuggested Solutions:');
        console.log('1. Try different endpoint in fetchAuctionStatus():');
        console.log('   Replace:');
        console.log('   const url = `https://api.lelang.go.id/api/v1/pelaksanaan/${auctionId}/status-lelang?dcp=true`;');
        console.log('   With:');
        console.log('   const url = `https://api.lelang.go.id/api/v1/pelaksanaan/${auctionId}`;');
        console.log('\n2. Update headers - try simpler headers');
        console.log('\n3. Check if bearer token is still valid');
        console.log('\n4. Alternative: Use bid history API only (no need status API)\n');
        console.log('='.repeat(60));
    }

    if (historyResult.success && historyResult.data) {
        console.log('\n✅ BID HISTORY WORKS - Here\'s the correct code:\n');

        const bid = historyResult.data[0];

        // Detect field names
        const amountField = bid.bidAmount ? 'bidAmount' :
            bid.amount ? 'amount' :
                bid.nominal ? 'nominal' : 'UNKNOWN';

        const bidderField = bid.bidderName ? 'bidderName' :
            bid.participantName ? 'participantName' :
                bid.namaPeserta ? 'namaPeserta' : 'UNKNOWN';

        const timeField = bid.bidTime ? 'bidTime' :
            bid.createdAt ? 'createdAt' :
                bid.timestamp ? 'timestamp' : 'UNKNOWN';

        console.log('Replace monitoring code with:');
        console.log('```javascript');
        console.log(`// Correct field names for your API:`);
        console.log(`const currentPrice = parseInt(latestBid.${amountField});`);
        console.log(`const currentBidder = latestBid.${bidderField} || 'Unknown';`);
        console.log(`const bidTime = latestBid.${timeField};`);
        console.log('```\n');

        // Generate complete fixed monitoring function
        console.log('\n📝 COMPLETE FIXED MONITORING FUNCTION:\n');
        console.log('```javascript');
        console.log(`async function startMonitoring(chatId) {
    const session = userSessions.get(chatId);
    if (!session || !session.auctionId) {
        bot.sendMessage(chatId, '❌ Auction ID belum di-set!');
        return;
    }
    if (activeMonitoring.has(chatId)) {
        bot.sendMessage(chatId, '⚠️ Monitoring sudah aktif!');
        return;
    }

    let lastPrice = null;
    let consecutiveErrors = 0;

    const monitorInterval = setInterval(async () => {
        try {
            const historyResult = await fetchBidHistory(
                session.auctionId,
                session.cookies,
                session.bearerToken
            );

            if (historyResult.success && historyResult.data && historyResult.data.data) {
                let riwayat = historyResult.data.data;
                if (riwayat.data && Array.isArray(riwayat.data)) {
                    riwayat = riwayat.data;
                }

                if (Array.isArray(riwayat) && riwayat.length > 0) {
                    const latestBid = riwayat[0];
                    
                    // ✅ USE CORRECT FIELD NAMES FROM YOUR API:
                    const currentPrice = parseInt(latestBid.${amountField});
                    const currentBidder = latestBid.${bidderField} || 'Unknown';
                    const bidTime = latestBid.${timeField} ? 
                        new Date(latestBid.${timeField}).toLocaleString('id-ID') : 'N/A';

                    if (currentPrice !== lastPrice) {
                        if (lastPrice !== null) {
                            const priceDiff = currentPrice - lastPrice;
                            bot.sendMessage(chatId,
                                \`🚨 *Penawaran Baru!*\\n\\n\` +
                                \`Harga: Rp \${currentPrice.toLocaleString('id-ID')}\\n\` +
                                \`Naik: Rp \${priceDiff.toLocaleString('id-ID')}\\n\` +
                                \`Penawar: \${currentBidder}\\n\` +
                                \`Waktu: \${bidTime}\`,
                                { 
                                    parse_mode: 'Markdown',
                                    reply_markup: {
                                        inline_keyboard: [[
                                            { text: "💰 Bid Kelipatan", callback_data: "bid_kelipatan" }
                                        ]]
                                    }
                                }
                            );
                        } else {
                            bot.sendMessage(chatId,
                                \`📊 *Monitoring Dimulai*\\n\\n\` +
                                \`Harga Saat Ini: Rp \${currentPrice.toLocaleString('id-ID')}\\n\` +
                                \`Penawar: \${currentBidder}\`,
                                { parse_mode: 'Markdown' }
                            );
                        }
                        lastPrice = currentPrice;
                    }

                    consecutiveErrors = 0;
                }
            }
        } catch (error) {
            console.error('Monitoring error:', error);
            consecutiveErrors++;
            
            if (consecutiveErrors >= 5) {
                bot.sendMessage(chatId, '❌ Monitoring error - dihentikan');
                stopMonitoring(chatId);
            }
        }
    }, 3000); // 3 seconds

    activeMonitoring.set(chatId, {
        auctionId: session.auctionId,
        interval: monitorInterval
    });

    bot.sendMessage(chatId, '✅ Monitoring aktif! (3 detik interval)', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: "🛑 Stop", callback_data: "stop_monitor" }
            ]]
        }
    });
}`);
        console.log('```\n');
    }

    console.log('\n💡 RECOMMENDATION:');
    console.log('Since Bid History works but Auction Status fails,');
    console.log('you can IGNORE Auction Status API and only use Bid History!');
    console.log('The monitoring will still work perfectly.\n');
}

async function main() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║    DETAILED DEBUG & FIX GENERATOR      ║');
    console.log('╚════════════════════════════════════════╝');

    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (query) => new Promise((resolve) => readline.question(query, resolve));

    console.log('\n📝 Provide credentials:\n');
    const auctionId = await question('Auction ID: ');
    const bearerToken = await question('Bearer Token: ');
    const cookies = await question('Cookies: ');

    readline.close();

    // Run detailed debug
    const statusResult = await debugAuctionStatusAPI(auctionId, cookies, bearerToken);
    const historyResult = await debugBidHistoryComparison(auctionId, cookies, bearerToken);

    // Generate fixes
    await suggestFixes(statusResult, historyResult);

    console.log('\n✅ Debug complete! Apply the suggested fixes above.\n');
    process.exit(0);
}

main().catch(console.error);