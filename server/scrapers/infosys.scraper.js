const puppeteer = require('puppeteer');
const supabaseService = require('../config/supabaseClient');

class InfosysScraper {
  constructor() {
    this.companyName = 'Infosys';
    this.baseUrl = 'https://careers.infosys.com';
    this.searchUrls = [
      'https://careers.infosys.com/search-jobs/?s=1&rk=l-early-careers',
      'https://careers.infosys.com/search-jobs/?keywords=fresher',
      'https://careers.infosys.com/search-jobs/?keywords=graduate&country=India'
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
          
          await page.waitForSelector('.job-item, .job-result, [class*="job"], .search-result', { timeout: 10000 });
          
          const drives = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.job-item, .job-result, [class*="job"], .search-result, .career-card');
            const drives = [];
            
            jobElements.forEach(element => {
              try {
                const titleElement = element.querySelector('h3, .job-title, .title, h2, h4, a[data-job-title]');
                const linkElement = element.querySelector('a');
                const locationElement = element.querySelector('.location, .job-location, [class*="location"]');
                const descElement = element.querySelector('.description, .job-description, p, .summary');
                
                if (!titleElement || !linkElement) {return;}
                
                const title = titleElement.textContent?.trim() || titleElement.getAttribute('data-job-title')?.trim();
                const link = linkElement.href;
                const location = locationElement?.textContent?.trim() || '';
                const description = descElement?.textContent?.trim() || '';
                
                if (!title || !link) {return;}
                
                const isRelevant = /fresher|graduate|entry|trainee|associate|campus|junior|analyst|specialist|mysore|power programmer|systems engineer/i.test(title) ||
                                 /fresher|graduate|entry|trainee|associate|campus|early career/i.test(description);
                
                if (isRelevant) {
                  drives.push({
                    title,
                    link: link.startsWith('http') ? link : `https://careers.infosys.com${link}`,
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
          
          await page.waitForTimeout(3000);
          
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

        // Infosys typically requires 65% (6.5 CGPA) with no active backlogs
        const minCgpa = 6.5;

        const branches = [
          'Computer Science Engineering',
          'Information Technology',
          'Electronics and Communication',
          'Electrical Engineering',
          'Mechanical Engineering',
          'Civil Engineering',
          'Electronics and Instrumentation',
          'Instrumentation and Control',
          'Automobile Engineering',
          'Production Engineering',
          'Industrial Engineering',
          'Biotechnology'
        ];

        let deadline = new Date();
        deadline.setDate(deadline.getDate() + 35); // Infosys usually gives longer notice

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

module.exports = InfosysScraper;
