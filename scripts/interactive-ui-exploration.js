const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting interactive Context Pipeline exploration...');
  
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
  
  console.log('📊 Page loaded! Let me explore the UI...');
  
  // Get basic page info
  const title = await page.title();
  const url = await page.url();
  console.log(`📄 Title: ${title}`);
  console.log(`🔗 URL: ${url}`);
  
  // Count key elements
  const buttonCount = await page.$$eval('button', btns => btns.length);
  const divCount = await page.$$eval('div', divs => divs.length);
  console.log(`🔘 Found ${buttonCount} buttons, ${divCount} divs`);
  
  // Look for main sections
  const pageText = await page.evaluate(() => document.body.textContent);
  console.log(`📝 Page contains ${pageText.length} characters of text`);
  
  // Find key UI elements by analyzing text content
  const uiElements = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*')).filter(el => 
      el.textContent && el.textContent.trim().length > 0 && el.textContent.length < 50
    );
    
    return elements.slice(0, 20).map(el => ({
      tag: el.tagName,
      text: el.textContent.trim(),
      className: el.className
    }));
  });
  
  console.log('🎯 Key UI Elements found:');
  uiElements.forEach((el, i) => {
    if (el.text.length > 0) {
      console.log(`   ${i+1}. ${el.tag}: "${el.text}"`);
    }
  });
  
  // Look for interactive elements
  const interactiveElements = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map(btn => btn.textContent?.trim()).filter(text => text && text.length > 0);
    const links = Array.from(document.querySelectorAll('a')).map(link => link.textContent?.trim()).filter(text => text && text.length > 0);
    const inputs = Array.from(document.querySelectorAll('input, textarea')).map(input => input.placeholder || input.type || 'input');
    
    return { buttons, links, inputs };
  });
  
  console.log('🔧 Interactive Elements:');
  console.log(`   Buttons: [${interactiveElements.buttons.join(', ')}]`);
  console.log(`   Links: [${interactiveElements.links.join(', ')}]`);
  console.log(`   Inputs: [${interactiveElements.inputs.join(', ')}]`);
  
  // Take a screenshot
  await page.screenshot({ path: 'analysis/ui-exploration.png', fullPage: true });
  console.log('📸 Screenshot saved to analysis/ui-exploration.png');
  
  // Test clicking the first button if available
  const firstButton = await page.$('button');
  if (firstButton) {
    const buttonText = await firstButton.evaluate(btn => btn.textContent?.trim());
    console.log(`🖱️  Clicking first button: "${buttonText}"`);
    await firstButton.click();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check what changed
    const newTitle = await page.title();
    console.log(`📄 After click - Title: ${newTitle}`);
  }
  
  // Explore for modals or popups
  const modals = await page.$$('[role="dialog"], .modal, .popup');
  console.log(`🏢 Found ${modals.length} modal/dialog elements`);
  
  // Look for navigation elements
  const navElements = await page.evaluate(() => {
    const navs = Array.from(document.querySelectorAll('nav, [role="navigation"], .nav, .navbar, .menu'));
    return navs.map(nav => ({
      tag: nav.tagName,
      className: nav.className,
      text: nav.textContent?.trim().substring(0, 100)
    }));
  });
  
  console.log('🧭 Navigation elements:');
  navElements.forEach((nav, i) => {
    console.log(`   ${i+1}. ${nav.tag}.${nav.className}: "${nav.text}"`);
  });
  
  // Look for Context Pipeline specific features
  const contextFeatures = await page.evaluate(() => {
    const workspaceElements = Array.from(document.querySelectorAll('*')).filter(el =>
      el.textContent?.toLowerCase().includes('workspace')
    ).length;
    
    const contextElements = Array.from(document.querySelectorAll('*')).filter(el =>
      el.textContent?.toLowerCase().includes('context')
    ).length;
    
    const agentElements = Array.from(document.querySelectorAll('*')).filter(el =>
      el.textContent?.toLowerCase().includes('agent') ||
      el.textContent?.toLowerCase().includes('claude') ||
      el.textContent?.toLowerCase().includes('gemini')
    ).length;
    
    const libraryElements = Array.from(document.querySelectorAll('*')).filter(el =>
      el.textContent?.toLowerCase().includes('library')
    ).length;
    
    return { workspaceElements, contextElements, agentElements, libraryElements };
  });
  
  console.log('🎨 Context Pipeline Features Detected:');
  console.log(`   📁 Workspace elements: ${contextFeatures.workspaceElements}`);
  console.log(`   📋 Context elements: ${contextFeatures.contextElements}`);
  console.log(`   🤖 Agent elements: ${contextFeatures.agentElements}`);
  console.log(`   📚 Library elements: ${contextFeatures.libraryElements}`);
  
  // Try to find and interact with specific features
  console.log('\n🔍 Exploring specific features...');
  
  // Look for workspace creation
  const createWorkspaceButton = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const createBtn = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('create') ||
      btn.textContent?.toLowerCase().includes('new')
    );
    return createBtn ? createBtn.textContent?.trim() : null;
  });
  
  if (createWorkspaceButton) {
    console.log(`✨ Found workspace creation: "${createWorkspaceButton}"`);
  }
  
  // Look for import functionality
  const importButton = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const importBtn = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('import') ||
      btn.textContent?.toLowerCase().includes('add')
    );
    return importBtn ? importBtn.textContent?.trim() : null;
  });
  
  if (importButton) {
    console.log(`📥 Found import functionality: "${importButton}"`);
  }
  
  // Monitor API calls
  const apiCalls = [];
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      apiCalls.push({
        url: response.url(),
        status: response.status(),
        method: response.request().method()
      });
    }
  });
  
  // Refresh to trigger API calls
  console.log('🔄 Refreshing to monitor API activity...');
  await page.reload();
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('📡 API Activity:');
  apiCalls.forEach(call => {
    console.log(`   ${call.method} ${call.url} - ${call.status}`);
  });
  
  console.log('\n🎉 Exploration complete! Browser will stay open for 30 seconds...');
  console.log('👀 Watch the browser window to see the Context Pipeline interface!');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  await browser.close();
  console.log('✅ Browser closed.');
})().catch(console.error);