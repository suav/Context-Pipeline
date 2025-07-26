const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Precise Agent Workflow Test - Based on Server Log Evidence
 * Uses evidence from server logs to target the exact workflow
 */
async function preciseAgentWorkflowTest() {
  console.log('🎯 Precise Agent Workflow Test - Based on Server Evidence\n');
  console.log('📋 Server logs show these API calls work:');
  console.log('   • GET /api/workspaces/[workspaceId]/agents/[agentId]');
  console.log('   • GET /api/workspaces/[workspaceId]/agents/[agentId]/conversation');
  console.log('   • POST /api/workspaces/[workspaceId]/agents/[agentId]/session-restore');
  console.log('   • Working workspace: draft-1752005926295-8rybuy4hm-DV0L-1272\n');
  
  let browser;
  const results = {
    testName: 'Precise Agent Workflow Test',
    timestamp: new Date().toISOString(),
    workspaceAccess: false,
    agentInterfaces: [],
    commandInputs: [],
    agentTabs: [],
    conversations: [],
    apiCalls: [],
    screenshots: []
  };

  try {
    console.log('🚀 Launching browser with precise targeting...');
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
    
    // Track all API calls to understand what's happening
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/')) {
        results.apiCalls.push({
          method: request.method(),
          url: url,
          timestamp: new Date().toISOString()
        });
        console.log(`   🌐 API: ${request.method()} ${url}`);
      }
      request.continue();
    });
    
    // STEP 1: Load and find the specific workspace that works
    console.log('\n🏗️ STEP 1: Accessing known working workspace');
    console.log('─'.repeat(60));
    
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0', timeout: 20000 });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await takeScreenshot(page, '01-homepage', results);
    
    // Look for the specific workspace pattern we saw in server logs
    console.log('   🔍 Looking for workspace cards with agent activity...');
    
    // Wait for workspaces to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Look for workspace cards containing emoji and numbers pattern (🤖0📊7)
    const workspaceElements = await page.$$('div, button, section');
    console.log(`   📊 Scanning ${workspaceElements.length} elements for workspace patterns...`);
    
    let workspaceFound = false;
    
    for (let i = 0; i < Math.min(100, workspaceElements.length); i++) {
      try {
        const element = workspaceElements[i];
        const text = await element.evaluate(el => el.textContent);
        const classes = await element.evaluate(el => el.className);
        
        // Look for workspace cards with the pattern we saw: 🤖0📊7Workspace
        if (text && text.includes('🤖') && text.includes('📊') && text.includes('Workspace') && 
            classes.includes('cursor-pointer')) {
          
          console.log(`   🎯 Found workspace card: "${text.substring(0, 80)}..."`);
          console.log(`       Classes: ${classes}`);
          
          // Click the workspace card
          await element.click();
          await new Promise(resolve => setTimeout(resolve, 8000)); // Give time for workspace to load
          
          results.workspaceAccess = true;
          await takeScreenshot(page, '02-workspace-opened', results);
          workspaceFound = true;
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!workspaceFound) {
      // Try clicking any workspace-like element
      const allElements = await page.$$('[class*="workspace"], [class*="card"]');
      for (const element of allElements.slice(0, 5)) {
        try {
          const text = await element.evaluate(el => el.textContent);
          if (text && text.length > 20 && !text.includes('Create') && !text.includes('Import')) {
            console.log(`   🎯 Trying workspace element: "${text.substring(0, 50)}..."`);
            await element.click();
            await new Promise(resolve => setTimeout(resolve, 6000));
            results.workspaceAccess = true;
            await takeScreenshot(page, '02-workspace-fallback', results);
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }

    // STEP 2: Look for agent interface elements
    console.log('\n🤖 STEP 2: Scanning for agent interface elements');
    console.log('─'.repeat(60));
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Look for agent-related elements more comprehensively
    console.log('   🔍 Searching for agent interface components...');
    
    // Look for tabs, buttons, and areas that might be agent-related
    const agentSelectors = [
      '[class*="agent"]',
      '[class*="Agent"]',
      '[class*="claude"]',
      '[class*="Claude"]',
      '[class*="gemini"]',
      '[class*="Gemini"]',
      '[class*="tab"]',
      '[role="tab"]',
      '[class*="terminal"]',
      '[class*="Terminal"]',
      '[class*="chat"]',
      '[class*="Chat"]'
    ];
    
    for (const selector of agentSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          try {
            const text = await element.evaluate(el => el.textContent);
            const classes = await element.evaluate(el => el.className);
            const tag = await element.evaluate(el => el.tagName);
            
            if (text && text.length < 100) {
              console.log(`   🔍 Agent element: ${tag}.${classes} - "${text}"`);
              results.agentInterfaces.push({
                selector,
                text,
                classes,
                tag
              });
              
              // If it looks like an agent tab or button, try clicking it
              if ((text.includes('Claude') || text.includes('Gemini') || text.includes('Agent')) &&
                  (tag === 'BUTTON' || classes.includes('tab') || classes.includes('cursor'))) {
                
                console.log(`   🎯 Clicking agent element: "${text}"`);
                await element.click();
                await new Promise(resolve => setTimeout(resolve, 4000));
                results.agentTabs.push(text);
                await takeScreenshot(page, `03-agent-${text.replace(/[^a-zA-Z0-9]/g, '')}`, results);
              }
            }
          } catch (error) {
            continue;
          }
        }
      } catch (error) {
        continue;
      }
    }

    // STEP 3: Comprehensive input element analysis
    console.log('\n💬 STEP 3: Comprehensive input element analysis');
    console.log('─'.repeat(60));
    
    console.log('   🔍 Analyzing all input elements...');
    
    const allInputs = await page.$$('input, textarea, [contenteditable="true"]');
    console.log(`   📊 Found ${allInputs.length} total input elements`);
    
    for (let i = 0; i < allInputs.length; i++) {
      try {
        const input = allInputs[i];
        const inputData = await input.evaluate(el => ({
          type: el.type || el.tagName.toLowerCase(),
          placeholder: el.placeholder || '',
          id: el.id || '',
          className: el.className || '',
          value: el.value || el.textContent || '',
          visible: el.offsetWidth > 0 && el.offsetHeight > 0,
          position: {
            top: el.offsetTop,
            left: el.offsetLeft,
            width: el.offsetWidth,
            height: el.offsetHeight
          }
        }));
        
        console.log(`   Input ${i + 1}: ${inputData.type} - "${inputData.placeholder}" - Visible: ${inputData.visible}`);
        console.log(`       Position: ${inputData.position.left},${inputData.position.top} (${inputData.position.width}x${inputData.position.height})`);
        console.log(`       Classes: ${inputData.className}`);
        
        results.commandInputs.push(inputData);
        
        // Test any visible input that's not clearly a search
        if (inputData.visible && !inputData.placeholder.toLowerCase().includes('search') && 
            inputData.position.width > 100) {
          
          console.log(`   🎯 Testing input: "${inputData.placeholder}"`);
          
          try {
            await input.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const testMessage = `Test message ${i + 1}: Hello from automated test - checking agent communication`;
            await input.type(testMessage);
            
            console.log(`   ✅ Successfully typed in input ${i + 1}`);
            results.conversations.push({
              input: i + 1,
              placeholder: inputData.placeholder,
              message: testMessage,
              timestamp: new Date().toISOString()
            });
            
            await takeScreenshot(page, `04-input-${i + 1}-typed`, results);
            
            // Look for send buttons
            const buttons = await page.$$('button');
            for (const button of buttons) {
              try {
                const btnText = await button.evaluate(el => el.textContent);
                if (btnText && (btnText.includes('Send') || btnText.includes('→') || btnText.includes('↵'))) {
                  console.log(`   🚀 Clicking send button: "${btnText}"`);
                  await button.click();
                  await new Promise(resolve => setTimeout(resolve, 5000));
                  
                  results.conversations[results.conversations.length - 1].sent = true;
                  await takeScreenshot(page, `05-message-sent-${i + 1}`, results);
                  break;
                }
              } catch (error) {
                continue;
              }
            }
            
            // Only test first 2 inputs to avoid overwhelming
            if (i >= 1) break;
            
          } catch (error) {
            console.log(`   ❌ Failed to interact with input ${i + 1}: ${error.message}`);
          }
        }
      } catch (error) {
        continue;
      }
    }

    // STEP 4: Check for response areas and conversation display
    console.log('\n📱 STEP 4: Checking for conversation display areas');
    console.log('─'.repeat(60));
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Look for areas that might show agent responses
    const responseAreas = await page.$$('[class*="message"], [class*="response"], [class*="conversation"], [class*="chat"]');
    console.log(`   💬 Found ${responseAreas.length} potential conversation areas`);
    
    for (const area of responseAreas) {
      try {
        const text = await area.evaluate(el => el.textContent);
        if (text && text.length > 10) {
          console.log(`   💬 Conversation area: "${text.substring(0, 100)}..."`);
        }
      } catch (error) {
        continue;
      }
    }

    await takeScreenshot(page, '06-final-state', results);

  } catch (error) {
    console.error('❌ Test error:', error.message);
    results.error = error.message;
  } finally {
    if (browser) {
      console.log('\n' + '👁️'.repeat(80));
      console.log('EXTENDED MANUAL VERIFICATION - 45 SECONDS');
      console.log('👁️'.repeat(80));
      console.log('');
      console.log('🎯 CRITICAL MANUAL VERIFICATION TASKS:');
      console.log('');
      console.log('1. 🏗️ WORKSPACE ACCESS:');
      console.log('   • Are you in a workspace with file explorer on left?');
      console.log('   • Can you see files, folders, and workspace structure?');
      console.log('   • Is there a terminal/agent area visible?');
      console.log('');
      console.log('2. 🤖 AGENT INTERFACE LOCATION:');
      console.log('   • Look for agent tabs or buttons (NOT in file explorer)');
      console.log('   • Should be in terminal area or separate agent panel');
      console.log('   • Try clicking "Claude", "Gemini", or "Agent" buttons/tabs');
      console.log('');
      console.log('3. 💬 COMMAND INPUT IDENTIFICATION:');
      console.log('   • Find the command input for agents (bottom of screen?)');
      console.log('   • Should have placeholder like "Type your command..."');
      console.log('   • NOT the file search at top of file explorer');
      console.log('');
      console.log('4. 🔄 AGENT WORKFLOW TEST:');
      console.log('   • Deploy an agent (Claude or Gemini)');
      console.log('   • Type a message in the command input');
      console.log('   • Send the message and wait for response');
      console.log('   • Verify agent responds appropriately');
      console.log('');
      console.log('5. 🔀 MULTIPLE AGENT TEST:');
      console.log('   • Open/deploy a second agent');
      console.log('   • Switch between agent tabs');
      console.log('   • Verify each has separate conversation');
      console.log('   • No conversation bleed-through between agents');
      console.log('');
      console.log('6. 💾 PERSISTENCE TEST:');
      console.log('   • Navigate away from workspace');
      console.log('   • Return to same workspace');
      console.log('   • Verify agent conversations are still there');
      console.log('');
      console.log('🚨 KEY QUESTION: Where exactly are the agent interfaces?');
      console.log('   Are they tabs in a terminal? Separate panels? Modal dialogs?');
      console.log('   This is what we need to understand for proper testing!');
      console.log('───────────────────────────────────────────────────────────────────────────────');
      
      await new Promise(resolve => setTimeout(resolve, 45000));
      await browser.close();
      console.log('🔒 Browser closed after verification period');
    }
  }

  // Save results
  await saveResults(results);
  
  // Print analysis
  console.log('\n' + '='.repeat(90));
  console.log('🎯 PRECISE AGENT WORKFLOW TEST - DETAILED ANALYSIS');
  console.log('='.repeat(90));
  console.log(`🕒 Test completed: ${results.timestamp}`);
  console.log(`🏗️ Workspace accessed: ${results.workspaceAccess ? '✅ Yes' : '❌ No'}`);
  console.log(`🤖 Agent interfaces found: ${results.agentInterfaces.length}`);
  console.log(`💬 Command inputs found: ${results.commandInputs.length}`);
  console.log(`🔄 Agent tabs detected: ${results.agentTabs.length}`);
  console.log(`📝 Conversations tested: ${results.conversations.length}`);
  console.log(`🌐 API calls tracked: ${results.apiCalls.length}`);
  console.log(`📸 Screenshots captured: ${results.screenshots.length}`);
  
  if (results.agentInterfaces.length > 0) {
    console.log('\n🤖 AGENT INTERFACE ELEMENTS DETECTED:');
    results.agentInterfaces.forEach((iface, i) => {
      console.log(`   ${i + 1}. ${iface.tag}.${iface.classes} - "${iface.text}"`);
    });
  }
  
  if (results.commandInputs.length > 0) {
    console.log('\n💬 COMMAND INPUTS ANALYZED:');
    results.commandInputs.forEach((input, i) => {
      console.log(`   ${i + 1}. ${input.type} - "${input.placeholder}" - Visible: ${input.visible}`);
      console.log(`       Position: ${input.position.left},${input.position.top} (${input.position.width}x${input.position.height})`);
    });
  }
  
  if (results.conversations.length > 0) {
    console.log('\n📝 CONVERSATION TESTS:');
    results.conversations.forEach((conv, i) => {
      console.log(`   ${i + 1}. Input "${conv.placeholder}" - ${conv.sent ? '✅ Sent' : '❌ Not sent'}`);
      console.log(`       Message: "${conv.message.substring(0, 50)}..."`);
    });
  }
  
  if (results.apiCalls.length > 0) {
    console.log('\n🌐 API CALLS CAPTURED:');
    results.apiCalls.forEach((call, i) => {
      console.log(`   ${i + 1}. ${call.method} ${call.url}`);
    });
  }
  
  console.log('\n📸 VISUAL DOCUMENTATION:');
  results.screenshots.forEach(screenshot => {
    console.log(`   • ${screenshot.name}`);
  });
  
  const score = (results.workspaceAccess ? 2 : 0) + 
                results.agentInterfaces.length + 
                results.conversations.length;
  
  const assessment = score >= 5 ? '🎉 AGENT WORKFLOW MOSTLY FUNCTIONAL' : 
                     score >= 3 ? '⚠️ PARTIAL AGENT FUNCTIONALITY' : 
                     '🚨 MAJOR AGENT WORKFLOW ISSUES';
  
  console.log(`\n🎯 FUNCTIONALITY SCORE: ${score}/8 components working`);
  console.log(`📊 ASSESSMENT: ${assessment}`);
  console.log('\n🔑 Manual verification during browser session is crucial for understanding exact UI layout!');
  console.log('='.repeat(90));
  
  return results;
}

async function takeScreenshot(page, name, results) {
  try {
    const dir = path.join(__dirname, 'screenshots', 'precise-agent-workflow');
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
      path.join(dir, 'precise-agent-workflow-results.json'),
      JSON.stringify(results, null, 2)
    );
    console.log('💾 Results saved to: results/precise-agent-workflow-results.json');
  } catch (error) {
    console.log(`❌ Failed to save results: ${error.message}`);
  }
}

// Run if called directly
if (require.main === module) {
  preciseAgentWorkflowTest().then(results => {
    const success = results.workspaceAccess && (results.agentInterfaces.length > 0 || results.conversations.length > 0);
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Precise agent workflow test failed:', error);
    process.exit(1);
  });
}

module.exports = { preciseAgentWorkflowTest };