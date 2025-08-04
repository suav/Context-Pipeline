#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgent = require('./agent/deploy-agent');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function walkthroughFastWorkflow() {
  console.log('⚡ WALKTHROUGH: Fast Workflow Test');
  console.log('=================================');
  console.log('Same workflow but optimized for speed - no slowMo, shorter waits.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
    // No slowMo - run at full speed
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('⚡ STEP 1: Navigate to Application');
    const navResult = await navigateToApp(page);
    console.log(`✅ Navigation: ${navResult.duration}ms`);
    await takeScreenshot(page, { name: 'fast-01-loaded' });
    
    console.log('⚡ STEP 2: Select Workspace (top one)');
    const wsResult = await selectWorkspace(page, { index: 0 });
    console.log(`✅ Workspace Selection: ${wsResult.duration}ms`);
    await takeScreenshot(page, { name: 'fast-02-workspace' });
    
    console.log('⚡ STEP 3: Deploy Agent');
    const agentResult = await deployAgent(page, { agentType: 'dev-assistant' });
    console.log(`✅ Agent Deployment: ${agentResult.duration}ms`);
    await takeScreenshot(page, { name: 'fast-03-agent' });
    
    console.log('⚡ STEP 4: Submit Short Text');
    const textResult = await submitTextToAgent(page, { 
      text: 'List files',
      timeout: 5000
    });
    console.log(`✅ Text Submission: ${textResult.duration}ms`);
    await takeScreenshot(page, { name: 'fast-04-text' });
    
    console.log('\n📊 Performance Summary:');
    console.log(`Navigation: ${navResult.duration}ms`);
    console.log(`Workspace: ${wsResult.duration}ms`);
    console.log(`Agent: ${agentResult.duration}ms`);
    console.log(`Text: ${textResult.duration}ms`);
    console.log(`Total: ${navResult.duration + wsResult.duration + agentResult.duration + textResult.duration}ms`);
    
    console.log('\n⏱️ Keeping open for 15 seconds to see agent response...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    await takeScreenshot(page, { name: 'fast-05-final' });
    
  } catch (error) {
    console.error('❌ Fast test failed:', error);
    await takeScreenshot(page, { name: 'fast-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  walkthroughFastWorkflow().catch(console.error);
}

module.exports = walkthroughFastWorkflow;