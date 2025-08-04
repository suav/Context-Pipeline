/**
 * Setup browser with optimal configuration for Context Pipeline testing
 * @param {object} params - Browser parameters
 * @returns {Promise<{browser: Browser, page: Page}>} - Browser and page objects
 */
async function setupBrowser(params = {}) {
  const puppeteer = require('puppeteer');
  const action = 'setup-browser';
  
  try {
    const {
      headless = false,        // Default to visible for testing
      width = 1200,
      height = 800,
      timeout = 10000
    } = params;
    
    console.log(`🔧 Setting up browser (headless: ${headless})...`);
    
    // Chrome executable paths to try (in order of preference)
    const chromePaths = [
      process.env.CHROME_PATH,
      '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome'
    ].filter(Boolean);
    
    let executablePath;
    for (const path of chromePaths) {
      try {
        const fs = require('fs');
        if (fs.existsSync(path)) {
          executablePath = path;
          break;
        }
      } catch (error) {
        // Continue to next path
      }
    }
    
    if (!executablePath) {
      throw new Error('No Chrome executable found. Run: npx puppeteer browsers install chrome');
    }
    
    console.log(`🎯 Using Chrome at: ${executablePath}`);
    
    const browser = await puppeteer.launch({
      headless,
      executablePath,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      defaultViewport: { width, height },
      timeout
    });
    
    const page = await browser.newPage();
    
    // Set longer timeouts for testing
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);
    
    console.log(`✅ Browser setup complete`);
    
    return {
      success: true,
      action,
      browser,
      page,
      data: { executablePath, headless, width, height },
      error: null
    };
    
  } catch (error) {
    console.log(`❌ Browser setup failed: ${error.message}`);
    
    return {
      success: false,
      action,
      browser: null,
      page: null,
      data: null,
      error: error.message
    };
  }
}

module.exports = setupBrowser;