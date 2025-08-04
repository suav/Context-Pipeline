#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgent = require('./agent/deploy-agent');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function walkthroughAgentTypes() {
  console.log('🤖 WALKTHROUGH: Agent Types Test');
  console.log('================================');
  console.log('Testing different agent types to see which ones work.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  const agentTests = [
    'dev-assistant',
    'code-reviewer', 
    'claude',
    'gemini'
  ];
  
  try {
    await navigateToApp(page);
    await selectWorkspace(page, { index: 0 });
    await takeScreenshot(page, { name: 'agent-types-01-setup' });
    
    for (let i = 0; i < agentTests.length; i++) {
      const agentType = agentTests[i];
      console.log(`\n🤖 TESTING AGENT TYPE: ${agentType}`);
      
      // Go back to workspace list to reset state
      if (i > 0) {
        await page.goto('http://localhost:3001');
        await new Promise(resolve => setTimeout(resolve, 2000));
        await selectWorkspace(page, { index: 0 });
      }
      
      console.log(`Attempting to deploy: ${agentType}`);
      const deployResult = await deployAgent(page, { agentType, timeout: 5000 });
      
      if (deployResult.success) {
        console.log(`✅ ${agentType}: Deployed successfully (${deployResult.duration}ms)`);
        await takeScreenshot(page, { name: `agent-types-0${i+2}-${agentType}-success` });
        
        // Try to submit text
        const textResult = await submitTextToAgent(page, { 
          text: `Hello ${agentType}! Can you respond?`,
          timeout: 3000
        });
        
        if (textResult.success) {
          console.log(`✅ ${agentType}: Text submission worked`);
        } else {
          console.log(`⚠️ ${agentType}: Text submission failed - ${textResult.error}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } else {
        console.log(`❌ ${agentType}: Deployment failed - ${deployResult.error}`);
        await takeScreenshot(page, { name: `agent-types-0${i+2}-${agentType}-failed` });
      }
    }
    
    console.log('\n📊 Agent Type Test Complete');
    console.log('⏱️ Keeping browser open for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    await takeScreenshot(page, { name: 'agent-types-final' });
    
  } catch (error) {
    console.error('❌ Agent types test failed:', error);
    await takeScreenshot(page, { name: 'agent-types-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  walkthroughAgentTypes().catch(console.error);
}

module.exports = walkthroughAgentTypes;