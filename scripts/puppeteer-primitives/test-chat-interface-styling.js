#!/usr/bin/env node

const puppeteer = require('puppeteer');
const navigateToApp = require('./core/navigate-to-app');
const takeScreenshot = require('./core/take-screenshot');
const selectWorkspace = require('./workspace/select-workspace');
const deployAgentImproved = require('./agent/deploy-agent-improved');
const submitTextToAgent = require('./agent/submit-text-to-agent');

async function testChatInterfaceStyling() {
  console.log('🎨 INVESTIGATION: Chat Interface Styling & Theme Compatibility');
  console.log('=============================================================');
  console.log('Testing chat interface styling to ensure theme compatibility.\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/nricoatarini/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome',
    args: ['--no-sandbox'],
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  const stylingData = {
    timestamp: new Date().toISOString(),
    phases: [],
    styleAnalysis: [],
    findings: []
  };
  
  try {
    // PHASE 1: Navigate and open chat interface
    console.log('🎨 PHASE 1: Open Chat Interface');
    await navigateToApp(page);
    await selectWorkspace(page, { index: 0 });
    await deployAgentImproved(page, { agentType: 'dev-assistant' });
    
    await takeScreenshot(page, { name: 'styling-01-chat-opened' });
    
    // PHASE 2: Analyze chat interface styling
    console.log('\n🎨 PHASE 2: Analyze Chat Interface Styling');
    
    const stylingAnalysis = await page.evaluate(() => {
      // Look for chat interface elements
      const chatInterface = document.querySelector('[data-testid="chat-interface"]') ||
                           document.querySelector('.bg-black.text-green-400') ||
                           document.querySelector('[class*="terminal"]') ||
                           document.querySelector('[class*="chat"]');
      
      const terminalModal = document.querySelector('[data-testid="terminal-modal"]') ||
                           document.querySelector('.terminal-modal');
      
      if (!chatInterface) {
        return { found: false, error: 'No chat interface found' };
      }
      
      const computedStyle = window.getComputedStyle(chatInterface);
      const parentComputedStyle = terminalModal ? window.getComputedStyle(terminalModal) : null;
      
      // Get CSS variables from root
      const rootStyles = window.getComputedStyle(document.documentElement);
      const themeVariables = {
        surfaceElevated: rootStyles.getPropertyValue('--color-surface-elevated').trim(),
        textPrimary: rootStyles.getPropertyValue('--color-text-primary').trim(),
        background: rootStyles.getPropertyValue('--color-background').trim(),
        surface: rootStyles.getPropertyValue('--color-surface').trim()
      };
      
      return {
        found: true,
        chatInterface: {
          backgroundColor: computedStyle.backgroundColor,
          color: computedStyle.color,
          className: chatInterface.className,
          tagName: chatInterface.tagName,
          hasHardcodedBlack: chatInterface.className.includes('bg-black'),
          hasHardcodedGreen: chatInterface.className.includes('text-green-400')
        },
        terminalModal: parentComputedStyle ? {
          backgroundColor: parentComputedStyle.backgroundColor,
          color: parentComputedStyle.color,
          className: terminalModal.className
        } : null,
        themeVariables,
        isUsingThemeColors: !chatInterface.className.includes('bg-black'),
        stylingMismatch: chatInterface.className.includes('bg-black') && terminalModal && !terminalModal.className.includes('bg-black')
      };
    });
    
    stylingData.styleAnalysis.push({ phase: 1, type: 'initial-analysis', ...stylingAnalysis });
    
    console.log('📊 Chat Interface Styling Analysis:');
    console.log(`✅ Chat interface found: ${stylingAnalysis.found}`);
    
    if (stylingAnalysis.found) {
      console.log(`Background color: ${stylingAnalysis.chatInterface.backgroundColor}`);
      console.log(`Text color: ${stylingAnalysis.chatInterface.color}`);
      console.log(`Has hardcoded black: ${stylingAnalysis.chatInterface.hasHardcodedBlack}`);
      console.log(`Has hardcoded green: ${stylingAnalysis.chatInterface.hasHardcodedGreen}`);
      console.log(`Using theme colors: ${stylingAnalysis.isUsingThemeColors}`);
      console.log(`Styling mismatch with parent: ${stylingAnalysis.stylingMismatch}`);
    }
    
    await takeScreenshot(page, { name: 'styling-02-analysis-complete' });
    
    // PHASE 3: Test with different themes (if available)
    console.log('\n🎨 PHASE 3: Test Theme Responsiveness');
    
    // Try to find theme toggle or simulate theme change
    const themeTestResult = await page.evaluate(() => {
      // Check if there's a theme toggle or way to change themes
      const themeToggle = document.querySelector('[data-testid="theme-toggle"]') ||
                         document.querySelector('[aria-label*="theme"]') ||
                         document.querySelector('button[class*="theme"]');
      
      // Check current theme state
      const isDarkMode = document.documentElement.classList.contains('dark') ||
                        document.body.classList.contains('dark') ||
                        window.getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)';
      
      return {
        hasThemeToggle: !!themeToggle,
        currentTheme: isDarkMode ? 'dark' : 'light',
        themeToggleText: themeToggle ? themeToggle.textContent || themeToggle.getAttribute('aria-label') : null
      };
    });
    
    console.log(`Theme toggle available: ${themeTestResult.hasThemeToggle}`);
    console.log(`Current theme: ${themeTestResult.currentTheme}`);
    
    if (themeTestResult.hasThemeToggle) {
      // Click theme toggle and re-analyze
      await page.click('[data-testid="theme-toggle"], [aria-label*="theme"], button[class*="theme"]');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const postThemeChangeAnalysis = await page.evaluate(() => {
        const chatInterface = document.querySelector('[data-testid="chat-interface"]') ||
                             document.querySelector('.bg-black.text-green-400') ||
                             document.querySelector('[class*="terminal"]') ||
                             document.querySelector('[class*="chat"]');
        
        if (!chatInterface) return { found: false };
        
        const computedStyle = window.getComputedStyle(chatInterface);
        return {
          found: true,
          backgroundColor: computedStyle.backgroundColor,
          color: computedStyle.color,
          stillHardcoded: chatInterface.className.includes('bg-black')
        };
      });
      
      stylingData.styleAnalysis.push({ phase: 3, type: 'theme-change-test', ...postThemeChangeAnalysis });
      await takeScreenshot(page, { name: 'styling-03-theme-changed' });
    }
    
    // PHASE 4: Submit text to see styling in action
    console.log('\n🎨 PHASE 4: Test Styling During Interaction');
    
    await submitTextToAgent(page, { 
      text: 'Hello! Can you help me test the chat interface styling?',
      timeout: 3000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    await takeScreenshot(page, { name: 'styling-04-interaction-test' });
    
    // FINAL ANALYSIS
    console.log('\n📊 CHAT INTERFACE STYLING ANALYSIS');
    console.log('===================================');
    
    const findings = {
      chatInterfaceFound: stylingAnalysis.found,
      usesHardcodedColors: stylingAnalysis.found && stylingAnalysis.chatInterface.hasHardcodedBlack,
      hasThemeSupport: stylingAnalysis.found && stylingAnalysis.isUsingThemeColors,
      parentChildMismatch: stylingAnalysis.found && stylingAnalysis.stylingMismatch,
      themeToggleAvailable: themeTestResult.hasThemeToggle
    };
    
    stylingData.findings = findings;
    
    console.log('🔍 Key Findings:');
    console.log(`✅ Chat interface found: ${findings.chatInterfaceFound}`);
    console.log(`${findings.usesHardcodedColors ? '❌' : '✅'} Uses hardcoded colors: ${findings.usesHardcodedColors}`);
    console.log(`${findings.hasThemeSupport ? '✅' : '❌'} Has theme support: ${findings.hasThemeSupport}`);
    console.log(`${findings.parentChildMismatch ? '❌' : '✅'} Parent-child styling mismatch: ${findings.parentChildMismatch}`);
    console.log(`✅ Theme toggle available: ${findings.themeToggleAvailable}`);
    
    if (findings.usesHardcodedColors) {
      console.log('\n🚨 STYLING ISSUE IDENTIFIED:');
      console.log('- Chat interface uses hardcoded bg-black text-green-400 classes');
      console.log('- Should use theme-aware CSS classes like terminal-container');
      console.log('- Fix: Replace hardcoded classes with theme variables');
    }
    
    // Save detailed results
    const fs = require('fs');
    fs.writeFileSync('./chat-interface-styling-results.json', JSON.stringify(stylingData, null, 2));
    console.log('\n💾 Detailed styling analysis saved to: chat-interface-styling-results.json');
    
    console.log('\n⏰ Extended inspection time (30 seconds)');
    console.log('Use this time to manually observe the chat interface styling...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('❌ Chat interface styling test failed:', error);
    stylingData.error = error.message;
    await takeScreenshot(page, { name: 'styling-error' });
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

if (require.main === module) {
  testChatInterfaceStyling().catch(console.error);
}

module.exports = testChatInterfaceStyling;