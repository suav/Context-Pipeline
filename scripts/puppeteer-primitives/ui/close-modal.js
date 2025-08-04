/**
 * Close any open modal or dialog
 * @param {Page} page - Puppeteer page object
 * @param {object} params - Close parameters
 * @returns {Promise<ActionResult>} - Close result
 */
async function closeModal(page, params = {}) {
  const startTime = Date.now();
  const action = 'close-modal';
  
  try {
    const { timeout = 5000 } = params;
    
    console.log(`❌ Closing modal/dialog...`);
    
    // Try multiple methods to close modal
    let closed = false;
    
    // Method 1: Look for X button
    closed = await page.evaluate(() => {
      const closeButtons = document.querySelectorAll('button, [role="button"]');
      for (let btn of closeButtons) {
        if (btn.textContent.includes('×') || 
            btn.innerHTML.includes('×') || 
            btn.getAttribute('aria-label')?.includes('close')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    
    // Method 2: Press Escape key
    if (!closed) {
      await page.keyboard.press('Escape');
      closed = true;
    }
    
    // Wait for modal to disappear
    await page.waitForTimeout(1000);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Modal closed (${duration}ms)`);
    
    return {
      success: true,
      action,
      data: { method: closed ? 'button' : 'escape' },
      duration,
      error: null
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Modal close failed: ${error.message}`);
    
    return {
      success: false,
      action,
      data: null,
      duration,
      error: error.message
    };
  }
}

module.exports = closeModal;