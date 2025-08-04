/**
 * Monitor agent execution with continuous screenshots and timing
 * @param {Page} page - Puppeteer page object
 * @param {object} params - Monitoring parameters
 * @returns {Promise<ActionResult>} - Monitoring result with detailed timeline
 */
async function monitorAgentExecution(page, params = {}) {
  const startTime = Date.now();
  const action = 'monitor-agent-execution';
  
  try {
    const {
      maxDuration = 60000,        // Maximum monitoring time (60 seconds)
      screenshotInterval = 2000,  // Screenshot every 2 seconds
      testName = 'agent-monitor', // Base name for screenshots
      waitForCompletion = true,   // Wait for agent to finish
      expectedActions = [],       // Expected agent actions to detect
      onProgress = null          // Progress callback function
    } = params;
    
    console.log(`📹 Starting agent execution monitoring (max ${maxDuration}ms, screenshots every ${screenshotInterval}ms)`);
    
    const timeline = [];
    const screenshots = [];
    let screenshotCount = 0;
    let monitoring = true;
    let lastTerminalContent = '';
    let agentComplete = false;
    
    // Initial state capture
    const initialState = await captureAgentState(page);
    timeline.push({
      timestamp: Date.now() - startTime,
      event: 'monitoring-start',
      state: initialState
    });
    
    // Take initial screenshot
    await takeScreenshot(page, `${testName}-00-initial`, screenshotCount++, screenshots);
    
    // Start monitoring loop
    while (monitoring && (Date.now() - startTime) < maxDuration) {
      await new Promise(resolve => setTimeout(resolve, screenshotInterval));
      
      // Capture current agent state
      const currentState = await captureAgentState(page);
      const elapsed = Date.now() - startTime;
      
      // Detect changes in terminal content
      if (currentState.terminalContent !== lastTerminalContent) {
        const newContent = currentState.terminalContent.substring(lastTerminalContent.length);
        
        timeline.push({
          timestamp: elapsed,
          event: 'terminal-update',
          newContent: newContent.substring(0, 200), // First 200 chars of new content
          state: currentState,
          detected: detectAgentActions(newContent)
        });
        
        lastTerminalContent = currentState.terminalContent;
        
        // Check for completion indicators
        if (newContent.includes('Task completed') || 
            newContent.includes('Analysis complete') ||
            newContent.includes('Done') ||
            currentState.isProcessing === false) {
          agentComplete = true;
          timeline.push({
            timestamp: elapsed,
            event: 'agent-completion-detected',
            state: currentState
          });
        }
        
        // Call progress callback if provided
        if (onProgress) {
          onProgress({
            elapsed,
            state: currentState,
            timeline: timeline.slice(), // Copy of timeline
            agentComplete
          });
        }
      }
      
      // Take screenshot
      const screenshotName = `${testName}-${screenshotCount.toString().padStart(2, '0')}-${Math.round(elapsed/1000)}s`;
      await takeScreenshot(page, screenshotName, screenshotCount++, screenshots);
      
      // Check if we should stop monitoring
      if (waitForCompletion && agentComplete) {
        console.log(`✅ Agent completion detected at ${elapsed}ms`);
        monitoring = false;
      } else if (!waitForCompletion && elapsed > 10000) {
        // For non-completion monitoring, stop after 10 seconds
        console.log(`⏹️  Monitoring stopped after initial period`);
        monitoring = false;
      }
    }
    
    // Final state capture
    const finalState = await captureAgentState(page);
    const totalDuration = Date.now() - startTime;
    
    timeline.push({
      timestamp: totalDuration,
      event: 'monitoring-end',
      state: finalState
    });
    
    // Take final screenshot
    await takeScreenshot(page, `${testName}-final`, screenshotCount++, screenshots);
    
    console.log(`✅ Agent monitoring completed (${totalDuration}ms, ${screenshots.length} screenshots, ${timeline.length} events)`);
    
    // Analyze timeline for insights
    const insights = analyzeTimeline(timeline);
    
    return {
      success: true,
      action,
      data: {
        totalDuration,
        screenshots,
        timeline,
        insights,
        agentComplete,
        finalState
      },
      duration: totalDuration,
      error: null
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Agent monitoring failed: ${error.message}`);
    
    return {
      success: false,
      action,
      data: { duration },
      duration,
      error: error.message
    };
  }
}

/**
 * Capture current agent state
 */
async function captureAgentState(page) {
  return await page.evaluate(() => {
    const terminal = document.querySelector('[class*="terminal"], [class*="chat"]');
    const processingIndicator = document.querySelector('[class*="processing"], [class*="loading"]');
    const input = document.querySelector('input[placeholder*="command"]');
    
    return {
      timestamp: Date.now(),
      hasTerminal: !!terminal,
      terminalContent: terminal ? terminal.textContent : '',
      terminalContentLength: terminal ? terminal.textContent.length : 0,
      isProcessing: !!processingIndicator || 
                   (terminal && terminal.textContent.includes('Processing')) ||
                   (terminal && terminal.textContent.includes('Waiting for AI response')),
      inputAvailable: !!input,
      inputValue: input ? input.value : '',
      url: window.location.href
    };
  });
}

/**
 * Take screenshot with standardized naming
 */
async function takeScreenshot(page, name, count, screenshots) {
  try {
    const path = `scripts/puppeteer-primitives/screenshots/${name}.png`;
    await page.screenshot({ path, fullPage: false }); // Viewport only for speed
    
    screenshots.push({
      name,
      path,
      count,
      timestamp: Date.now()
    });
    
    console.log(`📸 Screenshot ${count}: ${name}`);
  } catch (error) {
    console.log(`❌ Screenshot failed: ${error.message}`);
  }
}

/**
 * Detect specific agent actions in new content
 */
function detectAgentActions(content) {
  const actions = [];
  
  if (content.includes('Tool Used:')) {
    const toolMatch = content.match(/Tool Used: (\\w+)/);
    if (toolMatch) {
      actions.push({ type: 'tool-use', tool: toolMatch[1] });
    }
  }
  
  if (content.includes('✅') || content.includes('Tool Result:')) {
    actions.push({ type: 'tool-success' });
  }
  
  if (content.includes('❌') || content.includes('Tool Error:')) {
    actions.push({ type: 'tool-error' });
  }
  
  if (content.includes('Reading file:') || content.includes('Editing file:')) {
    actions.push({ type: 'file-operation' });
  }
  
  if (content.includes('Analysis complete') || content.includes('Task completed')) {
    actions.push({ type: 'completion' });
  }
  
  return actions;
}

/**
 * Analyze timeline for insights
 */
function analyzeTimeline(timeline) {
  const insights = {
    timeToFirstResponse: null,
    totalToolUses: 0,
    toolSuccesses: 0,
    toolErrors: 0,
    fileOperations: 0,
    responsePhases: []
  };
  
  let firstResponse = null;
  let currentPhase = null;
  
  for (const event of timeline) {
    if (event.event === 'terminal-update') {
      if (!firstResponse) {
        firstResponse = event.timestamp;
        insights.timeToFirstResponse = firstResponse;
      }
      
      if (event.detected) {
        for (const action of event.detected) {
          switch (action.type) {
            case 'tool-use':
              insights.totalToolUses++;
              currentPhase = { start: event.timestamp, tool: action.tool };
              break;
            case 'tool-success':
              insights.toolSuccesses++;
              if (currentPhase) {
                currentPhase.end = event.timestamp;
                currentPhase.duration = currentPhase.end - currentPhase.start;
                currentPhase.result = 'success';
                insights.responsePhases.push(currentPhase);
                currentPhase = null;
              }
              break;
            case 'tool-error':
              insights.toolErrors++;
              if (currentPhase) {
                currentPhase.end = event.timestamp;
                currentPhase.duration = currentPhase.end - currentPhase.start;
                currentPhase.result = 'error';
                insights.responsePhases.push(currentPhase);
                currentPhase = null;
              }
              break;
            case 'file-operation':
              insights.fileOperations++;
              break;
          }
        }
      }
    }
  }
  
  return insights;
}

module.exports = monitorAgentExecution;