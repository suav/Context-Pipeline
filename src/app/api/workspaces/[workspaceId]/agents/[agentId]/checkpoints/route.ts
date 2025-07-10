import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// POST /api/workspaces/[workspaceId]/agents/[agentId]/checkpoints - Save checkpoint
export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string; agentId: string } }
) {
  try {
    const { workspaceId, agentId } = params;
    const checkpoint = await request.json();
    
    // Create global checkpoint directory if it doesn't exist
    const checkpointDir = path.join(process.cwd(), 'storage', 'checkpoints');
    await fs.mkdir(checkpointDir, { recursive: true });
    
    // Generate checkpoint ID
    const checkpointId = `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create checkpoint data
    const checkpointData = {
      id: checkpointId,
      name: checkpoint.name,
      description: checkpoint.description || '',
      messages: checkpoint.messages,
      agentName: checkpoint.agentName,
      agentTitle: checkpoint.agentTitle,
      selectedModel: checkpoint.selectedModel,
      metadata: {
        ...checkpoint.metadata,
        created_at: new Date().toISOString(),
        source_agent_id: agentId,
        source_workspace_id: workspaceId
      }
    };
    
    // Save checkpoint to file
    const checkpointPath = path.join(checkpointDir, `${checkpointId}.json`);
    await fs.writeFile(checkpointPath, JSON.stringify(checkpointData, null, 2));
    
    // Update checkpoint index
    const indexPath = path.join(checkpointDir, 'index.json');
    let checkpointIndex = [];
    try {
      const indexData = await fs.readFile(indexPath, 'utf8');
      checkpointIndex = JSON.parse(indexData);
    } catch (error) {
      // Index doesn't exist yet, start with empty array
    }
    
    // Add new checkpoint to index
    checkpointIndex.push({
      id: checkpointId,
      name: checkpoint.name,
      description: checkpoint.description || '',
      created_at: checkpointData.metadata.created_at,
      message_count: checkpoint.messages.length,
      model: checkpoint.selectedModel,
      agent_name: checkpoint.agentName,
      agent_title: checkpoint.agentTitle,
      source_workspace_id: workspaceId,
      source_agent_id: agentId
    });
    
    // Sort by creation date (newest first)
    checkpointIndex.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Save updated index
    await fs.writeFile(indexPath, JSON.stringify(checkpointIndex, null, 2));
    
    return NextResponse.json({ 
      success: true, 
      checkpointId,
      message: 'Checkpoint saved successfully' 
    });
    
  } catch (error) {
    console.error('Failed to save checkpoint:', error);
    return NextResponse.json(
      { error: 'Failed to save checkpoint' },
      { status: 500 }
    );
  }
}

// GET /api/workspaces/[workspaceId]/agents/[agentId]/checkpoints - Get all checkpoints
export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string; agentId: string } }
) {
  try {
    // Get all checkpoints from global storage
    const checkpointDir = path.join(process.cwd(), 'storage', 'checkpoints');
    const indexPath = path.join(checkpointDir, 'index.json');
    
    try {
      const indexData = await fs.readFile(indexPath, 'utf8');
      const allCheckpoints = JSON.parse(indexData);
      
      // Return all checkpoints (they're now global and reusable across workspaces)
      return NextResponse.json({ 
        success: true, 
        checkpoints: allCheckpoints 
      });
    } catch (error) {
      // No checkpoints exist yet
      return NextResponse.json({ 
        success: true, 
        checkpoints: [] 
      });
    }
    
  } catch (error) {
    console.error('Failed to get checkpoints:', error);
    return NextResponse.json(
      { error: 'Failed to get checkpoints' },
      { status: 500 }
    );
  }
}

// DELETE /api/workspaces/[workspaceId]/agents/[agentId]/checkpoints?id=checkpointId - Delete checkpoint
export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceId: string; agentId: string } }
) {
  try {
    const { workspaceId, agentId } = params;
    const url = new URL(request.url);
    const checkpointId = url.searchParams.get('id');
    
    if (!checkpointId) {
      return NextResponse.json(
        { error: 'Checkpoint ID is required' },
        { status: 400 }
      );
    }
    
    const checkpointDir = path.join(process.cwd(), 'storage', 'checkpoints');
    const checkpointPath = path.join(checkpointDir, `${checkpointId}.json`);
    const indexPath = path.join(checkpointDir, 'index.json');
    
    // Delete checkpoint file
    try {
      await fs.unlink(checkpointPath);
    } catch (error) {
      console.warn('Checkpoint file not found:', error);
    }
    
    // Update global index
    try {
      const indexData = await fs.readFile(indexPath, 'utf8');
      let checkpointIndex = JSON.parse(indexData);
      
      // Remove checkpoint from index
      checkpointIndex = checkpointIndex.filter(cp => cp.id !== checkpointId);
      
      // Save updated index
      await fs.writeFile(indexPath, JSON.stringify(checkpointIndex, null, 2));
    } catch (error) {
      console.warn('Failed to update checkpoint index:', error);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Checkpoint deleted successfully' 
    });
    
  } catch (error) {
    console.error('Failed to delete checkpoint:', error);
    return NextResponse.json(
      { error: 'Failed to delete checkpoint' },
      { status: 500 }
    );
  }
}

// PATCH /api/workspaces/[workspaceId]/agents/[agentId]/checkpoints?id=checkpointId - Restore checkpoint
export async function PATCH(
  request: NextRequest,
  { params }: { params: { workspaceId: string; agentId: string } }
) {
  try {
    const { workspaceId, agentId } = params;
    const url = new URL(request.url);
    const checkpointId = url.searchParams.get('id');
    
    if (!checkpointId) {
      return NextResponse.json(
        { error: 'Checkpoint ID is required' },
        { status: 400 }
      );
    }
    
    const checkpointDir = path.join(process.cwd(), 'storage', 'checkpoints');
    const checkpointPath = path.join(checkpointDir, `${checkpointId}.json`);
    
    // Load checkpoint data
    const checkpointData = await fs.readFile(checkpointPath, 'utf8');
    const checkpoint = JSON.parse(checkpointData);
    
    return NextResponse.json({ 
      success: true, 
      checkpoint: checkpoint 
    });
    
  } catch (error) {
    console.error('Failed to restore checkpoint:', error);
    return NextResponse.json(
      { error: 'Failed to restore checkpoint' },
      { status: 500 }
    );
  }
}