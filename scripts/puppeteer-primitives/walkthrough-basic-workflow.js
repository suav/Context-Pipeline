#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgent = require('./agent/deploy-agent');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function walkthroughBasicWorkflow() {
  console.log('👀 WALKTHROUGH: Basic Workflow Test');
  console.log('===================================');
  console.log('This test demonstrates the core user journey through the app.');
  console.log('Watch carefully and tell me what you see happening at each step.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 },
    slowMo: 500 // Slow down actions for better visibility
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('🎬 STEP 1: Navigate to Application');
    console.log('Watch what loads when we navigate to localhost:3001...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const navResult = await navigateToApp(page);
    console.log(`Result: ${navResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    await takeScreenshot(page, { name: 'walkthrough-01-app-loaded' });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🎬 STEP 2: Select a Workspace');
    console.log('Watch how workspace selection works...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const wsResult = await selectWorkspace(page, { index: 0 });
    console.log(`Result: ${wsResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    await takeScreenshot(page, { name: 'walkthrough-02-workspace-selected' });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🎬 STEP 3: Deploy an Agent');
    console.log('Watch the agent deployment process...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const agentResult = await deployAgent(page, { agentType: 'dev-assistant' });
    console.log(`Result: ${agentResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    await takeScreenshot(page, { name: 'walkthrough-03-agent-deployed' });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🎬 STEP 4: Submit Text to Agent');
    console.log('Watch how text submission and agent interaction works...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const textResult = await submitTextToAgent(page, { 
      text: 'Hello! Can you help me understand this workspace? Please list the main files and explain what this project does.',
      timeout: 10000
    });
    console.log(`Result: ${textResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    await takeScreenshot(page, { name: 'walkthrough-04-text-submitted' });
    
    console.log('\n⏳ Waiting for potential agent response...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    await takeScreenshot(page, { name: 'walkthrough-05-after-response-wait' });
    
    console.log('\n🎬 FINAL: Keeping browser open for your inspection');
    console.log('Browser will stay open for 30 seconds for you to explore...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await takeScreenshot(page, { name: 'walkthrough-error' });
  } finally {
    console.log('\n🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  walkthroughBasicWorkflow().catch(console.error);
}

module.exports = walkthroughBasicWorkflow;