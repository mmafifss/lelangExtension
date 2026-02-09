// ============================================
// performance-optimizer.js
// Speed Optimization Layer - Non-breaking additions
// Tidak mengubah fungsi existing, hanya menambahkan layer optimasi
// ============================================

const http = require('http');
const https = require('https');

// ============================================
// 1. HTTP CONNECTION POOLING
// Keep-alive connections untuk reuse
// ============================================

class ConnectionPool {
    constructor() {
        // HTTP Agent with keep-alive
        this.httpAgent = new http.Agent({
            keepAlive: true,
            keepAliveMsecs: 30000,  // 30 seconds
            maxSockets: 50,          // Max concurrent connections
            maxFreeSockets: 10,      // Keep 10 idle connections ready
            timeout: 5000,           // Socket timeout
            scheduling: 'lifo'       // Last In First Out (reuse recent connections)
        });

        // HTTPS Agent with keep-alive
        this.httpsAgent = new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 30000,
            maxSockets: 50,
            maxFreeSockets: 10,
            timeout: 5000,
            scheduling: 'lifo'
        });

        this.stats = {
            totalRequests: 0,
            reusedConnections: 0,
            newConnections: 0
        };

        console.log('✅ Connection Pool initialized');
        console.log('   - Keep-alive: 30s');
        console.log('   - Max sockets: 50');
        console.log('   - Ready idle sockets: 10');
    }

    getAgent(url) {
        const isHttps = url.startsWith('https://');
        return isHttps ? this.httpsAgent : this.httpAgent;
    }

    getStats() {
        return {
            ...this.stats,
            reuseRate: this.stats.totalRequests > 0 
                ? ((this.stats.reusedConnections / this.stats.totalRequests) * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    // Cleanup method
    destroy() {
        this.httpAgent.destroy();
        this.httpsAgent.destroy();
        console.log('🧹 Connection Pool destroyed');
    }
}

// ============================================
// 2. OPTIMIZED FETCH WRAPPER
// Wrapper untuk fetch() dengan connection pooling
// ============================================

class OptimizedFetch {
    constructor(connectionPool) {
        this.pool = connectionPool;
        this.pendingRequests = new Map(); // URL -> Promise (untuk deduplication)
    }

    /**
     * Optimized fetch with connection pooling & deduplication
     * @param {string} url 
     * @param {object} options 
     * @returns {Promise<Response>}
     */
    async fetch(url, options = {}) {
        this.pool.stats.totalRequests++;

        // Request deduplication: Jika request yang sama sedang jalan, tunggu hasil yang sama
        const requestKey = this.getRequestKey(url, options);
        
        if (this.pendingRequests.has(requestKey)) {
            console.log(`⚡ Deduplicating request: ${url}`);
            return this.pendingRequests.get(requestKey);
        }

        // Add agent for connection pooling
        const fetchOptions = {
            ...options,
            agent: this.pool.getAgent(url)
        };

        // Create promise and store it
        const fetchPromise = fetch(url, fetchOptions)
            .then(response => {
                // Check if connection was reused (from headers or socket info)
                if (response.headers.get('connection') === 'keep-alive') {
                    this.pool.stats.reusedConnections++;
                } else {
                    this.pool.stats.newConnections++;
                }
                return response;
            })
            .finally(() => {
                // Remove from pending after completion
                this.pendingRequests.delete(requestKey);
            });

        this.pendingRequests.set(requestKey, fetchPromise);
        return fetchPromise;
    }

    /**
     * Generate unique key for request deduplication
     */
    getRequestKey(url, options) {
        const method = options.method || 'GET';
        const body = options.body || '';
        return `${method}:${url}:${body}`;
    }

    /**
     * Fetch with timeout (compatible dengan existing code)
     */
    async fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await this.fetch(url, {
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
}

// ============================================
// 3. BID REQUEST QUEUE
// Pre-calculate & queue bids untuk instant execution
// ============================================

class BidQueue {
    constructor() {
        this.preparedBids = new Map(); // chatId -> prepared bid data
        this.executionTimes = []; // Track execution times for stats
        
        console.log('✅ Bid Queue initialized');
    }

    /**
     * Pre-calculate bid untuk instant execution nanti
     * @param {string} chatId 
     * @param {object} bidData 
     */
    prepareBid(chatId, bidData) {
        const prepared = {
            ...bidData,
            preparedAt: Date.now(),
            expiresAt: Date.now() + 5000 // Valid untuk 5 detik
        };

        this.preparedBids.set(chatId, prepared);
        
        console.log(`⚡ Bid prepared for ${chatId}: Rp ${bidData.bidAmount?.toLocaleString('id-ID')}`);
        
        // Auto-expire setelah 5 detik
        setTimeout(() => {
            if (this.preparedBids.get(chatId)?.preparedAt === prepared.preparedAt) {
                this.preparedBids.delete(chatId);
                console.log(`⏱️ Prepared bid expired for ${chatId}`);
            }
        }, 5000);

        return prepared;
    }

    /**
     * Get prepared bid (instant, no calculation needed)
     * @param {string} chatId 
     * @returns {object|null}
     */
    getPreparedBid(chatId) {
        const prepared = this.preparedBids.get(chatId);
        
        if (!prepared) {
            return null;
        }

        // Check if expired
        if (Date.now() > prepared.expiresAt) {
            this.preparedBids.delete(chatId);
            return null;
        }

        return prepared;
    }

    /**
     * Execute prepared bid instantly
     * @param {string} chatId 
     * @returns {object}
     */
    async executePreparedBid(chatId, executeFn) {
        const startTime = Date.now();
        const prepared = this.getPreparedBid(chatId);

        if (!prepared) {
            return {
                success: false,
                error: 'No prepared bid found. Please prepare bid first.',
                fromCache: false
            };
        }

        try {
            const result = await executeFn(prepared);
            const executionTime = Date.now() - startTime;
            
            this.executionTimes.push(executionTime);
            
            // Keep only last 100 execution times
            if (this.executionTimes.length > 100) {
                this.executionTimes.shift();
            }

            console.log(`⚡ Bid executed in ${executionTime}ms (from prepared)`);

            return {
                ...result,
                executionTime,
                fromCache: true
            };
        } finally {
            // Remove after execution
            this.preparedBids.delete(chatId);
        }
    }

    /**
     * Get average execution time
     */
    getAverageExecutionTime() {
        if (this.executionTimes.length === 0) return 0;
        
        const sum = this.executionTimes.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.executionTimes.length);
    }

    /**
     * Get stats
     */
    getStats() {
        return {
            preparedBidsCount: this.preparedBids.size,
            totalExecutions: this.executionTimes.length,
            avgExecutionTime: this.getAverageExecutionTime() + 'ms',
            minExecutionTime: this.executionTimes.length > 0 
                ? Math.min(...this.executionTimes) + 'ms' 
                : 'N/A',
            maxExecutionTime: this.executionTimes.length > 0 
                ? Math.max(...this.executionTimes) + 'ms' 
                : 'N/A'
        };
    }
}

// ============================================
// 4. PERFORMANCE MONITOR
// Track & log performance metrics
// ============================================

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            apiCalls: [],
            bidExecutions: [],
            cacheHits: 0,
            cacheMisses: 0
        };

        // Start periodic reporting
        this.startPeriodicReport();
        
        console.log('✅ Performance Monitor initialized');
    }

    /**
     * Track API call
     */
    trackAPICall(endpoint, duration, success = true) {
        this.metrics.apiCalls.push({
            endpoint,
            duration,
            success,
            timestamp: Date.now()
        });

        // Keep only last 100 calls
        if (this.metrics.apiCalls.length > 100) {
            this.metrics.apiCalls.shift();
        }
    }

    /**
     * Track bid execution
     */
    trackBidExecution(chatId, duration, success = true, fromCache = false) {
        this.metrics.bidExecutions.push({
            chatId,
            duration,
            success,
            fromCache,
            timestamp: Date.now()
        });

        // Keep only last 100 executions
        if (this.metrics.bidExecutions.length > 100) {
            this.metrics.bidExecutions.shift();
        }
    }

    /**
     * Track cache hit/miss
     */
    trackCache(hit = true) {
        if (hit) {
            this.metrics.cacheHits++;
        } else {
            this.metrics.cacheMisses++;
        }
    }

    /**
     * Get comprehensive stats
     */
    getStats() {
        const apiCallDurations = this.metrics.apiCalls.map(c => c.duration);
        const bidDurations = this.metrics.bidExecutions.map(b => b.duration);
        
        const avgAPITime = apiCallDurations.length > 0
            ? Math.round(apiCallDurations.reduce((a, b) => a + b, 0) / apiCallDurations.length)
            : 0;

        const avgBidTime = bidDurations.length > 0
            ? Math.round(bidDurations.reduce((a, b) => a + b, 0) / bidDurations.length)
            : 0;

        const cacheHitRate = (this.metrics.cacheHits + this.metrics.cacheMisses) > 0
            ? ((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100).toFixed(2)
            : 0;

        return {
            api: {
                totalCalls: this.metrics.apiCalls.length,
                avgResponseTime: avgAPITime + 'ms',
                successRate: this.calculateSuccessRate(this.metrics.apiCalls)
            },
            bids: {
                totalExecutions: this.metrics.bidExecutions.length,
                avgExecutionTime: avgBidTime + 'ms',
                successRate: this.calculateSuccessRate(this.metrics.bidExecutions),
                cachedExecutions: this.metrics.bidExecutions.filter(b => b.fromCache).length
            },
            cache: {
                hits: this.metrics.cacheHits,
                misses: this.metrics.cacheMisses,
                hitRate: cacheHitRate + '%'
            },
            memory: {
                heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
                heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
            }
        };
    }

    calculateSuccessRate(items) {
        if (items.length === 0) return 'N/A';
        const successCount = items.filter(i => i.success).length;
        return ((successCount / items.length) * 100).toFixed(2) + '%';
    }

    /**
     * Periodic performance report (every 5 minutes)
     */
    startPeriodicReport() {
        setInterval(() => {
            const stats = this.getStats();
            console.log('\n📊 ===== PERFORMANCE REPORT =====');
            console.log('API Calls:', stats.api);
            console.log('Bid Executions:', stats.bids);
            console.log('Cache:', stats.cache);
            console.log('Memory:', stats.memory);
            console.log('================================\n');
        }, 5 * 60 * 1000); // Every 5 minutes
    }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    ConnectionPool,
    OptimizedFetch,
    BidQueue,
    PerformanceMonitor
};

