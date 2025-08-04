const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const PuppeteerConfig = require('./puppeteer-config');

class ContextPipelineUIEvaluator {
  constructor() {
    this.browser = null;
    this.page = null;
    this.screenshots = [];
    this.testResults = [];
    this.baseUrl = 'http://localhost:3001';
    this.config = new PuppeteerConfig();
  }

  async initialize() {
    this.config.log('🚀 Starting Context Pipeline UI Feature Evaluation...\n', true);
    
    // Show usage if help requested
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      PuppeteerConfig.printUsage();
      process.exit(0);
    }
    
    const browserOptions = this.config.getBrowserOptions();
    const pageOptions = this.config.getPageOptions();
    
    this.config.log(`🌐 Launching browser in ${browserOptions.headless ? 'headless' : 'headful'} mode...`, true);
    
    this.browser = await puppeteer.launch(browserOptions);
    this.page = await this.browser.newPage();
    
    // Set timeouts based on mode
    await this.page.setDefaultTimeout(pageOptions.defaultTimeout);
    await this.page.setDefaultNavigationTimeout(pageOptions.defaultNavigationTimeout);
    
    if (browserOptions.headless) {
      await this.page.setViewport({ width: 1920, height: 1080 });
    }
    
    // Set up console logging
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`❌ Browser Console Error: ${msg.text()}`);
      }
    });

    // Create results directory
    const resultsDir = path.join(process.cwd(), 'analysis', 'ui-evaluation');
    await fs.mkdir(resultsDir, { recursive: true });
    await fs.mkdir(path.join(resultsDir, 'screenshots'), { recursive: true });
  }

  async screenshot(name, description) {
    const filename = `${String(this.screenshots.length + 1).padStart(2, '0')}-${name}.png`;
    const filepath = path.join('analysis', 'ui-evaluation', 'screenshots', filename);
    
    await this.page.screenshot({ 
      path: filepath, 
      fullPage: true
    });
    
    this.screenshots.push({ filename, description, timestamp: new Date().toISOString() });
    console.log(`📸 Screenshot: ${description}`);
    return filepath;
  }

  async testResult(feature, success, details, screenshot = null) {
    const result = {
      feature,
      success,
      details,
      screenshot,
      timestamp: new Date().toISOString()
    };
    this.testResults.push(result);
    
    const status = success ? '✅' : '❌';
    console.log(`${status} ${feature}: ${details}`);
  }

  async waitForElement(selector, timeout = 10000) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      return false;
    }
  }

  async evaluateHomepage() {
    console.log('🏠 Evaluating Homepage...');
    await this.page.goto(this.baseUrl);
    await this.config.wait(2, 'Waiting for page to fully load...');
    
    const screenshot = await this.screenshot('homepage', 'Homepage Initial Load');
    
    // Check page title
    const title = await this.page.title();
    await this.testResult('Page Title', title === 'Context Pipeline', `Title: "${title}"`, screenshot);
    
    // Check main navigation elements
    const headerExists = await this.page.$('header') !== null;
    await this.testResult('Header Navigation', headerExists, headerExists ? 'Header found' : 'Header not found');
    
    // Check for main content areas
    const mainContent = await this.page.$('main') !== null;
    await this.testResult('Main Content Area', mainContent, mainContent ? 'Main content area found' : 'Main content area not found');
    
    return screenshot;
  }

  async evaluateLibraryView() {
    console.log('📚 Evaluating Context Library...');
    
    // Look for library-related elements
    const libraryElements = await this.page.$$eval('*', elements => 
      elements.filter(el => 
        el.textContent?.toLowerCase().includes('library') ||
        el.textContent?.toLowerCase().includes('context') ||
        el.className?.toLowerCase().includes('library')
      ).length
    );
    
    await this.testResult('Library Elements', libraryElements > 0, `Found ${libraryElements} library-related elements`);
    
    // Check for import functionality
    const importButtons = await this.page.$$eval('button', buttons =>
      buttons.filter(btn => 
        btn.textContent?.toLowerCase().includes('import') ||
        btn.textContent?.toLowerCase().includes('add')
      ).length
    );
    
    await this.testResult('Import Buttons', importButtons > 0, `Found ${importButtons} import-related buttons`);
    
    const screenshot = await this.screenshot('library-view', 'Context Library Interface');
    return screenshot;
  }

  async evaluateWorkspaceFeatures() {
    console.log('🏗️ Evaluating Workspace Features...');
    
    // Check for workspace-related elements
    const workspaceElements = await this.page.$$eval('*', elements =>
      elements.filter(el =>
        el.textContent?.toLowerCase().includes('workspace') ||
        el.className?.toLowerCase().includes('workspace')
      ).length
    );
    
    await this.testResult('Workspace Elements', workspaceElements > 0, `Found ${workspaceElements} workspace-related elements`);
    
    // Look for workspace creation options
    const createButtons = await this.page.$$eval('button', buttons =>
      buttons.filter(btn =>
        btn.textContent?.toLowerCase().includes('create') ||
        btn.textContent?.toLowerCase().includes('new workspace')
      ).length
    );
    
    await this.testResult('Create Workspace Options', createButtons > 0, `Found ${createButtons} workspace creation buttons`);
    
    const screenshot = await this.screenshot('workspace-features', 'Workspace Management Interface');
    return screenshot;
  }

  async evaluateAgentIntegration() {
    console.log('🤖 Evaluating Agent Integration...');
    
    // Check for agent-related UI elements
    const agentElements = await this.page.$$eval('*', elements =>
      elements.filter(el =>
        el.textContent?.toLowerCase().includes('claude') ||
        el.textContent?.toLowerCase().includes('gemini') ||
        el.textContent?.toLowerCase().includes('agent') ||
        el.className?.toLowerCase().includes('agent')
      ).length
    );
    
    await this.testResult('Agent UI Elements', agentElements > 0, `Found ${agentElements} agent-related elements`);
    
    // Look for terminal or chat interfaces
    const terminalElements = await this.page.$$eval('*', elements =>
      elements.filter(el =>
        el.textContent?.toLowerCase().includes('terminal') ||
        el.textContent?.toLowerCase().includes('chat') ||
        el.className?.toLowerCase().includes('terminal') ||
        el.className?.toLowerCase().includes('chat')
      ).length
    );
    
    await this.testResult('Terminal/Chat Interface', terminalElements > 0, `Found ${terminalElements} terminal/chat elements`);
    
    const screenshot = await this.screenshot('agent-integration', 'Agent Integration Interface');
    return screenshot;
  }

  async evaluateUIComponents() {
    console.log('🎨 Evaluating UI Components...');
    
    // Check for form elements
    const inputs = await this.page.$$('input');
    const buttons = await this.page.$$('button');
    const selects = await this.page.$$('select');
    const textareas = await this.page.$$('textarea');
    
    await this.testResult('Form Inputs', inputs.length > 0, `Found ${inputs.length} input fields`);
    await this.testResult('Buttons', buttons.length > 0, `Found ${buttons.length} buttons`);
    await this.testResult('Select Dropdowns', selects.length >= 0, `Found ${selects.length} select elements`);
    await this.testResult('Text Areas', textareas.length >= 0, `Found ${textareas.length} text areas`);
    
    // Check for loading states
    const loadingElements = await this.page.$$eval('*', elements =>
      elements.filter(el =>
        el.textContent?.toLowerCase().includes('loading') ||
        el.className?.toLowerCase().includes('loading') ||
        el.className?.toLowerCase().includes('spinner')
      ).length
    );
    
    await this.testResult('Loading States', loadingElements >= 0, `Found ${loadingElements} loading-related elements`);
    
    const screenshot = await this.screenshot('ui-components', 'UI Components Overview');
    return screenshot;
  }

  async evaluateResponsiveness() {
    console.log('📱 Evaluating Responsive Design...');
    
    // Test different viewport sizes
    const viewports = [
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Mobile', width: 375, height: 667 }
    ];
    
    for (const viewport of viewports) {
      await this.page.setViewport({ width: viewport.width, height: viewport.height });
      await this.config.wait(1, `Adjusting to ${viewport.name} layout...`);
      
      const screenshot = await this.screenshot(
        `responsive-${viewport.name.toLowerCase()}`, 
        `${viewport.name} View (${viewport.width}x${viewport.height})`
      );
      
      // Check if content is still accessible
      const bodyHeight = await this.page.evaluate(() => document.body.scrollHeight);
      const isResponsive = bodyHeight > 0 && bodyHeight < viewport.height * 3; // Reasonable height
      
      await this.testResult(
        `${viewport.name} Responsiveness`, 
        isResponsive, 
        `Content height: ${bodyHeight}px`,
        screenshot
      );
    }
    
    // Reset to desktop
    await this.page.setViewport({ width: 1920, height: 1080 });
  }

  async evaluateAPIConnectivity() {
    console.log('🔌 Evaluating API Connectivity...');
    
    // Monitor network requests
    const responses = [];
    this.page.on('response', response => {
      if (response.url().includes('/api/')) {
        responses.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method()
        });
      }
    });
    
    // Trigger some API calls by refreshing
    await this.page.reload();
    await this.config.wait(3, 'Waiting for API calls to complete...');
    
    const successfulAPIs = responses.filter(r => r.status >= 200 && r.status < 400);
    const failedAPIs = responses.filter(r => r.status >= 400);
    
    await this.testResult(
      'API Connectivity', 
      successfulAPIs.length > 0, 
      `Successful: ${successfulAPIs.length}, Failed: ${failedAPIs.length}`
    );
    
    const screenshot = await this.screenshot('api-connectivity', 'API Response Testing');
    return { responses, screenshot };
  }

  async evaluatePerformance() {
    console.log('⚡ Evaluating Performance...');
    
    const startTime = Date.now();
    await this.page.goto(this.baseUrl, { waitUntil: 'networkidle0' });
    const loadTime = Date.now() - startTime;
    
    await this.testResult(
      'Page Load Performance', 
      loadTime < 5000, 
      `Load time: ${loadTime}ms`
    );
    
    // Check for performance metrics
    const metrics = await this.page.metrics();
    
    await this.testResult(
      'Memory Usage', 
      metrics.JSHeapUsedSize < 50 * 1024 * 1024, // 50MB
      `JS Heap: ${Math.round(metrics.JSHeapUsedSize / 1024 / 1024)}MB`
    );
    
    const screenshot = await this.screenshot('performance', 'Performance Evaluation');
    return { loadTime, metrics, screenshot };
  }

  async generateReport() {
    console.log('\n📊 Generating Comprehensive Report...');
    
    const summary = {
      timestamp: new Date().toISOString(),
      totalTests: this.testResults.length,
      passedTests: this.testResults.filter(r => r.success).length,
      failedTests: this.testResults.filter(r => !r.success).length,
      screenshots: this.screenshots.length,
      testResults: this.testResults,
      screenshots: this.screenshots
    };
    
    // Save JSON report
    const jsonPath = path.join('analysis', 'ui-evaluation', 'evaluation-report.json');
    await fs.writeFile(jsonPath, JSON.stringify(summary, null, 2));
    
    // Generate HTML report
    const htmlReport = `
<!DOCTYPE html>
<html>
<head>
    <title>Context Pipeline UI Evaluation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; }
        .test-result { margin: 10px 0; padding: 15px; border-left: 4px solid #ccc; }
        .success { border-left-color: #10b981; background: #f0fdf4; }
        .failure { border-left-color: #ef4444; background: #fef2f2; }
        .screenshot { max-width: 300px; margin: 10px 0; border: 1px solid #ddd; }
        .screenshots-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Context Pipeline UI Evaluation Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <div style="font-size: 2em; font-weight: bold;">${summary.totalTests}</div>
        </div>
        <div class="metric">
            <h3>Passed</h3>
            <div style="font-size: 2em; font-weight: bold; color: #10b981;">${summary.passedTests}</div>
        </div>
        <div class="metric">
            <h3>Failed</h3>
            <div style="font-size: 2em; font-weight: bold; color: #ef4444;">${summary.failedTests}</div>
        </div>
        <div class="metric">
            <h3>Screenshots</h3>
            <div style="font-size: 2em; font-weight: bold;">${summary.screenshots}</div>
        </div>
    </div>
    
    <h2>📋 Test Results</h2>
    ${this.testResults.map(result => `
        <div class="test-result ${result.success ? 'success' : 'failure'}">
            <h4>${result.success ? '✅' : '❌'} ${result.feature}</h4>
            <p>${result.details}</p>
            <small>Time: ${new Date(result.timestamp).toLocaleTimeString()}</small>
        </div>
    `).join('')}
    
    <h2>📸 Screenshots</h2>
    <div class="screenshots-grid">
    ${this.screenshots.map(screenshot => `
        <div>
            <h4>${screenshot.description}</h4>
            <img src="screenshots/${screenshot.filename}" alt="${screenshot.description}" class="screenshot">
            <p><small>${new Date(screenshot.timestamp).toLocaleTimeString()}</small></p>
        </div>
    `).join('')}
    </div>
</body>
</html>`;
    
    const htmlPath = path.join('analysis', 'ui-evaluation', 'evaluation-report.html');
    await fs.writeFile(htmlPath, htmlReport);
    
    return summary;
  }

  async run() {
    try {
      await this.initialize();
      
      // Run all evaluations
      await this.evaluateHomepage();
      await this.evaluateLibraryView();
      await this.evaluateWorkspaceFeatures();
      await this.evaluateAgentIntegration();
      await this.evaluateUIComponents();
      await this.evaluateResponsiveness();
      await this.evaluateAPIConnectivity();
      await this.evaluatePerformance();
      
      // Generate comprehensive report
      const summary = await this.generateReport();
      
      console.log('\n' + '='.repeat(60));
      console.log('🎯 UI EVALUATION COMPLETE');
      console.log('='.repeat(60));
      console.log(`📊 Tests Run: ${summary.totalTests}`);
      console.log(`✅ Passed: ${summary.passedTests}`);
      console.log(`❌ Failed: ${summary.failedTests}`);
      console.log(`📸 Screenshots: ${summary.screenshots}`);
      console.log(`📁 Results: analysis/ui-evaluation/`);
      console.log(`🌐 Report: analysis/ui-evaluation/evaluation-report.html`);
      
      return summary;
      
    } catch (error) {
      console.error('❌ UI Evaluation failed:', error);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// Run the evaluation
if (require.main === module) {
  const evaluator = new ContextPipelineUIEvaluator();
  evaluator.run().catch(console.error);
}

module.exports = ContextPipelineUIEvaluator;