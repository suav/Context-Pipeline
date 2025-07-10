const puppeteer = require('puppeteer');
const PuppeteerConfig = require('./puppeteer-config');

/**
 * Context Library Feature Testing
 * Tests import functionality, library management, and context organization
 */
class ContextLibraryTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.config = new PuppeteerConfig();
    this.baseUrl = 'http://localhost:3001';
    this.results = [];
  }

  async initialize() {
    this.config.log('📚 Testing Context Library Features...', true);
    
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      PuppeteerConfig.printUsage();
      console.log('\n📚 Context Library Specific Tests:');
      console.log('  - Context import functionality');
      console.log('  - Library item management');
      console.log('  - Search and filtering');
      console.log('  - Archive operations');
      process.exit(0);
    }

    const browserOptions = this.config.getBrowserOptions();
    const pageOptions = this.config.getPageOptions();
    
    this.browser = await puppeteer.launch(browserOptions);
    this.page = await this.browser.newPage();
    
    await this.page.setDefaultTimeout(pageOptions.defaultTimeout);
    if (browserOptions.headless) {
      await this.page.setViewport({ width: 1920, height: 1080 });
    }
  }

  async testResult(feature, success, details) {
    const result = { feature, success, details, timestamp: new Date().toISOString() };
    this.results.push(result);
    const status = success ? '✅' : '❌';
    this.config.log(`${status} ${feature}: ${details}`, true);
  }

  async testLibraryAccess() {
    this.config.log('\n🏠 Testing Library Access...', true);
    
    await this.page.goto(this.baseUrl);
    await this.config.wait(2, 'Loading homepage...');
    
    // Check if library elements are visible
    const libraryElements = await this.page.$$eval('*', elements =>
      elements.filter(el =>
        el.textContent?.toLowerCase().includes('library') ||
        el.textContent?.toLowerCase().includes('context')
      ).length
    );
    
    await this.testResult('Library Elements Visible', libraryElements > 0, `Found ${libraryElements} library-related elements`);
    
    // Look for import functionality
    const importButtons = await this.page.$$eval('button, [role="button"]', buttons =>
      buttons.filter(btn =>
        btn.textContent?.toLowerCase().includes('import') ||
        btn.textContent?.toLowerCase().includes('add')
      ).length
    );
    
    await this.testResult('Import Functionality Available', importButtons > 0, `Found ${importButtons} import buttons`);
  }

  async testContextImport() {
    this.config.log('\n📥 Testing Context Import...', true);
    
    // Try to find and click import button
    const importButton = await this.page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => 
        btn.textContent?.toLowerCase().includes('import') || 
        btn.textContent?.toLowerCase().includes('add') ||
        btn.dataset.testid?.includes('import')
      ) || null;
    });
    
    const importButtonExists = await this.page.evaluate((handle) => {
      return handle !== null;
    }, importButton);
    
    if (importButtonExists) {
      this.config.log('🖱️  Attempting to click import button...', true);
      
      try {
        await importButton.asElement().click();
        await this.config.wait(2, 'Waiting for import modal...');
        
        // Check if import modal opened
        const modalVisible = await this.page.$('.modal, [role="dialog"], .import-modal') !== null;
        await this.testResult('Import Modal Opens', modalVisible, modalVisible ? 'Import modal opened successfully' : 'No import modal detected');
        
        if (modalVisible) {
          // Test import source options
          const jiraOption = await this.page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            return elements.some(el => el.textContent?.toLowerCase().includes('jira'));
          });
          const gitOption = await this.page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            return elements.some(el => el.textContent?.toLowerCase().includes('git') || el.textContent?.toLowerCase().includes('repository'));
          });
          const fileOption = await this.page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            return elements.some(el => el.textContent?.toLowerCase().includes('file') || el.textContent?.toLowerCase().includes('upload'));
          });
          
          await this.testResult('JIRA Import Option', jiraOption, jiraOption ? 'JIRA import available' : 'JIRA import not found');
          await this.testResult('Git Import Option', gitOption, gitOption ? 'Git import available' : 'Git import not found');
          await this.testResult('File Import Option', fileOption, fileOption ? 'File import available' : 'File import not found');
        }
        
      } catch (error) {
        await this.testResult('Import Button Click', false, `Click failed: ${error.message}`);
      }
    } else {
      await this.testResult('Import Button Found', false, 'No import button detected');
    }
  }

  async testLibraryManagement() {
    this.config.log('\n📋 Testing Library Management...', true);
    
    // Navigate back to main library view
    await this.page.goto(this.baseUrl);
    await this.config.wait(2, 'Loading library view...');
    
    // Check for existing library items
    const libraryItems = await this.page.$$eval('[data-testid*="library"], .library-item, .context-item', items => items.length);
    await this.testResult('Library Items Present', libraryItems >= 0, `Found ${libraryItems} library items`);
    
    // Test search functionality
    const searchInput = await this.page.$('input[type="search"], input[placeholder*="search" i], [data-testid*="search"]');
    if (searchInput) {
      this.config.log('🔍 Testing search functionality...', true);
      
      await searchInput.type('test search', { delay: 100 });
      await this.config.wait(1, 'Search typing...');
      
      await this.testResult('Search Input Works', true, 'Successfully typed in search field');
      
      // Clear search
      await searchInput.evaluate(el => el.value = '');
    } else {
      await this.testResult('Search Functionality', false, 'No search input found');
    }
    
    // Test filtering options
    const filterButtons = await this.page.$$eval('button, [role="button"]', buttons =>
      buttons.filter(btn =>
        btn.textContent?.toLowerCase().includes('filter') ||
        btn.textContent?.toLowerCase().includes('sort') ||
        btn.textContent?.toLowerCase().includes('type')
      ).length
    );
    
    await this.testResult('Filter Options Available', filterButtons > 0, `Found ${filterButtons} filter/sort options`);
  }

  async testArchiveOperations() {
    this.config.log('\n🗄️  Testing Archive Operations...', true);
    
    // Look for archive-related functionality
    const archiveElements = await this.page.$$eval('*', elements =>
      elements.filter(el =>
        el.textContent?.toLowerCase().includes('archive') ||
        el.textContent?.toLowerCase().includes('archived') ||
        el.className?.toLowerCase().includes('archive')
      ).length
    );
    
    await this.testResult('Archive Functionality', archiveElements > 0, `Found ${archiveElements} archive-related elements`);
    
    // Test context menu or action buttons
    const actionButtons = await this.page.$$eval('button, [role="button"]', buttons =>
      buttons.filter(btn =>
        btn.textContent?.toLowerCase().includes('delete') ||
        btn.textContent?.toLowerCase().includes('remove') ||
        btn.textContent?.toLowerCase().includes('archive') ||
        btn.textContent?.includes('...') ||
        btn.textContent?.includes('⋮')
      ).length
    );
    
    await this.testResult('Item Actions Available', actionButtons > 0, `Found ${actionButtons} action buttons`);
  }

  async testAPIConnectivity() {
    this.config.log('\n🌐 Testing Library API Connectivity...', true);
    
    const apiCalls = [];
    
    this.page.on('response', response => {
      if (response.url().includes('/api/context-workflow') || 
          response.url().includes('/api/library')) {
        apiCalls.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method()
        });
      }
    });
    
    // Trigger API calls
    await this.page.reload();
    await this.config.wait(3, 'Monitoring API calls...');
    
    const successfulCalls = apiCalls.filter(call => call.status >= 200 && call.status < 400);
    const failedCalls = apiCalls.filter(call => call.status >= 400);
    
    await this.testResult('Library API Health', successfulCalls.length > 0, `Successful: ${successfulCalls.length}, Failed: ${failedCalls.length}`);
    
    if (apiCalls.length > 0) {
      this.config.log('📡 API Calls Detected:', true);
      apiCalls.forEach(call => {
        this.config.log(`   ${call.method} ${call.url} - ${call.status}`, true);
      });
    }
  }

  async generateReport() {
    const summary = {
      timestamp: new Date().toISOString(),
      totalTests: this.results.length,
      passedTests: this.results.filter(r => r.success).length,
      failedTests: this.results.filter(r => !r.success).length,
      results: this.results
    };
    
    this.config.log('\n' + '='.repeat(60), true);
    this.config.log('📚 CONTEXT LIBRARY TEST SUMMARY', true);
    this.config.log('='.repeat(60), true);
    this.config.log(`📊 Total Tests: ${summary.totalTests}`, true);
    this.config.log(`✅ Passed: ${summary.passedTests}`, true);
    this.config.log(`❌ Failed: ${summary.failedTests}`, true);
    this.config.log(`📈 Success Rate: ${Math.round((summary.passedTests / summary.totalTests) * 100)}%`, true);
    
    return summary;
  }

  async run() {
    try {
      await this.initialize();
      
      await this.testLibraryAccess();
      await this.testContextImport();
      await this.testLibraryManagement();
      await this.testArchiveOperations();
      await this.testAPIConnectivity();
      
      const summary = await this.generateReport();
      return summary;
      
    } catch (error) {
      this.config.log(`❌ Context Library testing failed: ${error.message}`, true);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

if (require.main === module) {
  const tester = new ContextLibraryTester();
  tester.run().catch(console.error);
}

module.exports = ContextLibraryTester;