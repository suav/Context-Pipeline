#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgentImproved = require('./agent/deploy-agent-improved');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function testAgentPermanenceRobust() {
  console.log('🧠 ROBUST TEST: Agent Permanence & History');
  console.log('==========================================');
  console.log('Testing agent memory across workspace navigation with improved tracking.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  const testData = {
    startTime: new Date().toISOString(),
    phases: [],
    sessionIds: [],
    errors: []
  };
  
  try {
    // PHASE 1: Setup first workspace and establish session
    console.log('🧠 PHASE 1: Establish Agent Session in Workspace A');
    testData.phases.push({ phase: 1, description: 'Setup Workspace A', startTime: Date.now() });
    
    await navigateToApp(page);
    await selectWorkspace(page, { index: 0 });
    await deployAgentImproved(page, { agentType: 'dev-assistant' });
    await takeScreenshot(page, { name: 'permanence-01-workspace-a-setup' });
    
    // Submit first message with unique identifier
    const firstMessage = `PHASE 1 TEST: Hello agent! This is message #1 from Workspace A. My unique ID is PERM-TEST-${Date.now()}. Please remember this.`;
    await submitTextToAgent(page, { text: firstMessage, timeout: 5000 });
    
    // Wait and capture session info
    await new Promise(resolve => setTimeout(resolve, 3000));
    const phase1Session = await page.evaluate(() => {
      const sessionElement = document.querySelector('[class*="session"], [data-session]');
      const sessionText = document.body.textContent.match(/Session:\s*([a-zA-Z0-9-]+)/);
      return {
        sessionId: sessionText ? sessionText[1] : 'not-found',
        hasSessionUI: !!sessionElement,
        timestamp: Date.now(),
        workspaceIndicator: document.body.textContent.includes('Workspace') ? 'found' : 'not-found'
      };
    });
    
    testData.sessionIds.push({ phase: 1, ...phase1Session });
    console.log(`📊 Phase 1 Session: ${phase1Session.sessionId}`);
    await takeScreenshot(page, { name: 'permanence-02-workspace-a-session' });
    testData.phases[0].endTime = Date.now();
    testData.phases[0].duration = testData.phases[0].endTime - testData.phases[0].startTime;
    
    // PHASE 2: Navigate to different workspace
    console.log('\n🧠 PHASE 2: Switch to Workspace B');
    testData.phases.push({ phase: 2, description: 'Switch to Workspace B', startTime: Date.now() });
    
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await selectWorkspace(page, { index: 1 }); // Different workspace
    await takeScreenshot(page, { name: 'permanence-03-workspace-b-setup' });
    
    // Deploy agent in workspace B
    await deployAgentImproved(page, { agentType: 'dev-assistant' });
    const secondMessage = `PHASE 2 TEST: I am now in Workspace B. This is message #2. My ID is PERM-TEST-B-${Date.now()}. I should NOT remember Workspace A.`;
    await submitTextToAgent(page, { text: secondMessage, timeout: 5000 });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    const phase2Session = await page.evaluate(() => {
      const sessionText = document.body.textContent.match(/Session:\s*([a-zA-Z0-9-]+)/);
      return {
        sessionId: sessionText ? sessionText[1] : 'not-found',
        timestamp: Date.now()
      };
    });
    
    testData.sessionIds.push({ phase: 2, ...phase2Session });
    console.log(`📊 Phase 2 Session: ${phase2Session.sessionId}`);
    await takeScreenshot(page, { name: 'permanence-04-workspace-b-session' });
    testData.phases[1].endTime = Date.now();
    testData.phases[1].duration = testData.phases[1].endTime - testData.phases[1].startTime;
    
    // PHASE 3: Return to Workspace A - Test Permanence
    console.log('\n🧠 PHASE 3: Return to Workspace A - Memory Test');
    testData.phases.push({ phase: 3, description: 'Return to Workspace A', startTime: Date.now() });
    
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await selectWorkspace(page, { index: 0 }); // Back to first workspace
    await takeScreenshot(page, { name: 'permanence-05-return-to-workspace-a' });
    
    // Check if agent is still there or needs redeployment
    const agentStillThere = await page.evaluate(() => {
      return document.querySelector('input[placeholder*="command"]') !== null;
    });
    
    if (!agentStillThere) {
      console.log('⚠️ Agent not present, redeploying...');
      await deployAgentImproved(page, { agentType: 'dev-assistant' });
    }
    
    // Test memory with reference to original message
    const memoryTestMessage = `PHASE 3 MEMORY TEST: Do you remember my unique ID from earlier? I mentioned PERM-TEST. What workspace were we originally in?`;
    await submitTextToAgent(page, { text: memoryTestMessage, timeout: 5000 });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    const phase3Session = await page.evaluate(() => {
      const sessionText = document.body.textContent.match(/Session:\s*([a-zA-Z0-9-]+)/);
      return {
        sessionId: sessionText ? sessionText[1] : 'not-found',
        timestamp: Date.now()
      };
    });
    
    testData.sessionIds.push({ phase: 3, ...phase3Session });
    console.log(`📊 Phase 3 Session: ${phase3Session.sessionId}`);
    await takeScreenshot(page, { name: 'permanence-06-workspace-a-memory-test' });
    testData.phases[2].endTime = Date.now();
    testData.phases[2].duration = testData.phases[2].endTime - testData.phases[2].startTime;
    
    // PHASE 4: Analysis and Final Test
    console.log('\n🧠 PHASE 4: Cross-Workspace Isolation Test');
    testData.phases.push({ phase: 4, description: 'Cross-workspace isolation', startTime: Date.now() });
    
    // Go back to workspace B to ensure isolation
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await selectWorkspace(page, { index: 1 });
    
    const agentStillThereB = await page.evaluate(() => {
      return document.querySelector('input[placeholder*="command"]') !== null;
    });
    
    if (!agentStillThereB) {
      await deployAgentImproved(page, { agentType: 'dev-assistant' });
    }
    
    const isolationTestMessage = `PHASE 4 ISOLATION TEST: Do you remember anything about Workspace A or any PERM-TEST IDs? You should only remember Workspace B.`;
    await submitTextToAgent(page, { text: isolationTestMessage, timeout: 5000 });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    const phase4Session = await page.evaluate(() => {
      const sessionText = document.body.textContent.match(/Session:\s*([a-zA-Z0-9-]+)/);
      return {
        sessionId: sessionText ? sessionText[1] : 'not-found',
        timestamp: Date.now()
      };
    });
    
    testData.sessionIds.push({ phase: 4, ...phase4Session });
    await takeScreenshot(page, { name: 'permanence-07-workspace-b-isolation-test' });
    testData.phases[3].endTime = Date.now();
    testData.phases[3].duration = testData.phases[3].endTime - testData.phases[3].startTime;
    
    // RESULTS ANALYSIS
    console.log('\n📊 PERMANENCE TEST RESULTS');
    console.log('==========================');
    
    const sessionAnalysis = {
      phase1Session: testData.sessionIds[0]?.sessionId,
      phase2Session: testData.sessionIds[1]?.sessionId,
      phase3Session: testData.sessionIds[2]?.sessionId,
      phase4Session: testData.sessionIds[3]?.sessionId,
      sessionPersistence: {
        workspaceA: testData.sessionIds[0]?.sessionId === testData.sessionIds[2]?.sessionId,
        workspaceB: testData.sessionIds[1]?.sessionId === testData.sessionIds[3]?.sessionId,
        crossContamination: testData.sessionIds[0]?.sessionId === testData.sessionIds[1]?.sessionId
      }
    };
    
    console.log('Session IDs by phase:');
    testData.sessionIds.forEach((session, i) => {
      console.log(`Phase ${session.phase}: ${session.sessionId}`);
    });
    
    console.log('\nPermanence Analysis:');
    console.log(`✅ Workspace A session persisted: ${sessionAnalysis.sessionPersistence.workspaceA}`);
    console.log(`✅ Workspace B session persisted: ${sessionAnalysis.sessionPersistence.workspaceB}`);
    console.log(`✅ Sessions isolated (no cross-contamination): ${!sessionAnalysis.sessionPersistence.crossContamination}`);
    
    testData.results = sessionAnalysis;
    
    // Save detailed results
    const fs = require('fs');
    fs.writeFileSync('./agent-permanence-test-results.json', JSON.stringify(testData, null, 2));
    console.log('\n💾 Detailed results saved to: agent-permanence-test-results.json');
    
    console.log('\n⏰ EXTENDED OBSERVATION: Browser stays open for 60 seconds');
    console.log('Use this time to manually verify agent responses and behavior...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    
  } catch (error) {
    console.error('❌ Robust permanence test failed:', error);
    testData.errors.push({ error: error.message, timestamp: Date.now() });
    await takeScreenshot(page, { name: 'permanence-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  testAgentPermanenceRobust().catch(console.error);
}