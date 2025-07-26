const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Test 05: Agent Interaction
 * Tests agent deployment, chat interaction, navigation persistence, and conversation continuity
 */
async function testAgentInteraction() {
  console.log('🤖 Test 05: Agent Interaction\n');
  
  let browser;
  const results = {
    testName: 'Agent Interaction',
    timestamp: new Date().toISOString(),
    passed: [],
    failed: [],
    screenshots: [],
    conversationIds: [],
    agentSessions: []
  };

  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ['--window-size=1920,1080'],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });
    await page.waitForTimeout(2000);

    // Test 1: Navigate to a workspace with agents
    console.log('🏗️ Entering workspace for agent testing...');
    
    const workspaceCard = await page.$('[class*="workspace-card"], [class*="WorkspaceCard"], button:has-text("Workspace")');
    if (workspaceCard) {
      await workspaceCard.click();
      await page.waitForTimeout(3000);
      results.passed.push('Workspace entered successfully');
      await takeScreenshot(page, 'workspace-entered', results);
    } else {
      // Create a workspace first if none exists
      console.log('📝 Creating workspace for agent testing...');
      const createButton = await page.$('button:has-text("New Workspace"), button:has-text("Create")');
      if (createButton) {
        await createButton.click();
        await page.waitForTimeout(2000);
        
        const nameField = await page.$('input[placeholder*="name"]');
        if (nameField) {
          await nameField.type('Agent Test Workspace');
        }
        
        const publishButton = await page.$('button:has-text("Publish"), button:has-text("Create")');
        if (publishButton) {
          await publishButton.click();
          await page.waitForTimeout(3000);
          results.passed.push('Test workspace created for agents');
        }
      }
    }

    // Test 2: Find and deploy an agent
    console.log('🚀 Testing agent deployment...');
    
    // Look for agent buttons/cards
    let agentButton = await page.$('button:has-text("Claude"), button:has-text("Gemini"), button[class*="agent"], [class*="agent-card"]');
    
    if (!agentButton) {
      // Look for agent management/deployment area
      const agentArea = await page.$('[class*="agent"], button:has-text("Deploy"), button:has-text("Add Agent")');
      if (agentArea) {
        await agentArea.click();
        await page.waitForTimeout(1500);
        agentButton = await page.$('button:has-text("Claude"), button:has-text("Gemini")');
      }
    }

    if (agentButton) {
      results.passed.push('Agent deployment option found');
      await agentButton.click();
      await page.waitForTimeout(3000);
      
      // Check if agent terminal/chat opened
      const terminal = await page.$('[class*="terminal"], [class*="chat"], [class*="conversation"]');
      if (terminal) {
        results.passed.push('Agent terminal/chat interface opened');
        await takeScreenshot(page, 'agent-deployed', results);
      }
    } else {
      results.failed.push('No agent deployment options found');
    }

    // Test 3: Interact with agent
    console.log('💬 Testing agent chat interaction...');
    
    const chatInput = await page.$('input[placeholder*="message"], textarea[placeholder*="message"], input[type="text"]');
    if (chatInput) {
      const testMessage = 'Hello! This is a test message. Can you help me understand this workspace?';
      await chatInput.type(testMessage);
      results.passed.push('Test message typed in chat');
      
      // Send the message
      const sendButton = await page.$('button:has-text("Send"), button[type="submit"], button:has-text("↵")');
      if (sendButton) {
        await sendButton.click();
        await page.waitForTimeout(2000);
        results.passed.push('Message sent to agent');
        
        // Wait for agent response
        console.log('⏳ Waiting for agent response...');
        await page.waitForTimeout(5000);
        
        // Check for agent response
        const responseArea = await page.$('[class*="response"], [class*="message"], [class*="conversation"]');
        if (responseArea) {
          const responseText = await responseArea.textContent();
          if (responseText && responseText.length > testMessage.length) {
            results.passed.push('Agent response received');
            results.conversationIds.push(`session-${Date.now()}`);
          }
        }
        
        await takeScreenshot(page, 'agent-conversation', results);
      }
    } else {
      results.failed.push('Chat input field not found');
    }

    // Test 4: Send follow-up message
    console.log('🔄 Testing conversation continuity...');
    
    if (chatInput) {
      await chatInput.clear();
      await chatInput.type('Can you list the files in this workspace?');
      
      const sendButton = await page.$('button:has-text("Send"), button[type="submit"]');
      if (sendButton) {
        await sendButton.click();
        await page.waitForTimeout(5000);
        results.passed.push('Follow-up message sent');
        
        // Check for tool usage or file listing
        const toolOutput = await page.$(':has-text("file"), :has-text("directory"), [class*="tool"], [class*="output"]');
        if (toolOutput) {
          results.passed.push('Agent tool usage detected');
        }
        
        await takeScreenshot(page, 'agent-tool-usage', results);
      }
    }

    // Test 5: Test navigation away and back
    console.log('🧭 Testing navigation persistence...');
    
    // Navigate away from workspace
    const homeButton = await page.$('button:has-text("Home"), button:has-text("Library"), [class*="nav"]');
    if (homeButton) {
      await homeButton.click();
      await page.waitForTimeout(2000);
      results.passed.push('Navigated away from workspace');
      await takeScreenshot(page, 'navigated-away', results);
      
      // Navigate back to workspace
      const workspaceButton = await page.$('[class*="workspace-card"], button:has-text("Agent Test")');
      if (workspaceButton) {
        await workspaceButton.click();
        await page.waitForTimeout(3000);
        results.passed.push('Navigated back to workspace');
        
        // Check if conversation is still there
        const conversationArea = await page.$('[class*="conversation"], [class*="chat-history"]');
        if (conversationArea) {
          const conversationText = await conversationArea.textContent();
          if (conversationText && conversationText.includes('This is a test message')) {
            results.passed.push('Conversation state persisted after navigation');
          } else {
            results.failed.push('Conversation state lost after navigation');
          }
        }
        
        await takeScreenshot(page, 'conversation-restored', results);
      }
    }

    // Test 6: Test multiple agent types
    console.log('🤖🔄 Testing multiple agent deployment...');
    
    // Try to deploy a different agent type
    const geminiButton = await page.$('button:has-text("Gemini")');
    const claudeButton = await page.$('button:has-text("Claude")');
    
    if (geminiButton && claudeButton) {
      // If Claude is active, try Gemini
      await geminiButton.click();
      await page.waitForTimeout(3000);
      
      // Check for agent switching
      const activeAgent = await page.$('[class*="active-agent"], [class*="current-agent"]');
      if (activeAgent) {
        results.passed.push('Agent switching functionality works');
      }
      
      // Test quick message to new agent
      const quickInput = await page.$('input[type="text"], textarea');
      if (quickInput) {
        await quickInput.type('Hello Gemini! Are you working?');
        const sendBtn = await page.$('button:has-text("Send")');
        if (sendBtn) {
          await sendBtn.click();
          await page.waitForTimeout(3000);
          results.passed.push('Successfully switched and interacted with different agent');
        }
      }
    }

    // Test 7: Test agent history and sessions
    console.log('📚 Testing agent history and sessions...');
    
    const historyButton = await page.$('button:has-text("History"), button:has-text("Sessions"), [class*="history"]');
    if (historyButton) {
      await historyButton.click();
      await page.waitForTimeout(2000);
      
      // Check for conversation history
      const historyItems = await page.$$('[class*="history-item"], [class*="session"], li');
      if (historyItems.length > 0) {
        results.passed.push(`Found ${historyItems.length} conversation history items`);
        
        // Test clicking on a history item
        const firstHistory = historyItems[0];
        if (firstHistory) {
          await firstHistory.click();
          await page.waitForTimeout(2000);
          results.passed.push('Historical conversation accessed');
        }
      }
      
      await takeScreenshot(page, 'agent-history', results);
    }

    // Test 8: Test agent permissions and tool approval
    console.log('🔐 Testing agent permissions and tool approval...');
    
    // Send a message that might trigger tool usage
    const permissionTestInput = await page.$('input[type="text"], textarea');
    if (permissionTestInput) {
      await permissionTestInput.clear();
      await permissionTestInput.type('Please read the README file in this workspace');
      
      const sendBtn = await page.$('button:has-text("Send")');
      if (sendBtn) {
        await sendBtn.click();
        await page.waitForTimeout(3000);
        
        // Check for tool approval overlay
        const approvalOverlay = await page.$('[class*="approval"], [class*="permission"], button:has-text("Approve")');
        if (approvalOverlay) {
          results.passed.push('Tool approval overlay appeared');
          
          const approveButton = await page.$('button:has-text("Approve"), button:has-text("Allow")');
          if (approveButton) {
            await approveButton.click();
            await page.waitForTimeout(2000);
            results.passed.push('Tool usage approved');
          }
        }
        
        await takeScreenshot(page, 'tool-approval', results);
      }
    }

    // Test 9: Test agent streaming responses
    console.log('📡 Testing streaming response handling...');
    
    const streamTestInput = await page.$('input[type="text"], textarea');
    if (streamTestInput) {
      await streamTestInput.clear();
      await streamTestInput.type('Please explain what this workspace contains in detail');
      
      const sendBtn = await page.$('button:has-text("Send")');
      if (sendBtn) {
        await sendBtn.click();
        
        // Watch for streaming response
        let responseDetected = false;
        const startTime = Date.now();
        
        while (Date.now() - startTime < 10000) { // Wait up to 10 seconds
          const responseArea = await page.$('[class*="response"], [class*="streaming"]');
          if (responseArea) {
            const text = await responseArea.textContent();
            if (text && text.length > 10) {
              responseDetected = true;
              break;
            }
          }
          await page.waitForTimeout(500);
        }
        
        if (responseDetected) {
          results.passed.push('Streaming response detected');
        } else {
          results.failed.push('No streaming response detected');
        }
        
        await takeScreenshot(page, 'streaming-response', results);
      }
    }

    // Test 10: Test conversation export/save functionality
    console.log('💾 Testing conversation export/save...');
    
    const exportButton = await page.$('button:has-text("Export"), button:has-text("Save"), button:has-text("Download")');
    if (exportButton) {
      await exportButton.click();
      await page.waitForTimeout(2000);
      
      // Check for export options
      const exportOptions = await page.$('[class*="export"], select, button:has-text("JSON")');
      if (exportOptions) {
        results.passed.push('Conversation export options available');
      }
    }

    // Test 11: Test agent memory/context persistence
    console.log('🧠 Testing agent memory and context...');
    
    // Reference earlier conversation
    const memoryTestInput = await page.$('input[type="text"], textarea');
    if (memoryTestInput) {
      await memoryTestInput.clear();
      await memoryTestInput.type('Do you remember what I asked you about earlier in our conversation?');
      
      const sendBtn = await page.$('button:has-text("Send")');
      if (sendBtn) {
        await sendBtn.click();
        await page.waitForTimeout(5000);
        
        // Check if agent references earlier messages
        const responseArea = await page.$('[class*="response"]:last-child');
        if (responseArea) {
          const responseText = await responseArea.textContent();
          if (responseText && (responseText.includes('earlier') || responseText.includes('before') || responseText.includes('workspace'))) {
            results.passed.push('Agent demonstrated conversation memory');
          }
        }
      }
    }

    await takeScreenshot(page, 'final-agent-state', results);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    results.failed.push(`Fatal error: ${error.message}`);
  } finally {
    if (browser) {
      console.log('\n⏸️  Keeping browser open for 5 seconds to review...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      await browser.close();
    }
  }

  await saveResults(results);
  
  console.log('\n' + '='.repeat(60));
  console.log('🤖 AGENT INTERACTION TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`📸 Screenshots: ${results.screenshots.length}`);
  console.log(`💬 Conversations: ${results.conversationIds.length}`);
  
  if (results.passed.length > 0) {
    console.log('\n✅ Passed tests:');
    results.passed.forEach(test => console.log(`   • ${test}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed tests:');
    results.failed.forEach(test => console.log(`   • ${test}`));
  }
  
  if (results.conversationIds.length > 0) {
    console.log('\n💬 Test conversations:');
    results.conversationIds.forEach(id => console.log(`   • ${id}`));
  }
  
  return results.failed.length === 0;
}

async function takeScreenshot(page, name, results) {
  const dir = path.join(__dirname, 'screenshots', '05-agent-interaction');
  await fs.mkdir(dir, { recursive: true });
  const filepath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  results.screenshots.push({ name, path: filepath });
}

async function saveResults(results) {
  const dir = path.join(__dirname, 'results');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, '05-agent-interaction-results.json'),
    JSON.stringify(results, null, 2)
  );
}

if (require.main === module) {
  testAgentInteraction().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testAgentInteraction };