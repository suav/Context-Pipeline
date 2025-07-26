const puppeteer = require('puppeteer');

async function testBrowserLaunch() {
  console.log('🔍 Testing browser launch...');
  
  try {
    // Try with system Chromium
    console.log('Attempting to launch with system Chromium...');
    const browser = await puppeteer.launch({
      headless: false,
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--window-size=1920,1080'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });

    console.log('✅ Browser launched successfully!');
    
    const page = await browser.newPage();
    await page.goto('http://localhost:3001');
    
    console.log('✅ Page loaded successfully!');
    console.log('⏸️  Keeping browser open for 5 seconds...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await browser.close();
    console.log('✅ Test completed successfully!');
    
    return true;
    
  } catch (error) {
    console.error('❌ Browser launch failed:', error.message);
    return false;
  }
}

// Run test
if (require.main === module) {
  testBrowserLaunch().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testBrowserLaunch };