#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');
// Test configuration
const TEST_STORAGE_PATH = path.join(process.cwd(), 'storage', 'checkpoints');
// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};
// Duplicate function removed: colorLog (see ./test/checkpoints/save-restore.test.js)${message}${colors.reset}`);
}
// Test results tracking
let testResults = {
  total: 0,
  passed: 0,
  failed: 0
};
// Duplicate function removed: assert (see ./test/checkpoints/save-restore.test.js)`, 'green');
    if (details) colorLog(`   ${details}`, 'cyan');
  } else {
    testResults.failed++;
    colorLog(`❌ FAIL: ${testName}`, 'red');
    if (details) colorLog(`   ${details}`, 'yellow');
  }
}
// Test checkpoint storage directory structure
async function testStorageStructure() {
  colorLog('\n📁 Testing Checkpoint Storage Structure...', 'blue');
  try {
    // Check if checkpoint storage directory exists
    const storageExists = await fs.access(TEST_STORAGE_PATH).then(() => true).catch(() => false);
    assert(storageExists, 'Checkpoint storage directory exists', TEST_STORAGE_PATH);
    if (storageExists) {
      // Check subdirectories
      const subdirs = ['data', 'summaries', 'analytics'];
      for (const subdir of subdirs) {
        const subdirPath = path.join(TEST_STORAGE_PATH, subdir);
        const subdirExists = await fs.access(subdirPath).then(() => true).catch(() => false);
        assert(subdirExists, `${subdir} subdirectory exists`, subdirPath);
      }
      // Check index file
      const indexPath = path.join(TEST_STORAGE_PATH, 'checkpoint-index.json');
      const indexExists = await fs.access(indexPath).then(() => true).catch(() => false);
      assert(indexExists, 'Checkpoint index file exists', indexPath);
      if (indexExists) {
        // Validate index file structure
        try {
          const indexContent = await fs.readFile(indexPath, 'utf-8');
          const index = JSON.parse(indexContent);
          assert(typeof index.last_updated === 'string', 'Index has last_updated field');
          assert(typeof index.checkpoints === 'object', 'Index has checkpoints object');
          assert(typeof index.search_metadata === 'object', 'Index has search_metadata object');
        } catch (parseError) {
          assert(false, 'Index file is valid JSON', parseError.message);
        }
      }
    }
  } catch (error) {
    assert(false, 'Storage structure test', error.message);
  }
}
// Test checkpoint data file creation
async function testCheckpointDataCreation() {
  colorLog('\n📄 Testing Checkpoint Data Creation...', 'blue');
  try {
    // Create a test checkpoint file
    const testCheckpointId = `test-checkpoint-${Date.now()}`;
    const testCheckpointPath = path.join(TEST_STORAGE_PATH, 'data', `${testCheckpointId}.json`);
    const testCheckpointData = {
      id: testCheckpointId,
      title: 'Test Checkpoint',
      description: 'A test checkpoint for functionality testing',
      agentType: 'claude',
      conversation_id: 'test-conversation',
      workspace_context: {
        timestamp: new Date().toISOString(),
        workspace_structure: {
          context_items: [],
          target_files: [],
          feedback_files: []
        },
        git_state: {
          branch: 'main',
          commit_hash: '',
          modified_files: [],
          staged_files: []
        },
        context_description: 'Test workspace context'
      },
      expertise_summary: 'Test expertise summary',
      performance_metrics: {
        success_rate: 0.9,
        avg_response_time: 1000,
        user_satisfaction: 4.5,
        task_completion_rate: 0.85,
        commands_executed: 10,
        errors_encountered: 1,
        tokens_processed: 5000,
        context_understanding_score: 0.8,
        knowledge_retention_score: 0.9,
        adaptation_efficiency: 0.75
      },
      tags: ['test', 'functionality'],
      created_at: new Date().toISOString(),
      usage_count: 0,
      agent_id: 'test-agent',
      workspace_id: 'test-workspace',
      created_by: 'test-user',
      full_conversation_state: {
        messages: [
          {
            id: 'msg-1',
            timestamp: new Date().toISOString(),
            role: 'user',
            content: 'Test message'
          }
        ],
        total_tokens: 100,
        command_history: [],
        knowledge_areas: ['testing'],
        learned_patterns: ['test-pattern'],
        conversation_summary: 'Test conversation'
      },
      agent_configuration: {
        model: 'claude-3-5-sonnet',
        permissions: {
          read_context: true,
          read_target: true,
          write_target: true,
          write_feedback: true,
          git_read: true,
          git_stage: true,
          git_commit: true,
          git_push: false,
          bash_execution: true,
          file_operations: ['read', 'write'],
          workspace_boundary: true,
          deletion_approval: true,
          max_commands_per_session: 100,
          command_cooldown_ms: 0
        },
        specialized_commands: ['test-command'],
        context_understanding: { 'test-context': 0.8 },
        performance_metrics: {
          total_messages: 10,
          total_commands_used: 5,
          commands_by_type: { 'test': 5 },
          session_duration_ms: 60000,
          human_interventions: [],
          performance_scores: {
            task_completion_rate: 0.9,
            error_rate: 0.1,
            context_understanding: 0.8
          }
        }
      },
      expertise_areas: ['testing'],
      context_types: ['test'],
      success_indicators: ['test-success'],
      analytics_summary: {
        total_sessions: 1,
        successful_restorations: 0,
        average_continuation_length: 0,
        user_feedback_score: 0,
        most_common_use_cases: [],
        effectiveness_rating: 4.0
      }
    };
    // Write test checkpoint
    await fs.mkdir(path.dirname(testCheckpointPath), { recursive: true });
    await fs.writeFile(testCheckpointPath, JSON.stringify(testCheckpointData, null, 2));
    assert(true, 'Test checkpoint file created');
    // Verify file was created and can be read
    const fileExists = await fs.access(testCheckpointPath).then(() => true).catch(() => false);
    assert(fileExists, 'Test checkpoint file exists');
    if (fileExists) {
      try {
        const readData = await fs.readFile(testCheckpointPath, 'utf-8');
        const parsedData = JSON.parse(readData);
        assert(parsedData.id === testCheckpointId, 'Checkpoint data is valid');
        assert(parsedData.title === 'Test Checkpoint', 'Checkpoint title is correct');
        assert(Array.isArray(parsedData.tags), 'Checkpoint tags is array');
        assert(typeof parsedData.performance_metrics === 'object', 'Performance metrics exist');
      } catch (readError) {
        assert(false, 'Read test checkpoint file', readError.message);
      }
    }
    // Clean up test file
    try {
      await fs.unlink(testCheckpointPath);
      assert(true, 'Test checkpoint file cleaned up');
    } catch (cleanupError) {
      colorLog(`Warning: Could not clean up test file: ${cleanupError.message}`, 'yellow');
    }
  } catch (error) {
    assert(false, 'Checkpoint data creation test', error.message);
  }
}
// Test checkpoint search metadata
async function testSearchMetadata() {
  colorLog('\n🔍 Testing Checkpoint Search Metadata...', 'blue');
  try {
    const indexPath = path.join(TEST_STORAGE_PATH, 'checkpoint-index.json');
    // Check if index exists and create if not
    let indexExists = await fs.access(indexPath).then(() => true).catch(() => false);
    if (!indexExists) {
      // Create basic index
      const basicIndex = {
        last_updated: new Date().toISOString(),
        checkpoints: {},
        search_metadata: {
          tag_frequency: {},
          context_type_frequency: {},
          expertise_areas: []
        }
      };
      await fs.mkdir(path.dirname(indexPath), { recursive: true });
      await fs.writeFile(indexPath, JSON.stringify(basicIndex, null, 2));
      indexExists = true;
    }
    assert(indexExists, 'Search index exists or was created');
    if (indexExists) {
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexContent);
      // Test index structure
      assert(typeof index.search_metadata === 'object', 'Search metadata object exists');
      assert(typeof index.search_metadata.tag_frequency === 'object', 'Tag frequency object exists');
      assert(typeof index.search_metadata.context_type_frequency === 'object', 'Context type frequency object exists');
      assert(Array.isArray(index.search_metadata.expertise_areas), 'Expertise areas array exists');
      // Test that we can update the index
      index.search_metadata.tag_frequency['test'] = (index.search_metadata.tag_frequency['test'] || 0) + 1;
      index.last_updated = new Date().toISOString();
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
      assert(true, 'Search index can be updated');
      // Verify update
      const updatedContent = await fs.readFile(indexPath, 'utf-8');
      const updatedIndex = JSON.parse(updatedContent);
      assert(updatedIndex.search_metadata.tag_frequency['test'] >= 1, 'Index update persisted');
    }
  } catch (error) {
    assert(false, 'Search metadata test', error.message);
  }
}
// Test file system permissions
async function testFileSystemPermissions() {
  colorLog('\n🔐 Testing File System Permissions...', 'blue');
  try {
    const testDir = path.join(TEST_STORAGE_PATH, 'test-permissions');
    const testFile = path.join(testDir, 'test.json');
    // Test directory creation
    await fs.mkdir(testDir, { recursive: true });
    assert(true, 'Can create directories');
    // Test file writing
    await fs.writeFile(testFile, JSON.stringify({ test: true }));
    assert(true, 'Can write files');
    // Test file reading
    const content = await fs.readFile(testFile, 'utf-8');
    const data = JSON.parse(content);
    assert(data.test === true, 'Can read files');
    // Test file deletion
    await fs.unlink(testFile);
    assert(true, 'Can delete files');
    // Test directory deletion
    await fs.rmdir(testDir);
    assert(true, 'Can delete directories');
  } catch (error) {
    assert(false, 'File system permissions test', error.message);
  }
}
// Run all tests
async function runTests() {
  colorLog('🚀 Starting Basic Checkpoint Functionality Tests...', 'bright');
  colorLog('=' .repeat(60), 'cyan');
  try {
    await testStorageStructure();
    await testCheckpointDataCreation();
    await testSearchMetadata();
    await testFileSystemPermissions();
  } catch (error) {
    colorLog(`\n💥 Test suite error: ${error.message}`, 'red');
    testResults.failed++;
  }
  // Display results
  colorLog('\n' + '=' .repeat(60), 'cyan');
  colorLog('📊 Test Results Summary', 'bright');
  colorLog('=' .repeat(60), 'cyan');
  colorLog(`Total Tests: ${testResults.total}`, 'blue');
  colorLog(`Passed: ${testResults.passed}`, 'green');
  colorLog(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');
  const successRate = testResults.total > 0 ?
    Math.round((testResults.passed / testResults.total) * 100) : 0;
  colorLog(`Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'yellow');
  if (successRate >= 80) {
    colorLog('\n✅ Basic Checkpoint Functionality: WORKING', 'green');
  } else {
    colorLog('\n⚠️ Basic Checkpoint Functionality: NEEDS ATTENTION', 'yellow');
  }
  colorLog('\n🎯 Basic Checkpoint Test Complete!', 'green');
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}
// Handle uncaught errors
process.on('uncaughtException', (error) => {
  colorLog(`\n💥 Uncaught Exception: ${error.message}`, 'red');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  colorLog(`\n💥 Unhandled Rejection: ${reason}`, 'red');
  process.exit(1);
});
// Run the tests
if (require.main === module) {
  runTests();
}
module.exports = {
  runTests,
  testResults
};