/**
 * Navigate away from current workspace (test navigation persistence)
 * @param {Page} page - Puppeteer page object
 * @param {object} params - Navigation parameters
 * @returns {Promise<ActionResult>} - Navigation result
 */
async function navigateAway(page, params = {}) {
  const startTime = Date.now();
  const action = 'navigate-away';
  
  try {
    const { 
      target = 'home',  // 'home', 'workspaces', 'settings'
      timeout = 5000
    } = params;
    
    console.log(`🔄 Navigating away to: ${target}`);
    
    let navigated = false;
    
    if (target === 'home' || target === 'workspaces') {
      // Try to navigate back to workspaces list
      navigated = await page.evaluate(() => {
        // Look for back button or workspaces link
        const backButtons = document.querySelectorAll('a, button');
        for (let btn of backButtons) {
          if (btn.textContent.includes('Workspaces') || 
              btn.textContent.includes('←') ||
              btn.href && btn.href.includes('localhost:3001')) {
            btn.click();
            return true;
          }
        }
        return false;
      });
      
      if (!navigated) {
        // Fallback: navigate directly to home
        await page.goto('http://localhost:3001', { waitUntil: 'networkidle2' });
        navigated = true;
      }
    } else if (target === 'settings') {
      // Open settings dialog
      navigated = await page.evaluate(() => {
        const settingsButtons = document.querySelectorAll('button, [role="button"]');
        for (let btn of settingsButtons) {
          if (btn.textContent.includes('Settings') || 
              btn.textContent.includes('☰') ||
              btn.getAttribute('aria-label')?.includes('settings')) {
            btn.click();
            return true;
          }
        }
        return false;
      });
    }
    
    if (!navigated) {
      throw new Error(`Could not navigate to target: ${target}`);
    }
    
    // Wait for navigation to complete
    await page.waitForFunction((tgt) => {
      if (tgt === 'home' || tgt === 'workspaces') {
        return document.title.includes('Workspace') || 
               document.textContent.includes('Welcome to Workspace');
      } else if (tgt === 'settings') {
        return document.textContent.includes('Credentials') ||
               document.textContent.includes('Settings');
      }
      return true;
    }, { timeout }, target);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Navigated away to ${target} (${duration}ms)`);
    
    return {
      success: true,
      action,
      data: { 
        target,
        navigationType: 'away'
      },
      duration,
      error: null
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Navigation away failed: ${error.message}`);
    
    return {
      success: false,
      action,
      data: { target: params.target },
      duration,
      error: error.message
    };
  }
}

module.exports = navigateAway;