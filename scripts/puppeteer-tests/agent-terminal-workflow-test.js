const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Agent Terminal Workflow Test - Real Agent Tab Testing
 * Tests: Agent tabs in terminal → Command input → Multiple agents → Persistence → No bleed-through
 * This targets the ACTUAL agent workflow, not file explorer elements
 */
async function agentTerminalWorkflowTest() {
  console.log('🤖 Agent Terminal Workflow Test - Real Agent Tab Testing\n');
  console.log('🎯 Testing Critical Agent Functionality:');
  console.log('   1. Agent tabs in terminal interface (not file explorer)');
  console.log('   2. Command input areas for agent communication');  
  console.log('   3. Multiple agents running simultaneously');
  console.log('   4. Conversation persistence between tab switches');
  console.log('   5. No information bleed-through between agents');
  console.log('   6. Cross-workspace persistence isolation\n');
  
  let browser;
  const results = {
    testName: 'Agent Terminal Workflow Test',
    timestamp: new Date().toISOString(),
    agentTabs: [],
    commandInputs: [],
    conversations: {},
    persistence: [],
    bleedThroughTests: [],
    criticalFindings: [],
    screenshots: []
  };

  try {
    console.log('🚀 Launching browser with focus on terminal agent interface...');
    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1800,1200',
        '--start-maximized'
      ],
      defaultViewport: { width: 1800, height: 1200 }
    });

    const page = await browser.newPage();
    
    // Intercept API calls to track agent interactions
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().includes('/agents/') || request.url().includes('/conversation')) {
        results.criticalFindings.push(`API: ${request.method()} ${request.url()}`);
      }
      request.continue();
    });
    
    // STEP 1: Load workspace and identify terminal area
    console.log('\n🏗️ STEP 1: Loading workspace and locating terminal interface');
    console.log('─'.repeat(70));
    
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0', timeout: 20000 });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await takeScreenshot(page, '01-homepage-loaded', results);
    
    // Find and click a workspace card (not file explorer elements)
    console.log('   🔍 Looking for workspace cards in sidebar...');
    
    const workspaceCards = await page.$$('[class*="workspace"], [class*="card"]');
    let workspaceOpened = false;
    
    for (let i = 0; i < Math.min(3, workspaceCards.length); i++) {
      try {
        const cardText = await workspaceCards[i].evaluate(el => el.textContent);
        if (cardText && cardText.length > 20 && !cardText.includes('Create') && !cardText.includes('Import')) {
          console.log(`   🎯 Clicking workspace card: "${cardText.substring(0, 50)}..."`);
          await workspaceCards[i].click();
          await new Promise(resolve => setTimeout(resolve, 6000));
          
          // Check if workspace opened by looking for terminal area
          const terminalAreas = await page.$$('[class*="terminal"], [class*="Terminal"], [class*="agent"], [class*="chat"]');
          if (terminalAreas.length > 0) {
            console.log(`   ✅ Workspace opened - found ${terminalAreas.length} terminal/agent areas`);
            workspaceOpened = true;
            await takeScreenshot(page, '02-workspace-opened', results);
            break;
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!workspaceOpened) {
      throw new Error('Could not open workspace with terminal interface');
    }

    // STEP 2: Identify and test agent tabs in terminal (NOT file explorer)
    console.log('\n🤖 STEP 2: Locating agent tabs in terminal interface');
    console.log('─'.repeat(70));
    
    // Look specifically for terminal agent tabs, avoiding file explorer
    console.log('   🔍 Scanning for agent tabs in terminal area...');
    
    // First, identify the terminal/chat area specifically
    const terminalContainer = await page.$('[class*="terminal"], [class*="Terminal"], [class*="chat"], [class*="agent"]');
    
    if (!terminalContainer) {
      throw new Error('No terminal container found');
    }
    
    console.log('   ✅ Terminal container located');
    
    // Look for tab-like elements within terminal area
    const agentTabSelectors = [
      'button[class*="tab"]',
      '[role="tab"]',
      'button[class*="agent"]',
      '[class*="tab"][class*="agent"]',
      'div[class*="tab"]'
    ];
    
    let agentTabs = [];
    
    for (const selector of agentTabSelectors) {
      try {
        const tabs = await page.$$(selector);
        for (const tab of tabs) {
          try {
            const tabText = await tab.evaluate(el => el.textContent);
            const tabRect = await tab.boundingBox();
            
            // Filter for agent-related tabs with reasonable positioning
            if (tabText && (tabText.includes('Claude') || tabText.includes('Gemini') || 
                           tabText.includes('Agent') || tabText.match(/^Agent\s*\d+$/)) && 
                tabRect && tabRect.width > 30) {
              
              console.log(`   🎯 Found agent tab: "${tabText}" (${selector})`);
              agentTabs.push({ element: tab, text: tabText, selector });
              results.agentTabs.push(tabText);
            }
          } catch (error) {
            continue;
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    if (agentTabs.length === 0) {
      console.log('   ⚠️ No agent tabs found, looking for agent deployment buttons...');
      
      // Look for buttons to deploy agents
      const deployButtons = await page.$$('button');
      for (const button of deployButtons) {
        try {
          const buttonText = await button.evaluate(el => el.textContent);
          if (buttonText && (buttonText.includes('Claude') || buttonText.includes('Gemini')) && 
              !buttonText.includes('file') && !buttonText.includes('File')) {
            
            console.log(`   🚀 Deploying agent: "${buttonText}"`);
            await button.click();
            await new Promise(resolve => setTimeout(resolve, 4000));
            
            results.agentTabs.push(`Deployed: ${buttonText}`);
            await takeScreenshot(page, '03-agent-deployed', results);
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }

    // STEP 3: Test command input areas (not search inputs)
    console.log('\n💬 STEP 3: Testing command input areas for agent communication');
    console.log('─'.repeat(70));
    
    // Look for command/chat inputs, avoiding search inputs
    const inputElements = await page.$$('input, textarea, [contenteditable="true"]');
    let commandInputs = [];
    
    console.log(`   🔍 Found ${inputElements.length} potential input elements`);
    
    for (let i = 0; i < inputElements.length; i++) {
      try {
        const input = inputElements[i];
        const inputInfo = await input.evaluate(el => ({
          type: el.type || el.tagName.toLowerCase(),
          placeholder: el.placeholder || '',
          className: el.className,
          id: el.id || '',
          visible: el.offsetWidth > 0 && el.offsetHeight > 0,
          value: el.value || el.textContent || ''
        }));
        
        console.log(`   Input ${i + 1}: ${inputInfo.type} - "${inputInfo.placeholder}" - Visible: ${inputInfo.visible}`);
        
        // Skip search inputs and focus on command/chat inputs
        const isSearchInput = inputInfo.placeholder.toLowerCase().includes('search') ||
                              inputInfo.className.toLowerCase().includes('search') ||
                              inputInfo.id.toLowerCase().includes('search');
        
        const isCommandInput = inputInfo.placeholder.toLowerCase().includes('command') ||
                               inputInfo.placeholder.toLowerCase().includes('message') ||
                               inputInfo.placeholder.toLowerCase().includes('chat') ||
                               inputInfo.placeholder.toLowerCase().includes('type') ||
                               inputInfo.className.toLowerCase().includes('command') ||
                               inputInfo.className.toLowerCase().includes('chat');
        
        if (!isSearchInput && inputInfo.visible && (isCommandInput || inputInfo.type === 'text')) {
          console.log(`   🎯 Potential command input found: "${inputInfo.placeholder}"`);
          commandInputs.push({ element: input, info: inputInfo, index: i });
          results.commandInputs.push(inputInfo.placeholder || `Input ${i + 1}`);
        }
      } catch (error) {
        continue;
      }
    }

    // STEP 4: Test multiple agent conversations
    console.log('\n🔄 STEP 4: Testing multiple agent conversations simultaneously');
    console.log('─'.repeat(70));
    
    if (commandInputs.length > 0) {
      console.log(`   💬 Testing with ${commandInputs.length} command inputs...`);
      
      for (let i = 0; i < Math.min(2, commandInputs.length); i++) {
        try {
          const { element: input, info } = commandInputs[i];
          
          console.log(`   🎯 Testing command input ${i + 1}: "${info.placeholder}"`);
          
          await input.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const testMessage = `Test message ${i + 1}: Hello Agent! This is conversation ${i + 1}. Please respond with your agent ID and conversation number.`;
          
          // Clear input first
          await input.evaluate(el => {
            if (el.value !== undefined) el.value = '';
            if (el.textContent !== undefined) el.textContent = '';
          });
          
          await input.type(testMessage, { delay: 50 });
          
          console.log(`   ✅ Message typed in input ${i + 1}`);
          results.conversations[`agent_${i + 1}`] = {
            message: testMessage,
            input: info.placeholder,
            timestamp: new Date().toISOString()
          };
          
          // Look for send button
          const sendButtons = await page.$$('button');
          for (const button of sendButtons) {
            try {
              const btnText = await button.evaluate(el => el.textContent + ' ' + (el.title || ''));
              if (btnText.includes('Send') || btnText.includes('→') || btnText.includes('↵') || 
                  btnText.trim() === '▶' || btnText.includes('Submit')) {
                
                console.log(`   🚀 Sending message via: "${btnText.trim()}"`);
                await button.click();
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                results.conversations[`agent_${i + 1}`].sent = true;
                await takeScreenshot(page, `04-message-sent-agent-${i + 1}`, results);
                break;
              }
            } catch (error) {
              continue;
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.log(`   ❌ Failed to test input ${i + 1}: ${error.message}`);
        }
      }
    }

    // STEP 5: Test agent tab switching and persistence
    console.log('\n🔄 STEP 5: Testing agent tab switching and conversation persistence');
    console.log('─'.repeat(70));
    
    if (agentTabs.length > 1) {
      console.log(`   🔄 Testing tab switching between ${agentTabs.length} agent tabs...`);
      
      for (let i = 0; i < agentTabs.length; i++) {
        try {
          console.log(`   🎯 Switching to agent tab: "${agentTabs[i].text}"`);
          await agentTabs[i].element.click();
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Check if previous conversation is visible
          const pageContent = await page.evaluate(() => document.body.textContent);
          const conversationExists = Object.values(results.conversations).some(conv => 
            pageContent.includes(conv.message?.substring(0, 20) || '')
          );
          
          if (conversationExists) {
            console.log(`   ✅ Conversation persistence confirmed in tab ${i + 1}`);
            results.persistence.push(`Tab ${i + 1}: Conversation visible`);
          } else {
            console.log(`   ⚠️ No conversation visible in tab ${i + 1}`);
            results.persistence.push(`Tab ${i + 1}: No conversation visible`);
          }
          
          await takeScreenshot(page, `05-agent-tab-${i + 1}`, results);
          
        } catch (error) {
          console.log(`   ❌ Failed to switch to tab ${i + 1}: ${error.message}`);
        }
      }
    }

    // STEP 6: Test information bleed-through prevention
    console.log('\n🔒 STEP 6: Testing information isolation (no bleed-through)');
    console.log('─'.repeat(70));
    
    // Navigate to different workspace and check for conversation bleed
    console.log('   🔄 Testing cross-workspace isolation...');
    
    // Try to navigate away and back
    const homeButtons = await page.$$('button');
    for (const button of homeButtons) {
      try {
        const text = await button.evaluate(el => el.textContent);
        if (text.includes('Home') || text.includes('Library') || text.includes('📚')) {
          console.log(`   🏠 Navigating away via: "${text}"`);
          await button.click();
          await new Promise(resolve => setTimeout(resolve, 3000));
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    await takeScreenshot(page, '06-navigated-away', results);
    
    // Check if any previous conversation content is visible
    const awayPageContent = await page.evaluate(() => document.body.textContent);
    const hasBleedThrough = Object.values(results.conversations).some(conv => 
      awayPageContent.includes(conv.message?.substring(0, 20) || '')
    );
    
    if (hasBleedThrough) {
      results.bleedThroughTests.push('FAILED: Conversation visible outside workspace');
      console.log('   ❌ BLEED-THROUGH DETECTED: Conversation visible outside workspace');
    } else {
      results.bleedThroughTests.push('PASSED: No conversation bleed-through detected');
      console.log('   ✅ Information isolation working - no bleed-through');
    }
    
    // Navigate back to workspace
    const workspaceCardsReturn = await page.$$('[class*="workspace"], [class*="card"]');
    if (workspaceCardsReturn.length > 0) {
      try {
        await workspaceCardsReturn[0].click();
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        // Check if conversations returned
        const returnContent = await page.evaluate(() => document.body.textContent);
        const conversationsRestored = Object.values(results.conversations).some(conv => 
          returnContent.includes(conv.message?.substring(0, 20) || '')
        );
        
        if (conversationsRestored) {
          results.persistence.push('Conversations restored after navigation');
          console.log('   ✅ Conversations restored after navigation');
        } else {
          results.persistence.push('Conversations lost after navigation');
          console.log('   ❌ Conversations lost after navigation');
        }
        
        await takeScreenshot(page, '07-returned-to-workspace', results);
        
      } catch (error) {
        console.log('   ❌ Failed to return to workspace');
      }
    }

    await takeScreenshot(page, '08-final-state', results);

  } catch (error) {
    console.error('❌ Test encountered error:', error.message);
    results.criticalFindings.push(`ERROR: ${error.message}`);
  } finally {
    if (browser) {
      console.log('\n' + '👀'.repeat(80));
      console.log('MANUAL VERIFICATION - AGENT TERMINAL TESTING - 60 SECONDS');
      console.log('👀'.repeat(80));
      console.log('');
      console.log('🚨 CRITICAL MANUAL TESTS FOR AGENT TERMINAL WORKFLOW:');
      console.log('');
      console.log('1. 🤖 AGENT TABS IN TERMINAL:');
      console.log('   • Look for tabs labeled "Claude", "Gemini", "Agent 1", etc. in terminal area');
      console.log('   • These should be TABS not files in file explorer');
      console.log('   • Click different agent tabs and verify they switch contexts');
      console.log('');
      console.log('2. 💬 COMMAND INPUT AREAS:');
      console.log('   • Find the command input (usually at bottom of terminal)');
      console.log('   • Should have placeholder like "Type your command..." or "Message..."');
      console.log('   • NOT the file search input at top');
      console.log('   • Type test messages to agents');
      console.log('');
      console.log('3. 🔄 MULTIPLE AGENTS SIMULTANEOUSLY:');
      console.log('   • Open/deploy 2+ agents (Claude + Gemini)');
      console.log('   • Send different messages to each agent');
      console.log('   • Switch between agent tabs');
      console.log('   • Verify each agent has its own conversation');
      console.log('');
      console.log('4. 💾 CONVERSATION PERSISTENCE:');
      console.log('   • Send messages to Agent 1, switch to Agent 2');
      console.log('   • Switch back to Agent 1 - conversation should still be there');
      console.log('   • Navigate away from workspace, return - should persist');
      console.log('');
      console.log('5. 🔒 NO INFORMATION BLEED-THROUGH:');
      console.log('   • Agent 1 conversation should NOT appear in Agent 2 tab');
      console.log('   • Navigate to different workspace - should NOT see old conversations');
      console.log('   • Each agent context should be completely isolated');
      console.log('');
      console.log('6. 🎯 REAL WORKFLOW VERIFICATION:');
      console.log('   • Can you have a real conversation with Claude?');
      console.log('   • Does the agent respond appropriately?');
      console.log('   • Are responses properly formatted and displayed?');
      console.log('');
      console.log('🔥 MOST CRITICAL: Verify this is the REAL agent workflow,');
      console.log('    not just clicking on agent files in the file explorer!');
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
  console.log('🤖 AGENT TERMINAL WORKFLOW TEST - COMPREHENSIVE ANALYSIS');
  console.log('='.repeat(90));
  console.log(`🕒 Test completed: ${results.timestamp}`);
  console.log(`🤖 Agent tabs found: ${results.agentTabs.length}`);
  console.log(`💬 Command inputs found: ${results.commandInputs.length}`);
  console.log(`🔄 Conversations tested: ${Object.keys(results.conversations).length}`);
  console.log(`💾 Persistence tests: ${results.persistence.length}`);
  console.log(`🔒 Bleed-through tests: ${results.bleedThroughTests.length}`);
  console.log(`📸 Screenshots captured: ${results.screenshots.length}`);
  
  if (results.agentTabs.length > 0) {
    console.log('\n🤖 AGENT TABS DETECTED:');
    results.agentTabs.forEach((tab, i) => console.log(`   ${i + 1}. ${tab}`));
  }
  
  if (results.commandInputs.length > 0) {
    console.log('\n💬 COMMAND INPUTS FOUND:');
    results.commandInputs.forEach((input, i) => console.log(`   ${i + 1}. ${input}`));
  }
  
  if (Object.keys(results.conversations).length > 0) {
    console.log('\n🔄 CONVERSATION TESTS:');
    Object.entries(results.conversations).forEach(([agent, conv]) => {
      console.log(`   ${agent}: ${conv.sent ? '✅ Sent' : '❌ Failed'} - "${conv.message?.substring(0, 40)}..."`);
    });
  }
  
  if (results.persistence.length > 0) {
    console.log('\n💾 PERSISTENCE RESULTS:');
    results.persistence.forEach((test, i) => console.log(`   ${i + 1}. ${test}`));
  }
  
  if (results.bleedThroughTests.length > 0) {
    console.log('\n🔒 ISOLATION TESTS:');
    results.bleedThroughTests.forEach((test, i) => console.log(`   ${i + 1}. ${test}`));
  }
  
  if (results.criticalFindings.length > 0) {
    console.log('\n🔍 CRITICAL API CALLS & FINDINGS:');
    results.criticalFindings.forEach((finding, i) => console.log(`   ${i + 1}. ${finding}`));
  }
  
  console.log('\n📸 VISUAL EVIDENCE:');
  results.screenshots.forEach(screenshot => {
    console.log(`   • ${screenshot.name}`);
  });
  
  const functionalityScore = results.agentTabs.length + results.commandInputs.length + 
                            Object.keys(results.conversations).length;
  
  const overallAssessment = functionalityScore >= 6 ? '🎉 AGENT WORKFLOW FULLY FUNCTIONAL' : 
                           functionalityScore >= 3 ? '⚠️ PARTIAL AGENT FUNCTIONALITY' : 
                           '🚨 AGENT WORKFLOW NEEDS MAJOR FIXES';
  
  console.log(`\n🎯 AGENT FUNCTIONALITY SCORE: ${functionalityScore}/8 components working`);
  console.log(`📊 OVERALL ASSESSMENT: ${overallAssessment}`);
  console.log('\n🔑 CRITICAL: Manual verification is essential for agent workflow validation!');
  console.log('='.repeat(90));
  
  return results;
}

async function takeScreenshot(page, name, results) {
  try {
    const dir = path.join(__dirname, 'screenshots', 'agent-terminal-workflow');
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
      path.join(dir, 'agent-terminal-workflow-results.json'),
      JSON.stringify(results, null, 2)
    );
    console.log('💾 Detailed results saved to: results/agent-terminal-workflow-results.json');
  } catch (error) {
    console.log(`❌ Failed to save results: ${error.message}`);
  }
}

// Run if called directly
if (require.main === module) {
  agentTerminalWorkflowTest().then(results => {
    const success = results.agentTabs.length > 0 && results.commandInputs.length > 0;
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Agent terminal workflow test failed:', error);
    process.exit(1);
  });
}

module.exports = { agentTerminalWorkflowTest };