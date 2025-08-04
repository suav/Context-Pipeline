/**
 * Comprehensive UI Investigation using Puppeteer in Headful Mode
 * This script thoroughly tests all implemented features and identifies issues
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

// Configuration
const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = path.join(__dirname, 'ui-investigation-screenshots');
const RESULTS_FILE = path.join(__dirname, 'ui-investigation-results.json');

// Test results collector
const testResults = {
  timestamp: new Date().toISOString(),
  features: {},
  issues: [],
  recommendations: []
};

// Helper function to take screenshots
async function takeScreenshot(page, name, description) {
  const filename = `${name.replace(/\s+/g, '-').toLowerCase()}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Screenshot saved: ${filename} - ${description}`);
  return filename;
}

// Helper function to wait and check for elements
async function waitForElement(page, selector, timeout = 5000, required = true) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch (error) {
    if (required) {
      testResults.issues.push({
        type: 'missing-element',
        selector,
        message: `Required element not found: ${selector}`,
        timestamp: new Date().toISOString()
      });
    }
    return false;
  }
}

// Helper to record feature status
function recordFeature(name, status, details = {}) {
  testResults.features[name] = {
    status,
    tested: true,
    details,
    timestamp: new Date().toISOString()
  };
}

// Main test function
async function runComprehensiveUITest() {
  console.log('🚀 Starting Comprehensive UI Investigation\n');
  
  // Create screenshot directory
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  
  // Launch browser in headful mode
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--window-size=1920,1080']
  });
  
  const page = await browser.newPage();
  
  // Set up console message logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      testResults.issues.push({
        type: 'console-error',
        message: msg.text(),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Set up request failure logging
  page.on('requestfailed', request => {
    testResults.issues.push({
      type: 'network-error',
      url: request.url(),
      failure: request.failure().errorText,
      timestamp: new Date().toISOString()
    });
  });
  
  try {
    console.log('📍 Test 1: Homepage and Initial Load\n');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await takeScreenshot(page, '01-homepage', 'Initial homepage load');
    
    // Check main UI components
    const hasWorkspaceWorkshop = await waitForElement(page, '[data-testid="workspace-workshop"]', 5000, false);
    const hasSettingsButton = await page.$('.cursor-pointer svg') !== null;
    const hasCreateWorkspace = await page.$('button:has-text("Create New Workspace")') !== null;
    
    recordFeature('Homepage Load', 'success', {
      hasWorkspaceWorkshop,
      hasSettingsButton,
      hasCreateWorkspace
    });
    
    console.log('📍 Test 2: Settings and Credentials Management\n');
    if (hasSettingsButton) {
      // Click settings button
      await page.click('.cursor-pointer svg');
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '02-settings-open', 'Settings modal opened');
      
      // Check for credentials section
      const hasCredentialsSection = await waitForElement(page, 'h3:has-text("Credentials")', 2000, false);
      if (hasCredentialsSection) {
        recordFeature('Credentials Management', 'success');
        
        // Look for "Add New" button
        const addNewButton = await page.$('button:has-text("Add New")');
        if (addNewButton) {
          await addNewButton.click();
          await page.waitForTimeout(1000);
          await takeScreenshot(page, '03-add-credential', 'Add credential dialog');
          
          // Close dialog
          const closeButton = await page.$('button:has-text("Cancel")');
          if (closeButton) await closeButton.click();
        }
      } else {
        recordFeature('Credentials Management', 'missing');
      }
      
      // Close settings
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    
    console.log('📍 Test 3: Context Import Functionality\n');
    const importButton = await page.$('button:has-text("Import")');
    if (importButton) {
      await importButton.click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '04-import-modal', 'Import modal opened');
      
      // Check import sources
      const jiraTab = await page.$('button:has-text("JIRA")');
      const gitTab = await page.$('button:has-text("Git Repository")');
      
      recordFeature('Context Import', 'success', {
        hasJiraImport: !!jiraTab,
        hasGitImport: !!gitTab
      });
      
      if (gitTab) {
        await gitTab.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '05-git-import', 'Git import tab');
      }
      
      // Close import modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      recordFeature('Context Import', 'missing');
    }
    
    console.log('📍 Test 4: Workspace Creation and Management\n');
    // Try to create a workspace from library
    const libraryCards = await page.$$('.cursor-pointer[class*="border"]');
    if (libraryCards.length > 0) {
      console.log(`Found ${libraryCards.length} library items`);
      
      // Click first library item
      await libraryCards[0].click();
      await page.waitForTimeout(500);
      
      // Look for "Create Workspace" button
      const createWorkspaceButton = await page.$('button:has-text("Create Workspace")');
      if (createWorkspaceButton) {
        await createWorkspaceButton.click();
        await page.waitForTimeout(2000);
        await takeScreenshot(page, '06-workspace-created', 'Workspace created');
        
        recordFeature('Workspace Creation', 'success');
        
        // Check workspace UI components
        console.log('📍 Test 5: Workspace UI Components\n');
        
        // File tree
        const hasFileTree = await waitForElement(page, '[class*="file-tree"]', 3000, false);
        recordFeature('File Tree', hasFileTree ? 'success' : 'missing');
        
        // Editor area
        const hasMonacoEditor = await waitForElement(page, '.monaco-editor', 3000, false);
        recordFeature('Monaco Editor', hasMonacoEditor ? 'success' : 'missing');
        
        // Terminal area
        const hasTerminal = await waitForElement(page, '[class*="terminal"]', 3000, false);
        recordFeature('Terminal Area', hasTerminal ? 'success' : 'missing');
        
        // Tabs
        const tabs = await page.$$('[role="tab"]');
        console.log(`Found ${tabs.length} tabs`);
        
        await takeScreenshot(page, '07-workspace-ui', 'Workspace UI components');
        
        console.log('📍 Test 6: Agent Management\n');
        // Look for agent management
        const manageAgentsButton = await page.$('button:has-text("Manage Agents")');
        if (manageAgentsButton) {
          await manageAgentsButton.click();
          await page.waitForTimeout(1000);
          await takeScreenshot(page, '08-manage-agents', 'Manage Agents modal');
          
          // Check tabs
          const commandsTab = await page.$('button:has-text("Commands")');
          const permissionsTab = await page.$('button:has-text("Permissions")');
          const checkpointsTab = await page.$('button:has-text("Checkpoints")');
          
          recordFeature('Agent Management', 'success', {
            hasCommandsTab: !!commandsTab,
            hasPermissionsTab: !!permissionsTab,
            hasCheckpointsTab: !!checkpointsTab
          });
          
          // Test Permissions tab
          if (permissionsTab) {
            await permissionsTab.click();
            await page.waitForTimeout(500);
            await takeScreenshot(page, '09-permissions-tab', 'Permissions tab content');
            
            // Check for save button
            const saveButton = await page.$('button:has-text("Save")');
            if (!saveButton) {
              testResults.issues.push({
                type: 'missing-feature',
                feature: 'Permissions Save Button',
                message: 'Permissions tab has no save functionality',
                severity: 'high'
              });
            }
          }
          
          // Close modal
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        } else {
          recordFeature('Agent Management', 'missing');
        }
        
        console.log('📍 Test 7: Agent Interaction\n');
        // Look for agent cards
        const agentCards = await page.$$('[class*="agent-card"]');
        if (agentCards.length > 0) {
          console.log(`Found ${agentCards.length} agent cards`);
          
          // Click first agent
          await agentCards[0].click();
          await page.waitForTimeout(2000);
          
          // Check for terminal/chat interface
          const hasChatInterface = await waitForElement(page, '[class*="chat-interface"]', 3000, false);
          const hasInputField = await waitForElement(page, 'input[placeholder*="command"]', 3000, false);
          
          recordFeature('Agent Chat Interface', hasChatInterface && hasInputField ? 'success' : 'partial', {
            hasChatInterface,
            hasInputField
          });
          
          if (hasInputField) {
            await takeScreenshot(page, '10-agent-chat', 'Agent chat interface');
            
            // Test slash commands
            await page.type('input[placeholder*="command"]', '/');
            await page.waitForTimeout(500);
            
            const hasSlashCommands = await waitForElement(page, '[class*="slash-command"]', 2000, false);
            recordFeature('Slash Command Autocomplete', hasSlashCommands ? 'success' : 'missing');
            
            if (hasSlashCommands) {
              await takeScreenshot(page, '11-slash-commands', 'Slash command autocomplete');
            }
            
            // Clear input
            await page.keyboard.press('Escape');
            await page.click('input[placeholder*="command"]');
            await page.keyboard.down('Control');
            await page.keyboard.press('A');
            await page.keyboard.up('Control');
            await page.keyboard.press('Delete');
          }
        } else {
          recordFeature('Agent Cards', 'missing');
        }
        
        console.log('📍 Test 8: Git Integration\n');
        // Look for git status indicators
        const gitStatusElements = await page.$$('[class*="git-status"]');
        recordFeature('Git Status Display', gitStatusElements.length > 0 ? 'success' : 'missing');
        
        // Check for git operations
        const gitButtons = await page.$$('button:has-text("Git")');
        if (gitButtons.length > 0) {
          recordFeature('Git Operations', 'success');
        }
        
      } else {
        recordFeature('Workspace Creation', 'failed', {
          reason: 'Create Workspace button not found'
        });
      }
    } else {
      recordFeature('Context Library', 'empty');
      testResults.issues.push({
        type: 'no-content',
        feature: 'Context Library',
        message: 'No library items found to create workspace from'
      });
    }
    
    console.log('📍 Test 9: Performance and Responsiveness\n');
    // Test viewport changes
    await page.setViewport({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '12-tablet-view', 'Tablet viewport');
    
    await page.setViewport({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '13-mobile-view', 'Mobile viewport');
    
    // Check if UI is responsive
    const mobileMenu = await page.$('[class*="mobile-menu"]');
    recordFeature('Responsive Design', mobileMenu ? 'success' : 'partial');
    
    // Reset viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log('📍 Test 10: Error Handling\n');
    // Test 404 page
    await page.goto(`${BASE_URL}/nonexistent-page`, { waitUntil: 'networkidle2' });
    await takeScreenshot(page, '14-404-page', '404 error page');
    
    // Navigate back
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    
  } catch (error) {
    console.error('Test error:', error);
    testResults.issues.push({
      type: 'test-error',
      message: error.message,
      stack: error.stack
    });
  } finally {
    // Generate recommendations
    generateRecommendations();
    
    // Save results
    await fs.writeFile(RESULTS_FILE, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Results saved to: ${RESULTS_FILE}`);
    
    // Print summary
    printSummary();
    
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser left open for manual inspection. Press Ctrl+C to close.');
    
    // Wait for user to close
    await new Promise(() => {});
  }
}

function generateRecommendations() {
  // High priority issues
  const hasPermissionsSave = !testResults.issues.some(i => i.feature === 'Permissions Save Button');
  if (!hasPermissionsSave) {
    testResults.recommendations.push({
      priority: 'HIGH',
      category: 'Permissions',
      recommendation: 'Implement save functionality in Permissions tab to persist user selections'
    });
  }
  
  // Check for missing features
  Object.entries(testResults.features).forEach(([feature, data]) => {
    if (data.status === 'missing') {
      testResults.recommendations.push({
        priority: 'MEDIUM',
        category: 'Missing Feature',
        recommendation: `Implement or fix ${feature} functionality`
      });
    }
  });
  
  // Performance recommendations
  if (testResults.issues.filter(i => i.type === 'network-error').length > 5) {
    testResults.recommendations.push({
      priority: 'HIGH',
      category: 'Performance',
      recommendation: 'Investigate and fix network errors/failed requests'
    });
  }
  
  // Responsive design
  if (testResults.features['Responsive Design']?.status === 'partial') {
    testResults.recommendations.push({
      priority: 'LOW',
      category: 'UI/UX',
      recommendation: 'Improve mobile and tablet responsive design'
    });
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 UI INVESTIGATION SUMMARY');
  console.log('='.repeat(60) + '\n');
  
  // Feature summary
  const features = Object.entries(testResults.features);
  const successful = features.filter(([_, data]) => data.status === 'success').length;
  const partial = features.filter(([_, data]) => data.status === 'partial').length;
  const missing = features.filter(([_, data]) => data.status === 'missing').length;
  
  console.log('✅ Features Working:', successful);
  console.log('⚠️  Partial Implementation:', partial);
  console.log('❌ Missing/Failed:', missing);
  console.log(`📋 Total Features Tested: ${features.length}`);
  
  // Issues summary
  console.log(`\n🐛 Issues Found: ${testResults.issues.length}`);
  const issuesByType = {};
  testResults.issues.forEach(issue => {
    issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
  });
  Object.entries(issuesByType).forEach(([type, count]) => {
    console.log(`   - ${type}: ${count}`);
  });
  
  // Top recommendations
  console.log('\n🎯 TOP RECOMMENDATIONS:');
  testResults.recommendations
    .filter(r => r.priority === 'HIGH')
    .forEach((rec, i) => {
      console.log(`${i + 1}. [${rec.category}] ${rec.recommendation}`);
    });
  
  console.log('\n📸 Screenshots saved to:', SCREENSHOT_DIR);
}

// Run the test
runComprehensiveUITest().catch(console.error);