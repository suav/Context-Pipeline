const puppeteer = require('puppeteer');
const PuppeteerConfig = require('./puppeteer-config');

class VisualDemo {
  constructor() {
    this.browser = null;
    this.page = null;
    this.config = new PuppeteerConfig();
    this.baseUrl = 'http://localhost:3001';
  }

  async initialize() {
    this.config.log('🎬 Starting Visual Browser Automation Demo...', true);
    
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      PuppeteerConfig.printUsage();
      console.log('\n🎬 Visual Demo Specific Options:');
      console.log('  - Always runs in headful mode for demonstration');
      console.log('  - Use --slow for extra slow demonstration');
      process.exit(0);
    }
    
    // Force headful mode for visual demo, but respect slow mode
    const browserOptions = this.config.getBrowserOptions({
      headless: false,
      defaultViewport: null,
      args: [
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    const pageOptions = this.config.getPageOptions();
    
    this.config.log('📺 Browser will open in visible mode - watch the magic happen!', true);
    
    this.browser = await puppeteer.launch(browserOptions);
    this.page = await this.browser.newPage();
    
    await this.page.setDefaultTimeout(pageOptions.defaultTimeout);
    
    this.config.log('🌐 Browser launched! You should see it on your screen.', true);
  }

  async wait(seconds, message = '') {
    await this.config.wait(seconds, message);
  }

  async demoNavigation() {
    console.log('\n🏠 DEMO 1: Page Navigation and Loading');
    console.log('Watch as we navigate to Context Pipeline...');
    
    await this.page.goto(this.baseUrl);
    await this.wait(3, 'Waiting for page to fully load...');
    
    // Get page title and show it
    const title = await this.page.title();
    console.log(`✅ Page loaded! Title: "${title}"`);
    
    // Scroll down slowly to show content
    console.log('📜 Scrolling to show page content...');
    await this.page.evaluate(() => {
      return new Promise(resolve => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if(totalHeight >= scrollHeight){
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    
    await this.wait(2, 'Scroll complete, returning to top...');
    await this.page.evaluate(() => window.scrollTo(0, 0));
  }

  async demoElementInteraction() {
    console.log('\n🔍 DEMO 2: Element Detection and Interaction');
    console.log('Highlighting buttons and interactive elements...');
    
    // Find and highlight all buttons
    await this.page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      buttons.forEach((button, index) => {
        button.style.border = '3px solid #ff0000';
        button.style.backgroundColor = '#ffff00';
        button.style.transition = 'all 0.5s ease';
        
        // Add a label
        const label = document.createElement('div');
        label.textContent = `BUTTON ${index + 1}`;
        label.style.position = 'absolute';
        label.style.background = 'red';
        label.style.color = 'white';
        label.style.padding = '2px 5px';
        label.style.fontSize = '10px';
        label.style.zIndex = '9999';
        label.style.marginTop = '-20px';
        button.parentNode.insertBefore(label, button);
      });
    });
    
    await this.wait(3, 'Buttons highlighted! Count them on screen...');
    
    // Count and report elements
    const buttonCount = await this.page.$$eval('button', buttons => buttons.length);
    const linkCount = await this.page.$$eval('a', links => links.length);
    const divCount = await this.page.$$eval('div', divs => divs.length);
    
    console.log(`📊 Found ${buttonCount} buttons, ${linkCount} links, ${divCount} divs`);
    
    // Try to click the first button if it exists
    const firstButton = await this.page.$('button');
    if (firstButton) {
      console.log('🖱️  Attempting to click the first button...');
      await firstButton.click();
      await this.wait(2, 'Button clicked!');
    }
  }

  async demoResponsiveDesign() {
    console.log('\n📱 DEMO 3: Responsive Design Testing');
    console.log('Watch as we test different screen sizes...');
    
    const viewports = [
      { name: 'Desktop', width: 1920, height: 1080, emoji: '🖥️' },
      { name: 'Tablet', width: 768, height: 1024, emoji: '📱' },
      { name: 'Large Phone', width: 414, height: 896, emoji: '📱' },
      { name: 'Small Phone', width: 375, height: 667, emoji: '📱' }
    ];
    
    for (const viewport of viewports) {
      console.log(`${viewport.emoji} Testing ${viewport.name} view (${viewport.width}x${viewport.height})`);
      
      await this.page.setViewport({ 
        width: viewport.width, 
        height: viewport.height 
      });
      
      // Add a visual indicator of current viewport
      await this.page.evaluate((viewport) => {
        // Remove any existing indicators
        const existing = document.getElementById('viewport-indicator');
        if (existing) existing.remove();
        
        const indicator = document.createElement('div');
        indicator.id = 'viewport-indicator';
        indicator.innerHTML = `${viewport.emoji} ${viewport.name}<br>${viewport.width}x${viewport.height}`;
        indicator.style.position = 'fixed';
        indicator.style.top = '10px';
        indicator.style.right = '10px';
        indicator.style.background = 'rgba(0,0,0,0.8)';
        indicator.style.color = 'white';
        indicator.style.padding = '10px';
        indicator.style.borderRadius = '5px';
        indicator.style.zIndex = '10000';
        indicator.style.fontSize = '14px';
        indicator.style.textAlign = 'center';
        indicator.style.fontFamily = 'Arial, sans-serif';
        document.body.appendChild(indicator);
      }, viewport);
      
      await this.wait(3, `Showing ${viewport.name} layout...`);
    }
    
    // Return to desktop view
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.evaluate(() => {
      const indicator = document.getElementById('viewport-indicator');
      if (indicator) indicator.remove();
    });
  }

  async demoFormInteraction() {
    console.log('\n📝 DEMO 4: Form and Input Testing');
    console.log('Looking for forms and input fields...');
    
    // Highlight any input fields
    await this.page.evaluate(() => {
      const inputs = document.querySelectorAll('input, textarea, select');
      inputs.forEach((input, index) => {
        input.style.border = '3px solid #00ff00';
        input.style.backgroundColor = '#e6ffe6';
        
        const label = document.createElement('div');
        label.textContent = `INPUT ${index + 1}`;
        label.style.position = 'absolute';
        label.style.background = 'green';
        label.style.color = 'white';
        label.style.padding = '2px 5px';
        label.style.fontSize = '10px';
        label.style.zIndex = '9999';
        label.style.marginTop = '-20px';
        input.parentNode.insertBefore(label, input);
      });
    });
    
    const inputCount = await this.page.$$eval('input', inputs => inputs.length);
    const textareaCount = await this.page.$$eval('textarea', textareas => textareas.length);
    const selectCount = await this.page.$$eval('select', selects => selects.length);
    
    console.log(`📊 Found ${inputCount} inputs, ${textareaCount} textareas, ${selectCount} selects`);
    
    await this.wait(3, 'Form elements highlighted!');
    
    // Try to type in the first input if it exists
    const firstInput = await this.page.$('input[type="text"], input:not([type]), textarea');
    if (firstInput) {
      console.log('⌨️  Typing in the first input field...');
      await firstInput.click();
      await firstInput.type('Hello from Puppeteer!', { delay: 100 });
      await this.wait(2, 'Text entered!');
    }
  }

  async demoNetworkMonitoring() {
    console.log('\n🌐 DEMO 5: Network Request Monitoring');
    console.log('Monitoring API calls as we refresh the page...');
    
    const requests = [];
    const responses = [];
    
    this.page.on('request', request => {
      if (request.url().includes('/api/')) {
        requests.push({
          method: request.method(),
          url: request.url(),
          timestamp: new Date().toISOString()
        });
        console.log(`📤 API Request: ${request.method()} ${request.url()}`);
      }
    });
    
    this.page.on('response', response => {
      if (response.url().includes('/api/')) {
        responses.push({
          status: response.status(),
          url: response.url(),
          timestamp: new Date().toISOString()
        });
        console.log(`📥 API Response: ${response.status()} ${response.url()}`);
      }
    });
    
    console.log('🔄 Refreshing page to trigger API calls...');
    await this.page.reload();
    await this.wait(3, 'Waiting for all API calls to complete...');
    
    console.log(`📊 Captured ${requests.length} API requests and ${responses.length} responses`);
  }

  async demoScreenshots() {
    console.log('\n📸 DEMO 6: Automated Screenshot Capture');
    console.log('Taking screenshots of different parts of the page...');
    
    // Take a full page screenshot
    console.log('📷 Taking full page screenshot...');
    await this.page.screenshot({ 
      path: 'analysis/visual-demo-fullpage.png', 
      fullPage: true 
    });
    
    // Take viewport screenshot
    console.log('📷 Taking viewport screenshot...');
    await this.page.screenshot({ 
      path: 'analysis/visual-demo-viewport.png' 
    });
    
    // Add a visual indicator that screenshots were taken
    await this.page.evaluate(() => {
      const flash = document.createElement('div');
      flash.style.position = 'fixed';
      flash.style.top = '0';
      flash.style.left = '0';
      flash.style.width = '100%';
      flash.style.height = '100%';
      flash.style.backgroundColor = 'white';
      flash.style.opacity = '0.8';
      flash.style.zIndex = '99999';
      flash.style.pointerEvents = 'none';
      document.body.appendChild(flash);
      
      setTimeout(() => {
        flash.remove();
      }, 200);
    });
    
    await this.wait(1, 'Screenshots saved!');
  }

  async demoComplete() {
    console.log('\n🎉 DEMO 7: Performance and Completion');
    console.log('Measuring final performance metrics...');
    
    const metrics = await this.page.metrics();
    const performanceData = await this.page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        elements: document.querySelectorAll('*').length,
        scripts: document.querySelectorAll('script').length,
        styles: document.querySelectorAll('link[rel="stylesheet"], style').length,
        images: document.querySelectorAll('img').length
      };
    });
    
    console.log('\n📊 Final Performance Report:');
    console.log(`🌐 URL: ${performanceData.url}`);
    console.log(`📄 Title: ${performanceData.title}`);
    console.log(`🏗️  Total Elements: ${performanceData.elements}`);
    console.log(`📜 Scripts: ${performanceData.scripts}`);
    console.log(`🎨 Stylesheets: ${performanceData.styles}`);
    console.log(`🖼️  Images: ${performanceData.images}`);
    console.log(`🧠 JS Heap Used: ${Math.round(metrics.JSHeapUsedSize / 1024 / 1024)}MB`);
    console.log(`⚡ JS Event Listeners: ${metrics.JSEventListeners}`);
    
    await this.wait(3, 'Performance analysis complete!');
  }

  async run() {
    try {
      await this.initialize();
      
      console.log('\n🎬 Starting Visual Browser Automation Demos...');
      console.log('Watch your browser window to see the automation in action!\n');
      
      await this.demoNavigation();
      await this.demoElementInteraction();
      await this.demoResponsiveDesign();
      await this.demoFormInteraction();
      await this.demoNetworkMonitoring();
      await this.demoScreenshots();
      await this.demoComplete();
      
      console.log('\n' + '='.repeat(60));
      console.log('🎉 VISUAL DEMO COMPLETE!');
      console.log('='.repeat(60));
      console.log('🎬 You just witnessed browser automation in action!');
      console.log('📸 Screenshots saved to analysis/');
      console.log('🤖 Puppeteer demonstrated:');
      console.log('   ✅ Page navigation and loading');
      console.log('   ✅ Element detection and highlighting');
      console.log('   ✅ Responsive design testing');
      console.log('   ✅ Form interaction simulation');
      console.log('   ✅ Network request monitoring');
      console.log('   ✅ Automated screenshot capture');
      console.log('   ✅ Performance metrics collection');
      console.log('\n🚀 Browser automation is fully operational!');
      
      await this.wait(5, 'Keeping browser open for 5 more seconds...');
      
    } catch (error) {
      console.error('❌ Visual demo failed:', error);
      throw error;
    } finally {
      if (this.browser) {
        console.log('🔒 Closing browser...');
        await this.browser.close();
      }
    }
  }
}

// Run the visual demonstration
if (require.main === module) {
  const demo = new VisualDemo();
  demo.run().catch(console.error);
}

module.exports = VisualDemo;