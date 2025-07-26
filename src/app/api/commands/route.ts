import { NextRequest, NextResponse } from 'next/server';
import CommandManager from '@/features/agents/services/CommandManager';

// GET /api/commands - Get all commands
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') as 'startup' | 'reply' | null;
    const category = searchParams.get('category');
    const role = searchParams.get('role');
    
    const commandManager = CommandManager.getInstance();
    await commandManager.initializeStorage();
    
    let commands;
    if (role) {
      commands = await commandManager.getCommandsByRole(role);
    } else if (mode) {
      commands = await commandManager.getCommandsByMode(mode);
    } else if (category) {
      commands = await commandManager.getCommandsByCategory(category);
    } else {
      commands = await commandManager.getAllCommands();
    }
    
    return NextResponse.json({ commands });
  } catch (error) {
    console.error('Failed to get commands:', error);
    return NextResponse.json(
      { error: 'Failed to load commands' },
      { status: 500 }
    );
  }
}

// POST /api/commands - Create or update a command
export async function POST(request: NextRequest) {
  try {
    const command = await request.json();
    
    const commandManager = CommandManager.getInstance();
    await commandManager.initializeStorage();
    await commandManager.saveCommand(command);
    
    // Regenerate documents for all workspaces
    try {
      await regenerateAllWorkspaceDocuments();
    } catch (regenerateError) {
      console.warn('Failed to regenerate some workspace documents:', regenerateError);
      // Don't fail the command save operation
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save command:', error);
    return NextResponse.json(
      { error: 'Failed to save command' },
      { status: 500 }
    );
  }
}

// Helper function to regenerate documents for all workspaces
async function regenerateAllWorkspaceDocuments() {
  const { promises: fs } = await import('fs');
  const path = await import('path');
  const WorkspaceDocumentGenerator = (await import('@/features/workspaces/services/WorkspaceDocumentGenerator')).default;
  
  const workspacesDir = path.join(process.cwd(), 'storage', 'workspaces');
  
  try {
    const workspaces = await fs.readdir(workspacesDir);
    
    for (const workspaceId of workspaces) {
      try {
        const workspacePath = path.join(workspacesDir, workspaceId);
        const stats = await fs.stat(workspacePath);
        
        if (stats.isDirectory()) {
          // Check if workspace has been initialized (has workspace.json)
          const workspaceJsonPath = path.join(workspacePath, 'workspace.json');
          try {
            await fs.access(workspaceJsonPath);
            
            // Load workspace data
            const workspaceData = JSON.parse(await fs.readFile(workspaceJsonPath, 'utf8'));
            
            const context = {
              workspaceId,
              workspacePath,
              description: workspaceData.description || 'Development workspace',
              projectType: workspaceData.projectType || 'general',
              gitInfo: workspaceData.git_status
            };
            
            // Only regenerate commands.json and CLAUDE.md (not permissions)
            await WorkspaceDocumentGenerator.generateCommands(workspaceId, context);
            await WorkspaceDocumentGenerator.generateClaudeMd(workspaceId, context);
            
            console.log(`✅ Regenerated documents for workspace ${workspaceId}`);
          } catch (error) {
            // Skip workspaces without workspace.json
            continue;
          }
        }
      } catch (error) {
        console.warn(`Failed to regenerate documents for workspace ${workspaceId}:`, error);
      }
    }
  } catch (error) {
    console.error('Failed to access workspaces directory:', error);
  }
}

// DELETE /api/commands/[id] - Delete a command
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Command ID is required' },
        { status: 400 }
      );
    }
    
    const commandManager = CommandManager.getInstance();
    await commandManager.initializeStorage();
    await commandManager.deleteCommand(id);
    
    // Regenerate documents for all workspaces
    try {
      await regenerateAllWorkspaceDocuments();
    } catch (regenerateError) {
      console.warn('Failed to regenerate some workspace documents:', regenerateError);
      // Don't fail the command delete operation
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete command:', error);
    return NextResponse.json(
      { error: 'Failed to delete command' },
      { status: 500 }
    );
  }
}

// PATCH /api/commands - Migrate existing commands to add roles
export async function PATCH(request: NextRequest) {
  try {
    const commandManager = CommandManager.getInstance();
    await commandManager.initializeStorage();
    await commandManager.migrateExistingCommands();
    
    return NextResponse.json({ success: true, message: 'Commands migrated successfully' });
  } catch (error) {
    console.error('Failed to migrate commands:', error);
    return NextResponse.json(
      { error: 'Failed to migrate commands' },
      { status: 500 }
    );
  }
}