const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting Context Pipeline workspace IDE navigation...');
  
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
  
  console.log('📊 Dashboard loaded successfully!');
  
  // Take dashboard screenshot
  await page.screenshot({ path: 'analysis/full-dashboard.png', fullPage: true });
  console.log('📸 Dashboard screenshot with Context Library saved');
  
  // Try to navigate to a workspace by clicking more precisely
  console.log('\n🏗️ Attempting to open workspace IDE...');
  
  // Method 1: Try clicking on the workspace title
  try {
    console.log('Method 1: Clicking on workspace title...');
    const workspaceTitleClicked = await page.evaluate(() => {
      const titles = Array.from(document.querySelectorAll('h3'));
      const evpatariniTitle = titles.find(h3 => h3.textContent?.includes('Evpatarini/DavinEPV2-2'));
      if (evpatariniTitle) {
        evpatariniTitle.click();
        return true;
      }
      return false;
    });
    
    if (workspaceTitleClicked) {
      console.log('✅ Clicked workspace title');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  } catch (e) {
    console.log('❌ Method 1 failed');
  }
  
  // Check if we navigated
  let currentUrl = await page.url();
  console.log(`Current URL: ${currentUrl}`);
  
  if (currentUrl === 'http://localhost:3001/') {
    // Method 2: Try clicking the entire workspace card
    console.log('\nMethod 2: Clicking workspace card container...');
    try {
      const cardClicked = await page.evaluate(() => {
        // Find all elements that contain the workspace text
        const elements = Array.from(document.querySelectorAll('*'));
        const workspaceCard = elements.find(el => {
          const hasText = el.textContent?.includes('Evpatarini/DavinEPV2-2');
          const hasStats = el.textContent?.includes('🤖') && el.textContent?.includes('📊');
          const isNotTooLarge = el.offsetHeight < 300; // Not the entire page
          return hasText && hasStats && isNotTooLarge;
        });
        
        if (workspaceCard) {
          // Try to find a clickable parent or the element itself
          let clickTarget = workspaceCard;
          let parent = workspaceCard.parentElement;
          
          // Look for a parent that might be the actual card container
          while (parent && parent !== document.body) {
            if (parent.onclick || parent.style.cursor === 'pointer' || 
                parent.className?.includes('card') || parent.className?.includes('workspace')) {
              clickTarget = parent;
              break;
            }
            parent = parent.parentElement;
          }
          
          clickTarget.click();
          return true;
        }
        return false;
      });
      
      if (cardClicked) {
        console.log('✅ Clicked workspace card');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (e) {
      console.log('❌ Method 2 failed');
    }
  }
  
  // Check URL again
  currentUrl = await page.url();
  console.log(`Current URL after attempts: ${currentUrl}`);
  
  // If we're still on the main page, try looking for any navigation links
  if (currentUrl === 'http://localhost:3001/') {
    console.log('\nMethod 3: Looking for workspace links or buttons...');
    const navigationOptions = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const buttons = Array.from(document.querySelectorAll('button'));
      
      const workspaceLinks = links.filter(link => 
        link.href && link.href.includes('workspace')
      ).map(link => ({ text: link.textContent, href: link.href }));
      
      const actionButtons = buttons.filter(btn => {
        const text = btn.textContent?.toLowerCase() || '';
        return text.includes('open') || text.includes('view') || 
               text.includes('enter') || text.includes('workspace');
      }).map(btn => btn.textContent);
      
      return { workspaceLinks, actionButtons };
    });
    
    console.log('Navigation options found:');
    console.log('Links:', navigationOptions.workspaceLinks);
    console.log('Action buttons:', navigationOptions.actionButtons);
    
    // If there are workspace links, navigate to the first one
    if (navigationOptions.workspaceLinks.length > 0) {
      const targetUrl = navigationOptions.workspaceLinks[0].href;
      console.log(`Navigating to: ${targetUrl}`);
      await page.goto(targetUrl);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Final URL check
  currentUrl = await page.url();
  console.log(`\n📍 Final URL: ${currentUrl}`);
  
  // If we navigated to a workspace, analyze the IDE
  if (currentUrl !== 'http://localhost:3001/') {
    console.log('\n🎉 Successfully navigated to workspace IDE!');
    await page.screenshot({ path: 'analysis/workspace-ide-full.png', fullPage: true });
    console.log('📸 Workspace IDE screenshot saved');
    
    // Analyze IDE features
    const ideFeatures = await page.evaluate(() => {
      const features = {
        url: window.location.href,
        title: document.title,
        fileExplorer: {
          exists: document.querySelector('.file-explorer, .file-tree, .explorer, .files') !== null,
          selector: document.querySelector('.file-explorer, .file-tree, .explorer, .files')?.className
        },
        editor: {
          exists: document.querySelector('.monaco-editor, .editor, .code-editor') !== null,
          selector: document.querySelector('.monaco-editor, .editor, .code-editor')?.className
        },
        terminal: {
          exists: document.querySelector('.terminal, .xterm, .console') !== null,
          selector: document.querySelector('.terminal, .xterm, .console')?.className
        },
        agentPanel: {
          exists: Array.from(document.querySelectorAll('*')).some(el => 
            el.textContent?.toLowerCase().includes('claude') ||
            el.textContent?.toLowerCase().includes('gemini')
          )
        },
        visibleButtons: Array.from(document.querySelectorAll('button'))
          .map(btn => btn.textContent?.trim())
          .filter(text => text && text.length > 0)
          .slice(0, 10)
      };
      
      return features;
    });
    
    console.log('\n🔍 Workspace IDE Analysis:');
    console.log(`📄 Title: ${ideFeatures.title}`);
    console.log(`🔗 URL: ${ideFeatures.url}`);
    console.log(`📁 File Explorer: ${ideFeatures.fileExplorer.exists ? '✅' : '❌'} ${ideFeatures.fileExplorer.selector || ''}`);
    console.log(`📝 Code Editor: ${ideFeatures.editor.exists ? '✅' : '❌'} ${ideFeatures.editor.selector || ''}`);
    console.log(`💻 Terminal: ${ideFeatures.terminal.exists ? '✅' : '❌'} ${ideFeatures.terminal.selector || ''}`);
    console.log(`🤖 Agent Panel: ${ideFeatures.agentPanel.exists ? '✅' : '❌'}`);
    console.log('\n🔘 Visible Buttons:');
    ideFeatures.visibleButtons.forEach((btn, i) => {
      console.log(`   ${i + 1}. ${btn}`);
    });
  } else {
    console.log('\n❌ Could not navigate to workspace IDE');
    console.log('The workspace cards might not be clickable or require different interaction');
    
    // Let's check what happens with double-click
    console.log('\nMethod 4: Trying double-click on workspace...');
    const doubleClicked = await page.evaluate(() => {
      const titles = Array.from(document.querySelectorAll('h3'));
      const evpatariniTitle = titles.find(h3 => h3.textContent?.includes('Evpatarini/DavinEPV2-2'));
      if (evpatariniTitle) {
        const event = new MouseEvent('dblclick', {
          view: window,
          bubbles: true,
          cancelable: true
        });
        evpatariniTitle.dispatchEvent(event);
        return true;
      }
      return false;
    });
    
    if (doubleClicked) {
      console.log('✅ Double-clicked workspace');
      await new Promise(resolve => setTimeout(resolve, 5000));
      currentUrl = await page.url();
      console.log(`URL after double-click: ${currentUrl}`);
    }
  }
  
  console.log('\n🎉 Navigation exploration complete!');
  console.log('📁 Screenshots saved to analysis/');
  console.log('👀 Browser will stay open for 20 seconds...');
  
  await new Promise(resolve => setTimeout(resolve, 20000));
  
  await browser.close();
  console.log('✅ Browser closed.');
})().catch(console.error);