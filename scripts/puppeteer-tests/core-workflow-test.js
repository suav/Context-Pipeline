const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Core Workflow Test - The Essential User Journey  
 * Tests: Credentials → Workspace Cards → Agent Chat → Navigation Persistence
 * This is the test that matters most for validating user experience
 */
async function coreWorkflowTest() {
  console.log('🎯 Core Workflow Test - Essential User Journey\n');
  console.log('🔄 Testing Complete Flow:');
  console.log('   1. Credentials Management (JIRA/Git setup)');
  console.log('   2. Workspace Cards (sidebar navigation)');  
  console.log('   3. Agent Deployment (Claude/Gemini)');
  console.log('   4. Chat Interaction (real conversation)');
  console.log('   5. Navigation Persistence (maintain state)\n');
  
  let browser;
  const results = {
    testName: 'Core Workflow Test',
    timestamp: new Date().toISOString(),
    passed: [],
    failed: [],
    screenshots: [],
    workflowSteps: [],
    criticalIssues: []
  };

  try {
    console.log('🚀 Launching browser (will stay open longer for inspection)...');
    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--window-size=1400,1000',
        '--start-maximized'
      ],
      defaultViewport: { width: 1400, height: 1000 }
    });

    const page = await browser.newPage();
    
    // WORKFLOW STEP 1: Credentials Management
    console.log('\n🔐 STEP 1: Testing Credentials Management');
    console.log('─'.repeat(50));
    
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    results.workflowSteps.push('1. Homepage loaded');
    await takeScreenshot(page, '01-homepage', results);
    
    // Find and open settings
    console.log('   🔍 Looking for Settings button...');
    const settingsSelectors = ['button:contains("Settings")', 'button[title*="Settings"]', 'button'];
    let settingsFound = false;
    
    const allButtons = await page.$$('button');
    for (const button of allButtons) {
      try {
        const text = await button.evaluate(el => el.textContent + ' ' + (el.title || '') + ' ' + (el.getAttribute('aria-label') || ''));
        if (text.toLowerCase().includes('settings') || text.includes('☰')) {
          console.log(`   ✅ Found settings button: "${text}"`);
          await button.click();
          await new Promise(resolve => setTimeout(resolve, 3000));
          settingsFound = true;
          results.workflowSteps.push('1a. Settings opened');
          await takeScreenshot(page, '02-settings-open', results);
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (settingsFound) {
      // Look for credentials option
      console.log('   🔐 Looking for Credentials option...');
      const credentialsButtons = await page.$$('button');
      for (const button of credentialsButtons) {
        try {
          const text = await button.evaluate(el => el.textContent);
          if (text.toLowerCase().includes('credential') || text.includes('🔐')) {
            console.log(`   ✅ Found credentials button: "${text}"`);
            await button.click();
            await new Promise(resolve => setTimeout(resolve, 3000));
            results.workflowSteps.push('1b. Credentials modal opened');
            results.passed.push('Credentials management accessible');
            await takeScreenshot(page, '03-credentials-modal', results);
            
            // Close credentials modal
            const closeButtons = await page.$$('button');
            for (const closeBtn of closeButtons) {
              const closeText = await closeBtn.evaluate(el => el.textContent);
              if (closeText.includes('✕') || closeText.includes('Close')) {
                await closeBtn.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
                break;
              }
            }
            break;
          }
        } catch (error) {
          continue;
        }
      }
    } else {
      results.failed.push('Settings button not found');
      results.criticalIssues.push('Cannot access credentials - settings not accessible');
    }

    // WORKFLOW STEP 2: Workspace Cards and Navigation
    console.log('\n🏗️ STEP 2: Testing Workspace Cards & Sidebar');
    console.log('─'.repeat(50));
    
    // Close settings if still open
    const escapeClose = await page.$$('button');
    for (const btn of escapeClose) {
      try {
        const text = await btn.evaluate(el => el.textContent);
        if (text.includes('✕')) {
          await btn.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        continue;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    await takeScreenshot(page, '04-main-interface', results);
    
    // Look for workspace sidebar or workspace cards
    console.log('   🔍 Scanning for workspace cards or sidebar...');
    
    // Check for sidebar
    const pageContent = await page.content();
    console.log(`   📄 Page size: ${pageContent.length} characters`);
    
    // Look for workspace-related elements more broadly
    const allElements = await page.$$('div, button, section');
    console.log(`   🔍 Found ${allElements.length} total elements to examine`);
    
    let workspaceFound = false;
    let workspaceCards = [];
    
    // Check for elements that might be workspace cards
    for (let i = 0; i < Math.min(50, allElements.length); i++) {
      try {
        const element = allElements[i];
        const text = await element.evaluate(el => el.textContent);
        const classList = await element.evaluate(el => el.className);
        
        if ((text && text.length > 10 && text.length < 100) && 
            (classList.includes('card') || classList.includes('workspace') || 
             text.toLowerCase().includes('draft') || text.toLowerCase().includes('workspace'))) {
          
          console.log(`   🎯 Potential workspace card: "${text.substring(0, 60)}..."`);
          console.log(`       Classes: ${classList}`);
          workspaceCards.push(element);
          
          if (workspaceCards.length === 1) {
            // Try clicking the first promising workspace card
            console.log('   🖱️ Attempting to click potential workspace...');
            await element.click();
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            results.workflowSteps.push('2a. Workspace card clicked');
            await takeScreenshot(page, '05-workspace-clicked', results);
            
            // Check if we're now in a workspace (look for workspace indicators)
            const workspaceIndicators = await page.$$('[class*="file"], [class*="editor"], [class*="terminal"], [class*="monaco"], [class*="agent"]');
            if (workspaceIndicators.length > 5) {
              console.log(`   ✅ Workspace opened! Found ${workspaceIndicators.length} workspace elements`);
              results.passed.push('Workspace navigation successful');
              results.workflowSteps.push('2b. Workspace interior loaded');
              workspaceFound = true;
              break;
            }
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!workspaceFound) {
      console.log('   ⚠️ No workspace cards found, trying Create New Workspace...');
      
      // Look for Create Workspace button
      const createButtons = await page.$$('button');
      for (const button of createButtons) {
        try {
          const text = await button.evaluate(el => el.textContent);
          if (text.includes('Create') && (text.includes('Workspace') || text.includes('New'))) {
            console.log(`   🎯 Clicking: "${text}"`);
            await button.click();
            await new Promise(resolve => setTimeout(resolve, 4000));
            results.workflowSteps.push('2c. Create workspace initiated');
            await takeScreenshot(page, '06-create-workspace', results);
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }

    // WORKFLOW STEP 3: Agent Deployment
    console.log('\n🤖 STEP 3: Testing Agent Deployment');
    console.log('─'.repeat(50));
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Look for agent buttons (Claude, Gemini, etc.)
    console.log('   🔍 Looking for agent deployment options...');
    const agentButtons = await page.$$('button, div[role="button"]');
    let agentDeployed = false;
    
    for (const button of agentButtons) {
      try {
        const text = await button.evaluate(el => el.textContent + ' ' + (el.title || ''));
        if (text.includes('Claude') || text.includes('Gemini') || text.includes('Agent')) {
          console.log(`   🎯 Found agent option: "${text}"`);
          await button.click();
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          results.workflowSteps.push(`3a. Agent deployed: ${text}`);
          results.passed.push('Agent deployment successful');
          await takeScreenshot(page, '07-agent-deployed', results);
          agentDeployed = true;
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!agentDeployed) {
      results.failed.push('No agent deployment options found');
      results.criticalIssues.push('Cannot deploy agents - core functionality missing');
      console.log('   ❌ No agent deployment options found');
    }

    // WORKFLOW STEP 4: Chat Interaction
    console.log('\n💬 STEP 4: Testing Chat Interaction');
    console.log('─'.repeat(50));
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Look for chat input
    console.log('   🔍 Looking for chat input interface...');
    const chatInputs = await page.$$('input[type="text"], textarea, [contenteditable="true"]');
    
    if (chatInputs.length > 0) {
      console.log(`   ✅ Found ${chatInputs.length} potential chat inputs`);
      
      try {
        const chatInput = chatInputs[0];
        await chatInput.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const testMessage = 'Hello! This is a test message. Can you help me understand this workspace and show me what files are available?';
        await chatInput.type(testMessage);
        
        console.log('   ✅ Test message typed successfully');
        results.workflowSteps.push('4a. Chat message entered');
        
        // Look for send button
        const sendButtons = await page.$$('button');
        for (const button of sendButtons) {
          try {
            const text = await button.evaluate(el => el.textContent + ' ' + (el.title || ''));
            if (text.includes('Send') || text.includes('→') || text.includes('↵') || text.trim() === '▶') {
              console.log(`   🎯 Clicking send button: "${text}"`);
              await button.click();
              await new Promise(resolve => setTimeout(resolve, 4000));
              
              results.workflowSteps.push('4b. Message sent to agent');
              results.passed.push('Chat interaction completed');
              await takeScreenshot(page, '08-chat-sent', results);
              
              // Wait for potential response
              console.log('   ⏳ Waiting for agent response...');
              await new Promise(resolve => setTimeout(resolve, 6000));
              await takeScreenshot(page, '09-agent-response', results);
              break;
            }
          } catch (error) {
            continue;
          }
        }
        
      } catch (error) {
        results.failed.push('Chat interaction failed');
        console.log('   ❌ Chat interaction failed:', error.message);
      }
    } else {
      results.failed.push('No chat input interface found');
      results.criticalIssues.push('Cannot chat with agents - input interface missing');
      console.log('   ❌ No chat input interface found');
    }

    // WORKFLOW STEP 5: Navigation Persistence Test
    console.log('\n🧭 STEP 5: Testing Navigation Persistence');
    console.log('─'.repeat(50));
    
    console.log('   🔄 Testing navigation away and back...');
    
    // Try to navigate to home/library and back
    const navButtons = await page.$$('button');
    for (const button of navButtons) {
      try {
        const text = await button.evaluate(el => el.textContent);
        if (text.includes('Library') || text.includes('Home') || text.includes('📚')) {
          console.log(`   🎯 Navigating to: "${text}"`);
          await button.click();
          await new Promise(resolve => setTimeout(resolve, 3000));
          results.workflowSteps.push('5a. Navigated away from workspace');
          await takeScreenshot(page, '10-navigated-away', results);
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    // Try to get back to workspace
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (workspaceCards.length > 0) {
      try {
        await workspaceCards[0].click();
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        // Check if conversation is still there
        const chatContent = await page.evaluate(() => document.body.textContent);
        if (chatContent.includes('This is a test message')) {
          results.passed.push('Navigation persistence working - conversation maintained');
          results.workflowSteps.push('5b. Navigation persistence confirmed');
          console.log('   ✅ Conversation persisted after navigation!');
        } else {
          results.failed.push('Navigation persistence failed - conversation lost');
          console.log('   ❌ Conversation lost after navigation');
        }
        
        await takeScreenshot(page, '11-back-to-workspace', results);
        
      } catch (error) {
        results.failed.push('Navigation back to workspace failed');
        console.log('   ❌ Could not navigate back to workspace');
      }
    }

    // Final comprehensive screenshot
    await takeScreenshot(page, '12-final-state', results);
    results.workflowSteps.push('Test sequence completed');

  } catch (error) {
    console.error('❌ Test crashed:', error.message);
    results.failed.push(`Fatal error: ${error.message}`);
    results.criticalIssues.push(`Test crash: ${error.message}`);
  } finally {
    if (browser) {
      console.log('\n' + '⏸️'.repeat(60));
      console.log('🔍 MANUAL INSPECTION TIME - 30 SECONDS');
      console.log('⏸️'.repeat(60));
      console.log('👀 PLEASE MANUALLY VERIFY THESE CRITICAL WORKFLOWS:');
      console.log('');
      console.log('   1. 🔐 CREDENTIALS: Can you open Settings → Credentials?');
      console.log('      • Add a JIRA credential with URL, email, token');
      console.log('      • Add a Git credential with token');
      console.log('      • Verify they save and validate properly');
      console.log('');
      console.log('   2. 🏗️ WORKSPACES: Can you see and interact with workspace cards?');
      console.log('      • Are there workspace cards in the sidebar?');
      console.log('      • Do they open when clicked?');
      console.log('      • Can you create new workspaces?');
      console.log('');
      console.log('   3. 🤖 AGENTS: Can you deploy and chat with agents?');
      console.log('      • Are Claude/Gemini buttons visible in workspace?');
      console.log('      • Do they open chat interface when clicked?');
      console.log('      • Can you type and send messages?');
      console.log('');
      console.log('   4. 🧭 NAVIGATION: Does conversation persist?');
      console.log('      • Navigate away from workspace');
      console.log('      • Come back to same workspace');
      console.log('      • Is the conversation still there?');
      console.log('');
      console.log('   5. 🎨 STYLING: Does everything look good?');
      console.log('      • Are colors, fonts, spacing correct?');
      console.log('      • Do buttons have hover effects?');
      console.log('      • Is the layout responsive?');
      console.log('');
      console.log('🚨 NOTE: Your manual verification is MORE IMPORTANT than automated results!');
      console.log('─'.repeat(60));
      
      await new Promise(resolve => setTimeout(resolve, 30000));
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }

  // Save comprehensive results
  await saveResults(results);
  
  // Print detailed analysis
  console.log('\n' + '='.repeat(80));
  console.log('🎯 CORE WORKFLOW TEST - COMPREHENSIVE ANALYSIS');
  console.log('='.repeat(80));
  console.log(`🕒 Timestamp: ${results.timestamp}`);
  console.log(`✅ Automated Successes: ${results.passed.length}`);
  console.log(`❌ Automated Failures: ${results.failed.length}`);
  console.log(`🚨 Critical Issues: ${results.criticalIssues.length}`);
  console.log(`📸 Screenshots: ${results.screenshots.length}`);
  
  console.log('\n🔄 WORKFLOW PROGRESSION:');
  results.workflowSteps.forEach((step, i) => {
    console.log(`   ${i + 1}. ${step}`);
  });
  
  if (results.passed.length > 0) {
    console.log('\n✅ WORKING FUNCTIONALITY:');
    results.passed.forEach(success => console.log(`   • ${success}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ DETECTED ISSUES:');
    results.failed.forEach(failure => console.log(`   • ${failure}`));
  }
  
  if (results.criticalIssues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION:');
    results.criticalIssues.forEach(issue => console.log(`   • ${issue}`));
  }
  
  console.log('\n📸 VISUAL EVIDENCE:');
  results.screenshots.forEach(screenshot => {
    console.log(`   • ${screenshot.name}`);
  });
  
  const automatedSuccessRate = results.passed.length / (results.passed.length + results.failed.length) * 100;
  console.log(`\n📊 Automated Success Rate: ${automatedSuccessRate.toFixed(1)}%`);
  
  const overallStatus = results.criticalIssues.length === 0 ? '🎉 CORE WORKFLOWS FUNCTIONAL' : 
                       results.criticalIssues.length <= 2 ? '⚠️ MINOR ISSUES DETECTED' : '🚨 MAJOR ISSUES NEED FIXING';
  
  console.log(`🎯 Overall Assessment: ${overallStatus}`);
  console.log('\n🔑 REMEMBER: Manual verification during browser inspection is the definitive test!');
  console.log('   Screenshots and automated clicks can miss UX issues, slow loading, etc.');
  console.log('='.repeat(80));
  
  return results;
}

async function takeScreenshot(page, name, results) {
  try {
    const dir = path.join(__dirname, 'screenshots', 'core-workflow');
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
      path.join(dir, 'core-workflow-test-results.json'),
      JSON.stringify(results, null, 2)
    );
    console.log('\n💾 Detailed results saved to: results/core-workflow-test-results.json');
  } catch (error) {
    console.log(`❌ Failed to save results: ${error.message}`);
  }
}

// Run if called directly
if (require.main === module) {
  coreWorkflowTest().then(results => {
    const success = results.criticalIssues.length === 0;
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Core workflow test failed:', error);
    process.exit(1);
  });
}

module.exports = { coreWorkflowTest };