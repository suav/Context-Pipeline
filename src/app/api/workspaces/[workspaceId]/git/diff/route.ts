import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('file');
    
    if (!filePath) {
      return Response.json({ error: 'File path is required' }, { status: 400 });
    }
    
    // Security: ensure the path doesn't escape the workspace
    const normalizedPath = path.normalize(filePath).replace(/^[/\\]+/, '');
    if (normalizedPath.includes('..')) {
      return Response.json({ error: 'Invalid file path' }, { status: 400 });
    }
    
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    
    try {
      // Check if it's a git repository
      await execAsync('git rev-parse --git-dir', { cwd: workspaceDir });
      
      // Get the diff for the specific file
      const { stdout: diffOutput } = await execAsync(`git diff HEAD -- "${normalizedPath}"`, { 
        cwd: workspaceDir,
        maxBuffer: 1024 * 1024 // 1MB buffer
      });
      
      // Get file status
      const { stdout: statusOutput } = await execAsync(`git status --porcelain -- "${normalizedPath}"`, { 
        cwd: workspaceDir 
      });
      
      const status = statusOutput.trim();
      let fileStatus = 'unmodified';
      
      if (status) {
        const statusCode = status.substring(0, 2);
        switch (statusCode.trim()) {
          case 'M':
            fileStatus = 'modified';
            break;
          case 'A':
            fileStatus = 'added';
            break;
          case 'D':
            fileStatus = 'deleted';
            break;
          case 'R':
            fileStatus = 'renamed';
            break;
          case '??':
            fileStatus = 'untracked';
            break;
          default:
            fileStatus = 'modified';
        }
      }
      
      return Response.json({
        success: true,
        file: filePath,
        status: fileStatus,
        diff: diffOutput,
        hasChanges: diffOutput.length > 0 || status.length > 0
      });
      
    } catch (gitError: any) {
      // Not a git repository or git command failed
      return Response.json({
        success: false,
        file: filePath,
        status: 'no-git',
        diff: '',
        hasChanges: false,
        error: 'Not a git repository or git command failed'
      });
    }
    
  } catch (error) {
    console.error('Error getting git diff:', error);
    return Response.json({ 
      error: 'Failed to get git diff',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    
    try {
      // Get overall git status
      const { stdout: statusOutput } = await execAsync('git status --porcelain', { 
        cwd: workspaceDir 
      });
      
      const files = statusOutput.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const statusCode = line.substring(0, 2);
          const filePath = line.substring(3);
          
          let status = 'modified';
          switch (statusCode.trim()) {
            case 'M':
              status = 'modified';
              break;
            case 'A':
              status = 'added';
              break;
            case 'D':
              status = 'deleted';
              break;
            case 'R':
              status = 'renamed';
              break;
            case '??':
              status = 'untracked';
              break;
          }
          
          return { path: filePath, status };
        });
      
      return Response.json({
        success: true,
        files,
        hasChanges: files.length > 0
      });
      
    } catch (gitError) {
      return Response.json({
        success: false,
        files: [],
        hasChanges: false,
        error: 'Not a git repository'
      });
    }
    
  } catch (error) {
    console.error('Error getting git status:', error);
    return Response.json({ 
      error: 'Failed to get git status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}