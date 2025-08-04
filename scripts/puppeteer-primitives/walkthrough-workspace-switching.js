#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgent = require('./agent/deploy-agent');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function walkthroughWorkspaceSwitching() {
  console.log('🔄 WALKTHROUGH: Workspace Switching Test');
  console.log('=======================================');
  console.log('Testing workspace switching and agent persistence.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('🔄 PHASE 1: Setup first workspace');
    await navigateToApp(page);
    await selectWorkspace(page, { index: 0 });
    await takeScreenshot(page, { name: 'switch-01-workspace-a' });
    
    await deployAgent(page, { agentType: 'dev-assistant' });
    await submitTextToAgent(page, { text: 'Remember: I am in workspace A. What files do you see?' });
    await takeScreenshot(page, { name: 'switch-02-workspace-a-agent' });
    
    console.log('\n🔄 PHASE 2: Switch to different workspace');
    await page.goto('http://localhost:3001'); // Go back to workspace list
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await selectWorkspace(page, { index: 1 }); // Try second workspace
    await takeScreenshot(page, { name: 'switch-03-workspace-b' });
    
    await deployAgent(page, { agentType: 'dev-assistant' });
    await submitTextToAgent(page, { text: 'Remember: I am in workspace B. List the files here.' });
    await takeScreenshot(page, { name: 'switch-04-workspace-b-agent' });
    
    console.log('\n🔄 PHASE 3: Return to first workspace');
    await page.goto('http://localhost:3001'); // Back to list
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await selectWorkspace(page, { index: 0 }); // Back to first
    await takeScreenshot(page, { name: 'switch-05-back-to-workspace-a' });
    
    // Test if agent remembers the context
    await submitTextToAgent(page, { text: 'Do you remember me? What workspace am I in?' });
    await takeScreenshot(page, { name: 'switch-06-memory-test' });
    
    console.log('\n⏱️ Keeping open for 20 seconds to observe behavior...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    await takeScreenshot(page, { name: 'switch-07-final' });
    
  } catch (error) {
    console.error('❌ Workspace switching test failed:', error);
    await takeScreenshot(page, { name: 'switch-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  walkthroughWorkspaceSwitching().catch(console.error);
}

module.exports = walkthroughWorkspaceSwitching;