/**
 * Navigate to Context Pipeline application
 * @param {Page} page - Puppeteer page object  
 * @param {object} params - Navigation parameters
 * @returns {Promise<ActionResult>} - Navigation result
 */
async function navigateToApp(page, params = {}) {
  const startTime = Date.now();
  const action = 'navigate-to-app';
  
  try {
    const url = params.url || 'http://localhost:3001';
    const timeout = params.timeout || 10000;
    
    console.log(`🌐 Navigating to ${url}...`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout 
    });
    
    // Wait for main app elements to load
    await page.waitForSelector('body', { timeout: 5000 });
    
    const duration = Date.now() - startTime;
    console.log(`✅ Navigation completed in ${duration}ms`);
    
    return {
      success: true,
      action,
      data: { url, loadTime: duration },
      duration,
      error: null
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Navigation failed: ${error.message}`);
    
    return {
      success: false,
      action,
      data: null,
      duration,
      error: error.message
    };
  }
}

module.exports = navigateToApp;