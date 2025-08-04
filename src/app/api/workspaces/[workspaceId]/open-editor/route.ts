import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = params;
    const { editor = 'cursor' } = await request.json();

    // Determine workspace path
    const workspacePath = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    
    // Check if workspace exists
    if (!fs.existsSync(workspacePath)) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Determine command based on editor preference
    let command: string;
    switch (editor.toLowerCase()) {
      case 'vscode':
      case 'code':
        command = `code "${workspacePath}"`;
        break;
      case 'cursor':
      default:
        command = `cursor "${workspacePath}"`;
        break;
    }

    // Execute the command
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workspacePath,
        timeout: 10000 // 10 second timeout
      });

      return NextResponse.json({
        success: true,
        message: `${editor} opened successfully`,
        path: workspacePath,
        output: stdout || stderr || 'Editor opened'
      });
    } catch (execError: any) {
      // Check if it's a "command not found" error
      if (execError.code === 127 || execError.message.includes('not found')) {
        return NextResponse.json({
          success: false,
          error: `${editor} is not installed or not in PATH`,
          suggestion: editor === 'cursor' 
            ? 'Install Cursor from https://cursor.sh/ and ensure it\'s in your PATH'
            : 'Install VS Code and ensure the "code" command is available'
        }, { status: 400 });
      }

      // Other execution errors
      return NextResponse.json({
        success: false,
        error: `Failed to open ${editor}: ${execError.message}`,
        details: execError.stderr || execError.stdout
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error opening editor:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}