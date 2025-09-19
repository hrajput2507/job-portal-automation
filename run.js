#!/usr/bin/env node

/**
 * Simple JavaScript version for quick execution
 * This is a simplified version that can run without TypeScript compilation
 */

const { chromium } = require('playwright');

class InstahyreAutoApply {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = [];
    this.appliedCount = 0;
    this.failedCount = 0;
  }

  async initialize() {
    console.log('🚀 Initializing Instahyre Auto Apply Bot...');
    
    this.browser = await chromium.launch({
      headless: false, // Set to true if you want to run in background
      slowMo: 1000, // Slow down actions for better reliability
    });

    this.page = await this.browser.newPage();
    
    // Set user agent to avoid detection
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set viewport
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    
    console.log('✅ Browser initialized successfully');
  }

  async navigateToJobsPage() {
    if (!this.page) throw new Error('Page not initialized');
    
    console.log('🌐 Navigating to Instahyre jobs page...');
    await this.page.goto('https://www.instahyre.com/candidate/opportunities/?matching=true', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    // Wait for page to load
    await this.page.waitForTimeout(3000);
    console.log('✅ Successfully navigated to jobs page');
  }

  async waitForLogin() {
    if (!this.page) throw new Error('Page not initialized');
    
    console.log('🔐 Please log in to your Instahyre account manually...');
    console.log('⏳ Waiting for you to complete login...');
    
    // Wait for the page to show logged-in state
    try {
      await this.page.waitForSelector('.job-card, .opportunity-card, [data-testid="job-card"]', { 
        timeout: 300000 // 5 minutes timeout
      });
      console.log('✅ Login detected! Proceeding with job applications...');
    } catch (error) {
      console.log('⚠️ Login timeout. Please ensure you are logged in and try again.');
      throw new Error('Login timeout - please log in manually and run the script again');
    }
  }

  async findAndApplyToJobs() {
    if (!this.page) throw new Error('Page not initialized');
    
    console.log('🔍 Searching for available jobs...');
    
    let hasMoreJobs = true;
    let pageNumber = 1;
    
    while (hasMoreJobs) {
      console.log(`📄 Processing page ${pageNumber}...`);
      
      // Wait for jobs to load
      await this.page.waitForTimeout(2000);
      
      // Find all job cards/opportunities
      let jobCards = await this.page.$$('.job-card, .opportunity-card, [data-testid="job-card"], .job-item');
      
      if (jobCards.length === 0) {
        console.log('❌ No job cards found. Trying alternative selectors...');
        
        // Try alternative selectors
        jobCards = await this.page.$$('.card, .job, .opportunity, [class*="job"], [class*="opportunity"]');
        if (jobCards.length === 0) {
          console.log('⚠️ No jobs found on this page. Moving to next page or stopping...');
          hasMoreJobs = await this.tryNextPage();
          pageNumber++;
          continue;
        }
      }
      
      // Process each job card
      for (let i = 0; i < jobCards.length; i++) {
        try {
          await this.applyToJob(jobCards[i], i + 1);
          await this.page.waitForTimeout(2000); // Wait between applications
        } catch (error) {
          console.error(`❌ Error applying to job ${i + 1}:`, error);
          this.failedCount++;
        }
      }
      
      // Try to go to next page
      hasMoreJobs = await this.tryNextPage();
      pageNumber++;
      
      if (pageNumber > 10) { // Safety limit
        console.log('🛑 Reached maximum page limit (10). Stopping...');
        break;
      }
    }
  }

  async applyToJob(jobCard, jobIndex) {
    if (!this.page) throw new Error('Page not initialized');
    
    try {
      // Get job title for logging
      let jobTitle = 'Unknown Job';
      let companyName = 'Unknown Company';
      
      try {
        const titleElement = await jobCard.$('h3, h4, .job-title, .title, [class*="title"]');
        if (titleElement) {
          jobTitle = await titleElement.textContent() || 'Unknown Job';
          jobTitle = jobTitle.trim();
        }
      } catch (e) {
        // Ignore error
      }
      
      try {
        const companyElement = await jobCard.$('.company, .company-name, [class*="company"]');
        if (companyElement) {
          companyName = await companyElement.textContent() || 'Unknown Company';
          companyName = companyName.trim();
        }
      } catch (e) {
        // Ignore error
      }
      
      console.log(`🎯 Applying to: ${jobTitle} at ${companyName}`);
      
      // Look for apply button within the job card
      const applyButton = await jobCard.$('button:has-text("Apply"), button:has-text("Interested"), .apply-btn, .btn-apply, [class*="apply"]');
      
      if (!applyButton) {
        console.log(`⚠️ No apply button found for job: ${jobTitle}`);
        this.results.push({
          success: false,
          jobTitle,
          companyName,
          error: 'No apply button found',
          timestamp: new Date()
        });
        return;
      }
      
      // Click the apply button
      await applyButton.click();
      console.log(`✅ Clicked apply button for: ${jobTitle}`);
      
      // Wait for modal or page to load
      await this.page.waitForTimeout(2000);
      
      // Handle modal if it appears
      await this.handleApplicationModal();
      
      this.appliedCount++;
      this.results.push({
        success: true,
        jobTitle,
        companyName,
        timestamp: new Date()
      });
      
      console.log(`🎉 Successfully applied to: ${jobTitle} at ${companyName}`);
      
    } catch (error) {
      console.error(`❌ Failed to apply to job ${jobIndex}:`, error);
      this.results.push({
        success: false,
        jobTitle: `Job ${jobIndex}`,
        error: error.message || 'Unknown error',
        timestamp: new Date()
      });
      this.failedCount++;
    }
  }

  async handleApplicationModal() {
    if (!this.page) return;
    
    try {
      // Look for common modal patterns
      const modalSelectors = [
        '.modal',
        '.popup',
        '.dialog',
        '[role="dialog"]',
        '.application-modal',
        '.apply-modal'
      ];
      
      for (const selector of modalSelectors) {
        const modal = await this.page.$(selector);
        if (modal) {
          console.log('📋 Application modal detected, handling...');
          
          // Look for submit/confirm button in modal
          const submitButton = await modal.$('button:has-text("Submit"), button:has-text("Apply"), button:has-text("Confirm"), .btn-primary, .submit-btn');
          
          if (submitButton) {
            await submitButton.click();
            console.log('✅ Submitted application in modal');
            await this.page.waitForTimeout(2000);
          }
          
          // Close modal if needed
          const closeButton = await modal.$('button:has-text("Close"), .close, .btn-close, [aria-label="Close"]');
          if (closeButton) {
            await closeButton.click();
            console.log('❌ Closed modal');
          }
          
          break;
        }
      }
    } catch (error) {
      console.log('⚠️ Error handling modal:', error);
    }
  }

  async tryNextPage() {
    if (!this.page) return false;
    
    try {
      // Look for next page button
      const nextButtonSelectors = [
        'button:has-text("Next")',
        'a:has-text("Next")',
        '.next',
        '.pagination-next',
        '[aria-label="Next"]',
        '.page-next'
      ];
      
      for (const selector of nextButtonSelectors) {
        const nextButton = await this.page.$(selector);
        if (nextButton && await nextButton.isEnabled()) {
          await nextButton.click();
          console.log('➡️ Navigated to next page');
          await this.page.waitForTimeout(3000);
          return true;
        }
      }
      
      console.log('📄 No more pages found');
      return false;
    } catch (error) {
      console.log('⚠️ Error navigating to next page:', error);
      return false;
    }
  }

  async generateReport() {
    console.log('\n📊 APPLICATION REPORT');
    console.log('='.repeat(50));
    console.log(`✅ Total Applications: ${this.appliedCount}`);
    console.log(`❌ Failed Applications: ${this.failedCount}`);
    console.log(`📈 Success Rate: ${this.appliedCount > 0 ? ((this.appliedCount / (this.appliedCount + this.failedCount)) * 100).toFixed(1) : 0}%`);
    
    console.log('\n📋 DETAILED RESULTS:');
    this.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const jobInfo = result.jobTitle ? `${result.jobTitle} at ${result.companyName}` : 'Unknown Job';
      console.log(`${index + 1}. ${status} ${jobInfo}`);
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log('\n🎉 Auto-apply process completed!');
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      console.log('🧹 Browser closed');
    }
  }

  async run() {
    try {
      await this.initialize();
      await this.navigateToJobsPage();
      await this.waitForLogin();
      await this.findAndApplyToJobs();
      await this.generateReport();
    } catch (error) {
      console.error('💥 Fatal error:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// Main execution
async function main() {
  console.log('🎯 Instahyre Auto Apply Bot Starting...');
  console.log('📝 Make sure you are logged in to Instahyre before running this script');
  console.log('⏰ The script will wait for you to complete login if needed\n');
  
  const bot = new InstahyreAutoApply();
  await bot.run();
}

// Run the script
main().catch(console.error);
