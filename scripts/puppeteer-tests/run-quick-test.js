const { runFoundationPathway } = require('./pathways/foundation-pathway');

/**
 * Quick Test Runner
 * Runs just the foundation pathway for rapid validation
 * Use this for quick checks during development
 */
async function runQuickTest() {
  console.log('⚡ Context Pipeline - Quick Test Runner\n');
  console.log('=' .repeat(60));
  console.log('🏃‍♂️ RUNNING FOUNDATION PATHWAY ONLY');
  console.log('=' .repeat(60));
  console.log('⏱️  Estimated time: 3-5 minutes');
  console.log('🎯 Testing: Basic UI + Credentials (core requirements)\n');

  const startTime = Date.now();
  
  try {
    const foundationResult = await runFoundationPathway();
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log('\n' + '='.repeat(60));
    console.log('⚡ QUICK TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`🎯 Foundation Status: ${foundationResult.success ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (foundationResult.success) {
      console.log('🚀 Foundation is solid! Ready to run full test suite.');
      console.log('   Next step: node scripts/puppeteer-tests/run-all-tests.js');
    } else {
      console.log('🔧 Foundation issues detected. Fix these first:');
      foundationResult.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    return foundationResult.success;
    
  } catch (error) {
    console.error('❌ Quick test failed:', error.message);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  runQuickTest().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Quick test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runQuickTest };