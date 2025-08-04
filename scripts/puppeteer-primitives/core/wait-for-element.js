/**
 * Wait for an element to appear on the page
 * @param {Page} page - Puppeteer page object
 * @param {object} params - Wait parameters
 * @returns {Promise<ActionResult>} - Wait result
 */
async function waitForElement(page, params = {}) {
  const startTime = Date.now();
  const action = 'wait-for-element';
  
  try {
    const { 
      selector, 
      timeout = 5000, 
      visible = true,
      text = null 
    } = params;
    
    if (!selector) {
      throw new Error('Selector parameter is required');
    }
    
    console.log(`⏳ Waiting for element: ${selector}`);
    
    let element;
    if (text) {
      // Wait for element with specific text content
      element = await page.waitForFunction(
        (sel, txt) => {
          const elements = document.querySelectorAll(sel);
          return Array.from(elements).find(el => 
            el.textContent.includes(txt)
          );
        },
        { timeout },
        selector,
        text
      );
    } else {
      // Standard element wait
      element = await page.waitForSelector(selector, { 
        timeout,
        visible 
      });
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Element found: ${selector} (${duration}ms)`);
    
    return {
      success: true,
      action,
      data: { 
        selector, 
        text, 
        visible, 
        found: true 
      },
      duration,
      error: null
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Element not found: ${params.selector} - ${error.message}`);
    
    return {
      success: false,
      action,
      data: { 
        selector: params.selector, 
        found: false 
      },
      duration,
      error: error.message
    };
  }
}

module.exports = waitForElement;