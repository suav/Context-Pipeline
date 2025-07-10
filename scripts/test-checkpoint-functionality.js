#!/usr/bin/env node

/**
 * Test Script: Checkpoint Functionality
 * Tests the checkpoint saving and restoration APIs
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';

async function testCheckpointFunctionality() {
  console.log('🧪 Testing Checkpoint Functionality\n');
  
  // Create a test workspace
  console.log('1️⃣ Creating test workspace...');
  const workspaceId = `test-checkpoint-workspace-${Date.now()}`;
  const workspaceResponse = await fetch(`${BASE_URL}/api/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'publish',
      workspaceDraft: {
        id: workspaceId,
        name: 'Checkpoint Test Workspace',
        description: 'Testing checkpoint functionality',
        context_items: []
      }
    })
  });
  
  if (!workspaceResponse.ok) {
    console.error('❌ Failed to create workspace');
    console.error('Status:', workspaceResponse.status);
    console.error('Response:', await workspaceResponse.text());
    return;
  }
  
  const workspaceData = await workspaceResponse.json();
  console.log(`   ✅ Workspace created: ${workspaceId}`);
  
  // Create a test agent
  console.log('2️⃣ Creating test agent...');
  const agentId = `test-agent-${Date.now()}`;
  
  // Create some test messages
  const testMessages = [
    {
      id: 'msg_1',
      timestamp: new Date().toISOString(),
      role: 'user',
      content: 'Hello, can you help me with React?'
    },
    {
      id: 'msg_2',
      timestamp: new Date().toISOString(),
      role: 'assistant',
      content: 'Of course! I can help you with React. What specifically would you like to know about React development?',
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        session_id: 'test-session-123',
        usage: {
          input_tokens: 15,
          output_tokens: 25
        }
      }
    },
    {
      id: 'msg_3',
      timestamp: new Date().toISOString(),
      role: 'user',
      content: 'How do I create a custom hook?'
    },
    {
      id: 'msg_4',
      timestamp: new Date().toISOString(),
      role: 'assistant',
      content: 'Great question! A custom hook in React is a JavaScript function that starts with "use" and can call other hooks. Here\'s how to create one:\n\n```javascript\nfunction useCounter(initialValue = 0) {\n  const [count, setCount] = useState(initialValue);\n  \n  const increment = () => setCount(c => c + 1);\n  const decrement = () => setCount(c => c - 1);\n  const reset = () => setCount(initialValue);\n  \n  return { count, increment, decrement, reset };\n}\n```\n\nThis hook encapsulates counter logic and can be reused across components.',
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        session_id: 'test-session-123',
        usage: {
          input_tokens: 28,
          output_tokens: 85
        }
      }
    }
  ];
  
  // Test checkpoint saving
  console.log('3️⃣ Testing checkpoint save...');
  const checkpointResponse = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/agents/${agentId}/checkpoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'React Helper Expert',
      description: 'Agent that helps with React development questions',
      messages: testMessages,
      agentName: 'React Helper',
      agentTitle: 'React Development Assistant',
      selectedModel: 'claude',
      metadata: {
        created_at: new Date().toISOString(),
        message_count: testMessages.length,
        last_session_id: 'test-session-123'
      }
    })
  });
  
  if (!checkpointResponse.ok) {
    console.error('❌ Failed to save checkpoint');
    console.error(await checkpointResponse.text());
    return;
  }
  
  const checkpointData = await checkpointResponse.json();
  const checkpointId = checkpointData.checkpointId;
  console.log(`   ✅ Checkpoint saved: ${checkpointId}`);
  
  // Test checkpoint listing
  console.log('4️⃣ Testing checkpoint listing...');
  const listResponse = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/agents/${agentId}/checkpoints`);
  
  if (!listResponse.ok) {
    console.error('❌ Failed to list checkpoints');
    return;
  }
  
  const listData = await listResponse.json();
  console.log(`   ✅ Found ${listData.checkpoints.length} checkpoints`);
  
  if (listData.checkpoints.length > 0) {
    const checkpoint = listData.checkpoints[0];
    console.log(`   📋 Checkpoint: ${checkpoint.name}`);
    console.log(`   📅 Created: ${checkpoint.created_at}`);
    console.log(`   💬 Messages: ${checkpoint.message_count}`);
    console.log(`   🤖 Model: ${checkpoint.model}`);
    console.log(`   🏗️ Source Workspace: ${checkpoint.source_workspace_id}`);
  }
  
  // Test checkpoint restoration
  console.log('5️⃣ Testing checkpoint restoration...');
  const restoreResponse = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/agents/${agentId}/checkpoints?id=${checkpointId}`, {
    method: 'PATCH'
  });
  
  if (!restoreResponse.ok) {
    console.error('❌ Failed to restore checkpoint');
    return;
  }
  
  const restoreData = await restoreResponse.json();
  console.log(`   ✅ Checkpoint restored successfully`);
  console.log(`   📋 Name: ${restoreData.checkpoint.name}`);
  console.log(`   💬 Messages: ${restoreData.checkpoint.messages.length}`);
  console.log(`   🤖 Agent: ${restoreData.checkpoint.agentName}`);
  
  // Test checkpoint deletion
  console.log('6️⃣ Testing checkpoint deletion...');
  const deleteResponse = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/agents/${agentId}/checkpoints?id=${checkpointId}`, {
    method: 'DELETE'
  });
  
  if (!deleteResponse.ok) {
    console.error('❌ Failed to delete checkpoint');
    return;
  }
  
  console.log(`   ✅ Checkpoint deleted successfully`);
  
  // Verify deletion
  console.log('7️⃣ Verifying checkpoint deletion...');
  const verifyResponse = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/agents/${agentId}/checkpoints`);
  
  if (verifyResponse.ok) {
    const verifyData = await verifyResponse.json();
    console.log(`   ✅ Checkpoints after deletion: ${verifyData.checkpoints.length}`);
  }
  
  // Clean up test workspace
  console.log('8️⃣ Cleaning up test workspace...');
  try {
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    if (fs.existsSync(workspaceDir)) {
      fs.rmSync(workspaceDir, { recursive: true });
      console.log(`   ✅ Test workspace cleaned up`);
    }
  } catch (error) {
    console.log(`   ⚠️ Could not clean up workspace: ${error.message}`);
  }
  
  console.log('\n✅ All checkpoint functionality tests passed!');
}

// Run the test
testCheckpointFunctionality().catch(console.error);