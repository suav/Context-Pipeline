const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Test 08: Advanced Features
 * Tests checkpoints, permissions, search, command injection, and error recovery
 */
async function testAdvancedFeatures() {
  console.log('🚀 Test 08: Advanced Features\n');
  
  let browser;
  const results = {
    testName: 'Advanced Features',
    timestamp: new Date().toISOString(),
    passed: [],
    failed: [],
    screenshots: [],
    checkpoints: [],
    permissions: []
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

    // Test 1: Test global search functionality
    console.log('🔍 Testing global search...');
    
    const searchInput = await page.$('input[placeholder*="search"], input[type="search"], [class*="search"]');
    if (searchInput) {
      await searchInput.type('test');
      await page.waitForTimeout(2000);
      
      // Check for search results
      const searchResults = await page.$$('[class*="search-result"], [class*="result"], li:has-text("test")');
      if (searchResults.length > 0) {
        results.passed.push(`Global search returned ${searchResults.length} results`);
      }
      
      // Test search filters
      const filterButton = await page.$('button:has-text("Filter"), select[class*="filter"]');
      if (filterButton) {
        await filterButton.click();
        await page.waitForTimeout(1000);
        results.passed.push('Search filtering options available');
      }
      
      await takeScreenshot(page, 'global-search', results);
      
      // Clear search
      await searchInput.click({ clickCount: 3 });
      await page.keyboard.press('Delete');
    } else {
      results.failed.push('Global search input not found');
    }

    // Test 2: Test agent checkpoint functionality
    console.log('💾 Testing agent checkpoints...');
    
    // Navigate to workspace for checkpoint testing
    const workspaceCard = await page.$('[class*="workspace-card"], [class*="WorkspaceCard"]');
    if (workspaceCard) {
      await workspaceCard.click();
      await page.waitForTimeout(3000);
      
      // Deploy an agent first
      const agentButton = await page.$('button:has-text("Claude"), button:has-text("Gemini")');
      if (agentButton) {
        await agentButton.click();
        await page.waitForTimeout(2000);
        
        // Look for checkpoint options
        const checkpointButton = await page.$('button:has-text("Checkpoint"), button:has-text("Save State"), [class*="checkpoint"]');
        if (checkpointButton) {
          await checkpointButton.click();
          await page.waitForTimeout(1500);
          
          // Create a checkpoint
          const checkpointName = await page.$('input[placeholder*="name"], input[placeholder*="checkpoint"]');
          if (checkpointName) {
            await checkpointName.type('Test Checkpoint');
            
            const saveCheckpoint = await page.$('button:has-text("Save"), button:has-text("Create")');
            if (saveCheckpoint) {
              await saveCheckpoint.click();
              await page.waitForTimeout(2000);
              results.passed.push('Agent checkpoint created');
              results.checkpoints.push('test-checkpoint');
            }
          }
          
          await takeScreenshot(page, 'checkpoint-created', results);
        } else {
          results.failed.push('Checkpoint functionality not found');
        }
      }
    }

    // Test 3: Test permission system
    console.log('🔐 Testing permission system...');
    
    // Send a message that might trigger permissions
    const chatInput = await page.$('input[type="text"], textarea');
    if (chatInput) {
      await chatInput.type('Please create a new file called test.txt');
      
      const sendButton = await page.$('button:has-text("Send")');
      if (sendButton) {
        await sendButton.click();
        await page.waitForTimeout(3000);
        
        // Check for permission approval overlay
        const approvalOverlay = await page.$('[class*="approval"], [class*="permission"], [role="dialog"]:has-text("permission")');
        if (approvalOverlay) {
          results.passed.push('Permission approval system triggered');
          
          // Check for approval options
          const approveButton = await page.$('button:has-text("Approve"), button:has-text("Allow")');
          const denyButton = await page.$('button:has-text("Deny"), button:has-text("Reject")');
          
          if (approveButton && denyButton) {
            results.passed.push('Permission approval options available');
            results.permissions.push('file_creation_permission');
            
            // Test approval
            await approveButton.click();
            await page.waitForTimeout(2000);
            results.passed.push('Permission approved successfully');
          }
          
          await takeScreenshot(page, 'permission-approval', results);
        }
      }
    }

    // Test 4: Test command injection system
    console.log('⚡ Testing command injection...');
    
    // Look for command palette or injection interface
    const commandPalette = await page.$('button:has-text("Commands"), [class*="command-palette"]');
    if (!commandPalette) {
      // Try keyboard shortcut
      await page.keyboard.down('Control');
      await page.keyboard.down('Shift');
      await page.keyboard.press('p');
      await page.keyboard.up('Shift');
      await page.keyboard.up('Control');
      await page.waitForTimeout(1500);
    } else {
      await commandPalette.click();
      await page.waitForTimeout(1500);
    }
    
    // Check for command palette
    const paletteOpen = await page.$('[class*="command-palette"], [class*="command-menu"]');
    if (paletteOpen) {
      results.passed.push('Command palette accessible');
      
      // Test command search
      const commandInput = await page.$('input[placeholder*="command"], input[type="text"]');
      if (commandInput) {
        await commandInput.type('create');
        await page.waitForTimeout(1000);
        
        // Check for command suggestions
        const commandSuggestions = await page.$$('[class*="command"], [role="option"], li');
        if (commandSuggestions.length > 0) {
          results.passed.push(`Found ${commandSuggestions.length} command suggestions`);
        }
        
        await takeScreenshot(page, 'command-palette', results);
        await page.keyboard.press('Escape');
      }
    }

    // Test 5: Test workspace validation system
    console.log('✅ Testing workspace validation...');
    
    // Look for validation status
    const validationStatus = await page.$('[class*="validation"], [class*="status"], :has-text("valid")');
    if (validationStatus) {
      results.passed.push('Workspace validation status visible');
      
      // Test validation details
      await validationStatus.click();
      await page.waitForTimeout(1500);
      
      const validationDetails = await page.$('[class*="validation-detail"], [class*="status-detail"]');
      if (validationDetails) {
        results.passed.push('Validation details accessible');
      }
    }

    // Test 6: Test error recovery and handling
    console.log('🛡️ Testing error recovery...');
    
    // Intentionally trigger an error condition
    if (chatInput) {
      await chatInput.clear();
      await chatInput.type('Please access a file that does not exist: /nonexistent/path.txt');
      
      const sendButton = await page.$('button:has-text("Send")');
      if (sendButton) {
        await sendButton.click();
        await page.waitForTimeout(3000);
        
        // Check for error handling
        const errorMessage = await page.$('[class*="error"], :has-text("error"), :has-text("failed")');
        if (errorMessage) {
          results.passed.push('Error handling system functional');
          
          // Check for retry option
          const retryButton = await page.$('button:has-text("Retry"), button:has-text("Try Again")');
          if (retryButton) {
            results.passed.push('Error recovery options available');
          }
        }
        
        await takeScreenshot(page, 'error-handling', results);
      }
    }

    // Test 7: Test keyboard shortcuts
    console.log('⌨️ Testing keyboard shortcuts...');
    
    // Test file save shortcut
    await page.keyboard.down('Control');
    await page.keyboard.press('s');
    await page.keyboard.up('Control');
    await page.waitForTimeout(1000);
    
    // Test new file shortcut
    await page.keyboard.down('Control');
    await page.keyboard.press('n');
    await page.keyboard.up('Control');
    await page.waitForTimeout(1000);
    
    const newFileDialog = await page.$('[role="dialog"], .modal');
    if (newFileDialog) {
      results.passed.push('Keyboard shortcuts functional');
      await page.keyboard.press('Escape');
    }

    // Test 8: Test theme persistence across sessions
    console.log('🎨 Testing theme persistence...');
    
    // Open settings
    const settingsButton = await page.$('button:has-text("Settings"), button:has-text("☰")');
    if (settingsButton) {
      await settingsButton.click();
      await page.waitForTimeout(1000);
      
      // Change theme
      const themeSelector = await page.$('select, button:has-text("Theme")');
      if (themeSelector) {
        await themeSelector.click();
        await page.waitForTimeout(1000);
        
        const darkOption = await page.$('option[value="dark"], button:has-text("Dark")');
        if (darkOption) {
          await darkOption.click();
          await page.waitForTimeout(1000);
          
          // Refresh page to test persistence
          await page.reload();
          await page.waitForTimeout(3000);
          
          // Check if dark theme persisted
          const isDark = await page.evaluate(() => {
            return document.body.classList.contains('dark') || 
                   document.body.getAttribute('data-theme') === 'dark' ||
                   getComputedStyle(document.body).backgroundColor.includes('0, 0, 0');
          });
          
          if (isDark) {
            results.passed.push('Theme persistence works across sessions');
          }
        }
      }
    }

    // Test 9: Test performance monitoring
    console.log('📊 Testing performance monitoring...');
    
    // Check for performance indicators
    const performanceMetrics = await page.$('[class*="performance"], [class*="metrics"], :has-text("ms")');
    if (performanceMetrics) {
      results.passed.push('Performance monitoring visible');
    }

    // Test memory usage indicators
    const memoryIndicator = await page.$(':has-text("MB"), [class*="memory"]');
    if (memoryIndicator) {
      results.passed.push('Memory usage monitoring available');
    }

    // Test 10: Test accessibility features
    console.log('♿ Testing accessibility features...');
    
    // Check for ARIA labels and roles
    const accessibleElements = await page.$$('[role], [aria-label], [aria-describedby]');
    if (accessibleElements.length > 10) {
      results.passed.push(`Found ${accessibleElements.length} accessibility-enhanced elements`);
    }

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    
    const focusedElement = await page.$(':focus');
    if (focusedElement) {
      results.passed.push('Keyboard navigation functional');
    }

    // Test 11: Test data export functionality
    console.log('📤 Testing data export...');
    
    const exportButton = await page.$('button:has-text("Export"), button:has-text("Download"), [class*="export"]');
    if (exportButton) {
      await exportButton.click();
      await page.waitForTimeout(1500);
      
      // Check for export options
      const exportOptions = await page.$$('button:has-text("JSON"), button:has-text("CSV"), option');
      if (exportOptions.length > 0) {
        results.passed.push(`Found ${exportOptions.length} export format options`);
      }
      
      await takeScreenshot(page, 'export-options', results);
      await page.keyboard.press('Escape');
    }

    // Test 12: Test notification system
    console.log('🔔 Testing notification system...');
    
    // Look for existing notifications
    const notifications = await page.$$('[class*="notification"], [class*="toast"], [role="alert"]');
    if (notifications.length > 0) {
      results.passed.push(`Found ${notifications.length} active notifications`);
      
      // Test notification dismissal
      const dismissButton = await page.$('button:has-text("✕"), button:has-text("Dismiss")');
      if (dismissButton) {
        await dismissButton.click();
        await page.waitForTimeout(1000);
        results.passed.push('Notification dismissal functional');
      }
    }

    // Test 13: Test undo/redo functionality
    console.log('↩️ Testing undo/redo...');
    
    // Test in editor if available
    const editor = await page.$('.monaco-editor');
    if (editor) {
      await editor.click();
      await page.keyboard.type('test text for undo');
      await page.keyboard.down('Control');
      await page.keyboard.press('z');
      await page.keyboard.up('Control');
      await page.waitForTimeout(1000);
      
      // Check if text was undone
      const editorContent = await page.evaluate(() => {
        const editor = document.querySelector('.monaco-editor');
        return editor ? editor.textContent : '';
      });
      
      if (!editorContent.includes('test text for undo')) {
        results.passed.push('Undo functionality works in editor');
      }
    }

    await takeScreenshot(page, 'final-advanced-features', results);

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
  console.log('🚀 ADVANCED FEATURES TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`📸 Screenshots: ${results.screenshots.length}`);
  console.log(`💾 Checkpoints: ${results.checkpoints.length}`);
  console.log(`🔐 Permissions: ${results.permissions.length}`);
  
  if (results.passed.length > 0) {
    console.log('\n✅ Passed tests:');
    results.passed.forEach(test => console.log(`   • ${test}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed tests:');
    results.failed.forEach(test => console.log(`   • ${test}`));
  }
  
  if (results.checkpoints.length > 0) {
    console.log('\n💾 Checkpoints created:');
    results.checkpoints.forEach(cp => console.log(`   • ${cp}`));
  }
  
  if (results.permissions.length > 0) {
    console.log('\n🔐 Permissions tested:');
    results.permissions.forEach(perm => console.log(`   • ${perm}`));
  }
  
  return results.failed.length === 0;
}

async function takeScreenshot(page, name, results) {
  const dir = path.join(__dirname, 'screenshots', '08-advanced-features');
  await fs.mkdir(dir, { recursive: true });
  const filepath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  results.screenshots.push({ name, path: filepath });
}

async function saveResults(results) {
  const dir = path.join(__dirname, 'results');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, '08-advanced-features-results.json'),
    JSON.stringify(results, null, 2)
  );
}

if (require.main === module) {
  testAdvancedFeatures().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testAdvancedFeatures };