const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting Context Pipeline workspace exploration...');
  
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
  
  console.log('📊 Page loaded! Looking for Context Library and workspace cards...');
  
  // First, let's check for Context Library loading
  console.log('\n📚 Checking Context Library status...');
  const contextLibraryStatus = await page.evaluate(() => {
    const libraryElements = Array.from(document.querySelectorAll('*')).filter(el =>
      el.textContent?.toLowerCase().includes('context library') ||
      el.textContent?.toLowerCase().includes('library') ||
      el.className?.toLowerCase().includes('library')
    );
    return libraryElements.length;
  });
  console.log(`Found ${contextLibraryStatus} library-related elements`);
  
  // Check API calls to see if library is loading
  page.on('response', response => {
    if (response.url().includes('/api/context-workflow/library')) {
      console.log(`📚 Context Library API call: ${response.status()} - ${response.url()}`);
    }
  });
  
  // Take initial screenshot
  await page.screenshot({ path: 'analysis/dashboard-view.png', fullPage: true });
  console.log('📸 Dashboard screenshot saved');
  
  // Now let's click on a workspace card
  console.log('\n🏗️ Looking for workspace cards to click...');
  
  // Find clickable workspace cards
  const workspaceCards = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div')).filter(div => {
      const text = div.textContent || '';
      return (text.includes('Workspace') && text.includes('ago')) || 
             text.includes('Repository:') ||
             div.className?.includes('workspace');
    });
    return cards.map(card => ({
      text: card.textContent?.trim().substring(0, 100),
      className: card.className
    }));
  });
  
  console.log(`Found ${workspaceCards.length} workspace cards:`);
  workspaceCards.forEach((card, i) => {
    console.log(`  ${i+1}. ${card.text}`);
  });
  
  // Try to click the first workspace card
  console.log('\n🖱️ Attempting to click on first workspace card...');
  try {
    // Try to click on the Evpatarini workspace
    const clicked = await page.evaluate(() => {
      const workspaceElements = Array.from(document.querySelectorAll('*'));
      const workspace = workspaceElements.find(el => 
        el.textContent?.includes('Evpatarini/DavinEPV2-2') &&
        (el.tagName === 'DIV' || el.tagName === 'A' || el.tagName === 'BUTTON')
      );
      
      if (workspace) {
        // Try clicking the element
        workspace.click();
        return true;
      }
      
      // If not found, try clicking any element that looks like a workspace card
      const cards = workspaceElements.filter(el => {
        const hasWorkspaceText = el.textContent?.includes('Workspace');
        const hasStats = el.textContent?.includes('🤖') || el.textContent?.includes('📊');
        const isCard = el.className?.includes('card') || el.className?.includes('workspace');
        return (hasWorkspaceText || hasStats) && (isCard || el.parentElement?.className?.includes('card'));
      });
      
      if (cards.length > 0) {
        cards[0].click();
        return true;
      }
      
      return false;
    });
    
    if (clicked) {
      console.log('✅ Clicked on workspace card!');
      console.log('⏳ Waiting for workspace to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check what loaded
      const currentUrl = await page.url();
      console.log(`🔗 Current URL: ${currentUrl}`);
      
      // Take screenshot of workspace view
      await page.screenshot({ path: 'analysis/workspace-ide-view.png', fullPage: true });
      console.log('📸 Workspace IDE screenshot saved');
      
      // Analyze workspace features
      console.log('\n🔍 Analyzing workspace IDE features...');
      const workspaceFeatures = await page.evaluate(() => {
        const features = {
          fileExplorer: document.querySelector('.file-explorer, .file-tree, [data-testid*="file"], .tree-view, .explorer') !== null,
          monacoEditor: document.querySelector('.monaco-editor, .editor-container, [data-testid*="editor"]') !== null,
          terminal: document.querySelector('.terminal, .xterm, [data-testid*="terminal"]') !== null,
          toolbar: document.querySelector('.toolbar, .actions, [role="toolbar"]') !== null,
          tabs: document.querySelector('.tabs, .tab-container, [role="tablist"]') !== null,
          sidebar: document.querySelector('.sidebar, .side-panel') !== null,
          agentArea: Array.from(document.querySelectorAll('*')).some(el => 
            el.textContent?.toLowerCase().includes('claude') ||
            el.textContent?.toLowerCase().includes('gemini') ||
            el.textContent?.toLowerCase().includes('agent')
          )
        };
        
        // Get visible text elements
        const visibleText = Array.from(document.querySelectorAll('h1, h2, h3, button, [role="button"]'))
          .map(el => el.textContent?.trim())
          .filter(text => text && text.length > 0)
          .slice(0, 20);
        
        return { features, visibleText };
      });
      
      console.log('🎨 Workspace IDE Features:');
      console.log(`   📁 File Explorer: ${workspaceFeatures.features.fileExplorer ? '✅' : '❌'}`);
      console.log(`   📝 Monaco Editor: ${workspaceFeatures.features.monacoEditor ? '✅' : '❌'}`);
      console.log(`   💻 Terminal: ${workspaceFeatures.features.terminal ? '✅' : '❌'}`);
      console.log(`   🔧 Toolbar: ${workspaceFeatures.features.toolbar ? '✅' : '❌'}`);
      console.log(`   📑 Tabs: ${workspaceFeatures.features.tabs ? '✅' : '❌'}`);
      console.log(`   📊 Sidebar: ${workspaceFeatures.features.sidebar ? '✅' : '❌'}`);
      console.log(`   🤖 Agent Features: ${workspaceFeatures.features.agentArea ? '✅' : '❌'}`);
      
      console.log('\n📋 Visible UI Elements:');
      workspaceFeatures.visibleText.forEach((text, i) => {
        console.log(`   ${i+1}. "${text}"`);
      });
      
      // Try to find and click agent deployment buttons
      console.log('\n🤖 Looking for agent deployment options...');
      const agentButtons = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        return buttons
          .filter(btn => {
            const text = btn.textContent?.toLowerCase() || '';
            return text.includes('claude') || text.includes('gemini') || 
                   text.includes('agent') || text.includes('deploy');
          })
          .map(btn => btn.textContent?.trim());
      });
      
      if (agentButtons.length > 0) {
        console.log('🤖 Found agent deployment options:');
        agentButtons.forEach(btn => console.log(`   - ${btn}`));
      }
      
      // Navigate back to see context library
      console.log('\n🏠 Returning to dashboard to check Context Library...');
      await page.goto('http://localhost:3001');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try clicking Import from Library to see if it loads context
      console.log('📚 Clicking "Import from Library" to check Context Library...');
      const importClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const importBtn = buttons.find(btn => btn.textContent?.includes('Import from Library'));
        if (importBtn) {
          importBtn.click();
          return true;
        }
        return false;
      });
      
      if (importClicked) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        await page.screenshot({ path: 'analysis/context-library-modal.png', fullPage: true });
        console.log('📸 Context Library modal screenshot saved');
        
        // Check what's in the library
        const libraryContent = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('.library-item, .context-item, [data-testid*="library"]'));
          const modalContent = document.querySelector('.modal, [role="dialog"]')?.textContent || '';
          return {
            itemCount: items.length,
            hasModal: modalContent.length > 0,
            modalPreview: modalContent.substring(0, 200)
          };
        });
        
        console.log(`📚 Context Library Status:`);
        console.log(`   Items found: ${libraryContent.itemCount}`);
        console.log(`   Modal opened: ${libraryContent.hasModal ? '✅' : '❌'}`);
        if (libraryContent.modalPreview) {
          console.log(`   Modal content preview: "${libraryContent.modalPreview}..."`);
        }
      }
      
    } else {
      console.log('❌ Could not find clickable workspace card');
    }
    
  } catch (error) {
    console.log(`❌ Error exploring workspace: ${error.message}`);
  }
  
  console.log('\n🎉 Exploration complete!');
  console.log('📁 Screenshots saved:');
  console.log('   - analysis/dashboard-view.png');
  console.log('   - analysis/workspace-ide-view.png');
  console.log('   - analysis/context-library-modal.png');
  console.log('👀 Browser will stay open for 15 seconds...');
  
  await new Promise(resolve => setTimeout(resolve, 15000));
  
  await browser.close();
  console.log('✅ Browser closed.');
})().catch(console.error);