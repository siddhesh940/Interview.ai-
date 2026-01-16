const cron = require('node-cron');
const supabaseService = require('../config/supabaseClient');
const notificationService = require('../services/notification.service');
const demoService = require('../services/demo.service');

// Import all scrapers
const AccentureScraper = require('../scrapers/accenture.scraper');
const TcsScraper = require('../scrapers/tcs.scraper');
const CapgeminiScraper = require('../scrapers/capgemini.scraper');
const WiproScraper = require('../scrapers/wipro.scraper');
const CognizantScraper = require('../scrapers/cognizant.scraper');
const InfosysScraper = require('../scrapers/infosys.scraper');

class PlacementDriveScheduler {
  constructor() {
    this.scrapers = [
      new AccentureScraper(),
      new TcsScraper(),
      new CapgeminiScraper(),
      new WiproScraper(),
      new CognizantScraper(),
      new InfosysScraper()
    ];
    
    this.isRunning = false;
    this.lastRun = null;
    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      totalDrivesScraped: 0,
      totalDrivesInserted: 0,
      errors: []
    };
  }

  init() {
    console.log('🚀 Initializing Placement Drive Scheduler...');
    
    // Initialize demo data on startup
    this.initializeDemoMode();
    
    // Schedule scraping every 12 hours at 6 AM and 6 PM
    cron.schedule('0 6,18 * * *', async () => {
      await this.runScrapingJob();
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });
    
    // Cleanup old drives daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      await this.cleanupOldDrives();
      await demoService.cleanupDummyData(); // Safety cleanup
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });
    
    // Run immediately on startup (optional - for testing)
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔧 Development mode: Running initial scrape in 30 seconds...');
      setTimeout(async () => {
        await this.runScrapingJob();
      }, 30000);
    }
    
    console.log('⏰ Scheduler initialized. Next run scheduled for 6 AM/6 PM IST');
  }

  /**
   * Initialize demo mode on startup
   * Creates demo data if no real drives exist
   */
  async initializeDemoMode() {
    console.log('\n📋 Checking demo mode status...');
    
    try {
      const status = await demoService.getStatus();
      console.log(`   Mode: ${status.mode}`);
      console.log(`   Real drives: ${status.drives.real}`);
      console.log(`   Dummy drives: ${status.drives.dummy}`);
      
      if (status.mode === 'DEMO' && status.drives.dummy === 0) {
        console.log('   Initializing demo data...');
        await demoService.initializeDemoData();
      }
    } catch (error) {
      console.error('   Error initializing demo mode:', error.message);
    }
  }

  async runScrapingJob() {
    if (this.isRunning) {
      console.log('⚠️  Scraping job already running, skipping...');
      
return;
    }

    this.isRunning = true;
    this.stats.totalRuns++;
    const startTime = Date.now();
    
    console.log(`\n🕷️  Starting placement drive scraping job at ${new Date().toISOString()}`);
    
    try {
      const results = await this.scrapeAllCompanies();
      await this.processScrapingResults(results);
      
      this.stats.successfulRuns++;
      this.lastRun = new Date();
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(`✅ Scraping job completed successfully in ${duration}s`);
      
    } catch (error) {
      console.error('❌ Scraping job failed:', error);
      this.stats.errors.push({
        timestamp: new Date(),
        error: error.message,
        stack: error.stack
      });
      
      // Keep only last 10 errors
      if (this.stats.errors.length > 10) {
        this.stats.errors = this.stats.errors.slice(-10);
      }
    } finally {
      this.isRunning = false;
    }
  }

  async scrapeAllCompanies() {
    console.log(`🎯 Scraping ${this.scrapers.length} companies...`);
    
    const results = [];
    
    for (const scraper of this.scrapers) {
      try {
        console.log(`\n🔍 Scraping ${scraper.companyName}...`);
        const drives = await scraper.scrape();
        
        results.push({
          company: scraper.companyName,
          success: true,
          drives,
          count: drives.length
        });
        
        console.log(`✅ ${scraper.companyName}: ${drives.length} drives found`);
        
        // Add delay between company scrapes to be respectful
        await this.delay(5000); // 5 second delay
        
      } catch (error) {
        console.error(`❌ ${scraper.companyName} scraping failed:`, error.message);
        
        results.push({
          company: scraper.companyName,
          success: false,
          error: error.message,
          drives: [],
          count: 0
        });
      }
    }
    
    return results;
  }

  async processScrapingResults(results) {
    console.log('\n📊 Processing scraping results...');
    
    let totalNewDrives = 0;
    let totalDuplicates = 0;
    const newDrivesWithDetails = [];
    
    // Count total real drives scraped
    const totalRealDrivesScraped = results.reduce((sum, r) => r.success ? sum + r.count : sum, 0);
    
    // CRITICAL: If we have real drives, switch from DEMO to LIVE mode
    if (totalRealDrivesScraped > 0) {
      const isDemo = await demoService.isDemoMode();
      if (isDemo) {
        console.log('\n🔄 Real drives detected! Switching to LIVE mode...');
        await demoService.switchToLiveMode(results.flatMap(r => r.drives));
      }
    }
    
    for (const result of results) {
      if (result.success && result.drives.length > 0) {
        try {
          console.log(`💾 Inserting ${result.drives.length} drives for ${result.company}...`);
          
          // Mark all scraped drives as NOT dummy (real data)
          const drivesWithFlag = result.drives.map(d => ({
            ...d,
            is_dummy: false
          }));
          
          const insertResult = await supabaseService.insertDrives(drivesWithFlag);
          
          totalNewDrives += insertResult.inserted;
          totalDuplicates += insertResult.duplicates;
          
          // Get the inserted drives with full details for notifications
          if (insertResult.inserted > 0) {
            const { data: insertedDrives } = await supabaseService.getClient()
              .from('drives')
              .select(`
                *,
                companies (
                  name,
                  logo_url
                )
              `)
              .in('id', result.drives.map(d => d.id))
              .gte('created_at', new Date(Date.now() - 60000).toISOString()); // Last minute
            
            if (insertedDrives) {
              newDrivesWithDetails.push(...insertedDrives);
            }
          }
          
          console.log(`✅ ${result.company}: ${insertResult.inserted} new, ${insertResult.duplicates} duplicates`);
          
        } catch (error) {
          console.error(`❌ Error inserting drives for ${result.company}:`, error);
        }
      }
    }
    
    this.stats.totalDrivesScraped += results.reduce((sum, r) => sum + r.count, 0);
    this.stats.totalDrivesInserted += totalNewDrives;
    
    console.log(`\n📈 Summary:`);
    console.log(`   • Total drives scraped: ${results.reduce((sum, r) => sum + r.count, 0)}`);
    console.log(`   • New drives inserted: ${totalNewDrives}`);
    console.log(`   • Duplicates skipped: ${totalDuplicates}`);
    console.log(`   • Companies processed: ${results.filter(r => r.success).length}/${results.length}`);
    
    // Create notifications for new drives
    if (newDrivesWithDetails.length > 0) {
      console.log(`\n🔔 Creating notifications for ${newDrivesWithDetails.length} new drives...`);
      const notificationResult = await notificationService.createNotificationsForNewDrives(newDrivesWithDetails);
      
      if (notificationResult.success) {
        console.log(`✅ Created ${notificationResult.notificationsCreated} notifications for ${notificationResult.usersNotified} users`);
      } else {
        console.error('❌ Failed to create notifications:', notificationResult.error);
      }
    }
  }

  async cleanupOldDrives() {
    console.log('\n🧹 Cleaning up old drives...');
    
    try {
      const cleanupResult = await supabaseService.cleanupOldDrives(30); // 30 days old
      console.log(`✅ Cleaned up ${cleanupResult?.length || 0} old drives`);
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  async runManualScrape(companyName = null) {
    console.log(`\n🔧 Running manual scrape${companyName ? ` for ${companyName}` : ''}...`);
    
    if (companyName) {
      const scraper = this.scrapers.find(s => s.companyName.toLowerCase() === companyName.toLowerCase());
      if (!scraper) {
        throw new Error(`Company '${companyName}' not found`);
      }
      
      const drives = await scraper.scrape();
      const result = await supabaseService.insertDrives(drives);
      
      return {
        company: companyName,
        scraped: drives.length,
        inserted: result.inserted,
        duplicates: result.duplicates
      };
    } else {
      return this.runScrapingJob();
    }
  }

  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextRun: this.getNextScheduledRun()
    };
  }

  getNextScheduledRun() {
    const now = new Date();
    const today6AM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0);
    const today6PM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
    const tomorrow6AM = new Date(today6AM.getTime() + 24 * 60 * 60 * 1000);
    
    if (now < today6AM) {
      return today6AM;
    } else if (now < today6PM) {
      return today6PM;
    } else {
      return tomorrow6AM;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new PlacementDriveScheduler();
