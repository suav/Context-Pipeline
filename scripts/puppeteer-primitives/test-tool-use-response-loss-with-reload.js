#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgentImproved = require('./agent/deploy-agent-improved');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function testToolUseResponseLossWithReload() {
  console.log('🔄 ENHANCED TEST: Tool Use Response Loss with Full Page Reload');
  console.log('============================================================');
  console.log('Testing tool response persistence through full page reload cycle.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  const reloadTestData = {
    timestamp: new Date().toISOString(),
    phases: [],
    toolUseStates: []
  };
  
  try {
    console.log('🔄 PHASE 1: Establish Tool Use Conversation');
    await navigateToApp(page);
    await selectWorkspace(page, { index: 0 });
    await deployAgentImproved(page, { agentType: 'dev-assistant' });
    await takeScreenshot(page, { name: 'reload-test-01-agent-ready' });
    
    // Execute several tool use commands
    const toolCommands = [
      'Please list all the files in this workspace directory.',
      'Can you read the package.json file and tell me about the dependencies?',
      'What is the current git status of this repository?'
    ];
    
    for (let i = 0; i < toolCommands.length; i++) {
      const command = toolCommands[i];
      console.log(`\n🔧 Executing tool command ${i + 1}: "${command.substring(0, 50)}..."`);
      
      await submitTextToAgent(page, { text: command, timeout: 8000 });
      
      // Wait for tool execution to complete
      console.log('⏳ Waiting 25 seconds for tool execution to complete...');
      await new Promise(resolve => setTimeout(resolve, 25000));
      
      // Capture tool execution state
      const toolState = await page.evaluate((cmdIndex) => {
        const allText = document.body.textContent;
        const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
        
        return {
          phase: 1,
          commandIndex: cmdIndex,
          sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
          totalTextLength: allText.length,
          
          // Tool execution indicators
          hasProcessingComplete: allText.includes('Completed') || allText.includes('✅'),
          hasToolOutput: allText.includes('src/') || allText.includes('package.json') || allText.includes('dependencies'),
          hasGitOutput: allText.includes('modified:') || allText.includes('untracked') || allText.includes('branch'),
          hasFileContent: allText.includes('{') || allText.includes('function') || allText.includes('import'),
          
          // Command visibility
          hasListCommand: allText.includes('list all the files'),
          hasPackageCommand: allText.includes('package.json'),
          hasGitCommand: allText.includes('git status'),
          
          timestamp: Date.now()
        };
      }, i + 1);
      
      reloadTestData.toolUseStates.push(toolState);
      
      console.log(`📊 Tool Command ${i + 1} Results:`);
      console.log(`  Processing complete: ${toolState.hasProcessingComplete}`);
      console.log(`  Has tool output: ${toolState.hasToolOutput}`);
      console.log(`  Has git output: ${toolState.hasGitOutput}`);
      console.log(`  Session: ${toolState.sessionId}`);
      
      await takeScreenshot(page, { name: `reload-test-02-tool-${i + 1}-complete` });
    }
    
    const originalSession = reloadTestData.toolUseStates[0].sessionId;
    console.log(`\n📊 Original session with tool use: ${originalSession}`);
    reloadTestData.phases.push({ phase: 1, description: 'Tool use established', originalSession });
    
    // PHASE 2: Full page reload from home
    console.log('\n🔄 PHASE 2: Full Page Reload from Home');
    console.log('This simulates the user refreshing their browser or navigating away completely');
    
    // Navigate to home first
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await takeScreenshot(page, { name: 'reload-test-03-back-to-home' });
    
    // Full page reload
    console.log('🔄 Performing full page reload...');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 5000));
    await takeScreenshot(page, { name: 'reload-test-04-after-reload' });
    
    // Navigate back to the same workspace
    console.log('🔄 Navigating back to workspace after reload...');
    await selectWorkspace(page, { index: 0 });
    
    // Capture state after full reload cycle
    const postReloadState = await page.evaluate(() => {
      const allText = document.body.textContent;
      const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
      
      return {
        phase: 2,
        type: 'post-reload',
        sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
        totalTextLength: allText.length,
        
        // Check for command presence
        hasListCommand: allText.includes('list all the files'),
        hasPackageCommand: allText.includes('package.json'),
        hasGitCommand: allText.includes('git status'),
        
        // Check for tool RESPONSE presence (the critical test)
        hasFileListResponse: allText.includes('src/') || allText.includes('components/') || allText.includes('.js'),
        hasPackageResponse: allText.includes('dependencies') || allText.includes('"name":') || allText.includes('scripts'),
        hasGitResponse: allText.includes('modified:') || allText.includes('untracked') || allText.includes('On branch'),
        
        // Processing history
        hasProcessingHistory: allText.includes('Processing') || allText.includes('Completed'),
        hasToolUseHistory: allText.includes('using') || allText.includes('tool'),
        
        // Agent presence
        hasAgentInterface: !!document.querySelector('input[placeholder*="command"]'),
        needsAgentDeploy: !document.querySelector('input[placeholder*="command"]'),
        
        timestamp: Date.now()
      };
    });
    
    reloadTestData.toolUseStates.push(postReloadState);
    reloadTestData.phases.push({ phase: 2, description: 'Post full reload', ...postReloadState });
    
    await takeScreenshot(page, { name: 'reload-test-05-back-in-workspace' });
    
    console.log('\n📊 POST-RELOAD ANALYSIS');
    console.log('=======================');
    console.log(`Session maintained: ${originalSession === postReloadState.sessionId}`);
    console.log(`User commands visible:`);
    console.log(`  - List files: ${postReloadState.hasListCommand}`);
    console.log(`  - Package.json: ${postReloadState.hasPackageCommand}`);
    console.log(`  - Git status: ${postReloadState.hasGitCommand}`);
    console.log(`Tool responses visible:`);
    console.log(`  - File listing: ${postReloadState.hasFileListResponse}`);
    console.log(`  - Package content: ${postReloadState.hasPackageResponse}`);
    console.log(`  - Git output: ${postReloadState.hasGitResponse}`);
    console.log(`Agent interface: ${postReloadState.hasAgentInterface}`);
    
    // PHASE 3: Test agent memory after reload
    console.log('\n🔄 PHASE 3: Test Agent Memory After Full Reload');
    
    if (postReloadState.needsAgentDeploy) {
      console.log('⚠️ Agent needs redeployment after reload');
      await deployAgentImproved(page, { agentType: 'dev-assistant' });
    }
    
    const memoryTestCommand = 'RELOAD MEMORY TEST: What files did I ask you to list? What dependencies were in package.json? What was the git status? Do you remember our previous conversation?';
    await submitTextToAgent(page, { text: memoryTestCommand, timeout: 8000 });
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    const memoryTestState = await page.evaluate(() => {
      const allText = document.body.textContent;
      const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
      
      return {
        phase: 3,
        type: 'memory-test',
        sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
        hasMemoryTestCommand: allText.includes('RELOAD MEMORY TEST'),
        hasMemoryResponse: allText.includes('I remember') || allText.includes('you asked') || allText.includes('previously'),
        hasSpecificMemory: allText.includes('files') || allText.includes('dependencies') || allText.includes('git'),
        hasNoMemory: allText.includes("I don't recall") || allText.includes("I don't have") || allText.includes("no previous"),
        timestamp: Date.now()
      };
    });
    
    reloadTestData.toolUseStates.push(memoryTestState);
    reloadTestData.phases.push({ phase: 3, description: 'Memory test after reload', ...memoryTestState });
    
    await takeScreenshot(page, { name: 'reload-test-06-memory-test' });
    
    // FINAL ANALYSIS
    const reloadIssueAnalysis = {
      sessionPersistence: originalSession === postReloadState.sessionId,
      commandPersistence: postReloadState.hasListCommand && postReloadState.hasPackageCommand && postReloadState.hasGitCommand,
      toolResponsePersistence: postReloadState.hasFileListResponse || postReloadState.hasPackageResponse || postReloadState.hasGitResponse,
      agentMemoryWorking: memoryTestState.hasMemoryResponse && !memoryTestState.hasNoMemory,
      
      // The critical issue test
      toolResponseLossIssue: {
        userCommandsVisible: postReloadState.hasListCommand,
        toolResponsesVisible: postReloadState.hasFileListResponse,
        problemConfirmed: postReloadState.hasListCommand && !postReloadState.hasFileListResponse
      },
      
      reloadSpecificIssues: {
        agentInterfaceLost: postReloadState.needsAgentDeploy,
        sessionChanged: originalSession !== postReloadState.sessionId,
        memoryLost: memoryTestState.hasNoMemory
      }
    };
    
    reloadTestData.analysis = reloadIssueAnalysis;
    
    console.log('\n🎯 FULL RELOAD IMPACT ANALYSIS');
    console.log('=============================');
    console.log(`Session persistence: ${reloadIssueAnalysis.sessionPersistence}`);
    console.log(`Command persistence: ${reloadIssueAnalysis.commandPersistence}`);
    console.log(`Tool response persistence: ${reloadIssueAnalysis.toolResponsePersistence}`);
    console.log(`Agent memory working: ${reloadIssueAnalysis.agentMemoryWorking}`);
    
    if (reloadIssueAnalysis.toolResponseLossIssue.problemConfirmed) {
      console.log('\n🚨 TOOL RESPONSE LOSS CONFIRMED AFTER FULL RELOAD!');
      console.log('- User commands asking for tool use are visible');
      console.log('- Tool use responses/outputs are NOT visible');
      console.log('- This is the specific issue: full reload loses tool responses');
    } else {
      console.log('\n✅ Tool responses appear to survive full reload cycle');
    }
    
    if (reloadIssueAnalysis.reloadSpecificIssues.agentInterfaceLost) {
      console.log('\n⚠️ Agent interface was lost after reload (needed redeployment)');
    }
    
    if (reloadIssueAnalysis.reloadSpecificIssues.sessionChanged) {
      console.log('\n⚠️ Session ID changed after reload - this may be expected');
    }
    
    // Save comprehensive results
    const fs = require('fs');
    fs.writeFileSync('./tool-use-response-loss-reload-results.json', JSON.stringify(reloadTestData, null, 2));
    console.log('\n💾 Full reload test results saved to: tool-use-response-loss-reload-results.json');
    
    console.log('\n⏰ Extended inspection (60 seconds) - verify tool response visibility after reload...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    
  } catch (error) {
    console.error('❌ Tool use response reload test failed:', error);
    reloadTestData.error = error.message;
    await takeScreenshot(page, { name: 'reload-test-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  testToolUseResponseLossWithReload().catch(console.error);
}