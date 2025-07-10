const puppeteer = require('puppeteer');
const PuppeteerConfig = require('./puppeteer-config');

/**
 * Simple Functionality Test
 * Basic test to verify the application loads and key features are accessible
 */
class SimpleFunctionalityTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.config = new PuppeteerConfig();
    this.baseUrl = 'http://localhost:3001';
    this.results = [];
  }

  async initialize() {
    this.config.log('🚀 Testing Basic Application Functionality...', true);
    
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

  async testApplicationLoad() {
    this.config.log('\n🌐 Testing Application Load...', true);
    
    try {
      await this.page.goto(this.baseUrl);
      await this.config.wait(3, 'Waiting for page load...');
      
      const title = await this.page.title();
      await this.testResult('Page Load', title.length > 0, `Page title: "${title}"`);
      
      const bodyText = await this.page.evaluate(() => document.body.textContent);
      await this.testResult('Page Content', bodyText.length > 0, `Page has ${bodyText.length} characters of content`);
      
    } catch (error) {
      await this.testResult('Application Load', false, `Failed to load: ${error.message}`);
    }
  }

  async testBasicElements() {
    this.config.log('\n🎯 Testing Basic Elements...', true);
    
    const buttonCount = await this.page.$$eval('button', buttons => buttons.length);
    await this.testResult('Buttons Present', buttonCount > 0, `Found ${buttonCount} buttons`);
    
    const divCount = await this.page.$$eval('div', divs => divs.length);
    await this.testResult('Layout Elements', divCount > 0, `Found ${divCount} div elements`);
    
    // Test for key application terms
    const hasWorkspace = await this.page.evaluate(() => 
      document.body.textContent.toLowerCase().includes('workspace')
    );
    await this.testResult('Workspace Features', hasWorkspace, hasWorkspace ? 'Workspace functionality detected' : 'No workspace text found');
    
    const hasContext = await this.page.evaluate(() => 
      document.body.textContent.toLowerCase().includes('context')
    );
    await this.testResult('Context Features', hasContext, hasContext ? 'Context functionality detected' : 'No context text found');
    
    const hasAgent = await this.page.evaluate(() => 
      document.body.textContent.toLowerCase().includes('agent') ||
      document.body.textContent.toLowerCase().includes('claude') ||
      document.body.textContent.toLowerCase().includes('gemini')
    );
    await this.testResult('Agent Features', hasAgent, hasAgent ? 'Agent functionality detected' : 'No agent text found');
  }

  async testApiHealth() {
    this.config.log('\n🔧 Testing API Health...', true);
    
    const apiCalls = [];
    
    this.page.on('response', response => {
      if (response.url().includes('/api/')) {
        apiCalls.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method()
        });
      }
    });
    
    await this.page.reload();
    await this.config.wait(3, 'Monitoring API calls...');
    
    const successfulCalls = apiCalls.filter(call => call.status >= 200 && call.status < 400);
    const failedCalls = apiCalls.filter(call => call.status >= 400);
    
    await this.testResult('API Health', successfulCalls.length > 0, 
      `API calls: ${apiCalls.length}, Successful: ${successfulCalls.length}, Failed: ${failedCalls.length}`);
    
    if (apiCalls.length > 0) {
      this.config.log('📡 API Calls Detected:', true);
      apiCalls.forEach(call => {
        this.config.log(`   ${call.method} ${call.url} - ${call.status}`, true);
      });
    }
  }

  async testInteractivity() {
    this.config.log('\n🖱️ Testing Basic Interactivity...', true);
    
    // Test clicking the first button
    const firstButton = await this.page.$('button');
    if (firstButton) {
      try {
        await firstButton.click();
        await this.config.wait(1, 'Button click registered');
        await this.testResult('Button Click', true, 'Successfully clicked first button');
      } catch (error) {
        await this.testResult('Button Click', false, `Click failed: ${error.message}`);
      }
    } else {
      await this.testResult('Button Availability', false, 'No buttons found to test');
    }
    
    // Test scrolling
    try {
      await this.page.evaluate(() => window.scrollTo(0, 100));
      await this.config.wait(0.5, 'Scroll test');
      await this.page.evaluate(() => window.scrollTo(0, 0));
      await this.testResult('Page Scrolling', true, 'Page scrolling works');
    } catch (error) {
      await this.testResult('Page Scrolling', false, `Scrolling failed: ${error.message}`);
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
    this.config.log('🚀 SIMPLE FUNCTIONALITY TEST SUMMARY', true);
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
      
      await this.testApplicationLoad();
      await this.testBasicElements();
      await this.testApiHealth();
      await this.testInteractivity();
      
      const summary = await this.generateReport();
      return summary;
      
    } catch (error) {
      this.config.log(`❌ Simple functionality testing failed: ${error.message}`, true);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

if (require.main === module) {
  const tester = new SimpleFunctionalityTest();
  tester.run().catch(console.error);
}

module.exports = SimpleFunctionalityTest;