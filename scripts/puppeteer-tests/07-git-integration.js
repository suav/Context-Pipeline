const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Test 07: Git Integration
 * Tests git diff viewing, branch operations, and git workflow features
 */
async function testGitIntegration() {
  console.log('🔧 Test 07: Git Integration\n');
  
  let browser;
  const results = {
    testName: 'Git Integration',
    timestamp: new Date().toISOString(),
    passed: [],
    failed: [],
    screenshots: [],
    gitOperations: []
  };

  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ['--window-size=1920,1080'],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });
    await page.waitForTimeout(2000);

    // Test 1: Navigate to workspace for git testing
    console.log('🏗️ Entering workspace for git testing...');
    
    const workspaceCard = await page.$('[class*="workspace-card"], [class*="WorkspaceCard"]');
    if (workspaceCard) {
      await workspaceCard.click();
      await page.waitForTimeout(3000);
      results.passed.push('Workspace entered for git testing');
      await takeScreenshot(page, 'workspace-for-git', results);
    } else {
      results.failed.push('No workspace available for git testing');
      return;
    }

    // Test 2: Look for git-related UI elements
    console.log('🔍 Checking for git UI elements...');
    
    const gitButton = await page.$('button:has-text("Git"), button:has-text("Source Control"), [class*="git"]');
    const diffButton = await page.$('button:has-text("Diff"), button:has-text("Changes")');
    const branchIndicator = await page.$('[class*="branch"], :has-text("main"), :has-text("master")');
    
    let gitUIElements = 0;
    if (gitButton) { gitUIElements++; results.passed.push('Git button/menu found'); }
    if (diffButton) { gitUIElements++; results.passed.push('Diff viewing option found'); }
    if (branchIndicator) { gitUIElements++; results.passed.push('Branch indicator found'); }
    
    if (gitUIElements > 0) {
      results.passed.push(`Found ${gitUIElements} git-related UI elements`);
    } else {
      results.failed.push('No git UI elements found');
    }

    // Test 3: Test git status viewing
    console.log('📊 Testing git status viewing...');
    
    if (gitButton) {
      await gitButton.click();
      await page.waitForTimeout(2000);
      
      // Look for git status information
      const statusInfo = await page.$('[class*="status"], :has-text("clean"), :has-text("changes"), :has-text("modified")');
      if (statusInfo) {
        results.passed.push('Git status information visible');
        results.gitOperations.push('status_viewed');
      }
      
      await takeScreenshot(page, 'git-status-view', results);
    }

    // Test 4: Test git diff viewing
    console.log('📋 Testing git diff functionality...');
    
    // First, make a change to a file to create a diff
    const fileItem = await page.$('[class*="file-item"]:not([class*="folder"])');
    if (fileItem) {
      await fileItem.click();
      await page.waitForTimeout(2000);
      
      // Edit the file to create changes
      const editor = await page.$('.monaco-editor');
      if (editor) {
        await editor.click();
        await page.keyboard.press('End');
        await page.keyboard.press('Enter');
        await page.keyboard.type('// Git diff test change');
        await page.keyboard.down('Control');
        await page.keyboard.press('s');
        await page.keyboard.up('Control');
        await page.waitForTimeout(1500);
        
        results.passed.push('File modified to test git diff');
      }
    }

    // Now test diff viewing
    if (diffButton) {
      await diffButton.click();
      await page.waitForTimeout(2000);
      
      // Check for diff display
      const diffView = await page.$('[class*="diff"], [class*="change"], .diff-viewer');
      if (diffView) {
        results.passed.push('Git diff viewer opened');
        
        // Look for diff content indicators
        const addedLines = await page.$('[class*="added"], [class*="insertion"], :has-text("+")');
        const removedLines = await page.$('[class*="removed"], [class*="deletion"], :has-text("-")');
        
        if (addedLines || removedLines) {
          results.passed.push('Diff content visible with changes');
        }
        
        await takeScreenshot(page, 'git-diff-view', results);
        results.gitOperations.push('diff_viewed');
      }
    }

    // Test 5: Test branch information display
    console.log('🌲 Testing branch information...');
    
    const branchDisplay = await page.$('[class*="branch"], button:has-text("main"), button:has-text("master")');
    if (branchDisplay) {
      await branchDisplay.click();
      await page.waitForTimeout(1500);
      
      // Check for branch menu or info
      const branchMenu = await page.$('[class*="branch-menu"], [role="menu"]');
      if (branchMenu) {
        results.passed.push('Branch information/menu accessible');
        
        // Look for branch operations
        const branchOptions = await page.$$('button:has-text("Create"), button:has-text("Switch"), [role="menuitem"]');
        if (branchOptions.length > 0) {
          results.passed.push(`Found ${branchOptions.length} branch operation options`);
        }
        
        await takeScreenshot(page, 'branch-menu', results);
      }
    }

    // Test 6: Test commit staging/preparation
    console.log('📝 Testing commit staging...');
    
    const stageButton = await page.$('button:has-text("Stage"), button:has-text("Add"), [class*="stage"]');
    if (stageButton) {
      await stageButton.click();
      await page.waitForTimeout(1500);
      
      // Check for staged changes
      const stagedArea = await page.$('[class*="staged"], :has-text("staged")');
      if (stagedArea) {
        results.passed.push('File staging functionality works');
        results.gitOperations.push('changes_staged');
      }
    }

    // Test 7: Test commit message interface
    console.log('💬 Testing commit message interface...');
    
    const commitArea = await page.$('textarea[placeholder*="commit"], input[placeholder*="message"], [class*="commit-message"]');
    if (commitArea) {
      await commitArea.type('Test commit from automated testing');
      results.passed.push('Commit message input functional');
      
      // Look for commit button
      const commitButton = await page.$('button:has-text("Commit"), button:has-text("Create Commit")');
      if (commitButton) {
        results.passed.push('Commit button available');
        
        // Note: We won't actually commit to avoid polluting the workspace
        await takeScreenshot(page, 'commit-interface', results);
      }
    }

    // Test 8: Test git history/log viewing
    console.log('📚 Testing git history...');
    
    const historyButton = await page.$('button:has-text("History"), button:has-text("Log"), button:has-text("Timeline")');
    if (historyButton) {
      await historyButton.click();
      await page.waitForTimeout(2000);
      
      // Check for commit history
      const commitList = await page.$$('[class*="commit"], [class*="history-item"], li:has-text("commit")');
      if (commitList.length > 0) {
        results.passed.push(`Git history shows ${commitList.length} commits`);
        
        // Test viewing a specific commit
        const firstCommit = commitList[0];
        if (firstCommit) {
          await firstCommit.click();
          await page.waitForTimeout(1500);
          
          // Check for commit details
          const commitDetails = await page.$('[class*="commit-detail"], [class*="commit-info"]');
          if (commitDetails) {
            results.passed.push('Commit details viewable');
          }
        }
        
        await takeScreenshot(page, 'git-history', results);
        results.gitOperations.push('history_viewed');
      }
    }

    // Test 9: Test file blame/annotation
    console.log('👤 Testing file blame/annotation...');
    
    // Open a file and look for blame functionality
    const fileForBlame = await page.$('[class*="file-item"]:first-child');
    if (fileForBlame) {
      await fileForBlame.click();
      await page.waitForTimeout(2000);
      
      // Look for blame button or annotation
      const blameButton = await page.$('button:has-text("Blame"), button:has-text("Annotate"), [class*="blame"]');
      if (blameButton) {
        await blameButton.click();
        await page.waitForTimeout(2000);
        
        // Check for blame annotations
        const blameAnnotations = await page.$('[class*="blame"], [class*="annotation"]');
        if (blameAnnotations) {
          results.passed.push('Git blame/annotation functionality works');
          await takeScreenshot(page, 'git-blame', results);
        }
      }
    }

    // Test 10: Test remote operations interface
    console.log('🌐 Testing remote operations...');
    
    const remoteButton = await page.$('button:has-text("Remote"), button:has-text("Origin"), button:has-text("Push")');
    if (remoteButton) {
      await remoteButton.click();
      await page.waitForTimeout(1500);
      
      // Check for remote operations
      const remoteOptions = await page.$$('button:has-text("Push"), button:has-text("Pull"), button:has-text("Fetch")');
      if (remoteOptions.length > 0) {
        results.passed.push(`Found ${remoteOptions.length} remote operation options`);
        
        // Don't actually perform remote operations to avoid affecting repository
        results.gitOperations.push('remote_interface_accessed');
      }
    }

    // Test 11: Test merge conflict resolution interface
    console.log('🔀 Checking for merge conflict tools...');
    
    const mergeTools = await page.$('button:has-text("Merge"), button:has-text("Resolve"), [class*="conflict"]');
    if (mergeTools) {
      results.passed.push('Merge conflict resolution tools available');
    }

    // Test 12: Test git configuration access
    console.log('⚙️ Testing git configuration access...');
    
    const gitSettings = await page.$('button:has-text("Git Settings"), button:has-text("Git Config")');
    if (gitSettings) {
      await gitSettings.click();
      await page.waitForTimeout(1500);
      
      // Check for configuration options
      const configOptions = await page.$('[class*="config"], [class*="settings"]');
      if (configOptions) {
        results.passed.push('Git configuration accessible');
      }
    }

    // Test 13: Test workspace git initialization
    console.log('🔄 Testing git workspace initialization...');
    
    // This would test if workspace can be initialized as git repo
    const initButton = await page.$('button:has-text("Initialize"), button:has-text("Init Git")');
    if (initButton) {
      results.passed.push('Git initialization option available');
    }

    // Test 14: Test git integration with file explorer
    console.log('🗂️ Testing git integration with file explorer...');
    
    // Check for git status indicators on files
    const fileWithStatus = await page.$('[class*="git-status"], [class*="modified"], [class*="untracked"]');
    if (fileWithStatus) {
      results.passed.push('Git status indicators visible in file explorer');
    }

    // Test 15: Test diff navigation
    console.log('🧭 Testing diff navigation...');
    
    if (diffView) {
      const nextDiffButton = await page.$('button:has-text("Next"), button:has-text("⬇"), [class*="next-diff"]');
      const prevDiffButton = await page.$('button:has-text("Previous"), button:has-text("⬆"), [class*="prev-diff"]');
      
      if (nextDiffButton || prevDiffButton) {
        results.passed.push('Diff navigation controls available');
      }
    }

    await takeScreenshot(page, 'final-git-state', results);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    results.failed.push(`Fatal error: ${error.message}`);
  } finally {
    if (browser) {
      console.log('\n⏸️  Keeping browser open for 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      await browser.close();
    }
  }

  await saveResults(results);
  
  console.log('\n' + '='.repeat(60));
  console.log('🔧 GIT INTEGRATION TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`📸 Screenshots: ${results.screenshots.length}`);
  console.log(`🔧 Git Operations: ${results.gitOperations.length}`);
  
  if (results.passed.length > 0) {
    console.log('\n✅ Passed tests:');
    results.passed.forEach(test => console.log(`   • ${test}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed tests:');
    results.failed.forEach(test => console.log(`   • ${test}`));
  }
  
  if (results.gitOperations.length > 0) {
    console.log('\n🔧 Git operations tested:');
    results.gitOperations.forEach(op => console.log(`   • ${op}`));
  }
  
  return results.failed.length === 0;
}

async function takeScreenshot(page, name, results) {
  const dir = path.join(__dirname, 'screenshots', '07-git-integration');
  await fs.mkdir(dir, { recursive: true });
  const filepath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  results.screenshots.push({ name, path: filepath });
}

async function saveResults(results) {
  const dir = path.join(__dirname, 'results');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, '07-git-integration-results.json'),
    JSON.stringify(results, null, 2)
  );
}

if (require.main === module) {
  testGitIntegration().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testGitIntegration };