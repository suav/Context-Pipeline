/**
 * Take a screenshot of the current page
 * @param {Page} page - Puppeteer page object
 * @param {object} params - Screenshot parameters
 * @returns {Promise<ActionResult>} - Screenshot result
 */
async function takeScreenshot(page, params = {}) {
  const startTime = Date.now();
  const action = 'take-screenshot';
  
  try {
    const name = params.name || `screenshot-${Date.now()}`;
    const path = params.path || `scripts/puppeteer-primitives/screenshots/${name}.png`;
    const fullPage = params.fullPage !== false; // Default to true
    
    console.log(`📸 Taking screenshot: ${name}`);
    
    // Ensure screenshots directory exists
    const fs = require('fs');
    const pathModule = require('path');
    const dir = pathModule.dirname(path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    await page.screenshot({ 
      path,
      fullPage,
      type: 'png'
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ Screenshot saved: ${path} (${duration}ms)`);
    
    return {
      success: true,
      action,
      data: { name, path, fullPage },
      screenshot: path,
      duration,
      error: null
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Screenshot failed: ${error.message}`);
    
    return {
      success: false,
      action,
      data: null,
      screenshot: null,
      duration,
      error: error.message
    };
  }
}

module.exports = takeScreenshot;