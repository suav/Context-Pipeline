/**
 * Submit text to an agent in the terminal/chat interface
 * @param {Page} page - Puppeteer page object
 * @param {object} params - Text submission parameters
 * @returns {Promise<ActionResult>} - Submission result
 */
async function submitTextToAgent(page, params = {}) {
  const startTime = Date.now();
  const action = 'submit-text-to-agent';
  
  try {
    const { 
      text,
      timeout = 10000,
      waitForResponse = false,
      responseTimeout = 30000
    } = params;
    
    if (!text) {
      throw new Error('Text parameter is required');
    }
    
    console.log(`💬 Submitting text to agent: "${text.substring(0, 50)}..."`);
    
    // Find the agent terminal input field specifically (NOT the file search)
    // The agent terminal input can have different placeholders depending on state:
    // - "Type your command or "/" for commands..." (normal state)
    // - "Processing..." (when processing)
    // The file search always has "Search files" placeholder
    
    console.log(`🔍 Looking for agent terminal input...`);
    
    // First, wait for any input to be available
    await page.waitForSelector('input', { timeout: 5000 });
    
    // Find the correct input field using a more robust approach
    const inputElement = await page.evaluateHandle(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      
      // First, try to find by specific agent terminal characteristics
      let agentInput = inputs.find(input => {
        const placeholder = input.placeholder || '';
        // Look for the exact agent terminal placeholder
        return placeholder.includes('Type your command or "/" for commands') ||
               placeholder.includes('Processing...');
      });
      
      // If not found, look for input at the bottom of the page (agent terminal is at bottom)
      if (!agentInput) {
        agentInput = inputs
          .filter(input => {
            const placeholder = input.placeholder || '';
            const isFileSearch = placeholder.includes('Search files');
            const isVisible = input.offsetWidth > 0 && input.offsetHeight > 0;
            return !isFileSearch && isVisible;
          })
          .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0]; // Bottom-most input
      }
      
      return agentInput;
    });
    
    if (!inputElement) {
      // If we can't find by placeholder, try finding by position/context
      const fallbackElement = await page.evaluateHandle(() => {
        // Look for input in terminal/chat container
        const terminalContainers = [
          ...document.querySelectorAll('[class*="terminal"]'),
          ...document.querySelectorAll('[class*="chat"]'),
          ...document.querySelectorAll('[class*="bg-black"]')
        ];
        
        for (const container of terminalContainers) {
          const input = container.querySelector('input');
          if (input && !input.placeholder?.includes('Search files')) {
            return input;
          }
        }
        
        return null;
      });
      
      if (!fallbackElement) {
        throw new Error('Could not find agent terminal input field');
      }
      
      // Use the fallback element
      await fallbackElement.focus();
      await fallbackElement.click();
    } else {
      // Focus and click the found element
      await inputElement.focus();
      await inputElement.click();
    }
    
    // Get info about the input we found
    const inputInfo = await page.evaluate(() => {
      const focusedElement = document.activeElement;
      if (focusedElement && focusedElement.tagName === 'INPUT') {
        return {
          found: true,
          placeholder: focusedElement.placeholder,
          className: focusedElement.className,
          disabled: focusedElement.disabled,
          value: focusedElement.value
        };
      }
      return { found: false };
    });
    
    console.log(`📍 Input field info:`, inputInfo);
    
    // Clear existing content using keyboard shortcuts for better reliability
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    
    // Type the new text
    await page.keyboard.type(text);
    
    // Submit the text (press Enter)
    await page.keyboard.press('Enter');
    
    // Verify the text was submitted (input should clear or show processing)
    await page.waitForFunction(() => {
      const focusedElement = document.activeElement;
      if (focusedElement && focusedElement.tagName === 'INPUT') {
        // Input should either be empty (cleared) or show processing state
        return focusedElement.value === '' || 
               focusedElement.placeholder.includes('Processing') ||
               focusedElement.disabled;
      }
      // Also check if we can find any input that matches our criteria
      const inputs = document.querySelectorAll('input');
      for (const input of inputs) {
        if (!input.placeholder?.includes('Search files') && 
            (input.value === '' || input.placeholder.includes('Processing'))) {
          return true;
        }
      }
      return false;
    }, { timeout: 3000 });
    
    let responseData = null;
    
    if (waitForResponse) {
      console.log(`⏳ Waiting for agent response...`);
      
      // Wait for agent to start responding (look for processing indicators or new content)
      try {
        await page.waitForFunction(() => {
          // Look for signs that agent is processing or has responded
          const terminal = document.querySelector('[class*="terminal"], [class*="chat"]');
          if (!terminal) return false;
          
          // Check for loading indicators, new messages, or processing text
          const hasNewContent = terminal.textContent.includes('Tool Used:') ||
                               terminal.textContent.includes('✅') ||
                               terminal.textContent.includes('❌') ||
                               terminal.textContent.includes('Processing') ||
                               terminal.textContent.includes('Working');
          
          return hasNewContent;
        }, { timeout: responseTimeout });
        
        responseData = { responseReceived: true };
        console.log(`✅ Agent response detected`);
      } catch (timeoutError) {
        console.log(`⚠️  Agent response timeout (${responseTimeout}ms)`);
        responseData = { responseReceived: false, timeout: true };
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Text submitted to agent (${duration}ms)`);
    
    return {
      success: true,
      action,
      data: { 
        text: text.substring(0, 100),
        textLength: text.length,
        waitedForResponse: waitForResponse,
        ...responseData
      },
      duration,
      error: null
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Text submission failed: ${error.message}`);
    
    return {
      success: false,
      action,
      data: { text: params.text?.substring(0, 100) },
      duration,
      error: error.message
    };
  }
}

module.exports = submitTextToAgent;