#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgentImproved = require('./agent/deploy-agent-improved');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function testAgentResponseWaiting() {
  console.log('⏳ TEST: Agent Response Waiting');
  console.log('==============================');
  console.log('Testing proper waiting for agent responses without workspace switching.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('⏳ PHASE 1: Setup (one time only)');
    await navigateToApp(page);
    await selectWorkspace(page, { index: 0 });
    await deployAgentImproved(page, { agentType: 'dev-assistant' });
    await takeScreenshot(page, { name: 'response-01-agent-ready' });
    
    console.log('\n⏳ PHASE 2: Submit message and WAIT for response');
    await submitTextToAgent(page, { 
      text: 'Please list all files in this workspace and tell me what this project does.',
      timeout: 8000
    });
    await takeScreenshot(page, { name: 'response-02-message-sent' });
    
    console.log('\n⏳ PHASE 3: Monitor for agent response (60 seconds)');
    console.log('Watching terminal area for streaming text or new content...');
    
    let responseDetected = false;
    let lastContentLength = 0;
    
    for (let i = 0; i < 12; i++) { // Check every 5 seconds for 60 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check terminal content length
      const currentContent = await page.evaluate(() => {
        const terminals = document.querySelectorAll('[class*="terminal"], [class*="chat"], .terminal, .chat-container');
        let totalContent = '';
        terminals.forEach(terminal => {
          totalContent += terminal.textContent || '';
        });
        return {
          length: totalContent.length,
          preview: totalContent.substring(totalContent.length - 200) // Last 200 chars
        };
      });
      
      const elapsed = (i + 1) * 5;
      console.log(`⏳ ${elapsed}s: Content length = ${currentContent.length} (was ${lastContentLength})`);
      
      if (currentContent.length > lastContentLength + 50) { // Significant new content
        console.log('✅ New content detected!');
        console.log('Preview:', currentContent.preview.substring(0, 100) + '...');
        responseDetected = true;
      }
      
      lastContentLength = currentContent.length;
      await takeScreenshot(page, { name: `response-03-monitor-${elapsed}s` });
      
      if (responseDetected && i >= 4) { // Give it at least 20 seconds even after response
        console.log('Response detected and sufficient time elapsed, continuing...');
        break;
      }
    }
    
    console.log('\n⏳ PHASE 4: Final state capture');
    await takeScreenshot(page, { name: 'response-04-final-state' });
    
    // Get final terminal content
    const finalContent = await page.evaluate(() => {
      const terminals = document.querySelectorAll('[class*="terminal"], [class*="chat"], .terminal, .chat-container');
      let content = '';
      terminals.forEach(terminal => {
        content += terminal.textContent || '';
      });
      return content;
    });
    
    console.log('\n📊 RESULTS:');
    console.log(`Response detected: ${responseDetected}`);
    console.log(`Final content length: ${finalContent.length}`);
    console.log('Final content preview:', finalContent.substring(Math.max(0, finalContent.length - 300)));
    
    console.log('\n⏰ MANUAL INSPECTION: Browser stays open for 45 seconds');
    console.log('Use this time to see if agent is still responding or if response completed...');
    await new Promise(resolve => setTimeout(resolve, 45000));
    
  } catch (error) {
    console.error('❌ Response waiting test failed:', error);
    await takeScreenshot(page, { name: 'response-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  testAgentResponseWaiting().catch(console.error);
}

module.exports = testAgentResponseWaiting;