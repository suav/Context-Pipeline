const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
async function captureAppScreenshots() {
  console.log('Attempting to launch browser...');
  let browser;
  try {
    // Try to use the bundled Chromium first
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });
  } catch (error) {
    console.log('Failed to launch with default settings:', error.message);
    console.log('Trying alternative Chrome executable...');
    // Try alternative executable paths
    const possiblePaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium'
    ];
    let executablePath = null;
    for (const path of possiblePaths) {
      try {
        await fs.access(path);
        executablePath = path;
        console.log('Found Chrome at:', path);
        break;
      } catch (e) {
        // Path doesn't exist, continue
      }
    }
    if (executablePath) {
      browser = await puppeteer.launch({
        headless: 'new',
        executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--disable-gpu',
          '--no-first-run'
        ]
      });
    } else {
      throw new Error('No Chrome/Chromium executable found. Please install Chrome or Chromium.');
    }
  }
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    // Create screenshots directory
    const screenshotsDir = path.join(__dirname, '../screenshots');
    await fs.mkdir(screenshotsDir, { recursive: true });
    // Capture home page
    console.log('Navigating to home page...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0', timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotsDir, '01-home-page.png'), fullPage: true });
    console.log('Captured home page screenshot');
    // Wait for content to load and examine the interface
    await page.waitForTimeout(3000);
    // Get page title and basic info
    const title = await page.title();
    console.log('Page title:', title);
    // Look for key UI elements
    const uiElements = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button')).map(btn => ({
        type: 'button',
        text: btn.textContent?.trim() || '',
        className: btn.className,
        visible: btn.offsetWidth > 0 && btn.offsetHeight > 0
      }));
      const workspaceElements = Array.from(document.querySelectorAll('[class*="workspace" i]')).map(el => ({
        type: 'workspace-element',
        text: el.textContent?.trim() || '',
        className: el.className,
        tagName: el.tagName
      }));
      const agentElements = Array.from(document.querySelectorAll('[class*="agent" i]')).map(el => ({
        type: 'agent-element',
        text: el.textContent?.trim() || '',
        className: el.className,
        tagName: el.tagName
      }));
      return { buttons, workspaceElements, agentElements };
    });
    console.log('UI Elements found:', JSON.stringify(uiElements, null, 2));
    // Try to click "Create New Workspace" button
    const createButton = await page.$('button:has-text("Create New Workspace"), button:has-text("New Workspace")');
    if (createButton) {
      console.log('Found create workspace button, clicking...');
      await createButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotsDir, '02-create-workspace.png'), fullPage: true });
      console.log('Captured after clicking create workspace');
    }
    // Try to click Import button
    const importButton = await page.$('button:has-text("Import"), button:has-text("📥")');
    if (importButton) {
      console.log('Found import button, clicking...');
      await importButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotsDir, '03-import-modal.png'), fullPage: true });
      console.log('Captured import modal');
      // Close modal by clicking backdrop or close button
      const closeButton = await page.$('button:has-text("✕"), [role="dialog"] ~ *, .modal-backdrop');
      if (closeButton) {
        await closeButton.click();
        await page.waitForTimeout(1000);
      }
    }
    // Try settings button
    const settingsButton = await page.$('button:has-text("Settings"), button:has-text("☰")');
    if (settingsButton) {
      console.log('Found settings button, clicking...');
      await settingsButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotsDir, '04-settings-sidebar.png'), fullPage: true });
      console.log('Captured settings sidebar');
      // Close settings
      const settingsClose = await page.$('button:has-text("✕")');
      if (settingsClose) {
        await settingsClose.click();
        await page.waitForTimeout(1000);
      }
    }
    // Check for workspace cards
    const workspaceCards = await page.$$('[class*="workspace"][class*="card"], [class*="CompactWorkspace"]');
    console.log(`Found ${workspaceCards.length} workspace cards`);
    if (workspaceCards.length > 0) {
      console.log('Clicking on first workspace card...');
      await workspaceCards[0].click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(screenshotsDir, '05-workspace-opened.png'), fullPage: true });
      console.log('Captured workspace view');
    }
    // Get final page state
    const finalState = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        hasMonacoEditor: !!document.querySelector('[class*="monaco"]'),
        hasFileTree: !!document.querySelector('[class*="tree"], [class*="file"]'),
        hasTerminal: !!document.querySelector('[class*="terminal"], [class*="chat"]'),
        visibleModals: document.querySelectorAll('[role="dialog"]').length
      };
    });
    console.log('Final page state:', finalState);
    // Save page content for analysis
    const pageContent = await page.content();
    await fs.writeFile(path.join(screenshotsDir, 'page-content.html'), pageContent);
    await fs.writeFile(path.join(screenshotsDir, 'ui-analysis.json'), JSON.stringify({
      title,
      uiElements,
      finalState
    }, null, 2));
    console.log('Saved page content and analysis');
  } catch (error) {
    console.error('Error capturing screenshots:', error);
  } finally {
    await browser.close();
  }
}
captureAppScreenshots();