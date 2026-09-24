// ============================================
// budget-manager.js
// Smart Budget Management System
// Prevents overbidding & manages auction budget
// ============================================

class BudgetManager {
    constructor() {
        // Storage: chatId -> budget config
        this.budgets = new Map();
        
        // Bid history: chatId -> array of bids
        this.bidHistory = new Map();
        
        console.log('✅ Budget Manager initialized');
    }

    /**
     * Set budget untuk user
     * @param {string} chatId 
     * @param {object} config 
     */
    setBudget(chatId, config) {
        const budgetConfig = {
            maxBudget: config.maxBudget || 0,
            warningThreshold: config.warningThreshold || 0.9, // 90%
            stopThreshold: config.stopThreshold || 1.0, // 100%
            reserveForSnipe: config.reserveForSnipe || 0,
            autoStop: config.autoStop !== false, // Default true
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.budgets.set(chatId, budgetConfig);
        
        console.log(`💰 Budget set for ${chatId}:`, {
            max: this.formatCurrency(budgetConfig.maxBudget),
            warning: (budgetConfig.warningThreshold * 100) + '%',
            reserve: this.formatCurrency(budgetConfig.reserveForSnipe)
        });

        return budgetConfig;
    }

    /**
     * Get budget config untuk user
     */
    getBudget(chatId) {
        return this.budgets.get(chatId) || null;
    }

    /**
     * Track bid yang sudah dilakukan
     */
    trackBid(chatId, bidAmount, success = true) {
        if (!this.bidHistory.has(chatId)) {
            this.bidHistory.set(chatId, []);
        }

        const bid = {
            amount: bidAmount,
            success,
            timestamp: Date.now()
        };

        this.bidHistory.get(chatId).push(bid);

        // Keep only last 100 bids per user
        const history = this.bidHistory.get(chatId);
        if (history.length > 100) {
            history.shift();
        }

        return bid;
    }

    /**
     * Get highest successful bid oleh user
     * NOTE: In auction, you only pay for FINAL winning bid, not all bids!
     */
    getHighestBid(chatId) {
        const history = this.bidHistory.get(chatId);
        if (!history || history.length === 0) return 0;

        // Get highest successful bid amount
        const successfulBids = history.filter(bid => bid.success);
        if (successfulBids.length === 0) return 0;

        return Math.max(...successfulBids.map(bid => bid.amount));
    }

    /**
     * DEPRECATED: Use getHighestBid() instead
     * Kept for backward compatibility
     */
    getTotalSpent(chatId) {
        return this.getHighestBid(chatId);
    }

    /**
     * Get bid history untuk user
     */
    getBidHistory(chatId) {
        return this.bidHistory.get(chatId) || [];
    }

    /**
     * Check apakah bid amount allowed (dalam budget)
     * AUCTION LOGIC: Budget = Max purchase price, NOT cumulative spending!
     * In auction, you only pay for FINAL winning bid.
     */
    canBid(chatId, bidAmount) {
        const budget = this.getBudget(chatId);
        
        // No budget set = unlimited
        if (!budget || budget.maxBudget === 0) {
            return {
                allowed: true,
                reason: 'No budget limit set',
                remaining: Infinity
            };
        }

        const maxPrice = budget.maxBudget;
        const percentUsed = (bidAmount / maxPrice) * 100;

        // Check if bid amount exceeds max purchase price
        if (bidAmount > maxPrice) {
            return {
                allowed: false,
                reason: 'Bid exceeds maximum purchase price',
                maxBudget: maxPrice,
                bidAmount,
                deficit: bidAmount - maxPrice,
                percentUsed: percentUsed.toFixed(1)
            };
        }

        // Check warning threshold (e.g., bid is 90% of max price)
        if (percentUsed >= (budget.warningThreshold * 100)) {
            return {
                allowed: true,
                warning: true,
                reason: `Bid at ${percentUsed.toFixed(1)}% of max price (warning threshold)`,
                maxBudget: maxPrice,
                bidAmount,
                percentUsed: percentUsed.toFixed(1)
            };
        }

        return {
            allowed: true,
            reason: 'Within budget',
            maxBudget: maxPrice,
            bidAmount,
            percentUsed: percentUsed.toFixed(1)
        };
    }

    /**
     * Calculate safe bid amount (within budget)
     * AUCTION LOGIC: Limit to max purchase price
     */
    getSafeBidAmount(chatId, desiredAmount) {
        const budget = this.getBudget(chatId);
        
        // No budget = return desired amount
        if (!budget || budget.maxBudget === 0) {
            return {
                amount: desiredAmount,
                limited: false
            };
        }

        const maxPrice = budget.maxBudget;

        // If desired amount within max price, return it
        if (desiredAmount <= maxPrice) {
            return {
                amount: desiredAmount,
                limited: false,
                maxPrice
            };
        }

        // Limit to max purchase price
        return {
            amount: maxPrice,
            limited: true,
            original: desiredAmount,
            maxPrice,
            reason: 'Limited to max purchase price'
        };
    }

    /**
     * Get budget summary untuk user
     * AUCTION LOGIC: Show max purchase price & highest bid
     */
    getSummary(chatId) {
        const budget = this.getBudget(chatId);
        const history = this.getBidHistory(chatId);
        const highestBid = this.getHighestBid(chatId);

        if (!budget) {
            return {
                budgetSet: false,
                totalBids: history.length,
                successfulBids: history.filter(b => b.success).length,
                highestBid
            };
        }

        const maxPrice = budget.maxBudget;
        const percentUsed = highestBid > 0 ? (highestBid / maxPrice) * 100 : 0;

        return {
            budgetSet: true,
            maxBudget: maxPrice, // Max purchase price
            highestBid, // Current highest bid (what you'd pay if you win)
            percentUsed,
            totalBids: history.length,
            successfulBids: history.filter(b => b.success).length,
            failedBids: history.filter(b => !b.success).length,
            warningThreshold: budget.warningThreshold * 100,
            isNearLimit: percentUsed >= (budget.warningThreshold * 100)
        };
    }

    /**
     * Format currency
     */
    formatCurrency(amount) {
        return 'Rp ' + amount.toLocaleString('id-ID');
    }

    /**
     * Clear budget untuk user
     */
    clearBudget(chatId) {
        this.budgets.delete(chatId);
        console.log(`🗑️ Budget cleared for ${chatId}`);
    }

    /**
     * Reset bid history (keep budget)
     */
    resetHistory(chatId) {
        this.bidHistory.delete(chatId);
        console.log(`🔄 Bid history reset for ${chatId}`);
    }
}

// ============================================
// SNIPE BIDDING MANAGER
// ============================================

class SnipeManager {
    constructor(budgetManager) {
        this.budgetManager = budgetManager;
        this.activeSnipes = new Map(); // chatId -> snipe config
        this.snipeHistory = new Map(); // chatId -> array of snipe results
        
        console.log('✅ Snipe Manager initialized');
    }

    /**
     * Setup snipe bid untuk user
     */
    setupSnipe(chatId, config) {
        const snipeConfig = {
            enabled: true,
            triggerSeconds: config.triggerSeconds || 5, // Default: 5 detik sebelum tutup
            maxBidAmount: config.maxBidAmount || 0, // Max bid for snipe (optional)
            multiplier: config.multiplier || 1, // Kelipatan bid (1x, 5x, 10x)
            respectBudget: config.respectBudget !== false, // Default: true
            autoExecute: config.autoExecute !== false, // Default: true
            createdAt: Date.now()
        };

        this.activeSnipes.set(chatId, snipeConfig);
        
        console.log(`🎯 Snipe configured for ${chatId}:`, {
            trigger: snipeConfig.triggerSeconds + 's',
            multiplier: snipeConfig.multiplier + 'x',
            maxBid: snipeConfig.maxBidAmount || 'unlimited',
            budgetControl: snipeConfig.respectBudget ? 'ON' : 'OFF'
        });

        return snipeConfig;
    }

    /**
     * Get snipe config
     */
    getSnipe(chatId) {
        return this.activeSnipes.get(chatId) || null;
    }

    /**
     * Check if should execute snipe
     */
    shouldExecuteSnipe(chatId, timeRemaining) {
        const snipe = this.getSnipe(chatId);
        
        if (!snipe || !snipe.enabled) {
            return {
                shouldSnipe: false,
                reason: 'Snipe not enabled'
            };
        }

        if (timeRemaining > snipe.triggerSeconds) {
            return {
                shouldSnipe: false,
                reason: `Too early (trigger at ${snipe.triggerSeconds}s, current: ${timeRemaining}s)`
            };
        }

        return {
            shouldSnipe: true,
            reason: `Time to snipe! (${timeRemaining}s remaining)`
        };
    }

    /**
     * Calculate snipe bid amount (with budget control)
     */
    calculateSnipeBid(chatId, currentPrice, kelipatanBid) {
        const snipe = this.getSnipe(chatId);
        
        if (!snipe) {
            return {
                success: false,
                error: 'Snipe not configured'
            };
        }

        // Calculate base bid
        const baseBidAmount = currentPrice + (kelipatanBid * snipe.multiplier);

        // Check against snipe max (if set)
        let bidAmount = baseBidAmount;
        let limited = false;

        if (snipe.maxBidAmount > 0 && bidAmount > snipe.maxBidAmount) {
            bidAmount = snipe.maxBidAmount;
            limited = true;
        }

        // Check against budget (if enabled)
        if (snipe.respectBudget) {
            const budgetCheck = this.budgetManager.canBid(chatId, bidAmount);
            
            if (!budgetCheck.allowed) {
                // Try safe amount (limit to remaining budget)
                const safeBid = this.budgetManager.getSafeBidAmount(chatId, bidAmount);
                
                if (safeBid.amount < currentPrice + kelipatanBid) {
                    // Safe amount too low to compete
                    return {
                        success: false,
                        error: 'Insufficient budget',
                        details: budgetCheck
                    };
                }

                bidAmount = safeBid.amount;
                limited = true;
            }
        }

        return {
            success: true,
            bidAmount,
            original: baseBidAmount,
            limited,
            multiplier: snipe.multiplier,
            details: {
                currentPrice,
                kelipatanBid,
                increment: bidAmount - currentPrice
            }
        };
    }

    /**
     * Track snipe execution
     */
    trackSnipe(chatId, result) {
        if (!this.snipeHistory.has(chatId)) {
            this.snipeHistory.set(chatId, []);
        }

        const snipeRecord = {
            ...result,
            timestamp: Date.now()
        };

        this.snipeHistory.get(chatId).push(snipeRecord);

        // Keep only last 50 snipes
        const history = this.snipeHistory.get(chatId);
        if (history.length > 50) {
            history.shift();
        }

        return snipeRecord;
    }

    /**
     * Disable snipe
     */
    disableSnipe(chatId) {
        const snipe = this.activeSnipes.get(chatId);
        if (snipe) {
            snipe.enabled = false;
            console.log(`🛑 Snipe disabled for ${chatId}`);
        }
    }

    /**
     * Enable snipe
     */
    enableSnipe(chatId) {
        const snipe = this.activeSnipes.get(chatId);
        if (snipe) {
            snipe.enabled = true;
            console.log(`✅ Snipe enabled for ${chatId}`);
        }
    }

    /**
     * Clear snipe config
     */
    clearSnipe(chatId) {
        this.activeSnipes.delete(chatId);
        console.log(`🗑️ Snipe cleared for ${chatId}`);
    }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    BudgetManager,
    SnipeManager
};

