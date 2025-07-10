#!/usr/bin/env node
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
class UIEvaluator {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {
      timestamp: new Date().toISOString(),
      branches: {},
      overall: {
        visibility: 0,
        clarity: 0,
        responsiveness: 0,
        accessibility: 0,
        performance: 0
      },
      recommendations: []
    };
  }
  async initialize() {
    console.log('🎨 UI/UX Evaluator Agent - Initializing...');
    try {
      this.browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1920, height: 1080 }
      });
      this.page = await this.browser.newPage();
      // Set up performance monitoring
      await this.page.coverage.startJSCoverage();
      await this.page.coverage.startCSSCoverage();
      console.log('✅ Puppeteer initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Puppeteer:', error.message);
      return false;
    }
  }
  async evaluateBranch(branchName) {
    console.log(`\n🔍 Evaluating branch: ${branchName}`);
    const branchResults = {
      branch: branchName,
      scores: {
        visibility: 0,
        clarity: 0,
        responsiveness: 0,
        accessibility: 0,
        performance: 0
      },
      issues: [],
      recommendations: [],
      screenshots: []
    };
    try {
      // Checkout branch
      await execAsync(`git checkout ${branchName}`);
      // Start development server
      console.log('  🚀 Starting development server...');
      const serverProcess = exec('npm run dev');
      // Wait for server to start
      await this.waitForServer('http://localhost:3001', 30000);
      // Navigate to application
      await this.page.goto('http://localhost:3001', { waitUntil: 'networkidle2' });
      // Evaluate visibility
      branchResults.scores.visibility = await this.evaluateVisibility();
      // Evaluate clarity
      branchResults.scores.clarity = await this.evaluateClarity();
      // Evaluate responsiveness
      branchResults.scores.responsiveness = await this.evaluateResponsiveness();
      // Evaluate accessibility
      branchResults.scores.accessibility = await this.evaluateAccessibility();
      // Evaluate performance
      branchResults.scores.performance = await this.evaluatePerformance();
      // Take screenshots
      await this.captureScreenshots(branchName, branchResults);
      // Kill server
      serverProcess.kill();
      // Store results
      this.results.branches[branchName] = branchResults;
      console.log(`  ✅ Branch evaluation complete`);
      console.log(`     Visibility: ${branchResults.scores.visibility}/100`);
      console.log(`     Clarity: ${branchResults.scores.clarity}/100`);
      console.log(`     Responsiveness: ${branchResults.scores.responsiveness}/100`);
      console.log(`     Accessibility: ${branchResults.scores.accessibility}/100`);
      console.log(`     Performance: ${branchResults.scores.performance}/100`);
    } catch (error) {
      console.error(`❌ Error evaluating branch ${branchName}:`, error.message);
      branchResults.issues.push(`Evaluation failed: ${error.message}`);
    }
    return branchResults;
  }
  async evaluateVisibility() {
    console.log('    👁️  Evaluating visibility...');
    let score = 100;
    try {
      // Check for key UI elements
      const elements = await this.page.evaluate(() => {
        const results = {
          workspaceElements: document.querySelectorAll('[data-testid*="workspace"]').length,
          agentElements: document.querySelectorAll('[data-testid*="agent"]').length,
          navigationElements: document.querySelectorAll('nav, [role="navigation"]').length,
          buttonElements: document.querySelectorAll('button').length,
          inputElements: document.querySelectorAll('input, textarea').length,
          modalElements: document.querySelectorAll('[role="dialog"], .modal').length,
          hiddenElements: document.querySelectorAll('[style*="display: none"]').length,
          invisibleElements: document.querySelectorAll('[style*="visibility: hidden"]').length
        };
        // Check contrast ratios
        const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6');
        results.lowContrastElements = 0;
        textElements.forEach(el => {
          const style = window.getComputedStyle(el);
          const color = style.color;
          const bgColor = style.backgroundColor;
          // Simple contrast check (would need more sophisticated logic for real evaluation)
          if (color === 'rgb(128, 128, 128)' || color.includes('rgba') && color.includes('0.5')) {
            results.lowContrastElements++;
          }
        });
        return results;
      });
      // Score based on element visibility
      if (elements.workspaceElements === 0) score -= 20;
      if (elements.agentElements === 0) score -= 15;
      if (elements.navigationElements === 0) score -= 10;
      if (elements.buttonElements < 3) score -= 10;
      if (elements.hiddenElements > 5) score -= 10;
      if (elements.lowContrastElements > 3) score -= 15;
      // Check for overlapping elements
      const overlappingElements = await this.page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        let overlapping = 0;
        for (let i = 0; i < Math.min(elements.length, 100); i++) {
          const rect1 = elements[i].getBoundingClientRect();
          if (rect1.width === 0 || rect1.height === 0) continue;
          for (let j = i + 1; j < Math.min(elements.length, 100); j++) {
            const rect2 = elements[j].getBoundingClientRect();
            if (rect2.width === 0 || rect2.height === 0) continue;
            // Check for overlap
            if (rect1.left < rect2.right && rect1.right > rect2.left &&
                rect1.top < rect2.bottom && rect1.bottom > rect2.top) {
              overlapping++;
            }
          }
        }
        return overlapping;
      });
      if (overlappingElements > 5) score -= 20;
    } catch (error) {
      console.error('      ❌ Visibility evaluation error:', error.message);
      score -= 30;
    }
    return Math.max(0, score);
  }
  async evaluateClarity() {
    console.log('    🔍 Evaluating clarity...');
    let score = 100;
    try {
      const clarityMetrics = await this.page.evaluate(() => {
        const results = {
          totalText: document.body.innerText.length,
          headings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
          paragraphs: document.querySelectorAll('p').length,
          lists: document.querySelectorAll('ul, ol').length,
          buttons: document.querySelectorAll('button').length,
          buttonsWithText: Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim().length > 0).length,
          inputsWithLabels: 0,
          emptyElements: 0,
          veryLongTexts: 0
        };
        // Check input labels
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
          const label = document.querySelector(`label[for="${input.id}"]`) ||
                       input.closest('label') ||
                       input.getAttribute('aria-label') ||
                       input.getAttribute('placeholder');
          if (label) results.inputsWithLabels++;
        });
        // Check for empty elements
        const allElements = document.querySelectorAll('div, span, p, h1, h2, h3, h4, h5, h6');
        allElements.forEach(el => {
          if (el.innerText.trim().length === 0 && el.children.length === 0) {
            results.emptyElements++;
          }
          if (el.innerText.trim().length > 500) {
            results.veryLongTexts++;
          }
        });
        return results;
      });
      // Score based on clarity metrics
      if (clarityMetrics.headings === 0) score -= 20;
      if (clarityMetrics.buttonsWithText < clarityMetrics.buttons * 0.8) score -= 15;
      if (clarityMetrics.inputsWithLabels < inputs.length * 0.8) score -= 15;
      if (clarityMetrics.emptyElements > 10) score -= 10;
      if (clarityMetrics.veryLongTexts > 3) score -= 10;
      // Check for consistent styling
      const stylingConsistency = await this.page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        const inputs = document.querySelectorAll('input');
        let consistentButtons = 0;
        let consistentInputs = 0;
        if (buttons.length > 1) {
          const firstButtonStyle = window.getComputedStyle(buttons[0]);
          for (let i = 1; i < buttons.length; i++) {
            const style = window.getComputedStyle(buttons[i]);
            if (style.fontFamily === firstButtonStyle.fontFamily &&
                style.fontSize === firstButtonStyle.fontSize) {
              consistentButtons++;
            }
          }
        }
        if (inputs.length > 1) {
          const firstInputStyle = window.getComputedStyle(inputs[0]);
          for (let i = 1; i < inputs.length; i++) {
            const style = window.getComputedStyle(inputs[i]);
            if (style.fontFamily === firstInputStyle.fontFamily &&
                style.fontSize === firstInputStyle.fontSize) {
              consistentInputs++;
            }
          }
        }
        return {
          buttonConsistency: buttons.length > 1 ? consistentButtons / (buttons.length - 1) : 1,
          inputConsistency: inputs.length > 1 ? consistentInputs / (inputs.length - 1) : 1
        };
      });
      if (stylingConsistency.buttonConsistency < 0.8) score -= 10;
      if (stylingConsistency.inputConsistency < 0.8) score -= 10;
    } catch (error) {
      console.error('      ❌ Clarity evaluation error:', error.message);
      score -= 30;
    }
    return Math.max(0, score);
  }
  async evaluateResponsiveness() {
    console.log('    📱 Evaluating responsiveness...');
    let score = 100;
    try {
      const viewports = [
        { width: 1920, height: 1080, name: 'Desktop' },
        { width: 1024, height: 768, name: 'Tablet' },
        { width: 375, height: 667, name: 'Mobile' }
      ];
      for (const viewport of viewports) {
        await this.page.setViewport(viewport);
        await this.page.reload({ waitUntil: 'networkidle2' });
        const responsiveMetrics = await this.page.evaluate(() => {
          const body = document.body;
          const hasHorizontalScroll = body.scrollWidth > window.innerWidth;
          const overflowingElements = Array.from(document.querySelectorAll('*')).filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.right > window.innerWidth;
          }).length;
          const visibleElements = Array.from(document.querySelectorAll('*')).filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }).length;
          return {
            hasHorizontalScroll,
            overflowingElements,
            visibleElements,
            windowWidth: window.innerWidth,
            bodyWidth: body.offsetWidth
          };
        });
        // Score based on responsive behavior
        if (responsiveMetrics.hasHorizontalScroll && viewport.name !== 'Desktop') {
          score -= 15;
        }
        if (responsiveMetrics.overflowingElements > 0) {
          score -= 10;
        }
        // Check if elements are still visible at smaller sizes
        if (viewport.name === 'Mobile' && responsiveMetrics.visibleElements < 5) {
          score -= 20;
        }
      }
      // Reset to desktop view
      await this.page.setViewport({ width: 1920, height: 1080 });
    } catch (error) {
      console.error('      ❌ Responsiveness evaluation error:', error.message);
      score -= 30;
    }
    return Math.max(0, score);
  }
  async evaluateAccessibility() {
    console.log('    ♿ Evaluating accessibility...');
    let score = 100;
    try {
      const accessibilityMetrics = await this.page.evaluate(() => {
        const results = {
          imagesWithoutAlt: 0,
          buttonsWithoutText: 0,
          inputsWithoutLabels: 0,
          headingHierarchy: true,
          focusableElements: 0,
          ariaLabels: document.querySelectorAll('[aria-label]').length,
          roles: document.querySelectorAll('[role]').length
        };
        // Check images
        const images = document.querySelectorAll('img');
        images.forEach(img => {
          if (!img.alt || img.alt.trim().length === 0) {
            results.imagesWithoutAlt++;
          }
        });
        // Check buttons
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
          if (!button.innerText.trim() && !button.getAttribute('aria-label')) {
            results.buttonsWithoutText++;
          }
        });
        // Check inputs
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
          const hasLabel = document.querySelector(`label[for="${input.id}"]`) ||
                          input.closest('label') ||
                          input.getAttribute('aria-label') ||
                          input.getAttribute('placeholder');
          if (!hasLabel) {
            results.inputsWithoutLabels++;
          }
        });
        // Check heading hierarchy
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        let lastLevel = 0;
        headings.forEach(heading => {
          const level = parseInt(heading.tagName.charAt(1));
          if (level > lastLevel + 1) {
            results.headingHierarchy = false;
          }
          lastLevel = level;
        });
        // Check focusable elements
        const focusable = document.querySelectorAll('a, button, input, textarea, select, [tabindex]');
        results.focusableElements = focusable.length;
        return results;
      });
      // Score based on accessibility metrics
      if (accessibilityMetrics.imagesWithoutAlt > 0) score -= 15;
      if (accessibilityMetrics.buttonsWithoutText > 0) score -= 15;
      if (accessibilityMetrics.inputsWithoutLabels > 0) score -= 15;
      if (!accessibilityMetrics.headingHierarchy) score -= 10;
      if (accessibilityMetrics.focusableElements < 3) score -= 10;
      if (accessibilityMetrics.ariaLabels === 0) score -= 10;
      if (accessibilityMetrics.roles === 0) score -= 10;
    } catch (error) {
      console.error('      ❌ Accessibility evaluation error:', error.message);
      score -= 30;
    }
    return Math.max(0, score);
  }
  async evaluatePerformance() {
    console.log('    ⚡ Evaluating performance...');
    let score = 100;
    try {
      // Get performance metrics
      const performanceMetrics = await this.page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        const paint = performance.getEntriesByType('paint');
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
          resourceCount: performance.getEntriesByType('resource').length
        };
      });
      // Score based on performance metrics
      if (performanceMetrics.domContentLoaded > 2000) score -= 20;
      if (performanceMetrics.loadComplete > 5000) score -= 20;
      if (performanceMetrics.firstContentfulPaint > 1500) score -= 15;
      if (performanceMetrics.resourceCount > 50) score -= 10;
      // Check bundle size
      const jsCoverage = await this.page.coverage.stopJSCoverage();
      const cssCoverage = await this.page.coverage.stopCSSCoverage();
      let totalBytes = 0;
      let usedBytes = 0;
      [...jsCoverage, ...cssCoverage].forEach(entry => {
        totalBytes += entry.text.length;
        for (const range of entry.ranges) {
          usedBytes += range.end - range.start - 1;
        }
      });
      const wastePercentage = (unusedBytes / totalBytes) * 100;
      if (wastePercentage > 50) score -= 15;
      if (totalBytes > 1000000) score -= 10; // 1MB threshold
      // Restart coverage for next test
      await this.page.coverage.startJSCoverage();
      await this.page.coverage.startCSSCoverage();
    } catch (error) {
      console.error('      ❌ Performance evaluation error:', error.message);
      score -= 30;
    }
    return Math.max(0, score);
  }
  async captureScreenshots(branchName, branchResults) {
    console.log('    📸 Capturing screenshots...');
    try {
      const screenshotDir = `analysis/screenshots/${branchName}`;
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      // Desktop screenshot
      await this.page.setViewport({ width: 1920, height: 1080 });
      const desktopPath = `${screenshotDir}/desktop.png`;
      await this.page.screenshot({ path: desktopPath, fullPage: true });
      branchResults.screenshots.push(desktopPath);
      // Tablet screenshot
      await this.page.setViewport({ width: 1024, height: 768 });
      const tabletPath = `${screenshotDir}/tablet.png`;
      await this.page.screenshot({ path: tabletPath, fullPage: true });
      branchResults.screenshots.push(tabletPath);
      // Mobile screenshot
      await this.page.setViewport({ width: 375, height: 667 });
      const mobilePath = `${screenshotDir}/mobile.png`;
      await this.page.screenshot({ path: mobilePath, fullPage: true });
      branchResults.screenshots.push(mobilePath);
      console.log(`      ✅ Screenshots saved to ${screenshotDir}`);
    } catch (error) {
      console.error('      ❌ Screenshot capture error:', error.message);
    }
  }
  async waitForServer(url, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return true;
        }
      } catch (error) {
        // Server not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error(`Server at ${url} did not start within ${timeout}ms`);
  }
  async generateReport() {
    console.log('\n📊 Generating UI/UX Evaluation Report...');
    // Calculate overall scores
    const branches = Object.values(this.results.branches);
    if (branches.length > 0) {
      this.results.overall.visibility = branches.reduce((sum, b) => sum + b.scores.visibility, 0) / branches.length;
      this.results.overall.clarity = branches.reduce((sum, b) => sum + b.scores.clarity, 0) / branches.length;
      this.results.overall.responsiveness = branches.reduce((sum, b) => sum + b.scores.responsiveness, 0) / branches.length;
      this.results.overall.accessibility = branches.reduce((sum, b) => sum + b.scores.accessibility, 0) / branches.length;
      this.results.overall.performance = branches.reduce((sum, b) => sum + b.scores.performance, 0) / branches.length;
    }
    // Generate recommendations
    this.generateRecommendations();
    // Save detailed results
    const reportPath = 'analysis/ui-evaluation-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    // Generate markdown report
    const markdownReport = this.generateMarkdownReport();
    fs.writeFileSync('analysis/UI_EVALUATION_REPORT.md', markdownReport);
    console.log(`✅ UI/UX Evaluation Report saved to ${reportPath}`);
    console.log(`📄 Markdown report saved to analysis/UI_EVALUATION_REPORT.md`);
  }
  generateRecommendations() {
    // Analyze results and generate recommendations
    const recommendations = [];
    if (this.results.overall.visibility < 80) {
      recommendations.push('🔍 **Visibility Issues**: Some UI elements may be hard to see. Consider improving contrast ratios and reducing overlapping elements.');
    }
    if (this.results.overall.clarity < 80) {
      recommendations.push('📝 **Clarity Issues**: UI elements need clearer labeling and better organization. Add more descriptive text and improve button labels.');
    }
    if (this.results.overall.responsiveness < 80) {
      recommendations.push('📱 **Responsiveness Issues**: Layout breaks on smaller screens. Implement better responsive design with proper breakpoints.');
    }
    if (this.results.overall.accessibility < 80) {
      recommendations.push('♿ **Accessibility Issues**: Add alt text to images, proper labels to inputs, and improve keyboard navigation.');
    }
    if (this.results.overall.performance < 80) {
      recommendations.push('⚡ **Performance Issues**: Optimize bundle size and reduce load times. Consider code splitting and lazy loading.');
    }
    this.results.recommendations = recommendations;
  }
  generateMarkdownReport() {
    const branches = Object.values(this.results.branches);
    const overall = this.results.overall;
    let report = `# UI/UX Evaluation Report\n\n`;
    report += `**Generated:** ${this.results.timestamp}\n\n`;
    report += `## Overall Scores\n\n`;
    report += `| Metric | Score | Status |\n`;
    report += `|--------|-------|--------|\n`;
    report += `| Visibility | ${overall.visibility.toFixed(1)}/100 | ${overall.visibility >= 80 ? '✅' : '⚠️'} |\n`;
    report += `| Clarity | ${overall.clarity.toFixed(1)}/100 | ${overall.clarity >= 80 ? '✅' : '⚠️'} |\n`;
    report += `| Responsiveness | ${overall.responsiveness.toFixed(1)}/100 | ${overall.responsiveness >= 80 ? '✅' : '⚠️'} |\n`;
    report += `| Accessibility | ${overall.accessibility.toFixed(1)}/100 | ${overall.accessibility >= 80 ? '✅' : '⚠️'} |\n`;
    report += `| Performance | ${overall.performance.toFixed(1)}/100 | ${overall.performance >= 80 ? '✅' : '⚠️'} |\n\n`;
    report += `## Branch-by-Branch Analysis\n\n`;
    branches.forEach(branch => {
      report += `### ${branch.branch}\n\n`;
      report += `| Metric | Score |\n`;
      report += `|--------|-------|\n`;
      report += `| Visibility | ${branch.scores.visibility}/100 |\n`;
      report += `| Clarity | ${branch.scores.clarity}/100 |\n`;
      report += `| Responsiveness | ${branch.scores.responsiveness}/100 |\n`;
      report += `| Accessibility | ${branch.scores.accessibility}/100 |\n`;
      report += `| Performance | ${branch.scores.performance}/100 |\n\n`;
      if (branch.screenshots.length > 0) {
        report += `**Screenshots:**\n`;
        branch.screenshots.forEach(screenshot => {
          report += `- ![${path.basename(screenshot)}](${screenshot})\n`;
        });
        report += `\n`;
      }
    });
    if (this.results.recommendations.length > 0) {
      report += `## Recommendations\n\n`;
      this.results.recommendations.forEach(rec => {
        report += `${rec}\n\n`;
      });
    }
    return report;
  }
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
    // Switch back to main branch
    try {
      await execAsync('git checkout main');
    } catch (error) {
      console.error('Failed to switch back to main branch:', error.message);
    }
  }
  async run() {
    const branches = [
      'feature/permissions-system',
      'feature/checkpoint-system',
      'feature/git-operations',
      'feature/context-import',
      'feature/ui-improvements'
    ];
    const initialized = await this.initialize();
    if (!initialized) {
      console.error('❌ Failed to initialize UI evaluator');
      return;
    }
    try {
      for (const branch of branches) {
        await this.evaluateBranch(branch);
      }
      await this.generateReport();
    } catch (error) {
      console.error('❌ UI evaluation failed:', error.message);
    } finally {
      await this.cleanup();
    }
  }
}
// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const evaluator = new UIEvaluator();
  if (args.includes('--help')) {
    console.log('UI/UX Evaluator Agent');
    console.log('Usage:');
    console.log('  node ui-evaluator.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --help          Show this help');
    return;
  }
  await evaluator.run();
}
// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
module.exports = UIEvaluator;