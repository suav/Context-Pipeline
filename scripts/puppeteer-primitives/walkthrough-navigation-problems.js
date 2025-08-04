#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgent = require('./agent/deploy-agent');
const submitTextToAgent = require('./agent/submit-text-to-agent');
const navigateAway = require('./navigation/navigate-away');
const navigateBack = require('./navigation/navigate-back');

async function walkthroughNavigationProblems() {
  console.log('🚨 WALKTHROUGH: Navigation Problems Test');
  console.log('=======================================');
  console.log('Testing the problematic navigation primitives to show what fails.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('🚨 SETUP: Get into a workspace with an agent');
    await navigateToApp(page);
    await selectWorkspace(page, { index: 0 });
    await deployAgent(page, { agentType: 'dev-assistant' });
    await submitTextToAgent(page, { text: 'I am testing navigation. Remember this message.' });
    await takeScreenshot(page, { name: 'nav-problem-01-setup' });
    
    console.log('\n🚨 PROBLEM TEST 1: Navigate Away (Expected to FAIL)');
    console.log('Watch what happens when we try to navigate away...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const awayResult = await navigateAway(page, { target: 'home', timeout: 5000 });
    console.log(`Result: ${awayResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (!awayResult.success) {
      console.log(`Error: ${awayResult.error}`);
    }
    await takeScreenshot(page, { name: 'nav-problem-02-navigate-away-attempt' });
    
    console.log('\n🚨 PROBLEM TEST 2: Navigate Back');
    console.log('Watch what navigate back does...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const backResult = await navigateBack(page);
    console.log(`Result: ${backResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (!backResult.success) {
      console.log(`Error: ${backResult.error}`);
    }
    await takeScreenshot(page, { name: 'nav-problem-03-navigate-back-attempt' });
    
    console.log('\n🚨 WORKAROUND: Direct Navigation');
    console.log('Showing how direct page.goto() works as alternative...');
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await takeScreenshot(page, { name: 'nav-problem-04-direct-navigation' });
    
    console.log('\n🚨 Return to workspace to test memory');
    await selectWorkspace(page, { index: 0 });
    await submitTextToAgent(page, { text: 'Do you remember my earlier message about testing navigation?' });
    await takeScreenshot(page, { name: 'nav-problem-05-memory-test' });
    
    console.log('\n⏱️ Keeping open for 15 seconds to see results...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    await takeScreenshot(page, { name: 'nav-problem-06-final' });
    
  } catch (error) {
    console.error('❌ Navigation problems test failed:', error);
    await takeScreenshot(page, { name: 'nav-problem-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  walkthroughNavigationProblems().catch(console.error);
}

module.exports = walkthroughNavigationProblems;