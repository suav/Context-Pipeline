#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function waitForElement(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout });
    return { success: true };
  } catch (error) {
    return { success: false, error: `Failed to find element: ${selector}` };
  }
}

async function takeScreenshot(page, name) {
  const screenshotPath = path.join(__dirname, 'screenshots', `library-deletion-${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved: ${name}`);
}

async function countLibraryCards(page) {
  // Wait a moment for the view to settle
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Count library cards - try multiple selectors and approaches
  const cardCount = await page.evaluate(() => {
    // Try various selectors that might represent library cards
    const selectors = [
      '[data-testid="library-card"]',
      '.library-card',
      '.context-card',
      '[class*="library"][class*="card"]',
      '[class*="context"][class*="card"]',
      // Look for cards containing delete buttons
      'div:has(button:has-text("🗑️"))',
      // Look for grid/flex containers that might hold cards
      '.grid > div[class*="card"]',
      '.flex > div[class*="card"]',
      '[class*="grid"] > div[class*="border"]'
    ];
    
    let cards = [];
    for (const selector of selectors) {
      try {
        const found = document.querySelectorAll(selector);
        if (found.length > 0) {
          console.log(`Found ${found.length} elements with selector: ${selector}`);
          cards = found;
          break;
        }
      } catch (e) {
        // Some selectors might not be valid in all browsers
      }
    }
    
    // If no cards found with selectors, look for divs with delete buttons
    if (cards.length === 0) {
      const allDivs = document.querySelectorAll('div');
      const cardsWithDelete = [];
      allDivs.forEach(div => {
        const deleteBtn = div.querySelector('button');
        if (deleteBtn && deleteBtn.textContent && deleteBtn.textContent.includes('🗑️')) {
          // Check if this div is likely a card (has some content)
          if (div.textContent.length > 10 && !div.querySelector('nav')) {
            cardsWithDelete.push(div);
          }
        }
      });
      cards = cardsWithDelete;
      if (cards.length > 0) {
        console.log(`Found ${cards.length} cards by looking for delete buttons`);
      }
    }
    
    return cards.length;
  });
  
  return cardCount;
}

async function deleteLibraryCard(page, index = 0) {
  console.log(`🗑️ Attempting to delete library card at index ${index}`);
  
  // Find all buttons and look for delete buttons
  const allButtons = await page.$$('button');
  const deleteButtons = [];
  
  for (const button of allButtons) {
    const text = await page.evaluate(el => el.textContent, button);
    const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label'), button);
    const testId = await page.evaluate(el => el.getAttribute('data-testid'), button);
    
    if ((text && text.includes('🗑️')) || 
        (ariaLabel && (ariaLabel.includes('delete') || ariaLabel.includes('remove'))) ||
        (testId && testId.includes('delete'))) {
      deleteButtons.push(button);
    }
  }
  
  if (deleteButtons.length === 0) {
    return { success: false, error: 'No delete buttons found' };
  }
  
  if (index >= deleteButtons.length) {
    return { success: false, error: `Index ${index} out of bounds (${deleteButtons.length} buttons found)` };
  }
  
  console.log(`  Found ${deleteButtons.length} delete buttons`);
  
  // Click the delete button
  await deleteButtons[index].click();
  
  // Wait a moment for any animations
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return { success: true };
}

async function checkStorageFiles(workspaceId) {
  const storagePath = path.join(process.cwd(), 'storage');
  const libraryPath = path.join(storagePath, 'library');
  
  try {
    const libraryFiles = await fs.readdir(libraryPath);
    console.log(`📁 Library storage contains ${libraryFiles.length} items`);
    
    // Also check localStorage simulation file if it exists
    const localStoragePath = path.join(storagePath, 'localStorage.json');
    try {
      const localStorageContent = await fs.readFile(localStoragePath, 'utf-8');
      const localStorage = JSON.parse(localStorageContent);
      if (localStorage['context-library']) {
        const libraryItems = JSON.parse(localStorage['context-library']);
        console.log(`💾 localStorage contains ${libraryItems.length} library items`);
      }
    } catch (e) {
      // localStorage file might not exist
    }
    
    return { libraryFiles };
  } catch (error) {
    console.log(`⚠️ Could not read storage files: ${error.message}`);
    return { libraryFiles: [] };
  }
}

async function testLibraryCardDeletion() {
  console.log('🧪 Testing Library Card Deletion');
  console.log('================================');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1400, height: 900 }
  });
  
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('🔴 Browser Error:', msg.text());
    }
  });
  
  try {
    // Step 1: Navigate to the app
    console.log('\n📍 Step 1: Navigating to app...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle2' });
    await takeScreenshot(page, '01-app-loaded');
    
    // Step 2: Check if we're in the workspace view or need to toggle to library
    console.log('\n📍 Step 2: Checking for library view...');
    
    // First, let's understand what view we're in
    const pageText = await page.evaluate(() => document.body.textContent);
    console.log('  Current page contains:', pageText.includes('Workspaces') ? 'Workspaces' : 
                                        pageText.includes('Library') ? 'Library' : 'Unknown');
    
    // Look for the view toggle buttons
    const toggleButtons = await page.$$('button');
    let libraryToggled = false;
    for (const button of toggleButtons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text && (text.includes('Library') || text.includes('📚'))) {
        console.log('  Found library toggle button, clicking...');
        await button.click();
        libraryToggled = true;
        await new Promise(resolve => setTimeout(resolve, 1500));
        break;
      }
    }
    
    if (!libraryToggled) {
      console.log('  No library toggle found. Checking if already in library view...');
    }
    
    await takeScreenshot(page, '02-library-view');
    
    // Step 3: Count initial library cards
    console.log('\n📍 Step 3: Counting library cards...');
    
    // Print some debug info about what's on the page
    const debugInfo = await page.evaluate(() => {
      const deleteButtons = Array.from(document.querySelectorAll('button')).filter(b => 
        b.textContent.includes('🗑️')
      );
      const cardsInfo = {
        deleteButtonCount: deleteButtons.length,
        hasGrid: !!document.querySelector('[class*="grid"]'),
        hasFlex: !!document.querySelector('[class*="flex"]'),
        hasCards: !!document.querySelector('[class*="card"]'),
        totalDivs: document.querySelectorAll('div').length
      };
      
      // Try to find parent elements of delete buttons
      if (deleteButtons.length > 0) {
        const firstDeleteButton = deleteButtons[0];
        let parent = firstDeleteButton.parentElement;
        let depth = 0;
        while (parent && depth < 5) {
          if (parent.className && parent.className.includes('card')) {
            cardsInfo.foundCardClass = parent.className;
            break;
          }
          parent = parent.parentElement;
          depth++;
        }
      }
      
      return cardsInfo;
    });
    
    console.log('  Debug info:', JSON.stringify(debugInfo, null, 2));
    
    const initialCount = await countLibraryCards(page);
    console.log(`  Found ${initialCount} library cards`);
    
    // If no cards found, we need to check if we're really in the library view
    if (initialCount === 0 && debugInfo.deleteButtonCount > 0) {
      console.log(`\n⚠️ Found ${debugInfo.deleteButtonCount} delete buttons but counted 0 cards.`);
      console.log('  This suggests the card detection logic needs adjustment.');
      
      // Try a different approach - count based on delete buttons
      const alternativeCount = debugInfo.deleteButtonCount;
      console.log(`  Using delete button count as proxy: ${alternativeCount} cards`);
      
      // Continue with the test using this count
      const modifiedInitialCount = alternativeCount;
      
      // Override the count for testing purposes
      await page.evaluate((count) => {
        window.__testLibraryCardCount = count;
      }, modifiedInitialCount);
    } else if (initialCount === 0) {
      console.log('\n⚠️ No library cards found. Checking page state...');
      
      // Take a diagnostic screenshot
      await takeScreenshot(page, '03-no-cards-found');
      
      // Check if we might need to import some items first
      const pageContent = await page.evaluate(() => document.body.textContent);
      if (pageContent.includes('No items in library') || pageContent.includes('empty')) {
        console.log('  Library appears to be empty. Cannot test deletion without items.');
        console.log('\n💡 Suggestion: Add some items to the library before running this test.');
        await browser.close();
        return;
      }
    }
    
    // Check storage files
    const { libraryFiles: initialFiles } = await checkStorageFiles();
    
    // Step 4: Delete the first library card
    console.log('\n📍 Step 4: Deleting first library card...');
    const deleteResult = await deleteLibraryCard(page, 0);
    
    if (!deleteResult.success) {
      console.log(`  ❌ Failed to delete: ${deleteResult.error}`);
      await takeScreenshot(page, '04-delete-failed');
    } else {
      console.log('  ✅ Delete button clicked');
      await takeScreenshot(page, '04-after-delete');
      
      // Wait for UI to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 5: Count cards after deletion
      console.log('\n📍 Step 5: Counting cards after deletion...');
      const afterDeleteCount = await countLibraryCards(page);
      console.log(`  Found ${afterDeleteCount} library cards (was ${initialCount})`);
      
      if (afterDeleteCount < initialCount) {
        console.log('  ✅ Card removed from UI');
      } else {
        console.log('  ❌ Card still visible in UI');
      }
      
      // Step 6: Reload the page
      console.log('\n📍 Step 6: Reloading page to test persistence...');
      await page.reload({ waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Toggle to library view again if needed
      const toggleButtonsAfterReload = await page.$$('button');
      for (const button of toggleButtonsAfterReload) {
        const text = await page.evaluate(el => el.textContent, button);
        if (text && (text.includes('Library') || text.includes('📚'))) {
          await button.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          break;
        }
      }
      
      await takeScreenshot(page, '06-after-reload');
      
      // Step 7: Count cards after reload
      console.log('\n📍 Step 7: Counting cards after reload...');
      const afterReloadCount = await countLibraryCards(page);
      console.log(`  Found ${afterReloadCount} library cards`);
      
      // Check storage files again
      const { libraryFiles: finalFiles } = await checkStorageFiles();
      
      // Step 8: Analyze results
      console.log('\n📊 Results Summary:');
      console.log('===================');
      console.log(`  Initial cards: ${initialCount}`);
      console.log(`  After delete: ${afterDeleteCount}`);
      console.log(`  After reload: ${afterReloadCount}`);
      console.log(`  Storage files: ${initialFiles.length} → ${finalFiles.length}`);
      
      if (afterDeleteCount < initialCount && afterReloadCount === afterDeleteCount) {
        console.log('\n✅ SUCCESS: Deletion persisted across reload!');
      } else if (afterDeleteCount < initialCount && afterReloadCount === initialCount) {
        console.log('\n❌ ISSUE CONFIRMED: Deletion not persisting!');
        console.log('  The card disappears from UI but reappears after reload.');
        console.log('  This confirms the issue described by the user.');
      } else {
        console.log('\n⚠️ UNEXPECTED: Could not properly test deletion');
      }
    }
    
    // Step 9: Try to identify the specific issue
    console.log('\n🔍 Investigating deletion mechanism...');
    
    // Check if there are any API calls when deleting
    const [request] = await Promise.all([
      page.waitForRequest(req => req.url().includes('/api/'), { timeout: 5000 }).catch(() => null),
      deleteLibraryCard(page, 0)
    ]);
    
    if (request) {
      console.log(`  API call made: ${request.method()} ${request.url()}`);
    } else {
      console.log('  ⚠️ No API call detected during deletion!');
      console.log('  This suggests the deletion is only happening in React state.');
    }
    
    await takeScreenshot(page, '09-final-state');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await takeScreenshot(page, 'error-state');
  } finally {
    console.log('\n🏁 Test completed');
    await browser.close();
  }
}

// Run the test
testLibraryCardDeletion().catch(console.error);