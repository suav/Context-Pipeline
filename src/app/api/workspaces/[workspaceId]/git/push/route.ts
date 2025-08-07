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
    const { remote = 'origin', branch = 'main', force = false, createBranch = false, repoName } = await request.json();
    
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
      
      // Get current branch
      const { stdout: currentBranchOutput } = await execAsync('git branch --show-current', { cwd: gitDir });
      const currentBranch = currentBranchOutput.trim();
      
      // Check if there are uncommitted changes
      const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: gitDir });
      if (statusOutput.trim()) {
        return Response.json({ 
          error: 'Cannot push with uncommitted changes. Please commit or stash changes first.',
          hasUncommittedChanges: true,
          changes: statusOutput.split('\n').filter(line => line.trim())
        }, { status: 409 });
      }
      
      // Check if remote exists
      try {
        await execAsync(`git remote get-url ${remote}`, { cwd: gitDir });
      } catch {
        return Response.json({ 
          error: `Remote '${remote}' does not exist`,
          availableRemotes: await getAvailableRemotes(gitDir)
        }, { status: 404 });
      }
      
      let pushCommand = '';
      let pushOutput = '';
      
      if (createBranch) {
        // Push current branch to remote with upstream tracking
        pushCommand = `git push -u ${remote} ${currentBranch}`;
      } else {
        // Push to specific branch
        const forceFlag = force ? '--force' : '';
        pushCommand = `git push ${forceFlag} ${remote} ${currentBranch}:${branch}`.trim();
      }
      
      try {
        const { stdout, stderr } = await execAsync(pushCommand, { 
          cwd: gitDir,
          maxBuffer: 2 * 1024 * 1024 // 2MB buffer for push output
        });
        
        pushOutput = stdout + stderr;
        
        // Get updated status after push
        const { stdout: statusAfterPush } = await execAsync('git status -b --porcelain', { cwd: gitDir });
        
        return Response.json({
          success: true,
          currentBranch,
          targetBranch: branch,
          remote,
          output: pushOutput.trim(),
          command: pushCommand,
          status: statusAfterPush.trim(),
          gitInfo: {
            gitDir: gitDir,
            repoType: gitInfo.repoType,
            repoName: gitInfo.repoName
          }
        });
        
      } catch (pushError: any) {
        // Handle specific git push errors
        const errorMessage = pushError.message || pushError.stderr || 'Unknown push error';
        
        if (errorMessage.includes('non-fast-forward')) {
          return Response.json({
            success: false,
            error: 'Push rejected due to non-fast-forward update',
            details: errorMessage,
            suggestion: 'Pull latest changes or use force push if intentional',
            requiresForce: true
          }, { status: 409 });
        }
        
        if (errorMessage.includes('no upstream branch')) {
          return Response.json({
            success: false,
            error: 'No upstream branch configured',
            details: errorMessage,
            suggestion: 'Set createBranch: true to create upstream tracking',
            needsUpstream: true
          }, { status: 409 });
        }
        
        if (errorMessage.includes('Permission denied') || errorMessage.includes('Authentication failed')) {
          return Response.json({
            success: false,
            error: 'Authentication failed',
            details: errorMessage,
            suggestion: 'Check git credentials and repository access'
          }, { status: 403 });
        }
        
        return Response.json({
          success: false,
          error: 'Push failed',
          details: errorMessage,
          command: pushCommand
        }, { status: 500 });
      }
      
    } catch (gitError: any) {
      return Response.json({
        success: false,
        error: 'Git operation failed',
        details: gitError.message
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error pushing to git remote:', error);
    return Response.json({ 
      error: 'Failed to push to git remote',
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
    const repoName = searchParams.get('repo'); // Optional repo name for multi-repo workspaces
    
    // Resolve the correct git directory
    const gitInfo = await resolveGitDirectory(workspaceId, repoName ?? undefined);
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
      });
    }
    
    try {
      // Check if it's a git repository
      await execAsync('git rev-parse --git-dir', { cwd: gitDir });
      
      // Get current branch
      const { stdout: currentBranchOutput } = await execAsync('git branch --show-current', { cwd: gitDir });
      const currentBranch = currentBranchOutput.trim();
      
      // Get tracking info
      let upstream = null;
      let ahead = 0;
      let behind = 0;
      
      try {
        const { stdout: upstreamOutput } = await execAsync(`git rev-parse --abbrev-ref ${currentBranch}@{upstream}`, { cwd: gitDir });
        upstream = upstreamOutput.trim();
        
        // Get ahead/behind count
        const { stdout: trackingOutput } = await execAsync(`git rev-list --count --left-right ${upstream}...HEAD`, { cwd: gitDir });
        const trackingParts = trackingOutput.trim().split('\t');
        behind = parseInt(trackingParts[0]) || 0;
        ahead = parseInt(trackingParts[1]) || 0;
      } catch {
        // No upstream configured
      }
      
      // Get available remotes
      const remotes = await getAvailableRemotes(gitDir);
      
      // Check if there are uncommitted changes
      const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: gitDir });
      const hasUncommittedChanges = statusOutput.trim().length > 0;
      
      return Response.json({
        success: true,
        currentBranch,
        upstream,
        ahead,
        behind,
        remotes,
        hasUncommittedChanges,
        canPush: !hasUncommittedChanges && (ahead > 0 || !upstream),
        gitInfo: {
          gitDir: gitDir,
          repoType: gitInfo.repoType,
          repoName: gitInfo.repoName
        }
      });
      
    } catch (gitError: any) {
      return Response.json({
        success: false,
        error: 'Not a git repository or git command failed'
      });
    }
    
  } catch (error) {
    console.error('Error getting git push status:', error);
    return Response.json({ 
      error: 'Failed to get git push status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function getAvailableRemotes(gitDir: string): Promise<string[]> {
  try {
    const { stdout: remotesOutput } = await execAsync('git remote', { cwd: gitDir });
    return remotesOutput.split('\n').filter(line => line.trim());
  } catch {
    return [];
  }
}