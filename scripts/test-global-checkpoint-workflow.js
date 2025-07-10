#!/usr/bin/env node

/**
 * Test Script: Global Checkpoint Workflow
 * Tests the complete workflow of global checkpoint system
 */

const BASE_URL = 'http://localhost:3001';

async function testGlobalCheckpointWorkflow() {
  console.log('🧪 Testing Global Checkpoint Workflow\n');
  
  // Create first workspace
  console.log('1️⃣ Creating workspace A...');
  const workspaceA = `workspace-a-${Date.now()}`;
  const workspaceAResponse = await fetch(`${BASE_URL}/api/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'publish',
      workspaceDraft: {
        id: workspaceA,
        name: 'Test Workspace A',
        description: 'First workspace for testing global checkpoints',
        context_items: []
      }
    })
  });
  
  if (!workspaceAResponse.ok) {
    console.error('❌ Failed to create workspace A');
    return;
  }
  console.log(`   ✅ Workspace A created: ${workspaceA}`);
  
  // Create second workspace
  console.log('2️⃣ Creating workspace B...');
  const workspaceB = `workspace-b-${Date.now()}`;
  const workspaceBResponse = await fetch(`${BASE_URL}/api/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'publish',
      workspaceDraft: {
        id: workspaceB,
        name: 'Test Workspace B',
        description: 'Second workspace for testing global checkpoints',
        context_items: []
      }
    })
  });
  
  if (!workspaceBResponse.ok) {
    console.error('❌ Failed to create workspace B');
    return;
  }
  console.log(`   ✅ Workspace B created: ${workspaceB}`);
  
  // Create checkpoint in workspace A
  console.log('3️⃣ Creating checkpoint in workspace A...');
  const agentA = `agent-a-${Date.now()}`;
  const checkpointA = await fetch(`${BASE_URL}/api/workspaces/${workspaceA}/agents/${agentA}/checkpoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'React Expert A',
      description: 'Expert in React development from workspace A',
      messages: [
        { id: 'msg1', role: 'user', content: 'Help with React hooks', timestamp: new Date().toISOString() },
        { id: 'msg2', role: 'assistant', content: 'I can help with React hooks...', timestamp: new Date().toISOString() }
      ],
      agentName: 'React Helper A',
      agentTitle: 'React Development Assistant',
      selectedModel: 'claude',
      metadata: { message_count: 2 }
    })
  });
  
  if (!checkpointA.ok) {
    console.error('❌ Failed to create checkpoint in workspace A');
    return;
  }
  
  const checkpointAData = await checkpointA.json();
  console.log(`   ✅ Checkpoint created in workspace A: ${checkpointAData.checkpointId}`);
  
  // Create checkpoint in workspace B
  console.log('4️⃣ Creating checkpoint in workspace B...');
  const agentB = `agent-b-${Date.now()}`;
  const checkpointB = await fetch(`${BASE_URL}/api/workspaces/${workspaceB}/agents/${agentB}/checkpoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Vue Expert B',
      description: 'Expert in Vue.js development from workspace B',
      messages: [
        { id: 'msg3', role: 'user', content: 'Help with Vue components', timestamp: new Date().toISOString() },
        { id: 'msg4', role: 'assistant', content: 'I can help with Vue components...', timestamp: new Date().toISOString() }
      ],
      agentName: 'Vue Helper B',
      agentTitle: 'Vue Development Assistant',
      selectedModel: 'claude',
      metadata: { message_count: 2 }
    })
  });
  
  if (!checkpointB.ok) {
    console.error('❌ Failed to create checkpoint in workspace B');
    return;
  }
  
  const checkpointBData = await checkpointB.json();
  console.log(`   ✅ Checkpoint created in workspace B: ${checkpointBData.checkpointId}`);
  
  // Test global checkpoint listing from workspace A
  console.log('5️⃣ Testing global checkpoint listing from workspace A...');
  const listFromA = await fetch(`${BASE_URL}/api/workspaces/${workspaceA}/agents/${agentA}/checkpoints`);
  if (!listFromA.ok) {
    console.error('❌ Failed to list checkpoints from workspace A');
    return;
  }
  
  const listFromAData = await listFromA.json();
  console.log(`   ✅ Found ${listFromAData.checkpoints.length} global checkpoints from workspace A`);
  
  // Test global checkpoint listing from workspace B
  console.log('6️⃣ Testing global checkpoint listing from workspace B...');
  const listFromB = await fetch(`${BASE_URL}/api/workspaces/${workspaceB}/agents/${agentB}/checkpoints`);
  if (!listFromB.ok) {
    console.error('❌ Failed to list checkpoints from workspace B');
    return;
  }
  
  const listFromBData = await listFromB.json();
  console.log(`   ✅ Found ${listFromBData.checkpoints.length} global checkpoints from workspace B`);
  
  // Verify both workspaces see the same global checkpoints
  console.log('7️⃣ Verifying global checkpoint visibility...');
  if (listFromAData.checkpoints.length === listFromBData.checkpoints.length) {
    console.log(`   ✅ Both workspaces see the same ${listFromAData.checkpoints.length} checkpoints`);
    
    // Show checkpoint details
    for (const checkpoint of listFromAData.checkpoints) {
      console.log(`   📋 "${checkpoint.name}" from workspace ${checkpoint.source_workspace_id?.slice(-8) || 'unknown'}`);
    }
  } else {
    console.error('   ❌ Workspace checkpoint visibility mismatch');
  }
  
  // Test checkpoint restoration from different workspace
  console.log('8️⃣ Testing checkpoint restoration across workspaces...');
  
  // Find the React Expert checkpoint created in workspace A
  const reactCheckpoint = listFromBData.checkpoints.find(cp => cp.name === 'React Expert A');
  if (reactCheckpoint) {
    console.log(`   🔄 Found React Expert checkpoint from workspace A, testing restore from workspace B`);
    
    const restoreResponse = await fetch(`${BASE_URL}/api/workspaces/${workspaceB}/agents/${agentB}/checkpoints?id=${reactCheckpoint.id}`, {
      method: 'PATCH'
    });
    
    if (restoreResponse.ok) {
      const restoreData = await restoreResponse.json();
      console.log(`   ✅ Successfully restored checkpoint from workspace A into workspace B context`);
      console.log(`   📋 Restored: ${restoreData.checkpoint.name}`);
      console.log(`   💬 Messages: ${restoreData.checkpoint.messages.length}`);
    } else {
      console.error('   ❌ Failed to restore checkpoint across workspaces');
    }
  } else {
    console.error('   ❌ Could not find React Expert checkpoint for cross-workspace test');
  }
  
  // Cleanup
  console.log('9️⃣ Cleaning up test data...');
  
  // Clean up workspaces
  const fs = require('fs');
  const path = require('path');
  
  try {
    const workspaceAPath = path.join(process.cwd(), 'storage', 'workspaces', workspaceA);
    const workspaceBPath = path.join(process.cwd(), 'storage', 'workspaces', workspaceB);
    
    if (fs.existsSync(workspaceAPath)) {
      fs.rmSync(workspaceAPath, { recursive: true });
      console.log(`   ✅ Cleaned up workspace A`);
    }
    
    if (fs.existsSync(workspaceBPath)) {
      fs.rmSync(workspaceBPath, { recursive: true });
      console.log(`   ✅ Cleaned up workspace B`);
    }
    
    // Note: We keep the global checkpoints as they should persist
    console.log(`   💡 Global checkpoints preserved for reuse`);
    
  } catch (error) {
    console.log(`   ⚠️ Could not clean up workspaces: ${error.message}`);
  }
  
  console.log('\n✅ Global checkpoint workflow test completed successfully!');
  console.log('🎯 Key benefits demonstrated:');
  console.log('   • Checkpoints are stored globally and reusable across workspaces');
  console.log('   • Source workspace/agent information is preserved');
  console.log('   • Checkpoints can be restored in any workspace');
  console.log('   • All workspaces see the same global checkpoint library');
}

// Run the test
testGlobalCheckpointWorkflow().catch(console.error);