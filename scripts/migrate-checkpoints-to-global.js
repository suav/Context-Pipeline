#!/usr/bin/env node

/**
 * Migration Script: Move workspace checkpoints to global storage
 * This script finds all existing checkpoints in workspace-specific directories
 * and moves them to the global checkpoint storage location.
 */

const fs = require('fs/promises');
const path = require('path');

const WORKSPACE_BASE_DIR = path.join(process.cwd(), 'storage', 'workspaces');
const GLOBAL_CHECKPOINT_DIR = path.join(process.cwd(), 'storage', 'checkpoints');

async function migrateCheckpointsToGlobal() {
  console.log('🔄 Migrating workspace checkpoints to global storage...\n');
  
  let totalMigrated = 0;
  let globalIndex = [];
  
  // Ensure global checkpoint directory exists
  await fs.mkdir(GLOBAL_CHECKPOINT_DIR, { recursive: true });
  
  // Load existing global index if it exists
  const globalIndexPath = path.join(GLOBAL_CHECKPOINT_DIR, 'index.json');
  try {
    const indexData = await fs.readFile(globalIndexPath, 'utf8');
    globalIndex = JSON.parse(indexData);
    console.log(`📋 Found ${globalIndex.length} existing global checkpoints`);
  } catch (error) {
    console.log('📋 No existing global index found, starting fresh');
  }
  
  // Find all workspace directories
  try {
    const workspaces = await fs.readdir(WORKSPACE_BASE_DIR);
    
    for (const workspaceId of workspaces) {
      const workspacePath = path.join(WORKSPACE_BASE_DIR, workspaceId);
      const stat = await fs.stat(workspacePath);
      
      if (!stat.isDirectory()) continue;
      
      const agentsPath = path.join(workspacePath, 'agents');
      
      // Check if agents directory exists
      try {
        await fs.access(agentsPath);
      } catch {
        continue; // No agents directory
      }
      
      // Find all agents
      const agents = await fs.readdir(agentsPath);
      
      for (const agentId of agents) {
        const agentPath = path.join(agentsPath, agentId);
        const agentStat = await fs.stat(agentPath);
        
        if (!agentStat.isDirectory()) continue;
        
        const checkpointsPath = path.join(agentPath, 'checkpoints');
        
        // Check if checkpoints directory exists
        try {
          await fs.access(checkpointsPath);
        } catch {
          continue; // No checkpoints directory
        }
        
        console.log(`🔍 Checking workspace: ${workspaceId}, agent: ${agentId}`);
        
        // Load checkpoint index
        const indexPath = path.join(checkpointsPath, 'index.json');
        let workspaceCheckpoints = [];
        
        try {
          const indexData = await fs.readFile(indexPath, 'utf8');
          workspaceCheckpoints = JSON.parse(indexData);
          console.log(`   📄 Found ${workspaceCheckpoints.length} checkpoints`);
        } catch (error) {
          console.log(`   📄 No checkpoint index found`);
          continue;
        }
        
        // Migrate each checkpoint
        for (const checkpoint of workspaceCheckpoints) {
          const checkpointFilePath = path.join(checkpointsPath, `${checkpoint.id}.json`);
          
          try {
            // Read checkpoint data
            const checkpointData = await fs.readFile(checkpointFilePath, 'utf8');
            const checkpointObj = JSON.parse(checkpointData);
            
            // Update checkpoint metadata for global storage
            const updatedCheckpoint = {
              ...checkpointObj,
              metadata: {
                ...checkpointObj.metadata,
                source_workspace_id: workspaceId,
                source_agent_id: agentId,
                migrated_at: new Date().toISOString()
              }
            };
            
            // Save to global location
            const globalCheckpointPath = path.join(GLOBAL_CHECKPOINT_DIR, `${checkpoint.id}.json`);
            await fs.writeFile(globalCheckpointPath, JSON.stringify(updatedCheckpoint, null, 2));
            
            // Add to global index with source information
            const globalIndexEntry = {
              ...checkpoint,
              source_workspace_id: workspaceId,
              source_agent_id: agentId,
              migrated_at: new Date().toISOString()
            };
            
            // Check if already in global index
            if (!globalIndex.find(gi => gi.id === checkpoint.id)) {
              globalIndex.push(globalIndexEntry);
              totalMigrated++;
              console.log(`   ✅ Migrated: ${checkpoint.name}`);
            } else {
              console.log(`   ⏭️  Already exists: ${checkpoint.name}`);
            }
            
          } catch (error) {
            console.error(`   ❌ Failed to migrate ${checkpoint.id}:`, error.message);
          }
        }
      }
    }
    
    // Sort global index by creation date (newest first)
    globalIndex.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Save updated global index
    await fs.writeFile(globalIndexPath, JSON.stringify(globalIndex, null, 2));
    
    console.log(`\n✅ Migration complete!`);
    console.log(`📊 Total checkpoints migrated: ${totalMigrated}`);
    console.log(`📋 Global index now contains: ${globalIndex.length} checkpoints`);
    
    if (totalMigrated > 0) {
      console.log(`\n💡 Note: Original workspace checkpoints are still in place.`);
      console.log(`   You can safely delete them after verifying the migration worked.`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run the migration
migrateCheckpointsToGlobal().catch(console.error);