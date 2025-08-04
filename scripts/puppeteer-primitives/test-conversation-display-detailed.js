#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgentImproved = require('./agent/deploy-agent-improved');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function testConversationDisplayDetailed() {
  console.log('🔍 DETAILED TEST: Conversation Display & History Behavior');
  console.log('========================================================');
  console.log('Investigating exactly what conversation elements are visible and when they disappear.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('🔍 PHASE 1: Establish Clean Conversation');
    await navigateToApp(page);
    await selectWorkspace(page, { index: 0 });
    await deployAgentImproved(page, { agentType: 'dev-assistant' });
    await takeScreenshot(page, { name: 'conversation-detail-01-clean-start' });
    
    // Submit one clear, trackable message
    const testMessage = 'TRACKABLE MESSAGE: Please respond with exactly "I HAVE RESPONDED TO YOUR TRACKABLE MESSAGE" so I can verify you replied.';
    console.log('🔍 Submitting trackable message...');
    await submitTextToAgent(page, { text: testMessage, timeout: 5000 });
    
    // Wait longer to ensure response has time to appear
    console.log('🔍 Waiting 15 seconds for response...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Detailed analysis of conversation elements
    const conversationAnalysis = await page.evaluate(() => {
      const allText = document.body.textContent;
      
      // Find all potential conversation containers
      const potentialContainers = [
        ...document.querySelectorAll('[class*="conversation"]'),
        ...document.querySelectorAll('[class*="chat"]'),
        ...document.querySelectorAll('[class*="terminal"]'),
        ...document.querySelectorAll('[class*="message"]'),
        ...document.querySelectorAll('[class*="history"]'),
        ...document.querySelectorAll('[role="log"]'),
        ...document.querySelectorAll('div[id*="chat"]'),
        ...document.querySelectorAll('div[id*="conversation"]')
      ];
      
      const containerInfo = potentialContainers.map((container, index) => ({
        index,
        tagName: container.tagName,
        className: container.className,
        id: container.id,
        textLength: container.textContent?.length || 0,
        textPreview: container.textContent?.substring(0, 200) || '',
        visible: container.offsetParent !== null
      }));
      
      // Look for specific conversation elements
      const conversationElements = {
        containsTrackableMessage: allText.includes('TRACKABLE MESSAGE'),
        containsExpectedResponse: allText.includes('I HAVE RESPONDED TO YOUR TRACKABLE MESSAGE'),
        containsPreviousPrompts: allText.includes('What did you do so far'),
        containsProcessingIndicator: allText.includes('Processing') || allText.includes('⏱️'),
        hasSessionId: !!allText.match(/Session:\s*([a-zA-Z0-9-]+)/),
        sessionId: allText.match(/Session:\s*([a-zA-Z0-9-]+)/)?.[1] || 'not-found',
        totalTextLength: allText.length
      };
      
      // Get all visible text areas that might contain conversation
      const textAreas = document.querySelectorAll('div, p, span, pre');
      const conversationTexts = Array.from(textAreas)
        .filter(el => el.textContent && el.textContent.length > 50)
        .map(el => ({
          tagName: el.tagName,
          className: el.className.substring(0, 50),
          textLength: el.textContent.length,
          containsTrackable: el.textContent.includes('TRACKABLE MESSAGE'),
          containsResponse: el.textContent.includes('I HAVE RESPONDED'),
          textPreview: el.textContent.substring(0, 150)
        }));
      
      return {
        containerInfo,
        conversationElements,
        conversationTexts: conversationTexts.slice(0, 10), // Limit to prevent overflow
        timestamp: Date.now()
      };
    });
    
    console.log('\n📊 CONVERSATION ANALYSIS AFTER RESPONSE WAIT:');
    console.log(`Trackable message visible: ${conversationAnalysis.conversationElements.containsTrackableMessage}`);
    console.log(`Expected response visible: ${conversationAnalysis.conversationElements.containsExpectedResponse}`);
    console.log(`Session ID: ${conversationAnalysis.conversationElements.sessionId}`);
    console.log(`Potential conversation containers found: ${conversationAnalysis.containerInfo.length}`);
    
    await takeScreenshot(page, { name: 'conversation-detail-02-after-response-wait' });
    
    // PHASE 2: Navigate away and back to test history preservation
    console.log('\n🔍 PHASE 2: Navigate Away and Back - History Test');
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await selectWorkspace(page, { index: 1 }); // Different workspace
    await new Promise(resolve => setTimeout(resolve, 3000));
    await takeScreenshot(page, { name: 'conversation-detail-03-different-workspace' });
    
    // Return to original workspace
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await selectWorkspace(page, { index: 0 }); // Back to original
    
    const postNavigationAnalysis = await page.evaluate(() => {
      const allText = document.body.textContent;
      
      const historyCheck = {
        containsTrackableMessage: allText.includes('TRACKABLE MESSAGE'),
        containsExpectedResponse: allText.includes('I HAVE RESPONDED TO YOUR TRACKABLE MESSAGE'),
        sessionId: allText.match(/Session:\s*([a-zA-Z0-9-]+)/)?.[1] || 'not-found',
        totalTextLength: allText.length,
        
        // More specific checks
        hasUserPromptText: allText.includes('Please respond with exactly'),
        hasAgentResponseText: allText.includes('I HAVE RESPONDED'),
        hasProcessingHistory: allText.includes('Processing') || allText.includes('Completed'),
        
        // DOM element checks  
        hasInputField: !!document.querySelector('input[placeholder*="command"]'),
        hasTerminalLikeElements: document.querySelectorAll('[class*="terminal"], [class*="chat"]').length,
        
        timestamp: Date.now()
      };
      
      // Get conversation display area content
      const displayElements = document.querySelectorAll('div, p, span');
      const relevantDisplays = Array.from(displayElements)
        .filter(el => el.textContent && (
          el.textContent.includes('TRACKABLE') || 
          el.textContent.includes('I HAVE RESPONDED') ||
          el.textContent.includes('Session:')
        ))
        .map(el => ({
          tag: el.tagName,
          text: el.textContent.substring(0, 100),
          visible: el.offsetParent !== null
        }));
      
      return {
        ...historyCheck,
        relevantDisplays
      };
    });
    
    console.log('\n📊 POST-NAVIGATION ANALYSIS:');
    console.log(`Session maintained: ${conversationAnalysis.conversationElements.sessionId === postNavigationAnalysis.sessionId}`);
    console.log(`Trackable message still visible: ${postNavigationAnalysis.containsTrackableMessage}`);
    console.log(`Expected response still visible: ${postNavigationAnalysis.containsExpectedResponse}`);
    console.log(`User prompt text visible: ${postNavigationAnalysis.hasUserPromptText}`);
    console.log(`Agent response text visible: ${postNavigationAnalysis.hasAgentResponseText}`);
    
    await takeScreenshot(page, { name: 'conversation-detail-04-post-navigation' });
    
    // PHASE 3: Test conversation display limits
    console.log('\n🔍 PHASE 3: Test Display Limits with Multiple Messages');  
    
    // Ensure agent is available
    const needsAgent = await page.evaluate(() => !document.querySelector('input[placeholder*="command"]'));
    if (needsAgent) {
      await deployAgentImproved(page, { agentType: 'dev-assistant' });
    }
    
    // Add more messages to test display limits
    const additionalMessages = [
      'LIMIT TEST 1: This is message one.',
      'LIMIT TEST 2: This is message two.',
      'LIMIT TEST 3: This is message three.'
    ];
    
    for (let i = 0; i < additionalMessages.length; i++) {
      console.log(`Sending limit test message ${i + 1}...`);
      await submitTextToAgent(page, { text: additionalMessages[i], timeout: 3000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    const finalAnalysis = await page.evaluate(() => {
      const allText = document.body.textContent;
      
      return {
        stillHasTrackableMessage: allText.includes('TRACKABLE MESSAGE'),
        stillHasExpectedResponse: allText.includes('I HAVE RESPONDED TO YOUR TRACKABLE MESSAGE'),
        hasLimitTest1: allText.includes('LIMIT TEST 1'),
        hasLimitTest2: allText.includes('LIMIT TEST 2'), 
        hasLimitTest3: allText.includes('LIMIT TEST 3'),
        totalTextLength: allText.length,
        sessionId: allText.match(/Session:\s*([a-zA-Z0-9-]+)/)?.[1] || 'not-found',
        timestamp: Date.now()
      };
    });
    
    console.log('\n📊 FINAL ANALYSIS - Display Limits:');
    console.log(`Original trackable message still visible: ${finalAnalysis.stillHasTrackableMessage}`);
    console.log(`Original response still visible: ${finalAnalysis.stillHasExpectedResponse}`);
    console.log(`Limit test 1 visible: ${finalAnalysis.hasLimitTest1}`);
    console.log(`Limit test 2 visible: ${finalAnalysis.hasLimitTest2}`);
    console.log(`Limit test 3 visible: ${finalAnalysis.hasLimitTest3}`);
    
    await takeScreenshot(page, { name: 'conversation-detail-05-final-state' });
    
    // Save comprehensive analysis
    const comprehensiveResults = {
      timestamp: new Date().toISOString(),
      initialAnalysis: conversationAnalysis,
      postNavigationAnalysis,
      finalAnalysis,
      conclusion: {
        conversationPersistence: postNavigationAnalysis.containsTrackableMessage,
        responsePersistence: postNavigationAnalysis.containsExpectedResponse,
        possibleDisplayLimit: !finalAnalysis.stillHasTrackableMessage && finalAnalysis.hasLimitTest3,
        sessionContinuity: finalAnalysis.sessionId === conversationAnalysis.conversationElements.sessionId
      }
    };
    
    const fs = require('fs');
    fs.writeFileSync('./conversation-display-detailed-results.json', JSON.stringify(comprehensiveResults, null, 2));
    console.log('\n💾 Detailed conversation analysis saved to: conversation-display-detailed-results.json');
    
    console.log('\n⏰ Extended manual inspection (45 seconds)...');
    console.log('Look specifically at what conversation history is visible in the UI');
    await new Promise(resolve => setTimeout(resolve, 45000));
    
  } catch (error) {
    console.error('❌ Detailed conversation test failed:', error);
    await takeScreenshot(page, { name: 'conversation-detail-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  testConversationDisplayDetailed().catch(console.error);
}