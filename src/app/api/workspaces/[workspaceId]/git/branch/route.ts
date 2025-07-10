import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

interface BranchInfo {
  name: string;
  current: boolean;
  remote: boolean;
  lastCommit?: string;
  lastCommitDate?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    
    try {
      // Check if it's a git repository
      await execAsync('git rev-parse --git-dir', { cwd: workspaceDir });
      
      // Get all branches (local and remote)
      const { stdout: branchOutput } = await execAsync('git branch -a -v --format="%(refname:short)|%(HEAD)|%(upstream:short)|%(subject)|%(committerdate:iso8601)"', { 
        cwd: workspaceDir,
        maxBuffer: 1024 * 1024 // 1MB buffer
      });
      
      const branches: BranchInfo[] = branchOutput
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split('|');
          const name = parts[0];
          const isCurrent = parts[1] === '*';
          const isRemote = name.startsWith('origin/');
          const lastCommit = parts[3] || '';
          const lastCommitDate = parts[4] || '';
          
          return {
            name: isRemote ? name.replace('origin/', '') : name,
            current: isCurrent,
            remote: isRemote,
            lastCommit,
            lastCommitDate
          };
        })
        .filter(branch => !branch.name.includes('HEAD') && branch.name.trim());
      
      // Remove duplicates and merge local/remote info
      const branchMap = new Map<string, BranchInfo>();
      
      branches.forEach(branch => {
        const key = branch.name;
        if (branchMap.has(key)) {
          const existing = branchMap.get(key)!;
          if (branch.remote && !existing.remote) {
            existing.remote = true;
          }
          if (branch.current) {
            existing.current = true;
          }
        } else {
          branchMap.set(key, branch);
        }
      });
      
      const uniqueBranches = Array.from(branchMap.values())
        .sort((a, b) => {
          if (a.current) return -1;
          if (b.current) return 1;
          return a.name.localeCompare(b.name);
        });
      
      return Response.json({
        success: true,
        branches: uniqueBranches
      });
      
    } catch (gitError: any) {
      return Response.json({
        success: false,
        branches: [],
        error: 'Not a git repository or git command failed'
      });
    }
    
  } catch (error) {
    console.error('Error getting git branches:', error);
    return Response.json({ 
      error: 'Failed to get git branches',
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
    const { branchName, baseBranch = 'main' } = await request.json();
    
    if (!branchName || typeof branchName !== 'string') {
      return Response.json({ error: 'Branch name is required' }, { status: 400 });
    }
    
    // Validate branch name
    if (!/^[a-zA-Z0-9_\-\/]+$/.test(branchName)) {
      return Response.json({ error: 'Invalid branch name. Only alphanumeric, hyphens, underscores, and forward slashes allowed' }, { status: 400 });
    }
    
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    
    try {
      // Check if it's a git repository
      await execAsync('git rev-parse --git-dir', { cwd: workspaceDir });
      
      // Check if branch already exists
      try {
        await execAsync(`git rev-parse --verify ${branchName}`, { cwd: workspaceDir });
        return Response.json({ error: 'Branch already exists' }, { status: 409 });
      } catch {
        // Branch doesn't exist, which is what we want
      }
      
      // Create new branch from base branch
      await execAsync(`git checkout -b ${branchName} ${baseBranch}`, { cwd: workspaceDir });
      
      return Response.json({
        success: true,
        branch: branchName,
        message: `Branch '${branchName}' created successfully from '${baseBranch}'`
      });
      
    } catch (gitError: any) {
      return Response.json({
        success: false,
        error: 'Git operation failed',
        details: gitError.message
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error creating git branch:', error);
    return Response.json({ 
      error: 'Failed to create git branch',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const { branchName } = await request.json();
    
    if (!branchName || typeof branchName !== 'string') {
      return Response.json({ error: 'Branch name is required' }, { status: 400 });
    }
    
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    
    try {
      // Check if it's a git repository
      await execAsync('git rev-parse --git-dir', { cwd: workspaceDir });
      
      // Check if branch exists
      try {
        await execAsync(`git rev-parse --verify ${branchName}`, { cwd: workspaceDir });
      } catch {
        return Response.json({ error: 'Branch does not exist' }, { status: 404 });
      }
      
      // Check for uncommitted changes
      const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: workspaceDir });
      if (statusOutput.trim()) {
        return Response.json({ 
          error: 'Cannot switch branch with uncommitted changes',
          hasUncommittedChanges: true,
          changes: statusOutput.split('\n').filter(line => line.trim())
        }, { status: 409 });
      }
      
      // Switch to branch
      await execAsync(`git checkout ${branchName}`, { cwd: workspaceDir });
      
      return Response.json({
        success: true,
        branch: branchName,
        message: `Switched to branch '${branchName}'`
      });
      
    } catch (gitError: any) {
      return Response.json({
        success: false,
        error: 'Git operation failed',
        details: gitError.message
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error switching git branch:', error);
    return Response.json({ 
      error: 'Failed to switch git branch',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const branchName = searchParams.get('branch');
    const force = searchParams.get('force') === 'true';
    
    if (!branchName) {
      return Response.json({ error: 'Branch name is required' }, { status: 400 });
    }
    
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    
    try {
      // Check if it's a git repository
      await execAsync('git rev-parse --git-dir', { cwd: workspaceDir });
      
      // Check if branch exists
      try {
        await execAsync(`git rev-parse --verify ${branchName}`, { cwd: workspaceDir });
      } catch {
        return Response.json({ error: 'Branch does not exist' }, { status: 404 });
      }
      
      // Check if it's the current branch
      const { stdout: currentBranch } = await execAsync('git branch --show-current', { cwd: workspaceDir });
      if (currentBranch.trim() === branchName) {
        return Response.json({ error: 'Cannot delete current branch' }, { status: 409 });
      }
      
      // Check if it's a protected branch
      const protectedBranches = ['main', 'master', 'develop', 'production'];
      if (protectedBranches.includes(branchName)) {
        return Response.json({ error: 'Cannot delete protected branch' }, { status: 409 });
      }
      
      // Delete branch
      const deleteFlag = force ? '-D' : '-d';
      await execAsync(`git branch ${deleteFlag} ${branchName}`, { cwd: workspaceDir });
      
      return Response.json({
        success: true,
        branch: branchName,
        message: `Branch '${branchName}' deleted successfully`
      });
      
    } catch (gitError: any) {
      return Response.json({
        success: false,
        error: 'Git operation failed',
        details: gitError.message
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error deleting git branch:', error);
    return Response.json({ 
      error: 'Failed to delete git branch',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}