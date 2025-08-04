/**
 * Check if a file has been modified by an agent
 * @param {Page} page - Puppeteer page object
 * @param {object} params - File check parameters
 * @returns {Promise<ActionResult>} - Check result
 */
async function checkFileModified(page, params = {}) {
  const startTime = Date.now();
  const action = 'check-file-modified';
  
  try {
    const { 
      filename = 'README.md',
      timeout = 5000
    } = params;
    
    console.log(`📄 Checking if file modified: ${filename}`);
    
    // Check file explorer for changes
    const fileInfo = await page.evaluate((fname) => {
      // Look for file in file explorer
      const fileElements = document.querySelectorAll('[class*="file"], [class*="tree"], li, div');
      
      for (let element of fileElements) {
        if (element.textContent && element.textContent.includes(fname)) {
          return {
            found: true,
            text: element.textContent,
            hasModifiedIndicator: element.textContent.includes('M') || 
                                  element.textContent.includes('*') ||
                                  element.classList.contains('modified') ||
                                  element.style.color.includes('orange') ||
                                  element.style.color.includes('yellow')
          };
        }
      }
      
      return { found: false };
    }, filename);
    
    const duration = Date.now() - startTime;
    
    if (fileInfo.found) {
      console.log(`✅ File found: ${filename} (Modified: ${fileInfo.hasModifiedIndicator}) (${duration}ms)`);
    } else {
      console.log(`⚠️  File not found in explorer: ${filename} (${duration}ms)`);
    }
    
    return {
      success: true,
      action,
      data: {
        filename,
        ...fileInfo
      },
      duration,
      error: null
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ File check failed: ${error.message}`);
    
    return {
      success: false,
      action,
      data: { filename: params.filename },
      duration,
      error: error.message
    };
  }
}

module.exports = checkFileModified;