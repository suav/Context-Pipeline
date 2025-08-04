import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { resolveGitDirectory } from '@/features/git/utils/gitDirectoryResolver';

const execAsync = promisify(exec);

interface GitFileStatus {
  path: string;
  status: string;
  staged: boolean;
  modified: boolean;
  added: boolean;
  deleted: boolean;
  renamed: boolean;
  untracked: boolean;
}

interface GitStatus {
  currentBranch: string;
  ahead: number;
  behind: number;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: GitFileStatus[];
  clean: boolean;
  hasChanges: boolean;
}

function parseGitStatus(statusOutput: string): GitFileStatus[] {
  const files: GitFileStatus[] = [];
  
  statusOutput.split('\n').forEach(line => {
    if (!line.trim()) return;
    
    const statusCode = line.substring(0, 2);
    const filePath = line.substring(3);
    
    if (!filePath) return;
    
    const stagedCode = statusCode[0];
    const unstagedCode = statusCode[1];
    
    const file: GitFileStatus = {
      path: filePath,
      status: '',
      staged: false,
      modified: false,
      added: false,
      deleted: false,
      renamed: false,
      untracked: false
    };
    
    // Parse staged changes
    if (stagedCode !== ' ' && stagedCode !== '?') {
      file.staged = true;
      switch (stagedCode) {
        case 'A':
          file.added = true;
          file.status = 'added';
          break;
        case 'M':
          file.modified = true;
          file.status = 'modified';
          break;
        case 'D':
          file.deleted = true;
          file.status = 'deleted';
          break;
        case 'R':
          file.renamed = true;
          file.status = 'renamed';
          break;
        case 'C':
          file.status = 'copied';
          break;
        default:
          file.status = 'staged';
      }
    }
    
    // Parse unstaged changes
    if (unstagedCode !== ' ') {
      switch (unstagedCode) {
        case 'M':
          file.modified = true;
          if (!file.status) file.status = 'modified';
          break;
        case 'D':
          file.deleted = true;
          if (!file.status) file.status = 'deleted';
          break;
        case '?':
          file.untracked = true;
          file.status = 'untracked';
          break;
      }
    }
    
    // Default status if not set
    if (!file.status) {
      file.status = 'unknown';
    }
    
    files.push(file);
  });
  
  return files;
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
      });
    }
    
    try {
      // Check if it's a git repository
      await execAsync('git rev-parse --git-dir', { cwd: gitDir });
      
      // Get current branch
      const { stdout: branchOutput } = await execAsync('git branch --show-current', { cwd: gitDir });
      const currentBranch = branchOutput.trim();
      
      // Get tracking info (ahead/behind)
      let ahead = 0;
      let behind = 0;
      
      try {
        const { stdout: trackingOutput } = await execAsync(`git rev-list --count --left-right origin/${currentBranch}...HEAD`, { cwd: gitDir });
        const trackingParts = trackingOutput.trim().split('\t');
        behind = parseInt(trackingParts[0]) || 0;
        ahead = parseInt(trackingParts[1]) || 0;
      } catch {
        // No tracking branch or other error, keep defaults
      }
      
      // Get detailed status
      const { stdout: statusOutput } = await execAsync('git status --porcelain', { 
        cwd: gitDir,
        maxBuffer: 1024 * 1024 // 1MB buffer
      });
      
      const files = parseGitStatus(statusOutput);
      
      // Categorize files
      const staged = files.filter(f => f.staged);
      const unstaged = files.filter(f => !f.staged && !f.untracked);
      const untracked = files.filter(f => f.untracked);
      
      const clean = files.length === 0;
      const hasChanges = files.length > 0;
      
      const gitStatus: GitStatus = {
        currentBranch,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
        clean,
        hasChanges
      };
      
      return Response.json({
        success: true,
        status: gitStatus,
        gitInfo: {
          gitDir: gitDir,
          repoType: gitInfo.repoType,
          repoName: gitInfo.repoName
        }
      });
      
    } catch (gitError: any) {
      return Response.json({
        success: false,
        status: null,
        error: 'Not a git repository or git command failed',
        details: gitError.message
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

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const { action, files } = await request.json();
    
    if (!action || !['stage', 'unstage', 'stageAll', 'unstageAll'].includes(action)) {
      return Response.json({ error: 'Valid action required: stage, unstage, stageAll, unstageAll' }, { status: 400 });
    }
    
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    const targetDir = path.join(workspaceDir, 'target');
    
    // Check if target directory exists, if not, try workspace root (backwards compatibility)
    const gitDir = require('fs').existsSync(targetDir) ? targetDir : workspaceDir;
    
    try {
      // Check if it's a git repository
      await execAsync('git rev-parse --git-dir', { cwd: gitDir });
      
      let command = '';
      
      switch (action) {
        case 'stage':
          if (!files || !Array.isArray(files) || files.length === 0) {
            return Response.json({ error: 'Files array required for stage action' }, { status: 400 });
          }
          // Escape file paths for shell safety
          const escapedFiles = files.map(f => `"${f.replace(/"/g, '\\"')}"`).join(' ');
          command = `git add ${escapedFiles}`;
          break;
          
        case 'unstage':
          if (!files || !Array.isArray(files) || files.length === 0) {
            return Response.json({ error: 'Files array required for unstage action' }, { status: 400 });
          }
          const escapedUnstageFiles = files.map(f => `"${f.replace(/"/g, '\\"')}"`).join(' ');
          command = `git reset HEAD ${escapedUnstageFiles}`;
          break;
          
        case 'stageAll':
          command = 'git add .';
          break;
          
        case 'unstageAll':
          command = 'git reset HEAD';
          break;
      }
      
      // Execute the git command
      await execAsync(command, { cwd: gitDir });
      
      // Get updated status
      const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: gitDir });
      const updatedFiles = parseGitStatus(statusOutput);
      
      return Response.json({
        success: true,
        action,
        files: updatedFiles,
        message: `${action} operation completed successfully`
      });
      
    } catch (gitError: any) {
      return Response.json({
        success: false,
        error: 'Git operation failed',
        details: gitError.message
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error performing git status operation:', error);
    return Response.json({ 
      error: 'Failed to perform git status operation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}