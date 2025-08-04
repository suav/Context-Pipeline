#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgentImproved = require('./agent/deploy-agent-improved');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function diagnoseAgentBehavior() {
  console.log('🔍 DIAGNOSIS: What Actually Happens After Text Submission');
  console.log('========================================================');
  console.log('Detailed investigation of agent behavior and UI changes.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('🔍 SETUP: Basic workflow');
    await navigateToApp(page);
    await selectWorkspace(page, { index: 0 });
    await deployAgentImproved(page, { agentType: 'dev-assistant' });
    await takeScreenshot(page, { name: 'diagnose-01-ready' });
    
    console.log('\n🔍 BEFORE TEXT SUBMISSION: Capture DOM state');
    const beforeState = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.textContent.substring(0, 200),
        inputFields: document.querySelectorAll('input').length,
        buttons: document.querySelectorAll('button').length,
        terminalElements: document.querySelectorAll('[class*="terminal"], [class*="chat"]').length,
        hasAgentInterface: document.body.textContent.includes('Type your command') || 
                         document.body.textContent.includes('agent') ||
                         document.body.textContent.includes('Assistant')
      };
    });
    
    console.log('📊 Before state:', JSON.stringify(beforeState, null, 2));
    
    console.log('\n🔍 SUBMIT TEXT');
    await submitTextToAgent(page, { 
      text: 'Hello agent! Please respond with "I am working" if you can see this.',
      timeout: 5000
    });
    await takeScreenshot(page, { name: 'diagnose-02-after-submit' });
    
    console.log('\n🔍 IMMEDIATELY AFTER SUBMISSION: Check for changes');
    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const currentState = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          bodyText: document.body.textContent.substring(0, 500),
          inputValue: document.querySelector('input')?.value || 'no input',
          terminalContent: Array.from(document.querySelectorAll('[class*="terminal"], [class*="chat"], .terminal')).map(el => el.textContent?.substring(0, 100)).join(' | '),
          loadingIndicators: document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="wait"]').length
        };
      });
      
      console.log(`\n📊 State at ${(i + 1) * 2}s:`);
      console.log(`URL: ${currentState.url}`);
      console.log(`Title: ${currentState.title}`);
      console.log(`Input value: ${currentState.inputValue}`);
      console.log(`Terminal content: ${currentState.terminalContent.substring(0, 150)}...`);
      console.log(`Loading indicators: ${currentState.loadingIndicators}`);
      
      await takeScreenshot(page, { name: `diagnose-03-state-${(i + 1) * 2}s` });
      
      // Check if URL changed (indicating navigation)
      if (currentState.url !== beforeState.url) {
        console.log('🚨 URL CHANGED! Navigation detected.');
        break;
      }
    }
    
    console.log('\n🔍 FINAL DIAGNOSIS: Complete DOM analysis');
    const finalAnalysis = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const elementAnalysis = {
        totalElements: allElements.length,
        hasTerminal: !!document.querySelector('[class*="terminal"]'),
        hasChat: !!document.querySelector('[class*="chat"]'),
        hasInput: !!document.querySelector('input'),
        hasAgent: document.body.textContent.toLowerCase().includes('assistant'),
        visibleText: document.body.textContent.length,
        urls: Array.from(document.querySelectorAll('a')).map(a => a.href).slice(0, 5)
      };
      
      // Get all text content from potential response areas
      const responseAreas = document.querySelectorAll('div, p, span, pre, code');
      const recentText = Array.from(responseAreas)
        .map(el => el.textContent)
        .filter(text => text && text.length > 10)
        .slice(-5);
      
      return {
        ...elementAnalysis,
        recentText
      };
    });
    
    console.log('📊 Final analysis:', JSON.stringify(finalAnalysis, null, 2));
    
    console.log('\n⏰ Manual inspection time (30 seconds)');
    console.log('Watch for any delayed responses or UI changes...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    await takeScreenshot(page, { name: 'diagnose-04-final' });
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
    await takeScreenshot(page, { name: 'diagnose-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  diagnoseAgentBehavior().catch(console.error);
}

module.exports = diagnoseAgentBehavior;