const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting Context Pipeline - Opening Workspace IDE...');
  
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
  
  console.log('📊 Dashboard loaded!');
  
  // Step 1: Click on a workspace card
  console.log('\n📁 Step 1: Clicking on workspace card...');
  const workspaceClicked = await page.evaluate(() => {
    const titles = Array.from(document.querySelectorAll('h3'));
    const evpatariniTitle = titles.find(h3 => h3.textContent?.includes('Evpatarini/DavinEPV2-2'));
    if (evpatariniTitle) {
      evpatariniTitle.click();
      return true;
    }
    // If not found, try clicking any workspace
    const anyWorkspace = titles.find(h3 => h3.textContent?.includes('Workspace'));
    if (anyWorkspace) {
      anyWorkspace.click();
      return true;
    }
    return false;
  });
  
  if (workspaceClicked) {
    console.log('✅ Clicked on workspace card');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Click the expand button
    console.log('\n📂 Step 2: Looking for expand button...');
    const expandClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const expandButton = buttons.find(btn => 
        btn.textContent?.includes('▶') && 
        btn.textContent?.includes('Workspace')
      );
      
      if (expandButton) {
        console.log('Found button:', expandButton.textContent);
        expandButton.click();
        return expandButton.textContent;
      }
      return null;
    });
    
    if (expandClicked) {
      console.log(`✅ Clicked expand button: "${expandClicked}"`);
      console.log('⏳ Waiting for workspace IDE to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Take screenshot of the IDE
      await page.screenshot({ path: 'analysis/workspace-ide-opened.png', fullPage: true });
      console.log('📸 Workspace IDE screenshot saved');
      
      // Analyze the loaded workspace
      console.log('\n🔍 Analyzing Workspace IDE...');
      const ideAnalysis = await page.evaluate(() => {
        const analysis = {
          url: window.location.href,
          title: document.title,
          components: {
            fileExplorer: document.querySelector('.file-explorer, .file-tree, .explorer, .tree, [data-testid*="file"]') !== null,
            monacoEditor: document.querySelector('.monaco-editor, .editor-container, .code-editor, [data-testid*="editor"]') !== null,
            terminal: document.querySelector('.terminal, .xterm, .console, [data-testid*="terminal"]') !== null,
            sidebar: document.querySelector('.sidebar, .side-panel, .left-panel') !== null,
            toolbar: document.querySelector('.toolbar, .actions, [role="toolbar"]') !== null,
            tabs: document.querySelector('.tabs, .tab-container, [role="tablist"]') !== null
          },
          panels: [],
          buttons: [],
          files: []
        };
        
        // Find all major panels/sections
        const panels = document.querySelectorAll('.panel, .pane, [role="region"], .workspace-section');
        analysis.panels = Array.from(panels).map(panel => ({
          className: panel.className,
          role: panel.getAttribute('role'),
          hasContent: panel.textContent?.length > 0
        })).slice(0, 5);
        
        // Get visible buttons
        const buttons = Array.from(document.querySelectorAll('button')).slice(0, 15);
        analysis.buttons = buttons.map(btn => btn.textContent?.trim()).filter(text => text && text.length > 0);
        
        // Look for file listings
        const fileElements = Array.from(document.querySelectorAll('[data-testid*="file"], .file-item, .tree-item'));
        analysis.files = fileElements.map(el => el.textContent?.trim()).filter(text => text && text.length > 0).slice(0, 10);
        
        // Check for Monaco editor instances
        analysis.monacoInstances = document.querySelectorAll('.monaco-editor').length;
        
        // Look for agent-related features
        const agentElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent?.toLowerCase() || '';
          return text.includes('claude') || text.includes('gemini') || text.includes('agent');
        });
        analysis.hasAgentFeatures = agentElements.length > 0;
        
        return analysis;
      });
      
      console.log('\n🏗️ Workspace IDE Analysis:');
      console.log(`📄 Title: ${ideAnalysis.title}`);
      console.log(`🔗 URL: ${ideAnalysis.url}`);
      
      console.log('\n📦 IDE Components:');
      console.log(`   📁 File Explorer: ${ideAnalysis.components.fileExplorer ? '✅' : '❌'}`);
      console.log(`   📝 Monaco Editor: ${ideAnalysis.components.monacoEditor ? '✅' : '❌'} (${ideAnalysis.monacoInstances} instances)`);
      console.log(`   💻 Terminal: ${ideAnalysis.components.terminal ? '✅' : '❌'}`);
      console.log(`   📊 Sidebar: ${ideAnalysis.components.sidebar ? '✅' : '❌'}`);
      console.log(`   🔧 Toolbar: ${ideAnalysis.components.toolbar ? '✅' : '❌'}`);
      console.log(`   📑 Tabs: ${ideAnalysis.components.tabs ? '✅' : '❌'}`);
      console.log(`   🤖 Agent Features: ${ideAnalysis.hasAgentFeatures ? '✅' : '❌'}`);
      
      if (ideAnalysis.panels.length > 0) {
        console.log('\n📋 Workspace Panels:');
        ideAnalysis.panels.forEach((panel, i) => {
          console.log(`   ${i + 1}. ${panel.className || 'unnamed'} (role: ${panel.role || 'none'})`);
        });
      }
      
      if (ideAnalysis.buttons.length > 0) {
        console.log('\n🔘 Available Actions:');
        ideAnalysis.buttons.forEach((btn, i) => {
          console.log(`   ${i + 1}. ${btn}`);
        });
      }
      
      if (ideAnalysis.files.length > 0) {
        console.log('\n📄 Files in Explorer:');
        ideAnalysis.files.forEach((file, i) => {
          console.log(`   ${i + 1}. ${file}`);
        });
      }
      
      // Try to interact with some features
      console.log('\n🧪 Testing IDE interactions...');
      
      // Test: Try to find and click Claude/Gemini agent button
      const agentButtonClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const agentButton = buttons.find(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          return text.includes('claude') || text.includes('gemini') || text.includes('agent');
        });
        
        if (agentButton) {
          agentButton.click();
          return agentButton.textContent;
        }
        return null;
      });
      
      if (agentButtonClicked) {
        console.log(`✅ Clicked agent button: "${agentButtonClicked}"`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        await page.screenshot({ path: 'analysis/agent-panel-opened.png' });
        console.log('📸 Agent panel screenshot saved');
      }
      
    } else {
      console.log('❌ Could not find expand button');
    }
  } else {
    console.log('❌ Could not click on workspace card');
  }
  
  console.log('\n🎉 Workspace IDE exploration complete!');
  console.log('📁 Screenshots saved to analysis/');
  console.log('👀 Browser will stay open for 30 seconds to explore...');
  
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  await browser.close();
  console.log('✅ Browser closed.');
})().catch(console.error);