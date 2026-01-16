const puppeteer = require('puppeteer');
const supabaseService = require('../config/supabaseClient');

class AccentureScraper {
  constructor() {
    this.companyName = 'Accenture';
    this.baseUrl = 'https://careers.accenture.com';
    this.searchUrls = [
      'https://careers.accenture.com/in-en/search-results?c=Campus&amp;',
      'https://careers.accenture.com/in-en/search-results?c=Entry%20Level&amp;'
    ];
  }

  async scrape() {
    let browser;
    try {
      console.log(`[${this.companyName}] Starting scrape...`);
      
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
        timeout: 30000
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      const allDrives = [];
      
      for (const url of this.searchUrls) {
        try {
          console.log(`[${this.companyName}] Scraping: ${url}`);
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
          
          // Wait for job listings to load
          await page.waitForSelector('.job-tile, .search-result-item, .job-listing', { timeout: 10000 });
          
          // Extract job listings
          const drives = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.job-tile, .search-result-item, .job-listing');
            const drives = [];
            
            jobElements.forEach(element => {
              try {
                const titleElement = element.querySelector('h3 a, .job-title a, [data-automation-id="jobTitle"] a');
                const linkElement = element.querySelector('a');
                const locationElement = element.querySelector('.location, .job-location, [data-automation-id="locations"]');
                const postedElement = element.querySelector('.posted-date, .date-posted, .job-posted-date');
                
                if (!titleElement || !linkElement) {return;}
                
                const title = titleElement.textContent?.trim();
                const link = linkElement.href;
                const location = locationElement?.textContent?.trim() || '';
                const posted = postedElement?.textContent?.trim() || '';
                
                if (!title || !link) {return;}
                
                // Filter for entry-level/campus roles
                const isRelevant = /fresher|entry|graduate|campus|trainee|associate|intern/i.test(title) ||
                                 /fresher|entry|graduate|campus|trainee|associate|intern/i.test(location);
                
                if (isRelevant) {
                  drives.push({
                    title,
                    link: link.startsWith('http') ? link : `https://careers.accenture.com${link}`,
                    location,
                    posted,
                    scraped_from: window.location.href
                  });
                }
              } catch (error) {
                console.log('Error parsing job element:', error);
              }
            });
            
            return drives;
          }, this.companyName);
          
          allDrives.push(...drives);
          console.log(`[${this.companyName}] Found ${drives.length} potential drives from ${url}`);
          
          // Add delay between requests
          await page.waitForTimeout(2000);
          
        } catch (error) {
          console.error(`[${this.companyName}] Error scraping ${url}:`, error.message);
        }
      }
      
      // Process and normalize the drives
      const normalizedDrives = await this.normalizeDrives(allDrives);
      console.log(`[${this.companyName}] Normalized ${normalizedDrives.length} drives`);
      
      return normalizedDrives;
      
    } catch (error) {
      console.error(`[${this.companyName}] Scraping failed:`, error);
      
return [];
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async normalizeDrives(rawDrives) {
    const company = await supabaseService.getCompanyByName(this.companyName);
    if (!company) {
      console.error(`Company ${this.companyName} not found in database`);
      
return [];
    }

    const normalizedDrives = [];
    
    for (const drive of rawDrives) {
      try {
        // Determine drive type based on title and location
        let driveType = 'off-campus';
        if (/campus|on-campus/i.test(drive.title) || /campus|on-campus/i.test(drive.location)) {
          driveType = 'on-campus';
        } else if (/virtual|remote|online/i.test(drive.title) || /virtual|remote|online/i.test(drive.location)) {
          driveType = 'virtual';
        }

        // Extract batch information
        let batch = '2024'; // Default batch
        const batchMatch = drive.title.match(/20\d{2}/);
        if (batchMatch) {
          batch = batchMatch[0];
        }

        // Determine minimum CGPA (Accenture typically requires 60% which is ~6.0 CGPA)
        const minCgpa = 6.0;

        // Common branches for Accenture
        const branches = [
          'Computer Science Engineering',
          'Information Technology', 
          'Electronics and Communication',
          'Electrical Engineering',
          'Mechanical Engineering',
          'Civil Engineering'
        ];

        // Set deadline (if not found, set to 30 days from now)
        let deadline = new Date();
        deadline.setDate(deadline.getDate() + 30);
        
        // Try to extract deadline from posted date
        if (drive.posted) {
          const dateMatch = drive.posted.match(/(\d{1,2})[\s\-\/](\d{1,2})[\s\-\/](\d{4})/);
          if (dateMatch) {
            deadline = new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`);
            if (deadline < new Date()) {
              deadline = new Date();
              deadline.setDate(deadline.getDate() + 30);
            }
          }
        }

        const normalizedDrive = {
          company_id: company.id,
          role: drive.title,
          drive_type: driveType,
          batch: batch,
          min_cgpa: minCgpa,
          branches: branches,
          deadline: deadline.toISOString(),
          registration_link: drive.link,
          source_url: drive.scraped_from
        };

        // Validate required fields
        if (this.validateDrive(normalizedDrive)) {
          normalizedDrives.push(normalizedDrive);
        }

      } catch (error) {
        console.error(`[${this.companyName}] Error normalizing drive:`, error);
      }
    }

    return normalizedDrives;
  }

  validateDrive(drive) {
    // Check required fields
    const requiredFields = ['role', 'registration_link', 'deadline'];
    for (const field of requiredFields) {
      if (!drive[field]) {
        console.log(`[${this.companyName}] Drive validation failed: missing ${field}`);
        
return false;
      }
    }

    // Validate URL
    try {
      new URL(drive.registration_link);
    } catch {
      console.log(`[${this.companyName}] Drive validation failed: invalid registration link`);
      
return false;
    }

    // Validate deadline
    if (new Date(drive.deadline) < new Date()) {
      console.log(`[${this.companyName}] Drive validation failed: deadline in past`);
      
return false;
    }

    return true;
  }
}

module.exports = AccentureScraper;
