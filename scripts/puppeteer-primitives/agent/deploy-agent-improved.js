/**
 * Deploy an agent in the current workspace (IMPROVED VERSION)
 * Handles JavaScript dialogs and distinguishes between deploy vs agent buttons
 * @param {Page} page - Puppeteer page object
 * @param {object} params - Agent parameters
 * @returns {Promise<ActionResult>} - Deployment result
 */
async function deployAgentImproved(page, params = {}) {
  const startTime = Date.now();
  const action = 'deploy-agent-improved';
  
  try {
    const { 
      agentType = 'dev-assistant',  // dev-assistant, code-reviewer, etc.
      timeout = 10000,
      handleDialogs = true
    } = params;
    
    console.log(`🤖 Deploying agent (improved): ${agentType}`);
    
    // Set up dialog handler if requested
    let dialogHandled = false;
    if (handleDialogs) {
      page.on('dialog', async dialog => {
        console.log(`🚨 Dialog detected: ${dialog.type()}`);
        console.log(`Message: "${dialog.message().substring(0, 100)}..."`);
        await dialog.accept();
        dialogHandled = true;
        console.log('✅ Dialog accepted');
      });
    }
    
    // Wait for agent buttons to be available
    await page.waitForSelector('button', { timeout: 5000 });
    
    // Find and click the correct agent button (NOT the deploy button)
    const agentDeployed = await page.evaluate((type) => {
      const buttons = document.querySelectorAll('button');
      const agentButtons = [];
      
      for (let button of buttons) {
        const text = button.textContent.toLowerCase();
        
        // Skip the "Deploy to Main" button explicitly
        if (text.includes('deploy to main')) {
          console.log('Skipping Deploy to Main button');
          continue;
        }
        
        // Look for actual agent buttons
        if (text.includes('dev assistant') || 
            text.includes('code reviewer') ||
            text.includes('assistant') ||
            text.includes('reviewer')) {
          agentButtons.push({
            button,
            text: button.textContent.trim(),
            matches: text.includes(type.toLowerCase()) || 
                    text.includes('dev assistant') ||
                    text.includes('code reviewer')
          });
        }
      }
      
      console.log(`Found ${agentButtons.length} agent buttons`);
      agentButtons.forEach(ab => {
        console.log(`- "${ab.text}" (matches: ${ab.matches})`);
      });
      
      // Click the best match
      const bestMatch = agentButtons.find(ab => ab.matches) || agentButtons[0];
      if (bestMatch) {
        console.log(`Clicking: "${bestMatch.text}"`);
        bestMatch.button.click();
        return { success: true, buttonText: bestMatch.text };
      }
      
      return { success: false, error: 'No agent buttons found' };
    }, agentType);
    
    if (!agentDeployed.success) {
      throw new Error(agentDeployed.error || `Agent button not found for type: ${agentType}`);
    }
    
    console.log(`✅ Clicked agent button: "${agentDeployed.buttonText}"`);
    
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
        buttonClicked: agentDeployed.buttonText,
        deployTime: duration,
        dialogHandled
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

module.exports = deployAgentImproved;