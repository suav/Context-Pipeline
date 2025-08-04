#!/usr/bin/env node

/**
 * Example: Simple Composite Test Using Primitives
 * 
 * Demonstrates how easy it is to build tests by composing primitives
 */

const puppeteer = require('puppeteer');

// Import primitives
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgent = require('./agent/deploy-agent');
const submitTextToAgent = require('./agent/submit-text-to-agent');
const checkFileModified = require('./file/check-file-modified');

async function runExample() {
  console.log('🎯 Primitive Actions Example');
  console.log('===========================');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  
  try {
    // Simple workflow: Navigate → Select → Deploy → Test
    await navigateToApp(page);
    await takeScreenshot(page, { name: 'example-01-loaded' });
    
    await selectWorkspace(page, { index: 0 });
    await takeScreenshot(page, { name: 'example-02-workspace' });
    
    await deployAgent(page, { agentType: 'dev-assistant' });
    await takeScreenshot(page, { name: 'example-03-agent' });
    
    await submitTextToAgent(page, { 
      text: 'Hello! Can you see the files in this workspace?'
    });
    await takeScreenshot(page, { name: 'example-04-message' });
    
    await checkFileModified(page, { filename: 'README.md' });
    await takeScreenshot(page, { name: 'example-05-final' });
    
    console.log('✅ Example completed! Check screenshots folder.');
    
  } catch (error) {
    console.error('❌ Example failed:', error.message);
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

if (require.main === module) {
  runExample().catch(console.error);
}

module.exports = runExample;