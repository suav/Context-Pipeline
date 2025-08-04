#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');

async function investigateDeployPopup() {
  console.log('🔍 INVESTIGATION: Deploy Button Popup Behavior');
  console.log('=============================================');
  console.log('Testing what happens when we click the "🚀 Deploy to Main" button.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  
  // Listen for dialogs/popups
  page.on('dialog', async dialog => {
    console.log(`🚨 DIALOG DETECTED: ${dialog.type()}`);
    console.log(`Message: "${dialog.message()}"`);
    console.log(`Default value: "${dialog.defaultValue()}"`);
    
    // Take screenshot before handling dialog
    await takeScreenshot(page, { name: 'popup-dialog-detected' });
    
    // Accept the dialog to continue
    await dialog.accept();
    console.log('✅ Dialog accepted');
  });
  
  try {
    console.log('🔍 SETUP: Navigate to workspace');
    await navigateToApp(page);
    await selectWorkspace(page, { index: 0 });
    await takeScreenshot(page, { name: 'popup-01-workspace-loaded' });
    
    console.log('\n🔍 DISCOVERY: Find all buttons');
    const buttons = await page.evaluate(() => {
      const allButtons = document.querySelectorAll('button');
      return Array.from(allButtons).map((btn, index) => ({
        index,
        text: btn.textContent.trim(),
        classes: btn.className,
        visible: btn.offsetParent !== null
      }));
    });
    
    console.log('📋 All buttons found:');
    buttons.forEach((btn, i) => {
      if (btn.visible) {
        console.log(`${i + 1}. "${btn.text}"`);
      }
    });
    
    console.log('\n🔍 TEST: Click "🚀 Deploy to Main" button specifically');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const deployClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (let btn of buttons) {
        if (btn.textContent.includes('Deploy to Main') && btn.offsetParent !== null) {
          console.log('Found Deploy to Main button, clicking...');
          btn.click();
          return true;
        }
      }
      return false;
    });
    
    if (deployClicked) {
      console.log('✅ Clicked "🚀 Deploy to Main" button');
      await takeScreenshot(page, { name: 'popup-02-after-deploy-click' });
      
      console.log('\n⏳ Waiting to see what happens (10 seconds)...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      await takeScreenshot(page, { name: 'popup-03-10s-after-click' });
      
      // Check for modals or overlays
      const hasModal = await page.evaluate(() => {
        const modals = document.querySelectorAll('[role="dialog"], .modal, [class*="modal"], [class*="overlay"], [class*="popup"]');
        return modals.length > 0;
      });
      
      console.log(`Modal detected: ${hasModal}`);
      
      if (hasModal) {
        console.log('🔍 Found modal/dialog elements');
        const modalInfo = await page.evaluate(() => {
          const modals = document.querySelectorAll('[role="dialog"], .modal, [class*="modal"], [class*="overlay"], [class*="popup"]');
          return Array.from(modals).map(modal => ({
            tagName: modal.tagName,
            className: modal.className,
            textContent: modal.textContent.substring(0, 100),
            visible: modal.offsetParent !== null
          }));
        });
        console.log('Modal info:', modalInfo);
      }
      
    } else {
      console.log('❌ Could not find "🚀 Deploy to Main" button');
    }
    
    console.log('\n🔍 Now test agent buttons (non-deploy)');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const agentClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (let btn of buttons) {
        if (btn.textContent.includes('Dev Assistant') && btn.offsetParent !== null) {
          console.log('Found Dev Assistant button, clicking...');
          btn.click();
          return true;
        }
      }
      return false;
    });
    
    if (agentClicked) {
      console.log('✅ Clicked "Dev Assistant" button');
      await takeScreenshot(page, { name: 'popup-04-dev-assistant-click' });
      await new Promise(resolve => setTimeout(resolve, 5000));
      await takeScreenshot(page, { name: 'popup-05-dev-assistant-result' });
    }
    
    console.log('\n⏰ Keeping browser open for 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('❌ Deploy popup investigation failed:', error);
    await takeScreenshot(page, { name: 'popup-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  investigateDeployPopup().catch(console.error);
}

module.exports = investigateDeployPopup;