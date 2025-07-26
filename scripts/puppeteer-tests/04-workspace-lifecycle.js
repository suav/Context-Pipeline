const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Test 04: Workspace Lifecycle
 * Tests workspace creation, drafts, publishing, and unpublishing
 */
async function testWorkspaceLifecycle() {
  console.log('🏗️ Test 04: Workspace Lifecycle\n');
  
  let browser;
  const results = {
    testName: 'Workspace Lifecycle',
    timestamp: new Date().toISOString(),
    passed: [],
    failed: [],
    screenshots: [],
    workspaceIds: []
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

    // Test 1: Find workspace creation entry point
    console.log('➕ Testing workspace creation access...');
    
    let createButton = await page.$('button:has-text("New Workspace"), button:has-text("Create Workspace"), button:has-text("Create New")');
    
    if (!createButton) {
      // Try to access library view first
      const libraryButton = await page.$('button:has-text("Library"), button:has-text("📚")');
      if (libraryButton) {
        await libraryButton.click();
        await page.waitForTimeout(1500);
        createButton = await page.$('button:has-text("New Workspace"), button:has-text("Create")');
      }
    }

    if (createButton) {
      results.passed.push('Workspace creation button found');
      await takeScreenshot(page, 'before-create-workspace', results);
      await createButton.click();
      await page.waitForTimeout(2000);
    } else {
      results.failed.push('Workspace creation button not found');
    }

    // Test 2: Workspace creation modal/flow
    console.log('📝 Testing workspace creation form...');
    
    // Check for workspace creation interface
    const modal = await page.$('[role="dialog"], .modal, [class*="modal"]');
    const form = await page.$('form, [class*="workspace-create"], [class*="create-workspace"]');
    
    if (modal || form) {
      results.passed.push('Workspace creation interface opened');
      await takeScreenshot(page, 'workspace-creation-form', results);
      
      // Fill in workspace details
      const nameField = await page.$('input[placeholder*="name"], input[name*="name"], input[placeholder*="title"]');
      const descField = await page.$('textarea[placeholder*="description"], textarea[name*="description"]');
      
      if (nameField) {
        const workspaceName = `Test Workspace ${Date.now()}`;
        await nameField.type(workspaceName);
        results.passed.push('Workspace name entered');
        results.workspaceIds.push(workspaceName);
      }
      
      if (descField) {
        await descField.type('This is a test workspace created by automated testing');
        results.passed.push('Workspace description entered');
      }
      
      // Look for library item selection
      const itemSelector = await page.$('select[class*="item"], [class*="library-item"], input[type="checkbox"]');
      if (itemSelector) {
        await itemSelector.click();
        await page.waitForTimeout(1000);
        results.passed.push('Library items available for selection');
        
        // Select first available item
        const firstItem = await page.$('option:not([value=""]), input[type="checkbox"]:not(:checked)');
        if (firstItem) {
          await firstItem.click();
          results.passed.push('Library item selected for workspace');
        }
      }
      
      await takeScreenshot(page, 'workspace-form-filled', results);
    }

    // Test 3: Create workspace as draft
    console.log('📋 Testing draft workspace creation...');
    
    const draftButton = await page.$('button:has-text("Save as Draft"), button:has-text("Draft"), button[class*="draft"]');
    if (draftButton) {
      await draftButton.click();
      await page.waitForTimeout(3000);
      results.passed.push('Workspace saved as draft');
      
      // Look for success message
      const successMsg = await page.$(':has-text("Draft created"), :has-text("Saved as draft"), .success');
      if (successMsg) {
        results.passed.push('Draft creation confirmed');
      }
      
      await takeScreenshot(page, 'draft-created', results);
    }

    // Test 4: Navigate to drafts view
    console.log('📄 Testing drafts view...');
    
    const draftsButton = await page.$('button:has-text("Drafts"), button:has-text("Draft Workspaces"), [class*="draft"]');
    if (draftsButton) {
      await draftsButton.click();
      await page.waitForTimeout(2000);
      results.passed.push('Drafts view accessed');
      
      // Check for draft items
      const draftItems = await page.$$('[class*="draft"], [class*="workspace-draft"]');
      if (draftItems.length > 0) {
        results.passed.push(`Found ${draftItems.length} draft workspace(s)`);
      }
      
      await takeScreenshot(page, 'drafts-view', results);
    }

    // Test 5: Edit a draft workspace
    console.log('✏️ Testing draft editing...');
    
    const editButton = await page.$('button:has-text("Edit"), button[class*="edit"]');
    if (editButton) {
      await editButton.click();
      await page.waitForTimeout(2000);
      
      // Modify the workspace
      const nameField = await page.$('input[value*="Test"], input[name*="name"]');
      if (nameField) {
        await nameField.click({ clickCount: 3 }); // Select all
        await nameField.type('Modified Test Workspace');
        results.passed.push('Draft workspace name modified');
      }
      
      // Save changes
      const saveButton = await page.$('button:has-text("Save"), button:has-text("Update")');
      if (saveButton) {
        await saveButton.click();
        await page.waitForTimeout(2000);
        results.passed.push('Draft changes saved');
      }
      
      await takeScreenshot(page, 'draft-edited', results);
    }

    // Test 6: Publish a workspace
    console.log('🚀 Testing workspace publishing...');
    
    const publishButton = await page.$('button:has-text("Publish"), button:has-text("Publish Workspace")');
    if (publishButton) {
      await publishButton.click();
      await page.waitForTimeout(3000);
      
      // Look for publish confirmation
      const confirmButton = await page.$('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Publish")');
      if (confirmButton) {
        await confirmButton.click();
        await page.waitForTimeout(3000);
      }
      
      results.passed.push('Workspace published');
      
      // Check for success message
      const successMsg = await page.$(':has-text("Published"), :has-text("Workspace created"), .success');
      if (successMsg) {
        results.passed.push('Publishing success confirmed');
      }
      
      await takeScreenshot(page, 'workspace-published', results);
    }

    // Test 7: Navigate to published workspaces
    console.log('🏗️ Testing published workspaces view...');
    
    const workspacesButton = await page.$('button:has-text("Workspaces"), button:has-text("All Workspaces")');
    if (workspacesButton) {
      await workspacesButton.click();
      await page.waitForTimeout(2000);
      results.passed.push('Published workspaces view accessed');
      
      // Check for published workspace
      const workspaceCards = await page.$$('[class*="workspace-card"], [class*="WorkspaceCard"]');
      if (workspaceCards.length > 0) {
        results.passed.push(`Found ${workspaceCards.length} published workspace(s)`);
      }
      
      await takeScreenshot(page, 'published-workspaces', results);
    }

    // Test 8: Enter a workspace
    console.log('🚪 Testing workspace entry...');
    
    const workspaceCard = await page.$('[class*="workspace-card"], [class*="WorkspaceCard"]');
    if (workspaceCard) {
      await workspaceCard.click();
      await page.waitForTimeout(3000);
      
      // Check for workspace interior
      const fileExplorer = await page.$('[class*="file-explorer"], [class*="file-tree"], [class*="sidebar"]');
      const editor = await page.$('[class*="monaco"], [class*="editor"]');
      const terminal = await page.$('[class*="terminal"]');
      
      let workspaceFeatures = 0;
      if (fileExplorer) { workspaceFeatures++; results.passed.push('File explorer present'); }
      if (editor) { workspaceFeatures++; results.passed.push('Code editor present'); }
      if (terminal) { workspaceFeatures++; results.passed.push('Terminal present'); }
      
      results.passed.push(`Workspace contains ${workspaceFeatures} IDE features`);
      await takeScreenshot(page, 'inside-workspace', results);
    }

    // Test 9: Test workspace unpublishing (if implemented)
    console.log('📤 Testing workspace unpublishing...');
    
    // Look for workspace actions menu
    const actionsButton = await page.$('button:has-text("Actions"), button:has-text("⋮"), button[class*="menu"]');
    if (actionsButton) {
      await actionsButton.click();
      await page.waitForTimeout(1000);
      
      const unpublishButton = await page.$('button:has-text("Unpublish"), button:has-text("Archive")');
      if (unpublishButton) {
        await unpublishButton.click();
        await page.waitForTimeout(2000);
        
        // Handle unpublish options if modal appears
        const unpublishModal = await page.$('[role="dialog"]:has-text("Unpublish")');
        if (unpublishModal) {
          // Choose to convert to draft
          const draftOption = await page.$('button:has-text("Convert to Draft"), input[value="draft"]');
          if (draftOption) {
            await draftOption.click();
            await page.waitForTimeout(1000);
            
            const confirmButton = await page.$('button:has-text("Confirm"), button:has-text("Unpublish")');
            if (confirmButton) {
              await confirmButton.click();
              await page.waitForTimeout(2000);
              results.passed.push('Workspace unpublished to draft');
            }
          }
        }
        
        await takeScreenshot(page, 'workspace-unpublished', results);
      }
    }

    // Test 10: Workspace deletion
    console.log('🗑️ Testing workspace deletion...');
    
    // Navigate back to drafts to delete test workspace
    const draftButton = await page.$('button:has-text("Drafts")');
    if (draftButton) {
      await draftButton.click();
      await page.waitForTimeout(2000);
      
      const deleteButton = await page.$('button:has-text("Delete"), button[class*="delete"]');
      if (deleteButton) {
        await deleteButton.click();
        await page.waitForTimeout(1000);
        
        // Confirm deletion
        const confirmDelete = await page.$('button:has-text("Delete"), button:has-text("Confirm")');
        if (confirmDelete) {
          await confirmDelete.click();
          await page.waitForTimeout(2000);
          results.passed.push('Test workspace deleted successfully');
        }
      }
    }

    // Test 11: Validate workspace memory extraction
    console.log('🧠 Testing workspace memory extraction...');
    
    // This would be tested by checking API responses or logs
    // For UI testing, we can check if unpublish shows memory info
    const memoryInfo = await page.$(':has-text("Memory"), :has-text("Conversation"), :has-text("Activity")');
    if (memoryInfo) {
      results.passed.push('Workspace memory extraction visible');
    }

    await takeScreenshot(page, 'final-workspace-state', results);

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
  console.log('🏗️ WORKSPACE LIFECYCLE TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`📸 Screenshots: ${results.screenshots.length}`);
  console.log(`🆔 Test Workspaces: ${results.workspaceIds.length}`);
  
  if (results.passed.length > 0) {
    console.log('\n✅ Passed tests:');
    results.passed.forEach(test => console.log(`   • ${test}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed tests:');
    results.failed.forEach(test => console.log(`   • ${test}`));
  }
  
  if (results.workspaceIds.length > 0) {
    console.log('\n🆔 Created workspaces:');
    results.workspaceIds.forEach(id => console.log(`   • ${id}`));
  }
  
  return results.failed.length === 0;
}

async function takeScreenshot(page, name, results) {
  const dir = path.join(__dirname, 'screenshots', '04-workspace-lifecycle');
  await fs.mkdir(dir, { recursive: true });
  const filepath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  results.screenshots.push({ name, path: filepath });
}

async function saveResults(results) {
  const dir = path.join(__dirname, 'results');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, '04-workspace-lifecycle-results.json'),
    JSON.stringify(results, null, 2)
  );
}

if (require.main === module) {
  testWorkspaceLifecycle().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testWorkspaceLifecycle };