// ============================================
// optimized-api-wrapper.js
// Wrapper functions yang backward compatible
// Tidak mengubah signature function existing
// ============================================

const {
    ConnectionPool,
    OptimizedFetch,
    BidQueue,
    PerformanceMonitor
} = require('./performance-optimizer');

// ============================================
// INITIALIZE OPTIMIZERS
// ============================================

const connectionPool = new ConnectionPool();
const optimizedFetch = new OptimizedFetch(connectionPool);
const bidQueue = new BidQueue();
const perfMonitor = new PerformanceMonitor();

console.log('⚡ Speed Optimization Layer Active!');

// ============================================
// OPTIMIZED FETCH FUNCTIONS
// Drop-in replacement untuk existing fetch
// ============================================

/**
 * Optimized fetch dengan connection pooling
 * Signature sama dengan fetch() biasa, bisa langsung replace
 */
async function fetchOptimized(url, options = {}) {
    const startTime = Date.now();
    
    try {
        const response = await optimizedFetch.fetch(url, options);
        const duration = Date.now() - startTime;
        
        perfMonitor.trackAPICall(url, duration, response.ok);
        
        return response;
    } catch (error) {
        const duration = Date.now() - startTime;
        perfMonitor.trackAPICall(url, duration, false);
        throw error;
    }
}

/**
 * Optimized fetch dengan timeout
 * Signature sama dengan existing fetchWithTimeout
 */
async function fetchWithTimeoutOptimized(url, options = {}, timeoutMs = 5000) {
    const startTime = Date.now();
    
    try {
        const response = await optimizedFetch.fetchWithTimeout(url, options, timeoutMs);
        const duration = Date.now() - startTime;
        
        perfMonitor.trackAPICall(url, duration, response.ok);
        
        return response;
    } catch (error) {
        const duration = Date.now() - startTime;
        perfMonitor.trackAPICall(url, duration, false);
        throw error;
    }
}

// ============================================
// OPTIMIZED BID FUNCTIONS
// ============================================

/**
 * Prepare bid untuk instant execution
 * Call ini sebelum execute bid untuk pre-calculate semua
 */
function prepareBidForInstantExecution(chatId, session, latestPrice, kelipatanBid, multiplier = 1) {
    const bidAmount = latestPrice + (kelipatanBid * multiplier);
    
    const bidData = {
        auctionId: session.auctionId,
        bidAmount: bidAmount,
        passkey: session.passBidding,
        cookies: session.cookies,
        bearerToken: session.bearerToken,
        bidTime: new Date().toISOString()
    };

    bidQueue.prepareBid(chatId, bidData);
    
    console.log(`⚡ Bid prepared: Rp ${bidAmount.toLocaleString('id-ID')} (${multiplier}x kelipatan)`);
    
    return {
        prepared: true,
        bidAmount,
        expiresIn: '5 seconds'
    };
}

/**
 * Execute prepared bid instantly (ultra-fast)
 * Jika ada prepared bid, langsung execute tanpa calculate lagi
 */
async function executeInstantBid(chatId, sendBidToAPIFunction) {
    const startTime = Date.now();
    
    return bidQueue.executePreparedBid(chatId, async (preparedBid) => {
        // Execute bid menggunakan function yang sudah ada
        const result = await sendBidToAPIFunction(
            preparedBid.auctionId,
            preparedBid.passkey,
            preparedBid.bidAmount,
            preparedBid.cookies,
            preparedBid.bearerToken
        );

        const duration = Date.now() - startTime;
        perfMonitor.trackBidExecution(chatId, duration, result.success, true);

        return {
            ...result,
            executionTime: duration,
            optimized: true
        };
    });
}

/**
 * Wrapper untuk sendBidToAPI yang existing
 * Tambahkan performance tracking tanpa ubah logic
 */
function wrapBidFunction(originalSendBidFn) {
    return async function sendBidToAPIOpt(auctionId, passkey, bidAmount, cookies, bearerToken) {
        const startTime = Date.now();
        
        try {
            const result = await originalSendBidFn(auctionId, passkey, bidAmount, cookies, bearerToken);
            const duration = Date.now() - startTime;
            
            perfMonitor.trackBidExecution('direct', duration, result.success, false);
            
            return {
                ...result,
                executionTime: duration
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            perfMonitor.trackBidExecution('direct', duration, false, false);
            throw error;
        }
    };
}

// ============================================
// OPTIMIZED CACHE WRAPPER
// ============================================

/**
 * Enhanced cache dengan performance tracking
 * Backward compatible dengan existing cachedFetch
 */
function createOptimizedCache(cacheTTL = 1000) {
    const cache = new Map();
    
    return async function cachedFetchOptimized(key, fetchFn) {
        const cached = cache.get(key);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < cacheTTL) {
            perfMonitor.trackCache(true); // Cache hit
            console.log(`💾 Cache HIT: ${key}`);
            return cached.result;
        }

        perfMonitor.trackCache(false); // Cache miss
        console.log(`🔄 Cache MISS: ${key} - Fetching...`);

        const result = await fetchFn();
        cache.set(key, { result, timestamp: now });

        // Cleanup expired cache entries (10% chance per call)
        if (Math.random() < 0.1) {
            for (const [k, v] of cache.entries()) {
                if (now - v.timestamp > cacheTTL * 2) {
                    cache.delete(k);
                }
            }
        }

        return result;
    };
}

// ============================================
// STATS & MONITORING
// ============================================

/**
 * Get comprehensive performance stats
 */
function getPerformanceStats() {
    return {
        connectionPool: connectionPool.getStats(),
        bidQueue: bidQueue.getStats(),
        performance: perfMonitor.getStats(),
        timestamp: new Date().toISOString()
    };
}

/**
 * Get quick performance summary
 */
function getPerformanceSummary() {
    const stats = perfMonitor.getStats();
    const poolStats = connectionPool.getStats();
    
    return {
        avgBidTime: stats.bids.avgExecutionTime,
        avgAPITime: stats.api.avgResponseTime,
        connectionReuseRate: poolStats.reuseRate,
        cacheHitRate: stats.cache.hitRate,
        memoryUsage: stats.memory.heapUsed
    };
}

/**
 * Health check dengan performance metrics
 */
function getHealthWithPerformance() {
    const stats = getPerformanceStats();
    const summary = getPerformanceSummary();
    
    return {
        status: 'healthy',
        uptime: process.uptime(),
        performance: summary,
        details: stats,
        timestamp: new Date().toISOString()
    };
}

// ============================================
// CLEANUP
// ============================================

function cleanup() {
    connectionPool.destroy();
    console.log('✅ Performance optimizers cleaned up');
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// ============================================
// EXPORTS
// ============================================

module.exports = {
    // Optimized fetch (drop-in replacement)
    fetch: fetchOptimized,
    fetchWithTimeout: fetchWithTimeoutOptimized,
    
    // Bid optimization
    prepareBidForInstantExecution,
    executeInstantBid,
    wrapBidFunction,
    
    // Cache
    createOptimizedCache,
    
    // Stats & monitoring
    getPerformanceStats,
    getPerformanceSummary,
    getHealthWithPerformance,
    
    // Direct access to optimizers (if needed)
    connectionPool,
    bidQueue,
    perfMonitor,
    
    // Cleanup
    cleanup
};

