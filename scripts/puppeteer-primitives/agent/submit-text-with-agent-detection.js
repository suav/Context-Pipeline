/**
 * Submit Text to Agent with Agent Detection
 * 
 * Enhanced version that detects different agent interface types and handles input accordingly.
 * Handles Dev Assistant vs Code Reviewer vs other agent interface variations.
 */

async function submitTextWithAgentDetection(page, params = {}) {
  const startTime = Date.now();
  const action = 'submit-text-with-agent-detection';
  
  try {
    const text = params.text;
    const timeout = params.timeout || 10000;
    
    if (!text) {
      throw new Error('No text provided to submit');
    }
    
    console.log(`💬 Submitting text to agent with detection: "${text.substring(0, 50)}..."`);
    
    // Step 1: Detect current agent interface type
    const agentInfo = await page.evaluate(() => {
      // Look for agent type indicators
      const terminalElements = Array.from(document.querySelectorAll('*'));
      
      const hasDevAssistant = terminalElements.some(el => 
        el.textContent && el.textContent.includes('Dev Assistant')
      );
      
      const hasCodeReviewer = terminalElements.some(el => 
        el.textContent && (
          el.textContent.includes('Code Reviewer') ||
          el.textContent.includes('Workspace Agent Terminal')
        )
      );
      
      const hasSystemAgent = terminalElements.some(el => 
        el.textContent && el.textContent.includes('System')
      );
      
      // Find all possible input fields
      const inputs = Array.from(document.querySelectorAll('input, textarea'));
      const inputInfo = inputs.map(input => ({
        placeholder: input.placeholder,
        type: input.type,
        className: input.className,
        visible: input.offsetWidth > 0 && input.offsetHeight > 0,
        disabled: input.disabled,
        id: input.id,
        name: input.name
      }));
      
      return {
        hasDevAssistant,
        hasCodeReviewer,
        hasSystemAgent,
        inputCount: inputs.length,
        inputInfo,
        activeTab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent ||
                   document.querySelector('button.bg-blue-600, button.bg-green-600')?.textContent || 'unknown'
      };
    });
    
    console.log(`🔍 Agent detection results:`, agentInfo);
    
    // Step 2: Wait for and find the correct input field
    let inputSelector;
    let inputFound = false;
    
    // Try different input selection strategies
    const inputStrategies = [
      // Strategy 1: Standard agent terminal input
      'input[placeholder*="command"], input[placeholder*="Type"]',
      // Strategy 2: Visible input fields only
      'input:not([placeholder*="Search"]):not([type="hidden"])',
      // Strategy 3: Any text input
      'input[type="text"], textarea',
      // Strategy 4: Last resort - any input
      'input'
    ];
    
    for (const strategy of inputStrategies) {
      try {
        await page.waitForSelector(strategy, { timeout: 2000 });
        
        const validInput = await page.evaluate((selector) => {
          const inputs = document.querySelectorAll(selector);
          for (const input of inputs) {
            // Skip file search inputs
            if (input.placeholder && input.placeholder.includes('Search files')) continue;
            // Skip hidden inputs
            if (input.offsetWidth === 0 || input.offsetHeight === 0) continue;
            // Skip disabled inputs
            if (input.disabled) continue;
            
            return {
              found: true,
              placeholder: input.placeholder,
              className: input.className,
              visible: true
            };
          }
          return { found: false };
        }, strategy);
        
        if (validInput.found) {
          inputSelector = strategy;
          inputFound = true;
          console.log(`✅ Found valid input with strategy: ${strategy}`);
          console.log(`📍 Input details:`, validInput);
          break;
        }
      } catch (error) {
        console.log(`⚠️ Strategy ${strategy} failed: ${error.message}`);
      }
    }
    
    if (!inputFound) {
      // Last resort: try to click anywhere in the terminal area to focus
      console.log('🔄 Trying to focus terminal area...');
      await page.evaluate(() => {
        const terminalArea = document.querySelector('[class*="terminal"], [class*="bg-black"], [style*="background-color: black"]');
        if (terminalArea) {
          terminalArea.click();
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try again after focusing
      try {
        await page.waitForSelector('input', { timeout: 2000 });
        inputSelector = 'input';
        inputFound = true;
        console.log('✅ Found input after focusing terminal');
      } catch (error) {
        throw new Error(`No valid input field found after trying all strategies. Agent info: ${JSON.stringify(agentInfo)}`);
      }
    }
    
    // Step 3: Clear and type in the input
    const inputElement = await page.$(inputSelector);
    if (!inputElement) {
      throw new Error(`Input element not found for selector: ${inputSelector}`);
    }
    
    // Clear existing content
    await inputElement.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    
    // Type the text
    await inputElement.type(text);
    console.log(`✅ Typed text into input field`);
    
    // Step 4: Submit (Enter key)
    await page.keyboard.press('Enter');
    console.log(`✅ Pressed Enter to submit`);
    
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      action,
      duration,
      params,
      result: {
        agentDetection: agentInfo,
        inputSelector,
        textLength: text.length
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

module.exports = submitTextWithAgentDetection;