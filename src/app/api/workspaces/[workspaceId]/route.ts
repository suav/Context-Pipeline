import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = params;
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    // Check storage directory
    const storageDir = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
    const workspacePath = path.join(storageDir, 'workspaces', workspaceId);
    
    try {
      await fs.access(workspacePath);
    } catch (error) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Load workspace metadata
    const workspaceFile = path.join(workspacePath, 'workspace.json');
    
    try {
      const workspaceData = await fs.readFile(workspaceFile, 'utf8');
      const workspace = JSON.parse(workspaceData);
      
      // Load context manifest if it exists
      let contextItems = [];
      try {
        const manifestFile = path.join(workspacePath, 'context', 'context-manifest.json');
        const manifestData = await fs.readFile(manifestFile, 'utf8');
        const manifest = JSON.parse(manifestData);
        contextItems = manifest.context_items || [];
      } catch (error) {
        console.log('No context manifest found for workspace:', workspaceId);
      }

      // Return formatted workspace data
      return NextResponse.json({
        id: workspace.id || workspaceId,
        name: workspace.name || workspace.title || 'Untitled Workspace',
        title: workspace.name || workspace.title || 'Untitled Workspace',
        description: workspace.description,
        context_items: contextItems,
        agent_configs: workspace.agent_configs || [],
        created_at: workspace.created_at,
        published_at: workspace.published_at,
        updated_at: workspace.updated_at || workspace.published_at,
        git_branch: workspace.git_branch || 'main',
        status: workspace.status || 'published'
      });
      
    } catch (error) {
      console.error('Error reading workspace file:', error);
      return NextResponse.json({ error: 'Failed to load workspace data' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in workspace GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}