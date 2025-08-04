#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgent = require('./agent/deploy-agent');
const submitTextToAgent = require('./agent/submit-text-to-agent');
const navigateAway = require('./navigation/navigate-away');
const navigateBack = require('./navigation/navigate-back');

async function testComprehensivePrimitives() {
  console.log('🧪 Comprehensive Puppeteer Primitives Test');
  console.log('==========================================');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  const results = {
    timestamp: new Date().toISOString(),
    tests: {},
    summary: { passed: 0, failed: 0, total: 0 }
  };
  
  const testPrimitive = async (name, testFn) => {
    console.log(`\n🧪 Testing: ${name}`);
    results.summary.total++;
    try {
      const result = await testFn();
      if (result.success) {
        console.log(`✅ ${name}: SUCCESS (${result.duration}ms)`);
        results.tests[name] = { status: 'PASS', ...result };
        results.summary.passed++;
      } else {
        console.log(`❌ ${name}: FAILED - ${result.error}`);
        results.tests[name] = { status: 'FAIL', ...result };
        results.summary.failed++;
      }
    } catch (error) {
      console.log(`💥 ${name}: ERROR - ${error.message}`);
      results.tests[name] = { status: 'ERROR', error: error.message };
      results.summary.failed++;
    }
  };
  
  try {
    // Test 1: Navigation
    await testPrimitive('navigate-to-app', () => navigateToApp(page));
    await takeScreenshot(page, { name: 'comp-01-navigation' });
    
    // Test 2: Workspace Selection  
    await testPrimitive('select-workspace', () => selectWorkspace(page, { index: 0 }));
    await takeScreenshot(page, { name: 'comp-02-workspace' });
    
    // Test 3: Agent Deployment
    await testPrimitive('deploy-agent-dev', () => deployAgent(page, { agentType: 'dev-assistant' }));
    await takeScreenshot(page, { name: 'comp-03-agent-dev' });
    
    // Test 4: Text Submission
    await testPrimitive('submit-text-basic', () => 
      submitTextToAgent(page, { text: 'Hello! Please list the files in this workspace.', timeout: 5000 })
    );
    await takeScreenshot(page, { name: 'comp-04-text-basic' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 5: Navigate Away (Known to fail)
    await testPrimitive('navigate-away', () => navigateAway(page, { target: 'home', timeout: 3000 }));
    await takeScreenshot(page, { name: 'comp-05-navigate-away' });
    
    // Test 6: Navigate Back
    await testPrimitive('navigate-back', () => navigateBack(page));
    await takeScreenshot(page, { name: 'comp-06-navigate-back' });
    
    // Test 7: Different Agent Type
    await testPrimitive('deploy-agent-reviewer', () => deployAgent(page, { agentType: 'code-reviewer' }));
    await takeScreenshot(page, { name: 'comp-07-agent-reviewer' });
    
    // Test 8: Complex Text Submission
    await testPrimitive('submit-text-complex', () => 
      submitTextToAgent(page, { 
        text: 'Can you analyze the project structure and identify the main components? What framework is being used?',
        timeout: 8000
      })
    );
    await takeScreenshot(page, { name: 'comp-08-text-complex' });
    
    // Test 9: Workspace Selection by Name (if available)
    await testPrimitive('select-workspace-alt', async () => {
      // First go back to workspace list
      await page.goto('http://localhost:3001');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await selectWorkspace(page, { index: 1 }); // Try second workspace
    });
    await takeScreenshot(page, { name: 'comp-09-workspace-alt' });
    
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    console.log(`✅ Passed: ${results.summary.passed}/${results.summary.total}`);
    console.log(`❌ Failed: ${results.summary.failed}/${results.summary.total}`);
    console.log(`📈 Success Rate: ${Math.round((results.summary.passed / results.summary.total) * 100)}%`);
    
    console.log('\n📋 Detailed Results:');
    Object.entries(results.tests).forEach(([test, result]) => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '💥';
      const time = result.duration ? `(${result.duration}ms)` : '';
      console.log(`${icon} ${test}: ${result.status} ${time}`);
      if (result.error) console.log(`   └─ ${result.error}`);
    });
    
    // Save results
    const fs = require('fs');
    fs.writeFileSync('./comprehensive-primitive-test-results.json', JSON.stringify(results, null, 2));
    console.log('\n💾 Results saved to: comprehensive-primitive-test-results.json');
    
    console.log('\n🔍 Keeping browser open for inspection (15 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    await takeScreenshot(page, { name: 'comp-error' });
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  testComprehensivePrimitives().catch(console.error);
}

module.exports = testComprehensivePrimitives;