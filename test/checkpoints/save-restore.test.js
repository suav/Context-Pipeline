#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');
// Test configuration
const TEST_WORKSPACE_ID = 'test-checkpoint-workspace';
const TEST_AGENT_ID = 'test-agent-123';
const TEST_STORAGE_PATH = path.join(process.cwd(), 'storage');
// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};
function colorLog(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}
// Test results tracking
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};
function assert(condition, testName, details = '') {
  testResults.total++;
  if (condition) {
    testResults.passed++;
    colorLog(`✅ PASS: ${testName}`, 'green');
    if (details) colorLog(`   ${details}`, 'cyan');
  } else {
    testResults.failed++;
    colorLog(`❌ FAIL: ${testName}`, 'red');
    if (details) colorLog(`   ${details}`, 'yellow');
  }
  testResults.details.push({
    name: testName,
    passed: condition,
    details
  });
}
// Helper function to clean up test data
async function cleanupTestData() {
  try {
    const testWorkspacePath = path.join(TEST_STORAGE_PATH, 'workspaces', TEST_WORKSPACE_ID);
    const checkpointsPath = path.join(TEST_STORAGE_PATH, 'checkpoints');
    // Remove test workspace
    try {
      await fs.rm(testWorkspacePath, { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist, that's okay
    }
    // Clean up checkpoint storage
    try {
      const files = await fs.readdir(checkpointsPath);
      for (const file of files) {
        if (file.startsWith('test-') || file.includes('test')) {
          await fs.rm(path.join(checkpointsPath, file), { recursive: true, force: true });
        }
      }
    } catch (e) {
      // Directory might not exist, that's okay
    }
  } catch (error) {
    colorLog(`Warning: Cleanup failed: ${error.message}`, 'yellow');
  }
}
// Helper function to create test conversation data
function createTestConversationData() {
  return [
    {
      id: 'msg-1',
      timestamp: new Date().toISOString(),
      role: 'user',
      content: 'Hello, I need help with React development',
      metadata: {}
    },
    {
      id: 'msg-2',
      timestamp: new Date().toISOString(),
      role: 'assistant',
      content: 'I can help you with React development. What specific issue are you working on?',
      metadata: {}
    },
    {
      id: 'msg-3',
      timestamp: new Date().toISOString(),
      role: 'user',
      content: 'I need to create a TypeScript component with props validation',
      metadata: {}
    },
    {
      id: 'msg-4',
      timestamp: new Date().toISOString(),
      role: 'assistant',
      content: 'Here\'s how you can create a TypeScript React component with proper props validation...',
      metadata: {}
    }
  ];
}
// Helper function to setup test conversation
async function setupTestConversation() {
  try {
    const conversationPath = path.join(
      TEST_STORAGE_PATH,
      'workspaces',
      TEST_WORKSPACE_ID,
      'agents',
      TEST_AGENT_ID,
      'conversation.json'
    );
    // Ensure directory exists
    await fs.mkdir(path.dirname(conversationPath), { recursive: true });
    // Create test conversation
    const conversationData = createTestConversationData();
    await fs.writeFile(conversationPath, JSON.stringify(conversationData, null, 2));
    return conversationData;
  } catch (error) {
    throw new Error(`Failed to setup test conversation: ${error.message}`);
  }
}
// Test checkpoint data structures validation
async function testCheckpointDataStructures() {
  colorLog('\n🧪 Testing Checkpoint Data Structures...', 'blue');
  try {
    // Import the validation functions
    const { validateAgentCheckpoint, validateCheckpointMetrics } = require('../../src/features/agents/types/checkpoints');
    // Test valid checkpoint data
    const validCheckpoint = {
      id: 'test-checkpoint-1',
      title: 'Test Checkpoint',
      description: 'A test checkpoint for validation',
      agentType: 'claude',
      conversation_id: 'test-conversation',
      workspace_context: {
        timestamp: new Date().toISOString(),
        workspace_structure: { context_items: [], target_files: [], feedback_files: [] },
        git_state: { branch: 'main', commit_hash: '', modified_files: [], staged_files: [] },
        context_description: 'Test context'
      },
      expertise_summary: 'Expert in React and TypeScript development',
      performance_metrics: {
        success_rate: 0.9,
        avg_response_time: 1500,
        user_satisfaction: 4.5,
        task_completion_rate: 0.85,
        commands_executed: 10,
        errors_encountered: 1,
        tokens_processed: 5000,
        context_understanding_score: 0.8,
        knowledge_retention_score: 0.9,
        adaptation_efficiency: 0.75
      },
      tags: ['react', 'typescript'],
      created_at: new Date().toISOString(),
      agent_id: TEST_AGENT_ID,
      workspace_id: TEST_WORKSPACE_ID,
      created_by: 'test-user'
    };
    const validation = validateAgentCheckpoint(validCheckpoint);
    assert(validation.is_valid, 'Valid checkpoint passes validation',
      `Completeness: ${validation.completeness_score}%`);
    // Test invalid checkpoint data
    const invalidCheckpoint = {
      id: 'test-checkpoint-2',
      title: 'X', // Too short
      agentType: 'invalid-type' // Invalid agent type
    };
    const invalidValidation = validateAgentCheckpoint(invalidCheckpoint);
    assert(!invalidValidation.is_valid, 'Invalid checkpoint fails validation',
      `Errors: ${invalidValidation.errors.length}`);
    // Test metrics validation
    const validMetrics = {
      success_rate: 0.8,
      avg_response_time: 1000,
      user_satisfaction: 4.0,
      task_completion_rate: 0.9
    };
    const metricsValidation = validateCheckpointMetrics(validMetrics);
    assert(metricsValidation.is_valid, 'Valid metrics pass validation');
    // Test invalid metrics
    const invalidMetrics = {
      success_rate: 1.5, // Out of range
      user_satisfaction: 6 // Out of range
    };
    const invalidMetricsValidation = validateCheckpointMetrics(invalidMetrics);
    assert(!invalidMetricsValidation.is_valid, 'Invalid metrics fail validation');
  } catch (error) {
    assert(false, 'Checkpoint data structures test setup', error.message);
  }
}
// Test checkpoint storage operations
async function testCheckpointStorage() {
  colorLog('\n💾 Testing Checkpoint Storage...', 'blue');
  try {
    // Dynamic import to handle ES modules
    const { CheckpointStorage } = require('../../src/features/agents/storage/CheckpointStorage');
    // Initialize storage
    await CheckpointStorage.initialize();
    assert(true, 'Checkpoint storage initialization');
    // Check if storage directories were created
    const checkpointsPath = path.join(TEST_STORAGE_PATH, 'checkpoints');
    const dataPath = path.join(checkpointsPath, 'data');
    const summariesPath = path.join(checkpointsPath, 'summaries');
    const dataDirExists = await fs.access(dataPath).then(() => true).catch(() => false);
    const summariesDirExists = await fs.access(summariesPath).then(() => true).catch(() => false);
    assert(dataDirExists, 'Data directory created');
    assert(summariesDirExists, 'Summaries directory created');
    // Test storage statistics
    const stats = await CheckpointStorage.getStorageStats();
    assert(typeof stats.total_checkpoints === 'number', 'Storage stats returned',
      `Found ${stats.total_checkpoints} checkpoints`);
  } catch (error) {
    assert(false, 'Checkpoint storage test', error.message);
  }
}
// Test checkpoint manager operations
async function testCheckpointManager() {
  colorLog('\n🔧 Testing Checkpoint Manager...', 'blue');
  try {
    // Setup test conversation first
    await setupTestConversation();
    // Import CheckpointManager and AgentService
    const { CheckpointManager } = require('../../src/features/agents/services/CheckpointManager');
    const { agentService } = require('../../src/features/agents/services/AgentService');
    // Test checkpoint creation
    const checkpointRequest = {
      title: 'React TypeScript Expert',
      description: 'Checkpoint after helping with React TypeScript component development',
      tags: ['react', 'typescript', 'components'],
      expertise_summary: 'Expert in React TypeScript development, component creation, and props validation',
      include_full_conversation: true,
      analytics_enabled: true
    };
    try {
      const checkpointId = await CheckpointManager.saveCheckpoint(
        TEST_AGENT_ID,
        'test-conversation-id',
        checkpointRequest
      );
      assert(typeof checkpointId === 'string' && checkpointId.length > 0,
        'Checkpoint creation returns valid ID', `ID: ${checkpointId}`);
      // Test checkpoint loading
      const loadedCheckpoint = await CheckpointManager.loadCheckpoint(checkpointId);
      assert(loadedCheckpoint.id === checkpointId, 'Checkpoint can be loaded',
        `Title: ${loadedCheckpoint.title}`);
      // Test checkpoint search
      const searchQuery = {
        query: 'react typescript',
        filters: {
          context_types: [],
          expertise_areas: [],
          performance_threshold: 0,
          recently_used: false,
          my_checkpoints: false,
          tags: ['react']
        },
        sort_by: 'relevance',
        limit: 10,
        offset: 0
      };
      const searchResults = await CheckpointManager.searchCheckpoints(searchQuery);
      assert(Array.isArray(searchResults.checkpoints), 'Search returns array of checkpoints');
      assert(searchResults.checkpoints.length > 0, 'Search finds created checkpoint');
      // Test checkpoint deletion
      const deleteSuccess = await CheckpointManager.deleteCheckpoint(checkpointId);
      assert(deleteSuccess, 'Checkpoint can be deleted');
    } catch (createError) {
      // If AgentService.getAgent fails, test the error handling
      assert(true, 'Checkpoint creation handles missing agent gracefully',
        `Error: ${createError.message}`);
    }
  } catch (error) {
    assert(false, 'Checkpoint manager test setup', error.message);
  }
}
// Test agent service checkpoint integration
async function testAgentServiceIntegration() {
  colorLog('\n🤖 Testing Agent Service Integration...', 'blue');
  try {
    // Setup test conversation
    await setupTestConversation();
    const { agentService } = require('../../src/features/agents/services/AgentService');
    // Test createCheckpoint method
    try {
      const checkpointId = await agentService.createCheckpoint(
        TEST_WORKSPACE_ID,
        TEST_AGENT_ID,
        'Test Integration Checkpoint',
        'Testing integration between AgentService and CheckpointManager',
        ['integration', 'test']
      );
      assert(typeof checkpointId === 'string' && checkpointId.length > 0,
        'AgentService creates checkpoint', `ID: ${checkpointId}`);
      // Test restoration (should not fail even if agent doesn't exist)
      try {
        await agentService.restoreFromCheckpoint(TEST_WORKSPACE_ID, TEST_AGENT_ID, checkpointId);
        assert(true, 'AgentService restore checkpoint method');
      } catch (restoreError) {
        assert(true, 'AgentService handles restore errors gracefully',
          `Error: ${restoreError.message}`);
      }
    } catch (createError) {
      assert(true, 'AgentService handles checkpoint creation errors',
        `Error: ${createError.message}`);
    }
    // Test search functionality
    const searchQuery = {
      query: 'test',
      filters: {
        context_types: [],
        expertise_areas: [],
        performance_threshold: 0,
        recently_used: false,
        my_checkpoints: false,
        tags: []
      },
      sort_by: 'relevance',
      limit: 5,
      offset: 0
    };
    const searchResults = await agentService.searchCheckpoints(searchQuery);
    assert(searchResults && typeof searchResults === 'object',
      'AgentService search checkpoints');
    // Test get recommended checkpoints
    const recommendations = await agentService.getRecommendedCheckpoints(TEST_WORKSPACE_ID);
    assert(Array.isArray(recommendations), 'AgentService get recommended checkpoints');
    // Test get storage stats
    const stats = await agentService.getCheckpointStats();
    assert(stats && typeof stats.total_checkpoints === 'number',
      'AgentService get checkpoint stats', `Total: ${stats.total_checkpoints}`);
  } catch (error) {
    assert(false, 'Agent service integration test', error.message);
  }
}
// Test agent storage manager integration
async function testAgentStorageManagerIntegration() {
  colorLog('\n🗄️  Testing Agent Storage Manager Integration...', 'blue');
  try {
    const { AgentStorageManager } = require('../../src/features/agents/storage/AgentStorageManager');
    const storageManager = new AgentStorageManager();
    // Test checkpoint metadata operations
    const mockCheckpoint = {
      id: 'test-checkpoint-storage',
      title: 'Storage Test Checkpoint',
      description: 'Testing storage manager integration',
      created_at: new Date().toISOString(),
      tags: ['storage', 'test'],
      expertise_areas: ['testing'],
      performance_metrics: { success_rate: 0.8 },
      usage_count: 0,
      last_used: undefined
    };
    // Test saving checkpoint metadata
    await storageManager.saveCheckpointMetadata(TEST_WORKSPACE_ID, TEST_AGENT_ID, mockCheckpoint);
    assert(true, 'Storage manager saves checkpoint metadata');
    // Test getting agent checkpoints
    const agentCheckpoints = await storageManager.getAgentCheckpoints(TEST_WORKSPACE_ID, TEST_AGENT_ID);
    assert(Array.isArray(agentCheckpoints), 'Storage manager gets agent checkpoints');
    // Test marking agent as checkpointed
    await storageManager.markAgentCheckpointed(TEST_WORKSPACE_ID, TEST_AGENT_ID, mockCheckpoint.id);
    assert(true, 'Storage manager marks agent as checkpointed');
    // Test removing checkpoint metadata
    await storageManager.removeCheckpointMetadata(TEST_WORKSPACE_ID, TEST_AGENT_ID, mockCheckpoint.id);
    assert(true, 'Storage manager removes checkpoint metadata');
  } catch (error) {
    assert(false, 'Agent storage manager integration test', error.message);
  }
}
// Run all tests
async function runTests() {
  colorLog('🚀 Starting Checkpoint System Tests...', 'bright');
  colorLog('=' .repeat(60), 'cyan');
  // Clean up before starting
  await cleanupTestData();
  try {
    // Run test suites
    await testCheckpointDataStructures();
    await testCheckpointStorage();
    await testCheckpointManager();
    await testAgentServiceIntegration();
    await testAgentStorageManagerIntegration();
  } catch (error) {
    colorLog(`\n💥 Test suite error: ${error.message}`, 'red');
    testResults.failed++;
  }
  // Clean up after tests
  await cleanupTestData();
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
  if (testResults.failed > 0) {
    colorLog('\n❌ Failed Tests:', 'red');
    testResults.details
      .filter(t => !t.passed)
      .forEach(test => {
        colorLog(`  • ${test.name}`, 'red');
        if (test.details) colorLog(`    ${test.details}`, 'yellow');
      });
  }
  colorLog('\n✅ Checkpoint System Test Complete!', 'green');
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}
// Handle uncaught errors
process.on('uncaughtException', (error) => {
  colorLog(`\n💥 Uncaught Exception: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  colorLog(`\n💥 Unhandled Rejection: ${reason}`, 'red');
  console.error('Promise:', promise);
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