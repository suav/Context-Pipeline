import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resolveGitDirectory } from '@/features/git/utils/gitDirectoryResolver';

const execAsync = promisify(exec);

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const { files, all = false, repoName } = await request.json();
    
    // Resolve the correct git directory
    const gitInfo = await resolveGitDirectory(workspaceId, repoName);
    const gitDir = gitInfo.gitDir;
    
    if (!gitInfo.isGitRepo) {
      return Response.json({
        success: false,
        error: `No git repository found in workspace${repoName ? ` for repo: ${repoName}` : ''}`,
        gitInfo: {
          searchedDir: gitDir,
          repoType: gitInfo.repoType,
          repoName: gitInfo.repoName
        }
      }, { status: 400 });
    }

    try {
      // Check if it's a git repository
      await execAsync('git rev-parse --git-dir', { cwd: gitDir });
      
      let gitCommand: string;
      let stagedFiles: string[] = [];
      
      if (all) {
        // Stage all changes
        gitCommand = 'git add .';
        
        // Get list of all changed files
        const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: gitDir });
        stagedFiles = statusOutput.split('\n')
          .filter(line => line.trim())
          .map(line => line.substring(3)); // Remove status code prefix
      } else if (files && Array.isArray(files) && files.length > 0) {
        // Stage specific files
        const quotedFiles = files.map(file => `"${file}"`).join(' ');
        gitCommand = `git add ${quotedFiles}`;
        stagedFiles = files;
      } else {
        return Response.json({
          success: false,
          error: 'No files specified to stage. Provide "files" array or set "all" to true.'
        }, { status: 400 });
      }
      
      console.log('Executing git command:', gitCommand);
      
      // Execute the git add command
      const { stdout, stderr } = await execAsync(gitCommand, { cwd: gitDir });
      
      // Get updated status
      const { stdout: statusAfter } = await execAsync('git status --porcelain', { cwd: gitDir });
      const stagedCount = statusAfter.split('\n')
        .filter(line => line.trim() && (line[0] !== ' ' && line[0] !== '?'))
        .length;
      
      return Response.json({
        success: true,
        message: `Successfully staged ${stagedFiles.length} file(s)`,
        stagedFiles,
        stagedCount,
        gitOutput: stdout || stderr,
        gitInfo: {
          gitDir: gitDir,
          repoType: gitInfo.repoType,
          repoName: gitInfo.repoName
        }
      });
      
    } catch (gitError: any) {
      console.error('Git stage error:', gitError);
      return Response.json({
        success: false,
        error: 'Git command failed',
        details: gitError.message,
        gitOutput: gitError.stderr || gitError.stdout
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error staging files:', error);
    return Response.json({ 
      error: 'Failed to stage files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const repoName = searchParams.get('repo');
    
    // Resolve the correct git directory
    const gitInfo = await resolveGitDirectory(workspaceId, repoName);
    const gitDir = gitInfo.gitDir;
    
    if (!gitInfo.isGitRepo) {
      return Response.json({
        success: false,
        stagedFiles: [],
        error: `No git repository found in workspace${repoName ? ` for repo: ${repoName}` : ''}`
      });
    }

    try {
      // Get staged files
      const { stdout: stagedOutput } = await execAsync('git diff --cached --name-status', { cwd: gitDir });
      
      const stagedFiles = stagedOutput.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split('\t');
          return {
            status: parts[0],
            path: parts[1],
            oldPath: parts[2] // For renames
          };
        });
      
      return Response.json({
        success: true,
        stagedFiles,
        count: stagedFiles.length,
        gitInfo: {
          gitDir: gitDir,
          repoType: gitInfo.repoType,
          repoName: gitInfo.repoName
        }
      });
      
    } catch (gitError) {
      return Response.json({
        success: false,
        stagedFiles: [],
        error: 'Failed to get staged files'
      });
    }
    
  } catch (error) {
    console.error('Error getting staged files:', error);
    return Response.json({ 
      error: 'Failed to get staged files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}