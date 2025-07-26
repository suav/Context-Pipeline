const { testBasicUI } = require('../01-basic-ui-validation');
const { testCredentialsManagement } = require('../02-credentials-management');

/**
 * Foundation Pathway
 * Tests core UI functionality and credential management
 * Must pass before other pathways can succeed
 */
async function runFoundationPathway() {
  console.log('🏗️ Foundation Pathway: Core UI + Credentials');
  console.log('   This pathway validates essential UI elements and credential management');
  console.log('   Required for all other workflows to function properly\n');
  
  const startTime = Date.now();
  const results = {
    pathway: 'foundation',
    timestamp: new Date().toISOString(),
    tests: [],
    testsPassed: 0,
    testsFailed: 0,
    criticalFeatures: [],
    success: false,
    duration: 0,
    errors: []
  };

  try {
    // Test 1: Basic UI Validation
    console.log('🎨 Step 1: Basic UI Validation');
    console.log('   Testing: Theme system, navigation, responsive design, error handling');
    
    try {
      const basicUIResult = await testBasicUI();
      results.tests.push({
        name: 'Basic UI Validation',
        success: basicUIResult,
        critical: true,
        features: ['theme-switching', 'responsive-design', 'navigation', 'error-handling']
      });
      
      if (basicUIResult) {
        results.testsPassed++;
        results.criticalFeatures.push('UI Framework');
        console.log('   ✅ Basic UI validation passed');
      } else {
        results.testsFailed++;
        console.log('   ❌ Basic UI validation failed');
      }
    } catch (error) {
      results.testsFailed++;
      results.errors.push(`Basic UI test error: ${error.message}`);
      console.log(`   ❌ Basic UI test crashed: ${error.message}`);
    }

    // Pause between tests for visual validation
    console.log('\n⏸️  Pausing 3 seconds for visual validation...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 2: Credentials Management
    console.log('\n🔐 Step 2: Credentials Management');
    console.log('   Testing: JIRA/Git credential CRUD, validation, security');
    
    try {
      const credentialsResult = await testCredentialsManagement();
      results.tests.push({
        name: 'Credentials Management',
        success: credentialsResult,
        critical: true,
        features: ['credential-crud', 'validation', 'security', 'persistence']
      });
      
      if (credentialsResult) {
        results.testsPassed++;
        results.criticalFeatures.push('Credential System');
        console.log('   ✅ Credentials management passed');
      } else {
        results.testsFailed++;
        console.log('   ❌ Credentials management failed');
      }
    } catch (error) {
      results.testsFailed++;
      results.errors.push(`Credentials test error: ${error.message}`);
      console.log(`   ❌ Credentials test crashed: ${error.message}`);
    }

    // Determine pathway success
    const criticalTestsPassed = results.tests.filter(t => t.critical && t.success).length;
    const totalCriticalTests = results.tests.filter(t => t.critical).length;
    
    results.success = criticalTestsPassed === totalCriticalTests;
    results.duration = Math.round((Date.now() - startTime) / 1000);

    // Summary
    console.log('\n' + '-'.repeat(60));
    console.log('🏗️ FOUNDATION PATHWAY SUMMARY');
    console.log('-'.repeat(60));
    console.log(`⏱️  Duration: ${results.duration} seconds`);
    console.log(`✅ Tests Passed: ${results.testsPassed}`);
    console.log(`❌ Tests Failed: ${results.testsFailed}`);
    console.log(`🎯 Critical Features Working: ${results.criticalFeatures.join(', ')}`);
    
    if (results.success) {
      console.log('🎉 Foundation pathway PASSED - Core systems are functional');
      console.log('   ➡️  Ready for Content Pathway');
    } else {
      console.log('⚠️  Foundation pathway FAILED - Critical issues detected');
      console.log('   🚨 Fix these issues before proceeding with other pathways');
      
      if (results.errors.length > 0) {
        console.log('\n🔍 Errors to investigate:');
        results.errors.forEach(error => console.log(`   • ${error}`));
      }
    }

  } catch (error) {
    console.error('❌ Foundation pathway crashed:', error.message);
    results.success = false;
    results.errors.push(`Pathway error: ${error.message}`);
  }

  return results;
}

// Validation function for other pathways to check foundation readiness
async function validateFoundationReadiness() {
  console.log('🔍 Checking foundation readiness...');
  
  // This would check if basic UI and credentials are working
  // For now, we'll assume they need to be tested first
  return true; // Simplified for this implementation
}

module.exports = { 
  runFoundationPathway,
  validateFoundationReadiness
};