/**
 * Configure Workspace Permissions Primitive
 * 
 * Adds commands to the allowed list for a workspace through the application UI.
 * This tests the permission configuration system while setting up useful defaults.
 */

async function configurePermissions(page, params = {}) {
  const startTime = Date.now();
  const action = 'configure-permissions';
  
  try {
    const commands = params.commands || ['find', 'ls', 'cat', 'head', 'tail', 'grep'];
    const timeout = params.timeout || 10000;
    
    console.log(`⚙️ Configuring workspace permissions for commands: ${commands.join(', ')}`);
    
    // Look for Settings button
    console.log('🔍 Looking for Settings button...');
    const settingsSelector = 'button:has-text("Settings"), [aria-label*="Settings"], button[title*="Settings"]';
    
    await page.waitForSelector('button', { timeout });
    
    // Get all buttons and find Settings
    const settingsButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => 
        btn.textContent.includes('Settings') || 
        btn.title.includes('Settings') ||
        btn.getAttribute('aria-label')?.includes('Settings')
      );
    });
    
    if (!settingsButton) {
      // Try clicking the gear icon or settings area
      const settingsFound = await page.evaluate(() => {
        // Look for gear icon, settings text, or settings area
        const elements = Array.from(document.querySelectorAll('*'));
        const settingsEl = elements.find(el => 
          el.textContent === 'Settings' ||
          el.className.includes('settings') ||
          el.title?.includes('Settings')
        );
        if (settingsEl && settingsEl.click) {
          settingsEl.click();
          return true;
        }
        return false;
      });
      
      if (!settingsFound) {
        throw new Error('Settings button not found');
      }
    } else {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const settingsBtn = buttons.find(btn => 
          btn.textContent.includes('Settings') || 
          btn.title.includes('Settings') ||
          btn.getAttribute('aria-label')?.includes('Settings')
        );
        if (settingsBtn) settingsBtn.click();
      });
    }
    
    console.log('✅ Clicked Settings button');
    
    // Wait for settings panel to open
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Look for permissions or commands section
    console.log('🔍 Looking for permissions/commands section...');
    
    const permissionsSection = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.some(el => 
        el.textContent?.includes('Permissions') ||
        el.textContent?.includes('Commands') ||
        el.textContent?.includes('Allowed') ||
        el.textContent?.includes('Tool')
      );
    });
    
    if (permissionsSection) {
      console.log('✅ Found permissions section');
      
      // Look for command input or add command functionality
      const commandInputs = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, textarea'));
        return inputs.map(input => ({
          placeholder: input.placeholder,
          type: input.type,
          name: input.name,
          className: input.className
        }));
      });
      
      console.log('📋 Available inputs:', commandInputs);
      
      // Try to add each command
      for (const command of commands) {
        try {
          // Look for "Add Command" button or similar
          const addCommandResult = await page.evaluate((cmd) => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const addBtn = buttons.find(btn => 
              btn.textContent.includes('Add') ||
              btn.textContent.includes('Allow') ||
              btn.textContent.includes('Permit')
            );
            
            if (addBtn) {
              addBtn.click();
              return { success: true, buttonText: addBtn.textContent };
            }
            return { success: false };
          }, command);
          
          if (addCommandResult.success) {
            // Type the command
            const commandInput = await page.$('input[placeholder*="command"], input[type="text"]:not([placeholder*="search"])');
            if (commandInput) {
              await commandInput.type(command);
              await page.keyboard.press('Enter');
              console.log(`✅ Added command: ${command}`);
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.log(`⚠️ Could not add command ${command}: ${error.message}`);
        }
      }
    } else {
      console.log('⚠️ No permissions section found in settings');
    }
    
    // Close settings (try Escape key)
    await page.keyboard.press('Escape');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      action,
      duration,
      params,
      result: {
        commandsAttempted: commands,
        permissionsSectionFound: permissionsSection
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

module.exports = configurePermissions;