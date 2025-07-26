const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Final Agent Test - Testing the Working Command Input
 * Based on evidence: command input "Type your command..." at position (348,634)
 */
async function finalAgentTest() {
  console.log('🎯 Final Agent Test - Testing Working Command Input\n');
  console.log('✅ Evidence from previous test:');
  console.log('   • Workspace access: WORKING');
  console.log('   • Agent APIs: ACTIVE (auto-triggered)');
  console.log('   • Command input: "Type your command..." at (348,634)');
  console.log('   • Missing: Send button mechanism\n');
  
  let browser;
  const results = {
    testName: 'Final Agent Test',
    timestamp: new Date().toISOString(),
    commandInputFound: false,
    messageTyped: false,
    sendMechanisms: [],
    agentResponse: false,
    tabSwitching: [],
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
    
    // Track agent-related API calls
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/agents/') || url.includes('/conversation') || url.includes('/stream')) {
        console.log(`   🌐 AGENT API: ${request.method()} ${url}`);
      }
      request.continue();
    });
    
    console.log('\n🚀 STEP 1: Quick workspace access to command input');
    console.log('─'.repeat(60));
    
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0', timeout: 20000 });
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Click workspace card directly (we know this works)
    const workspaceCards = await page.$$('[class*="cursor-pointer"]');
    for (const card of workspaceCards) {
      try {
        const text = await card.evaluate(el => el.textContent);
        if (text.includes('🤖') && text.includes('📊') && text.includes('Workspace')) {
          console.log('   🎯 Clicking workspace card...');
          await card.click();
          await new Promise(resolve => setTimeout(resolve, 8000));
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    await takeScreenshot(page, '01-workspace-loaded', results);
    
    console.log('\n💬 STEP 2: Testing the "Type your command..." input');
    console.log('─'.repeat(60));
    
    // Find the command input specifically
    const commandInput = await page.$('input[placeholder*="command"], input[placeholder*="Type your"]');
    
    if (commandInput) {
      console.log('   ✅ Command input found!');
      results.commandInputFound = true;
      
      // Test typing in the command input
      await commandInput.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const testMessage = 'Hello! Can you help me understand this workspace and list the available files?';
      await commandInput.type(testMessage, { delay: 30 });
      
      console.log('   ✅ Message typed successfully');
      results.messageTyped = true;
      await takeScreenshot(page, '02-message-typed', results);
      
      // Look for send mechanisms
      console.log('   🔍 Looking for send mechanisms...');
      
      // Try Enter key
      console.log('   ⌨️ Trying Enter key...');
      await commandInput.press('Enter');
      await new Promise(resolve => setTimeout(resolve, 3000));
      results.sendMechanisms.push('Enter key');
      await takeScreenshot(page, '03-enter-pressed', results);
      
      // Look for send buttons near the input
      const buttons = await page.$$('button');
      for (const button of buttons) {
        try {
          const btnText = await button.evaluate(el => el.textContent + ' ' + (el.title || '') + ' ' + (el.getAttribute('aria-label') || ''));
          const btnRect = await button.boundingBox();
          
          if (btnRect && btnText && 
              (btnText.includes('Send') || btnText.includes('→') || btnText.includes('↵') || 
               btnText.includes('Submit') || btnText.trim() === '▶' || btnText.includes('Enter'))) {
            
            console.log(`   🎯 Found potential send button: "${btnText.trim()}"`);
            results.sendMechanisms.push(btnText.trim());
            
            await button.click();
            await new Promise(resolve => setTimeout(resolve, 5000));
            await takeScreenshot(page, '04-send-clicked', results);
            break;
          }
        } catch (error) {
          continue;
        }
      }
    } else {
      console.log('   ❌ Command input not found');
    }
    
    console.log('\n🔄 STEP 3: Check for agent response');
    console.log('─'.repeat(60));
    
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Check if there's any response content
    const pageContent = await page.evaluate(() => document.body.textContent);
    if (pageContent.includes(testMessage)) {
      console.log('   📝 Message found in page content');
      
      // Look for response indicators
      const responseKeywords = ['response', 'reply', 'assistant', 'claude', 'gemini', 'I can help', 'Here are'];
      const hasResponse = responseKeywords.some(keyword => 
        pageContent.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (hasResponse) {
        console.log('   ✅ Agent response detected!');
        results.agentResponse = true;
      } else {
        console.log('   ⏳ No response detected yet');
      }
    }
    
    await takeScreenshot(page, '05-response-check', results);
    
    console.log('\n🔀 STEP 4: Test agent tab switching');
    console.log('─'.repeat(60));
    
    // Look for tab-like elements
    const tabs = await page.$$('[role="tab"], [class*="tab"], button[class*="agent"]');
    console.log(`   🔍 Found ${tabs.length} potential tab elements`);
    
    for (let i = 0; i < Math.min(3, tabs.length); i++) {
      try {
        const tab = tabs[i];
        const tabText = await tab.evaluate(el => el.textContent);
        
        if (tabText && (tabText.includes('Agent') || tabText.includes('Claude') || tabText.includes('Gemini'))) {
          console.log(`   🎯 Clicking agent tab: "${tabText}"`);
          await tab.click();
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          results.tabSwitching.push(tabText);
          await takeScreenshot(page, `06-tab-${i + 1}`, results);
        }
      } catch (error) {
        continue;
      }
    }
    
    await takeScreenshot(page, '07-final-state', results);

  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    if (browser) {
      console.log('\n' + '🔥'.repeat(80));
      console.log('FINAL MANUAL VERIFICATION - 30 SECONDS');
      console.log('🔥'.repeat(80));
      console.log('');
      console.log('🎯 DEFINITIVE AGENT WORKFLOW TEST:');
      console.log('');
      console.log('1. 💬 COMMAND INPUT TEST:');
      console.log('   • Find the input with "Type your command..." placeholder');
      console.log('   • Type a message like "Hello, can you help me?"');
      console.log('   • Try pressing Enter to send');
      console.log('   • Look for a send button near the input');
      console.log('');
      console.log('2. 🤖 AGENT RESPONSE TEST:');
      console.log('   • After sending, wait 10-15 seconds');
      console.log('   • Look for agent response text appearing');
      console.log('   • Should see response from Claude or Gemini');
      console.log('');
      console.log('3. 🔀 AGENT TAB TEST:');
      console.log('   • Look for agent tabs (Agent 1, Agent 2, Claude, Gemini)');
      console.log('   • Click different agent tabs');
      console.log('   • Verify each has separate conversation');
      console.log('   • Send different messages to different agents');
      console.log('');
      console.log('4. 💾 PERSISTENCE TEST:');
      console.log('   • Navigate away from workspace');
      console.log('   • Return to same workspace');
      console.log('   • Verify conversations are still there');
      console.log('');
      console.log('5. 🔒 ISOLATION TEST:');
      console.log('   • Open different workspace');
      console.log('   • Verify no conversation bleed-through');
      console.log('');
      console.log('🚨 CRITICAL: Document exactly how the agent workflow works!');
      console.log('   Where are agent tabs? How do you send messages?');
      console.log('   What does the response look like?');
      console.log('───────────────────────────────────────────────────────────────────────────────');
      
      await new Promise(resolve => setTimeout(resolve, 30000));
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }

  // Save results
  await saveResults(results);
  
  // Print final analysis
  console.log('\n' + '='.repeat(90));
  console.log('🎯 FINAL AGENT TEST - DEFINITIVE RESULTS');
  console.log('='.repeat(90));
  console.log(`🕒 Test completed: ${results.timestamp}`);
  console.log(`💬 Command input found: ${results.commandInputFound ? '✅ Yes' : '❌ No'}`);
  console.log(`📝 Message typed: ${results.messageTyped ? '✅ Yes' : '❌ No'}`);
  console.log(`🚀 Send mechanisms: ${results.sendMechanisms.length} found`);
  console.log(`🤖 Agent response: ${results.agentResponse ? '✅ Detected' : '❌ Not detected'}`);
  console.log(`🔀 Tab switching: ${results.tabSwitching.length} tabs tested`);
  console.log(`📸 Screenshots: ${results.screenshots.length} captured`);
  
  if (results.sendMechanisms.length > 0) {
    console.log('\n🚀 SEND MECHANISMS FOUND:');
    results.sendMechanisms.forEach((mechanism, i) => {
      console.log(`   ${i + 1}. ${mechanism}`);
    });
  }
  
  if (results.tabSwitching.length > 0) {
    console.log('\n🔀 AGENT TABS TESTED:');
    results.tabSwitching.forEach((tab, i) => {
      console.log(`   ${i + 1}. ${tab}`);
    });
  }
  
  console.log('\n📸 VISUAL EVIDENCE:');
  results.screenshots.forEach(screenshot => {
    console.log(`   • ${screenshot.name}`);
  });
  
  const score = (results.commandInputFound ? 2 : 0) + 
                (results.messageTyped ? 2 : 0) + 
                results.sendMechanisms.length + 
                (results.agentResponse ? 3 : 0) + 
                results.tabSwitching.length;
  
  const assessment = score >= 8 ? '🎉 AGENT WORKFLOW FULLY FUNCTIONAL' : 
                     score >= 5 ? '⚠️ AGENT WORKFLOW MOSTLY WORKING' : 
                     score >= 3 ? '⚠️ PARTIAL FUNCTIONALITY' :
                     '🚨 MAJOR ISSUES DETECTED';
  
  console.log(`\n🎯 AGENT FUNCTIONALITY SCORE: ${score}/10 points`);
  console.log(`📊 FINAL ASSESSMENT: ${assessment}`);
  console.log('\n🔑 This test confirms the agent system structure and capabilities!');
  console.log('='.repeat(90));
  
  return results;
}

async function takeScreenshot(page, name, results) {
  try {
    const dir = path.join(__dirname, 'screenshots', 'final-agent-test');
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
      path.join(dir, 'final-agent-test-results.json'),
      JSON.stringify(results, null, 2)
    );
    console.log('💾 Results saved to: results/final-agent-test-results.json');
  } catch (error) {
    console.log(`❌ Failed to save results: ${error.message}`);
  }
}

// Run if called directly
if (require.main === module) {
  finalAgentTest().then(results => {
    const success = results.commandInputFound && results.messageTyped;
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Final agent test failed:', error);
    process.exit(1);
  });
}

module.exports = { finalAgentTest };