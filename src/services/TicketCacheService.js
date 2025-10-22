const fs = require('fs').promises;
const path = require('path');

/**
 * Ticket Cache Service
 * Manages caching of ticket analytics data to reduce API calls
 */
class TicketCacheService {
  constructor() {
    this.cacheDir = path.join(__dirname, '../../cache');
    this.cacheFile = path.join(this.cacheDir, 'ticket-analytics.json');
    this.maxCacheAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  /**
   * Ensure cache directory exists
   */
  async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('❌ Error creating cache directory:', error.message);
    }
  }

  /**
   * Get cached data for a specific date
   */
  async getCachedData(dateStr) {
    try {
      const cache = await this.loadCache();
      const cachedEntry = cache.daily_data[dateStr];
      
      if (!cachedEntry) {
        return null;
      }
      
      // Check if cache is still valid (not expired)
      const cacheAge = Date.now() - new Date(cachedEntry.cached_at).getTime();
      if (cacheAge > this.maxCacheAge) {
        console.log(`⏰ Cache expired for ${dateStr} (age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
        return null;
      }
      
      console.log(`💾 Using cached data for ${dateStr}`);
      return cachedEntry.data;
      
    } catch (error) {
      console.error(`❌ Error getting cached data for ${dateStr}:`, error.message);
      return null;
    }
  }

  /**
   * Cache data for a specific date
   */
  async setCachedData(dateStr, data) {
    try {
      const cache = await this.loadCache();
      
      cache.daily_data[dateStr] = {
        data: data,
        cached_at: new Date().toISOString()
      };
      
      cache.last_updated = new Date().toISOString();
      
      await this.saveCache(cache);
      console.log(`💾 Cached data for ${dateStr}`);
      
    } catch (error) {
      console.error(`❌ Error caching data for ${dateStr}:`, error.message);
    }
  }

  /**
   * Get all cached dates
   */
  async getCachedDates() {
    try {
      const cache = await this.loadCache();
      return Object.keys(cache.daily_data);
    } catch (error) {
      console.error('❌ Error getting cached dates:', error.message);
      return [];
    }
  }

  /**
   * Clear cache for a specific date
   */
  async clearCachedData(dateStr) {
    try {
      const cache = await this.loadCache();
      delete cache.daily_data[dateStr];
      cache.last_updated = new Date().toISOString();
      await this.saveCache(cache);
      console.log(`🗑️ Cleared cache for ${dateStr}`);
    } catch (error) {
      console.error(`❌ Error clearing cache for ${dateStr}:`, error.message);
    }
  }

  /**
   * Clear all cached data
   */
  async clearAllCache() {
    try {
      const emptyCache = {
        daily_data: {},
        last_updated: new Date().toISOString(),
        version: '1.0'
      };
      
      await this.saveCache(emptyCache);
      console.log('🗑️ Cleared all cached data');
      
    } catch (error) {
      console.error('❌ Error clearing all cache:', error.message);
    }
  }

  /**
   * Check if today's data should be considered "fresh" 
   * (less than 15 minutes old for real-time updates)
   */
  async isTodayDataFresh(dateStr) {
    try {
      const cache = await this.loadCache();
      const cachedEntry = cache.daily_data[dateStr];
      
      if (!cachedEntry) {
        return false;
      }
      
      const cacheAge = Date.now() - new Date(cachedEntry.cached_at).getTime();
      const freshThreshold = 15 * 60 * 1000; // 15 minutes
      
      return cacheAge < freshThreshold;
      
    } catch (error) {
      console.error(`❌ Error checking freshness for ${dateStr}:`, error.message);
      return false;
    }
  }

  /**
   * Load cache from file
   */
  async loadCache() {
    try {
      await this.ensureCacheDir();
      
      const cacheData = await fs.readFile(this.cacheFile, 'utf8');
      return JSON.parse(cacheData);
      
    } catch (error) {
      // If file doesn't exist or is invalid, return empty cache
      if (error.code === 'ENOENT') {
        return {
          daily_data: {},
          last_updated: new Date().toISOString(),
          version: '1.0'
        };
      }
      
      console.error('❌ Error loading cache:', error.message);
      return {
        daily_data: {},
        last_updated: new Date().toISOString(),
        version: '1.0'
      };
    }
  }

  /**
   * Save cache to file
   */
  async saveCache(cache) {
    try {
      await this.ensureCacheDir();
      await fs.writeFile(this.cacheFile, JSON.stringify(cache, null, 2), 'utf8');
    } catch (error) {
      console.error('❌ Error saving cache:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const cache = await this.loadCache();
      const cachedDates = Object.keys(cache.daily_data);
      
      let freshCount = 0;
      let expiredCount = 0;
      
      for (const dateStr of cachedDates) {
        const entry = cache.daily_data[dateStr];
        const cacheAge = Date.now() - new Date(entry.cached_at).getTime();
        
        if (cacheAge > this.maxCacheAge) {
          expiredCount++;
        } else {
          freshCount++;
        }
      }
      
      return {
        total_cached_days: cachedDates.length,
        fresh_entries: freshCount,
        expired_entries: expiredCount,
        last_updated: cache.last_updated,
        cache_file_size: await this.getCacheFileSize()
      };
      
    } catch (error) {
      console.error('❌ Error getting cache stats:', error.message);
      return {
        total_cached_days: 0,
        fresh_entries: 0,
        expired_entries: 0,
        last_updated: null,
        cache_file_size: 0
      };
    }
  }

  /**
   * Get cache file size in bytes
   */
  async getCacheFileSize() {
    try {
      const stats = await fs.stat(this.cacheFile);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredCache() {
    try {
      const cache = await this.loadCache();
      const cachedDates = Object.keys(cache.daily_data);
      let cleanedCount = 0;
      
      for (const dateStr of cachedDates) {
        const entry = cache.daily_data[dateStr];
        const cacheAge = Date.now() - new Date(entry.cached_at).getTime();
        
        if (cacheAge > this.maxCacheAge) {
          delete cache.daily_data[dateStr];
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        cache.last_updated = new Date().toISOString();
        await this.saveCache(cache);
        console.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
      }
      
      return cleanedCount;
      
    } catch (error) {
      console.error('❌ Error cleaning up expired cache:', error.message);
      return 0;
    }
  }
}

module.exports = TicketCacheService;