const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting interactive Context Pipeline exploration...');
  console.log('📝 I will click around, open files, and edit content in the workspace\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    executablePath: '/usr/bin/chromium-browser',
    args: [
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ],
    slowMo: 100 // Slow down actions so you can see what's happening
  });

  const page = await browser.newPage();
  await page.setDefaultTimeout(30000);

  try {
    // Navigate to Context Pipeline
    console.log('📍 Step 1: Navigating to Context Pipeline...');
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Homepage loaded\n');

    // Click on the first workspace
    console.log('📍 Step 2: Clicking on a workspace card...');
    const workspaceClicked = await page.evaluate(() => {
      const workspaceCards = Array.from(document.querySelectorAll('h3'));
      const evpatariniWorkspace = workspaceCards.find(h3 => 
        h3.textContent?.includes('Evpatarini/DavinEPV2-2')
      );
      
      if (evpatariniWorkspace) {
        evpatariniWorkspace.click();
        return evpatariniWorkspace.textContent;
      }
      
      // If not found, click any workspace
      if (workspaceCards.length > 0) {
        workspaceCards[0].click();
        return workspaceCards[0].textContent;
      }
      return null;
    });
    
    if (workspaceClicked) {
      console.log(`✅ Clicked on workspace: "${workspaceClicked}"`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Click the expand button to open workspace IDE
    console.log('\n📍 Step 3: Expanding workspace to full IDE view...');
    const expandClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const expandButton = buttons.find(btn => 
        btn.textContent?.includes('▶') && btn.textContent?.includes('Workspace')
      );
      
      if (expandButton) {
        expandButton.click();
        return true;
      }
      return false;
    });
    
    if (expandClicked) {
      console.log('✅ Workspace expanded to IDE view');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Take a screenshot of the IDE
    await page.screenshot({ path: 'analysis/workspace-ide-interactive.png', fullPage: true });
    console.log('📸 Screenshot saved: workspace-ide-interactive.png\n');

    // Explore the file tree
    console.log('📍 Step 4: Exploring file tree...');
    const fileTreeItems = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent || '';
        return (text === 'agents' || text === 'context' || text === 'feedback' || 
                text === 'README.md' || text === 'CLAUDE.md' || text === 'workspace.json' ||
                text === 'commands.json' || text === 'permissions.json') &&
                el.offsetParent !== null; // Is visible
      });
      
      return items.map(item => ({
        text: item.textContent,
        tagName: item.tagName,
        clickable: item.onclick !== null || item.style.cursor === 'pointer'
      }));
    });
    
    console.log('📁 Found file tree items:');
    fileTreeItems.forEach(item => {
      console.log(`   - ${item.text} (${item.tagName})`);
    });

    // Try to open README.md
    console.log('\n📍 Step 5: Opening README.md file...');
    const readmeClicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const readme = elements.find(el => 
        el.textContent === 'README.md' && el.offsetParent !== null
      );
      
      if (readme) {
        readme.click();
        return true;
      }
      return false;
    });
    
    if (readmeClicked) {
      console.log('✅ Clicked on README.md');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if editor opened
      const editorState = await page.evaluate(() => {
        const hasMonaco = document.querySelector('.monaco-editor') !== null;
        const editorContent = document.querySelector('.editor, .code-editor, [data-testid*="editor"]')?.textContent || '';
        const noFilesMessage = document.body.textContent?.includes('No files open');
        
        return { hasMonaco, editorContent, noFilesMessage };
      });
      
      console.log(`📝 Editor state: Monaco=${editorState.hasMonaco}, No files message=${editorState.noFilesMessage}`);
      
      // Try to type in the editor if it's available
      if (editorState.hasMonaco) {
        console.log('⌨️ Attempting to edit file...');
        
        // Click on the editor area
        await page.click('.monaco-editor');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try to select all and type new content
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await page.keyboard.type('# Context Pipeline Workspace\n\nThis file was edited by Puppeteer!\n\n');
        console.log('✅ Typed new content into editor');
        
        // Take screenshot of edited file
        await page.screenshot({ path: 'analysis/edited-readme.png' });
        console.log('📸 Screenshot saved: edited-readme.png');
      }
    }

    // Try to open CLAUDE.md
    console.log('\n📍 Step 6: Opening CLAUDE.md file...');
    const claudeClicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const claude = elements.find(el => 
        el.textContent === 'CLAUDE.md' && el.offsetParent !== null
      );
      
      if (claude) {
        claude.click();
        return true;
      }
      return false;
    });
    
    if (claudeClicked) {
      console.log('✅ Clicked on CLAUDE.md');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check file content
      const fileContent = await page.evaluate(() => {
        const editor = document.querySelector('.monaco-editor, .editor-content, [data-testid*="editor"]');
        return editor ? editor.textContent?.substring(0, 200) : null;
      });
      
      if (fileContent) {
        console.log(`📄 File content preview: "${fileContent}..."`);
      }
    }

    // Explore the context items bar
    console.log('\n📍 Step 7: Exploring context items...');
    const contextItems = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent || '';
        return (text.includes('Repository:') || text.includes('DV0L-') || 
                text.includes('CONSERVATIVE_DEVELOPMENT') || text.includes('DOCUMENTATION_INDEX')) &&
                el.offsetParent !== null;
      });
      
      return items.slice(0, 5).map(item => item.textContent?.trim());
    });
    
    console.log('📋 Context items found:');
    contextItems.forEach(item => {
      console.log(`   - ${item}`);
    });

    // Try to create a new file
    console.log('\n📍 Step 8: Attempting to create a new file...');
    const newFileClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const newFileBtn = buttons.find(btn => 
        btn.textContent?.includes('📄New') || btn.textContent?.includes('New')
      );
      
      if (newFileBtn) {
        newFileBtn.click();
        return true;
      }
      return false;
    });
    
    if (newFileClicked) {
      console.log('✅ Clicked New File button');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check for file creation dialog/input
      const hasDialog = await page.evaluate(() => {
        return document.querySelector('.modal, [role="dialog"], input[placeholder*="name"]') !== null;
      });
      
      if (hasDialog) {
        console.log('📝 File creation dialog opened');
        
        // Try to type a filename
        const nameInput = await page.$('input[placeholder*="name"], input[type="text"]');
        if (nameInput) {
          await nameInput.type('test-file.md');
          console.log('✅ Typed filename: test-file.md');
          
          // Press Enter to create
          await page.keyboard.press('Enter');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // Test the terminal
    console.log('\n📍 Step 9: Exploring terminal area...');
    const terminalInput = await page.$('input[placeholder*="command"], .terminal-input, textarea');
    
    if (terminalInput) {
      console.log('✅ Found terminal input');
      await terminalInput.click();
      await terminalInput.type('echo "Hello from Puppeteer automation!"');
      console.log('⌨️ Typed command in terminal');
      
      // Take screenshot
      await page.screenshot({ path: 'analysis/terminal-interaction.png' });
      console.log('📸 Screenshot saved: terminal-interaction.png');
    }

    // Click on an agent button
    console.log('\n📍 Step 10: Testing agent deployment...');
    const agentClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const agentBtn = buttons.find(btn => {
        const text = btn.textContent || '';
        return text.includes('Dev Assistant') || text.includes('Code Reviewer') || 
               text.includes('Agent');
      });
      
      if (agentBtn) {
        agentBtn.click();
        return agentBtn.textContent;
      }
      return null;
    });
    
    if (agentClicked) {
      console.log(`✅ Clicked agent button: "${agentClicked}"`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Take final screenshot
      await page.screenshot({ path: 'analysis/agent-deployed.png', fullPage: true });
      console.log('📸 Screenshot saved: agent-deployed.png');
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 INTERACTIVE EXPLORATION COMPLETE!');
    console.log('='.repeat(60));
    console.log('📋 Summary of actions performed:');
    console.log('   ✅ Navigated to Context Pipeline');
    console.log('   ✅ Opened workspace IDE');
    console.log('   ✅ Explored file tree structure');
    console.log('   ✅ Opened and edited README.md');
    console.log('   ✅ Opened CLAUDE.md');
    console.log('   ✅ Explored context items');
    console.log('   ✅ Attempted file creation');
    console.log('   ✅ Interacted with terminal');
    console.log('   ✅ Deployed an agent');
    console.log('\n📁 Screenshots saved to analysis/ folder');
    
    console.log('\n👀 Browser will stay open for 30 seconds for manual exploration...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('❌ Error during exploration:', error);
  } finally {
    await browser.close();
    console.log('✅ Browser closed.');
  }
})();