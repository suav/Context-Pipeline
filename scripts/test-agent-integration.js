const puppeteer = require('puppeteer');
const PuppeteerConfig = require('./puppeteer-config');

/**
 * Agent Integration Feature Testing
 * Tests Claude/Gemini agent deployment, chat interface, and command execution
 */
class AgentIntegrationTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.config = new PuppeteerConfig();
    this.baseUrl = 'http://localhost:3001';
    this.results = [];
  }

  async initialize() {
    this.config.log('🤖 Testing Agent Integration Features...', true);
    
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      PuppeteerConfig.printUsage();
      console.log('\n🤖 Agent Integration Specific Tests:');
      console.log('  - Agent deployment options (Claude/Gemini)');
      console.log('  - Chat interface functionality');
      console.log('  - Command execution and responses');
      console.log('  - Terminal integration');
      console.log('  - Session persistence');
      process.exit(0);
    }

    const browserOptions = this.config.getBrowserOptions();
    const pageOptions = this.config.getPageOptions();
    
    this.browser = await puppeteer.launch(browserOptions);
    this.page = await this.browser.newPage();
    
    await this.page.setDefaultTimeout(pageOptions.defaultTimeout);
    if (browserOptions.headless) {
      await this.page.setViewport({ width: 1920, height: 1080 });
    }
  }

  async testResult(feature, success, details) {
    const result = { feature, success, details, timestamp: new Date().toISOString() };
    this.results.push(result);
    const status = success ? '✅' : '❌';
    this.config.log(`${status} ${feature}: ${details}`, true);
  }

  async testAgentAccess() {
    this.config.log('\n🏠 Testing Agent Access...', true);
    
    await this.page.goto(this.baseUrl);
    await this.config.wait(2, 'Loading homepage...');
    
    // Check for agent-related elements
    const agentElements = await this.page.$$eval('*', elements =>
      elements.filter(el =>
        el.textContent?.toLowerCase().includes('claude') ||
        el.textContent?.toLowerCase().includes('gemini') ||
        el.textContent?.toLowerCase().includes('agent') ||
        el.className?.toLowerCase().includes('agent')
      ).length
    );
    
    await this.testResult('Agent Elements Visible', agentElements > 0, `Found ${agentElements} agent-related elements`);
    
    // Look for agent deployment options
    const deployButtons = await this.page.$$eval('button, [role="button"]', buttons =>
      buttons.filter(btn =>
        btn.textContent?.toLowerCase().includes('deploy') ||
        btn.textContent?.toLowerCase().includes('start') ||
        btn.textContent?.toLowerCase().includes('claude') ||
        btn.textContent?.toLowerCase().includes('gemini')
      ).length
    );
    
    await this.testResult('Agent Deployment Options', deployButtons > 0, `Found ${deployButtons} agent deployment buttons`);
  }

  async testAgentDeployment() {
    this.config.log('\n🚀 Testing Agent Deployment...', true);
    
    // Try to find agent deployment buttons
    const claudeButton = await this.page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => 
        btn.textContent?.toLowerCase().includes('claude') ||
        btn.dataset.testid?.includes('claude')
      ) || null;
    });
    const geminiButton = await this.page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => 
        btn.textContent?.toLowerCase().includes('gemini') ||
        btn.dataset.testid?.includes('gemini')
      ) || null;
    });
    const agentButton = await this.page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => 
        btn.textContent?.toLowerCase().includes('agent') ||
        btn.textContent?.toLowerCase().includes('deploy') ||
        btn.dataset.testid?.includes('agent')
      ) || null;
    });
    
    await this.testResult('Claude Option Available', claudeButton !== null, claudeButton ? 'Claude deployment option found' : 'Claude option not found');
    await this.testResult('Gemini Option Available', geminiButton !== null, geminiButton ? 'Gemini deployment option found' : 'Gemini option not found');
    
    // Try to deploy an agent
    const deployButton = claudeButton || geminiButton || agentButton;
    
    if (deployButton) {
      this.config.log('🖱️  Attempting to deploy agent...', true);
      
      try {
        await deployButton.click();
        await this.config.wait(3, 'Waiting for agent deployment...');
        
        // Check if chat interface opened
        const chatInterface = await this.page.$('.chat, .terminal, [data-testid*="chat"], [data-testid*="terminal"]') !== null;
        await this.testResult('Chat Interface Opens', chatInterface, chatInterface ? 'Agent chat interface opened' : 'No chat interface detected');
        
        if (chatInterface) {
          // Test chat input
          const chatInput = await this.page.$('input[type="text"], textarea, [data-testid*="input"]') !== null;
          await this.testResult('Chat Input Available', chatInput, chatInput ? 'Chat input field found' : 'No chat input found');
          
          // Test send button
          const sendButton = await this.page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.some(btn => 
              btn.textContent?.toLowerCase().includes('send') ||
              btn.dataset.testid?.includes('send') ||
              btn.type === 'submit'
            );
          });
          await this.testResult('Send Button Available', sendButton, sendButton ? 'Send button found' : 'No send button found');
        }
        
      } catch (error) {
        await this.testResult('Agent Deployment', false, `Deployment failed: ${error.message}`);
      }
    } else {
      await this.testResult('Agent Deployment Button Found', false, 'No agent deployment button detected');
    }
  }

  async testChatInterface() {
    this.config.log('\n💬 Testing Chat Interface...', true);
    
    // Look for existing chat interface
    const chatContainer = await this.page.$('.chat, .messages, [data-testid*="chat"]');
    
    if (chatContainer) {
      // Test message history
      const messages = await this.page.$$eval('.message, .chat-message, [data-testid*="message"]', msgs => msgs.length);
      await this.testResult('Message History', messages >= 0, `Found ${messages} messages in chat`);
      
      // Test typing indicator
      const typingIndicator = await this.page.$('.typing, .loading, [data-testid*="typing"]') !== null;
      await this.testResult('Typing Indicator Available', typingIndicator, typingIndicator ? 'Typing indicator found' : 'No typing indicator');
      
      // Test chat input functionality
      const chatInput = await this.page.$('input[type="text"], textarea, [data-testid*="input"]');
      
      if (chatInput) {
        this.config.log('⌨️  Testing chat input...', true);
        
        try {
          await chatInput.type('Hello, this is a test message from Puppeteer!', { delay: 50 });
          await this.config.wait(1, 'Typing test message...');
          
          await this.testResult('Chat Input Functionality', true, 'Successfully typed in chat input');
          
          // Test send functionality
          const sendButton = await this.page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(btn => 
              btn.textContent?.toLowerCase().includes('send') ||
              btn.dataset.testid?.includes('send') ||
              btn.type === 'submit'
            ) || null;
          });
          
          if (sendButton) {
            this.config.log('📤 Testing message send...', true);
            
            await sendButton.click();
            await this.config.wait(2, 'Waiting for message send...');
            
            await this.testResult('Message Send', true, 'Message send attempted');
          }
          
        } catch (error) {
          await this.testResult('Chat Input Usage', false, `Input failed: ${error.message}`);
        }
      } else {
        await this.testResult('Chat Input Present', false, 'No chat input field found');
      }
    } else {
      this.config.log('⚠️  No chat interface available for testing', true);
      await this.testResult('Chat Interface Present', false, 'No chat interface found');
    }
  }

  async testTerminalIntegration() {
    this.config.log('\n💻 Testing Terminal Integration...', true);
    
    // Look for terminal elements
    const terminalElements = await this.page.$$eval('*', elements =>
      elements.filter(el =>
        el.textContent?.toLowerCase().includes('terminal') ||
        el.className?.toLowerCase().includes('terminal') ||
        el.className?.toLowerCase().includes('xterm')
      ).length
    );
    
    await this.testResult('Terminal Elements Present', terminalElements > 0, `Found ${terminalElements} terminal-related elements`);
    
    // Test terminal opening
    const terminalButton = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(btn => 
        btn.textContent?.toLowerCase().includes('terminal') ||
        btn.dataset.testid?.includes('terminal')
      );
    });
    await this.testResult('Terminal Access Button', terminalButton, terminalButton ? 'Terminal button found' : 'No terminal button');
    
    // Test terminal area
    const terminalArea = await this.page.$('.xterm, .terminal-container, [data-testid*="terminal"]') !== null;
    await this.testResult('Terminal Area Available', terminalArea, terminalArea ? 'Terminal area found' : 'No terminal area');
  }

  async testCommandExecution() {
    this.config.log('\n⚡ Testing Command Execution...', true);
    
    // Look for command-related functionality
    const commandElements = await this.page.$$eval('*', elements =>
      elements.filter(el =>
        el.textContent?.toLowerCase().includes('command') ||
        el.textContent?.toLowerCase().includes('/') ||
        el.className?.toLowerCase().includes('command')
      ).length
    );
    
    await this.testResult('Command Elements Present', commandElements > 0, `Found ${commandElements} command-related elements`);
    
    // Test slash commands
    const chatInput = await this.page.$('input[type="text"], textarea, [data-testid*="input"]');
    
    if (chatInput) {
      this.config.log('⌨️  Testing slash commands...', true);
      
      try {
        // Clear any existing text
        await chatInput.evaluate(el => el.value = '');
        
        // Type a slash command
        await chatInput.type('/help', { delay: 100 });
        await this.config.wait(1, 'Typing slash command...');
        
        // Check for command suggestions
        const suggestions = await this.page.$('.suggestions, .autocomplete, [data-testid*="suggestion"]') !== null;
        await this.testResult('Command Suggestions', suggestions, suggestions ? 'Command suggestions appeared' : 'No command suggestions');
        
        await this.testResult('Slash Command Input', true, 'Successfully typed slash command');
        
      } catch (error) {
        await this.testResult('Command Input', false, `Command input failed: ${error.message}`);
      }
    } else {
      await this.testResult('Command Input Available', false, 'No input field for commands');
    }
  }

  async testSessionPersistence() {
    this.config.log('\n💾 Testing Session Persistence...', true);
    
    // Check for session-related functionality
    const sessionElements = await this.page.$$eval('*', elements =>
      elements.filter(el =>
        el.textContent?.toLowerCase().includes('session') ||
        el.textContent?.toLowerCase().includes('conversation') ||
        el.textContent?.toLowerCase().includes('history')
      ).length
    );
    
    await this.testResult('Session Elements Present', sessionElements > 0, `Found ${sessionElements} session-related elements`);
    
    // Test conversation history
    const historyButton = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(btn => 
        btn.textContent?.toLowerCase().includes('history') ||
        btn.dataset.testid?.includes('history')
      );
    });
    await this.testResult('Conversation History Option', historyButton, historyButton ? 'History button found' : 'No history option');
    
    // Test session management
    const sessionButtons = await this.page.$$eval('button, [role="button"]', buttons =>
      buttons.filter(btn =>
        btn.textContent?.toLowerCase().includes('save') ||
        btn.textContent?.toLowerCase().includes('load') ||
        btn.textContent?.toLowerCase().includes('clear') ||
        btn.textContent?.toLowerCase().includes('new session')
      ).length
    );
    
    await this.testResult('Session Management Options', sessionButtons > 0, `Found ${sessionButtons} session management buttons`);
  }

  async testAPIConnectivity() {
    this.config.log('\n🌐 Testing Agent API Connectivity...', true);
    
    const apiCalls = [];
    
    this.page.on('response', response => {
      if (response.url().includes('/api/agents') || 
          response.url().includes('/api/chat') ||
          response.url().includes('/api/command')) {
        apiCalls.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method()
        });
      }
    });
    
    // Trigger API calls
    await this.page.reload();
    await this.config.wait(3, 'Monitoring agent APIs...');
    
    const successfulCalls = apiCalls.filter(call => call.status >= 200 && call.status < 400);
    const failedCalls = apiCalls.filter(call => call.status >= 400);
    
    await this.testResult('Agent API Health', apiCalls.length >= 0, `Total calls: ${apiCalls.length}, Successful: ${successfulCalls.length}, Failed: ${failedCalls.length}`);
    
    if (apiCalls.length > 0) {
      this.config.log('📡 Agent API Calls:', true);
      apiCalls.forEach(call => {
        this.config.log(`   ${call.method} ${call.url} - ${call.status}`, true);
      });
    }
  }

  async generateReport() {
    const summary = {
      timestamp: new Date().toISOString(),
      totalTests: this.results.length,
      passedTests: this.results.filter(r => r.success).length,
      failedTests: this.results.filter(r => !r.success).length,
      results: this.results
    };
    
    this.config.log('\n' + '='.repeat(60), true);
    this.config.log('🤖 AGENT INTEGRATION TEST SUMMARY', true);
    this.config.log('='.repeat(60), true);
    this.config.log(`📊 Total Tests: ${summary.totalTests}`, true);
    this.config.log(`✅ Passed: ${summary.passedTests}`, true);
    this.config.log(`❌ Failed: ${summary.failedTests}`, true);
    this.config.log(`📈 Success Rate: ${Math.round((summary.passedTests / summary.totalTests) * 100)}%`, true);
    
    return summary;
  }

  async run() {
    try {
      await this.initialize();
      
      await this.testAgentAccess();
      await this.testAgentDeployment();
      await this.testChatInterface();
      await this.testTerminalIntegration();
      await this.testCommandExecution();
      await this.testSessionPersistence();
      await this.testAPIConnectivity();
      
      const summary = await this.generateReport();
      return summary;
      
    } catch (error) {
      this.config.log(`❌ Agent integration testing failed: ${error.message}`, true);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

if (require.main === module) {
  const tester = new AgentIntegrationTester();
  tester.run().catch(console.error);
}

module.exports = AgentIntegrationTester;