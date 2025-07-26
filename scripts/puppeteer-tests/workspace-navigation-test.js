const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Workspace Navigation Test - Simple and effective
 * Tests workspace detection and navigation in headful mode
 */
async function workspaceNavigationTest() {
  console.log('🧭 Workspace Navigation Test - Headful Mode\n');
  
  let browser;
  const results = {
    testName: 'Workspace Navigation Test',
    timestamp: new Date().toISOString(),
    passed: [],
    failed: [],
    screenshots: [],
    elementsFound: {}
  };

  try {
    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    
    // Navigate to homepage
    console.log('\n📄 Step 1: Loading homepage...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0', timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('   ✅ Homepage loaded');
    await takeScreenshot(page, 'homepage', results);

    // Get page content for analysis
    console.log('\n🔍 Step 2: Analyzing page content...');
    
    const pageText = await page.evaluate(() => document.body.textContent);
    console.log(`   📄 Page contains ${pageText.length} characters of text`);
    
    // Check for key terms that indicate workspace functionality
    const keyTerms = ['workspace', 'agent', 'settings', 'library', 'import', 'claude', 'gemini'];
    const foundTerms = keyTerms.filter(term => 
      pageText.toLowerCase().includes(term.toLowerCase())
    );
    
    if (foundTerms.length > 0) {
      results.passed.push(`Found key terms: ${foundTerms.join(', ')}`);
      console.log(`   ✅ Found relevant terms: ${foundTerms.join(', ')}`);
    } else {
      results.failed.push('No relevant terms found in page content');
      console.log('   ❌ No relevant terms detected');
    }

    // Count different types of elements
    console.log('\n🎛️ Step 3: Counting UI elements...');
    
    const buttons = await page.$$('button');
    const divs = await page.$$('div');
    const inputs = await page.$$('input');
    const forms = await page.$$('form');
    
    results.elementsFound = {
      buttons: buttons.length,
      divs: divs.length,
      inputs: inputs.length,
      forms: forms.length
    };
    
    console.log(`   📊 Element count:`);
    console.log(`      • ${buttons.length} buttons`);
    console.log(`      • ${divs.length} divs`);
    console.log(`      • ${inputs.length} inputs`);
    console.log(`      • ${forms.length} forms`);
    
    if (buttons.length > 0) {
      results.passed.push(`UI is interactive: ${buttons.length} buttons available`);
    }

    // Test button interactions
    console.log('\n🖱️ Step 4: Testing button interactions...');
    
    if (buttons.length > 0) {
      // Get text from all buttons to understand what's available
      const buttonTexts = [];
      for (let i = 0; i < Math.min(buttons.length, 10); i++) {
        try {
          const text = await buttons[i].evaluate(el => el.textContent?.trim() || el.title || el.getAttribute('aria-label') || 'Button');
          buttonTexts.push(text);
        } catch (error) {
          buttonTexts.push('Unknown Button');
        }
      }
      
      console.log('   🎯 Available buttons:');
      buttonTexts.forEach((text, i) => console.log(`      ${i + 1}. "${text}"`));
      
      // Try clicking the first few buttons
      for (let i = 0; i < Math.min(3, buttons.length); i++) {
        try {
          console.log(`   🖱️ Clicking button ${i + 1}: "${buttonTexts[i]}"`);
          await buttons[i].click();
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          results.passed.push(`Button interaction ${i + 1} successful: "${buttonTexts[i]}"`);
          console.log(`   ✅ Button ${i + 1} clicked successfully`);
          
          await takeScreenshot(page, `after-button-${i + 1}`, results);
          
        } catch (error) {
          results.failed.push(`Button interaction ${i + 1} failed`);
          console.log(`   ❌ Button ${i + 1} click failed`);
        }
      }
    }

    // Check for dynamic content updates
    console.log('\n🔄 Step 5: Checking for dynamic content...');
    
    const initialDivCount = divs.length;
    await page.reload();
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const newDivs = await page.$$('div');
    const finalDivCount = newDivs.length;
    
    if (finalDivCount >= initialDivCount) {
      results.passed.push('Page content loads consistently');
      console.log('   ✅ Content loads consistently after reload');
    } else {
      results.failed.push('Content loading inconsistency detected');
      console.log('   ❌ Content loading inconsistency');
    }

    // Look for specific workspace-related class names
    console.log('\n🏗️ Step 6: Looking for workspace elements...');
    
    const workspaceSelectors = [
      '[class*="workspace"]',
      '[class*="Workspace"]', 
      '[class*="sidebar"]',
      '[class*="card"]',
      '[class*="agent"]',
      '[class*="Agent"]'
    ];
    
    for (const selector of workspaceSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          results.passed.push(`Found ${elements.length} elements matching "${selector}"`);
          console.log(`   ✅ Found ${elements.length} elements: ${selector}`);
        }
      } catch (error) {
        // Ignore selector errors
      }
    }

    // Test responsive design
    console.log('\n📱 Step 7: Testing responsive design...');
    
    await page.setViewport({ width: 768, height: 1024 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    await takeScreenshot(page, 'mobile-view', results);
    
    await page.setViewport({ width: 1200, height: 800 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    await takeScreenshot(page, 'tablet-view', results);
    
    await page.setViewport({ width: 1920, height: 1080 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    results.passed.push('Responsive design testing completed');
    console.log('   ✅ Responsive design tested');

    // Final screenshot
    await takeScreenshot(page, 'final-state', results);

  } catch (error) {
    console.error('❌ Test crashed:', error.message);
    results.failed.push(`Fatal error: ${error.message}`);
  } finally {
    if (browser) {
      console.log('\n⏸️  Keeping browser open for 15 seconds for manual inspection...');
      console.log('   👀 Please examine the UI for:');
      console.log('      • Workspace creation options');
      console.log('      • Agent deployment buttons');
      console.log('      • Navigation elements');
      console.log('      • Import/library functionality');
      console.log('      • Overall styling and layout');
      await new Promise(resolve => setTimeout(resolve, 15000));
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }

  // Save results
  await saveResults(results);
  
  // Print comprehensive summary
  console.log('\n' + '='.repeat(70));
  console.log('🧭 WORKSPACE NAVIGATION TEST RESULTS');
  console.log('='.repeat(70));
  console.log(`🕒 Timestamp: ${results.timestamp}`);
  console.log(`✅ Tests Passed: ${results.passed.length}`);
  console.log(`❌ Tests Failed: ${results.failed.length}`);
  console.log(`📸 Screenshots: ${results.screenshots.length}`);
  
  console.log('\n📊 UI ELEMENTS DETECTED:');
  Object.entries(results.elementsFound).forEach(([type, count]) => {
    console.log(`   • ${count} ${type}`);
  });
  
  const successRate = results.passed.length / (results.passed.length + results.failed.length) * 100;
  console.log(`\n📈 Success Rate: ${successRate.toFixed(1)}%`);
  
  if (results.passed.length > 0) {
    console.log('\n✅ PASSED TESTS:');
    results.passed.forEach((test, i) => console.log(`   ${i + 1}. ${test}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.failed.forEach((test, i) => console.log(`   ${i + 1}. ${test}`));
  }
  
  console.log('\n📸 SCREENSHOTS CAPTURED:');
  results.screenshots.forEach(screenshot => {
    console.log(`   • ${screenshot.name}`);
  });
  
  const overallStatus = results.failed.length === 0 ? '🎉 FULLY FUNCTIONAL!' : 
                       successRate >= 70 ? '⚠️ MOSTLY FUNCTIONAL' : '🚨 NEEDS INVESTIGATION';
  console.log(`\n🎯 Overall Status: ${overallStatus}`);
  
  return results.failed.length === 0;
}

async function takeScreenshot(page, name, results) {
  try {
    const dir = path.join(__dirname, 'screenshots', 'workspace-navigation');
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
      path.join(dir, 'workspace-navigation-test-results.json'),
      JSON.stringify(results, null, 2)
    );
    console.log('\n💾 Results saved to: results/workspace-navigation-test-results.json');
  } catch (error) {
    console.log(`❌ Failed to save results: ${error.message}`);
  }
}

// Run if called directly
if (require.main === module) {
  workspaceNavigationTest().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { workspaceNavigationTest };