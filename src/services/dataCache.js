const fs = require('fs').promises;
const path = require('path');
const ZendeskReportingService = require('./ZendeskReportingService');

class DataCache {
  constructor() {
    this.cacheDir = path.join(__dirname, '../../data');
    this.cacheFile = path.join(this.cacheDir, 'daily-cache.json');
    this.lastFetchDate = null;
    this.cachedData = null;
    this.isRefreshing = false;
  }

  async ensureCacheDir() {
    try {
      await fs.access(this.cacheDir);
    } catch {
      await fs.mkdir(this.cacheDir, { recursive: true });
    }
  }

  getCurrentDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  async loadCachedData() {
    try {
      const data = await fs.readFile(this.cacheFile, 'utf8');
      const parsed = JSON.parse(data);
      
      if (parsed.date === this.getCurrentDateString()) {
        console.log('📦 Loaded cached data from', parsed.date);
        this.cachedData = parsed.data;
        this.lastFetchDate = parsed.date;
        return true;
      } else {
        console.log('📅 Cache is from', parsed.date, 'but today is', this.getCurrentDateString());
        return false;
      }
    } catch (error) {
      console.log('📦 No valid cache found, will fetch fresh data');
      return false;
    }
  }

  async saveCachedData(data) {
    await this.ensureCacheDir();
    const cacheData = {
      date: this.getCurrentDateString(),
      fetchTime: new Date().toISOString(),
      data: data
    };
    
    await fs.writeFile(this.cacheFile, JSON.stringify(cacheData, null, 2));
    console.log('💾 Saved fresh data to cache');
  }

  async fetchAllZendeskData() {
    if (this.isRefreshing) {
      console.log('🔄 Data refresh already in progress...');
      return this.cachedData;
    }

    this.isRefreshing = true;
    console.log('🔄 Fetching comprehensive Zendesk data...');
    
    try {
      const service = new ZendeskReportingService();
      const allData = {};

      // Core data that we know works
      const dataFetchers = [
        { key: 'tickets', method: 'getTickets', description: 'Tickets' },
        { key: 'users', method: 'getUsers', description: 'Users' },
        { key: 'organizations', method: 'getOrganizations', description: 'Organizations' },
        { key: 'groups', method: 'getGroups', description: 'Groups' },
        { key: 'ticket_fields', method: 'getTicketFields', description: 'Ticket Fields' },
        { key: 'user_fields', method: 'getUserFields', description: 'User Fields' },
        { key: 'macros', method: 'getMacros', description: 'Macros' },
        { key: 'views', method: 'getViews', description: 'Views' },
        { key: 'triggers', method: 'getTriggers', description: 'Triggers' },
        { key: 'automations', method: 'getAutomations', description: 'Automations' },
        { key: 'tags', method: 'getTags', description: 'Tags' },
        { key: 'satisfaction_ratings', method: 'getSatisfactionRatings', description: 'Satisfaction Ratings' },
        { key: 'activity_stream', method: 'getActivityStream', description: 'Activity Stream' },
        { key: 'brands', method: 'getBrands', description: 'Brands' },
        { key: 'locales', method: 'getLocales', description: 'Locales' }
      ];

      let successful = 0;
      let failed = 0;

      for (const fetcher of dataFetchers) {
        try {
          console.log(`  📊 Fetching ${fetcher.description}...`);
          const result = await service[fetcher.method]();
          
          if (result && !result.error) {
            allData[fetcher.key] = result;
            successful++;
            console.log(`    ✅ ${fetcher.description} (${this.getDataSize(result)})`);
          } else {
            console.log(`    ❌ ${fetcher.description} failed:`, result?.error || 'No data');
            failed++;
          }
        } catch (error) {
          console.log(`    ❌ ${fetcher.description} error:`, error.message);
          failed++;
        }
      }

      // Add metadata
      allData._metadata = {
        fetchTime: new Date().toISOString(),
        date: this.getCurrentDateString(),
        successful_apis: successful,
        failed_apis: failed,
        total_apis: dataFetchers.length
      };

      console.log(`📊 Data fetch complete: ${successful} successful, ${failed} failed`);
      
      // Save to cache
      await this.saveCachedData(allData);
      this.cachedData = allData;
      this.lastFetchDate = this.getCurrentDateString();

      return allData;
    } catch (error) {
      console.error('❌ Failed to fetch Zendesk data:', error.message);
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  getDataSize(data) {
    if (data.tickets) return `${data.tickets.length} items`;
    if (data.users) return `${data.users.length} items`;
    if (data.organizations) return `${data.organizations.length} items`;
    if (data.groups) return `${data.groups.length} items`;
    if (data.ticket_fields) return `${data.ticket_fields.length} items`;
    if (data.user_fields) return `${data.user_fields.length} items`;
    if (data.macros) return `${data.macros.length} items`;
    if (data.views) return `${data.views.length} items`;
    if (data.triggers) return `${data.triggers.length} items`;
    if (data.automations) return `${data.automations.length} items`;
    if (data.tags) return `${data.tags.length} items`;
    if (data.satisfaction_ratings) return `${data.satisfaction_ratings.length} items`;
    if (data.activity_stream) return `${data.activity_stream.length} items`;
    if (data.brands) return `${data.brands.length} items`;
    if (data.locales) return `${data.locales.length} items`;
    return 'unknown size';
  }

  async getDailyData(forceRefresh = false) {
    const today = this.getCurrentDateString();
    
    // Check if we need fresh data
    if (forceRefresh || !this.cachedData || this.lastFetchDate !== today) {
      // Try to load from cache first
      const cacheLoaded = await this.loadCachedData();
      
      if (!cacheLoaded || forceRefresh) {
        // Fetch fresh data
        await this.fetchAllZendeskData();
      }
    }

    return this.cachedData;
  }

  generateDataSummary(data, userQuestion = '') {
    if (!data) return 'No data available';

    const lowerQuestion = userQuestion.toLowerCase();
    const summaries = [];

    // Always include basic stats
    if (data.tickets) {
      const tickets = data.tickets.tickets || [];
      const openTickets = tickets.filter(t => t.status === 'open').length;
      const pendingTickets = tickets.filter(t => t.status === 'pending').length;
      const solvedTickets = tickets.filter(t => t.status === 'solved').length;
      
      summaries.push(`📧 Tickets Overview:
• Total tickets: ${tickets.length}
• Open: ${openTickets}
• Pending: ${pendingTickets} 
• Solved: ${solvedTickets}
• Today's activity: ${tickets.filter(t => {
  const today = new Date().toISOString().split('T')[0];
  return t.created_at?.startsWith(today) || t.updated_at?.startsWith(today);
}).length} tickets`);
    }

    // Add relevant data based on question keywords
    if ((lowerQuestion.includes('user') || lowerQuestion.includes('agent') || !lowerQuestion) && data.users) {
      const users = data.users.users || [];
      const agents = users.filter(u => u.role === 'agent');
      const endUsers = users.filter(u => u.role === 'end-user');
      const activeUsers = users.filter(u => u.active);
      
      summaries.push(`👥 Users & Agents:
• Total users: ${users.length}
• Agents: ${agents.length}
• End users: ${endUsers.length}
• Active users: ${activeUsers.length}`);
    }

    if ((lowerQuestion.includes('organization') || !lowerQuestion) && data.organizations) {
      const orgs = data.organizations.organizations || [];
      summaries.push(`🏢 Organizations: ${orgs.length} total`);
    }

    if ((lowerQuestion.includes('satisfaction') || lowerQuestion.includes('csat') || !lowerQuestion) && data.satisfaction_ratings) {
      const ratings = data.satisfaction_ratings.satisfaction_ratings || [];
      const good = ratings.filter(r => r.score === 'good').length;
      const bad = ratings.filter(r => r.score === 'bad').length;
      const rate = ratings.length > 0 ? ((good / ratings.length) * 100).toFixed(1) : '0';
      
      summaries.push(`⭐ Customer Satisfaction:
• Total ratings: ${ratings.length}
• Satisfaction rate: ${rate}%
• Good ratings: ${good}
• Bad ratings: ${bad}`);
    }

    if ((lowerQuestion.includes('trigger') || lowerQuestion.includes('automation') || lowerQuestion.includes('workflow')) && (data.triggers || data.automations)) {
      const triggers = data.triggers?.triggers || [];
      const automations = data.automations?.automations || [];
      const activeTriggers = triggers.filter(t => t.active).length;
      const activeAutomations = automations.filter(a => a.active).length;
      
      summaries.push(`⚙️ Business Rules:
• Triggers: ${triggers.length} total, ${activeTriggers} active
• Automations: ${automations.length} total, ${activeAutomations} active`);
    }

    if (data._metadata) {
      summaries.push(`📊 Data freshness: ${data._metadata.fetchTime} (${data._metadata.successful_apis}/${data._metadata.total_apis} APIs successful)`);
    }

    return summaries.join('\n\n');
  }

  async refreshCache() {
    console.log('🔄 Manual cache refresh requested');
    return await this.fetchAllZendeskData();
  }

  getCacheStatus() {
    return {
      hasCache: !!this.cachedData,
      lastFetchDate: this.lastFetchDate,
      currentDate: this.getCurrentDateString(),
      isStale: this.lastFetchDate !== this.getCurrentDateString(),
      isRefreshing: this.isRefreshing
    };
  }
}

// Export singleton instance
module.exports = new DataCache();