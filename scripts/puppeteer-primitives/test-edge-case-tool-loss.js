#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgentImproved = require('./agent/deploy-agent-improved');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function testEdgeCaseToolLoss() {
  console.log('🔍 EDGE CASE TEST: Specific Scenarios That Might Cause Tool Loss');
  console.log('================================================================');
  console.log('Testing various edge cases that might trigger tool response loss.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  const edgeCaseData = {
    timestamp: new Date().toISOString(),
    testCases: []
  };
  
  try {
    // EDGE CASE 1: Navigate away during tool execution
    console.log('🔍 EDGE CASE 1: Navigate Away During Tool Execution');
    await navigateToApp(page);
    await selectWorkspace(page, { index: 0 });
    await deployAgentImproved(page, { agentType: 'dev-assistant' });
    
    // Start a long-running tool command
    const longRunningCommand = 'Please analyze every single file in this workspace in detail, including reading each file, understanding its purpose, and providing a comprehensive report on the entire codebase structure.';
    console.log('🔧 Starting long-running tool command...');
    await submitTextToAgent(page, { text: longRunningCommand, timeout: 5000 });
    
    // Wait just a bit, then navigate away while it's potentially still processing
    console.log('⏳ Waiting 8 seconds, then navigating away during processing...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Navigate away during processing
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await selectWorkspace(page, { index: 1 }); // Different workspace
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Come back to original workspace
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await selectWorkspace(page, { index: 0 });
    
    const interruptedState = await page.evaluate(() => {
      const allText = document.body.textContent;
      const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
      
      return {
        testCase: 'interrupted-processing',
        sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
        hasOriginalCommand: allText.includes('analyze every single file'),
        hasToolOutput: allText.includes('src/') || allText.includes('function') || allText.includes('import'),
        hasProcessingIndicator: allText.includes('Processing') || allText.includes('⏱️'),
        hasCompletedIndicator: allText.includes('Completed') || allText.includes('✅'),
        hasIncompleteResponse: allText.includes('..') || allText.includes('partial'),
        totalTextLength: allText.length,
        timestamp: Date.now()
      };
    });
    
    edgeCaseData.testCases.push(interruptedState);
    await takeScreenshot(page, { name: 'edge-case-01-interrupted-processing' });
    
    console.log(`📊 Interrupted Processing Results:`);
    console.log(`  Command visible: ${interruptedState.hasOriginalCommand}`);
    console.log(`  Tool output visible: ${interruptedState.hasToolOutput}`);
    console.log(`  Processing indicator: ${interruptedState.hasProcessingIndicator}`);
    console.log(`  Completed indicator: ${interruptedState.hasCompletedIndicator}`);
    
    // EDGE CASE 2: Multiple rapid tool commands
    console.log('\n🔍 EDGE CASE 2: Multiple Rapid Tool Commands');
    
    const rapidCommands = [
      'Show me the README file content',
      'List all JavaScript files',
      'Check git status',
      'Show package.json dependencies'
    ];
    
    for (let i = 0; i < rapidCommands.length; i++) {
      console.log(`🔧 Rapid command ${i + 1}: ${rapidCommands[i]}`);
      await submitTextToAgent(page, { text: rapidCommands[i], timeout: 3000 });
      // Very short wait between commands
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Wait for all to potentially complete
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Navigate away and back
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await selectWorkspace(page, { index: 0 });
    
    const rapidCommandsState = await page.evaluate(() => {
      const allText = document.body.textContent;
      const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
      
      return {
        testCase: 'rapid-commands',
        sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
        hasReadmeCommand: allText.includes('README file content'),
        hasListJsCommand: allText.includes('JavaScript files'),
        hasGitCommand: allText.includes('git status'),
        hasPackageCommand: allText.includes('package.json dependencies'),
        
        hasReadmeResponse: allText.includes('# ') || allText.includes('## '),
        hasJsListResponse: allText.includes('.js') || allText.includes('.ts'),
        hasGitResponse: allText.includes('modified:') || allText.includes('branch'),
        hasPackageResponse: allText.includes('"dependencies"') || allText.includes('"scripts"'),
        
        timestamp: Date.now()
      };
    });
    
    edgeCaseData.testCases.push(rapidCommandsState);
    await takeScreenshot(page, { name: 'edge-case-02-rapid-commands' });
    
    console.log(`📊 Rapid Commands Results:`);
    console.log(`  All commands visible: ${rapidCommandsState.hasReadmeCommand && rapidCommandsState.hasListJsCommand}`);
    console.log(`  All responses visible: ${rapidCommandsState.hasReadmeResponse || rapidCommandsState.hasJsListResponse}`);
    
    // EDGE CASE 3: Browser tab switching simulation
    console.log('\n🔍 EDGE CASE 3: Browser Tab Switching Simulation');
    
    // Create a new tab
    const newPage = await browser.newPage();
    await newPage.goto('https://www.google.com');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Switch back to original tab and submit command
    await page.bringToFront();
    const tabSwitchCommand = 'After tab switching, please list all TypeScript files and their purposes.';
    await submitTextToAgent(page, { text: tabSwitchCommand, timeout: 5000 });
    
    // Switch to other tab during processing
    await newPage.bringToFront();
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Switch back
    await page.bringToFront();
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Navigate away and back to test persistence
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await selectWorkspace(page, { index: 0 });
    
    const tabSwitchState = await page.evaluate(() => {
      const allText = document.body.textContent;
      const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
      
      return {
        testCase: 'tab-switching',
        sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
        hasTabSwitchCommand: allText.includes('After tab switching'),
        hasTypeScriptResponse: allText.includes('.ts') || allText.includes('TypeScript') || allText.includes('interface'),
        hasFileAnalysis: allText.includes('purpose') || allText.includes('contains'),
        timestamp: Date.now()
      };
    });
    
    edgeCaseData.testCases.push(tabSwitchState);
    await takeScreenshot(page, { name: 'edge-case-03-tab-switching' });
    await newPage.close();
    
    console.log(`📊 Tab Switching Results:`);
    console.log(`  Command visible: ${tabSwitchState.hasTabSwitchCommand}`);
    console.log(`  TypeScript response visible: ${tabSwitchState.hasTypeScriptResponse}`);
    
    // EDGE CASE 4: Very long tool output truncation
    console.log('\n🔍 EDGE CASE 4: Very Long Tool Output');
    
    const massiveCommand = 'Please read and analyze every single file in this workspace, show me the complete content of each file, explain what each function does, and provide a detailed report on every aspect of the codebase including all dependencies, configurations, and code patterns.';
    await submitTextToAgent(page, { text: massiveCommand, timeout: 8000 });
    
    // Wait for massive output
    console.log('⏳ Waiting 30 seconds for massive tool output...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Check content length before navigation
    const preNavLength = await page.evaluate(() => document.body.textContent.length);
    console.log(`📊 Content length before navigation: ${preNavLength}`);
    
    // Navigate away and back
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await selectWorkspace(page, { index: 0 });
    
    const massiveOutputState = await page.evaluate((preLengthRef) => {
      const allText = document.body.textContent;
      const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
      
      return {
        testCase: 'massive-output',
        sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
        hasMassiveCommand: allText.includes('read and analyze every single file'),
        postNavLength: allText.length,
        lengthChanged: Math.abs(allText.length - preLengthRef) > 1000,
        hasExtensiveOutput: allText.length > 50000,
        hasFileContents: allText.includes('function') || allText.includes('export') || allText.includes('import'),
        timestamp: Date.now()
      };
    }, preNavLength);
    
    edgeCaseData.testCases.push(massiveOutputState);
    await takeScreenshot(page, { name: 'edge-case-04-massive-output' });
    
    console.log(`📊 Massive Output Results:`);
    console.log(`  Command visible: ${massiveOutputState.hasMassiveCommand}`);
    console.log(`  Content length changed: ${massiveOutputState.lengthChanged} (${preNavLength} → ${massiveOutputState.postNavLength})`);
    console.log(`  Has extensive output: ${massiveOutputState.hasExtensiveOutput}`);
    
    // FINAL ANALYSIS
    console.log('\n🎯 EDGE CASE ANALYSIS SUMMARY');
    console.log('=============================');
    
    const problemCases = edgeCaseData.testCases.filter(testCase => {
      switch (testCase.testCase) {
        case 'interrupted-processing':
          return testCase.hasOriginalCommand && !testCase.hasToolOutput;
        case 'rapid-commands':
          return (testCase.hasReadmeCommand && !testCase.hasReadmeResponse) ||
                 (testCase.hasListJsCommand && !testCase.hasJsListResponse);
        case 'tab-switching':
          return testCase.hasTabSwitchCommand && !testCase.hasTypeScriptResponse;
        case 'massive-output':
          return testCase.hasMassiveCommand && !testCase.hasFileContents;
        default:
          return false;
      }
    });
    
    console.log(`Found ${problemCases.length} cases with potential tool response loss:`);
    problemCases.forEach(problemCase => {
      console.log(`- ${problemCase.testCase}: Commands visible but responses missing`);
    });
    
    if (problemCases.length === 0) {
      console.log('✅ No edge cases reproduced the tool response loss issue');
      console.log('This suggests the issue might be even more specific or timing-dependent');
    }
    
    // Save results
    const fs = require('fs');
    fs.writeFileSync('./edge-case-tool-loss-results.json', JSON.stringify(edgeCaseData, null, 2));
    console.log('\n💾 Edge case results saved to: edge-case-tool-loss-results.json');
    
    console.log('\n⏰ Manual inspection time (45 seconds) - check for any missing tool responses...');
    await new Promise(resolve => setTimeout(resolve, 45000));
    
  } catch (error) {
    console.error('❌ Edge case test failed:', error);
    edgeCaseData.error = error.message;
    await takeScreenshot(page, { name: 'edge-case-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  testEdgeCaseToolLoss().catch(console.error);
}