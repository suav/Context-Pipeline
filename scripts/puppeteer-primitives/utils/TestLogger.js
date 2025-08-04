/**
 * TestLogger - Comprehensive logging and debugging for primitive actions
 * 
 * Provides standardized logging, timing, screenshots, and debugging
 * across all primitive actions for maximum visibility into test execution.
 */

class TestLogger {
  constructor(testName, options = {}) {
    this.testName = testName;
    this.startTime = Date.now();
    this.steps = [];
    this.currentStep = null;
    this.screenshotCount = 0;
    
    this.options = {
      verbose: options.verbose !== false,        // Default to verbose
      screenshots: options.screenshots !== false, // Default to screenshots
      timing: options.timing !== false,          // Default to timing
      console: options.console !== false,        // Default to console logging
      pageEvaluation: options.pageEvaluation !== false, // Default to page eval logging
      ...options
    };
    
    this.log(`🚀 Starting test: ${testName}`, 'TEST_START');
  }
  
  /**
   * Start a new step in the test
   */
  startStep(stepName, action) {
    if (this.currentStep) {
      this.endStep('incomplete');
    }
    
    this.currentStep = {
      name: stepName,
      action: action,
      startTime: Date.now(),
      logs: [],
      screenshots: [],
      pageStates: []
    };
    
    this.log(`📍 Step ${this.steps.length + 1}: ${stepName}`, 'STEP_START');
  }
  
  /**
   * End the current step
   */
  endStep(status = 'success', data = null, error = null) {
    if (!this.currentStep) return;
    
    const duration = Date.now() - this.currentStep.startTime;
    this.currentStep.duration = duration;
    this.currentStep.status = status;
    this.currentStep.data = data;
    this.currentStep.error = error;
    
    const icon = status === 'success' ? '✅' : status === 'error' ? '❌' : '⚠️';
    this.log(`${icon} Step completed: ${this.currentStep.name} (${duration}ms)`, 'STEP_END');
    
    this.steps.push(this.currentStep);
    this.currentStep = null;
  }
  
  /**
   * Log a message with timestamp and context
   */
  log(message, type = 'INFO', data = null) {
    const timestamp = new Date().toISOString();
    const elapsed = Date.now() - this.startTime;
    
    const logEntry = {
      timestamp,
      elapsed,
      type,
      message,
      data,
      step: this.currentStep?.name || null
    };
    
    if (this.currentStep) {
      this.currentStep.logs.push(logEntry);
    }
    
    if (this.options.console) {
      const prefix = `[${elapsed}ms]`;
      console.log(`${prefix} ${message}`);
      if (data && this.options.verbose) {
        console.log(`${prefix}   Data:`, data);
      }
    }
  }
  
  /**
   * Log page evaluation for debugging
   */
  async logPageState(page, description, selector = null) {
    if (!this.options.pageEvaluation) return;
    
    try {
      const pageState = await page.evaluate((desc, sel) => {
        const state = {
          description: desc,
          url: window.location.href,
          title: document.title,
          timestamp: new Date().toISOString()
        };
        
        if (sel) {
          const element = document.querySelector(sel);
          state.targetElement = {
            selector: sel,
            found: !!element,
            visible: element ? element.offsetParent !== null : false,
            text: element ? element.textContent.substring(0, 100) : null,
            classes: element ? element.className : null
          };
        }
        
        // General page info
        state.elementsCount = {
          divs: document.querySelectorAll('div').length,
          buttons: document.querySelectorAll('button').length,
          inputs: document.querySelectorAll('input').length,
          forms: document.querySelectorAll('form').length
        };
        
        // Check for common UI states
        state.uiStates = {
          hasModal: document.querySelector('[role="dialog"], .modal') !== null,
          hasLoading: document.querySelector('[class*="loading"], [class*="spinner"]') !== null,
          hasError: document.querySelector('[class*="error"], .error') !== null
        };
        
        return state;
      }, description, selector);
      
      if (this.currentStep) {
        this.currentStep.pageStates.push(pageState);
      }
      
      this.log(`📊 Page state: ${description}`, 'PAGE_STATE', pageState);
      return pageState;
      
    } catch (error) {
      this.log(`❌ Failed to capture page state: ${error.message}`, 'PAGE_STATE_ERROR');
      return null;
    }
  }
  
  /**
   * Take a screenshot with auto-naming
   */
  async screenshot(page, name = null, fullPage = true) {
    if (!this.options.screenshots) return null;
    
    try {
      this.screenshotCount++;
      const stepNum = this.steps.length + 1;
      const autoName = name || `${stepNum.toString().padStart(2, '0')}-${this.currentStep?.name?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}`;
      
      const path = `scripts/puppeteer-primitives/screenshots/${this.testName}-${autoName}.png`;
      
      await page.screenshot({ path, fullPage });
      
      if (this.currentStep) {
        this.currentStep.screenshots.push({ name: autoName, path });
      }
      
      this.log(`📸 Screenshot: ${autoName}`, 'SCREENSHOT', { path });
      return path;
      
    } catch (error) {
      this.log(`❌ Screenshot failed: ${error.message}`, 'SCREENSHOT_ERROR');
      return null;
    }
  }
  
  /**
   * Log timing information
   */
  logTiming(operation, duration) {
    if (!this.options.timing) return;
    
    const timing = {
      operation,
      duration,
      timestamp: Date.now()
    };
    
    this.log(`⏱️  Timing: ${operation} took ${duration}ms`, 'TIMING', timing);
  }
  
  /**
   * Debug element selection
   */
  async debugElementSelection(page, selector, description = '') {
    this.log(`🔍 Debugging element selection: ${selector} ${description}`, 'DEBUG');
    
    const debugInfo = await page.evaluate((sel, desc) => {
      const elements = document.querySelectorAll(sel);
      const info = {
        selector: sel,
        description: desc,
        found: elements.length,
        elements: Array.from(elements).slice(0, 5).map((el, i) => ({
          index: i,
          tagName: el.tagName,
          className: el.className,
          text: el.textContent?.substring(0, 100),
          visible: el.offsetParent !== null,
          clickable: el.style.cursor === 'pointer' || el.onclick !== null
        }))
      };
      
      return info;
    }, selector, description);
    
    this.log(`🔍 Element debug results`, 'DEBUG', debugInfo);
    return debugInfo;
  }
  
  /**
   * Wait with logging
   */
  async wait(duration, reason = '') {
    this.log(`⏳ Waiting ${duration}ms ${reason}`, 'WAIT');
    await new Promise(resolve => setTimeout(resolve, duration));
  }
  
  /**
   * Generate comprehensive test report
   */
  generateReport() {
    const totalDuration = Date.now() - this.startTime;
    const successCount = this.steps.filter(s => s.status === 'success').length;
    const errorCount = this.steps.filter(s => s.status === 'error').length;
    
    const report = {
      testName: this.testName,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      totalDuration,
      summary: {
        totalSteps: this.steps.length,
        successful: successCount,
        errors: errorCount,
        successRate: Math.round((successCount / this.steps.length) * 100)
      },
      steps: this.steps,
      screenshots: this.steps.flatMap(s => s.screenshots),
      timing: {
        averageStepDuration: Math.round(this.steps.reduce((sum, s) => sum + s.duration, 0) / this.steps.length),
        slowestStep: this.steps.reduce((slowest, s) => s.duration > slowest.duration ? s : slowest, { duration: 0 }),
        fastestStep: this.steps.reduce((fastest, s) => s.duration < fastest.duration ? s : fastest, { duration: Infinity })
      }
    };
    
    // Save report to file
    const fs = require('fs');
    const reportPath = `scripts/puppeteer-primitives/test-reports/${this.testName}-report.json`;
    const dir = require('path').dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.log(`📄 Test report saved: ${reportPath}`, 'REPORT', { 
      successRate: report.summary.successRate,
      totalDuration: report.totalDuration
    });
    
    return report;
  }
  
  /**
   * Print summary to console
   */
  printSummary() {
    const report = this.generateReport();
    
    console.log('\\n🎯 TEST SUMMARY');
    console.log('===============');
    console.log(`Test: ${this.testName}`);
    console.log(`Duration: ${report.totalDuration}ms`);
    console.log(`Steps: ${report.summary.totalSteps} (${report.summary.successful} ✅, ${report.summary.errors} ❌)`);
    console.log(`Success Rate: ${report.summary.successRate}%`);
    console.log(`Screenshots: ${report.screenshots.length}`);
    
    if (report.summary.errors > 0) {
      console.log('\\n❌ Failed Steps:');
      this.steps.filter(s => s.status === 'error').forEach(step => {
        console.log(`  - ${step.name}: ${step.error}`);
      });
    }
    
    console.log(`\\n📄 Detailed report: ${reportPath}`);
  }
}

module.exports = TestLogger;