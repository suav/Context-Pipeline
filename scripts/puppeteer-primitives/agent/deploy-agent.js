/**
 * Deploy an agent in the current workspace
 * @param {Page} page - Puppeteer page object
 * @param {object} params - Agent parameters
 * @returns {Promise<ActionResult>} - Deployment result
 */
async function deployAgent(page, params = {}) {
  const startTime = Date.now();
  const action = 'deploy-agent';
  
  try {
    const { 
      agentType = 'dev-assistant',  // dev-assistant, code-reviewer, or agent name
      timeout = 10000
    } = params;
    
    console.log(`🤖 Deploying agent: ${agentType}`);
    
    // Wait for agent buttons to be available
    await page.waitForSelector('button', { timeout: 5000 });
    
    // Find and click the agent button
    const agentDeployed = await page.evaluate((type) => {
      const buttons = document.querySelectorAll('button');
      for (let button of buttons) {
        const text = button.textContent.toLowerCase();
        if (text.includes(type.toLowerCase()) || 
            text.includes('dev assistant') ||
            text.includes('code reviewer') ||
            text.includes('claude') ||
            text.includes('gemini')) {
          button.click();
          return true;
        }
      }
      return false;
    }, agentType);
    
    if (!agentDeployed) {
      throw new Error(`Agent button not found for type: ${agentType}`);
    }
    
    // Wait for agent terminal/chat interface to load
    await page.waitForFunction(() => {
      const terminal = document.querySelector('[class*="terminal"], [class*="chat"], input[placeholder*="command"]');
      return terminal && terminal.offsetParent !== null;
    }, { timeout: 8000 });
    
    const duration = Date.now() - startTime;
    console.log(`✅ Agent deployed: ${agentType} (${duration}ms)`);
    
    return {
      success: true,
      action,
      data: { 
        agentType,
        deployTime: duration
      },
      duration,
      error: null
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Agent deployment failed: ${error.message}`);
    
    return {
      success: false,
      action,
      data: { agentType: params.agentType },
      duration,
      error: error.message
    };
  }
}

module.exports = deployAgent;