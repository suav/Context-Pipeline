/**
 * Select workspace and open specific agent terminal
 * @param {Page} page - Puppeteer page object
 * @param {object} params - Parameters
 * @returns {Promise<ActionResult>} - Selection result
 */
async function selectWorkspaceWithAgent(page, params = {}) {
  const startTime = Date.now();
  const action = 'select-workspace-with-agent';
  
  try {
    const { 
      workspaceId = null,
      workspaceName = null,
      index = 0,
      agentName = 'Dev Assistant',
      timeout = 15000
    } = params;
    
    console.log(`🗂️  Selecting workspace and opening agent: ${agentName}...`);
    
    // Step 1: Select the workspace
    const selectWorkspace = require('./select-workspace');
    const workspaceResult = await selectWorkspace(page, {
      workspaceId,
      workspaceName,
      index,
      timeout: timeout / 2
    });
    
    if (!workspaceResult.success) {
      throw new Error(`Failed to select workspace: ${workspaceResult.error}`);
    }
    
    console.log(`✅ Workspace selected, now opening agent terminal...`);
    
    // Step 2: Open the agent terminal
    const openAgentTerminal = require('../agent/open-agent-terminal');
    const agentResult = await openAgentTerminal(page, {
      agentName,
      timeout: timeout / 2
    });
    
    if (!agentResult.success) {
      throw new Error(`Failed to open agent terminal: ${agentResult.error}`);
    }
    
    // Step 3: Verify we're in the correct state
    const verification = await page.evaluate(() => {
      const hasInput = document.querySelector('input[placeholder*="command"], input[placeholder*="Type"]');
      const hasAgentInterface = document.body.textContent.includes('Type /') || 
                                document.body.textContent.includes('command') ||
                                document.querySelector('[data-agent]');
      const workspaceInfo = document.title || document.querySelector('h1, h2, h3')?.textContent || '';
      
      return {
        hasInput: !!hasInput,
        hasAgentInterface,
        workspaceInfo: workspaceInfo.substring(0, 100),
        currentPage: window.location.pathname
      };
    });
    
    console.log(`📊 Verification:`, verification);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Workspace with agent ready (${duration}ms)`);
    
    return {
      success: true,
      action,
      data: { 
        workspaceId, 
        workspaceName, 
        index,
        agentName,
        loadTime: duration,
        workspaceResult,
        agentResult,
        verification
      },
      duration,
      error: null
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Workspace with agent selection failed: ${error.message}`);
    
    return {
      success: false,
      action,
      data: { workspaceId: params.workspaceId, agentName: params.agentName },
      duration,
      error: error.message
    };
  }
}

module.exports = selectWorkspaceWithAgent;