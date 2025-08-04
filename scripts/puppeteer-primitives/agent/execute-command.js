/**
 * Execute Agent Command
 * 
 * Executes a specific "/" command in the agent terminal
 */

async function executeCommand(page, params = {}) {
  const startTime = Date.now();
  const action = 'execute-command';
  
  try {
    const { 
      command,
      timeout = 30000
    } = params;
    
    if (!command) {
      throw new Error('Command parameter is required');
    }
    
    console.log(`⚡ Executing command: ${command}`);
    
    // Find the agent input field
    await page.waitForSelector('[placeholder*="command"]', { timeout: 5000 });
    
    // Type the command
    const executionResult = await page.evaluate((cmd) => {
      const input = document.querySelector('[placeholder*="command"]');
      if (!input) {
        return { success: false, error: 'No command input found' };
      }
      
      // Clear input and type command
      input.focus();
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Type the command
      input.value = cmd;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Press Enter to execute
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        bubbles: true
      });
      input.dispatchEvent(enterEvent);
      
      return { success: true };
    }, command);
    
    if (!executionResult.success) {
      throw new Error(executionResult.error);
    }
    
    // Wait for command to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Monitor for completion
    let completed = false;
    let attempts = 0;
    const maxAttempts = timeout / 1000; // Check every second
    
    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const status = await page.evaluate(() => {
        const terminal = document.querySelector('[class*="terminal"], .bg-black, [style*="background"]');
        const content = terminal ? terminal.textContent : '';
        
        // Look for completion indicators
        const hasCompleted = content.includes('Completed') || content.includes('Error:');
        const isProcessing = content.includes('Processing') || content.includes('Waiting for AI');
        
        return {
          hasCompleted,
          isProcessing,
          contentLength: content.length
        };
      });
      
      if (status.hasCompleted && !status.isProcessing) {
        completed = true;
      }
      
      attempts++;
    }
    
    // Get final result
    const result = await page.evaluate(() => {
      const terminal = document.querySelector('[class*="terminal"], .bg-black, [style*="background"]');
      const content = terminal ? terminal.textContent : '';
      
      // Extract the response from the command
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      const lastLines = lines.slice(-10); // Last 10 lines for context
      
      return {
        contentLength: content.length,
        lastLines,
        completed: content.includes('Completed'),
        hasError: content.includes('Error:'),
        totalLines: lines.length
      };
    });
    
    const duration = Date.now() - startTime;
    console.log(`${completed ? '✅' : '⏱️'} Command ${completed ? 'completed' : 'timed out'} (${duration}ms)`);
    
    return {
      success: completed,
      action,
      duration,
      params,
      result: {
        command,
        completed,
        ...result
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

module.exports = executeCommand;