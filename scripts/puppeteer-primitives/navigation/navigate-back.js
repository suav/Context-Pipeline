/**
 * Navigate back to workspace (test navigation persistence)
 * @param {Page} page - Puppeteer page object
 * @param {object} params - Navigation parameters
 * @returns {Promise<ActionResult>} - Navigation result
 */
async function navigateBack(page, params = {}) {
  const startTime = Date.now();
  const action = 'navigate-back';
  
  try {
    const { 
      workspaceId = null,
      workspaceName = null,
      index = 0,  // Default to first workspace
      timeout = 10000
    } = params;
    
    console.log(`🔙 Navigating back to workspace...`);
    
    // Check if we're already in a workspace
    const inWorkspace = await page.evaluate(() => {
      return document.querySelector('[class*="workspace"], [class*="editor"], input[placeholder*="command"]') !== null;
    });
    
    if (inWorkspace) {
      console.log(`✅ Already in workspace interface`);
      const duration = Date.now() - startTime;
      return {
        success: true,
        action,
        data: { alreadyInWorkspace: true },
        duration,
        error: null
      };
    }
    
    // We need to select a workspace from the list
    await page.waitForSelector('div', { timeout: 5000 });
    
    let workspaceSelected = false;
    
    if (workspaceId) {
      // Select by ID (most precise)
      workspaceSelected = await page.evaluate((id) => {
        const elements = document.querySelectorAll('div, li, a');
        const workspace = Array.from(elements).find(el => 
          el.getAttribute('data-workspace-id') === id ||
          el.textContent.includes(id)
        );
        if (workspace) {
          workspace.click();
          return true;
        }
        return false;
      }, workspaceId);
    } else if (workspaceName) {
      // Select by name
      workspaceSelected = await page.evaluate((name) => {
        const elements = document.querySelectorAll('div, li, a');
        const workspace = Array.from(elements).find(el => 
          el.textContent.includes(name)
        );
        if (workspace) {
          workspace.click();
          return true;
        }
        return false;
      }, workspaceName);
    } else {
      // Select by index (fallback to first workspace)
      workspaceSelected = await page.evaluate((idx) => {
        const workspaceElements = document.querySelectorAll('div, li, a');
        const workspaces = Array.from(workspaceElements).filter(el => 
          el.textContent.includes('Workspace') && 
          el.style.cursor !== 'default'
        );
        const targetWorkspace = workspaces[idx] || workspaces[0];
        if (targetWorkspace) {
          targetWorkspace.click();
          return true;
        }
        return false;
      }, index);
    }
    
    if (!workspaceSelected) {
      throw new Error('Could not find workspace to navigate back to');
    }
    
    // Wait for workspace interface to load
    await page.waitForSelector('[class*="workspace"], [class*="editor"], input[placeholder*="command"]', 
      { timeout: 8000 });
    
    const duration = Date.now() - startTime;
    console.log(`✅ Navigated back to workspace (${duration}ms)`);
    
    return {
      success: true,
      action,
      data: { 
        workspaceId, 
        workspaceName, 
        index,
        loadTime: duration
      },
      duration,
      error: null
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Navigation back failed: ${error.message}`);
    
    return {
      success: false,
      action,
      data: { workspaceId: params.workspaceId },
      duration,
      error: error.message
    };
  }
}

module.exports = navigateBack;