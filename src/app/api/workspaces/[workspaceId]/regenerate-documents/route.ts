import { NextRequest, NextResponse } from 'next/server';
import WorkspaceDocumentGenerator from '@/features/workspaces/services/WorkspaceDocumentGenerator';
import path from 'path';
import { promises as fs } from 'fs';

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = params;
    console.log(`🔄 Regenerating documents for workspace ${workspaceId}`);

    // Load workspace metadata
    const workspacePath = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    const workspaceJsonPath = path.join(workspacePath, 'workspace.json');
    
    try {
      await fs.access(workspaceJsonPath);
    } catch (error) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const workspaceData = JSON.parse(await fs.readFile(workspaceJsonPath, 'utf8'));
    
    // Prepare context for generation
    const context = {
      workspaceId,
      workspacePath,
      description: workspaceData.description || 'Development workspace',
      projectType: workspaceData.projectType || 'general',
      gitInfo: workspaceData.git_status
    };

    // Generate all three documents
    await WorkspaceDocumentGenerator.generatePermissions(workspaceId, context);
    await WorkspaceDocumentGenerator.generateClaudeMd(workspaceId, context);
    await WorkspaceDocumentGenerator.generateCommands(workspaceId, context);

    console.log(`✅ Documents regenerated successfully for workspace ${workspaceId}`);

    return NextResponse.json({
      success: true,
      message: 'Workspace documents regenerated successfully'
    });
  } catch (error) {
    console.error('Failed to regenerate workspace documents:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate documents' },
      { status: 500 }
    );
  }
}