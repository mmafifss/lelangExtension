// ============================================
// safe-optimizer-wrapper.js
// Safe wrapper dengan automatic fallback
// Jika optimizer error → auto fallback ke native fetch
// ============================================

const OptimizedAPI = require('./optimized-api-wrapper');

// ============================================
// CIRCUIT BREAKER PATTERN
// ============================================

class CircuitBreaker {
    constructor(threshold = 5, timeout = 60000) {
        this.failureCount = 0;
        this.threshold = threshold;
        this.timeout = timeout;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.nextAttempt = Date.now();
    }

    async execute(optimizedFn, fallbackFn) {
        // Check circuit state
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                // Circuit still open, use fallback
                console.warn('⚠️ Circuit OPEN - Using fallback');
                return await fallbackFn();
            } else {
                // Try half-open
                this.state = 'HALF_OPEN';
                console.log('🟡 Circuit HALF_OPEN - Testing...');
            }
        }

        try {
            // Try optimized function
            const result = await optimizedFn();
            
            // Success! Reset circuit
            if (this.state === 'HALF_OPEN') {
                console.log('✅ Circuit CLOSED - Optimizer restored');
            }
            this.failureCount = 0;
            this.state = 'CLOSED';
            
            return result;
        } catch (error) {
            // Failure
            this.failureCount++;
            console.error(`❌ Optimizer failed (${this.failureCount}/${this.threshold}):`, error.message);

            // Check if should open circuit
            if (this.failureCount >= this.threshold) {
                this.state = 'OPEN';
                this.nextAttempt = Date.now() + this.timeout;
                console.error(`🔴 Circuit OPENED! Will retry in ${this.timeout/1000}s`);
            }

            // Use fallback
            return await fallbackFn();
        }
    }

    getStatus() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            threshold: this.threshold,
            nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt).toISOString() : null
        };
    }
}

// Global circuit breaker instance
const circuitBreaker = new CircuitBreaker(5, 60000);

// ============================================
// SAFE FETCH WRAPPERS
// ============================================

/**
 * Safe fetch dengan automatic fallback
 * Jika optimizer error → gunakan native fetch
 */
async function fetchSafe(url, options = {}) {
    return circuitBreaker.execute(
        // Optimized function
        async () => await OptimizedAPI.fetch(url, options),
        // Fallback function
        async () => {
            console.warn('⚠️ Using native fetch fallback');
            return await fetch(url, options);
        }
    );
}

/**
 * Safe fetch dengan timeout + fallback
 */
async function fetchWithTimeoutSafe(url, options = {}, timeoutMs = 5000) {
    return circuitBreaker.execute(
        // Optimized function
        async () => await OptimizedAPI.fetchWithTimeout(url, options, timeoutMs),
        // Fallback function
        async () => {
            console.warn('⚠️ Using native fetch with manual timeout fallback');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                return response;
            } catch (error) {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    throw new Error(`Request timeout after ${timeoutMs}ms`);
                }
                throw error;
            }
        }
    );
}

/**
 * Safe prepare bid
 * Jika error → return null, tidak break flow
 */
function prepareBidSafe(chatId, session, latestPrice, kelipatanBid, multiplier = 1) {
    try {
        return OptimizedAPI.prepareBidForInstantExecution(
            chatId,
            session,
            latestPrice,
            kelipatanBid,
            multiplier
        );
    } catch (error) {
        console.error('❌ Failed to prepare bid:', error.message);
        return null; // Graceful degradation
    }
}

/**
 * Safe execute instant bid
 * Jika error atau no prepared bid → return null (caller must handle)
 */
async function executeInstantBidSafe(chatId, sendBidToAPIFunction) {
    try {
        return await OptimizedAPI.executeInstantBid(chatId, sendBidToAPIFunction);
    } catch (error) {
        console.error('❌ Failed to execute instant bid:', error.message);
        return {
            success: false,
            error: 'Instant bid failed: ' + error.message,
            fromCache: false
        };
    }
}

/**
 * Safe cache wrapper
 */
function createSafeCache(cacheTTL = 1000) {
    const optimizedCache = OptimizedAPI.createOptimizedCache(cacheTTL);
    
    return async function safeCachedFetch(key, fetchFn) {
        try {
            return await optimizedCache(key, fetchFn);
        } catch (error) {
            console.error('❌ Cache operation failed:', error.message);
            // Fallback: Execute fetchFn directly (no cache)
            return await fetchFn();
        }
    };
}

// ============================================
// SAFE PERFORMANCE MONITORING
// ============================================

/**
 * Safe get performance stats
 * Never throw, always return valid object
 */
function getPerformanceStatsSafe() {
    try {
        return OptimizedAPI.getPerformanceStats();
    } catch (error) {
        console.error('❌ Failed to get performance stats:', error.message);
        return {
            error: 'Stats unavailable',
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Safe get performance summary
 */
function getPerformanceSummarySafe() {
    try {
        return OptimizedAPI.getPerformanceSummary();
    } catch (error) {
        console.error('❌ Failed to get performance summary:', error.message);
        return {
            avgBidTime: 'N/A',
            avgAPITime: 'N/A',
            connectionReuseRate: 'N/A',
            cacheHitRate: 'N/A',
            memoryUsage: 'N/A'
        };
    }
}

/**
 * Safe health check
 */
function getHealthWithPerformanceSafe() {
    try {
        return {
            ...OptimizedAPI.getHealthWithPerformance(),
            optimizer: {
                enabled: true,
                circuitBreaker: circuitBreaker.getStatus()
            }
        };
    } catch (error) {
        console.error('❌ Failed to get health:', error.message);
        return {
            status: 'degraded',
            uptime: process.uptime(),
            optimizer: {
                enabled: false,
                error: error.message,
                circuitBreaker: circuitBreaker.getStatus()
            },
            timestamp: new Date().toISOString()
        };
    }
}

// ============================================
// GRACEFUL DEGRADATION MODE
// ============================================

let optimizerEnabled = true;

/**
 * Disable optimizer completely (emergency)
 */
function disableOptimizer() {
    optimizerEnabled = false;
    console.warn('⚠️ Optimizer DISABLED - All requests use native fetch');
}

/**
 * Re-enable optimizer
 */
function enableOptimizer() {
    optimizerEnabled = true;
    circuitBreaker.failureCount = 0;
    circuitBreaker.state = 'CLOSED';
    console.log('✅ Optimizer RE-ENABLED');
}

/**
 * Check if optimizer is enabled
 */
function isOptimizerEnabled() {
    return optimizerEnabled && circuitBreaker.state !== 'OPEN';
}

/**
 * Smart fetch: Auto switch based on optimizer state
 */
async function smartFetch(url, options = {}) {
    if (!optimizerEnabled) {
        // Optimizer disabled, use native fetch
        return await fetch(url, options);
    }
    
    // Use safe fetch (with circuit breaker)
    return await fetchSafe(url, options);
}

// ============================================
// HEALTH MONITORING
// ============================================

// Monitor optimizer health every 30 seconds
setInterval(() => {
    if (circuitBreaker.state === 'OPEN') {
        console.warn('⚠️ ALERT: Optimizer circuit is OPEN');
    }
    
    // Check memory usage
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    
    if (heapUsedMB > 400) { // Warning at 400MB
        console.warn(`⚠️ ALERT: High memory usage: ${heapUsedMB}MB`);
    }
}, 30000);

// ============================================
// EXPORTS
// ============================================

module.exports = {
    // Safe fetch functions (RECOMMENDED)
    fetch: smartFetch,
    fetchSafe,
    fetchWithTimeout: fetchWithTimeoutSafe,
    fetchWithTimeoutSafe,
    
    // Safe bid functions
    prepareBid: prepareBidSafe,
    executeInstantBid: executeInstantBidSafe,
    
    // Safe cache
    createSafeCache,
    
    // Safe monitoring
    getPerformanceStats: getPerformanceStatsSafe,
    getPerformanceSummary: getPerformanceSummarySafe,
    getHealthWithPerformance: getHealthWithPerformanceSafe,
    
    // Circuit breaker control
    getCircuitBreakerStatus: () => circuitBreaker.getStatus(),
    
    // Manual control (emergency use)
    disableOptimizer,
    enableOptimizer,
    isOptimizerEnabled,
    
    // Direct access to original (advanced use)
    OptimizedAPI,
    
    // Cleanup
    cleanup: OptimizedAPI.cleanup
};

console.log('✅ Safe Optimizer Wrapper loaded');
console.log('   - Circuit breaker: Active');
console.log('   - Automatic fallback: Enabled');
console.log('   - Health monitoring: Active');

