import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { resolveGitDirectory } from '@/features/git/utils/gitDirectoryResolver';

const execAsync = promisify(exec);

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('file');
    const baseBranch = searchParams.get('base');
    const targetBranch = searchParams.get('target');
    const staged = searchParams.get('staged') === 'true';
    const diffType = searchParams.get('type') || 'file'; // 'file', 'branch', 'staged'
    const repoName = searchParams.get('repo'); // Optional repo name for multi-repo workspaces
    
    // Resolve the correct git directory
    const gitInfo = await resolveGitDirectory(workspaceId, repoName);
    const gitDir = gitInfo.gitDir;
    
    if (!gitInfo.isGitRepo) {
      return Response.json({
        success: false,
        diffType,
        diff: '',
        hasChanges: false,
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
      
      let diffOutput = '';
      let diffCommand = '';
      let responseData: any = {
        success: true,
        diffType,
        hasChanges: false,
        gitInfo: {
          gitDir: gitDir,
          repoType: gitInfo.repoType,
          repoName: gitInfo.repoName
        }
      };
      
      switch (diffType) {
        case 'file':
          if (!filePath) {
            return Response.json({ error: 'File path is required for file diff' }, { status: 400 });
          }
          
          // Normalize file path to relative path within git repository
          let normalizedPath = filePath;
          
          // Remove leading slashes
          normalizedPath = normalizedPath.replace(/^[/\\]+/, '');
          
          // For files in target/repo-clone structure, extract the actual file path within the repo
          if (normalizedPath.includes('target/repo-clone/')) {
            const repoMatch = normalizedPath.match(/target\/repo-clone\/[^\/]+\/(.+)$/);
            if (repoMatch) {
              normalizedPath = repoMatch[1];
            }
          }
          
          // For files directly in target structure (for created repos)
          if (normalizedPath.includes('target/') && !normalizedPath.includes('target/repo-clone/')) {
            normalizedPath = normalizedPath.replace(/.*target\//, '');
          }
          
          // Security: ensure the path doesn't escape the workspace
          normalizedPath = path.normalize(normalizedPath);
          if (normalizedPath.includes('..')) {
            return Response.json({ error: 'Invalid file path' }, { status: 400 });
          }
          
          if (staged) {
            // Get staged changes for the file
            diffCommand = `git diff --cached -- "${normalizedPath}"`;
          } else {
            // Get unstaged changes for the file
            diffCommand = `git diff HEAD -- "${normalizedPath}"`;
          }
          
          const { stdout: fileDiffOutput } = await execAsync(diffCommand, { 
            cwd: gitDir,
            maxBuffer: 1024 * 1024 // 1MB buffer
          });
          
          // Get file status
          const { stdout: statusOutput } = await execAsync(`git status --porcelain -- "${normalizedPath}"`, { 
            cwd: gitDir 
          });
          
          const status = statusOutput.trim();
          let fileStatus = 'unmodified';
          let hasChanges = false;
          
          if (status) {
            const statusCode = status.substring(0, 2);
            const stagedCode = statusCode[0];
            const unstagedCode = statusCode[1];
            
            if (staged && stagedCode !== ' ' && stagedCode !== '?') {
              // Checking staged changes
              hasChanges = true;
              switch (stagedCode) {
                case 'M': fileStatus = 'modified'; break;
                case 'A': fileStatus = 'added'; break;
                case 'D': fileStatus = 'deleted'; break;
                case 'R': fileStatus = 'renamed'; break;
                case 'C': fileStatus = 'copied'; break;
                default: fileStatus = 'modified';
              }
            } else if (!staged && (unstagedCode !== ' ' || stagedCode !== ' ')) {
              // Checking unstaged changes (includes any modification)
              hasChanges = true;
              if (unstagedCode !== ' ') {
                switch (unstagedCode) {
                  case 'M': fileStatus = 'modified'; break;
                  case 'D': fileStatus = 'deleted'; break;
                  case '?': fileStatus = 'untracked'; break;
                  default: fileStatus = 'modified';
                }
              } else if (stagedCode !== ' ') {
                // File has staged changes but we're looking at unstaged
                fileStatus = 'staged';
                hasChanges = true;
              }
            }
          }
          
          // Also check if diff output exists (more reliable for modifications)
          if (fileDiffOutput.length > 0) {
            hasChanges = true;
            if (fileStatus === 'unmodified') {
              fileStatus = 'modified';
            }
          }
          
          responseData = {
            ...responseData,
            file: filePath,
            status: fileStatus,
            diff: fileDiffOutput,
            hasChanges: hasChanges,
            staged,
            rawStatus: status // Include raw status for debugging
          };
          break;
          
        case 'branch':
          if (!baseBranch || !targetBranch) {
            return Response.json({ error: 'Base and target branches are required for branch diff' }, { status: 400 });
          }
          
          // Get diff between branches
          diffCommand = `git diff ${baseBranch}...${targetBranch}`;
          
          const { stdout: branchDiffOutput } = await execAsync(diffCommand, { 
            cwd: gitDir,
            maxBuffer: 2 * 1024 * 1024 // 2MB buffer for branch diffs
          });
          
          // Get commit count differences
          const { stdout: countOutput } = await execAsync(
            `git rev-list --count --left-right ${baseBranch}...${targetBranch}`,
            { cwd: gitDir }
          );
          
          const counts = countOutput.trim().split('\t');
          const behind = parseInt(counts[0]) || 0;
          const ahead = parseInt(counts[1]) || 0;
          
          // Get changed files
          const { stdout: filesOutput } = await execAsync(
            `git diff --name-status ${baseBranch}...${targetBranch}`,
            { cwd: gitDir }
          );
          
          const changedFiles = filesOutput.split('\n')
            .filter(line => line.trim())
            .map(line => {
              const parts = line.split('\t');
              return {
                status: parts[0],
                path: parts[1],
                oldPath: parts[2] // For renames
              };
            });
          
          responseData = {
            ...responseData,
            baseBranch,
            targetBranch,
            diff: branchDiffOutput,
            hasChanges: branchDiffOutput.length > 0,
            ahead,
            behind,
            changedFiles
          };
          break;
          
        case 'staged':
          // Get all staged changes
          diffCommand = 'git diff --cached';
          
          const { stdout: stagedDiffOutput } = await execAsync(diffCommand, { 
            cwd: gitDir,
            maxBuffer: 1024 * 1024 // 1MB buffer
          });
          
          // Get staged files
          const { stdout: stagedFilesOutput } = await execAsync('git diff --cached --name-status', { 
            cwd: gitDir 
          });
          
          const stagedFiles = stagedFilesOutput.split('\n')
            .filter(line => line.trim())
            .map(line => {
              const parts = line.split('\t');
              return {
                status: parts[0],
                path: parts[1],
                oldPath: parts[2] // For renames
              };
            });
          
          responseData = {
            ...responseData,
            diff: stagedDiffOutput,
            hasChanges: stagedDiffOutput.length > 0,
            stagedFiles
          };
          break;
          
        default:
          return Response.json({ error: 'Invalid diff type. Use: file, branch, or staged' }, { status: 400 });
      }
      
      return Response.json(responseData);
      
    } catch (gitError: any) {
      // Not a git repository or git command failed
      return Response.json({
        success: false,
        diffType,
        diff: '',
        hasChanges: false,
        error: 'Not a git repository or git command failed',
        details: gitError.message
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
    const { repoName } = await request.json() || {};
    
    // Resolve the correct git directory
    const gitInfo = await resolveGitDirectory(workspaceId, repoName);
    const gitDir = gitInfo.gitDir;
    
    try {
      // Get overall git status
      const { stdout: statusOutput } = await execAsync('git status --porcelain', { 
        cwd: gitDir 
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
        hasChanges: files.length > 0,
        gitInfo: {
          gitDir: gitDir,
          repoType: gitInfo.repoType,
          repoName: gitInfo.repoName
        }
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