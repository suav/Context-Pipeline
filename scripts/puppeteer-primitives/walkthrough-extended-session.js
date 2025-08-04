#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgent = require('./agent/deploy-agent');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function walkthroughExtendedSession() {
  console.log('⏰ WALKTHROUGH: Extended Session Test');
  console.log('====================================');
  console.log('Testing with much longer timeouts to see actual agent responses.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('⏰ PHASE 1: Quick setup');
    await navigateToApp(page);
    await selectWorkspace(page, { index: 0 });
    await takeScreenshot(page, { name: 'extended-01-setup' });
    
    console.log('\n⏰ PHASE 2: Deploy agent and submit text');
    await deployAgent(page, { agentType: 'dev-assistant' });
    await submitTextToAgent(page, { 
      text: 'Please list all files in this workspace and explain what this project does.',
      timeout: 10000
    });
    await takeScreenshot(page, { name: 'extended-02-message-sent' });
    
    console.log('\n⏰ PHASE 3: Wait for agent response (2 minutes)');
    console.log('Watching for streaming text or response updates...');
    
    for (let i = 0; i < 12; i++) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      console.log(`⏰ ${(i + 1) * 10} seconds elapsed...`);
      await takeScreenshot(page, { name: `extended-03-wait-${(i + 1) * 10}s` });
      
      // Check if there's any new content
      const hasNewContent = await page.evaluate(() => {
        const terminal = document.querySelector('[class*="terminal"], [class*="chat"]');
        if (terminal) {
          const text = terminal.textContent;
          return text.length > 100; // Some threshold for "has content"
        }
        return false;
      });
      
      if (hasNewContent && i > 3) { // Give it at least 40 seconds before considering stopping
        console.log('✅ Detected new content, breaking wait loop');
        break;
      }
    }
    
    console.log('\n⏰ PHASE 4: Final state capture');
    await takeScreenshot(page, { name: 'extended-04-final-state' });
    
    console.log('\n⏰ PHASE 5: Manual inspection time (60 seconds)');
    console.log('Browser will stay open for you to interact manually...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    
  } catch (error) {
    console.error('❌ Extended session test failed:', error);
    await takeScreenshot(page, { name: 'extended-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  walkthroughExtendedSession().catch(console.error);
}

module.exports = walkthroughExtendedSession;