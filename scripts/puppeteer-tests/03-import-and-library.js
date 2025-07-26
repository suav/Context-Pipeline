const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Test 03: Import and Library Management
 * Tests importing from different sources and managing library items
 */
async function testImportAndLibrary() {
  console.log('📥 Test 03: Import and Library Management\n');
  
  let browser;
  const results = {
    testName: 'Import and Library Management',
    timestamp: new Date().toISOString(),
    passed: [],
    failed: [],
    screenshots: []
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

    // Test 1: Find and click import button
    console.log('📥 Testing import button access...');
    
    // Look for import button - might be in different locations
    let importButton = await page.$('button:has-text("Import"), button:has-text("📥")');
    
    if (!importButton) {
      // Try to access library view first
      const libraryButton = await page.$('button:has-text("Library"), button:has-text("📚")');
      if (libraryButton) {
        await libraryButton.click();
        await page.waitForTimeout(1500);
        importButton = await page.$('button:has-text("Import"), button:has-text("📥")');
      }
    }

    if (importButton) {
      results.passed.push('Import button found');
      await takeScreenshot(page, 'before-import', results);
      await importButton.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, 'import-modal-open', results);
    } else {
      results.failed.push('Import button not accessible');
      // Try alternative navigation
      console.log('🔍 Trying alternative import access...');
      
      // Look for a "+" button or "Add" button
      const addButton = await page.$('button:has-text("+"), button:has-text("Add"), button[class*="add"]');
      if (addButton) {
        await addButton.click();
        await page.waitForTimeout(1500);
        importButton = await page.$('button:has-text("Import")');
        if (importButton) {
          await importButton.click();
          await page.waitForTimeout(2000);
          results.passed.push('Import accessed via alternative path');
        }
      }
    }

    // Test 2: Validate import modal structure
    console.log('🏗️ Validating import modal structure...');
    const modal = await page.$('[role="dialog"], .modal, [class*="modal"]');
    if (modal) {
      results.passed.push('Import modal opened');
      
      // Check for source selection buttons
      const sourceButtons = await page.$$('button:has-text("JIRA"), button:has-text("Git"), button:has-text("GitHub"), button:has-text("Text"), button:has-text("File")');
      if (sourceButtons.length > 0) {
        results.passed.push(`Found ${sourceButtons.length} import source options`);
      } else {
        results.failed.push('No import source options found');
      }
    } else {
      results.failed.push('Import modal not opened');
    }

    // Test 3: Test JIRA import
    console.log('🎫 Testing JIRA import workflow...');
    const jiraButton = await page.$('button:has-text("JIRA")');
    if (jiraButton) {
      await jiraButton.click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'jira-import-form', results);
      
      // Check for credential selector
      const credentialSelector = await page.$('select[class*="credential"], div:has-text("Select"), button:has-text("Credential")');
      if (credentialSelector) {
        results.passed.push('JIRA credential selector found');
        
        // Try to select a credential if available
        await credentialSelector.click();
        await page.waitForTimeout(1000);
        
        const credentialOption = await page.$('option, button:has-text("Test")');
        if (credentialOption) {
          await credentialOption.click();
          results.passed.push('JIRA credential selected');
        }
      }
      
      // Check for project/query fields
      const projectField = await page.$('input[placeholder*="project"], input[name*="project"]');
      const jqlField = await page.$('textarea[placeholder*="JQL"], textarea[name*="query"]');
      
      if (projectField) {
        await projectField.type('TEST');
        results.passed.push('JIRA project field filled');
      }
      
      if (jqlField) {
        await jqlField.type('project = TEST AND status = "To Do"');
        results.passed.push('JIRA JQL query entered');
      }
      
      // Try to preview or import
      const previewButton = await page.$('button:has-text("Preview"), button:has-text("Test")');
      if (previewButton) {
        await previewButton.click();
        await page.waitForTimeout(3000); // Allow time for API call
        results.passed.push('JIRA preview attempted');
        await takeScreenshot(page, 'jira-preview', results);
      }
    }

    // Test 4: Test Git import
    console.log('🐙 Testing Git import workflow...');
    const gitButton = await page.$('button:has-text("Git"), button:has-text("GitHub")');
    if (gitButton) {
      await gitButton.click();
      await page.waitForTimeout(1500);
      
      // Check for repository URL field
      const repoField = await page.$('input[placeholder*="repository"], input[placeholder*="URL"], input[name*="repo"]');
      if (repoField) {
        await repoField.type('https://github.com/example/test-repo');
        results.passed.push('Git repository URL entered');
        
        // Check for branch selection
        const branchField = await page.$('input[placeholder*="branch"], select[name*="branch"]');
        if (branchField) {
          await branchField.click();
          await branchField.type('main');
          results.passed.push('Git branch specified');
        }
        
        // Check for path filtering
        const pathField = await page.$('input[placeholder*="path"], input[placeholder*="filter"]');
        if (pathField) {
          await pathField.type('src/');
          results.passed.push('Git path filter set');
        }
        
        await takeScreenshot(page, 'git-import-form', results);
      }
    }

    // Test 5: Test file upload import
    console.log('📁 Testing file upload import...');
    const fileButton = await page.$('button:has-text("File"), button:has-text("Upload")');
    if (fileButton) {
      await fileButton.click();
      await page.waitForTimeout(1500);
      
      // Check for file input
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        results.passed.push('File upload input found');
        
        // Create a test file
        const testFile = path.join(__dirname, 'test-file.txt');
        await fs.writeFile(testFile, 'This is a test file for import testing');
        
        // Upload file
        await fileInput.uploadFile(testFile);
        await page.waitForTimeout(2000);
        results.passed.push('Test file uploaded');
        
        // Clean up
        await fs.unlink(testFile);
        
        await takeScreenshot(page, 'file-upload', results);
      }
    }

    // Test 6: Test text import
    console.log('📝 Testing text import...');
    const textButton = await page.$('button:has-text("Text"), button:has-text("Manual")');
    if (textButton) {
      await textButton.click();
      await page.waitForTimeout(1500);
      
      // Find text area
      const textArea = await page.$('textarea[placeholder*="text"], textarea[name*="content"]');
      if (textArea) {
        await textArea.type('This is a test text import.\n\nIt contains multiple lines\nand should be processed correctly.');
        results.passed.push('Text content entered');
        
        // Check for title field
        const titleField = await page.$('input[placeholder*="title"], input[name*="title"]');
        if (titleField) {
          await titleField.type('Test Text Import');
          results.passed.push('Text import title set');
        }
        
        await takeScreenshot(page, 'text-import', results);
      }
    }

    // Test 7: Complete an import
    console.log('✅ Testing import completion...');
    const importActionButton = await page.$('button:has-text("Import"), button:has-text("Add to Library"), button:has-text("Save")');
    if (importActionButton) {
      await importActionButton.click();
      await page.waitForTimeout(3000); // Allow processing time
      
      // Look for success message
      const successMsg = await page.$(':has-text("Success"), :has-text("Added"), :has-text("Imported"), .success');
      if (successMsg) {
        results.passed.push('Import completed successfully');
      } else {
        // Check for error messages
        const errorMsg = await page.$(':has-text("Error"), :has-text("Failed"), .error');
        if (errorMsg) {
          results.failed.push('Import failed with error');
        }
      }
      
      await takeScreenshot(page, 'import-completed', results);
    }

    // Test 8: Navigate to library view
    console.log('📚 Testing library view navigation...');
    
    // Close import modal if still open
    const closeButton = await page.$('button:has-text("✕"), button:has-text("Close")');
    if (closeButton) {
      await closeButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Navigate to library
    const libraryButton = await page.$('button:has-text("Library"), button:has-text("📚")');
    if (libraryButton) {
      await libraryButton.click();
      await page.waitForTimeout(2000);
      results.passed.push('Library view accessed');
      await takeScreenshot(page, 'library-view', results);
    }

    // Test 9: Verify imported items in library
    console.log('🔍 Verifying library items...');
    const libraryItems = await page.$$('[class*="library-item"], [class*="LibraryCard"], .library-card');
    if (libraryItems.length > 0) {
      results.passed.push(`Found ${libraryItems.length} items in library`);
      
      // Test item interaction
      const firstItem = libraryItems[0];
      if (firstItem) {
        await firstItem.click();
        await page.waitForTimeout(1500);
        
        // Check for item details/preview
        const itemDetails = await page.$('[class*="detail"], [class*="preview"], .item-content');
        if (itemDetails) {
          results.passed.push('Library item details shown');
        }
        
        await takeScreenshot(page, 'library-item-details', results);
      }
    } else {
      results.failed.push('No items found in library');
    }

    // Test 10: Test library item management
    console.log('🗂️ Testing library item management...');
    
    // Look for item action buttons
    const editButton = await page.$('button:has-text("Edit"), button[class*="edit"]');
    const deleteButton = await page.$('button:has-text("Delete"), button[class*="delete"]');
    const archiveButton = await page.$('button:has-text("Archive"), button[class*="archive"]');
    
    let actions = 0;
    if (editButton) { actions++; results.passed.push('Edit button found'); }
    if (deleteButton) { actions++; results.passed.push('Delete button found'); }
    if (archiveButton) { actions++; results.passed.push('Archive button found'); }
    
    if (actions > 0) {
      results.passed.push(`${actions} library management actions available`);
    }

    // Test archive functionality if available
    if (archiveButton) {
      await archiveButton.click();
      await page.waitForTimeout(2000);
      
      // Confirm archive if modal appears
      const confirmButton = await page.$('button:has-text("Archive"), button:has-text("Confirm")');
      if (confirmButton) {
        await confirmButton.click();
        await page.waitForTimeout(1500);
        results.passed.push('Library item archived');
      }
    }

    await takeScreenshot(page, 'final-library-state', results);

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
  console.log('📥 IMPORT & LIBRARY TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`📸 Screenshots: ${results.screenshots.length}`);
  
  if (results.passed.length > 0) {
    console.log('\n✅ Passed tests:');
    results.passed.forEach(test => console.log(`   • ${test}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed tests:');
    results.failed.forEach(test => console.log(`   • ${test}`));
  }
  
  return results.failed.length === 0;
}

async function takeScreenshot(page, name, results) {
  const dir = path.join(__dirname, 'screenshots', '03-import-library');
  await fs.mkdir(dir, { recursive: true });
  const filepath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  results.screenshots.push({ name, path: filepath });
}

async function saveResults(results) {
  const dir = path.join(__dirname, 'results');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, '03-import-library-results.json'),
    JSON.stringify(results, null, 2)
  );
}

if (require.main === module) {
  testImportAndLibrary().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testImportAndLibrary };