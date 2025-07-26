const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

/**
 * Main Test Runner for Context Pipeline UI Testing
 * Orchestrates all test suites in logical order with proper dependencies
 */

// Import all test modules
const { testBasicUI } = require('./01-basic-ui-validation');
const { testCredentialsManagement } = require('./02-credentials-management');
const { testImportAndLibrary } = require('./03-import-and-library');
const { testWorkspaceLifecycle } = require('./04-workspace-lifecycle');
const { testAgentInteraction } = require('./05-agent-interaction');
const { testFileEditorOperations } = require('./06-file-editor-operations');
const { testGitIntegration } = require('./07-git-integration');
const { testAdvancedFeatures } = require('./08-advanced-features');

// Import pathway tests
const { runFoundationPathway } = require('./pathways/foundation-pathway');
const { runContentPathway } = require('./pathways/content-pathway');
const { runWorkflowPathway } = require('./pathways/workflow-pathway');
const { runIntegrationPathway } = require('./pathways/integration-pathway');

async function runAllTests() {
  console.log('🎯 Context Pipeline - Complete UI Test Suite\n');
  console.log('=' .repeat(80));
  console.log('🚀 STARTING COMPREHENSIVE UI TESTING');
  console.log('=' .repeat(80));
  
  const startTime = Date.now();
  const results = {
    timestamp: new Date().toISOString(),
    testMode: 'comprehensive',
    pathways: {},
    individualTests: {},
    summary: {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      totalPathways: 0,
      passedPathways: 0,
      failedPathways: 0
    },
    screenshots: [],
    errors: []
  };

  try {
    console.log('\n📋 Test Execution Plan:');
    console.log('   Phase 1: Foundation Pathway (UI + Credentials)');
    console.log('   Phase 2: Content Pathway (Import + Library)');
    console.log('   Phase 3: Workflow Pathway (Workspaces + Agents)');
    console.log('   Phase 4: Integration Pathway (Files + Git + Advanced)');
    console.log('   Phase 5: Individual Test Validation');
    console.log('\n⏱️  Estimated time: 15-20 minutes');
    console.log('🖥️  Browser: Headful mode for visual validation\n');

    // Phase 1: Foundation Pathway
    console.log('🏗️ Phase 1: Foundation Pathway');
    console.log('-'.repeat(50));
    const foundationResult = await runFoundationPathway();
    results.pathways.foundation = foundationResult;
    results.summary.totalPathways++;
    if (foundationResult.success) results.summary.passedPathways++;
    else results.summary.failedPathways++;
    
    if (!foundationResult.success) {
      console.log('⚠️  Foundation pathway failed. Continuing with caution...\n');
    }

    // Phase 2: Content Pathway
    console.log('\n📚 Phase 2: Content Pathway');
    console.log('-'.repeat(50));
    const contentResult = await runContentPathway();
    results.pathways.content = contentResult;
    results.summary.totalPathways++;
    if (contentResult.success) results.summary.passedPathways++;
    else results.summary.failedPathways++;

    // Phase 3: Workflow Pathway
    console.log('\n🔄 Phase 3: Workflow Pathway');
    console.log('-'.repeat(50));
    const workflowResult = await runWorkflowPathway();
    results.pathways.workflow = workflowResult;
    results.summary.totalPathways++;
    if (workflowResult.success) results.summary.passedPathways++;
    else results.summary.failedPathways++;

    // Phase 4: Integration Pathway
    console.log('\n🔧 Phase 4: Integration Pathway');
    console.log('-'.repeat(50));
    const integrationResult = await runIntegrationPathway();
    results.pathways.integration = integrationResult;
    results.summary.totalPathways++;
    if (integrationResult.success) results.summary.passedPathways++;
    else results.summary.failedPathways++;

    // Phase 5: Individual Test Validation (optional - if pathways missed anything)
    console.log('\n🔍 Phase 5: Individual Test Validation');
    console.log('-'.repeat(50));
    console.log('Running individual tests to catch any missed scenarios...\n');

    const individualTests = [
      { name: 'Advanced Features Deep Dive', test: testAdvancedFeatures }
    ];

    for (const { name, test } of individualTests) {
      console.log(`🧪 Running: ${name}`);
      try {
        const testResult = await test();
        results.individualTests[name] = { success: testResult, error: null };
        results.summary.totalTests++;
        if (testResult) results.summary.passedTests++;
        else results.summary.failedTests++;
      } catch (error) {
        console.error(`❌ ${name} failed:`, error.message);
        results.individualTests[name] = { success: false, error: error.message };
        results.summary.totalTests++;
        results.summary.failedTests++;
        results.errors.push(`${name}: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Critical test runner error:', error.message);
    results.errors.push(`Test runner error: ${error.message}`);
  }

  // Calculate totals
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);

  // Save comprehensive results
  await saveTestResults(results);

  // Print final summary
  printFinalSummary(results, duration);

  // Return overall success
  const overallSuccess = results.summary.failedPathways === 0 && results.summary.failedTests === 0;
  return overallSuccess;
}

async function saveTestResults(results) {
  const resultsDir = path.join(__dirname, 'results');
  await fs.mkdir(resultsDir, { recursive: true });
  
  // Save main results
  await fs.writeFile(
    path.join(resultsDir, 'comprehensive-test-results.json'),
    JSON.stringify(results, null, 2)
  );

  // Generate HTML report
  const htmlReport = generateHTMLReport(results);
  await fs.writeFile(
    path.join(resultsDir, 'test-report.html'),
    htmlReport
  );

  console.log(`\n📁 Results saved to: ${resultsDir}/`);
}

function printFinalSummary(results, duration) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE TEST RESULTS SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`⏱️  Total Duration: ${duration} seconds`);
  console.log(`📋 Test Pathways: ${results.summary.passedPathways}/${results.summary.totalPathways} passed`);
  console.log(`🧪 Individual Tests: ${results.summary.passedTests}/${results.summary.totalTests} passed`);
  
  // Pathway results
  console.log('\n🛤️  Pathway Results:');
  Object.entries(results.pathways).forEach(([name, result]) => {
    const status = result.success ? '✅' : '❌';
    const coverage = result.testsPassed || 0;
    console.log(`   ${status} ${name.charAt(0).toUpperCase() + name.slice(1)}: ${coverage} features tested`);
  });

  // Individual test results
  if (Object.keys(results.individualTests).length > 0) {
    console.log('\n🔍 Individual Test Results:');
    Object.entries(results.individualTests).forEach(([name, result]) => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${name}`);
    });
  }

  // Error summary
  if (results.errors.length > 0) {
    console.log('\n❌ Errors Encountered:');
    results.errors.forEach(error => console.log(`   • ${error}`));
  }

  // Overall status
  const overallSuccess = results.summary.failedPathways === 0 && results.summary.failedTests === 0;
  const overallStatus = overallSuccess ? '🎉 ALL TESTS PASSED!' : '⚠️  SOME TESTS FAILED';
  
  console.log(`\n🎯 Overall Status: ${overallStatus}`);
  
  if (overallSuccess) {
    console.log('\n🚀 Context Pipeline UI is fully functional and well-styled!');
    console.log('   All critical workflows validated successfully.');
  } else {
    console.log('\n🔧 Some issues found that may need attention:');
    console.log('   Check individual test results for specific failures.');
  }
  
  console.log('\n📖 View detailed report: results/test-report.html');
  console.log('='.repeat(80));
}

function generateHTMLReport(results) {
  const pathwayCards = Object.entries(results.pathways).map(([name, result]) => {
    const statusClass = result.success ? 'success' : 'failure';
    const statusIcon = result.success ? '✅' : '❌';
    
    return `
      <div class="pathway-card ${statusClass}">
        <h3>${statusIcon} ${name.charAt(0).toUpperCase() + name.slice(1)} Pathway</h3>
        <p><strong>Tests Passed:</strong> ${result.testsPassed || 0}</p>
        <p><strong>Tests Failed:</strong> ${result.testsFailed || 0}</p>
        <p><strong>Duration:</strong> ${result.duration || 'N/A'}</p>
        ${result.criticalFeatures ? `<p><strong>Critical Features:</strong> ${result.criticalFeatures.join(', ')}</p>` : ''}
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Context Pipeline - Comprehensive Test Report</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            margin: 20px; 
            line-height: 1.6; 
            background: #f5f5f5; 
        }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .pathways { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .pathway-card { padding: 20px; border-radius: 8px; border-left: 4px solid #28a745; }
        .pathway-card.success { background: #d4edda; border-color: #28a745; }
        .pathway-card.failure { background: #f8d7da; border-color: #dc3545; }
        .screenshot-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .screenshot { text-align: center; }
        .screenshot img { width: 100%; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        h1, h2 { color: #333; }
        .timestamp { color: #666; font-size: 0.9em; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Context Pipeline</h1>
            <h2>Comprehensive UI Test Report</h2>
            <p class="timestamp">Generated: ${results.timestamp}</p>
        </div>

        <div class="summary">
            <div class="summary-card">
                <h3>Pathways</h3>
                <p><strong>${results.summary.passedPathways}/${results.summary.totalPathways}</strong> Passed</p>
            </div>
            <div class="summary-card">
                <h3>Individual Tests</h3>
                <p><strong>${results.summary.passedTests}/${results.summary.totalTests}</strong> Passed</p>
            </div>
            <div class="summary-card">
                <h3>Overall Status</h3>
                <p class="${results.summary.failedPathways === 0 && results.summary.failedTests === 0 ? 'success' : 'failure'}">
                    ${results.summary.failedPathways === 0 && results.summary.failedTests === 0 ? '✅ SUCCESS' : '❌ ISSUES FOUND'}
                </p>
            </div>
        </div>

        <h2>🛤️ Pathway Results</h2>
        <div class="pathways">
            ${pathwayCards}
        </div>

        ${results.errors.length > 0 ? `
        <h2>❌ Errors</h2>
        <div style="background: #f8d7da; padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545;">
            <ul>
                ${results.errors.map(error => `<li>${error}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666;">
            <p>Generated by Context Pipeline Automated Testing Framework</p>
        </footer>
    </div>
</body>
</html>`;
}

// Run if called directly
if (require.main === module) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests };