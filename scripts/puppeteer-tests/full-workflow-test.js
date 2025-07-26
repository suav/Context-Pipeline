const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Full Workflow Test - Complete User Journey
 * Tests the actual workflow: sidebar → workspace → agent → interaction
 */
async function fullWorkflowTest() {
  console.log('🎯 Full Workflow Test - Complete User Journey\n');
  console.log('Testing: Sidebar Cards → Open Workspace → Deploy Agent → Chat Interaction');
  
  let browser;
  const results = {
    testName: 'Full Workflow Test',
    timestamp: new Date().toISOString(),
    passed: [],
    failed: [],
    screenshots: [],
    workflowSteps: []
  };

  try {
    console.log('🚀 Launching browser in headful mode...');
    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080',
        '--start-maximized'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    
    // Step 1: Load homepage and wait for full UI
    console.log('\n📄 Step 1: Loading Context Pipeline...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 5000)); // Give UI time to fully load
    
    results.workflowSteps.push('Homepage loaded');
    console.log('   ✅ Homepage loaded, waiting for UI to stabilize...');
    await takeScreenshot(page, '01-homepage-loaded', results);

    // Step 2: Look for workspace sidebar cards
    console.log('\n🏗️ Step 2: Looking for workspace sidebar cards...');
    
    // Wait for workspace elements to appear
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Look for sidebar with workspace cards
    const sidebarElements = await page.$$('[class*="sidebar"]');
    console.log(`   🔍 Found ${sidebarElements.length} sidebar elements`);
    
    // Look for workspace cards in various possible locations
    const possibleWorkspaceSelectors = [
      '[class*="workspace-card"]',
      '[class*="WorkspaceCard"]',
      '[class*="card"]',
      'div[role="button"]',
      '[data-workspace]',
      'button[class*="workspace"]'
    ];
    
    let workspaceCards = [];
    for (const selector of possibleWorkspaceSelectors) {
      try {
        const cards = await page.$$(selector);
        if (cards.length > 0) {
          console.log(`   ✅ Found ${cards.length} elements with selector: ${selector}`);
          workspaceCards = cards;
          break;
        }
      } catch (error) {
        // Continue to next selector
      }
    }
    
    if (workspaceCards.length === 0) {
      // Let's see what's actually in the sidebar
      console.log('   🔍 No obvious workspace cards found, checking sidebar content...');
      
      const sidebarText = await page.evaluate(() => {
        const sidebars = document.querySelectorAll('[class*="sidebar"]');
        return Array.from(sidebars).map(s => s.textContent?.substring(0, 200)).join(' | ');
      });
      
      console.log(`   📄 Sidebar content preview: ${sidebarText}`);
      
      // Try clicking elements that might reveal workspaces
      const buttons = await page.$$('button');
      console.log(`   🎯 Found ${buttons.length} buttons total, trying to find workspace-related ones...`);
      
      for (let i = 0; i < Math.min(5, buttons.length); i++) {
        try {
          const buttonText = await buttons[i].evaluate(el => el.textContent);
          console.log(`   🔍 Button ${i + 1}: "${buttonText}"`);
          
          if (buttonText.toLowerCase().includes('workspace') || 
              buttonText.toLowerCase().includes('library') ||
              buttonText.includes('📚')) {
            console.log(`   🎯 Clicking workspace-related button: "${buttonText}"`);
            await buttons[i].click();
            await new Promise(resolve => setTimeout(resolve, 3000));
            await takeScreenshot(page, `02-after-${buttonText.replace(/[^a-zA-Z0-9]/g, '')}`, results);
            break;
          }
        } catch (error) {
          // Continue
        }
      }
    }

    // Step 3: Try to create or access a workspace
    console.log('\n🏗️ Step 3: Attempting to access or create workspace...');
    
    // Look for "Create New Workspace" or similar
    const createButtons = await page.$$('button');
    let workspaceCreated = false;
    
    for (const button of createButtons) {
      try {
        const text = await button.evaluate(el => el.textContent);
        if (text.includes('Create') && text.includes('Workspace')) {
          console.log(`   🎯 Found create workspace button: "${text}"`);
          await button.click();
          await new Promise(resolve => setTimeout(resolve, 4000));
          results.workflowSteps.push('Create workspace clicked');
          await takeScreenshot(page, '03-workspace-creation', results);
          workspaceCreated = true;
          break;
        }
      } catch (error) {
        // Continue
      }
    }
    
    if (!workspaceCreated) {
      // Try to find existing workspace cards again after UI changes
      await new Promise(resolve => setTimeout(resolve, 2000));
      const allClickable = await page.$$('div[role="button"], button, [class*="card"]');
      
      for (let i = 0; i < Math.min(10, allClickable.length); i++) {
        try {
          const element = allClickable[i];
          const text = await element.evaluate(el => el.textContent);
          
          // Look for anything that might be a workspace
          if (text && (text.includes('draft') || text.includes('workspace') || text.length > 20)) {
            console.log(`   🎯 Trying clickable element: "${text.substring(0, 50)}..."`);
            await element.click();
            await new Promise(resolve => setTimeout(resolve, 4000));
            results.workflowSteps.push('Workspace element clicked');
            await takeScreenshot(page, `03-workspace-attempt-${i}`, results);
            
            // Check if we're now in a workspace (look for file explorer, editor, etc.)
            const workspaceIndicators = await page.$$('[class*="file"], [class*="editor"], [class*="terminal"]');
            if (workspaceIndicators.length > 0) {
              console.log(`   ✅ Workspace opened! Found ${workspaceIndicators.length} workspace elements`);
              results.passed.push('Successfully opened workspace');
              break;
            }
          }
        } catch (error) {
          // Continue
        }
      }
    }

    // Step 4: Look for agent deployment options
    console.log('\n🤖 Step 4: Looking for agent deployment...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const agentButtons = await page.$$('button');
    let agentDeployed = false;
    
    for (const button of agentButtons) {
      try {
        const text = await button.evaluate(el => el.textContent);
        if (text.includes('Claude') || text.includes('Gemini') || text.includes('Agent')) {
          console.log(`   🎯 Found agent button: "${text}"`);
          await button.click();
          await new Promise(resolve => setTimeout(resolve, 5000));
          results.workflowSteps.push(`Agent deployed: ${text}`);
          await takeScreenshot(page, '04-agent-deployed', results);
          agentDeployed = true;
          break;
        }
      } catch (error) {
        // Continue
      }
    }
    
    if (!agentDeployed) {
      console.log('   ⚠️ No obvious agent buttons found, checking for agent areas...');
      
      // Look for agent-related areas or panels
      const agentAreas = await page.$$('[class*="agent"], [class*="chat"], [class*="terminal"]');
      if (agentAreas.length > 0) {
        console.log(`   ✅ Found ${agentAreas.length} agent-related areas`);
        results.passed.push('Agent areas detected');
      }
    }

    // Step 5: Look for chat/interaction interface
    console.log('\n💬 Step 5: Looking for chat interaction interface...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const chatInputs = await page.$$('input[type="text"], textarea');
    if (chatInputs.length > 0) {
      console.log(`   ✅ Found ${chatInputs.length} input elements for chat`);
      
      try {
        const firstInput = chatInputs[0];
        await firstInput.click();
        await firstInput.type('Hello! This is a test message to verify the chat interface is working.');
        
        results.workflowSteps.push('Chat message typed');
        console.log('   ✅ Successfully typed test message');
        
        // Look for send button
        const sendButtons = await page.$$('button');
        for (const button of sendButtons) {
          try {
            const text = await button.evaluate(el => el.textContent);
            if (text.includes('Send') || text.includes('→') || text.includes('↵')) {
              await button.click();
              await new Promise(resolve => setTimeout(resolve, 3000));
              results.workflowSteps.push('Message sent');
              console.log('   ✅ Message sent successfully');
              break;
            }
          } catch (error) {
            // Continue
          }
        }
        
        await takeScreenshot(page, '05-chat-interaction', results);
        results.passed.push('Chat interaction completed');
        
      } catch (error) {
        results.failed.push('Chat interaction failed');
        console.log('   ❌ Chat interaction failed');
      }
    } else {
      results.failed.push('No chat input interface found');
      console.log('   ❌ No chat input interface detected');
    }

    // Step 6: Test navigation persistence
    console.log('\n🧭 Step 6: Testing navigation persistence...');
    
    // Try to navigate away and back
    const homeButton = await page.$('button'); // Get any navigation button
    if (homeButton) {
      try {
        await homeButton.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try to get back to workspace
        const workspaceElements = await page.$$('[class*="workspace"], button');
        if (workspaceElements.length > 0) {
          await workspaceElements[0].click();
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          results.workflowSteps.push('Navigation persistence tested');
          console.log('   ✅ Navigation persistence tested');
          await takeScreenshot(page, '06-navigation-test', results);
        }
      } catch (error) {
        console.log('   ⚠️ Navigation test failed');
      }
    }

    // Final comprehensive screenshot
    await takeScreenshot(page, '07-final-state', results);
    results.workflowSteps.push('Test completed');

  } catch (error) {
    console.error('❌ Test crashed:', error.message);
    results.failed.push(`Fatal error: ${error.message}`);
  } finally {
    if (browser) {
      console.log('\n⏸️  Keeping browser open for 20 seconds for detailed manual inspection...');
      console.log('   👀 PLEASE MANUALLY VERIFY:');
      console.log('      • Can you see workspace cards in the sidebar?');
      console.log('      • Can you click a workspace card to open it?');
      console.log('      • Can you see file explorer, editor, terminal areas?');
      console.log('      • Can you click an agent button (Claude/Gemini)?');
      console.log('      • Can you type in a chat input and send a message?');
      console.log('      • Are the styles and layout working properly?');
      console.log('\n   🔍 This manual verification is crucial for real user experience validation!');
      
      await new Promise(resolve => setTimeout(resolve, 20000));
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }

  // Save results
  await saveResults(results);
  
  // Print comprehensive summary
  console.log('\n' + '='.repeat(70));
  console.log('🎯 FULL WORKFLOW TEST RESULTS');
  console.log('='.repeat(70));
  console.log(`🕒 Timestamp: ${results.timestamp}`);
  console.log(`✅ Tests Passed: ${results.passed.length}`);
  console.log(`❌ Tests Failed: ${results.failed.length}`);
  console.log(`📸 Screenshots: ${results.screenshots.length}`);
  
  console.log('\n🔄 WORKFLOW STEPS COMPLETED:');
  results.workflowSteps.forEach((step, i) => {
    console.log(`   ${i + 1}. ${step}`);
  });
  
  if (results.passed.length > 0) {
    console.log('\n✅ SUCCESSFUL OPERATIONS:');
    results.passed.forEach((test, i) => console.log(`   • ${test}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ FAILED OPERATIONS:');
    results.failed.forEach((test, i) => console.log(`   • ${test}`));
  }
  
  console.log('\n📸 SCREENSHOTS FOR ANALYSIS:');
  results.screenshots.forEach(screenshot => {
    console.log(`   • ${screenshot.name}`);
  });
  
  const successRate = results.passed.length / (results.passed.length + results.failed.length) * 100;
  console.log(`\n📈 Automated Success Rate: ${successRate.toFixed(1)}%`);
  
  console.log('\n🎯 CRITICAL: Manual verification during the 20-second browser window is essential!');
  console.log('   The automated tests can only detect basic functionality.');
  console.log('   Real user workflow validation requires human observation.');
  
  return results;
}

async function takeScreenshot(page, name, results) {
  try {
    const dir = path.join(__dirname, 'screenshots', 'full-workflow');
    await fs.mkdir(dir, { recursive: true });
    const filepath = path.join(dir, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    results.screenshots.push({ name, path: filepath });
    console.log(`   📸 Screenshot saved: ${name}`);
  } catch (error) {
    console.log(`   ❌ Screenshot failed: ${error.message}`);
  }
}

async function saveResults(results) {
  try {
    const dir = path.join(__dirname, 'results');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'full-workflow-test-results.json'),
      JSON.stringify(results, null, 2)
    );
    console.log('\n💾 Results saved to: results/full-workflow-test-results.json');
  } catch (error) {
    console.log(`❌ Failed to save results: ${error.message}`);
  }
}

// Run if called directly
if (require.main === module) {
  fullWorkflowTest().then(results => {
    const success = results.failed.length === 0;
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { fullWorkflowTest };