/**
 * Discover Available Agent Commands
 * 
 * Uses "/" to discover and catalog available commands in the agent terminal
 */

async function discoverCommands(page, params = {}) {
  const startTime = Date.now();
  const action = 'discover-commands';
  
  try {
    const timeout = params.timeout || 10000;
    
    console.log(`🔍 Discovering available agent commands...`);
    
    // Find the agent input field
    await page.waitForSelector('[placeholder*="command"]', { timeout });
    
    // Type "/" to open command picker
    const discoveryResult = await page.evaluate(() => {
      const input = document.querySelector('[placeholder*="command"]');
      if (!input) {
        return { success: false, error: 'No command input found' };
      }
      
      // Clear input and type "/"
      input.focus();
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Simulate typing "/"
      const event = new KeyboardEvent('keydown', {
        key: '/',
        code: 'Slash',
        keyCode: 191,
        charCode: 47,
        bubbles: true
      });
      input.dispatchEvent(event);
      
      // Type the actual character
      input.value = '/';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      
      return { success: true };
    });
    
    if (!discoveryResult.success) {
      throw new Error(discoveryResult.error);
    }
    
    // Wait for command picker to appear
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Extract available commands
    const commands = await page.evaluate(() => {
      // Look for command picker UI elements
      const commandElements = Array.from(document.querySelectorAll('div, li, span')).filter(el => {
        const text = el.textContent || '';
        const isCommand = text.includes('/') && text.length < 100;
        const hasDescription = el.querySelector('*') || text.includes(':') || text.includes('-');
        return isCommand && (hasDescription || text.trim().startsWith('/'));
      });
      
      const commands = commandElements.map(el => {
        const text = el.textContent.trim();
        const lines = text.split('\n').filter(line => line.trim());
        
        // Try to extract command name and description
        let command = '';
        let description = '';
        
        if (text.includes('/')) {
          const parts = text.split(/[:\-]/);
          command = parts[0].trim();
          description = parts.slice(1).join(':').trim();
        } else {
          command = text;
        }
        
        return {
          command: command.replace(/[^\w\/\-]/g, '').trim(),
          description: description.substring(0, 100),
          fullText: text.substring(0, 150)
        };
      }).filter(cmd => cmd.command.length > 0 && cmd.command.startsWith('/'));
      
      // Also look for any visible command list
      const commandList = document.body.textContent;
      const commandMatches = [...commandList.matchAll(/\/\w+/g)];
      const foundCommands = [...new Set(commandMatches.map(match => match[0]))];
      
      return {
        parsedCommands: commands,
        foundCommands,
        totalFound: Math.max(commands.length, foundCommands.length)
      };
    });
    
    // Clear the input
    await page.evaluate(() => {
      const input = document.querySelector('[placeholder*="command"]');
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.blur();
      }
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ Discovered ${commands.totalFound} commands (${duration}ms)`);
    
    // Log discovered commands
    if (commands.parsedCommands.length > 0) {
      console.log('📋 Available Commands:');
      commands.parsedCommands.forEach(cmd => {
        console.log(`   ${cmd.command}: ${cmd.description || 'No description'}`);
      });
    }
    
    if (commands.foundCommands.length > 0) {
      console.log('🔧 Found Commands:', commands.foundCommands.join(', '));
    }
    
    return {
      success: true,
      action,
      duration,
      params,
      result: {
        commands: commands.parsedCommands,
        foundCommands: commands.foundCommands,
        totalFound: commands.totalFound
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

module.exports = discoverCommands;