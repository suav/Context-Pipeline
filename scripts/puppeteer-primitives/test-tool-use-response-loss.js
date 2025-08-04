#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgentImproved = require('./agent/deploy-agent-improved');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function testToolUseResponseLoss() {
  console.log('🔧 SPECIFIC TEST: Tool Use Response Loss');
  console.log('======================================');
  console.log('Testing the specific issue: tool use responses not populating after navigation.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  const toolTestData = {
    timestamp: new Date().toISOString(),
    toolUseTests: [],
    findings: {}
  };
  
  try {
    console.log('🔧 PHASE 1: Establish Agent and Test Tool Use Commands');
    await navigateToApp(page);
    await selectWorkspace(page, { index: 0 });
    await deployAgentImproved(page, { agentType: 'dev-assistant' });
    await takeScreenshot(page, { name: 'tool-test-01-agent-ready' });
    
    // Test commands that likely trigger tool use
    const toolUseCommands = [
      {
        command: 'Please list all files in this workspace using your file reading tools.',
        expectsTool: 'file_reading',
        description: 'File listing tool use'
      },
      {
        command: 'Can you read the README.md file and tell me what this project does?',
        expectsTool: 'file_read',
        description: 'File reading tool use'
      },
      {
        command: 'Show me the git status of this repository.',
        expectsTool: 'git_status',
        description: 'Git tool use'
      }
    ];
    
    // Execute each tool use command and capture state
    for (let i = 0; i < toolUseCommands.length; i++) {
      const testCommand = toolUseCommands[i];
      console.log(`\n🔧 Testing tool use ${i + 1}: ${testCommand.description}`);
      
      await submitTextToAgent(page, { text: testCommand.command, timeout: 8000 });
      
      // Wait longer for tool use to complete
      console.log('⏳ Waiting 20 seconds for tool use to complete...');
      await new Promise(resolve => setTimeout(resolve, 20000));
      
      // Capture tool use state
      const toolUseState = await page.evaluate((testInfo) => {
        const allText = document.body.textContent;
        const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
        
        // Look for tool use indicators
        const toolIndicators = {
          hasToolUseStarted: allText.includes('using') || allText.includes('tool') || allText.includes('reading'),
          hasFileContent: allText.includes('package.json') || allText.includes('README') || allText.includes('function'),
          hasGitOutput: allText.includes('git status') || allText.includes('branch') || allText.includes('commit'),
          hasProcessingIndicator: allText.includes('Processing') || allText.includes('⏱️'),
          hasCompletedIndicator: allText.includes('Completed') || allText.includes('✅'),
          hasErrorIndicator: allText.includes('Error') || allText.includes('Failed'),
          
          // Look for specific tool outputs
          hasFileList: allText.includes('src/') || allText.includes('.js') || allText.includes('.ts'),
          hasReadmeContent: allText.includes('Context Pipeline') || allText.includes('## '),
          hasGitStatus: allText.includes('modified:') || allText.includes('untracked') || allText.includes('staged')
        };
        
        return {
          testNumber: testInfo.testNumber,
          sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
          totalTextLength: allText.length,
          userCommandVisible: allText.includes(testInfo.command.substring(0, 30)),
          ...toolIndicators,
          timestamp: Date.now()
        };
      }, { testNumber: i + 1, ...testCommand });
      
      toolTestData.toolUseTests.push(toolUseState);
      
      console.log(`📊 Tool Use ${i + 1} Results:`);
      console.log(`  User command visible: ${toolUseState.userCommandVisible}`);
      console.log(`  Tool use started: ${toolUseState.hasToolUseStarted}`);
      console.log(`  Has file content: ${toolUseState.hasFileContent}`);
      console.log(`  Processing indicator: ${toolUseState.hasProcessingIndicator}`);
      console.log(`  Completed indicator: ${toolUseState.hasCompletedIndicator}`);
      
      await takeScreenshot(page, { name: `tool-test-02-tool-use-${i + 1}` });
    }
    
    const originalSession = toolTestData.toolUseTests[0].sessionId;
    console.log(`📊 Original session with tool use: ${originalSession}`);
    
    // PHASE 2: Navigate away and back - Test tool use response persistence
    console.log('\n🔧 PHASE 2: Navigate Away and Back - Tool Use Response Test');
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await selectWorkspace(page, { index: 1 }); // Different workspace
    await new Promise(resolve => setTimeout(resolve, 3000));
    await takeScreenshot(page, { name: 'tool-test-03-different-workspace' });
    
    // Return to original workspace
    console.log('🔧 Returning to original workspace...');
    await page.goto('http://localhost:3001');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await selectWorkspace(page, { index: 0 }); // Back to original
    
    // Capture post-navigation state
    const postNavigationState = await page.evaluate(() => {
      const allText = document.body.textContent;
      const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
      
      return {
        sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
        totalTextLength: allText.length,
        
        // Check for tool use command presence
        hasFileListCommand: allText.includes('list all files'),
        hasReadmeCommand: allText.includes('read the README'),
        hasGitCommand: allText.includes('git status'),
        
        // Check for tool use RESPONSE presence
        hasFileListResponse: allText.includes('src/') || allText.includes('package.json'),
        hasReadmeResponse: allText.includes('Context Pipeline') || allText.includes('## '),
        hasGitResponse: allText.includes('modified:') || allText.includes('untracked'),
        
        // Check for processing states
        hasProcessingHistory: allText.includes('Processing') || allText.includes('Completed'),
        hasToolUseHistory: allText.includes('using') || allText.includes('tool'),
        
        timestamp: Date.now()
      };
    });
    
    toolTestData.postNavigationState = postNavigationState;
    await takeScreenshot(page, { name: 'tool-test-04-returned-to-original' });
    
    console.log('\n📊 TOOL USE RESPONSE ANALYSIS');
    console.log('=============================');
    console.log(`Session maintained: ${originalSession === postNavigationState.sessionId}`);
    console.log(`User commands visible: ${postNavigationState.hasFileListCommand && postNavigationState.hasReadmeCommand && postNavigationState.hasGitCommand}`);
    console.log(`Tool responses visible: File=${postNavigationState.hasFileListResponse}, README=${postNavigationState.hasReadmeResponse}, Git=${postNavigationState.hasGitResponse}`);
    console.log(`Processing history visible: ${postNavigationState.hasProcessingHistory}`);
    
    // PHASE 3: Test if agent remembers tool use results
    console.log('\n🔧 PHASE 3: Test Agent Memory of Tool Use Results');
    
    // Ensure agent is available
    const needsAgent = await page.evaluate(() => !document.querySelector('input[placeholder*="command"]'));
    if (needsAgent) {
      await deployAgentImproved(page, { agentType: 'dev-assistant' });
    }
    
    const memoryTestCommand = 'MEMORY TEST: What files did I ask you to list earlier? What did the README file contain? Do you remember the git status?';
    await submitTextToAgent(page, { text: memoryTestCommand, timeout: 8000 });
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const memoryTestState = await page.evaluate(() => {
      const allText = document.body.textContent;
      
      return {
        hasMemoryTestCommand: allText.includes('MEMORY TEST'),
        hasMemoryResponse: allText.includes('I remember') || allText.includes('you asked') || allText.includes('earlier'),
        hasSpecificMemory: allText.includes('files') || allText.includes('README') || allText.includes('git'),
        sessionId: allText.match(/Session:\s*([a-zA-Z0-9-]+)/)?.[1] || 'not-found',
        timestamp: Date.now()
      };
    });
    
    toolTestData.memoryTestState = memoryTestState;
    await takeScreenshot(page, { name: 'tool-test-05-memory-test' });
    
    // FINAL ANALYSIS
    const toolUseProblemAnalysis = {
      commandsPersist: postNavigationState.hasFileListCommand && postNavigationState.hasReadmeCommand,
      toolResponsesPersist: postNavigationState.hasFileListResponse || postNavigationState.hasReadmeResponse || postNavigationState.hasGitResponse,
      agentRemembersToolUse: memoryTestState.hasMemoryResponse && memoryTestState.hasSpecificMemory,
      sessionContinuity: originalSession === postNavigationState.sessionId,
      
      // The specific issue
      toolUseLossIssue: {
        userCommandsVisible: postNavigationState.hasFileListCommand,
        toolResponsesVisible: postNavigationState.hasFileListResponse,
        problemExists: postNavigationState.hasFileListCommand && !postNavigationState.hasFileListResponse
      }
    };
    
    toolTestData.analysis = toolUseProblemAnalysis;
    
    console.log('\n🎯 TOOL USE LOSS ANALYSIS');
    console.log('=========================');
    console.log(`Commands persist: ${toolUseProblemAnalysis.commandsPersist}`);
    console.log(`Tool responses persist: ${toolUseProblemAnalysis.toolResponsesPersist}`);
    console.log(`Agent remembers tool use: ${toolUseProblemAnalysis.agentRemembersToolUse}`);
    console.log(`Session continuity: ${toolUseProblemAnalysis.sessionContinuity}`);
    
    if (toolUseProblemAnalysis.toolUseLossIssue.problemExists) {
      console.log('\n🚨 CONFIRMED: Tool use response loss issue!');
      console.log('- User commands asking for tool use are visible');
      console.log('- Tool use responses/outputs are NOT visible');
      console.log('- This confirms the specific issue described');
    } else {
      console.log('\n✅ Tool use responses appear to be persisting correctly');
    }
    
    // Save detailed results
    const fs = require('fs');
    fs.writeFileSync('./tool-use-response-loss-results.json', JSON.stringify(toolTestData, null, 2));
    console.log('\n💾 Tool use analysis saved to: tool-use-response-loss-results.json');
    
    console.log('\n⏰ Extended inspection (60 seconds) - check tool use response visibility...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    
  } catch (error) {
    console.error('❌ Tool use response test failed:', error);
    toolTestData.error = error.message;
    await takeScreenshot(page, { name: 'tool-test-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  testToolUseResponseLoss().catch(console.error);
}