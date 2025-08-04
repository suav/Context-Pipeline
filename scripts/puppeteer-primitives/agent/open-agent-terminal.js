/**
 * Open Agent Terminal Primitive
 * 
 * Opens the terminal for a specific agent in the current workspace.
 * This primitive assumes you're already in a workspace and need to access an agent.
 */

async function openAgentTerminal(page, params = {}) {
  const startTime = Date.now();
  const action = 'open-agent-terminal';
  
  try {
    const agentName = params.agentName || 'Dev Assistant';
    const timeout = params.timeout || 5000;
    
    console.log(`🤖 Opening terminal for agent: ${agentName}...`);
    
    // Look for the agent buttons at the bottom of the screen (they appear as regular buttons without type="button")
    console.log(`🔍 Looking for agent buttons in the UI...`);
    
    // Wait for any agent buttons to be available at the bottom
    // Agent buttons may take time to load, especially when returning to a workspace
    console.log(`⏳ Waiting for agent buttons to load...`);
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      try {
        await page.waitForSelector('button', { timeout: 2000 });
        console.log(`✅ Found buttons on attempt ${attempts + 1}`);
        break;
      } catch (error) {
        attempts++;
        console.log(`⏳ Attempt ${attempts}/${maxAttempts} - waiting for buttons to load...`);
        if (attempts >= maxAttempts) {
          console.log(`⚠️ No buttons found after ${maxAttempts} attempts, trying alternative selectors...`);
          await page.waitForSelector('[role="button"], [data-agent], .agent-button', { timeout });
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // Get all available agents (look for all buttons, not just type="button")
    // Try multiple times to ensure agent buttons have loaded
    let agents = [];
    let agentAttempts = 0;
    const maxAgentAttempts = 3;
    
    while (agentAttempts < maxAgentAttempts && agents.length === 0) {
      agents = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons
          .filter(btn => btn.textContent && (
            btn.textContent.includes('Dev Assistant') ||
            btn.textContent.includes('Code Reviewer') ||
            btn.textContent.includes('System') ||
            btn.textContent.includes('Agent') ||
            btn.textContent.includes('Git')
          ))
          .map(btn => ({
            text: btn.textContent.trim(),
            className: btn.className,
            disabled: btn.disabled
          }));
      });
      
      if (agents.length === 0) {
        agentAttempts++;
        console.log(`⏳ Agent attempt ${agentAttempts}/${maxAgentAttempts} - no agent buttons found yet...`);
        if (agentAttempts < maxAgentAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }
    
    console.log(`📋 Available agents:`, agents);
    
    // Click on the agent
    const clicked = await page.evaluate((targetAgentName) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      
      // First try exact match, then partial match
      let agentButton = buttons.find(btn => 
        btn.textContent && btn.textContent.includes(targetAgentName)
      );
      
      if (agentButton) {
        agentButton.click();
        return { success: true, text: agentButton.textContent.trim() };
      }
      
      // Fallback: click first available agent (Dev Assistant or any agent)
      agentButton = buttons.find(btn => 
        btn.textContent && (
          btn.textContent.includes('Dev Assistant') ||
          btn.textContent.includes('Code Reviewer') ||
          btn.textContent.includes('Agent')
        )
      );
      
      if (agentButton) {
        agentButton.click();
        return { success: true, text: agentButton.textContent.trim(), fallback: true };
      }
      
      return { success: false, error: 'No agent buttons found' };
    }, agentName);
    
    if (!clicked.success) {
      throw new Error(`Could not find agent button for: ${agentName}`);
    }
    
    console.log(`✅ Clicked agent: ${clicked.text}${clicked.fallback ? ' (fallback)' : ''}`);
    
    // Wait a moment for the terminal to open
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify terminal is open by looking for input field
    try {
      await page.waitForSelector('input[placeholder*="command"], input[placeholder*="Type"]', { timeout: 3000 });
      console.log(`✅ Agent terminal opened successfully`);
    } catch (error) {
      console.log(`⚠️ Terminal may not have opened (no input field found)`);
    }
    
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      action,
      duration,
      params,
      result: {
        agentClicked: clicked.text,
        fallbackUsed: clicked.fallback || false,
        availableAgents: agents
      }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ ${action} failed:`, error.message);
    
    return {
      success: false,
      action,
      duration,
      params,
      error: error.message
    };
  }
}

module.exports = openAgentTerminal;