#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgentImproved = require('./agent/deploy-agent-improved');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function testConversationPersistenceImprovement() {
  console.log('🔄 CONVERSATION PERSISTENCE IMPROVEMENT TEST');
  console.log('===========================================');
  console.log('Testing and improving conversation history, tool use display, and memory persistence.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  const improvementData = {
    timestamp: new Date().toISOString(),
    iterationResults: [],
    persistenceTests: []
  };
  
  try {
    // Test iteration: Build up comprehensive conversation with tool use
    for (let iteration = 1; iteration <= 3; iteration++) {
      console.log(`\n🔄 ITERATION ${iteration}: Building conversation with tool use`);
      
      if (iteration === 1) {
        await navigateToApp(page);
        await selectWorkspace(page, { index: 0 });
        await deployAgentImproved(page, { agentType: 'dev-assistant' });
      }
      
      // Progressive tool use commands - building up context
      const iterationCommands = {
        1: [
          'Please analyze this workspace and list all the main files.',
          'Read the package.json and tell me about this project\'s dependencies.',
          'Check the current git status and branch information.'
        ],
        2: [
          'Now examine the src/ directory structure in detail.',
          'Look at the main TypeScript/JavaScript files and explain their purpose.',
          'Check if there are any configuration files like tsconfig.json or .env files.'
        ],
        3: [
          'Based on your previous analysis, what type of application is this?',
          'Are there any issues or improvements you would recommend?',
          'Can you create a summary of everything you\'ve learned about this workspace?'
        ]
      };
      
      const commands = iterationCommands[iteration];
      
      for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        console.log(`🔧 Iteration ${iteration}, Command ${i + 1}: ${command.substring(0, 60)}...`);
        
        await submitTextToAgent(page, { text: command, timeout: 8000 });
        
        // Wait for processing to complete
        console.log('⏳ Waiting for tool execution...');
        await new Promise(resolve => setTimeout(resolve, 20000));
        
        // Capture conversation state after each command
        const commandState = await page.evaluate((iter, cmdIndex, cmd) => {
          const allText = document.body.textContent;
          const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
          
          // Count tool use indicators
          const toolIndicators = (allText.match(/using|reading|checking|analyzing/gi) || []).length;
          const completedIndicators = (allText.match(/completed|✅|done/gi) || []).length;
          const errorIndicators = (allText.match(/error|failed|❌/gi) || []).length;
          
          // Look for specific tool outputs
          const hasFileContent = allText.includes('src/') || allText.includes('package.json') || allText.includes('function');
          const hasDependencies = allText.includes('dependencies') || allText.includes('"name":');
          const hasGitInfo = allText.includes('branch') || allText.includes('modified:') || allText.includes('commit');
          const hasAnalysis = allText.includes('analysis') || allText.includes('purpose') || allText.includes('application');
          
          return {
            iteration: iter,
            commandIndex: cmdIndex + 1,
            command: cmd.substring(0, 50),
            sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
            totalTextLength: allText.length,
            toolIndicators,
            completedIndicators,
            errorIndicators,
            hasFileContent,
            hasDependencies,
            hasGitInfo,
            hasAnalysis,
            timestamp: Date.now()
          };
        }, iteration, i, command);
        
        improvementData.iterationResults.push(commandState);
        
        console.log(`📊 Command ${i + 1} Results: Tools=${commandState.toolIndicators}, Completed=${commandState.completedIndicators}, Errors=${commandState.errorIndicators}`);
        
        await takeScreenshot(page, { name: `persistence-iter${iteration}-cmd${i + 1}` });
      }
      
      console.log(`📊 Iteration ${iteration} complete. Testing persistence...`);
      
      // Test persistence after each iteration
      const persistenceTest = {
        iteration,
        beforeReload: null,
        afterReload: null
      };
      
      // Capture state before reload
      persistenceTest.beforeReload = await page.evaluate(() => {
        const allText = document.body.textContent;
        const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
        
        return {
          sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
          totalTextLength: allText.length,
          
          // Check for command presence
          hasAnalyzeCommand: allText.includes('analyze this workspace'),
          hasPackageCommand: allText.includes('package.json'),
          hasGitCommand: allText.includes('git status'),
          hasSrcCommand: allText.includes('src/ directory'),
          hasSummaryCommand: allText.includes('create a summary'),
          
          // Check for tool result presence
          hasFileListings: allText.includes('src/') || allText.includes('.js') || allText.includes('.ts'),
          hasDependencyInfo: allText.includes('dependencies') || allText.includes('"react"'),
          hasGitOutput: allText.includes('branch') || allText.includes('modified:'),
          hasAnalysisOutput: allText.includes('application') || allText.includes('purpose'),
          
          // Tool use metadata
          toolUseCount: (allText.match(/using|tool/gi) || []).length,
          processingCount: (allText.match(/processing|completed/gi) || []).length,
          
          timestamp: Date.now()
        };
      });
      
      // Full page reload
      console.log('🔄 Performing full page reload to test persistence...');
      await page.reload({ waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Navigate back to workspace
      await selectWorkspace(page, { index: 0 });
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Capture state after reload
      persistenceTest.afterReload = await page.evaluate(() => {
        const allText = document.body.textContent;
        const sessionMatch = allText.match(/Session:\s*([a-zA-Z0-9-]+)/);
        
        return {
          sessionId: sessionMatch ? sessionMatch[1] : 'not-found',
          totalTextLength: allText.length,
          
          // Check for command presence after reload
          hasAnalyzeCommand: allText.includes('analyze this workspace'),
          hasPackageCommand: allText.includes('package.json'),
          hasGitCommand: allText.includes('git status'),
          hasSrcCommand: allText.includes('src/ directory'),
          hasSummaryCommand: allText.includes('create a summary'),
          
          // Check for tool result presence after reload
          hasFileListings: allText.includes('src/') || allText.includes('.js') || allText.includes('.ts'),
          hasDependencyInfo: allText.includes('dependencies') || allText.includes('"react"'),
          hasGitOutput: allText.includes('branch') || allText.includes('modified:'),
          hasAnalysisOutput: allText.includes('application') || allText.includes('purpose'),
          
          // Tool use metadata after reload
          toolUseCount: (allText.match(/using|tool/gi) || []).length,
          processingCount: (allText.match(/processing|completed/gi) || []).length,
          
          timestamp: Date.now()
        };
      });
      
      improvementData.persistenceTests.push(persistenceTest);
      
      // Analyze persistence quality
      const persistenceQuality = {
        sessionPersisted: persistenceTest.beforeReload.sessionId === persistenceTest.afterReload.sessionId,
        commandsPersisted: [
          persistenceTest.afterReload.hasAnalyzeCommand,
          persistenceTest.afterReload.hasPackageCommand,
          persistenceTest.afterReload.hasGitCommand,
        ].filter(Boolean).length,
        toolResultsPersisted: [
          persistenceTest.afterReload.hasFileListings,
          persistenceTest.afterReload.hasDependencyInfo,
          persistenceTest.afterReload.hasGitOutput,
        ].filter(Boolean).length,
        contentLengthRatio: persistenceTest.afterReload.totalTextLength / persistenceTest.beforeReload.totalTextLength,
        toolMetadataRatio: persistenceTest.afterReload.toolUseCount / Math.max(persistenceTest.beforeReload.toolUseCount, 1)
      };
      
      console.log(`📊 Iteration ${iteration} Persistence Quality:`);
      console.log(`  Session persisted: ${persistenceQuality.sessionPersisted}`);
      console.log(`  Commands persisted: ${persistenceQuality.commandsPersisted}/3`);
      console.log(`  Tool results persisted: ${persistenceQuality.toolResultsPersisted}/3`);
      console.log(`  Content length ratio: ${persistenceQuality.contentLengthRatio.toFixed(2)}`);
      console.log(`  Tool metadata ratio: ${persistenceQuality.toolMetadataRatio.toFixed(2)}`);
      
      await takeScreenshot(page, { name: `persistence-iter${iteration}-after-reload` });
      
      // Redeploy agent if needed
      const needsAgent = await page.evaluate(() => !document.querySelector('input[placeholder*="command"]'));
      if (needsAgent) {
        console.log('⚠️ Agent interface lost after reload, redeploying...');
        await deployAgentImproved(page, { agentType: 'dev-assistant' });
      }
    }
    
    // Final comprehensive analysis
    console.log('\n🎯 COMPREHENSIVE PERSISTENCE ANALYSIS');
    console.log('====================================');
    
    const finalAnalysis = {
      totalIterations: improvementData.persistenceTests.length,
      averageContentRetention: improvementData.persistenceTests.reduce((acc, test) => 
        acc + (test.afterReload.totalTextLength / test.beforeReload.totalTextLength), 0) / improvementData.persistenceTests.length,
      commandPersistenceRate: improvementData.persistenceTests.reduce((acc, test) => {
        const commands = [test.afterReload.hasAnalyzeCommand, test.afterReload.hasPackageCommand, test.afterReload.hasGitCommand].filter(Boolean).length;
        return acc + (commands / 3);
      }, 0) / improvementData.persistenceTests.length,
      toolResultPersistenceRate: improvementData.persistenceTests.reduce((acc, test) => {
        const results = [test.afterReload.hasFileListings, test.afterReload.hasDependencyInfo, test.afterReload.hasGitOutput].filter(Boolean).length;
        return acc + (results / 3);
      }, 0) / improvementData.persistenceTests.length,
      sessionPersistenceRate: improvementData.persistenceTests.filter(test => 
        test.beforeReload.sessionId === test.afterReload.sessionId).length / improvementData.persistenceTests.length
    };
    
    console.log(`Average content retention: ${(finalAnalysis.averageContentRetention * 100).toFixed(1)}%`);
    console.log(`Command persistence rate: ${(finalAnalysis.commandPersistenceRate * 100).toFixed(1)}%`);
    console.log(`Tool result persistence rate: ${(finalAnalysis.toolResultPersistenceRate * 100).toFixed(1)}%`);
    console.log(`Session persistence rate: ${(finalAnalysis.sessionPersistenceRate * 100).toFixed(1)}%`);
    
    if (finalAnalysis.toolResultPersistenceRate < 0.8) {
      console.log('\n🚨 TOOL RESULT PERSISTENCE ISSUE DETECTED');
      console.log('Tool results are not persisting consistently after page reloads');
      console.log('This confirms the reported issue with tool use response loss');
    } else {
      console.log('\n✅ Tool result persistence appears to be working correctly');
    }
    
    improvementData.finalAnalysis = finalAnalysis;
    
    // Save comprehensive results
    const fs = require('fs');
    fs.writeFileSync('./conversation-persistence-improvement-results.json', JSON.stringify(improvementData, null, 2));
    console.log('\n💾 Comprehensive persistence analysis saved to: conversation-persistence-improvement-results.json');
    
    console.log('\n⏰ Final inspection (30 seconds) - review conversation history completeness...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('❌ Conversation persistence improvement test failed:', error);
    improvementData.error = error.message;
    await takeScreenshot(page, { name: 'persistence-improvement-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  testConversationPersistenceImprovement().catch(console.error);
}