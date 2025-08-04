/**
 * Select and navigate to a workspace
 * @param {Page} page - Puppeteer page object
 * @param {object} params - Workspace parameters
 * @returns {Promise<ActionResult>} - Selection result
 */
async function selectWorkspace(page, params = {}) {
  const startTime = Date.now();
  const action = 'select-workspace';
  
  try {
    const { 
      workspaceId = null,
      workspaceName = null,
      index = 0,  // Default to first workspace
      timeout = 10000
    } = params;
    
    console.log(`🗂️  Selecting workspace...`);
    
    // First, ensure we're in the workspace list view (not inside a workspace)
    const navigateToWorkspaceList = require('./navigate-to-workspace-list');
    const navigationResult = await navigateToWorkspaceList(page);
    
    if (!navigationResult.success) {
      console.log(`⚠️ Could not navigate to workspace list: ${navigationResult.error}`);
      // Continue anyway in case we're already in the right place
    }
    
    // Wait for workspaces to load in sidebar
    await page.waitForSelector('div', { timeout: 5000 });
    
    let clicked = false;
    
    if (workspaceId) {
      // Select by ID (most precise)
      clicked = await page.evaluate((id) => {
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
      // Select by name - prefer clickable elements
      clicked = await page.evaluate((name) => {
        // First, try to find clickable workspace cards
        const allElements = document.querySelectorAll('div, li, a');
        const candidates = Array.from(allElements).filter(el => {
          const text = el.textContent || '';
          const isWorkspaceMatch = text.includes(name);
          const hasClickableStyle = el.classList.contains('cursor-pointer') || 
                                   window.getComputedStyle(el).cursor === 'pointer';
          const rect = el.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;
          
          return isWorkspaceMatch && hasClickableStyle && isVisible;
        });
        
        console.log(`Found ${candidates.length} clickable candidates for "${name}"`);
        
        if (candidates.length > 0) {
          const target = candidates[0];
          console.log('Clicking target:', target.textContent.substring(0, 50));
          target.click();
          return { success: true, clicked: target.textContent.substring(0, 50) };
        } else {
          // Fallback: click any element with the workspace name
          const fallback = Array.from(allElements).find(el => 
            el.textContent.includes(name)
          );
          if (fallback) {
            console.log('Fallback click:', fallback.textContent.substring(0, 50));
            fallback.click();
            return { success: true, clicked: fallback.textContent.substring(0, 50), fallback: true };
          }
        }
        
        return { success: false, error: 'No clickable element found' };
      }, workspaceName);
      
      // clicked is now an object, extract the success value
      if (typeof clicked === 'object') {
        console.log('Click result details:', clicked);
        clicked = clicked.success;
      }
    } else {
      // Select by index (target main workspace cards only)
      clicked = await page.evaluate((idx) => {
        // Look for main clickable workspace cards (the containers, not nested elements)
        const allDivs = document.querySelectorAll('div');
        const workspaceCards = Array.from(allDivs).filter(el => {
          const text = el.textContent || '';
          const hasWorkspaceContent = text.includes('Workspace - ') ||
                                     (text.includes('Workspace') && text.includes('items'));
          const isMainCard = el.classList.contains('cursor-pointer') && 
                            el.classList.contains('rounded-lg') &&
                            el.classList.contains('border');
          
          return hasWorkspaceContent && isMainCard;
        });
        
        console.log('Found workspace cards:', workspaceCards.length);
        workspaceCards.forEach((ws, i) => {
          console.log(`Workspace card ${i}:`, ws.textContent.substring(0, 60));
        });
        
        const targetWorkspace = workspaceCards[idx];
        if (targetWorkspace) {
          console.log('Clicking workspace card:', targetWorkspace.textContent.substring(0, 50));
          targetWorkspace.click();
          return true;
        }
        return false;
      }, index);
    }
    
    if (!clicked) {
      throw new Error('No workspace found to select');
    }
    
    console.log('💤 Waiting for workspace to load...');
    // Give the click time to take effect and page to navigate
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Wait for workspace interface to load - look for file explorer and workspace elements
    await page.waitForSelector('h1, h2, h3', { timeout: 8000 });
    
    // Verify we're actually in a workspace (not still in workspace list)
    const isInWorkspace = await page.evaluate(() => {
      const title = document.querySelector('h1, h2, h3')?.textContent || '';
      const hasFileExplorer = document.body.textContent.includes('Files') || 
                             document.body.textContent.includes('Search files');
      const hasBackToWorkspaces = document.body.textContent.includes('← Workspaces');
      const notInWorkspaceList = !document.body.textContent.includes('Welcome to Workspace Workshop');
      const hasWorkspaceHeader = document.body.textContent.includes('Workspace - ');
      
      // More lenient check - just need to be away from workspace list
      return notInWorkspaceList && (hasFileExplorer || hasWorkspaceHeader);
    });
    
    if (!isInWorkspace) {
      throw new Error('Failed to enter workspace - still appears to be in workspace list');
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Workspace selected (${duration}ms)`);
    
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
    console.log(`❌ Workspace selection failed: ${error.message}`);
    
    return {
      success: false,
      action,
      data: { workspaceId: params.workspaceId },
      duration,
      error: error.message
    };
  }
}

module.exports = selectWorkspace;