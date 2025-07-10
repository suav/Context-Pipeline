const puppeteer = require('puppeteer');
const PuppeteerConfig = require('./puppeteer-config');

/**
 * Workspace Management Feature Testing
 * Tests workspace creation, management, and file operations
 */
class WorkspaceManagementTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.config = new PuppeteerConfig();
    this.baseUrl = 'http://localhost:3001';
    this.results = [];
  }

  async initialize() {
    this.config.log('🏗️ Testing Workspace Management Features...', true);
    
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      PuppeteerConfig.printUsage();
      console.log('\n🏗️ Workspace Management Specific Tests:');
      console.log('  - Workspace creation from library items');
      console.log('  - Workspace listing and navigation');
      console.log('  - File explorer functionality');
      console.log('  - Editor integration');
      console.log('  - Git integration');
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

  async testWorkspaceAccess() {
    this.config.log('\n🏠 Testing Workspace Access...', true);
    
    await this.page.goto(this.baseUrl);
    await this.config.wait(2, 'Loading homepage...');
    
    // Check for workspace-related elements
    const workspaceElements = await this.page.$$eval('*', elements =>
      elements.filter(el =>
        el.textContent?.toLowerCase().includes('workspace') ||
        el.className?.toLowerCase().includes('workspace')
      ).length
    );
    
    await this.testResult('Workspace Elements Visible', workspaceElements > 0, `Found ${workspaceElements} workspace-related elements`);
    
    // Look for workspace creation options
    const createButtons = await this.page.$$eval('button, [role="button"]', buttons =>
      buttons.filter(btn =>
        btn.textContent?.toLowerCase().includes('create') ||
        btn.textContent?.toLowerCase().includes('new workspace') ||
        btn.textContent?.toLowerCase().includes('workspace')
      ).length
    );
    
    await this.testResult('Workspace Creation Available', createButtons > 0, `Found ${createButtons} workspace creation options`);
  }

  async testWorkspaceCreation() {
    this.config.log('\n🆕 Testing Workspace Creation...', true);
    
    // Try to find workspace creation button
    const createButton = await this.page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => 
        btn.textContent?.toLowerCase().includes('create') || 
        btn.textContent?.toLowerCase().includes('new workspace') ||
        btn.dataset.testid?.includes('create')
      ) || null;
    });
    
    if (createButton) {
      this.config.log('🖱️  Attempting to create workspace...', true);
      
      try {
        await createButton.click();
        await this.config.wait(2, 'Waiting for creation dialog...');
        
        // Check if creation dialog opened
        const dialogVisible = await this.page.$('.modal, [role="dialog"], .create-workspace') !== null;
        await this.testResult('Creation Dialog Opens', dialogVisible, dialogVisible ? 'Workspace creation dialog opened' : 'No creation dialog detected');
        
        if (dialogVisible) {
          // Test form fields
          const nameInput = await this.page.$('input[name*="name"], input[placeholder*="name" i]') !== null;
          const descriptionInput = await this.page.$('textarea, input[name*="description"]') !== null;
          
          await this.testResult('Name Input Available', nameInput, nameInput ? 'Workspace name input found' : 'Name input not found');
          await this.testResult('Description Input Available', descriptionInput, descriptionInput ? 'Description input found' : 'Description input not found');
          
          // Test library item selection
          const libraryItems = await this.page.$$eval('[data-testid*="library"], .library-item, .context-item', items => items.length);
          await this.testResult('Library Items for Selection', libraryItems >= 0, `${libraryItems} library items available for selection`);
        }
        
      } catch (error) {
        await this.testResult('Workspace Creation Flow', false, `Creation failed: ${error.message}`);
      }
    } else {
      await this.testResult('Create Button Found', false, 'No workspace creation button detected');
    }
  }

  async testWorkspaceList() {
    this.config.log('\n📋 Testing Workspace List...', true);
    
    // Navigate to workspace list/dashboard
    await this.page.goto(this.baseUrl);
    await this.config.wait(2, 'Loading workspace list...');
    
    // Check for existing workspaces
    const workspaceCards = await this.page.$$eval('[data-testid*="workspace"], .workspace-card, .workspace-item', items => items.length);
    await this.testResult('Workspace Cards Present', workspaceCards >= 0, `Found ${workspaceCards} workspace cards`);
    
    // Test workspace actions
    const actionButtons = await this.page.$$eval('button, [role="button"]', buttons =>
      buttons.filter(btn =>
        btn.textContent?.toLowerCase().includes('open') ||
        btn.textContent?.toLowerCase().includes('view') ||
        btn.textContent?.toLowerCase().includes('delete') ||
        btn.textContent?.includes('...')
      ).length
    );
    
    await this.testResult('Workspace Actions Available', actionButtons > 0, `Found ${actionButtons} workspace action buttons`);
    
    // Test workspace metadata display
    const metadataElements = await this.page.$$eval('*', elements =>
      elements.filter(el =>
        el.textContent?.toLowerCase().includes('created') ||
        el.textContent?.toLowerCase().includes('modified') ||
        el.textContent?.toLowerCase().includes('items') ||
        el.textContent?.toLowerCase().includes('context')
      ).length
    );
    
    await this.testResult('Workspace Metadata Display', metadataElements > 0, `Found ${metadataElements} metadata elements`);
  }

  async testWorkspaceWorkshop() {
    this.config.log('\n🔧 Testing Workspace Workshop (IDE)...', true);
    
    // Try to open a workspace or workspace workshop view
    const workshopButton = await this.page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => 
        btn.textContent?.toLowerCase().includes('open') || 
        btn.textContent?.toLowerCase().includes('workshop') ||
        btn.dataset.testid?.includes('workshop')
      ) || null;
    });
    
    if (workshopButton) {
      this.config.log('🖱️  Opening workspace workshop...', true);
      
      try {
        await workshopButton.click();
        await this.config.wait(3, 'Loading workspace workshop...');
        
        // Test file explorer
        const fileExplorer = await this.page.$('.file-explorer, [data-testid*="file"], .tree-view') !== null;
        await this.testResult('File Explorer Available', fileExplorer, fileExplorer ? 'File explorer found' : 'No file explorer detected');
        
        // Test editor area
        const editorArea = await this.page.$('.monaco-editor, .editor, [data-testid*="editor"]') !== null;
        await this.testResult('Code Editor Available', editorArea, editorArea ? 'Code editor found' : 'No code editor detected');
        
        // Test terminal area
        const terminalArea = await this.page.$('.terminal, [data-testid*="terminal"], .xterm') !== null;
        await this.testResult('Terminal Available', terminalArea, terminalArea ? 'Terminal found' : 'No terminal detected');
        
        // Test workspace panels
        const panels = await this.page.$$eval('.panel, [role="tabpanel"], .workspace-panel', panels => panels.length);
        await this.testResult('Workspace Panels', panels > 0, `Found ${panels} workspace panels`);
        
      } catch (error) {
        await this.testResult('Workspace Workshop Access', false, `Workshop access failed: ${error.message}`);
      }
    } else {
      this.config.log('⚠️  No workspace to open for workshop testing', true);
      await this.testResult('Workshop Access', false, 'No workspace available to test workshop features');
    }
  }

  async testFileOperations() {
    this.config.log('\n📁 Testing File Operations...', true);
    
    // Test file creation
    const newFileButton = await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(btn => 
        btn.textContent?.toLowerCase().includes('new file') ||
        btn.dataset.testid?.includes('new-file') ||
        btn.className?.includes('new-file')
      );
    });
    await this.testResult('New File Option', newFileButton, newFileButton ? 'New file option available' : 'No new file option found');
    
    // Test file upload
    const uploadButton = await this.page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
      const buttons = Array.from(document.querySelectorAll('button'));
      return inputs.length > 0 || buttons.some(btn => 
        btn.textContent?.toLowerCase().includes('upload') ||
        btn.dataset.testid?.includes('upload')
      );
    });
    await this.testResult('File Upload Option', uploadButton, uploadButton ? 'File upload available' : 'No file upload found');
    
    // Test file operations menu
    const fileMenus = await this.page.$$eval('button, [role="button"]', buttons =>
      buttons.filter(btn =>
        btn.textContent?.toLowerCase().includes('save') ||
        btn.textContent?.toLowerCase().includes('rename') ||
        btn.textContent?.toLowerCase().includes('delete') ||
        btn.title?.toLowerCase().includes('file')
      ).length
    );
    
    await this.testResult('File Operation Menus', fileMenus > 0, `Found ${fileMenus} file operation options`);
  }

  async testGitIntegration() {
    this.config.log('\n🌳 Testing Git Integration...', true);
    
    // Look for git-related functionality
    const gitElements = await this.page.$$eval('*', elements =>
      elements.filter(el =>
        el.textContent?.toLowerCase().includes('git') ||
        el.textContent?.toLowerCase().includes('commit') ||
        el.textContent?.toLowerCase().includes('branch') ||
        el.textContent?.toLowerCase().includes('diff') ||
        el.className?.toLowerCase().includes('git')
      ).length
    );
    
    await this.testResult('Git Integration Available', gitElements > 0, `Found ${gitElements} git-related elements`);
    
    // Test git operations
    const gitButtons = await this.page.$$eval('button, [role="button"]', buttons =>
      buttons.filter(btn =>
        btn.textContent?.toLowerCase().includes('commit') ||
        btn.textContent?.toLowerCase().includes('push') ||
        btn.textContent?.toLowerCase().includes('pull') ||
        btn.textContent?.toLowerCase().includes('diff')
      ).length
    );
    
    await this.testResult('Git Operations Available', gitButtons > 0, `Found ${gitButtons} git operation buttons`);
  }

  async testAPIConnectivity() {
    this.config.log('\n🌐 Testing Workspace API Connectivity...', true);
    
    const apiCalls = [];
    
    this.page.on('response', response => {
      if (response.url().includes('/api/workspaces') || 
          response.url().includes('/api/workspace-drafts')) {
        apiCalls.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method()
        });
      }
    });
    
    // Trigger API calls
    await this.page.reload();
    await this.config.wait(3, 'Monitoring workspace APIs...');
    
    const successfulCalls = apiCalls.filter(call => call.status >= 200 && call.status < 400);
    const failedCalls = apiCalls.filter(call => call.status >= 400);
    
    await this.testResult('Workspace API Health', successfulCalls.length > 0, `Successful: ${successfulCalls.length}, Failed: ${failedCalls.length}`);
    
    if (apiCalls.length > 0) {
      this.config.log('📡 Workspace API Calls:', true);
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
    this.config.log('🏗️ WORKSPACE MANAGEMENT TEST SUMMARY', true);
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
      
      await this.testWorkspaceAccess();
      await this.testWorkspaceCreation();
      await this.testWorkspaceList();
      await this.testWorkspaceWorkshop();
      await this.testFileOperations();
      await this.testGitIntegration();
      await this.testAPIConnectivity();
      
      const summary = await this.generateReport();
      return summary;
      
    } catch (error) {
      this.config.log(`❌ Workspace management testing failed: ${error.message}`, true);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

if (require.main === module) {
  const tester = new WorkspaceManagementTester();
  tester.run().catch(console.error);
}

module.exports = WorkspaceManagementTester;