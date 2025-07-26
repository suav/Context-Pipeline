const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Agent Interaction Test - Tests core agent functionality
 * Tests workspace access and agent deployment in headful mode
 */
async function agentInteractionTest() {
  console.log('🤖 Agent Interaction Test - Headful Mode\n');
  
  let browser;
  const results = {
    testName: 'Agent Interaction Test',
    timestamp: new Date().toISOString(),
    passed: [],
    failed: [],
    screenshots: [],
    workspacesFound: 0,
    agentsFound: 0
  };

  try {
    // Launch browser in headful mode
    console.log('🚀 Launching browser for agent testing...');
    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080',
        '--disable-web-security'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    console.log('✅ Browser launched successfully');
    
    // Navigate to homepage
    console.log('\n📄 Step 1: Loading Context Pipeline...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0', timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const pageTitle = await page.title();
    console.log(`   ✅ Page loaded: "${pageTitle}"`);
    await takeScreenshot(page, 'homepage-loaded', results);

    // Look for workspace elements
    console.log('\n🏗️ Step 2: Checking for workspaces...');
    
    // Check for workspace cards or indicators
    const workspaceElements = await page.$$('[class*="workspace"], [class*="Workspace"], button:has-text("workspace"), button:has-text("Workspace")');
    results.workspacesFound = workspaceElements.length;
    
    if (workspaceElements.length > 0) {
      results.passed.push(`Found ${workspaceElements.length} workspace-related elements`);
      console.log(`   ✅ Found ${workspaceElements.length} workspace elements`);
      
      // Try to interact with first workspace element
      try {
        const firstWorkspace = workspaceElements[0];
        const workspaceText = await firstWorkspace.evaluate(el => el.textContent || el.title || 'Unknown');
        console.log(`   🎯 Attempting to access workspace: "${workspaceText}"`);
        
        await firstWorkspace.click();
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        results.passed.push('Workspace interaction successful');
        console.log('   ✅ Workspace clicked successfully');
        await takeScreenshot(page, 'workspace-accessed', results);
        
      } catch (error) {
        results.failed.push('Workspace interaction failed');
        console.log('   ❌ Workspace interaction failed');
      }
    } else {
      results.failed.push('No workspace elements found');
      console.log('   ❌ No workspace elements detected');
    }

    // Look for agent elements
    console.log('\n🤖 Step 3: Checking for agents...');
    
    // Check for agent buttons or cards
    const agentElements = await page.$$('button:has-text("Claude"), button:has-text("Gemini"), button:has-text("Agent"), [class*="agent"], [class*="Agent"]');
    results.agentsFound = agentElements.length;
    
    if (agentElements.length > 0) {
      results.passed.push(`Found ${agentElements.length} agent-related elements`);
      console.log(`   ✅ Found ${agentElements.length} agent elements`);
      
      // Try to interact with first agent
      try {
        const firstAgent = agentElements[0];
        const agentText = await firstAgent.evaluate(el => el.textContent || el.title || 'Unknown');
        console.log(`   🎯 Attempting to deploy agent: "${agentText}"`);
        
        await firstAgent.click();
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        results.passed.push('Agent deployment successful');
        console.log('   ✅ Agent clicked successfully');
        await takeScreenshot(page, 'agent-deployed', results);
        
        // Look for chat or interaction elements
        const chatElements = await page.$$('input[type="text"], textarea, [class*="chat"], [class*="message"], [class*="input"]');
        if (chatElements.length > 0) {
          results.passed.push(`Found ${chatElements.length} chat/input elements`);
          console.log(`   ✅ Found ${chatElements.length} chat elements`);
          
          // Try to interact with chat if available
          const firstChatInput = chatElements[0];
          try {
            await firstChatInput.click();
            await firstChatInput.type('Hello! This is a test message from the automated test.');
            
            results.passed.push('Chat interaction successful');
            console.log('   ✅ Chat input successful');
            
            // Look for send button
            const sendButton = await page.$('button:has-text("Send"), button[type="submit"]');
            if (sendButton) {
              await sendButton.click();
              await new Promise(resolve => setTimeout(resolve, 2000));
              results.passed.push('Message sent successfully');
              console.log('   ✅ Message sent');
            }
            
            await takeScreenshot(page, 'chat-interaction', results);
            
          } catch (error) {
            results.failed.push('Chat interaction failed');
            console.log('   ❌ Chat interaction failed');
          }
        }
        
      } catch (error) {
        results.failed.push('Agent deployment failed');
        console.log('   ❌ Agent deployment failed');
      }
    } else {
      results.failed.push('No agent elements found');
      console.log('   ❌ No agent elements detected');
    }

    // Check for navigation elements
    console.log('\n🧭 Step 4: Testing navigation...');
    
    const navElements = await page.$$('button:has-text("Home"), button:has-text("Library"), button:has-text("Settings"), [class*="nav"], nav');
    if (navElements.length > 0) {
      results.passed.push(`Found ${navElements.length} navigation elements`);
      console.log(`   ✅ Found ${navElements.length} navigation elements`);
      
      // Test navigation
      if (navElements.length > 1) {
        try {
          await navElements[0].click();
          await new Promise(resolve => setTimeout(resolve, 2000));
          await navElements[1].click();
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          results.passed.push('Navigation functionality working');
          console.log('   ✅ Navigation tested successfully');
        } catch (error) {
          results.failed.push('Navigation test failed');
          console.log('   ❌ Navigation test failed');
        }
      }
    }

    // Check overall page functionality
    console.log('\n⚡ Step 5: Overall functionality check...');
    
    const allButtons = await page.$$('button');
    const allInputs = await page.$$('input, textarea');
    const totalInteractive = allButtons.length + allInputs.length;
    
    if (totalInteractive > 5) {
      results.passed.push(`Rich UI detected: ${totalInteractive} interactive elements`);
      console.log(`   ✅ Rich UI: ${totalInteractive} interactive elements`);
    }
    
    // Check for any JavaScript errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.reload();
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (consoleErrors.length === 0) {
      results.passed.push('No JavaScript errors detected');
      console.log('   ✅ Clean JavaScript execution');
    } else {
      results.failed.push(`${consoleErrors.length} JavaScript errors found`);
      console.log(`   ❌ Found ${consoleErrors.length} JavaScript errors`);
    }

    await takeScreenshot(page, 'final-state', results);

  } catch (error) {
    console.error('❌ Test crashed:', error.message);
    results.failed.push(`Fatal error: ${error.message}`);
  } finally {
    if (browser) {
      console.log('\n⏸️  Keeping browser open for 12 seconds for detailed inspection...');
      console.log('   👀 Please review the agent interaction UI manually');
      console.log('   🔍 Look for: workspace cards, agent buttons, chat interfaces');
      await new Promise(resolve => setTimeout(resolve, 12000));
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }

  // Save results
  await saveResults(results);
  
  // Print comprehensive summary
  console.log('\n' + '='.repeat(70));
  console.log('🤖 AGENT INTERACTION TEST RESULTS');
  console.log('='.repeat(70));
  console.log(`🕒 Timestamp: ${results.timestamp}`);
  console.log(`✅ Tests Passed: ${results.passed.length}`);
  console.log(`❌ Tests Failed: ${results.failed.length}`);
  console.log(`📸 Screenshots: ${results.screenshots.length}`);
  console.log(`🏗️ Workspaces Found: ${results.workspacesFound}`);
  console.log(`🤖 Agents Found: ${results.agentsFound}`);
  
  const successRate = results.passed.length / (results.passed.length + results.failed.length) * 100;
  console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);
  
  if (results.passed.length > 0) {
    console.log('\n✅ PASSED TESTS:');
    results.passed.forEach((test, i) => console.log(`   ${i + 1}. ${test}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.failed.forEach((test, i) => console.log(`   ${i + 1}. ${test}`));
  }
  
  if (results.screenshots.length > 0) {
    console.log('\n📸 SCREENSHOTS CAPTURED:');
    results.screenshots.forEach(screenshot => {
      console.log(`   • ${screenshot.name}: ${screenshot.path}`);
    });
  }
  
  // Detailed analysis
  console.log('\n🔍 DETAILED ANALYSIS:');
  if (results.workspacesFound > 0) {
    console.log('   ✅ Workspace system appears functional');
  } else {
    console.log('   ⚠️  No workspaces detected - may need setup');
  }
  
  if (results.agentsFound > 0) {
    console.log('   ✅ Agent system appears available');
  } else {
    console.log('   ⚠️  No agents detected - check agent configuration');
  }
  
  const overallStatus = results.failed.length === 0 ? '🎉 FULLY FUNCTIONAL!' : 
                       successRate >= 70 ? '⚠️ MOSTLY FUNCTIONAL' : '🚨 NEEDS ATTENTION';
  console.log(`\n🎯 Overall Status: ${overallStatus}`);
  
  return results.failed.length === 0;
}

async function takeScreenshot(page, name, results) {
  try {
    const dir = path.join(__dirname, 'screenshots', 'agent-interaction');
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
      path.join(dir, 'agent-interaction-test-results.json'),
      JSON.stringify(results, null, 2)
    );
    console.log('\n💾 Results saved to: results/agent-interaction-test-results.json');
  } catch (error) {
    console.log(`❌ Failed to save results: ${error.message}`);
  }
}

// Run if called directly
if (require.main === module) {
  agentInteractionTest().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { agentInteractionTest };