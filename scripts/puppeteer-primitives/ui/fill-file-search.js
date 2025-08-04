/**
 * Fill text into the file search box (left sidebar)
 * @param {Page} page - Puppeteer page object
 * @param {object} params - Search parameters
 * @returns {Promise<ActionResult>} - Fill result
 */
async function fillFileSearch(page, params = {}) {
  const startTime = Date.now();
  const action = 'fill-file-search';
  
  try {
    const { 
      text,
      clear = true,
      timeout = 5000
    } = params;
    
    if (!text) {
      throw new Error('Text parameter is required');
    }
    
    console.log(`🔍 Filling file search: "${text}"`);
    
    // File search is in the left sidebar with placeholder "Search files..."
    const fileSearchSelector = 'input[placeholder*="Search files"], input[placeholder*="search"]';
    await page.waitForSelector(fileSearchSelector, { timeout });
    
    if (clear) {
      await page.click(fileSearchSelector);
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
    }
    
    await page.type(fileSearchSelector, text);
    
    const duration = Date.now() - startTime;
    console.log(`✅ File search filled (${duration}ms)`);
    
    return {
      success: true,
      action,
      data: { text, location: 'file-search-sidebar' },
      duration,
      error: null
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ File search fill failed: ${error.message}`);
    
    return {
      success: false,
      action,
      data: { text: params.text, location: 'file-search-sidebar' },
      duration,
      error: error.message
    };
  }
}

module.exports = fillFileSearch;