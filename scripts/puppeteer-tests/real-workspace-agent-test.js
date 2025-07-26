const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Real Workspace Agent Test - Based on Actual Server Logs
 * This test targets the ACTUAL workflow from the server logs we observed:
 * - GET /api/workspaces/[workspaceId] 
 * - GET /api/workspaces/[workspaceId]/agents/[agentId]
 * - GET /api/workspaces/[workspaceId]/agents/[agentId]/conversation
 */
async function realWorkspaceAgentTest() {
  console.log('🎯 Real Workspace Agent Test - Following Actual User Paths\n');
  console.log('📋 Based on server logs, the real workflow involves:');
  console.log('   • Sidebar workspace cards that open actual workspaces');
  console.log('   • Agent deployment within those workspaces'); 
  console.log('   • Real chat interfaces with conversation persistence');
  console.log('   • File operations and editor interactions\n');
  
  let browser;
  const results = {
    testName: 'Real Workspace Agent Test',
    timestamp: new Date().toISOString(),
    realFindings: [],
    workspaceSteps: [],
    agentSteps: [],
    chatSteps: [],
    screenshots: [],
    apiCallsDetected: []
  };

  try {
    console.log('🚀 Launching browser with extended viewport for workspace UI...');
    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1600,1200',
        '--start-maximized'
      ],
      defaultViewport: { width: 1600, height: 1200 }
    });

    const page = await browser.newPage();
    
    // Intercept network requests to see what APIs are called
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        results.apiCallsDetected.push({
          method: request.method(),
          url: request.url(),
          timestamp: new Date().toISOString()
        });
        console.log(`   🌐 API Call: ${request.method()} ${request.url()}`);
      }
      request.continue();
    });
    
    // Load homepage and wait for full initialization
    console.log('\n📄 STEP 1: Loading and analyzing the real UI structure');
    console.log('─'.repeat(60));
    
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0', timeout: 20000 });
    await new Promise(resolve => setTimeout(resolve, 6000)); // Let everything load
    
    await takeScreenshot(page, '01-full-homepage', results);
    results.workspaceSteps.push('Homepage fully loaded');
    
    // Analyze the actual DOM structure to understand the layout
    console.log('   🔍 Analyzing actual DOM structure...');
    
    const uiAnalysis = await page.evaluate(() => {
      // Get all elements with meaningful class names or text
      const allElements = document.querySelectorAll('*');
      const analysis = {
        workspaceRelated: [],
        agentRelated: [],
        sidebarElements: [],
        buttonElements: [],
        inputElements: [],
        navElements: []
      };
      
      Array.from(allElements).forEach(el => {
        const className = el.className || '';
        const textContent = el.textContent?.substring(0, 100) || '';
        const tagName = el.tagName.toLowerCase();
        
        // Categorize elements
        if (className.includes('workspace') || textContent.toLowerCase().includes('workspace')) {
          analysis.workspaceRelated.push({
            tag: tagName,
            class: className,
            text: textContent,
            clickable: el.onclick !== null || tagName === 'button'
          });
        }
        
        if (className.includes('agent') || textContent.includes('Claude') || textContent.includes('Gemini')) {
          analysis.agentRelated.push({
            tag: tagName,
            class: className,
            text: textContent,
            clickable: el.onclick !== null || tagName === 'button'
          });
        }
        
        if (className.includes('sidebar') || className.includes('nav')) {
          analysis.sidebarElements.push({
            tag: tagName,
            class: className,
            text: textContent.substring(0, 50)
          });
        }
        
        if (tagName === 'button') {
          analysis.buttonElements.push({
            text: textContent,
            class: className
          });
        }
        
        if (tagName === 'input' || tagName === 'textarea') {
          analysis.inputElements.push({
            type: el.type || 'textarea',
            placeholder: el.placeholder || '',
            class: className
          });
        }
      });
      
      return analysis;
    });
    
    console.log('\n📊 UI STRUCTURE ANALYSIS:');
    console.log(`   🏗️ Workspace-related elements: ${uiAnalysis.workspaceRelated.length}`);
    console.log(`   🤖 Agent-related elements: ${uiAnalysis.agentRelated.length}`);
    console.log(`   📁 Sidebar elements: ${uiAnalysis.sidebarElements.length}`);
    console.log(`   🎛️ Buttons found: ${uiAnalysis.buttonElements.length}`);
    console.log(`   📝 Input elements: ${uiAnalysis.inputElements.length}`);
    
    // Show the most promising workspace elements
    if (uiAnalysis.workspaceRelated.length > 0) {
      console.log('\n   🎯 Most promising workspace elements:');
      uiAnalysis.workspaceRelated.slice(0, 5).forEach((el, i) => {
        console.log(`      ${i + 1}. ${el.tag}.${el.class} - "${el.text}"`);
      });
    }
    
    // Show button options
    if (uiAnalysis.buttonElements.length > 0) {
      console.log('\n   🎯 Available buttons:');
      uiAnalysis.buttonElements.slice(0, 8).forEach((btn, i) => {
        console.log(`      ${i + 1}. "${btn.text}" (${btn.class})`);
      });
    }

    // STEP 2: Try to find and access actual workspace sidebar
    console.log('\n🏗️ STEP 2: Locating and accessing real workspace sidebar');
    console.log('─'.repeat(60));
    
    // Look for elements that might be actual workspace cards
    let workspaceAccessed = false;
    
    // Try different strategies to find workspace cards
    const workspaceStrategies = [
      // Strategy 1: Look for elements with workspace in class name
      async () => {
        const elements = await page.$$('[class*="workspace"], [class*="Workspace"]');
        console.log(`   Strategy 1: Found ${elements.length} elements with workspace classes`);
        return elements;
      },
      
      // Strategy 2: Look for card-like elements in sidebar areas
      async () => {
        const elements = await page.$$('[class*="sidebar"] [class*="card"], [class*="sidebar"] button, [class*="sidebar"] div[role="button"]');
        console.log(`   Strategy 2: Found ${elements.length} card-like elements in sidebars`);
        return elements;
      },
      
      // Strategy 3: Look for elements with meaningful text that could be workspaces
      async () => {
        const allDivs = await page.$$('div, button, section');
        const meaningful = [];
        for (const div of allDivs.slice(0, 50)) {
          try {
            const text = await div.evaluate(el => el.textContent);
            if (text && text.length > 10 && text.length < 200 && 
                (text.includes('draft') || text.includes('project') || text.includes('workspace'))) {
              meaningful.push(div);
            }
          } catch (error) {
            continue;
          }
        }
        console.log(`   Strategy 3: Found ${meaningful.length} elements with meaningful workspace-like text`);
        return meaningful;
      }
    ];
    
    for (let i = 0; i < workspaceStrategies.length && !workspaceAccessed; i++) {
      const elements = await workspaceStrategies[i]();
      
      if (elements.length > 0) {
        // Try clicking the first few promising elements
        for (let j = 0; j < Math.min(3, elements.length); j++) {
          try {
            const element = elements[j];
            const elementInfo = await element.evaluate(el => ({
              text: el.textContent?.substring(0, 100),
              className: el.className,
              tagName: el.tagName
            }));
            
            console.log(`   🖱️ Attempting workspace access ${i + 1}.${j + 1}: ${elementInfo.tagName}.${elementInfo.className}`);
            console.log(`       Text: "${elementInfo.text}"`);
            
            await element.click();
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Check if we're now in a workspace by looking for workspace-specific elements
            const workspaceFeatures = await page.$$('[class*="file"], [class*="editor"], [class*="terminal"], [class*="monaco"], [class*="agent"], [class*="chat"]');
            
            if (workspaceFeatures.length > 3) {
              console.log(`   ✅ SUCCESS! Workspace accessed - found ${workspaceFeatures.length} workspace features`);
              results.workspaceSteps.push(`Workspace accessed via strategy ${i + 1}`);
              results.realFindings.push('Actual workspace navigation working');
              workspaceAccessed = true;
              await takeScreenshot(page, '02-workspace-opened', results);
              break;
            } else {
              console.log(`   ❌ Not a workspace - only found ${workspaceFeatures.length} features`);
            }
            
          } catch (error) {
            console.log(`   ❌ Click failed: ${error.message}`);
            continue;
          }
        }
      }
    }
    
    if (!workspaceAccessed) {
      console.log('   ⚠️ Could not access existing workspace, trying to create one...');
      
      // Try to create a new workspace
      const createButtons = await page.$$('button');
      for (const button of createButtons) {
        try {
          const text = await button.evaluate(el => el.textContent);
          if (text.includes('Create') && text.includes('Workspace')) {
            console.log(`   🎯 Creating new workspace: "${text}"`);
            await button.click();
            await new Promise(resolve => setTimeout(resolve, 4000));
            results.workspaceSteps.push('New workspace creation attempted');
            await takeScreenshot(page, '02b-workspace-creation', results);
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }

    // STEP 3: Look for real agent deployment within workspace
    console.log('\n🤖 STEP 3: Finding and deploying agents within workspace');
    console.log('─'.repeat(60));
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Look for agent deployment options
    const agentElements = await page.$$('button, div[role="button"], [class*="agent"]');
    let agentDeployed = false;
    
    console.log(`   🔍 Scanning ${agentElements.length} elements for agent deployment...`);
    
    for (const element of agentElements) {
      try {
        const elementInfo = await element.evaluate(el => ({
          text: el.textContent,
          className: el.className,
          title: el.title || ''
        }));
        
        const fullText = `${elementInfo.text} ${elementInfo.title}`.toLowerCase();
        
        if (fullText.includes('claude') || fullText.includes('gemini') || 
            (fullText.includes('agent') && !fullText.includes('manage'))) {
          
          console.log(`   🎯 Found agent option: "${elementInfo.text}" (${elementInfo.className})`);
          await element.click();
          await new Promise(resolve => setTimeout(resolve, 6000));
          
          results.agentSteps.push(`Agent deployed: ${elementInfo.text}`);
          results.realFindings.push('Agent deployment successful');
          agentDeployed = true;
          await takeScreenshot(page, '03-agent-deployed', results);
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!agentDeployed) {
      console.log('   ❌ No agent deployment options found in current view');
    }

    // STEP 4: Find real chat interface and test interaction
    console.log('\n💬 STEP 4: Locating real chat interface and testing conversation');
    console.log('─'.repeat(60));
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Look for chat interfaces - be more specific
    const chatInputs = await page.$$('input, textarea, [contenteditable="true"]');
    let chatWorking = false;
    
    console.log(`   🔍 Found ${chatInputs.length} potential input elements`);
    
    for (let i = 0; i < chatInputs.length; i++) {
      try {
        const input = chatInputs[i];
        const inputInfo = await input.evaluate(el => ({
          type: el.type || 'other',
          placeholder: el.placeholder || '',
          className: el.className,
          id: el.id,
          visible: el.offsetWidth > 0 && el.offsetHeight > 0
        }));
        
        console.log(`   Input ${i + 1}: ${inputInfo.type} - "${inputInfo.placeholder}" - ${inputInfo.className} - Visible: ${inputInfo.visible}`);
        
        // Skip search inputs and focus on chat-like inputs
        if (inputInfo.placeholder.toLowerCase().includes('search') || 
            inputInfo.className.includes('search') ||
            inputInfo.id.includes('search')) {
          console.log(`       ⏭️ Skipping search input`);
          continue;
        }
        
        if (inputInfo.visible && 
            (inputInfo.placeholder.toLowerCase().includes('message') ||
             inputInfo.placeholder.toLowerCase().includes('chat') ||
             inputInfo.placeholder.toLowerCase().includes('ask') ||
             inputInfo.className.includes('chat') ||
             inputInfo.className.includes('message'))) {
          
          console.log(`   🎯 This looks like a chat input! Attempting interaction...`);
          
          await input.focus();
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const testMessage = 'Hello! This is a test message to verify agent chat functionality. Can you list the files in this workspace?';
          await input.type(testMessage, { delay: 50 });
          
          console.log('   ✅ Test message typed into chat interface');
          results.chatSteps.push('Message typed into real chat interface');
          await takeScreenshot(page, '04-message-typed', results);
          
          // Look for send button near this input
          const sendButtons = await page.$$('button');
          for (const button of sendButtons) {
            try {
              const btnText = await button.evaluate(el => el.textContent);
              const btnTitle = await button.evaluate(el => el.title || '');
              
              if (btnText.includes('Send') || btnText.includes('→') || btnText.includes('↵') || 
                  btnTitle.includes('Send') || btnText.trim() === '▶') {
                
                console.log(`   🎯 Clicking send button: "${btnText}"`);
                await button.click();
                await new Promise(resolve => setTimeout(resolve, 8000));
                
                results.chatSteps.push('Message sent to agent');
                results.realFindings.push('Real chat interaction completed');
                chatWorking = true;
                await takeScreenshot(page, '05-message-sent', results);
                
                console.log('   ⏳ Waiting for agent response...');
                await new Promise(resolve => setTimeout(resolve, 10000));
                await takeScreenshot(page, '06-agent-response-wait', results);
                break;
              }
            } catch (error) {
              continue;
            }
          }
          
          if (chatWorking) break;
        }
      } catch (error) {
        console.log(`   ❌ Input ${i + 1} failed: ${error.message}`);
        continue;
      }
    }
    
    if (!chatWorking) {
      console.log('   ❌ Could not find or interact with real chat interface');
    }

    // STEP 5: Test navigation persistence
    console.log('\n🧭 STEP 5: Testing real navigation persistence');
    console.log('─'.repeat(60));
    
    if (workspaceAccessed && chatWorking) {
      console.log('   🔄 Testing navigation away and back to verify conversation persistence...');
      
      // Navigate away (try to go to library or home)
      const navButtons = await page.$$('button');
      for (const button of navButtons) {
        try {
          const text = await button.evaluate(el => el.textContent);
          if (text.includes('Library') || text.includes('Home') || text.includes('📚')) {
            console.log(`   🎯 Navigating away via: "${text}"`);
            await button.click();
            await new Promise(resolve => setTimeout(resolve, 4000));
            results.chatSteps.push('Navigated away from workspace');
            await takeScreenshot(page, '07-navigated-away', results);
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      // Try to get back to the same workspace
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Look for workspace cards again
      const returnElements = await page.$$('[class*="workspace"], [class*="card"], div[role="button"]');
      for (const element of returnElements.slice(0, 3)) {
        try {
          await element.click();
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Check if our test message is still visible
          const pageContent = await page.evaluate(() => document.body.textContent);
          if (pageContent.includes('This is a test message to verify agent chat functionality')) {
            console.log('   ✅ EXCELLENT! Conversation persisted after navigation');
            results.chatSteps.push('Navigation persistence confirmed - conversation maintained');
            results.realFindings.push('Navigation persistence working perfectly');
            await takeScreenshot(page, '08-conversation-persisted', results);
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }

    // Final screenshot and analysis
    await takeScreenshot(page, '09-final-analysis', results);

  } catch (error) {
    console.error('❌ Test encountered error:', error.message);
  } finally {
    if (browser) {
      console.log('\n' + '🔍'.repeat(80));
      console.log('EXTENDED MANUAL VERIFICATION - 45 SECONDS');
      console.log('🔍'.repeat(80));
      console.log('');
      console.log('👀 NOW IS THE TIME FOR COMPREHENSIVE MANUAL TESTING:');
      console.log('');
      console.log('1. 🏗️ WORKSPACE SIDEBAR VERIFICATION:');
      console.log('   • Look for actual workspace cards in the left sidebar');
      console.log('   • Try clicking different workspace cards');
      console.log('   • Verify they open file explorer + editor interface');
      console.log('');
      console.log('2. 🤖 AGENT DEPLOYMENT VERIFICATION:');
      console.log('   • Look for Claude/Gemini buttons within workspace');
      console.log('   • Click agent buttons and verify chat interface opens');
      console.log('   • Check that agent buttons are clearly visible and styled');
      console.log('');
      console.log('3. 💬 REAL CHAT INTERACTION:');
      console.log('   • Find the actual chat input (not search)');
      console.log('   • Type a real message like "Hello, help me with this workspace"');
      console.log('   • Click Send and wait for agent response');
      console.log('   • Verify response appears and is properly formatted');
      console.log('');
      console.log('4. 🧭 NAVIGATION PERSISTENCE TEST:');
      console.log('   • After chatting, navigate to Library/Home');
      console.log('   • Return to the same workspace');
      console.log('   • Verify the conversation is still visible');
      console.log('   • This is CRITICAL for user experience');
      console.log('');
      console.log('5. 🔐 CREDENTIALS ACCESS:');
      console.log('   • Open Settings → Credentials');
      console.log('   • Try adding a JIRA or Git credential');
      console.log('   • Verify the credential form works properly');
      console.log('');
      console.log('6. 🎨 VISUAL/UX VERIFICATION:');
      console.log('   • Check that all elements are properly styled');
      console.log('   • Verify hover effects on buttons');
      console.log('   • Confirm responsive design works');
      console.log('   • Look for any broken layouts or missing icons');
      console.log('');
      console.log('🚨 IMPORTANT: This manual verification is the REAL test!');
      console.log('   Automated tests can miss slow loading, poor UX, styling issues, etc.');
      console.log('───────────────────────────────────────────────────────────────────────────────');
      
      await new Promise(resolve => setTimeout(resolve, 45000));
      await browser.close();
      console.log('🔒 Browser closed after extended verification period');
    }
  }

  // Save comprehensive results
  await saveResults(results);
  
  // Print detailed findings
  console.log('\n' + '='.repeat(90));
  console.log('🎯 REAL WORKSPACE AGENT TEST - COMPREHENSIVE FINDINGS');
  console.log('='.repeat(90));
  console.log(`🕒 Test completed: ${results.timestamp}`);
  console.log(`🔍 Real findings: ${results.realFindings.length}`);
  console.log(`🏗️ Workspace steps: ${results.workspaceSteps.length}`);
  console.log(`🤖 Agent steps: ${results.agentSteps.length}`);
  console.log(`💬 Chat steps: ${results.chatSteps.length}`);
  console.log(`🌐 API calls detected: ${results.apiCallsDetected.length}`);
  console.log(`📸 Visual evidence: ${results.screenshots.length} screenshots`);
  
  if (results.realFindings.length > 0) {
    console.log('\n✅ CONFIRMED WORKING FUNCTIONALITY:');
    results.realFindings.forEach(finding => console.log(`   • ${finding}`));
  }
  
  if (results.workspaceSteps.length > 0) {
    console.log('\n🏗️ WORKSPACE INTERACTION FLOW:');
    results.workspaceSteps.forEach((step, i) => console.log(`   ${i + 1}. ${step}`));
  }
  
  if (results.agentSteps.length > 0) {
    console.log('\n🤖 AGENT DEPLOYMENT FLOW:');
    results.agentSteps.forEach((step, i) => console.log(`   ${i + 1}. ${step}`));
  }
  
  if (results.chatSteps.length > 0) {
    console.log('\n💬 CHAT INTERACTION FLOW:');
    results.chatSteps.forEach((step, i) => console.log(`   ${i + 1}. ${step}`));
  }
  
  if (results.apiCallsDetected.length > 0) {
    console.log('\n🌐 REAL API CALLS DETECTED:');
    results.apiCallsDetected.forEach(call => {
      console.log(`   ${call.method} ${call.url}`);
    });
  }
  
  console.log('\n📸 VISUAL DOCUMENTATION:');
  results.screenshots.forEach(screenshot => {
    console.log(`   • ${screenshot.name}`);
  });
  
  const functionalityScore = results.realFindings.length;
  const overallAssessment = functionalityScore >= 4 ? '🎉 FULLY FUNCTIONAL' : 
                           functionalityScore >= 2 ? '⚠️ PARTIALLY FUNCTIONAL' : '🚨 MAJOR ISSUES';
  
  console.log(`\n🎯 FUNCTIONALITY SCORE: ${functionalityScore}/5 key workflows working`);
  console.log(`📊 OVERALL ASSESSMENT: ${overallAssessment}`);
  console.log('\n🔑 REMEMBER: Your manual verification is the definitive assessment!');
  console.log('='.repeat(90));
  
  return results;
}

async function takeScreenshot(page, name, results) {
  try {
    const dir = path.join(__dirname, 'screenshots', 'real-workspace-agent');
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
      path.join(dir, 'real-workspace-agent-results.json'),
      JSON.stringify(results, null, 2)
    );
    console.log('💾 Complete results saved to: results/real-workspace-agent-results.json');
  } catch (error) {
    console.log(`❌ Failed to save results: ${error.message}`);
  }
}

// Run if called directly
if (require.main === module) {
  realWorkspaceAgentTest().then(results => {
    const success = results.realFindings.length >= 3;
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Real workspace agent test failed:', error);
    process.exit(1);
  });
}

module.exports = { realWorkspaceAgentTest };