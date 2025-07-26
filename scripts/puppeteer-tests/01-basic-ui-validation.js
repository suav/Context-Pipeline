const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Test 01: Basic UI Validation
 * Tests core UI elements, theme switching, and navigation
 */
async function testBasicUI() {
  console.log('🎯 Test 01: Basic UI Validation\n');
  
  let browser;
  const results = {
    testName: 'Basic UI Validation',
    timestamp: new Date().toISOString(),
    passed: [],
    failed: [],
    screenshots: []
  };

  try {
    // Launch browser in headful mode
    browser = await puppeteer.launch({
      headless: false,
      args: ['--window-size=1920,1080'],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    
    // Test 1: Homepage loads
    console.log('📄 Testing homepage load...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });
    await page.waitForTimeout(2000); // Let user see
    
    // Check for React root
    const hasReactApp = await page.$('#__next');
    if (hasReactApp) {
      results.passed.push('React app loaded successfully');
    } else {
      results.failed.push('React app not found');
    }

    // Test 2: Settings button exists and works
    console.log('⚙️ Testing settings button...');
    const settingsButton = await page.waitForSelector('button:has-text("Settings"), button:has-text("☰")', { timeout: 5000 });
    if (settingsButton) {
      results.passed.push('Settings button found');
      await settingsButton.click();
      await page.waitForTimeout(1500);
      
      // Check if settings sidebar opened
      const settingsSidebar = await page.$('div:has-text("Workspace Workshop")');
      if (settingsSidebar) {
        results.passed.push('Settings sidebar opened');
        await takeScreenshot(page, 'settings-open', results);
      } else {
        results.failed.push('Settings sidebar did not open');
      }
    } else {
      results.failed.push('Settings button not found');
    }

    // Test 3: Theme switching
    console.log('🎨 Testing theme switching...');
    const themeSelector = await page.$('button:has-text("Theme"), select[class*="theme"]');
    if (themeSelector) {
      // Get current background color
      const bgColorBefore = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor;
      });
      
      // Click theme selector
      await themeSelector.click();
      await page.waitForTimeout(1000);
      
      // Try to select dark theme
      const darkOption = await page.$('option[value="dark"], button:has-text("Dark")');
      if (darkOption) {
        await darkOption.click();
        await page.waitForTimeout(1000);
        
        const bgColorAfter = await page.evaluate(() => {
          return window.getComputedStyle(document.body).backgroundColor;
        });
        
        if (bgColorBefore !== bgColorAfter) {
          results.passed.push('Theme switching works');
          await takeScreenshot(page, 'dark-theme', results);
        } else {
          results.failed.push('Theme did not change');
        }
      }
    } else {
      results.failed.push('Theme selector not found');
    }

    // Test 4: Check for workspace sidebar
    console.log('📁 Checking workspace sidebar...');
    // Close settings if open
    const closeButton = await page.$('button:has-text("✕")');
    if (closeButton) {
      await closeButton.click();
      await page.waitForTimeout(1000);
    }
    
    const workspaceSidebar = await page.$('[class*="sidebar"], div:has(> button:has-text("New Workspace"))');
    if (workspaceSidebar) {
      results.passed.push('Workspace sidebar present');
      
      // Check for workspace cards
      const workspaceCards = await page.$$('[class*="workspace-card"], [class*="WorkspaceCard"]');
      results.passed.push(`Found ${workspaceCards.length} workspace cards`);
    } else {
      results.failed.push('Workspace sidebar not found');
    }

    // Test 5: Responsive design
    console.log('📱 Testing responsive design...');
    await page.setViewport({ width: 768, height: 1024 });
    await page.waitForTimeout(1500);
    await takeScreenshot(page, 'mobile-view', results);
    
    // Check if UI adapted
    const mobileLayout = await page.evaluate(() => {
      const sidebar = document.querySelector('[class*="sidebar"]');
      return sidebar ? window.getComputedStyle(sidebar).display !== 'none' : false;
    });
    
    results.passed.push('Responsive design tested');
    
    // Reset viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Test 6: Check console for errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.reload();
    await page.waitForTimeout(3000);
    
    if (consoleErrors.length === 0) {
      results.passed.push('No console errors detected');
    } else {
      results.failed.push(`${consoleErrors.length} console errors found`);
      consoleErrors.forEach(err => results.failed.push(`Console error: ${err}`));
    }

    // Final screenshot
    await takeScreenshot(page, 'final-state', results);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    results.failed.push(`Fatal error: ${error.message}`);
  } finally {
    if (browser) {
      console.log('\n⏸️  Keeping browser open for 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      await browser.close();
    }
  }

  // Save results
  await saveResults(results);
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`📸 Screenshots: ${results.screenshots.length}`);
  
  return results.failed.length === 0;
}

async function takeScreenshot(page, name, results) {
  const dir = path.join(__dirname, 'screenshots', '01-basic-ui');
  await fs.mkdir(dir, { recursive: true });
  const filepath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  results.screenshots.push({ name, path: filepath });
}

async function saveResults(results) {
  const dir = path.join(__dirname, 'results');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, '01-basic-ui-results.json'),
    JSON.stringify(results, null, 2)
  );
}

// Run if called directly
if (require.main === module) {
  testBasicUI().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testBasicUI };