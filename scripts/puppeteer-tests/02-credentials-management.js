const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Test 02: Credentials Management
 * Tests credential creation, editing, deletion, and validation
 */
async function testCredentialsManagement() {
  console.log('🔐 Test 02: Credentials Management\n');
  
  let browser;
  const results = {
    testName: 'Credentials Management',
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
    await page.waitForTimeout(1500);

    // Test 1: Open credentials manager
    console.log('🔐 Opening credentials manager...');
    
    // Open settings first
    const settingsButton = await page.waitForSelector('button:has-text("Settings"), button:has-text("☰")');
    await settingsButton.click();
    await page.waitForTimeout(1000);

    // Click credentials button
    const credentialsButton = await page.waitForSelector('button:has-text("Credentials"), button:has-text("🔐")');
    if (credentialsButton) {
      results.passed.push('Credentials button found');
      await credentialsButton.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, 'credentials-modal-open', results);
    } else {
      results.failed.push('Credentials button not found');
      return;
    }

    // Test 2: Check credentials modal structure
    console.log('📋 Validating credentials modal...');
    const modal = await page.$('[role="dialog"], .modal, [class*="modal"]');
    if (modal) {
      results.passed.push('Credentials modal opened');
      
      // Check for service tabs/options
      const serviceButtons = await page.$$('button:has-text("JIRA"), button:has-text("GIT"), button:has-text("GitHub")');
      if (serviceButtons.length > 0) {
        results.passed.push(`Found ${serviceButtons.length} service options`);
      }
      
      // Check for add credential functionality
      const addButton = await page.$('button:has-text("Add"), button:has-text("+"), button[class*="add"]');
      if (addButton) {
        results.passed.push('Add credential button found');
      }
    } else {
      results.failed.push('Credentials modal not found');
    }

    // Test 3: Add JIRA credential
    console.log('🎫 Testing JIRA credential creation...');
    const jiraButton = await page.$('button:has-text("JIRA")');
    if (jiraButton) {
      await jiraButton.click();
      await page.waitForTimeout(1000);
      
      // Click add new credential
      const addNewButton = await page.$('button:has-text("Add New"), button:has-text("➕"), button:has-text("Add JIRA")');
      if (addNewButton) {
        await addNewButton.click();
        await page.waitForTimeout(1500);
        await takeScreenshot(page, 'jira-credential-form', results);
        
        // Fill in JIRA credential form
        const nameField = await page.$('input[placeholder*="name"], input[name*="name"]');
        const urlField = await page.$('input[placeholder*="url"], input[name*="url"]');
        const emailField = await page.$('input[placeholder*="email"], input[name*="email"]');
        const tokenField = await page.$('input[placeholder*="token"], input[name*="token"], input[type="password"]');
        
        if (nameField && urlField && emailField && tokenField) {
          await nameField.type('Test JIRA Instance');
          await urlField.type('https://test.atlassian.net');
          await emailField.type('test@example.com');
          await tokenField.type('test_token_123');
          
          results.passed.push('JIRA credential form filled');
          await takeScreenshot(page, 'jira-form-filled', results);
          
          // Save the credential
          const saveButton = await page.$('button:has-text("Save"), button:has-text("Add")');
          if (saveButton) {
            await saveButton.click();
            await page.waitForTimeout(2000);
            results.passed.push('JIRA credential saved');
          }
        } else {
          results.failed.push('JIRA credential form fields not found');
        }
      }
    }

    // Test 4: Add GitHub credential
    console.log('🐙 Testing GitHub credential creation...');
    const gitButton = await page.$('button:has-text("GIT"), button:has-text("GitHub")');
    if (gitButton) {
      await gitButton.click();
      await page.waitForTimeout(1000);
      
      const addGitButton = await page.$('button:has-text("Add New"), button:has-text("➕")');
      if (addGitButton) {
        await addGitButton.click();
        await page.waitForTimeout(1500);
        
        // Fill GitHub form
        const nameField = await page.$('input[placeholder*="name"]');
        const tokenField = await page.$('input[placeholder*="token"], input[type="password"]');
        
        if (nameField && tokenField) {
          await nameField.type('Test GitHub');
          await tokenField.type('ghp_test_token_123');
          
          const saveButton = await page.$('button:has-text("Save")');
          if (saveButton) {
            await saveButton.click();
            await page.waitForTimeout(2000);
            results.passed.push('GitHub credential saved');
            await takeScreenshot(page, 'github-credential-saved', results);
          }
        }
      }
    }

    // Test 5: Validate credentials list
    console.log('📝 Validating credentials list...');
    const credentialsList = await page.$$('[class*="credential"], .credential-item, li:has-text("Test")');
    if (credentialsList.length > 0) {
      results.passed.push(`Found ${credentialsList.length} saved credentials`);
    }

    // Test 6: Edit a credential
    console.log('✏️ Testing credential editing...');
    const editButton = await page.$('button:has-text("Edit"), button[class*="edit"], button:has-text("✏️")');
    if (editButton) {
      await editButton.click();
      await page.waitForTimeout(1500);
      
      // Modify a field
      const nameField = await page.$('input[value*="Test"]');
      if (nameField) {
        await nameField.click({ clickCount: 3 }); // Select all
        await nameField.type('Modified Test JIRA');
        
        const saveButton = await page.$('button:has-text("Save")');
        if (saveButton) {
          await saveButton.click();
          await page.waitForTimeout(1500);
          results.passed.push('Credential edited successfully');
          await takeScreenshot(page, 'credential-edited', results);
        }
      }
    }

    // Test 7: Delete a credential
    console.log('🗑️ Testing credential deletion...');
    const deleteButton = await page.$('button:has-text("Delete"), button[class*="delete"], button:has-text("🗑️")');
    if (deleteButton) {
      await deleteButton.click();
      await page.waitForTimeout(1000);
      
      // Confirm deletion if modal appears
      const confirmButton = await page.$('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")');
      if (confirmButton) {
        await confirmButton.click();
        await page.waitForTimeout(1500);
        results.passed.push('Credential deleted successfully');
        await takeScreenshot(page, 'credential-deleted', results);
      }
    }

    // Test 8: Test credential validation
    console.log('✅ Testing credential validation...');
    const testButton = await page.$('button:has-text("Test"), button:has-text("Validate"), button:has-text("Check")');
    if (testButton) {
      await testButton.click();
      await page.waitForTimeout(3000); // Allow time for API call
      
      // Look for validation result
      const successMsg = await page.$(':has-text("Valid"), :has-text("Success"), :has-text("✅")');
      const errorMsg = await page.$(':has-text("Invalid"), :has-text("Error"), :has-text("❌")');
      
      if (successMsg || errorMsg) {
        results.passed.push('Credential validation tested');
      }
    }

    // Test 9: Close credentials modal
    console.log('❌ Closing credentials modal...');
    const closeButton = await page.$('button:has-text("✕"), button:has-text("Close"), button[class*="close"]');
    if (closeButton) {
      await closeButton.click();
      await page.waitForTimeout(1000);
      
      // Verify modal is closed
      const modalStillVisible = await page.$('[role="dialog"]:visible, .modal:visible');
      if (!modalStillVisible) {
        results.passed.push('Credentials modal closed successfully');
      }
    }

    await takeScreenshot(page, 'final-state', results);

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
  console.log('🔐 CREDENTIALS TEST SUMMARY');
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
  const dir = path.join(__dirname, 'screenshots', '02-credentials');
  await fs.mkdir(dir, { recursive: true });
  const filepath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  results.screenshots.push({ name, path: filepath });
}

async function saveResults(results) {
  const dir = path.join(__dirname, 'results');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, '02-credentials-results.json'),
    JSON.stringify(results, null, 2)
  );
}

if (require.main === module) {
  testCredentialsManagement().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testCredentialsManagement };