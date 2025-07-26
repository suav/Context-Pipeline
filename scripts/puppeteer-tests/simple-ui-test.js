const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Simple UI Test - Compatible with all Puppeteer versions
 * Tests basic UI functionality in headful mode
 */
async function simpleUITest() {
  console.log('🎯 Simple UI Test - Headful Mode\n');
  
  let browser;
  const results = {
    testName: 'Simple UI Test',
    timestamp: new Date().toISOString(),
    passed: [],
    failed: [],
    screenshots: []
  };

  try {
    // Launch browser in headful mode with system Chromium
    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080',
        '--disable-web-security'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    console.log('✅ Browser launched successfully');
    
    // Test 1: Homepage loads
    console.log('\n📄 Test 1: Homepage Loading...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0', timeout: 10000 });
    
    // Use setTimeout instead of page.waitForTimeout for compatibility
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for React root
    const hasReactApp = await page.$('#__next');
    if (hasReactApp) {
      results.passed.push('React app loaded successfully');
      console.log('   ✅ React app found in DOM');
    } else {
      results.failed.push('React app not found');
      console.log('   ❌ React app not found');
    }

    // Test 2: Page title
    console.log('\n📄 Test 2: Page Title...');
    const pageTitle = await page.title();
    if (pageTitle && pageTitle.length > 0) {
      results.passed.push(`Page title: "${pageTitle}"`);
      console.log(`   ✅ Page title: "${pageTitle}"`);
    } else {
      results.failed.push('No page title found');
      console.log('   ❌ No page title');
    }

    // Test 3: Interactive elements
    console.log('\n🎛️ Test 3: Interactive Elements...');
    const buttons = await page.$$('button');
    const inputs = await page.$$('input');
    const links = await page.$$('a');
    
    const interactiveCount = buttons.length + inputs.length + links.length;
    if (interactiveCount > 0) {
      results.passed.push(`Found ${interactiveCount} interactive elements (${buttons.length} buttons, ${inputs.length} inputs, ${links.length} links)`);
      console.log(`   ✅ Found ${interactiveCount} interactive elements`);
      console.log(`      • ${buttons.length} buttons`);
      console.log(`      • ${inputs.length} inputs`);
      console.log(`      • ${links.length} links`);
    } else {
      results.failed.push('No interactive elements found');
      console.log('   ❌ No interactive elements found');
    }

    // Test 4: Styling check
    console.log('\n🎨 Test 4: CSS Styling...');
    const hasStyles = await page.evaluate(() => {
      const body = document.body;
      const styles = window.getComputedStyle(body);
      return styles.backgroundColor !== 'rgba(0, 0, 0, 0)' || styles.color !== 'rgba(0, 0, 0, 0)';
    });
    
    if (hasStyles) {
      results.passed.push('CSS styling is active');
      console.log('   ✅ CSS styling detected');
    } else {
      results.failed.push('No CSS styling detected');
      console.log('   ❌ No CSS styling');
    }

    // Test 5: Button interaction
    console.log('\n🖱️ Test 5: Button Interaction...');
    if (buttons.length > 0) {
      try {
        const firstButton = buttons[0];
        const buttonText = await firstButton.evaluate(el => el.textContent);
        console.log(`   🎯 Testing button: "${buttonText}"`);
        
        await firstButton.click();
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        results.passed.push(`Button interaction successful: "${buttonText}"`);
        console.log('   ✅ Button click successful');
      } catch (error) {
        results.failed.push('Button interaction failed');
        console.log('   ❌ Button interaction failed');
      }
    }

    // Take screenshots
    console.log('\n📸 Capturing screenshots...');
    await takeScreenshot(page, 'homepage', results);
    console.log('   📸 Homepage screenshot captured');
    
    // Test mobile view
    await page.setViewport({ width: 768, height: 1024 });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await takeScreenshot(page, 'mobile-view', results);
    console.log('   📸 Mobile view screenshot captured');
    
    // Reset to desktop
    await page.setViewport({ width: 1920, height: 1080 });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 6: Console errors
    console.log('\n🐛 Test 6: Console Errors...');
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Reload to catch any errors
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (consoleErrors.length === 0) {
      results.passed.push('No console errors detected');
      console.log('   ✅ Clean console');
    } else {
      results.failed.push(`${consoleErrors.length} console errors found`);
      console.log(`   ❌ Found ${consoleErrors.length} console errors`);
      consoleErrors.forEach(error => console.log(`      • ${error}`));
    }

    await takeScreenshot(page, 'final-state', results);
    console.log('   📸 Final screenshot captured');

  } catch (error) {
    console.error('❌ Test crashed:', error.message);
    results.failed.push(`Fatal error: ${error.message}`);
  } finally {
    if (browser) {
      console.log('\n⏸️  Keeping browser open for 10 seconds for visual inspection...');
      console.log('   👀 Please review the UI manually in the browser window');
      await new Promise(resolve => setTimeout(resolve, 10000));
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }

  // Save results
  await saveResults(results);
  
  // Print comprehensive summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SIMPLE UI TEST RESULTS');
  console.log('='.repeat(70));
  console.log(`🕒 Timestamp: ${results.timestamp}`);
  console.log(`✅ Tests Passed: ${results.passed.length}`);
  console.log(`❌ Tests Failed: ${results.failed.length}`);
  console.log(`📸 Screenshots: ${results.screenshots.length}`);
  
  const successRate = results.passed.length / (results.passed.length + results.failed.length) * 100;
  console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);
  
  if (results.passed.length > 0) {
    console.log('\n✅ PASSED TESTS:');
    results.passed.forEach((test, i) => console.log(`   ${i + 1}. ${test}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.failed.forEach((test, i) => console.log(`   ${i + 1}. ${test}`));
  }
  
  if (results.screenshots.length > 0) {
    console.log('\n📸 SCREENSHOTS CAPTURED:');
    results.screenshots.forEach(screenshot => {
      console.log(`   • ${screenshot.name}: ${screenshot.path}`);
    });
  }
  
  const overallStatus = results.failed.length === 0 ? '🎉 ALL TESTS PASSED!' : 
                       successRate >= 70 ? '⚠️ MOSTLY FUNCTIONAL' : '🚨 SIGNIFICANT ISSUES';
  console.log(`\n🎯 Overall Status: ${overallStatus}`);
  
  return results.failed.length === 0;
}

async function takeScreenshot(page, name, results) {
  try {
    const dir = path.join(__dirname, 'screenshots', 'simple-ui');
    await fs.mkdir(dir, { recursive: true });
    const filepath = path.join(dir, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    results.screenshots.push({ name, path: filepath });
  } catch (error) {
    console.log(`   ❌ Screenshot failed: ${error.message}`);
  }
}

async function saveResults(results) {
  try {
    const dir = path.join(__dirname, 'results');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'simple-ui-test-results.json'),
      JSON.stringify(results, null, 2)
    );
    console.log('\n💾 Results saved to: results/simple-ui-test-results.json');
  } catch (error) {
    console.log(`❌ Failed to save results: ${error.message}`);
  }
}

// Run if called directly
if (require.main === module) {
  simpleUITest().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { simpleUITest };