#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgentImproved = require('./agent/deploy-agent-improved');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function testAgentPermanenceStress() {
  console.log('🏋️ STRESS TEST: Agent Permanence Under Various Conditions');
  console.log('=========================================================');
  console.log('Testing edge cases that might break agent memory and session persistence.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  const stressTests = [];
  
  try {
    // STRESS TEST 1: Rapid workspace switching
    console.log('🏋️ STRESS TEST 1: Rapid Workspace Switching');
    const rapidSwitchResults = [];
    
    await navigateToApp(page);
    await selectWorkspace(page, { index: 0 });
    await deployAgentImproved(page, { agentType: 'dev-assistant' });
    await submitTextToAgent(page, { text: 'RAPID TEST: Remember this - I am the ORIGINAL agent in workspace 0.' });
    
    const originalSession = await page.evaluate(() => {
      const sessionText = document.body.textContent.match(/Session:\s*([a-zA-Z0-9-]+)/);
      return sessionText ? sessionText[1] : 'not-found';
    });
    rapidSwitchResults.push({ step: 'original', sessionId: originalSession, timestamp: Date.now() });
    await takeScreenshot(page, { name: 'stress-01-original-session' });
    
    // Rapid switching: 0 -> 1 -> 0 -> 1 -> 0
    const switchSequence = [1, 0, 1, 0];
    for (let i = 0; i < switchSequence.length; i++) {
      const targetIndex = switchSequence[i];
      console.log(`🔄 Rapid switch ${i + 1}: Going to workspace ${targetIndex}`);
      
      await page.goto('http://localhost:3001');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Shorter wait for stress test
      await selectWorkspace(page, { index: targetIndex });
      
      // Quick agent check/deploy
      const needsAgent = await page.evaluate(() => {
        return !document.querySelector('input[placeholder*="command"]');
      });
      
      if (needsAgent) {
        await deployAgentImproved(page, { agentType: 'dev-assistant' });
      }
      
      const currentSession = await page.evaluate(() => {
        const sessionText = document.body.textContent.match(/Session:\s*([a-zA-Z0-9-]+)/);
        return sessionText ? sessionText[1] : 'not-found';
      });
      
      rapidSwitchResults.push({ 
        step: `switch-${i + 1}`, 
        targetWorkspace: targetIndex,
        sessionId: currentSession, 
        timestamp: Date.now() 
      });
      
      await takeScreenshot(page, { name: `stress-01-rapid-${i + 1}-ws${targetIndex}` });
    }
    
    // Test if original session survived
    const finalSession = rapidSwitchResults[rapidSwitchResults.length - 1].sessionId;
    const sessionSurvived = originalSession === finalSession;
    console.log(`📊 Rapid switching result: Original session ${sessionSurvived ? 'SURVIVED' : 'LOST'}`);
    stressTests.push({ test: 'rapid-switching', passed: sessionSurvived, details: rapidSwitchResults });
    
    // STRESS TEST 2: Page refresh during agent interaction
    console.log('\n🏋️ STRESS TEST 2: Page Refresh During Agent Session');
    await page.goto('http://localhost:3001');
    await selectWorkspace(page, { index: 0 });
    await deployAgentImproved(page, { agentType: 'dev-assistant' });
    await submitTextToAgent(page, { text: 'REFRESH TEST: I am about to refresh the page. Remember this message.' });
    
    const preRefreshSession = await page.evaluate(() => {
      const sessionText = document.body.textContent.match(/Session:\s*([a-zA-Z0-9-]+)/);
      return sessionText ? sessionText[1] : 'not-found';
    });
    
    await takeScreenshot(page, { name: 'stress-02-pre-refresh' });
    
    // Hard refresh
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Navigate back to workspace
    await selectWorkspace(page, { index: 0 });
    const needsAgentAfterRefresh = await page.evaluate(() => {
      return !document.querySelector('input[placeholder*="command"]');
    });
    
    if (needsAgentAfterRefresh) {
      await deployAgentImproved(page, { agentType: 'dev-assistant' });
    }
    
    const postRefreshSession = await page.evaluate(() => {
      const sessionText = document.body.textContent.match(/Session:\s*([a-zA-Z0-9-]+)/);
      return sessionText ? sessionText[1] : 'not-found';
    });
    
    await takeScreenshot(page, { name: 'stress-02-post-refresh' });
    
    const refreshSurvived = preRefreshSession === postRefreshSession;
    console.log(`📊 Refresh test result: Session ${refreshSurvived ? 'SURVIVED' : 'LOST'} (${preRefreshSession} -> ${postRefreshSession})`);
    stressTests.push({ test: 'page-refresh', passed: refreshSurvived, preRefresh: preRefreshSession, postRefresh: postRefreshSession });
    
    // STRESS TEST 3: Multiple agents in same workspace
    console.log('\n🏋️ STRESS TEST 3: Multiple Agent Types in Same Workspace');
    await page.goto('http://localhost:3001');
    await selectWorkspace(page, { index: 0 });
    
    // Deploy dev assistant
    await deployAgentImproved(page, { agentType: 'dev-assistant' });
    await submitTextToAgent(page, { text: 'MULTI-AGENT TEST: I am the DEV ASSISTANT. Remember this role.' });
    
    const devAssistantSession = await page.evaluate(() => {
      const sessionText = document.body.textContent.match(/Session:\s*([a-zA-Z0-9-]+)/);
      return sessionText ? sessionText[1] : 'not-found';
    });
    
    await takeScreenshot(page, { name: 'stress-03-dev-assistant' });
    
    // Try to deploy code reviewer in same workspace
    await deployAgentImproved(page, { agentType: 'code-reviewer' });
    await submitTextToAgent(page, { text: 'MULTI-AGENT TEST: I am the CODE REVIEWER. Different from dev assistant.' });
    
    const codeReviewerSession = await page.evaluate(() => {
      const sessionText = document.body.textContent.match(/Session:\s*([a-zA-Z0-9-]+)/);
      return sessionText ? sessionText[1] : 'not-found';
    });
    
    await takeScreenshot(page, { name: 'stress-03-code-reviewer' });
    
    const sameSession = devAssistantSession === codeReviewerSession;
    console.log(`📊 Multiple agents result: Sessions ${sameSession ? 'SHARED' : 'SEPARATE'} (${devAssistantSession} vs ${codeReviewerSession})`);
    stressTests.push({ 
      test: 'multiple-agents', 
      sessionSharing: sameSession, 
      devSession: devAssistantSession, 
      reviewerSession: codeReviewerSession 
    });
    
    // STRESS TEST 4: Long session with memory test
    console.log('\n🏋️ STRESS TEST 4: Long Session Memory Test');
    await page.goto('http://localhost:3001');
    await selectWorkspace(page, { index: 0 });
    await deployAgentImproved(page, { agentType: 'dev-assistant' });
    
    const memoryTestMessages = [
      'MEMORY 1: My name is Alice and I work at TechCorp.',
      'MEMORY 2: I am working on a React project called "DataViz".',
      'MEMORY 3: The main bug is in the authentication module.',
      'MEMORY 4: We need to deploy to production by Friday.',
      'MEMORY 5: The database is PostgreSQL running on AWS.'
    ];
    
    const longSessionStart = await page.evaluate(() => {
      const sessionText = document.body.textContent.match(/Session:\s*([a-zA-Z0-9-]+)/);
      return sessionText ? sessionText[1] : 'not-found';
    });
    
    for (let i = 0; i < memoryTestMessages.length; i++) {
      await submitTextToAgent(page, { text: memoryTestMessages[i], timeout: 3000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (i === 2) { // Midway through, take screenshot
        await takeScreenshot(page, { name: 'stress-04-memory-midway' });
      }
    }
    
    // Test recall
    await submitTextToAgent(page, { text: 'MEMORY TEST: What is my name? What project am I working on? When is the deadline?' });
    
    const longSessionEnd = await page.evaluate(() => {
      const sessionText = document.body.textContent.match(/Session:\s*([a-zA-Z0-9-]+)/);
      return sessionText ? sessionText[1] : 'not-found';
    });
    
    await takeScreenshot(page, { name: 'stress-04-memory-final' });
    
    const longSessionSurvived = longSessionStart === longSessionEnd;
    console.log(`📊 Long session result: Session ${longSessionSurvived ? 'MAINTAINED' : 'CHANGED'} through ${memoryTestMessages.length} messages`);
    stressTests.push({ 
      test: 'long-session', 
      passed: longSessionSurvived, 
      messageCount: memoryTestMessages.length,
      startSession: longSessionStart,
      endSession: longSessionEnd
    });
    
    // FINAL RESULTS
    console.log('\n📊 STRESS TEST SUMMARY');
    console.log('======================');
    stressTests.forEach((test, i) => {
      const status = test.passed !== undefined ? (test.passed ? '✅ PASSED' : '❌ FAILED') : '📊 INFO';
      console.log(`${i + 1}. ${test.test}: ${status}`);
    });
    
    const fs = require('fs');
    fs.writeFileSync('./agent-permanence-stress-results.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      stressTests,
      summary: {
        totalTests: stressTests.length,
        passed: stressTests.filter(t => t.passed === true).length,
        failed: stressTests.filter(t => t.passed === false).length
      }
    }, null, 2));
    
    console.log('\n💾 Stress test results saved to: agent-permanence-stress-results.json');
    console.log('\n⏰ Browser stays open for 45 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 45000));
    
  } catch (error) {
    console.error('❌ Stress test failed:', error);
    await takeScreenshot(page, { name: 'stress-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  testAgentPermanenceStress().catch(console.error);
}