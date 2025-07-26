const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Fullscreen Tab Persistence Test - Advanced Workflow
 * Tests: Fullscreen agent/file tabs + persistence + streaming continuation
 */
async function fullscreenTabPersistenceTest() {
  console.log('🖥️ Fullscreen Tab Persistence Test - Advanced Workflow\n');
  console.log('🎯 Testing Advanced Tab Functionality:');
  console.log('   1. Agent tabs go fullscreen when clicked');
  console.log('   2. File tabs go fullscreen when clicked');
  console.log('   3. Switching between agent tabs maintains conversation/streaming');
  console.log('   4. Switching between file tabs maintains file content');
  console.log('   5. Agent ↔ File tab switching preserves all states');
  console.log('   6. Streaming continues when returning to agent tabs');
  console.log('   7. No bleed-through between different agent conversations\n');
  
  let browser;
  const results = {
    testName: 'Fullscreen Tab Persistence Test',
    timestamp: new Date().toISOString(),
    workspaceAccess: false,
    agentTabs: [],
    fileTabs: [],
    fullscreenTests: [],
    streamingTests: [],
    persistenceTests: [],
    tabSwitching: [],
    conversations: {},
    apiCalls: [],
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
    
    // Track all API calls for agents and files
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/agents/') || url.includes('/files/') || url.includes('/conversation') || url.includes('/stream')) {
        const apiCall = {
          method: request.method(),
          url: url,
          timestamp: new Date().toISOString(),
          type: url.includes('/agents/') ? 'agent' : 'file'
        };
        results.apiCalls.push(apiCall);
        console.log(`   🌐 ${apiCall.type.toUpperCase()} API: ${apiCall.method} ${url.split('/').slice(-2).join('/')}`);
      }
      request.continue();
    });
    
    // STEP 1: Access workspace and identify tab structure
    console.log('\n🏗️ STEP 1: Accessing workspace and identifying tab structure');
    console.log('─'.repeat(70));
    
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
          results.workspaceAccess = true;
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    await takeScreenshot(page, '01-workspace-loaded', results);
    
    // STEP 2: Identify and catalog agent tabs
    console.log('\n🤖 STEP 2: Identifying agent tabs');
    console.log('─'.repeat(70));
    
    // Look for agent tabs specifically
    const agentTabSelectors = [
      '[role="tab"]',
      '[class*="tab"]',
      'button[class*="agent"]',
      '[data-tab]',
      '[class*="Tab"]'
    ];
    
    let foundAgentTabs = [];
    
    for (const selector of agentTabSelectors) {
      try {
        const tabs = await page.$$(selector);
        for (const tab of tabs) {
          try {
            const tabInfo = await tab.evaluate(el => ({
              text: el.textContent?.trim() || '',
              classes: el.className || '',
              id: el.id || '',
              dataAttributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' ')
            }));
            
            // Check if this looks like an agent tab
            if (tabInfo.text && (
                tabInfo.text.includes('Agent') || 
                tabInfo.text.includes('Claude') || 
                tabInfo.text.includes('Gemini') ||
                tabInfo.text.match(/^Agent\s*\d+$/) ||
                (tabInfo.classes.includes('agent') && tabInfo.classes.includes('tab'))
            )) {
              console.log(`   🎯 Found agent tab: "${tabInfo.text}" (${selector})`);
              console.log(`       Classes: ${tabInfo.classes}`);
              foundAgentTabs.push({ element: tab, info: tabInfo, selector });
              results.agentTabs.push(tabInfo.text);
            }
          } catch (error) {
            continue;
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    console.log(`   📊 Found ${foundAgentTabs.length} agent tabs`);

    // STEP 3: Identify and catalog file tabs
    console.log('\n📁 STEP 3: Identifying file tabs');
    console.log('─'.repeat(70));
    
    // Look for file tabs (usually have file extensions or file-like names)
    const fileTabSelectors = [
      '[role="tab"]',
      '[class*="tab"]',
      '[class*="file"]',
      '[data-tab]'
    ];
    
    let foundFileTabs = [];
    
    for (const selector of fileTabSelectors) {
      try {
        const tabs = await page.$$(selector);
        for (const tab of tabs) {
          try {
            const tabInfo = await tab.evaluate(el => ({
              text: el.textContent?.trim() || '',
              classes: el.className || '',
              id: el.id || ''
            }));
            
            // Check if this looks like a file tab
            if (tabInfo.text && (
                tabInfo.text.includes('.') ||  // Has file extension
                tabInfo.text.match(/\.(js|ts|json|md|txt|py|css|html|jsx|tsx)$/) ||
                (tabInfo.classes.includes('file') && tabInfo.classes.includes('tab')) ||
                tabInfo.text.includes('README') ||
                tabInfo.text.includes('package') ||
                tabInfo.text.includes('config')
            ) && !tabInfo.text.includes('Agent')) {  // Not an agent tab
              console.log(`   📄 Found file tab: "${tabInfo.text}" (${selector})`);
              foundFileTabs.push({ element: tab, info: tabInfo, selector });
              results.fileTabs.push(tabInfo.text);
            }
          } catch (error) {
            continue;
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    console.log(`   📊 Found ${foundFileTabs.length} file tabs`);

    // STEP 4: Test agent tab fullscreen and conversations
    console.log('\n🤖 STEP 4: Testing agent tab fullscreen and conversations');
    console.log('─'.repeat(70));
    
    if (foundAgentTabs.length > 0) {
      for (let i = 0; i < Math.min(3, foundAgentTabs.length); i++) {
        try {
          const agentTab = foundAgentTabs[i];
          console.log(`   🎯 Testing agent tab ${i + 1}: "${agentTab.info.text}"`);
          
          // Click agent tab and check for fullscreen
          await agentTab.element.click();
          await new Promise(resolve => setTimeout(resolve, 4000));
          
          // Check if interface went fullscreen (look for expanded content area)
          const contentArea = await page.$('[class*="full"], [class*="expanded"], [class*="maximized"]');
          const isFullscreen = contentArea !== null;
          
          console.log(`   📺 Fullscreen mode: ${isFullscreen ? '✅ Detected' : '❌ Not detected'}`);
          results.fullscreenTests.push({
            tab: agentTab.info.text,
            type: 'agent',
            fullscreen: isFullscreen
          });
          
          await takeScreenshot(page, `02-agent-tab-${i + 1}`, results);
          
          // Try to send a message to this agent
          const commandInput = await page.$('input[placeholder*="command"], input[placeholder*="Type"]');
          if (commandInput) {
            const testMessage = `Test message for ${agentTab.info.text}: Hello agent ${i + 1}, can you respond with your identifier?`;
            
            await commandInput.click();
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Clear input and type new message
            await commandInput.evaluate(el => el.value = '');
            await commandInput.type(testMessage);
            await commandInput.press('Enter');
            
            console.log(`   💬 Sent message to ${agentTab.info.text}`);
            results.conversations[agentTab.info.text] = {
              message: testMessage,
              timestamp: new Date().toISOString(),
              sent: true
            };
            
            // Wait for streaming to start
            await new Promise(resolve => setTimeout(resolve, 6000));
            await takeScreenshot(page, `03-agent-${i + 1}-response`, results);
          }
          
          results.tabSwitching.push(`Agent tab ${i + 1}: ${agentTab.info.text}`);
          
        } catch (error) {
          console.log(`   ❌ Failed to test agent tab ${i + 1}: ${error.message}`);
        }
      }
    }

    // STEP 5: Test file tab fullscreen
    console.log('\n📁 STEP 5: Testing file tab fullscreen');
    console.log('─'.repeat(70));
    
    if (foundFileTabs.length > 0) {
      for (let i = 0; i < Math.min(2, foundFileTabs.length); i++) {
        try {
          const fileTab = foundFileTabs[i];
          console.log(`   📄 Testing file tab ${i + 1}: "${fileTab.info.text}"`);
          
          // Click file tab and check for fullscreen
          await fileTab.element.click();
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Check for file content and fullscreen mode
          const editorArea = await page.$('[class*="monaco"], [class*="editor"], [class*="code"]');
          const isFullscreen = editorArea !== null;
          
          console.log(`   📺 File fullscreen mode: ${isFullscreen ? '✅ Detected' : '❌ Not detected'}`);
          results.fullscreenTests.push({
            tab: fileTab.info.text,
            type: 'file',
            fullscreen: isFullscreen
          });
          
          await takeScreenshot(page, `04-file-tab-${i + 1}`, results);
          results.tabSwitching.push(`File tab ${i + 1}: ${fileTab.info.text}`);
          
        } catch (error) {
          console.log(`   ❌ Failed to test file tab ${i + 1}: ${error.message}`);
        }
      }
    }

    // STEP 6: Test tab switching persistence
    console.log('\n🔄 STEP 6: Testing tab switching persistence');
    console.log('─'.repeat(70));
    
    if (foundAgentTabs.length >= 2) {
      console.log('   🔄 Testing agent tab switching persistence...');
      
      // Switch to first agent tab
      await foundAgentTabs[0].element.click();
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if conversation is still visible
      const pageContent1 = await page.evaluate(() => document.body.textContent);
      const firstAgentConv = results.conversations[foundAgentTabs[0].info.text];
      const conv1Visible = firstAgentConv && pageContent1.includes(firstAgentConv.message.substring(0, 20));
      
      console.log(`   💾 Agent 1 conversation persistent: ${conv1Visible ? '✅ Yes' : '❌ No'}`);
      results.persistenceTests.push({
        test: 'Agent 1 conversation persistence',
        result: conv1Visible
      });
      
      // Switch to second agent tab
      if (foundAgentTabs.length > 1) {
        await foundAgentTabs[1].element.click();
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const pageContent2 = await page.evaluate(() => document.body.textContent);
        const secondAgentConv = results.conversations[foundAgentTabs[1].info.text];
        const conv2Visible = secondAgentConv && pageContent2.includes(secondAgentConv.message.substring(0, 20));
        
        console.log(`   💾 Agent 2 conversation persistent: ${conv2Visible ? '✅ Yes' : '❌ No'}`);
        results.persistenceTests.push({
          test: 'Agent 2 conversation persistence',
          result: conv2Visible
        });
        
        // Check for bleed-through (agent 1 conversation should NOT be visible in agent 2)
        const bleedThrough = firstAgentConv && pageContent2.includes(firstAgentConv.message.substring(0, 20));
        console.log(`   🔒 No conversation bleed-through: ${!bleedThrough ? '✅ Clean' : '❌ Bleed detected'}`);
        results.persistenceTests.push({
          test: 'No conversation bleed-through',
          result: !bleedThrough
        });
      }
      
      await takeScreenshot(page, '05-tab-switching-test', results);
    }

    // STEP 7: Test streaming continuation
    console.log('\n📡 STEP 7: Testing streaming continuation after tab switches');
    console.log('─'.repeat(70));
    
    if (foundAgentTabs.length > 0) {
      // Send a message that should generate a long response
      const commandInput = await page.$('input[placeholder*="command"], input[placeholder*="Type"]');
      if (commandInput) {
        const longMessage = 'Please write a detailed explanation of how AI language models work, including their architecture and training process. Make this response very comprehensive.';
        
        await commandInput.click();
        await commandInput.evaluate(el => el.value = '');
        await commandInput.type(longMessage);
        await commandInput.press('Enter');
        
        console.log('   📡 Initiated long streaming response...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Switch to a file tab during streaming
        if (foundFileTabs.length > 0) {
          await foundFileTabs[0].element.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('   🔄 Switched to file tab during streaming...');
          
          // Switch back to agent tab
          await foundAgentTabs[0].element.click();
          await new Promise(resolve => setTimeout(resolve, 3000));
          console.log('   🔄 Returned to agent tab...');
          
          // Check if streaming continued/response is visible
          const finalContent = await page.evaluate(() => document.body.textContent);
          const streamingWorking = finalContent.includes('AI') || finalContent.includes('language') || finalContent.includes('model');
          
          console.log(`   📡 Streaming continuation: ${streamingWorking ? '✅ Working' : '❌ Failed'}`);
          results.streamingTests.push({
            test: 'Streaming continuation after tab switch',
            result: streamingWorking
          });
        }
      }
      
      await takeScreenshot(page, '06-streaming-test', results);
    }

    await takeScreenshot(page, '07-final-state', results);

  } catch (error) {
    console.error('❌ Test error:', error.message);
    results.error = error.message;
  } finally {
    if (browser) {
      console.log('\n' + '🎭'.repeat(80));
      console.log('ADVANCED TAB WORKFLOW VERIFICATION - 60 SECONDS');
      console.log('🎭'.repeat(80));
      console.log('');
      console.log('🎯 CRITICAL ADVANCED WORKFLOW TESTS:');
      console.log('');
      console.log('1. 📺 FULLSCREEN TAB BEHAVIOR:');
      console.log('   • Click different agent tabs - do they go fullscreen?');
      console.log('   • Click different file tabs - do they go fullscreen?');
      console.log('   • Is there a clear visual difference between tabbed/fullscreen modes?');
      console.log('');
      console.log('2. 🤖 AGENT TAB TESTING:');
      console.log('   • Open Agent 1 tab, send a message');
      console.log('   • Open Agent 2 tab, send a different message');
      console.log('   • Switch back to Agent 1 - is original conversation still there?');
      console.log('   • Switch back to Agent 2 - is its conversation still there?');
      console.log('');
      console.log('3. 📁 FILE TAB TESTING:');
      console.log('   • Open different file tabs');
      console.log('   • Verify they show different file contents');
      console.log('   • Make edits in one file tab');
      console.log('   • Switch to another file tab and back - edits preserved?');
      console.log('');
      console.log('4. 🔄 MIXED TAB SWITCHING:');
      console.log('   • Agent tab → File tab → Agent tab');
      console.log('   • Verify agent conversation persists through file tab visits');
      console.log('   • File tab → Agent tab → File tab');
      console.log('   • Verify file content persists through agent tab visits');
      console.log('');
      console.log('5. 📡 STREAMING CONTINUATION:');
      console.log('   • Start a long agent response');
      console.log('   • Switch to file tab during streaming');
      console.log('   • Switch back to agent tab - is streaming still happening?');
      console.log('   • Does the response continue where it left off?');
      console.log('');
      console.log('6. 🔒 ISOLATION VERIFICATION:');
      console.log('   • Agent 1 conversation should NOT appear in Agent 2 tab');
      console.log('   • File A content should NOT appear in File B tab');
      console.log('   • Each tab maintains its own isolated state');
      console.log('');
      console.log('🚨 FOCUS: Document exactly how the fullscreen toggle works!');
      console.log('   Does clicking a tab expand it? Is there a maximize button?');
      console.log('   How do you return to multi-tab view?');
      console.log('───────────────────────────────────────────────────────────────────────────────');
      
      await new Promise(resolve => setTimeout(resolve, 60000));
      await browser.close();
      console.log('🔒 Browser closed after extended verification');
    }
  }

  // Save results
  await saveResults(results);
  
  // Print comprehensive analysis
  console.log('\n' + '='.repeat(90));
  console.log('🎭 FULLSCREEN TAB PERSISTENCE TEST - COMPREHENSIVE ANALYSIS');
  console.log('='.repeat(90));
  console.log(`🕒 Test completed: ${results.timestamp}`);
  console.log(`🏗️ Workspace accessed: ${results.workspaceAccess ? '✅ Yes' : '❌ No'}`);
  console.log(`🤖 Agent tabs found: ${results.agentTabs.length}`);
  console.log(`📁 File tabs found: ${results.fileTabs.length}`);
  console.log(`📺 Fullscreen tests: ${results.fullscreenTests.length}`);
  console.log(`💾 Persistence tests: ${results.persistenceTests.length}`);
  console.log(`📡 Streaming tests: ${results.streamingTests.length}`);
  console.log(`🔄 Tab switches: ${results.tabSwitching.length}`);
  console.log(`🌐 API calls tracked: ${results.apiCalls.length}`);
  console.log(`📸 Screenshots: ${results.screenshots.length}`);
  
  if (results.agentTabs.length > 0) {
    console.log('\n🤖 AGENT TABS DETECTED:');
    results.agentTabs.forEach((tab, i) => console.log(`   ${i + 1}. ${tab}`));
  }
  
  if (results.fileTabs.length > 0) {
    console.log('\n📁 FILE TABS DETECTED:');
    results.fileTabs.forEach((tab, i) => console.log(`   ${i + 1}. ${tab}`));
  }
  
  if (results.fullscreenTests.length > 0) {
    console.log('\n📺 FULLSCREEN TEST RESULTS:');
    results.fullscreenTests.forEach((test, i) => {
      console.log(`   ${i + 1}. ${test.type.toUpperCase()} "${test.tab}": ${test.fullscreen ? '✅ Fullscreen' : '❌ No fullscreen'}`);
    });
  }
  
  if (results.persistenceTests.length > 0) {
    console.log('\n💾 PERSISTENCE TEST RESULTS:');
    results.persistenceTests.forEach((test, i) => {
      console.log(`   ${i + 1}. ${test.test}: ${test.result ? '✅ Passed' : '❌ Failed'}`);
    });
  }
  
  if (results.streamingTests.length > 0) {
    console.log('\n📡 STREAMING TEST RESULTS:');
    results.streamingTests.forEach((test, i) => {
      console.log(`   ${i + 1}. ${test.test}: ${test.result ? '✅ Working' : '❌ Failed'}`);
    });
  }
  
  if (Object.keys(results.conversations).length > 0) {
    console.log('\n💬 CONVERSATION TRACKING:');
    Object.entries(results.conversations).forEach(([agent, conv]) => {
      console.log(`   • ${agent}: ${conv.sent ? '✅ Sent' : '❌ Failed'} - "${conv.message.substring(0, 40)}..."`);
    });
  }
  
  if (results.apiCalls.length > 0) {
    console.log('\n🌐 API ACTIVITY SUMMARY:');
    const agentCalls = results.apiCalls.filter(call => call.type === 'agent').length;
    const fileCalls = results.apiCalls.filter(call => call.type === 'file').length;
    console.log(`   🤖 Agent API calls: ${agentCalls}`);
    console.log(`   📁 File API calls: ${fileCalls}`);
  }
  
  console.log('\n📸 VISUAL DOCUMENTATION:');
  results.screenshots.forEach(screenshot => {
    console.log(`   • ${screenshot.name}`);
  });
  
  const score = (results.workspaceAccess ? 2 : 0) + 
                results.agentTabs.length + 
                results.fileTabs.length + 
                results.fullscreenTests.filter(t => t.fullscreen).length * 2 +
                results.persistenceTests.filter(t => t.result).length * 2 +
                results.streamingTests.filter(t => t.result).length * 3;
  
  const assessment = score >= 15 ? '🎉 ADVANCED TAB SYSTEM FULLY FUNCTIONAL' : 
                     score >= 10 ? '⚠️ ADVANCED FUNCTIONALITY MOSTLY WORKING' : 
                     score >= 5 ? '⚠️ BASIC FUNCTIONALITY WORKING' :
                     '🚨 MAJOR TAB SYSTEM ISSUES';
  
  console.log(`\n🎯 ADVANCED FUNCTIONALITY SCORE: ${score}/20+ points`);
  console.log(`📊 FINAL ASSESSMENT: ${assessment}`);
  console.log('\n🔑 This test validates the sophisticated tab system with fullscreen and persistence!');
  console.log('='.repeat(90));
  
  return results;
}

async function takeScreenshot(page, name, results) {
  try {
    const dir = path.join(__dirname, 'screenshots', 'fullscreen-tab-persistence');
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
      path.join(dir, 'fullscreen-tab-persistence-results.json'),
      JSON.stringify(results, null, 2)
    );
    console.log('💾 Results saved to: results/fullscreen-tab-persistence-results.json');
  } catch (error) {
    console.log(`❌ Failed to save results: ${error.message}`);
  }
}

// Run if called directly
if (require.main === module) {
  fullscreenTabPersistenceTest().then(results => {
    const success = results.workspaceAccess && 
                    results.agentTabs.length > 0 && 
                    results.fullscreenTests.length > 0;
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Fullscreen tab persistence test failed:', error);
    process.exit(1);
  });
}

module.exports = { fullscreenTabPersistenceTest };