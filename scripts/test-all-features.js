const PuppeteerConfig = require('./puppeteer-config');
const ContextPipelineCompleteTester = require('./test-context-pipeline-complete');
const SimpleFunctionalityTest = require('./test-simple-functionality');
const fs = require('fs').promises;
const path = require('path');

/**
 * Master Test Runner for Context Pipeline
 * Runs all feature tests and generates comprehensive reports
 */
class MasterTestRunner {
  constructor() {
    this.config = new PuppeteerConfig();
    this.results = {
      timestamp: new Date().toISOString(),
      tests: {},
      summary: {
        totalSuites: 0,
        passedSuites: 0,
        failedSuites: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0
      }
    };
  }

  async initialize() {
    this.config.log('🚀 Starting Master Test Runner for Context Pipeline...', true);
    
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      PuppeteerConfig.printUsage();
      console.log('\n🧪 Master Test Runner Options:');
      console.log('  --suite <name>         Run specific test suite only');
      console.log('                         Options: library, workspace, agent, ui, all');
      console.log('  --quick               Skip slow tests');
      console.log('  --report-only         Generate report from existing results');
      console.log('\nAvailable Test Suites:');
      console.log('  🎯 complete          Complete Context Pipeline test (recommended)');
      console.log('  🚀 simple            Simple functionality check');
      console.log('\nExamples:');
      console.log('  node test-all-features.js --headless --quick');
      console.log('  node test-all-features.js --suite library --headful');
      console.log('  node test-all-features.js --slow --devtools');
      process.exit(0);
    }

    // Create results directory
    const resultsDir = path.join(process.cwd(), 'analysis', 'comprehensive-testing');
    await fs.mkdir(resultsDir, { recursive: true });
    
    this.config.log(`📊 Results will be saved to: ${resultsDir}`, true);
  }

  async runTestSuite(name, TesterClass, description) {
    this.config.log(`\n${'='.repeat(60)}`, true);
    this.config.log(`🧪 RUNNING ${description.toUpperCase()} TESTS`, true);
    this.config.log(`${'='.repeat(60)}`, true);
    
    try {
      const tester = new TesterClass();
      const result = await tester.run();
      
      this.results.tests[name] = {
        description,
        success: true,
        ...result
      };
      
      this.results.summary.totalSuites++;
      this.results.summary.passedSuites++;
      this.results.summary.totalTests += result.totalTests;
      this.results.summary.passedTests += result.passedTests;
      this.results.summary.failedTests += result.failedTests;
      
      this.config.log(`✅ ${description} tests completed successfully`, true);
      
    } catch (error) {
      this.config.log(`❌ ${description} tests failed: ${error.message}`, true);
      
      this.results.tests[name] = {
        description,
        success: false,
        error: error.message,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0
      };
      
      this.results.summary.totalSuites++;
      this.results.summary.failedSuites++;
    }
  }

  async runAllTests() {
    const args = process.argv.slice(2);
    const suiteArg = args.find(arg => arg.startsWith('--suite='));
    const specificSuite = suiteArg ? suiteArg.split('=')[1] : null;
    const quickMode = args.includes('--quick');
    
    if (specificSuite) {
      this.config.log(`🎯 Running specific test suite: ${specificSuite}`, true);
    } else {
      this.config.log('🌟 Running all test suites...', true);
    }
    
    const testSuites = [
      { name: 'complete', class: ContextPipelineCompleteTester, description: 'Complete Context Pipeline' },
      { name: 'simple', class: SimpleFunctionalityTest, description: 'Simple Functionality Check' }
    ];
    
    // Filter suites if specific suite requested
    const suitesToRun = specificSuite 
      ? testSuites.filter(suite => suite.name === specificSuite || specificSuite === 'all')
      : testSuites;
    
    if (suitesToRun.length === 0) {
      throw new Error(`Unknown test suite: ${specificSuite}. Available: ${testSuites.map(s => s.name).join(', ')}`);
    }
    
    // Run test suites sequentially to avoid conflicts
    for (const suite of suitesToRun) {
      await this.runTestSuite(suite.name, suite.class, suite.description);
      
      // Wait between test suites to ensure clean state
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async generateReport() {
    this.config.log('\n📊 Generating Comprehensive Test Report...', true);
    
    const timestamp = this.results.timestamp;
    const resultsDir = path.join(process.cwd(), 'analysis', 'comprehensive-testing');
    
    // Save JSON report
    const jsonPath = path.join(resultsDir, `test-results-${new Date().toISOString().split('T')[0]}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(this.results, null, 2));
    
    // Generate HTML report
    const htmlReport = this.generateHTMLReport();
    const htmlPath = path.join(resultsDir, `test-report-${new Date().toISOString().split('T')[0]}.html`);
    await fs.writeFile(htmlPath, htmlReport);
    
    // Generate summary report
    const summaryPath = path.join(resultsDir, 'latest-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(this.results.summary, null, 2));
    
    return {
      jsonPath,
      htmlPath,
      summaryPath,
      results: this.results
    };
  }

  generateHTMLReport() {
    const { summary, tests } = this.results;
    const successRate = summary.totalTests > 0 ? Math.round((summary.passedTests / summary.totalTests) * 100) : 0;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Context Pipeline - Comprehensive Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric h3 { margin: 0 0 10px 0; color: #374151; }
        .metric .value { font-size: 2.5em; font-weight: bold; margin: 10px 0; }
        .success .value { color: #10b981; }
        .failure .value { color: #ef4444; }
        .neutral .value { color: #6b7280; }
        .test-suite { background: white; margin: 20px 0; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .suite-header { display: flex; align-items: center; margin-bottom: 15px; }
        .suite-status { width: 20px; height: 20px; border-radius: 50%; margin-right: 10px; }
        .suite-success { background: #10b981; }
        .suite-failure { background: #ef4444; }
        .test-result { margin: 10px 0; padding: 10px; border-left: 4px solid #e5e7eb; background: #f9fafb; }
        .test-success { border-left-color: #10b981; }
        .test-failure { border-left-color: #ef4444; }
        .progress-bar { background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #10b981, #059669); transition: width 0.3s ease; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Context Pipeline - Comprehensive Test Report</h1>
        <p>Generated: ${new Date(this.results.timestamp).toLocaleString()}</p>
        <p>Browser Automation Testing with Puppeteer</p>
    </div>
    
    <div class="summary">
        <div class="metric neutral">
            <h3>Test Suites</h3>
            <div class="value">${summary.totalSuites}</div>
            <p>Total Executed</p>
        </div>
        <div class="metric success">
            <h3>Suite Success</h3>
            <div class="value">${summary.passedSuites}</div>
            <p>Suites Passed</p>
        </div>
        <div class="metric neutral">
            <h3>Total Tests</h3>
            <div class="value">${summary.totalTests}</div>
            <p>Individual Tests</p>
        </div>
        <div class="metric ${successRate >= 80 ? 'success' : successRate >= 60 ? 'neutral' : 'failure'}">
            <h3>Success Rate</h3>
            <div class="value">${successRate}%</div>
            <p>Overall Performance</p>
        </div>
    </div>
    
    <div class="progress-bar">
        <div class="progress-fill" style="width: ${successRate}%"></div>
    </div>
    
    <h2>📋 Test Suite Results</h2>
    
    ${Object.entries(tests).map(([name, test]) => `
        <div class="test-suite">
            <div class="suite-header">
                <div class="suite-status ${test.success ? 'suite-success' : 'suite-failure'}"></div>
                <h3>${test.description}</h3>
                <span style="margin-left: auto; ${test.success ? 'color: #10b981' : 'color: #ef4444'}">
                    ${test.success ? '✅ PASSED' : '❌ FAILED'}
                </span>
            </div>
            
            ${test.success ? `
                <p><strong>Tests:</strong> ${test.passedTests}/${test.totalTests} passed</p>
                ${test.results ? test.results.map(result => `
                    <div class="test-result ${result.success ? 'test-success' : 'test-failure'}">
                        <strong>${result.success ? '✅' : '❌'} ${result.feature}</strong><br>
                        <small>${result.details}</small>
                    </div>
                `).join('') : ''}
            ` : `
                <div class="test-result test-failure">
                    <strong>❌ Suite Failed</strong><br>
                    <small>Error: ${test.error}</small>
                </div>
            `}
        </div>
    `).join('')}
    
    <div style="margin-top: 40px; padding: 20px; background: white; border-radius: 8px; text-align: center;">
        <h3>🤖 Puppeteer Browser Automation</h3>
        <p>This report was generated using automated browser testing with Puppeteer.</p>
        <p>Tests can be run in both headful (visible) and headless (fast) modes.</p>
        <p><strong>Next Run:</strong> <code>node scripts/test-all-features.js --help</code></p>
    </div>
</body>
</html>`;
  }

  async printSummary() {
    const { summary } = this.results;
    const successRate = summary.totalTests > 0 ? Math.round((summary.passedTests / summary.totalTests) * 100) : 0;
    
    this.config.log('\n' + '='.repeat(70), true);
    this.config.log('🎯 CONTEXT PIPELINE - COMPREHENSIVE TEST SUMMARY', true);
    this.config.log('='.repeat(70), true);
    this.config.log(`🧪 Test Suites: ${summary.passedSuites}/${summary.totalSuites} passed`, true);
    this.config.log(`📊 Individual Tests: ${summary.passedTests}/${summary.totalTests} passed`, true);
    this.config.log(`📈 Overall Success Rate: ${successRate}%`, true);
    this.config.log(`⏱️  Completed: ${new Date().toLocaleString()}`, true);
    
    if (successRate >= 80) {
      this.config.log('🎉 EXCELLENT! All systems operational', true);
    } else if (successRate >= 60) {
      this.config.log('⚠️  GOOD: Some issues detected, review failed tests', true);
    } else {
      this.config.log('🚨 NEEDS ATTENTION: Multiple failures detected', true);
    }
    
    this.config.log('\n📁 Detailed results saved to: analysis/comprehensive-testing/', true);
  }

  async run() {
    try {
      await this.initialize();
      
      if (!process.argv.includes('--report-only')) {
        await this.runAllTests();
      }
      
      const reportPaths = await this.generateReport();
      await this.printSummary();
      
      this.config.log(`\n🌐 View HTML Report: file://${reportPaths.htmlPath}`, true);
      
      return this.results;
      
    } catch (error) {
      this.config.log(`❌ Master test runner failed: ${error.message}`, true);
      throw error;
    }
  }
}

if (require.main === module) {
  const runner = new MasterTestRunner();
  runner.run().catch(console.error);
}

module.exports = MasterTestRunner;