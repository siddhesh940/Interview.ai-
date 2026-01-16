const puppeteer = require('puppeteer');
const supabaseService = require('../config/supabaseClient');

class WiproScraper {
  constructor() {
    this.companyName = 'Wipro';
    this.baseUrl = 'https://careers.wipro.com';
    this.searchUrls = [
      'https://careers.wipro.com/careers-search/?experience_level=Entry%20Level',
      'https://careers.wipro.com/careers-search/?keywords=fresher',
      'https://careers.wipro.com/careers-search/?keywords=graduate'
    ];
  }

  async scrape() {
    let browser;
    try {
      console.log(`[${this.companyName}] Starting scrape...`);
      
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        timeout: 30000
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      const allDrives = [];
      
      for (const url of this.searchUrls) {
        try {
          console.log(`[${this.companyName}] Scraping: ${url}`);
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
          
          await page.waitForSelector('.job-listing, .job-item, .career-card, [class*="job"]', { timeout: 10000 });
          
          const drives = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.job-listing, .job-item, .career-card, [class*="job"]');
            const drives = [];
            
            jobElements.forEach(element => {
              try {
                const titleElement = element.querySelector('h3, .job-title, .title, h2, h4');
                const linkElement = element.querySelector('a');
                const locationElement = element.querySelector('.location, .job-location');
                const descElement = element.querySelector('.description, .job-description, p');
                
                if (!titleElement || !linkElement) {return;}
                
                const title = titleElement.textContent?.trim();
                const link = linkElement.href;
                const location = locationElement?.textContent?.trim() || '';
                const description = descElement?.textContent?.trim() || '';
                
                if (!title || !link) {return;}
                
                const isRelevant = /fresher|graduate|entry|trainee|associate|campus|junior|wilp|talent/i.test(title) ||
                                 /fresher|graduate|entry|trainee|associate|campus/i.test(description);
                
                if (isRelevant) {
                  drives.push({
                    title,
                    link: link.startsWith('http') ? link : `https://careers.wipro.com${link}`,
                    location,
                    description,
                    scraped_from: window.location.href
                  });
                }
              } catch (error) {
                console.log('Error parsing job element:', error);
              }
            });
            
            return drives;
          });
          
          allDrives.push(...drives);
          console.log(`[${this.companyName}] Found ${drives.length} potential drives from ${url}`);
          
          await page.waitForTimeout(2000);
          
        } catch (error) {
          console.error(`[${this.companyName}] Error scraping ${url}:`, error.message);
        }
      }
      
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
        let driveType = 'off-campus';
        if (/campus|on-campus/i.test(drive.title + ' ' + drive.description)) {
          driveType = 'on-campus';
        } else if (/virtual|remote|online/i.test(drive.title + ' ' + drive.description)) {
          driveType = 'virtual';
        }

        let batch = '2024';
        const batchMatch = (drive.title + ' ' + drive.description).match(/20\d{2}/);
        if (batchMatch) {
          batch = batchMatch[0];
        }

        // Wipro typically requires 60% (6.0 CGPA)
        const minCgpa = 6.0;

        const branches = [
          'Computer Science Engineering',
          'Information Technology',
          'Electronics and Communication',
          'Electrical Engineering',
          'Mechanical Engineering',
          'Civil Engineering',
          'Electronics and Instrumentation',
          'Instrumentation and Control',
          'Aerospace Engineering',
          'Automobile Engineering'
        ];

        let deadline = new Date();
        deadline.setDate(deadline.getDate() + 20);

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
    const requiredFields = ['role', 'registration_link', 'deadline'];
    for (const field of requiredFields) {
      if (!drive[field]) {
        console.log(`[${this.companyName}] Drive validation failed: missing ${field}`);
        
return false;
      }
    }

    try {
      new URL(drive.registration_link);
    } catch {
      console.log(`[${this.companyName}] Drive validation failed: invalid registration link`);
      
return false;
    }

    if (new Date(drive.deadline) < new Date()) {
      console.log(`[${this.companyName}] Drive validation failed: deadline in past`);
      
return false;
    }

    return true;
  }
}

module.exports = WiproScraper;
