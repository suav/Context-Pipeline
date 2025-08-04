/**
 * Branch Manager
 * 
 * Handles git branch operations for workspace git integration
 * Provides a clean interface for branch creation, switching, and management
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export interface BranchInfo {
  name: string;
  current: boolean;
  remote: boolean;
  upstream?: string;
  lastCommit?: string;
  lastCommitDate?: string;
  lastCommitHash?: string;
  ahead?: number;
  behind?: number;
}

export interface BranchCreateOptions {
  baseBranch?: string;
  checkout?: boolean;
  force?: boolean;
}

export interface BranchSwitchOptions {
  createIfNotExists?: boolean;
  force?: boolean;
}

export interface BranchDeleteOptions {
  force?: boolean;
  deleteRemote?: boolean;
}

export class BranchManager {
  private workspaceDir: string;

  constructor(workspaceId: string) {
    this.workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
  }

  /**
   * Check if the workspace is a git repository
   */
  async isGitRepository(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: this.workspaceDir });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all branches (local and remote)
   */
  async getAllBranches(): Promise<BranchInfo[]> {
    if (!await this.isGitRepository()) {
      throw new Error('Not a git repository');
    }

    try {
      // Get current branch
      const { stdout: currentBranchOutput } = await execAsync('git branch --show-current', { cwd: this.workspaceDir });
      const currentBranch = currentBranchOutput.trim();

      // Get all branches with details
      const { stdout: branchOutput } = await execAsync('git branch -a -v', { cwd: this.workspaceDir });
      
      const branches: BranchInfo[] = [];
      const lines = branchOutput.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.includes('->')) continue;

        const isCurrent = trimmedLine.startsWith('*');
        const cleanLine = trimmedLine.replace(/^\*?\s*/, '');
        const parts = cleanLine.split(/\s+/);
        
        if (parts.length < 2) continue;

        const branchName = parts[0];
        const hash = parts[1];
        const isRemote = branchName.startsWith('remotes/origin/');
        const displayName = isRemote ? branchName.replace('remotes/origin/', '') : branchName;

        // Skip HEAD reference
        if (displayName === 'HEAD') continue;

        // Get commit message (everything after hash)
        const commitMessage = parts.slice(2).join(' ');

        // Get detailed info for local branches
        let ahead = 0;
        let behind = 0;
        let upstream = '';

        if (!isRemote) {
          try {
            // Get upstream info
            const { stdout: upstreamOutput } = await execAsync(`git rev-parse --abbrev-ref ${branchName}@{upstream}`, { cwd: this.workspaceDir });
            upstream = upstreamOutput.trim();

            // Get ahead/behind count
            const { stdout: countOutput } = await execAsync(`git rev-list --count --left-right ${upstream}...${branchName}`, { cwd: this.workspaceDir });
            const counts = countOutput.trim().split('\t');
            behind = parseInt(counts[0]) || 0;
            ahead = parseInt(counts[1]) || 0;
          } catch {
            // No upstream or other error
          }
        }

        // Get commit date
        let lastCommitDate = '';
        try {
          const { stdout: dateOutput } = await execAsync(`git log -1 --format=%ci ${branchName}`, { cwd: this.workspaceDir });
          lastCommitDate = dateOutput.trim();
        } catch {
          // Error getting date
        }

        branches.push({
          name: displayName,
          current: isCurrent,
          remote: isRemote,
          upstream,
          lastCommit: commitMessage,
          lastCommitDate,
          lastCommitHash: hash,
          ahead,
          behind
        });
      }

      // Remove duplicates (local and remote versions of same branch)
      const branchMap = new Map<string, BranchInfo>();
      
      branches.forEach(branch => {
        const key = branch.name;
        if (branchMap.has(key)) {
          const existing = branchMap.get(key)!;
          // Merge info, prefer local branch info
          if (!existing.remote && branch.remote) {
            // Keep existing (local) but note it has remote
            existing.upstream = existing.upstream || `origin/${branch.name}`;
          } else if (existing.remote && !branch.remote) {
            // Replace remote with local
            branchMap.set(key, { ...branch, upstream: existing.upstream || `origin/${branch.name}` });
          }
        } else {
          branchMap.set(key, branch);
        }
      });

      return Array.from(branchMap.values()).sort((a, b) => {
        if (a.current) return -1;
        if (b.current) return 1;
        return a.name.localeCompare(b.name);
      });

    } catch (error) {
      throw new Error(`Failed to get branches: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string | null> {
    if (!await this.isGitRepository()) {
      return null;
    }

    try {
      const { stdout } = await execAsync('git branch --show-current', { cwd: this.workspaceDir });
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(branchName: string, options: BranchCreateOptions = {}): Promise<void> {
    if (!await this.isGitRepository()) {
      throw new Error('Not a git repository');
    }

    // Validate branch name
    if (!/^[a-zA-Z0-9_\-\/]+$/.test(branchName)) {
      throw new Error('Invalid branch name. Only alphanumeric, hyphens, underscores, and forward slashes allowed');
    }

    const { baseBranch = 'main', checkout = true, force = false } = options;

    try {
      // Check if branch already exists
      if (!force) {
        try {
          await execAsync(`git rev-parse --verify ${branchName}`, { cwd: this.workspaceDir });
          throw new Error('Branch already exists');
        } catch (error: any) {
          if (error.message === 'Branch already exists') {
            throw error;
          }
          // Branch doesn't exist, which is what we want
        }
      }

      // Create branch
      if (checkout) {
        await execAsync(`git checkout -b ${branchName} ${baseBranch}`, { cwd: this.workspaceDir });
      } else {
        await execAsync(`git branch ${branchName} ${baseBranch}`, { cwd: this.workspaceDir });
      }

    } catch (error) {
      if (error instanceof Error && error.message === 'Branch already exists') {
        throw error;
      }
      throw new Error(`Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Switch to a branch
   */
  async switchBranch(branchName: string, options: BranchSwitchOptions = {}): Promise<void> {
    if (!await this.isGitRepository()) {
      throw new Error('Not a git repository');
    }

    const { createIfNotExists = false, force = false } = options;

    try {
      // Check for uncommitted changes (unless force)
      if (!force) {
        const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: this.workspaceDir });
        if (statusOutput.trim()) {
          throw new Error('Cannot switch branch with uncommitted changes. Use force option or commit changes first.');
        }
      }

      // Check if branch exists
      let branchExists = false;
      try {
        await execAsync(`git rev-parse --verify ${branchName}`, { cwd: this.workspaceDir });
        branchExists = true;
      } catch {
        branchExists = false;
      }

      if (!branchExists) {
        if (createIfNotExists) {
          await this.createBranch(branchName, { checkout: true });
          return;
        } else {
          throw new Error('Branch does not exist');
        }
      }

      // Switch to branch
      const command = force ? `git checkout -f ${branchName}` : `git checkout ${branchName}`;
      await execAsync(command, { cwd: this.workspaceDir });

    } catch (error) {
      if (error instanceof Error && error.message.includes('uncommitted changes')) {
        throw error;
      }
      throw new Error(`Failed to switch branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a branch
   */
  async deleteBranch(branchName: string, options: BranchDeleteOptions = {}): Promise<void> {
    if (!await this.isGitRepository()) {
      throw new Error('Not a git repository');
    }

    const { force = false, deleteRemote = false } = options;

    try {
      // Check if branch exists
      try {
        await execAsync(`git rev-parse --verify ${branchName}`, { cwd: this.workspaceDir });
      } catch {
        throw new Error('Branch does not exist');
      }

      // Check if it's the current branch
      const currentBranch = await this.getCurrentBranch();
      if (currentBranch === branchName) {
        throw new Error('Cannot delete current branch');
      }

      // Check if it's a protected branch
      const protectedBranches = ['main', 'master', 'develop', 'development', 'production', 'staging'];
      if (protectedBranches.includes(branchName)) {
        throw new Error('Cannot delete protected branch');
      }

      // Delete local branch
      const deleteFlag = force ? '-D' : '-d';
      await execAsync(`git branch ${deleteFlag} ${branchName}`, { cwd: this.workspaceDir });

      // Delete remote branch if requested
      if (deleteRemote) {
        try {
          await execAsync(`git push origin --delete ${branchName}`, { cwd: this.workspaceDir });
        } catch (error) {
          console.warn(`Failed to delete remote branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('Cannot delete') || 
        error.message.includes('Branch does not exist')
      )) {
        throw error;
      }
      throw new Error(`Failed to delete branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get branch commit history
   */
  async getBranchHistory(branchName: string, limit: number = 20): Promise<any[]> {
    if (!await this.isGitRepository()) {
      throw new Error('Not a git repository');
    }

    try {
      const { stdout } = await execAsync(
        `git log ${branchName} --pretty=format:"%H|%an|%ae|%ai|%s" -n ${limit}`,
        { cwd: this.workspaceDir }
      );

      return stdout.split('\n').filter(line => line.trim()).map(line => {
        const parts = line.split('|');
        return {
          hash: parts[0],
          author: parts[1],
          email: parts[2],
          date: parts[3],
          message: parts[4]
        };
      });

    } catch (error) {
      throw new Error(`Failed to get branch history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compare branches
   */
  async compareBranches(baseBranch: string, targetBranch: string): Promise<{
    ahead: number;
    behind: number;
    commits: any[];
  }> {
    if (!await this.isGitRepository()) {
      throw new Error('Not a git repository');
    }

    try {
      // Get ahead/behind count
      const { stdout: countOutput } = await execAsync(
        `git rev-list --count --left-right ${baseBranch}...${targetBranch}`,
        { cwd: this.workspaceDir }
      );

      const counts = countOutput.trim().split('\t');
      const behind = parseInt(counts[0]) || 0;
      const ahead = parseInt(counts[1]) || 0;

      // Get commits that are different
      const { stdout: commitOutput } = await execAsync(
        `git log ${baseBranch}...${targetBranch} --pretty=format:"%H|%an|%ae|%ai|%s" --no-merges`,
        { cwd: this.workspaceDir }
      );

      const commits = commitOutput.split('\n').filter(line => line.trim()).map(line => {
        const parts = line.split('|');
        return {
          hash: parts[0],
          author: parts[1],
          email: parts[2],
          date: parts[3],
          message: parts[4]
        };
      });

      return {
        ahead,
        behind,
        commits
      };

    } catch (error) {
      throw new Error(`Failed to compare branches: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Merge a branch
   */
  async mergeBranch(sourceBranch: string, targetBranch?: string, options: { noFastForward?: boolean } = {}): Promise<void> {
    if (!await this.isGitRepository()) {
      throw new Error('Not a git repository');
    }

    const { noFastForward = false } = options;

    try {
      // If target branch specified, switch to it first
      if (targetBranch) {
        const currentBranch = await this.getCurrentBranch();
        if (currentBranch !== targetBranch) {
          await this.switchBranch(targetBranch);
        }
      }

      // Check for uncommitted changes
      const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: this.workspaceDir });
      if (statusOutput.trim()) {
        throw new Error('Cannot merge with uncommitted changes');
      }

      // Perform merge
      const mergeFlag = noFastForward ? '--no-ff' : '';
      await execAsync(`git merge ${mergeFlag} ${sourceBranch}`, { cwd: this.workspaceDir });

    } catch (error) {
      throw new Error(`Failed to merge branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}