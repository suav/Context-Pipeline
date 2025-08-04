#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgentImproved = require('./agent/deploy-agent-improved');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function testResponseHistoryLoss() {
  console.log('💔 SPECIFIC TEST: Response History Loss After Navigation');
  console.log('======================================================');
  console.log('Testing the specific issue: user prompts persist but agent responses disappear.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  const historyTracker = {
    timestamp: new Date().toISOString(),
    conversations: [],
    historyStates: []
  };
  
  try {
    console.log('💔 PHASE 1: Establish Conversation with Multiple Exchanges');
    await navigateToApp(page);
    await selectWorkspace(page, { index: 0 });
    await deployAgentImproved(page, { agentType: 'dev-assistant' });
    
    // Create a conversation with multiple back-and-forth exchanges
    const conversationExchanges = [
      {
        user: 'HISTORY TEST 1: Hello! What files are in this workspace?',
        expectedResponse: 'files', // Look for this in response
        waitTime: 8000
      },
      {
        user: 'HISTORY TEST 2: Can you explain what this project does?',
        expectedResponse: 'project', // Look for this in response  
        waitTime: 6000
      },
      {
        user: 'HISTORY TEST 3: What technologies are being used here?',
        expectedResponse: 'React', // Look for this in response
        waitTime: 6000
      }
    ];
    
    // Execute conversation exchanges
    for (let i = 0; i < conversationExchanges.length; i++) {
      const exchange = conversationExchanges[i];
      console.log(`💬 Exchange ${i + 1}: "${exchange.user.substring(0, 50)}..."`);
      
      await submitTextToAgent(page, { text: exchange.user, timeout: 5000 });
      
      // Wait for potential response
      await new Promise(resolve => setTimeout(resolve, exchange.waitTime));
      
      // Capture conversation state after this exchange
      const conversationState = await page.evaluate((exchangeNum) => {
        const allText = document.body.textContent;
        const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
        
        // Extract visible conversation elements
        const conversationElements = document.querySelectorAll('div, p, span');
        const visibleText = Array.from(conversationElements)
          .map(el => el.textContent?.trim())
          .filter(text => text && text.length > 20)
          .join(' | ');
        
        return {
          exchangeNumber: exchangeNum,
          sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
          totalTextLength: allText.length,
          containsThisUserPrompt: allText.includes(`HISTORY TEST ${exchangeNum}`),
          visibleConversation: visibleText.substring(0, 1000),
          timestamp: Date.now()
        };
      }, i + 1);
      
      historyTracker.conversations.push(conversationState);
      await takeScreenshot(page, { name: `history-loss-01-exchange-${i + 1}` });
      
      console.log(`📊 Exchange ${i + 1} captured: Session=${conversationState.sessionId}, TextLen=${conversationState.totalTextLength}`);
    }
    
    const originalSession = historyTracker.conversations[0].sessionId;
    console.log(`📊 Original conversation session: ${originalSession}`);
    await takeScreenshot(page, { name: 'history-loss-02-full-conversation' });
    
    // PHASE 2: Navigate to different workspace (trigger the issue)
    console.log('\n💔 PHASE 2: Navigate to Different Workspace (Trigger Issue)');
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await selectWorkspace(page, { index: 1 }); // Different workspace
    await deployAgentImproved(page, { agentType: 'dev-assistant' });
    await submitTextToAgent(page, { text: 'DIFFERENT WORKSPACE: I am in a different workspace now.' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    await takeScreenshot(page, { name: 'history-loss-03-different-workspace' });
    
    console.log('💔 PHASE 3: Return to Original Workspace - Check History');
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await selectWorkspace(page, { index: 0 }); // Back to original
    
    // Capture state immediately after returning
    const returnState = await page.evaluate(() => {
      const allText = document.body.textContent;
      const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
      
      // Check for presence of our test conversation
      const historyCheck = {
        hasHistoryTest1: allText.includes('HISTORY TEST 1'),
        hasHistoryTest2: allText.includes('HISTORY TEST 2'), 
        hasHistoryTest3: allText.includes('HISTORY TEST 3'),
        hasUserPrompts: allText.includes('What files are in') || allText.includes('explain what this project'),
        hasAgentResponses: allText.includes('files in this workspace') || allText.includes('This project') || allText.includes('technologies used'),
        sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
        totalTextLength: allText.length
      };
      
      // Get visible conversation area
      const conversationArea = document.querySelector('[class*="conversation"], [class*="chat"], [class*="terminal"]');
      const conversationText = conversationArea ? conversationArea.textContent : 'no conversation area found';
      
      return {
        ...historyCheck,
        conversationAreaText: conversationText.substring(0, 500),
        timestamp: Date.now()
      };
    });
    
    historyTracker.historyStates.push({ phase: 'return', ...returnState });
    await takeScreenshot(page, { name: 'history-loss-04-returned-to-original' });
    
    console.log('\n📊 HISTORY LOSS ANALYSIS');
    console.log('========================');
    console.log(`Session restored: ${originalSession === returnState.sessionId}`);
    console.log(`User prompts visible: ${returnState.hasUserPrompts}`);
    console.log(`Agent responses visible: ${returnState.hasAgentResponses}`);
    console.log(`History Test 1 present: ${returnState.hasHistoryTest1}`);
    console.log(`History Test 2 present: ${returnState.hasHistoryTest2}`);
    console.log(`History Test 3 present: ${returnState.hasHistoryTest3}`);
    
    // PHASE 4: Test page reload scenario  
    console.log('\n💔 PHASE 4: Test Page Reload Scenario');
    const preReloadState = await page.evaluate(() => {
      const allText = document.body.textContent;
      return {
        hasUserPrompts: allText.includes('HISTORY TEST'),
        hasAgentResponses: allText.includes('files in this workspace') || allText.includes('This project'),
        textLength: allText.length
      };
    });
    
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    await selectWorkspace(page, { index: 0 });
    
    const postReloadState = await page.evaluate(() => {
      const allText = document.body.textContent;
      const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
      
      return {
        sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
        hasUserPrompts: allText.includes('HISTORY TEST'),
        hasAgentResponses: allText.includes('files in this workspace') || allText.includes('This project'),
        textLength: allText.length,
        timestamp: Date.now()
      };
    });
    
    historyTracker.historyStates.push({ phase: 'post-reload', ...postReloadState });
    await takeScreenshot(page, { name: 'history-loss-05-after-page-reload' });
    
    console.log('\n📊 PAGE RELOAD ANALYSIS');
    console.log('=======================');
    console.log(`Session after reload: ${postReloadState.sessionId}`);
    console.log(`User prompts after reload: ${postReloadState.hasUserPrompts}`);
    console.log(`Agent responses after reload: ${postReloadState.hasAgentResponses}`);
    
    // SUMMARY
    const problemAnalysis = {
      workspaceNavigationIssue: {
        sessionRestored: originalSession === returnState.sessionId,
        userPromptsRestored: returnState.hasUserPrompts,
        agentResponsesRestored: returnState.hasAgentResponses,
        problemExists: returnState.hasUserPrompts && !returnState.hasAgentResponses
      },
      pageReloadIssue: {
        userPromptsRestored: postReloadState.hasUserPrompts,
        agentResponsesRestored: postReloadState.hasAgentResponses,
        problemExists: postReloadState.hasUserPrompts && !postReloadState.hasAgentResponses
      }
    };
    
    historyTracker.analysis = problemAnalysis;
    
    console.log('\n🎯 ROOT CAUSE ANALYSIS');
    console.log('======================');
    
    if (problemAnalysis.workspaceNavigationIssue.problemExists) {
      console.log('🚨 CONFIRMED: Workspace navigation loses agent responses while keeping user prompts');
    }
    
    if (problemAnalysis.pageReloadIssue.problemExists) {
      console.log('🚨 CONFIRMED: Page reload loses agent responses while keeping user prompts');  
    }
    
    if (!problemAnalysis.workspaceNavigationIssue.problemExists && !problemAnalysis.pageReloadIssue.problemExists) {
      console.log('✅ Issue not reproduced - response history appears to be working');
    }
    
    // Save detailed analysis
    const fs = require('fs');
    fs.writeFileSync('./response-history-loss-results.json', JSON.stringify(historyTracker, null, 2));
    console.log('\n💾 History loss analysis saved to: response-history-loss-results.json');
    
    console.log('\n⏰ Extended inspection (60 seconds) - manually verify conversation history...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    
  } catch (error) {
    console.error('❌ Response history loss test failed:', error);
    historyTracker.error = error.message;
    await takeScreenshot(page, { name: 'history-loss-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  testResponseHistoryLoss().catch(console.error);
}