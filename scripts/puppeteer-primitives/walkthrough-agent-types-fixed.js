#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgent = require('./agent/deploy-agent');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function walkthroughAgentTypesFixed() {
  console.log('🔧 WALKTHROUGH: Agent Types Test (FIXED)');
  console.log('=======================================');
  console.log('Testing to see what agent buttons actually exist in the UI.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('🔧 SETUP: Navigate and select workspace');
    await navigateToApp(page);
    await selectWorkspace(page, { index: 0 });
    await takeScreenshot(page, { name: 'agent-fix-01-workspace-loaded' });
    
    console.log('\n🔧 DISCOVERY: What agent buttons exist?');
    const availableAgents = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const agentButtons = [];
      
      buttons.forEach((btn, index) => {
        const text = btn.textContent.toLowerCase();
        if (text.includes('assistant') || 
            text.includes('reviewer') || 
            text.includes('claude') || 
            text.includes('gemini') ||
            text.includes('agent') ||
            text.includes('deploy')) {
          agentButtons.push({
            index,
            text: btn.textContent.trim(),
            classes: btn.className,
            visible: btn.offsetParent !== null
          });
        }
      });
      
      return agentButtons;
    });
    
    console.log('\n📋 Available Agent Buttons Found:');
    availableAgents.forEach((agent, i) => {
      console.log(`${i + 1}. "${agent.text}" (visible: ${agent.visible})`);
    });
    
    console.log('\n🔧 TEST: Click each agent button found');
    for (let i = 0; i < Math.min(availableAgents.length, 4); i++) {
      const agent = availableAgents[i];
      console.log(`\n🎯 Testing agent button: "${agent.text}"`);
      
      try {
        // Click the specific button by its text
        const clicked = await page.evaluate((buttonText) => {
          const buttons = document.querySelectorAll('button');
          for (let btn of buttons) {
            if (btn.textContent.trim() === buttonText && btn.offsetParent !== null) {
              btn.click();
              return true;
            }
          }
          return false;
        }, agent.text);
        
        if (clicked) {
          console.log(`✅ Clicked: "${agent.text}"`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          await takeScreenshot(page, { name: `agent-fix-0${i+2}-clicked-${agent.text.replace(/[^a-zA-Z0-9]/g, '-')}` });
          
          // Try to submit a test message
          const testResult = await submitTextToAgent(page, { 
            text: `Hello! I clicked "${agent.text}". Are you working?`,
            timeout: 3000
          });
          
          if (testResult.success) {
            console.log(`✅ Text submitted successfully to "${agent.text}"`);
          } else {
            console.log(`⚠️ Text submission failed for "${agent.text}"`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } else {
          console.log(`❌ Could not click: "${agent.text}"`);
        }
        
      } catch (error) {
        console.log(`💥 Error testing "${agent.text}": ${error.message}`);
      }
    }
    
    console.log('\n⏰ EXTENDED: Keeping browser open for 45 seconds for inspection...');
    console.log('Use this time to manually test different agent buttons!');
    await new Promise(resolve => setTimeout(resolve, 45000));
    await takeScreenshot(page, { name: 'agent-fix-final' });
    
  } catch (error) {
    console.error('❌ Fixed agent types test failed:', error);
    await takeScreenshot(page, { name: 'agent-fix-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  walkthroughAgentTypesFixed().catch(console.error);
}

module.exports = walkthroughAgentTypesFixed;