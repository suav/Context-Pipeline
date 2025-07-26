const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Discover Tabs Test - Find All Clickable Tab-like Elements
 * Goal: Discover the actual tab structure and fullscreen behavior
 */
async function discoverTabsTest() {
  console.log('🔍 Discover Tabs Test - Finding All Tab-like Elements\n');
  console.log('🎯 Discovery Goals:');
  console.log('   1. Find ALL clickable elements that might be tabs');
  console.log('   2. Test clicking each element to see fullscreen behavior');
  console.log('   3. Identify agent vs file tab patterns');
  console.log('   4. Document tab structure and interaction patterns\n');
  
  let browser;
  const results = {
    testName: 'Discover Tabs Test',
    timestamp: new Date().toISOString(),
    allClickableElements: [],
    potentialTabs: [],
    fullscreenTriggers: [],
    agentElements: [],
    fileElements: [],
    screenshots: []
  };

  try {
    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920,1200',
        '--start-maximized'
      ],
      defaultViewport: { width: 1920, height: 1200 }
    });

    const page = await browser.newPage();
    
    console.log('\n🏗️ STEP 1: Loading workspace');
    console.log('─'.repeat(50));
    
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0', timeout: 20000 });
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Click workspace card
    const workspaceCards = await page.$$('[class*="cursor-pointer"]');
    for (const card of workspaceCards) {
      try {
        const text = await card.evaluate(el => el.textContent);
        if (text.includes('🤖') && text.includes('📊') && text.includes('Workspace')) {
          console.log('   🎯 Opening workspace...');
          await card.click();
          await new Promise(resolve => setTimeout(resolve, 8000));
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    await takeScreenshot(page, '01-workspace-loaded', results);
    
    console.log('\n🔍 STEP 2: Discovering all clickable elements');
    console.log('─'.repeat(50));
    
    // Get ALL potentially clickable elements
    const clickableSelectors = [
      'button',
      '[role="button"]',
      '[role="tab"]',
      '[class*="tab"]',
      '[class*="Tab"]',
      '[data-tab]',
      'div[onclick]',
      '[class*="click"]',
      '[class*="Click"]',
      '[class*="agent"]',
      '[class*="Agent"]',
      '[class*="file"]',
      '[class*="File"]'
    ];
    
    let allElements = [];
    
    for (const selector of clickableSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          try {
            const elementInfo = await element.evaluate(el => {
              const rect = el.getBoundingClientRect();
              return {
                tag: el.tagName,
                text: el.textContent?.trim() || '',
                classes: el.className || '',
                id: el.id || '',
                role: el.getAttribute('role') || '',
                visible: rect.width > 0 && rect.height > 0,
                position: {
                  x: Math.round(rect.left),
                  y: Math.round(rect.top),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height)
                }
              };
            });
            
            if (elementInfo.visible && elementInfo.text.length > 0 && elementInfo.text.length < 100) {
              allElements.push({ element, info: elementInfo, selector });
            }
          } catch (error) {
            continue;
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    // Remove duplicates and sort by position
    const uniqueElements = [];
    const seen = new Set();
    
    for (const item of allElements) {
      const key = `${item.info.position.x}-${item.info.position.y}-${item.info.text}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueElements.push(item);
      }
    }
    
    // Sort by Y position then X position
    uniqueElements.sort((a, b) => {
      if (Math.abs(a.info.position.y - b.info.position.y) < 10) {
        return a.info.position.x - b.info.position.x;
      }
      return a.info.position.y - b.info.position.y;
    });
    
    console.log(`   📊 Found ${uniqueElements.length} unique clickable elements`);
    results.allClickableElements = uniqueElements.map(item => item.info);
    
    // Categorize elements
    const potentialTabs = uniqueElements.filter(item => 
      item.info.classes.includes('tab') || 
      item.info.role === 'tab' ||
      item.info.text.match(/^(Agent|File|.*\.(js|ts|json|md|txt))/) ||
      (item.info.text.length > 3 && item.info.text.length < 30 && !item.info.text.includes('Create') && !item.info.text.includes('Import'))
    );
    
    const agentElements = uniqueElements.filter(item =>
      item.info.text.includes('Agent') ||
      item.info.text.includes('Claude') ||
      item.info.text.includes('Gemini') ||
      item.info.classes.includes('agent')
    );
    
    const fileElements = uniqueElements.filter(item =>
      item.info.text.includes('.') ||
      item.info.text.match(/\.(js|ts|json|md|txt|py|css|html)/) ||
      item.info.classes.includes('file')
    );
    
    console.log(`   🎯 Potential tabs: ${potentialTabs.length}`);
    console.log(`   🤖 Agent elements: ${agentElements.length}`);
    console.log(`   📁 File elements: ${fileElements.length}`);
    
    results.potentialTabs = potentialTabs.map(item => item.info);
    results.agentElements = agentElements.map(item => item.info);
    results.fileElements = fileElements.map(item => item.info);
    
    console.log('\n📋 STEP 3: Listing discovered elements');
    console.log('─'.repeat(50));
    
    console.log('\n🎯 POTENTIAL TAB ELEMENTS:');
    potentialTabs.forEach((item, i) => {
      console.log(`   ${i + 1}. "${item.info.text}" (${item.info.tag}.${item.info.classes})`);
      console.log(`       Position: (${item.info.position.x}, ${item.info.position.y}) ${item.info.position.width}×${item.info.position.height}`);
    });
    
    console.log('\n🤖 AGENT ELEMENTS:');
    agentElements.forEach((item, i) => {
      console.log(`   ${i + 1}. "${item.info.text}" (${item.info.tag}.${item.info.classes})`);
    });
    
    console.log('\n📁 FILE ELEMENTS:');
    fileElements.forEach((item, i) => {
      console.log(`   ${i + 1}. "${item.info.text}" (${item.info.tag}.${item.info.classes})`);
    });
    
    console.log('\n🖱️ STEP 4: Testing clickable elements for fullscreen behavior');
    console.log('─'.repeat(50));
    
    // Test clicking elements that look most promising as tabs
    const testElements = [...potentialTabs, ...agentElements, ...fileElements].slice(0, 10);
    
    for (let i = 0; i < testElements.length; i++) {
      try {
        const item = testElements[i];
        console.log(`\n   🎯 Testing element ${i + 1}: "${item.info.text}"`);
        console.log(`       Type: ${item.info.tag}, Classes: ${item.info.classes}`);
        
        // Take screenshot before click
        const beforeScreenshot = `before-click-${i + 1}`;
        await takeScreenshot(page, beforeScreenshot, results);
        
        // Get initial viewport state
        const beforeViewport = await page.evaluate(() => {
          const body = document.body;
          const html = document.documentElement;
          return {
            scrollHeight: Math.max(body.scrollHeight, html.scrollHeight),
            clientHeight: Math.max(body.clientHeight, html.clientHeight),
            bodyClasses: body.className,
            htmlClasses: html.className
          };
        });
        
        // Click the element
        await item.element.click();
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        // Take screenshot after click
        const afterScreenshot = `after-click-${i + 1}`;
        await takeScreenshot(page, afterScreenshot, results);
        
        // Check for changes that might indicate fullscreen
        const afterViewport = await page.evaluate(() => {
          const body = document.body;
          const html = document.documentElement;
          return {
            scrollHeight: Math.max(body.scrollHeight, html.scrollHeight),
            clientHeight: Math.max(body.clientHeight, html.clientHeight),
            bodyClasses: body.className,
            htmlClasses: html.className
          };
        });
        
        // Look for fullscreen indicators
        const fullscreenElements = await page.$$('[class*="full"], [class*="Full"], [class*="expand"], [class*="Expand"], [class*="maximiz"], [class*="Maximiz"]');
        const hasFullscreenClasses = afterViewport.bodyClasses.includes('full') || 
                                     afterViewport.htmlClasses.includes('full') ||
                                     fullscreenElements.length > 0;
        
        const layoutChanged = Math.abs(afterViewport.scrollHeight - beforeViewport.scrollHeight) > 100;
        
        const result = {
          element: item.info.text,
          classes: item.info.classes,
          fullscreenIndicators: hasFullscreenClasses,
          layoutChanged: layoutChanged,
          fullscreenElements: fullscreenElements.length,
          beforeHeight: beforeViewport.scrollHeight,
          afterHeight: afterViewport.scrollHeight
        };
        
        console.log(`       Results: Fullscreen=${hasFullscreenClasses}, Layout Changed=${layoutChanged}, Elements=${fullscreenElements.length}`);
        console.log(`       Height: ${beforeViewport.scrollHeight} → ${afterViewport.scrollHeight}`);
        
        results.fullscreenTriggers.push(result);
        
        if (hasFullscreenClasses || layoutChanged || fullscreenElements.length > 0) {
          console.log(`       ✅ POTENTIAL FULLSCREEN TRIGGER DETECTED!`);
        }
        
      } catch (error) {
        console.log(`       ❌ Failed to test element ${i + 1}: ${error.message}`);
      }
    }
    
    await takeScreenshot(page, 'final-state', results);

  } catch (error) {
    console.error('❌ Test error:', error.message);
    results.error = error.message;
  } finally {
    if (browser) {
      console.log('\n' + '🕵️'.repeat(80));
      console.log('TAB DISCOVERY MANUAL VERIFICATION - 45 SECONDS');
      console.log('🕵️'.repeat(80));
      console.log('');
      console.log('🔍 MANUAL TAB DISCOVERY TASKS:');
      console.log('');
      console.log('1. 🎯 IDENTIFY TAB AREAS:');
      console.log('   • Look for horizontal rows of clickable elements');
      console.log('   • Look for agent names (Agent 1, Agent 2, Claude, Gemini)');
      console.log('   • Look for file names (package.json, README.md, etc.)');
      console.log('   • Notice any tabs at top/bottom of interface');
      console.log('');
      console.log('2. 🖱️ CLICK DIFFERENT ELEMENTS:');
      console.log('   • Click each potential tab element');
      console.log('   • Watch for content area changes');
      console.log('   • Look for elements that expand/go fullscreen');
      console.log('   • Notice any maximize/minimize buttons');
      console.log('');
      console.log('3. 📺 FULLSCREEN BEHAVIOR:');
      console.log('   • Does clicking a tab make content fill the screen?');
      console.log('   • Is there a toggle between tabbed/fullscreen modes?');
      console.log('   • How do you return from fullscreen to tabbed view?');
      console.log('   • Are there visual indicators for fullscreen state?');
      console.log('');
      console.log('4. 🔄 TAB SWITCHING:');
      console.log('   • Switch between different agent tabs');
      console.log('   • Switch between different file tabs');
      console.log('   • Switch between agent and file tabs');
      console.log('   • Notice which content persists and which changes');
      console.log('');
      console.log('5. 💾 PERSISTENCE TESTING:');
      console.log('   • Type message in agent tab, switch away, return');
      console.log('   • Edit file in file tab, switch away, return');
      console.log('   • Start agent streaming, switch tabs, return');
      console.log('');
      console.log('🚨 DOCUMENT: Where exactly are the tabs located?');
      console.log('   Take note of the UI layout and tab interaction patterns!');
      console.log('───────────────────────────────────────────────────────────────────────────────');
      
      await new Promise(resolve => setTimeout(resolve, 45000));
      await browser.close();
      console.log('🔒 Browser closed after discovery period');
    }
  }

  // Save results
  await saveResults(results);
  
  // Print discovery results
  console.log('\n' + '='.repeat(90));
  console.log('🔍 TAB DISCOVERY TEST - COMPREHENSIVE RESULTS');
  console.log('='.repeat(90));
  console.log(`🕒 Test completed: ${results.timestamp}`);
  console.log(`🖱️ Clickable elements found: ${results.allClickableElements.length}`);
  console.log(`🎯 Potential tabs: ${results.potentialTabs.length}`);
  console.log(`🤖 Agent elements: ${results.agentElements.length}`);
  console.log(`📁 File elements: ${results.fileElements.length}`);
  console.log(`📺 Fullscreen triggers tested: ${results.fullscreenTriggers.length}`);
  console.log(`📸 Screenshots captured: ${results.screenshots.length}`);
  
  if (results.potentialTabs.length > 0) {
    console.log('\n🎯 POTENTIAL TAB ELEMENTS DISCOVERED:');
    results.potentialTabs.forEach((tab, i) => {
      console.log(`   ${i + 1}. "${tab.text}" - ${tab.tag}.${tab.classes}`);
      console.log(`       Position: (${tab.position.x}, ${tab.position.y}) ${tab.position.width}×${tab.position.height}`);
    });
  }
  
  if (results.fullscreenTriggers.length > 0) {
    console.log('\n📺 FULLSCREEN BEHAVIOR TEST RESULTS:');
    results.fullscreenTriggers.forEach((trigger, i) => {
      const status = trigger.fullscreenIndicators || trigger.layoutChanged || trigger.fullscreenElements > 0;
      console.log(`   ${i + 1}. "${trigger.element}" - ${status ? '✅ Fullscreen behavior' : '❌ No fullscreen'}`);
      console.log(`       Indicators: ${trigger.fullscreenIndicators}, Layout: ${trigger.layoutChanged}, Elements: ${trigger.fullscreenElements}`);
    });
  }
  
  if (results.agentElements.length > 0) {
    console.log('\n🤖 AGENT ELEMENTS FOUND:');
    results.agentElements.forEach((agent, i) => {
      console.log(`   ${i + 1}. "${agent.text}" - ${agent.classes}`);
    });
  }
  
  if (results.fileElements.length > 0) {
    console.log('\n📁 FILE ELEMENTS FOUND:');
    results.fileElements.forEach((file, i) => {
      console.log(`   ${i + 1}. "${file.text}" - ${file.classes}`);
    });
  }
  
  console.log('\n📸 VISUAL EVIDENCE:');
  results.screenshots.forEach(screenshot => {
    console.log(`   • ${screenshot.name}`);
  });
  
  const discoveryScore = results.potentialTabs.length + 
                        results.agentElements.length + 
                        results.fileElements.length + 
                        results.fullscreenTriggers.filter(t => t.fullscreenIndicators || t.layoutChanged).length;
  
  const assessment = discoveryScore >= 10 ? '🎉 COMPREHENSIVE TAB SYSTEM DISCOVERED' : 
                     discoveryScore >= 5 ? '⚠️ PARTIAL TAB SYSTEM FOUND' : 
                     '🚨 LIMITED TAB SYSTEM DETECTED';
  
  console.log(`\n🎯 DISCOVERY SCORE: ${discoveryScore}/15+ elements discovered`);
  console.log(`📊 ASSESSMENT: ${assessment}`);
  console.log('\n🔑 This discovery test maps the complete tab system structure!');
  console.log('='.repeat(90));
  
  return results;
}

async function takeScreenshot(page, name, results) {
  try {
    const dir = path.join(__dirname, 'screenshots', 'discover-tabs');
    await fs.mkdir(dir, { recursive: true });
    const filepath = path.join(dir, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    results.screenshots.push({ name, path: filepath });
  } catch (error) {
    console.log(`   ❌ Screenshot failed: ${error.message}`);
  }
}

async function saveResults(results) {
  try {
    const dir = path.join(__dirname, 'results');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'discover-tabs-results.json'),
      JSON.stringify(results, null, 2)
    );
    console.log('💾 Results saved to: results/discover-tabs-results.json');
  } catch (error) {
    console.log(`❌ Failed to save results: ${error.message}`);
  }
}

// Run if called directly
if (require.main === module) {
  discoverTabsTest().then(results => {
    const success = results.potentialTabs.length > 0 || results.allClickableElements.length > 10;
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Tab discovery test failed:', error);
    process.exit(1);
  });
}

module.exports = { discoverTabsTest };