import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { resolveGitDirectory } from '@/features/git/utils/gitDirectoryResolver';

const execAsync = promisify(exec);

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const { message, author, repoName } = await request.json();
    
    if (!message || typeof message !== 'string') {
      return Response.json({ error: 'Commit message is required' }, { status: 400 });
    }
    
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
      }, { status: 404 });
    }
    
    try {
      // Check if it's a git repository
      await execAsync('git rev-parse --git-dir', { cwd: gitDir });
      
      // Check if there are staged changes
      const { stdout: statusOutput } = await execAsync('git diff --cached --name-only', { 
        cwd: gitDir 
      });
      
      if (!statusOutput.trim()) {
        return Response.json({ 
          error: 'No staged changes to commit',
          hasChanges: false
        }, { status: 400 });
      }
      
      // Set author if provided
      let commitCommand = 'git commit';
      if (author && typeof author === 'object' && author.name && author.email) {
        commitCommand = `git -c user.name="${author.name}" -c user.email="${author.email}" commit`;
      }
      
      // Create commit with message
      const { stdout: commitOutput } = await execAsync(`${commitCommand} -m "${message.replace(/"/g, '\\"')}"`, { 
        cwd: gitDir,
        maxBuffer: 1024 * 1024 // 1MB buffer
      });
      
      // Get commit info
      const { stdout: commitHash } = await execAsync('git rev-parse HEAD', { cwd: gitDir });
      const { stdout: commitInfo } = await execAsync('git show --stat --oneline HEAD', { 
        cwd: gitDir,
        maxBuffer: 1024 * 1024 // 1MB buffer
      });
      
      return Response.json({
        success: true,
        commitHash: commitHash.trim(),
        message,
        output: commitOutput.trim(),
        commitInfo: commitInfo.trim(),
        gitInfo: {
          gitDir: gitDir,
          repoType: gitInfo.repoType,
          repoName: gitInfo.repoName
        }
      });
      
    } catch (gitError: any) {
      return Response.json({
        success: false,
        error: 'Git commit failed',
        details: gitError.message
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error creating git commit:', error);
    return Response.json({ 
      error: 'Failed to create git commit',
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
    const limit = parseInt(searchParams.get('limit') || '10');
    const branch = searchParams.get('branch') || 'HEAD';
    const repoName = searchParams.get('repo'); // Optional repo name for multi-repo workspaces
    
    // Resolve the correct git directory
    const gitInfo = await resolveGitDirectory(workspaceId, repoName);
    const gitDir = gitInfo.gitDir;
    
    if (!gitInfo.isGitRepo) {
      return Response.json({
        success: false,
        commits: [],
        error: `No git repository found in workspace${repoName ? ` for repo: ${repoName}` : ''}`,
        gitInfo: {
          searchedDir: gitDir,
          repoType: gitInfo.repoType,
          repoName: gitInfo.repoName
        }
      });
    }
    
    try {
      // Check if it's a git repository
      await execAsync('git rev-parse --git-dir', { cwd: gitDir });
      
      // Get commit history
      const { stdout: logOutput } = await execAsync(
        `git log ${branch} --oneline --format="%H|%an|%ae|%ad|%s" --date=iso8601 -n ${limit}`,
        { 
          cwd: gitDir,
          maxBuffer: 1024 * 1024 // 1MB buffer
        }
      );
      
      const commits = logOutput
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split('|');
          return {
            hash: parts[0],
            author: parts[1],
            email: parts[2],
            date: parts[3],
            message: parts[4] || ''
          };
        });
      
      return Response.json({
        success: true,
        commits,
        branch,
        gitInfo: {
          gitDir: gitDir,
          repoType: gitInfo.repoType,
          repoName: gitInfo.repoName
        }
      });
      
    } catch (gitError: any) {
      return Response.json({
        success: false,
        commits: [],
        error: 'Not a git repository or git command failed'
      });
    }
    
  } catch (error) {
    console.error('Error getting git commits:', error);
    return Response.json({ 
      error: 'Failed to get git commits',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}