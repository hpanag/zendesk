// Web Dashboard Integration for LiveFeedAnalyzer
const DataSync = require('./web/sync-data');

class WebDashboardSync {
  constructor() {
    this.dataSync = new DataSync();
  }

  async syncAfterUpdate() {
    try {
      console.log('🌐 Syncing data to web dashboard...');
      const success = await this.dataSync.syncLatestData();
      
      if (success) {
        console.log('✅ Web dashboard data updated');
      } else {
        console.log('⚠️  Web dashboard sync failed');
      }
      
      return success;
    } catch (error) {
      console.error('❌ Web dashboard sync error:', error.message);
      return false;
    }
  }

  startWatchService() {
    console.log('👀 Starting web dashboard sync service...');
    this.dataSync.startSync();
  }
}

module.exports = WebDashboardSync;