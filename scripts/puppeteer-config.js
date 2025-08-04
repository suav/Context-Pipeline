/**
 * Puppeteer Configuration Utility
 * Provides consistent browser launch options across all scripts
 */

class PuppeteerConfig {
  constructor() {
    this.defaultOptions = {
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    };
  }

  /**
   * Parse command line arguments and environment variables
   */
  parseOptions() {
    const args = process.argv.slice(2);
    
    // Check for headful/headless flags
    const isHeadful = args.includes('--headful') || 
                     args.includes('--head') || 
                     args.includes('--visible') ||
                     process.env.PUPPETEER_HEADFUL === 'true';
    
    const isHeadless = args.includes('--headless') || 
                      process.env.PUPPETEER_HEADLESS === 'true';
    
    // Check for slow mode (for debugging)
    const isSlowMode = args.includes('--slow') || 
                      process.env.PUPPETEER_SLOW === 'true';
    
    // Check for devtools
    const devtools = args.includes('--devtools') || 
                    process.env.PUPPETEER_DEVTOOLS === 'true';
    
    // Default to headless unless explicitly requested otherwise
    const headless = isHeadless || (!isHeadful && process.env.NODE_ENV !== 'development');
    
    return {
      headless,
      slowMode: isSlowMode,
      devtools: devtools && !headless, // DevTools only work in headful mode
      visible: !headless
    };
  }

  /**
   * Get browser launch options
   */
  getBrowserOptions(customOptions = {}) {
    const options = this.parseOptions();
    
    const launchOptions = {
      ...this.defaultOptions,
      headless: options.headless ? 'new' : false,
      devtools: options.devtools,
      slowMo: options.slowMode ? 250 : 0,
      ...customOptions
    };

    // Add headful-specific options
    if (!options.headless) {
      launchOptions.args.push('--start-maximized');
      launchOptions.defaultViewport = null;
    }

    return launchOptions;
  }

  /**
   * Get page options with appropriate timeouts
   */
  getPageOptions() {
    const options = this.parseOptions();
    
    return {
      defaultTimeout: options.slowMode ? 60000 : 30000,
      defaultNavigationTimeout: options.slowMode ? 60000 : 30000
    };
  }

  /**
   * Wait helper that respects slow mode
   */
  async wait(seconds, message = '') {
    const options = this.parseOptions();
    const multiplier = options.slowMode ? 2 : 1;
    const waitTime = seconds * 1000 * multiplier;
    
    if (message && options.visible) {
      console.log(`⏱️  ${message} (${waitTime/1000}s)`);
    }
    
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * Log helper that respects mode
   */
  log(message, force = false) {
    const options = this.parseOptions();
    if (options.visible || force) {
      console.log(message);
    }
  }

  /**
   * Print usage information
   */
  static printUsage() {
    console.log(`
🤖 Puppeteer Script Options:

Visibility Modes:
  --headless         Run in headless mode (fast, no browser window)
  --headful          Run in headful mode (visible browser window)
  --visible          Alias for --headful

Debugging Options:
  --slow             Slow down operations for better observation
  --devtools         Open Chrome DevTools (headful mode only)

Environment Variables:
  PUPPETEER_HEADFUL=true     Force headful mode
  PUPPETEER_HEADLESS=true    Force headless mode
  PUPPETEER_SLOW=true        Enable slow mode
  PUPPETEER_DEVTOOLS=true    Enable DevTools

Examples:
  node script.js --headful --slow    # Visible browser, slow operations
  node script.js --headless          # Fast headless execution
  node script.js --devtools          # Visible with DevTools open
  
Default: Headless mode for speed, headful in development
`);
  }
}

module.exports = PuppeteerConfig;