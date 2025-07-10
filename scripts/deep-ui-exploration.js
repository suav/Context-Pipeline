const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting deep Context Pipeline UI exploration...');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    executablePath: '/usr/bin/chromium-browser',
    args: [
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
  
  const page = await browser.newPage();
  await page.setDefaultTimeout(30000);
  
  console.log('🌐 Navigating to Context Pipeline...');
  await page.goto('http://localhost:3001');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('📊 Initial page analysis...');
  
  // Get basic page info
  const title = await page.title();
  console.log(`📄 Title: ${title}`);
  
  // Discovered UI elements from previous exploration
  console.log('\n🎯 Context Pipeline UI Analysis:');
  console.log('✅ Found main workspace dashboard');
  console.log('✅ Settings button (☰Settings)');
  console.log('✅ Create New Workspace button (➕Create New Workspace)');
  console.log('✅ Import from Library button (📚Import from Library)');
  console.log('✅ Browse Templates button (📋Browse Templates)');
  console.log('✅ Existing workspace: "Repository: Evpatarini/DavinEPV2-2"');
  console.log('✅ Workspace stats: 🤖0 agents, 📊7 items');
  
  // Test 1: Try to create a new workspace
  console.log('\n🆕 Test 1: Exploring Workspace Creation...');
  try {
    const createButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent?.includes('Create New Workspace'));
    });
    
    if (createButton.asElement()) {
      console.log('🖱️  Clicking "Create New Workspace"...');
      await createButton.asElement().click();
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check for modal or form
      const modalExists = await page.evaluate(() => {
        return document.querySelector('.modal, [role="dialog"], .popup, .create-workspace') !== null;
      });
      
      if (modalExists) {
        console.log('✅ Workspace creation modal opened');
        
        // Take screenshot of modal
        await page.screenshot({ path: 'analysis/workspace-creation-modal.png' });
        console.log('📸 Modal screenshot saved');
        
        // Look for form fields
        const formFields = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
          return inputs.map(input => ({
            type: input.type || input.tagName,
            placeholder: input.placeholder,
            name: input.name
          }));
        });
        
        console.log('📝 Form fields found:', formFields);
        
        // Try to close modal (ESC or close button)
        await page.keyboard.press('Escape');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log('❌ No modal detected after clicking create button');
      }
    }
  } catch (error) {
    console.log(`❌ Create workspace test failed: ${error.message}`);
  }
  
  // Test 2: Try to import from library
  console.log('\n📚 Test 2: Exploring Library Import...');
  try {
    const importButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent?.includes('Import from Library'));
    });
    
    if (importButton.asElement()) {
      console.log('🖱️  Clicking "Import from Library"...');
      await importButton.asElement().click();
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const modalExists = await page.evaluate(() => {
        return document.querySelector('.modal, [role="dialog"], .import-modal') !== null;
      });
      
      if (modalExists) {
        console.log('✅ Library import modal opened');
        await page.screenshot({ path: 'analysis/library-import-modal.png' });
        console.log('📸 Import modal screenshot saved');
        
        // Close modal
        await page.keyboard.press('Escape');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log('❌ No import modal detected');
      }
    }
  } catch (error) {
    console.log(`❌ Library import test failed: ${error.message}`);
  }
  
  // Test 3: Try to access existing workspace
  console.log('\n🏗️ Test 3: Exploring Existing Workspace...');
  try {
    const workspaceCard = await page.evaluateHandle(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.find(el => el.textContent?.includes('Evpatarini/DavinEPV2-2'));
    });
    
    if (workspaceCard.asElement()) {
      console.log('🖱️  Clicking on existing workspace...');
      await workspaceCard.asElement().click();
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check if we navigated to workspace view
      const currentUrl = await page.url();
      console.log(`🔗 Current URL: ${currentUrl}`);
      
      if (currentUrl !== 'http://localhost:3001/') {
        console.log('✅ Navigated to workspace view');
        await page.screenshot({ path: 'analysis/workspace-view.png', fullPage: true });
        console.log('📸 Workspace view screenshot saved');
        
        // Look for workspace features
        const workspaceFeatures = await page.evaluate(() => {
          const fileExplorer = document.querySelector('.file-explorer, [data-testid*="file"], .tree-view') !== null;
          const editor = document.querySelector('.monaco-editor, .editor, [data-testid*="editor"]') !== null;
          const terminal = document.querySelector('.terminal, [data-testid*="terminal"], .xterm') !== null;
          const agentButtons = Array.from(document.querySelectorAll('button')).filter(btn =>
            btn.textContent?.toLowerCase().includes('claude') ||
            btn.textContent?.toLowerCase().includes('gemini') ||
            btn.textContent?.toLowerCase().includes('agent')
          ).length;
          
          return { fileExplorer, editor, terminal, agentButtons };
        });
        
        console.log('🔧 Workspace features detected:');
        console.log(`   📁 File Explorer: ${workspaceFeatures.fileExplorer ? '✅' : '❌'}`);
        console.log(`   📝 Code Editor: ${workspaceFeatures.editor ? '✅' : '❌'}`);
        console.log(`   💻 Terminal: ${workspaceFeatures.terminal ? '✅' : '❌'}`);
        console.log(`   🤖 Agent buttons: ${workspaceFeatures.agentButtons}`);
        
        // Go back to home
        console.log('🏠 Returning to homepage...');
        await page.goto('http://localhost:3001');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log('❌ Did not navigate to workspace view');
      }
    }
  } catch (error) {
    console.log(`❌ Workspace access test failed: ${error.message}`);
  }
  
  // Test 4: Settings exploration
  console.log('\n⚙️ Test 4: Exploring Settings...');
  try {
    const settingsButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent?.includes('Settings'));
    });
    
    if (settingsButton.asElement()) {
      console.log('🖱️  Clicking Settings...');
      await settingsButton.asElement().click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check for settings panel/modal
      const settingsVisible = await page.evaluate(() => {
        return document.querySelector('.settings, [data-testid*="settings"], .config') !== null;
      });
      
      if (settingsVisible) {
        console.log('✅ Settings panel opened');
        await page.screenshot({ path: 'analysis/settings-panel.png' });
        console.log('📸 Settings screenshot saved');
      } else {
        console.log('❌ No settings panel detected');
      }
    }
  } catch (error) {
    console.log(`❌ Settings test failed: ${error.message}`);
  }
  
  // Test 5: Monitor API activity during interactions
  console.log('\n📡 Test 5: API Activity Monitoring...');
  const apiCalls = [];
  
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      apiCalls.push({
        url: response.url(),
        status: response.status(),
        method: response.request().method(),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Trigger some activity
  await page.reload();
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('📊 API Calls during session:');
  apiCalls.forEach(call => {
    console.log(`   ${call.method} ${call.url} - ${call.status} (${call.timestamp})`);
  });
  
  // Final comprehensive screenshot
  await page.screenshot({ path: 'analysis/final-ui-state.png', fullPage: true });
  console.log('📸 Final UI state screenshot saved');
  
  console.log('\n🎉 Deep UI exploration complete!');
  console.log('📁 Screenshots saved to analysis/ directory');
  console.log('👀 Browser will stay open for 20 more seconds...');
  
  await new Promise(resolve => setTimeout(resolve, 20000));
  
  await browser.close();
  console.log('✅ Browser closed.');
})().catch(console.error);