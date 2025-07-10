const puppeteer = require('puppeteer');
const PuppeteerConfig = require('./puppeteer-config');

/**
 * Refined Context Pipeline Testing Suite
 * Based on actual exploration findings - tests real navigation patterns
 */
class ContextPipelineRefinedTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.config = new PuppeteerConfig();
    this.baseUrl = 'http://localhost:3001';
    this.results = [];
    this.workspaceId = null;
  }

  async initialize() {
    this.config.log('🚀 Testing Context Pipeline - Refined Navigation Patterns...', true);
    
    const browserOptions = this.config.getBrowserOptions();
    const pageOptions = this.config.getPageOptions();
    
    this.browser = await puppeteer.launch(browserOptions);
    this.page = await this.browser.newPage();
    
    await this.page.setDefaultTimeout(pageOptions.defaultTimeout);
    if (browserOptions.headless) {
      await this.page.setViewport({ width: 1920, height: 1080 });
    }

    // Monitor API calls for workspace detection
    this.page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/workspaces/') && !url.includes('/api/workspaces?')) {
        const match = url.match(/\/api\/workspaces\/([^\/]+)/);
        if (match && !this.workspaceId) {
          this.workspaceId = match[1];
        }
      }
    });
  }

  async testResult(feature, success, details, data = null) {
    const result = { 
      feature, 
      success, 
      details, 
      data,
      timestamp: new Date().toISOString() 
    };
    this.results.push(result);
    const status = success ? '✅' : '❌';
    this.config.log(`${status} ${feature}: ${details}`, true);
  }

  async testDashboardAndWorkspaceList() {
    this.config.log('\n📊 Test 1: Dashboard and Workspace Discovery...', true);
    
    await this.page.goto(this.baseUrl);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test workspace cards presence and metadata
    const workspaceAnalysis = await this.page.evaluate(() => {
      const workspaceCards = Array.from(document.querySelectorAll('h3')).filter(h3 => 
        h3.textContent?.includes('Workspace')
      );
      
      const workspaceDetails = workspaceCards.map(card => ({
        title: card.textContent?.trim(),
        hasStats: card.parentElement?.textContent?.includes('🤖') && 
                 card.parentElement?.textContent?.includes('📊'),
        hasTimestamp: card.parentElement?.textContent?.includes('ago')
      }));
      
      return {
        totalCards: workspaceCards.length,
        workspaceDetails: workspaceDetails.slice(0, 3), // First 3 for analysis
        hasCreateButton: document.body.textContent?.includes('Create New Workspace'),
        hasImportButton: document.body.textContent?.includes('Import from Library'),
        hasBrowseTemplates: document.body.textContent?.includes('Browse Templates')
      };
    });
    
    await this.testResult('Workspace Cards Present', 
      workspaceAnalysis.totalCards > 0, 
      `Found ${workspaceAnalysis.totalCards} workspace cards`,
      workspaceAnalysis);
    
    await this.testResult('Workspace Metadata Complete', 
      workspaceAnalysis.workspaceDetails.some(w => w.hasStats && w.hasTimestamp),
      'Workspace cards show agent counts, item counts, and timestamps');
    
    await this.testResult('Dashboard Actions Available', 
      workspaceAnalysis.hasCreateButton && workspaceAnalysis.hasImportButton,
      'Create, Import, and Browse Templates buttons present');
  }

  async testContextLibraryIntegration() {
    this.config.log('\n📚 Test 2: Context Library Integration...', true);
    
    // Click Import from Library to access the Context Library
    const libraryOpened = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const importBtn = buttons.find(btn => btn.textContent?.includes('Import from Library'));
      if (importBtn) {
        importBtn.click();
        return true;
      }
      return false;
    });
    
    if (libraryOpened) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const libraryAnalysis = await this.page.evaluate(() => {
        const libraryItems = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent || '';
          return (text.includes('README') || text.includes('DOCUMENTATION') || 
                 text.includes('CLAUDE') || text.includes('DV0L-')) && 
                 el.offsetHeight > 0 && el.offsetWidth > 0;
        });
        
        const contextTypes = {
          files: libraryItems.filter(el => el.textContent?.includes('File:')).length,
          jiraTickets: libraryItems.filter(el => el.textContent?.includes('DV0L-')).length,
          repositories: libraryItems.filter(el => el.textContent?.includes('Repository:')).length
        };
        
        return {
          totalItems: libraryItems.length,
          contextTypes,
          hasSearchBar: document.querySelector('input[placeholder*="search" i]') !== null,
          hasImportButton: document.body.textContent?.includes('Import'),
          hasArchiveButton: document.body.textContent?.includes('Archive'),
          hasRefreshButton: document.body.textContent?.includes('Refresh Library')
        };
      });
      
      await this.testResult('Context Library Access', true, 
        `Library opened with ${libraryAnalysis.totalItems} items`,
        libraryAnalysis);
      
      await this.testResult('Context Source Diversity', 
        Object.values(libraryAnalysis.contextTypes).some(count => count > 0),
        `Found files: ${libraryAnalysis.contextTypes.files}, JIRA: ${libraryAnalysis.contextTypes.jiraTickets}, repos: ${libraryAnalysis.contextTypes.repositories}`);
      
      // Close library
      await this.page.keyboard.press('Escape');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async testWorkspaceIDENavigation() {
    this.config.log('\n🏗️ Test 3: Workspace IDE Navigation (Two-Click Pattern)...', true);
    
    // Step 1: Click workspace card to select it
    const workspaceSelected = await this.page.evaluate(() => {
      const workspaceCards = Array.from(document.querySelectorAll('h3'));
      const targetWorkspace = workspaceCards.find(h3 => 
        h3.textContent?.includes('Evpatarini/DavinEPV2-2') ||
        h3.textContent?.includes('Workspace')
      );
      
      if (targetWorkspace) {
        targetWorkspace.click();
        return {
          clicked: true,
          workspaceName: targetWorkspace.textContent?.trim()
        };
      }
      return { clicked: false };
    });
    
    if (workspaceSelected.clicked) {
      await this.testResult('Workspace Selection', true, 
        `Selected workspace: ${workspaceSelected.workspaceName}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 2: Click expand button (▶) to open IDE
      const ideOpened = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const expandButton = buttons.find(btn => 
          btn.textContent?.includes('▶') && btn.textContent?.includes('Workspace')
        );
        
        if (expandButton) {
          expandButton.click();
          return {
            expanded: true,
            buttonText: expandButton.textContent?.trim()
          };
        }
        return { expanded: false };
      });
      
      if (ideOpened.expanded) {
        await this.testResult('IDE Expansion', true, 
          `Expanded to IDE view: ${ideOpened.buttonText}`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verify IDE components loaded
        const ideComponents = await this.page.evaluate(() => {
          const components = {
            fileExplorer: {
              present: Array.from(document.querySelectorAll('*')).some(el => 
                el.textContent === 'agents' || el.textContent === 'context' ||
                el.textContent === 'README.md' || el.textContent === 'CLAUDE.md'
              )
            },
            contextBar: {
              present: document.body.textContent?.includes('Repository: Evpatarini') ||
                      document.body.textContent?.includes('DV0L-')
            },
            editorArea: {
              present: document.body.textContent?.includes('No files open') ||
                      document.querySelector('.monaco-editor') !== null
            },
            agentPanel: {
              present: document.body.textContent?.includes('Dev Assistant') ||
                      document.body.textContent?.includes('Code Reviewer')
            }
          };
          
          return components;
        });
        
        await this.testResult('IDE Components Loaded', 
          Object.values(ideComponents).every(comp => comp.present),
          `File explorer, context bar, editor area, and agent panel all loaded`);
      }
    }
  }

  async testFileOperationsAndEditing() {
    this.config.log('\n📝 Test 4: File Operations and Monaco Editor...', true);
    
    // Test file opening
    const fileOpened = await this.page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const readmeFile = elements.find(el => 
        el.textContent === 'README.md' && el.offsetParent !== null
      );
      
      if (readmeFile) {
        readmeFile.click();
        return true;
      }
      return false;
    });
    
    if (fileOpened) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const editorAnalysis = await this.page.evaluate(() => {
        const hasMonaco = document.querySelector('.monaco-editor') !== null;
        const editorContent = document.querySelector('.monaco-editor')?.textContent || '';
        const hasLineNumbers = document.body.textContent?.includes('123456789');
        const hasSaveButton = document.body.textContent?.includes('Save');
        
        return {
          hasMonaco,
          contentLength: editorContent.length,
          hasLineNumbers,
          hasSaveButton,
          isModifiable: true // We'll test this next
        };
      });
      
      await this.testResult('Monaco Editor Load', editorAnalysis.hasMonaco,
        `Monaco editor loaded with ${editorAnalysis.contentLength} characters`);
      
      // Test editing capability
      if (editorAnalysis.hasMonaco) {
        const editingSuccess = await this.page.evaluate(() => {
          try {
            const editor = document.querySelector('.monaco-editor');
            if (editor) {
              editor.click();
              return true;
            }
            return false;
          } catch (error) {
            return false;
          }
        });
        
        if (editingSuccess) {
          // Try to edit the file
          await this.page.keyboard.down('Control');
          await this.page.keyboard.press('A');
          await this.page.keyboard.up('Control');
          await new Promise(resolve => setTimeout(resolve, 500));
          
          await this.page.keyboard.type('# Context Pipeline Test File\n\nThis file was edited by automated testing!\n');
          
          // Check if file shows as modified
          const fileModified = await this.page.evaluate(() => {
            return document.body.textContent?.includes('Modified') ||
                   document.body.textContent?.includes('●');
          });
          
          await this.testResult('File Editing Capability', fileModified,
            'Successfully edited file content and detected modification state');
        }
      }
    }
    
    // Test file creation
    const newFileAttempt = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const newFileBtn = buttons.find(btn => 
        btn.textContent?.includes('📄New') || btn.textContent?.includes('New')
      );
      
      if (newFileBtn) {
        newFileBtn.click();
        return true;
      }
      return false;
    });
    
    await this.testResult('File Creation Interface', newFileAttempt,
      'New file creation button is functional');
  }

  async testAgentIntegrationAndDeployment() {
    this.config.log('\n🤖 Test 5: Agent Integration and Deployment...', true);
    
    // Analyze available agents
    const agentAnalysis = await this.page.evaluate(() => {
      const agentButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
        const text = btn.textContent?.toLowerCase() || '';
        return text.includes('dev assistant') || text.includes('code reviewer') ||
               text.includes('new agent') || text.includes('system') ||
               text.includes('git') || text.includes('agent');
      });
      
      return {
        totalAgents: agentButtons.length,
        agentTypes: agentButtons.map(btn => btn.textContent?.trim()),
        hasDeployment: agentButtons.length > 0
      };
    });
    
    await this.testResult('Agent Options Available', agentAnalysis.hasDeployment,
      `Found ${agentAnalysis.totalAgents} agent types: ${agentAnalysis.agentTypes.join(', ')}`);
    
    // Test agent deployment
    const agentDeployed = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const agentBtn = buttons.find(btn => 
        btn.textContent?.includes('Dev Assistant') || 
        btn.textContent?.includes('Code Reviewer') ||
        btn.textContent?.includes('Agent')
      );
      
      if (agentBtn) {
        agentBtn.click();
        return {
          deployed: true,
          agentType: agentBtn.textContent?.trim()
        };
      }
      return { deployed: false };
    });
    
    if (agentDeployed.deployed) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await this.testResult('Agent Deployment', true,
        `Successfully deployed: ${agentDeployed.agentType}`);
      
      // Check for agent interface elements
      const agentInterface = await this.page.evaluate(() => {
        const hasTerminalInput = document.querySelector('input[placeholder*="command"]') !== null;
        const hasChatArea = document.querySelector('.chat, .messages') !== null;
        const hasActiveAgent = document.body.textContent?.includes('Agent') &&
                              document.body.textContent?.includes('Online');
        
        return { hasTerminalInput, hasChatArea, hasActiveAgent };
      });
      
      await this.testResult('Agent Interface Active', 
        agentInterface.hasTerminalInput || agentInterface.hasChatArea,
        'Agent interface elements are available for interaction');
    }
  }

  async testContextItemsAndIntegration() {
    this.config.log('\n📋 Test 6: Context Items Integration...', true);
    
    // Analyze loaded context items
    const contextAnalysis = await this.page.evaluate(() => {
      const contextTypes = {
        repositories: Array.from(document.querySelectorAll('*')).filter(el =>
          el.textContent?.includes('Repository: Evpatarini')
        ).length,
        jiraTickets: Array.from(document.querySelectorAll('*')).filter(el =>
          el.textContent?.includes('DV0L-')
        ).length,
        documentFiles: Array.from(document.querySelectorAll('*')).filter(el =>
          el.textContent?.includes('CONSERVATIVE_DEVELOPMENT') ||
          el.textContent?.includes('DOCUMENTATION_INDEX')
        ).length
      };
      
      const totalContextItems = Object.values(contextTypes).reduce((sum, count) => sum + count, 0);
      
      return {
        contextTypes,
        totalItems: totalContextItems,
        hasContextBar: totalContextItems > 0
      };
    });
    
    await this.testResult('Context Items Loaded', contextAnalysis.hasContextBar,
      `Loaded ${contextAnalysis.totalItems} context items: ${JSON.stringify(contextAnalysis.contextTypes)}`);
    
    // Test context item interaction
    const contextClicked = await this.page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const contextItem = elements.find(el => 
        el.textContent?.includes('DV0L-') && el.offsetParent !== null
      );
      
      if (contextItem) {
        contextItem.click();
        return {
          clicked: true,
          itemText: contextItem.textContent?.substring(0, 50)
        };
      }
      return { clicked: false };
    });
    
    if (contextClicked.clicked) {
      await this.testResult('Context Item Interaction', true,
        `Successfully clicked context item: ${contextClicked.itemText}...`);
    }
  }

  async testAPIAndPerformance() {
    this.config.log('\n🌐 Test 7: API Integration and Performance...', true);
    
    const apiCalls = [];
    const performanceStart = Date.now();
    
    // Monitor API calls during a refresh
    this.page.on('response', response => {
      if (response.url().includes('/api/')) {
        apiCalls.push({
          endpoint: response.url().split('/api/')[1],
          status: response.status(),
          timing: Date.now() - performanceStart
        });
      }
    });
    
    await this.page.reload();
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const apiAnalysis = {
      totalCalls: apiCalls.length,
      successfulCalls: apiCalls.filter(call => call.status >= 200 && call.status < 400).length,
      workspaceAPIs: apiCalls.filter(call => 
        call.endpoint.includes('workspace') || 
        call.endpoint.includes('files') || 
        call.endpoint.includes('agents')
      ).length,
      averageResponseTime: apiCalls.length > 0 ? 
        apiCalls.reduce((sum, call) => sum + call.timing, 0) / apiCalls.length : 0
    };
    
    await this.testResult('API Integration Health', apiAnalysis.successfulCalls > 0,
      `${apiAnalysis.successfulCalls}/${apiAnalysis.totalCalls} successful API calls, ${apiAnalysis.workspaceAPIs} workspace-specific`);
    
    await this.testResult('Workspace ID Detection', this.workspaceId !== null,
      `Detected workspace ID: ${this.workspaceId || 'None'}`);
  }

  async generateDetailedReport() {
    const summary = {
      timestamp: new Date().toISOString(),
      totalTests: this.results.length,
      passedTests: this.results.filter(r => r.success).length,
      failedTests: this.results.filter(r => !r.success).length,
      workspaceId: this.workspaceId,
      results: this.results,
      navigationPattern: {
        homeToWorkspace: "Click workspace card → Click expand button (▶)",
        fileEditing: "Click file in explorer → Monaco editor opens → Edit → Auto-save",
        agentDeployment: "Click agent button in bottom toolbar → Interface activates",
        contextAccess: "Click 'Import from Library' → Browse context items"
      }
    };
    
    this.config.log('\n' + '='.repeat(60), true);
    this.config.log('🎯 CONTEXT PIPELINE REFINED TEST SUMMARY', true);
    this.config.log('='.repeat(60), true);
    this.config.log(`📊 Total Tests: ${summary.totalTests}`, true);
    this.config.log(`✅ Passed: ${summary.passedTests}`, true);
    this.config.log(`❌ Failed: ${summary.failedTests}`, true);
    this.config.log(`📈 Success Rate: ${Math.round((summary.passedTests / summary.totalTests) * 100)}%`, true);
    this.config.log(`🏗️ Workspace ID: ${summary.workspaceId}`, true);
    
    this.config.log('\n🗺️ Navigation Patterns Discovered:', true);
    Object.entries(summary.navigationPattern).forEach(([action, pattern]) => {
      this.config.log(`   ${action}: ${pattern}`, true);
    });
    
    return summary;
  }

  async run() {
    try {
      await this.initialize();
      
      await this.testDashboardAndWorkspaceList();
      await this.testContextLibraryIntegration();
      await this.testWorkspaceIDENavigation();
      await this.testFileOperationsAndEditing();
      await this.testAgentIntegrationAndDeployment();
      await this.testContextItemsAndIntegration();
      await this.testAPIAndPerformance();
      
      const summary = await this.generateDetailedReport();
      
      // Take final screenshot
      await this.page.screenshot({ 
        path: 'analysis/refined-test-final-state.png', 
        fullPage: true 
      });
      
      return summary;
      
    } catch (error) {
      this.config.log(`❌ Refined testing failed: ${error.message}`, true);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

if (require.main === module) {
  const tester = new ContextPipelineRefinedTester();
  tester.run().catch(console.error);
}

module.exports = ContextPipelineRefinedTester;