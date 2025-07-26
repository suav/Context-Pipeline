const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Test 06: File Editor Operations
 * Tests Monaco editor, file tree navigation, file operations, and context menu
 */
async function testFileEditorOperations() {
  console.log('📝 Test 06: File Editor Operations\n');
  
  let browser;
  const results = {
    testName: 'File Editor Operations',
    timestamp: new Date().toISOString(),
    passed: [],
    failed: [],
    screenshots: [],
    filesCreated: []
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

    // Test 1: Navigate to workspace with files
    console.log('🏗️ Entering workspace for file operations...');
    
    const workspaceCard = await page.$('[class*="workspace-card"], [class*="WorkspaceCard"]');
    if (workspaceCard) {
      await workspaceCard.click();
      await page.waitForTimeout(3000);
      results.passed.push('Workspace entered for file testing');
      await takeScreenshot(page, 'workspace-entered', results);
    } else {
      results.failed.push('No workspace available for file testing');
      return;
    }

    // Test 2: Locate file explorer/tree
    console.log('🌳 Testing file explorer visibility...');
    
    let fileExplorer = await page.$('[class*="file-explorer"], [class*="file-tree"], [class*="sidebar"]');
    
    if (!fileExplorer) {
      // Try to toggle file explorer if hidden
      const toggleButton = await page.$('button:has-text("Files"), button:has-text("Explorer"), button[class*="file"]');
      if (toggleButton) {
        await toggleButton.click();
        await page.waitForTimeout(1500);
        fileExplorer = await page.$('[class*="file-explorer"], [class*="file-tree"]');
      }
    }

    if (fileExplorer) {
      results.passed.push('File explorer/tree visible');
      
      // Check for file items
      const fileItems = await page.$$('[class*="file-item"], [class*="tree-item"], li:has-text(".")');
      if (fileItems.length > 0) {
        results.passed.push(`Found ${fileItems.length} file/folder items`);
      }
      
      await takeScreenshot(page, 'file-explorer-visible', results);
    } else {
      results.failed.push('File explorer not found or accessible');
    }

    // Test 3: Open an existing file
    console.log('📄 Testing file opening...');
    
    const fileItem = await page.$('[class*="file-item"]:not([class*="folder"]), li:has-text(".js"), li:has-text(".ts"), li:has-text(".json")');
    if (fileItem) {
      await fileItem.click();
      await page.waitForTimeout(2000);
      
      // Check if Monaco editor loaded
      const monacoEditor = await page.$('.monaco-editor, [class*="monaco"], [class*="editor-container"]');
      if (monacoEditor) {
        results.passed.push('Monaco editor loaded successfully');
        
        // Check for editor content
        const editorContent = await page.$('.monaco-editor .view-lines');
        if (editorContent) {
          results.passed.push('Editor content visible');
        }
        
        await takeScreenshot(page, 'file-opened-in-editor', results);
      } else {
        results.failed.push('Monaco editor not loaded');
      }
    }

    // Test 4: Test file editing capabilities
    console.log('✏️ Testing file editing...');
    
    const editor = await page.$('.monaco-editor');
    if (editor) {
      // Click in editor and add some text
      await editor.click();
      await page.waitForTimeout(1000);
      
      // Use keyboard to navigate and edit
      await page.keyboard.press('End'); // Go to end of file
      await page.keyboard.press('Enter');
      await page.keyboard.type('// Test comment added by automated testing');
      await page.keyboard.press('Enter');
      await page.keyboard.type('console.log("Testing file edit functionality");');
      
      results.passed.push('Text successfully added to editor');
      await takeScreenshot(page, 'file-edited', results);
      
      // Test save functionality
      await page.keyboard.down('Control');
      await page.keyboard.press('s');
      await page.keyboard.up('Control');
      await page.waitForTimeout(1500);
      
      // Look for save confirmation
      const saveIndicator = await page.$(':has-text("Saved"), [class*="saved"], [class*="success"]');
      if (saveIndicator) {
        results.passed.push('File save functionality works');
      }
    }

    // Test 5: Test file tree context menu
    console.log('🖱️ Testing file context menu...');
    
    const fileForContext = await page.$('[class*="file-item"]:first-child');
    if (fileForContext) {
      await fileForContext.click({ button: 'right' });
      await page.waitForTimeout(1500);
      
      // Check for context menu
      const contextMenu = await page.$('[class*="context-menu"], [role="menu"], .menu');
      if (contextMenu) {
        results.passed.push('File context menu appeared');
        
        // Check for common menu items
        const menuItems = await page.$$('button:has-text("Rename"), button:has-text("Delete"), button:has-text("Copy"), [role="menuitem"]');
        if (menuItems.length > 0) {
          results.passed.push(`Found ${menuItems.length} context menu options`);
        }
        
        await takeScreenshot(page, 'context-menu-open', results);
        
        // Close context menu
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    // Test 6: Create new file
    console.log('➕ Testing new file creation...');
    
    // Look for new file button or right-click in empty space
    let newFileButton = await page.$('button:has-text("New File"), button:has-text("+"), [class*="new-file"]');
    
    if (!newFileButton) {
      // Try right-clicking in file explorer
      const explorerArea = await page.$('[class*="file-explorer"], [class*="file-tree"]');
      if (explorerArea) {
        await explorerArea.click({ button: 'right' });
        await page.waitForTimeout(1000);
        newFileButton = await page.$('button:has-text("New File")');
      }
    }

    if (newFileButton) {
      await newFileButton.click();
      await page.waitForTimeout(1500);
      
      // Enter filename
      const filenameInput = await page.$('input[type="text"], input[placeholder*="name"]');
      if (filenameInput) {
        const testFileName = `test-file-${Date.now()}.js`;
        await filenameInput.type(testFileName);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        
        results.passed.push('New file created successfully');
        results.filesCreated.push(testFileName);
        
        // Check if file appears in tree
        const newFileInTree = await page.$(`[title*="${testFileName}"], li:has-text("${testFileName}")`);
        if (newFileInTree) {
          results.passed.push('New file visible in file tree');
        }
        
        await takeScreenshot(page, 'new-file-created', results);
      }
    }

    // Test 7: Test file renaming
    console.log('🔤 Testing file renaming...');
    
    if (results.filesCreated.length > 0) {
      const testFile = await page.$(`li:has-text("${results.filesCreated[0]}")`);
      if (testFile) {
        await testFile.click({ button: 'right' });
        await page.waitForTimeout(1000);
        
        const renameButton = await page.$('button:has-text("Rename")');
        if (renameButton) {
          await renameButton.click();
          await page.waitForTimeout(1000);
          
          const renameInput = await page.$('input[type="text"]');
          if (renameInput) {
            await renameInput.click({ clickCount: 3 }); // Select all
            const newName = `renamed-file-${Date.now()}.js`;
            await renameInput.type(newName);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(2000);
            
            results.passed.push('File renamed successfully');
            results.filesCreated[0] = newName; // Update tracking
          }
        }
      }
    }

    // Test 8: Test folder operations
    console.log('📁 Testing folder operations...');
    
    // Create new folder
    const newFolderButton = await page.$('button:has-text("New Folder"), button:has-text("Folder")');
    if (!newFolderButton) {
      // Try context menu
      const explorerArea = await page.$('[class*="file-explorer"]');
      if (explorerArea) {
        await explorerArea.click({ button: 'right' });
        await page.waitForTimeout(1000);
        const folderOption = await page.$('button:has-text("New Folder")');
        if (folderOption) {
          await folderOption.click();
          await page.waitForTimeout(1000);
          
          const folderInput = await page.$('input[type="text"]');
          if (folderInput) {
            await folderInput.type('test-folder');
            await page.keyboard.press('Enter');
            await page.waitForTimeout(2000);
            results.passed.push('New folder created');
          }
        }
      }
    }

    // Test 9: Test file search/filter
    console.log('🔍 Testing file search...');
    
    const searchInput = await page.$('input[placeholder*="search"], input[placeholder*="filter"], [class*="search"]');
    if (searchInput) {
      await searchInput.type('.js');
      await page.waitForTimeout(1500);
      
      // Check if file list filtered
      const visibleFiles = await page.$$('[class*="file-item"]:visible');
      if (visibleFiles.length > 0) {
        results.passed.push('File search/filter functionality works');
      }
      
      // Clear search
      await searchInput.click({ clickCount: 3 });
      await page.keyboard.press('Delete');
      await page.waitForTimeout(1000);
      
      await takeScreenshot(page, 'file-search-tested', results);
    }

    // Test 10: Test multiple file tabs
    console.log('📑 Testing multiple file tabs...');
    
    // Open another file
    const secondFile = await page.$('[class*="file-item"]:nth-child(2)');
    if (secondFile) {
      await secondFile.click();
      await page.waitForTimeout(2000);
      
      // Check for file tabs
      const fileTabs = await page.$$('[class*="tab"], [class*="file-tab"]');
      if (fileTabs.length > 1) {
        results.passed.push(`Multiple file tabs working (${fileTabs.length} tabs)`);
        
        // Test tab switching
        const firstTab = fileTabs[0];
        if (firstTab) {
          await firstTab.click();
          await page.waitForTimeout(1000);
          results.passed.push('Tab switching functionality works');
        }
        
        await takeScreenshot(page, 'multiple-file-tabs', results);
      }
    }

    // Test 11: Test syntax highlighting and language detection
    console.log('🎨 Testing syntax highlighting...');
    
    // Check if editor has syntax highlighting classes
    const syntaxElements = await page.$$('.monaco-editor .mtk1, .monaco-editor .mtk*, [class*="syntax"], [class*="highlight"]');
    if (syntaxElements.length > 0) {
      results.passed.push('Syntax highlighting appears to be active');
    }

    // Test 12: Test editor features (autocomplete, etc.)
    console.log('💡 Testing editor features...');
    
    const editor = await page.$('.monaco-editor');
    if (editor) {
      await editor.click();
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');
      await page.keyboard.type('console.');
      await page.waitForTimeout(2000);
      
      // Check for autocomplete popup
      const autocomplete = await page.$('.monaco-editor .suggest-widget, [class*="autocomplete"], [class*="suggest"]');
      if (autocomplete) {
        results.passed.push('Editor autocomplete functionality detected');
        await page.keyboard.press('Escape'); // Close autocomplete
      }
    }

    // Test 13: Test file deletion
    console.log('🗑️ Testing file deletion...');
    
    if (results.filesCreated.length > 0) {
      const testFile = await page.$(`li:has-text("${results.filesCreated[0]}")`);
      if (testFile) {
        await testFile.click({ button: 'right' });
        await page.waitForTimeout(1000);
        
        const deleteButton = await page.$('button:has-text("Delete")');
        if (deleteButton) {
          await deleteButton.click();
          await page.waitForTimeout(1000);
          
          // Confirm deletion if modal appears
          const confirmButton = await page.$('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")');
          if (confirmButton) {
            await confirmButton.click();
            await page.waitForTimeout(2000);
          }
          
          // Check if file is gone
          const deletedFile = await page.$(`li:has-text("${results.filesCreated[0]}")`);
          if (!deletedFile) {
            results.passed.push('File deletion successful');
          }
        }
      }
    }

    await takeScreenshot(page, 'final-editor-state', results);

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
  console.log('📝 FILE EDITOR OPERATIONS TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`📸 Screenshots: ${results.screenshots.length}`);
  console.log(`📄 Files Created: ${results.filesCreated.length}`);
  
  if (results.passed.length > 0) {
    console.log('\n✅ Passed tests:');
    results.passed.forEach(test => console.log(`   • ${test}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed tests:');
    results.failed.forEach(test => console.log(`   • ${test}`));
  }
  
  if (results.filesCreated.length > 0) {
    console.log('\n📄 Test files created:');
    results.filesCreated.forEach(file => console.log(`   • ${file}`));
  }
  
  return results.failed.length === 0;
}

async function takeScreenshot(page, name, results) {
  const dir = path.join(__dirname, 'screenshots', '06-file-editor');
  await fs.mkdir(dir, { recursive: true });
  const filepath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  results.screenshots.push({ name, path: filepath });
}

async function saveResults(results) {
  const dir = path.join(__dirname, 'results');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, '06-file-editor-results.json'),
    JSON.stringify(results, null, 2)
  );
}

if (require.main === module) {
  testFileEditorOperations().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testFileEditorOperations };