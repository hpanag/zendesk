// Data synchronization script for web dashboard
const fs = require('fs');
const path = require('path');

class DataSync {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.webDataDir = path.join(__dirname, 'assets/data');
    this.targetFile = path.join(this.webDataDir, 'live-feed-latest.json');
  }

  async syncLatestData() {
    try {
      console.log('🔄 Syncing latest data to web dashboard...');
      
      // Ensure web data directory exists
      if (!fs.existsSync(this.webDataDir)) {
        fs.mkdirSync(this.webDataDir, { recursive: true });
      }

      // Find the latest live-feed file
      const files = fs.readdirSync(this.dataDir)
        .filter(file => file.startsWith('live-feed-') && file.endsWith('.json'))
        .sort((a, b) => {
          const aTime = fs.statSync(path.join(this.dataDir, a)).mtime;
          const bTime = fs.statSync(path.join(this.dataDir, b)).mtime;
          return bTime - aTime; // Sort by newest first
        });

      if (files.length === 0) {
        console.log('⚠️  No live-feed files found in data directory');
        return false;
      }

      const latestFile = files[0];
      const sourcePath = path.join(this.dataDir, latestFile);
      
      console.log(`📄 Latest file: ${latestFile}`);
      
      // Read and copy the latest data
      const data = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
      
      // Add web-specific metadata
      const webData = {
        ...data,
        webSync: {
          syncTime: new Date().toISOString(),
          sourceFile: latestFile,
          dashboardVersion: '1.0.0'
        }
      };

      // Write to web data directory
      fs.writeFileSync(this.targetFile, JSON.stringify(webData, null, 2));
      
      console.log(`✅ Data synced successfully to: ${this.targetFile}`);
      console.log(`📊 Synced data: ${data.dailyMetrics?.totalCalls || 0} total calls, ${data.callsInQueue || 0} in queue`);
      
      return true;
      
    } catch (error) {
      console.error('❌ Error syncing data:', error.message);
      return false;
    }
  }

  watchDataDirectory() {
    console.log(`👀 Watching for changes in: ${this.dataDir}`);
    
    fs.watch(this.dataDir, (eventType, filename) => {
      if (filename && filename.startsWith('live-feed-') && filename.endsWith('.json')) {
        console.log(`📄 New live-feed file detected: ${filename}`);
        setTimeout(() => {
          this.syncLatestData();
        }, 1000); // Small delay to ensure file is fully written
      }
    });
  }

  startSync() {
    console.log('🚀 Starting data synchronization service...');
    
    // Initial sync
    this.syncLatestData();
    
    // Watch for changes
    this.watchDataDirectory();
    
    // Periodic sync every 30 seconds (backup)
    setInterval(() => {
      this.syncLatestData();
    }, 30000);
    
    console.log('✅ Data sync service running');
  }
}

// Export for use in other scripts
module.exports = DataSync;

// Run directly if called from command line
if (require.main === module) {
  const dataSync = new DataSync();
  
  if (process.argv[2] === 'watch') {
    dataSync.startSync();
  } else {
    dataSync.syncLatestData();
  }
}