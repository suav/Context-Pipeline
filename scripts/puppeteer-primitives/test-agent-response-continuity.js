#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgentImproved = require('./agent/deploy-agent-improved');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function testAgentResponseContinuity() {
  console.log('🔄 INVESTIGATION: Agent Response Continuity & Pickup Issues');
  console.log('==========================================================');
  console.log('Testing the gap between session persistence and response continuity.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  const continuityData = {
    timestamp: new Date().toISOString(),
    phases: [],
    uiStates: [],
    findings: []
  };
  
  try {
    // PHASE 1: Establish baseline with long-running task
    console.log('🔄 PHASE 1: Submit Long-Running Task');
    await navigateToApp(page);
    await selectWorkspace(page, { index: 0 });
    await deployAgentImproved(page, { agentType: 'dev-assistant' });
    
    const longTask = 'Please analyze this entire workspace thoroughly: list all files, explain the project structure, identify the main technologies used, and suggest improvements. Take your time with a detailed analysis.';
    await submitTextToAgent(page, { text: longTask, timeout: 5000 });
    
    const phase1Session = await page.evaluate(() => {
      const sessionText = document.body.textContent.match(/Session:\s*([a-zA-Z0-9-]+)/);
      return sessionText ? sessionText[1] : 'not-found';
    });
    
    console.log(`📊 Phase 1 Session: ${phase1Session}`);
    await takeScreenshot(page, { name: 'continuity-01-long-task-submitted' });
    
    // Capture initial UI state
    const initialUIState = await page.evaluate(() => {
      const terminalArea = document.querySelector('[class*="terminal"], [class*="chat"]');
      const inputField = document.querySelector('input[placeholder*="command"]');
      const allText = document.body.textContent;
      
      return {
        hasTerminalArea: !!terminalArea,
        terminalContent: terminalArea ? terminalArea.textContent.substring(0, 500) : 'none',
        hasInputField: !!inputField,
        inputValue: inputField ? inputField.value : 'none',
        totalTextLength: allText.length,
        containsUserPrompt: allText.includes('analyze this entire workspace'),
        containsResponse: allText.includes('I\'ll analyze') || allText.includes('Looking at') || allText.includes('Based on'),
        timestamp: Date.now()
      };
    });
    
    continuityData.uiStates.push({ phase: 1, type: 'initial', ...initialUIState });
    console.log('📊 Initial UI State:', JSON.stringify(initialUIState, null, 2));
    
    // PHASE 2: Wait and monitor for response activity
    console.log('\n🔄 PHASE 2: Monitor for Response Activity (30 seconds)');
    
    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const monitorState = await page.evaluate(() => {
        const terminalArea = document.querySelector('[class*="terminal"], [class*="chat"]');
        const allText = document.body.textContent;
        const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
        
        // Look for signs of activity/processing
        const activityIndicators = {
          hasLoadingSpinner: !!document.querySelector('[class*="loading"], [class*="spinner"]'),
          hasProgressIndicator: allText.includes('⏱️') || allText.includes('💰'),
          sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
          textGrowth: allText.length,
          hasStreamingText: allText.includes('...') || allText.includes('thinking'),
          responseStarted: allText.includes('I\'ll') || allText.includes('Looking') || allText.includes('Based on')
        };
        
        return {
          ...activityIndicators,
          terminalContent: terminalArea ? terminalArea.textContent.substring(0, 300) : 'none',
          timestamp: Date.now()
        };
      });
      
      continuityData.uiStates.push({ phase: 2, iteration: i + 1, type: 'monitoring', ...monitorState });
      
      console.log(`🔄 Monitor ${(i + 1) * 5}s: Session=${monitorState.sessionId}, TextLen=${monitorState.textGrowth}, Activity=${monitorState.hasProgressIndicator}`);
      
      if (monitorState.responseStarted && i === 0) {
        console.log('✅ Response detected early!');
        await takeScreenshot(page, { name: 'continuity-02-response-detected' });
      }
      
      await takeScreenshot(page, { name: `continuity-02-monitor-${(i + 1) * 5}s` });
    }
    
    // PHASE 3: Navigate away during potential response
    console.log('\n🔄 PHASE 3: Navigate Away During Potential Response');
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await takeScreenshot(page, { name: 'continuity-03-navigated-away' });
    
    // PHASE 4: Return and check for response pickup
    console.log('\n🔄 PHASE 4: Return to Workspace - Response Pickup Test');
    await selectWorkspace(page, { index: 0 });
    
    const pickupUIState = await page.evaluate(() => {
      const terminalArea = document.querySelector('[class*="terminal"], [class*="chat"]');
      const inputField = document.querySelector('input[placeholder*="command"]');
      const allText = document.body.textContent;
      const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
      
      return {
        sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
        hasTerminalArea: !!terminalArea,
        hasInputField: !!inputField,
        terminalContent: terminalArea ? terminalArea.textContent.substring(0, 500) : 'none',
        totalTextLength: allText.length,
        containsOriginalPrompt: allText.includes('analyze this entire workspace'),
        containsResponse: allText.includes('I\'ll analyze') || allText.includes('Looking at') || allText.includes('files in this workspace'),
        hasNewContent: allText.includes('package.json') || allText.includes('React') || allText.includes('components'),
        timestamp: Date.now()
      };
    });
    
    continuityData.uiStates.push({ phase: 4, type: 'pickup', ...pickupUIState });
    
    console.log('📊 Pickup State Analysis:');
    console.log(`Session ID maintained: ${phase1Session === pickupUIState.sessionId}`);
    console.log(`Original prompt visible: ${pickupUIState.containsOriginalPrompt}`);
    console.log(`Response content visible: ${pickupUIState.containsResponse}`);
    console.log(`New analysis content: ${pickupUIState.hasNewContent}`);
    
    await takeScreenshot(page, { name: 'continuity-04-pickup-state' });
    
    // PHASE 5: Test if agent is still "working" by submitting follow-up
    console.log('\n🔄 PHASE 5: Test Agent Responsiveness After Pickup');
    
    const needsAgentRedeploy = await page.evaluate(() => {
      return !document.querySelector('input[placeholder*="command"]');
    });
    
    if (needsAgentRedeploy) {
      console.log('⚠️ Agent interface missing, redeploying...');
      await deployAgentImproved(page, { agentType: 'dev-assistant' });
    }
    
    await submitTextToAgent(page, { 
      text: 'FOLLOWUP: Did you complete your analysis? Can you summarize what you found? Also, do you remember the previous task I gave you?',
      timeout: 5000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for potential response
    
    const followupState = await page.evaluate(() => {
      const allText = document.body.textContent;
      const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
      
      return {
        sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
        textLength: allText.length,
        hasFollowupPrompt: allText.includes('Did you complete your analysis'),
        hasFollowupResponse: allText.includes('Yes, I completed') || allText.includes('summary') || allText.includes('I remember'),
        timestamp: Date.now()
      };
    });
    
    continuityData.uiStates.push({ phase: 5, type: 'followup', ...followupState });
    await takeScreenshot(page, { name: 'continuity-05-followup-test' });
    
    // ANALYSIS AND FINDINGS
    console.log('\n📊 RESPONSE CONTINUITY ANALYSIS');
    console.log('================================');
    
    const findings = {
      sessionPersistence: phase1Session === pickupUIState.sessionId,
      promptPersistence: pickupUIState.containsOriginalPrompt,
      responseContinuity: pickupUIState.containsResponse || pickupUIState.hasNewContent,
      agentPickupWorking: followupState.hasFollowupResponse,
      uiReconnection: pickupUIState.hasInputField && pickupUIState.hasTerminalArea
    };
    
    continuityData.findings = findings;
    
    console.log('🔍 Key Findings:');
    console.log(`✅ Session IDs persist: ${findings.sessionPersistence}`);
    console.log(`✅ User prompts persist: ${findings.promptPersistence}`);
    console.log(`${findings.responseContinuity ? '✅' : '❌'} Agent responses continue: ${findings.responseContinuity}`);
    console.log(`${findings.agentPickupWorking ? '✅' : '❌'} Agent pickup working: ${findings.agentPickupWorking}`);
    console.log(`${findings.uiReconnection ? '✅' : '❌'} UI reconnection working: ${findings.uiReconnection}`);
    
    if (!findings.responseContinuity) {
      console.log('\n🚨 ISSUE IDENTIFIED: Response continuity broken!');
      console.log('- User prompts are saved and redisplayed');
      console.log('- Agent responses are NOT picked up after navigation');
      console.log('- This suggests a UI reconnection problem, not a backend issue');
    }
    
    // Save detailed results
    const fs = require('fs');
    fs.writeFileSync('./agent-response-continuity-results.json', JSON.stringify(continuityData, null, 2));
    console.log('\n💾 Detailed continuity analysis saved to: agent-response-continuity-results.json');
    
    console.log('\n⏰ Extended inspection time (60 seconds)');
    console.log('Use this time to manually observe agent behavior and response patterns...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    
  } catch (error) {
    console.error('❌ Response continuity test failed:', error);
    continuityData.error = error.message;
    await takeScreenshot(page, { name: 'continuity-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  testAgentResponseContinuity().catch(console.error);
}