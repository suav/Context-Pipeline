/**
 * Davin Git Manager
 * 
 * Handles git operations for deploying workspace changes to Davin's development server
 * Following the established feature-first architecture and 4-component workspace design
 */

// import { simpleGit, SimpleGit } from 'simple-git';
// import * as fs from 'fs-extra';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { 
  DavinDeploymentConfig, 
  DavinDeploymentResult, 
  DeploymentStatus,
  generateBranchName,
  generateTestUrl,
  generateDeploymentId,
  defaultDavinConfig 
} from '../../../lib/davin-deployment-config';

interface Workspace {
  id: string;
  title: string;
  path: string;
  changedFiles?: string[];
  commitShas?: string[];
}

interface ConflictAnalysis {
  hasConflicts: boolean;
  conflictingFiles: string[];
  workspaceConflicts: Array<{
    workspaceA: string;
    workspaceB: string;
    files: string[];
  }>;
}

// Mock git interface until dependencies are installed
interface MockGit {
  checkout: (branch: string) => Promise<void>;
  pull: (remote: string, branch: string) => Promise<void>;
  clone: (url: string, path: string, options?: any) => Promise<void>;
  checkoutLocalBranch: (branch: string) => Promise<void>;
  add: (files: string) => Promise<void>;
  commit: (message: string) => Promise<void>;
  push: (remote: string, branch: string, options?: string[]) => Promise<void>;
  status: () => Promise<{ files: any[], modified: string[], created: string[], deleted: string[], staged: string[] }>;
}

export class DavinGitManager {
  private config: DavinDeploymentConfig;
  private git: MockGit;
  private localRepoPath: string;
  private tempDir: string;

  constructor(config: DavinDeploymentConfig = defaultDavinConfig) {
    this.config = config;
    this.tempDir = path.join(process.cwd(), 'temp');
    this.localRepoPath = path.join(this.tempDir, 'davin-repo-clone');
    // Mock git implementation - replace with actual simpleGit when dependencies installed
    this.git = this.createMockGit();
  }

  private createMockGit(): MockGit {
    return {
      checkout: async (branch: string) => { console.log(`Mock: checkout ${branch}`); },
      pull: async (remote: string, branch: string) => { console.log(`Mock: pull ${remote} ${branch}`); },
      clone: async (url: string, path: string, options?: any) => { console.log(`Mock: clone ${url} to ${path}`); },
      checkoutLocalBranch: async (branch: string) => { console.log(`Mock: checkout new branch ${branch}`); },
      add: async (files: string) => { console.log(`Mock: add ${files}`); },
      commit: async (message: string) => { console.log(`Mock: commit "${message}"`); },
      push: async (remote: string, branch: string, options?: string[]) => { console.log(`Mock: push ${remote} ${branch}`); },
      status: async () => ({ files: [], modified: [], created: [], deleted: [], staged: [] })
    };
  }

  /**
   * Main deployment function - combines multiple workspaces and deploys to Davin server
   */
  async deployWorkspaceCombination(
    workspaces: Workspace[], 
    combinationName?: string
  ): Promise<DavinDeploymentResult> {
    const deploymentId = generateDeploymentId();
    const startTime = Date.now();

    try {
      // 1. Validate inputs
      await this.validateDeploymentInputs(workspaces);

      // 2. Analyze conflicts between workspaces
      const conflictAnalysis = await this.analyzeWorkspaceConflicts(workspaces);
      if (conflictAnalysis.hasConflicts) {
        throw new Error(`Conflicts detected: ${conflictAnalysis.conflictingFiles.join(', ')}`);
      }

      // 3. Ensure we have a local copy of the Davin repository
      await this.ensureLocalRepository();

      // 4. Create combined branch with all workspace changes
      const branchName = await this.createCombinedBranch(workspaces, combinationName);

      // 5. Push branch to GitHub
      await this.pushBranchToGitHub(branchName);

      // 6. Trigger deployment on Davin server
      await this.triggerRemoteDeployment(branchName, deploymentId, workspaces);

      // 7. Generate test URL
      const testUrl = generateTestUrl(branchName, this.config);

      const deploymentDuration = Date.now() - startTime;

      return {
        success: true,
        branchName,
        testUrl,
        deploymentId,
        workspaceIds: workspaces.map(w => w.id),
        logs: [
          `Deployment started at ${new Date(startTime).toISOString()}`,
          `Created combined branch: ${branchName}`,
          `Applied changes from ${workspaces.length} workspaces`,
          `Pushed to GitHub repository`,
          `Triggered remote deployment`,
          `Deployment completed in ${Math.round(deploymentDuration / 1000)}s`,
          `Test URL: ${testUrl}`
        ]
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        workspaceIds: workspaces.map(w => w.id),
        logs: [
          `Deployment failed: ${errorMessage}`,
          `Failed after ${Math.round((Date.now() - startTime) / 1000)}s`
        ]
      };
    }
  }

  /**
   * Analyze conflicts between multiple workspaces
   */
  async analyzeWorkspaceConflicts(workspaces: Workspace[]): Promise<ConflictAnalysis> {
    const conflictAnalysis: ConflictAnalysis = {
      hasConflicts: false,
      conflictingFiles: [],
      workspaceConflicts: []
    };

    // Build a map of files to workspaces that modify them
    const fileToWorkspaces = new Map<string, Workspace[]>();

    for (const workspace of workspaces) {
      const changedFiles = await this.getWorkspaceChangedFiles(workspace);
      
      for (const file of changedFiles) {
        if (!fileToWorkspaces.has(file)) {
          fileToWorkspaces.set(file, []);
        }
        fileToWorkspaces.get(file)!.push(workspace);
      }
    }

    // Identify conflicts (same file modified by multiple workspaces)
    for (const filePath of Array.from(fileToWorkspaces.keys())) {
      const modifyingWorkspaces = fileToWorkspaces.get(filePath)!;
      if (modifyingWorkspaces.length > 1) {
        conflictAnalysis.hasConflicts = true;
        conflictAnalysis.conflictingFiles.push(filePath);

        // Record specific workspace conflicts
        for (let i = 0; i < modifyingWorkspaces.length; i++) {
          for (let j = i + 1; j < modifyingWorkspaces.length; j++) {
            conflictAnalysis.workspaceConflicts.push({
              workspaceA: modifyingWorkspaces[i].id,
              workspaceB: modifyingWorkspaces[j].id,
              files: [filePath]
            });
          }
        }
      }
    }

    return conflictAnalysis;
  }

  /**
   * Get list of changed files for a workspace
   */
  private async getWorkspaceChangedFiles(workspace: Workspace): Promise<string[]> {
    // If workspace has pre-computed changed files, use them
    if (workspace.changedFiles && workspace.changedFiles.length > 0) {
      return workspace.changedFiles;
    }

    // Otherwise, scan the workspace target directory for changes
    const workspaceTargetPath = path.join(workspace.path, 'target', 'repo-clone');
    
    const pathExists = async (path: string): Promise<boolean> => {
      try {
        await fsp.access(path);
        return true;
      } catch {
        return false;
      }
    };

    if (!await pathExists(workspaceTargetPath)) {
      return [];
    }

    try {
      // Mock workspace git - replace with actual simpleGit when dependencies installed
      const workspaceGit = this.createMockGit();
      
      // Get modified files (staged and unstaged)
      const status = await workspaceGit.status();
      
      return [
        ...status.modified,
        ...status.created,
        ...status.deleted,
        ...status.staged
      ];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Could not get git status for workspace ${workspace.id}:`, errorMessage);
      return [];
    }
  }

  /**
   * Ensure we have a local copy of the Davin repository
   */
  private async ensureLocalRepository(): Promise<void> {
    // Create temp directory if it doesn't exist
    await fsp.mkdir(this.tempDir, { recursive: true });

    const pathExists = async (path: string): Promise<boolean> => {
      try {
        await fsp.access(path);
        return true;
      } catch {
        return false;
      }
    };

    if (await pathExists(this.localRepoPath)) {
      // Update existing repository
      await this.git.checkout(this.config.repository.defaultBranch);
      await this.git.pull('origin', this.config.repository.defaultBranch);
    } else {
      // Clone repository
      await this.git.clone(this.config.repository.url, this.localRepoPath, {
        '--depth': 1,
        '--single-branch': true,
        '--branch': this.config.repository.defaultBranch
      });
    }
  }

  /**
   * Create a combined branch with changes from all workspaces
   */
  private async createCombinedBranch(
    workspaces: Workspace[], 
    combinationName?: string
  ): Promise<string> {
    const branchName = combinationName ? 
      `${this.config.repository.testBranchPrefix}${combinationName}` : 
      generateBranchName(workspaces.map(w => w.id));

    // Create and checkout new branch
    await this.git.checkoutLocalBranch(branchName);

    // Apply changes from each workspace
    for (const workspace of workspaces) {
      await this.applyWorkspaceChanges(workspace);
    }

    // Commit combined changes
    const commitMessage = this.generateCombinedCommitMessage(workspaces);
    
    // Check if there are any changes to commit
    const status = await this.git.status();
    if (status.files.length > 0) {
      await this.git.add('.');
      await this.git.commit(commitMessage);
    }

    return branchName;
  }

  /**
   * Apply changes from a single workspace to the combined branch
   */
  private async applyWorkspaceChanges(workspace: Workspace): Promise<void> {
    const workspaceTargetPath = path.join(workspace.path, 'target', 'repo-clone');
    
    const pathExists = async (path: string): Promise<boolean> => {
      try {
        await fsp.access(path);
        return true;
      } catch {
        return false;
      }
    };
    
    if (!await pathExists(workspaceTargetPath)) {
      console.warn(`Workspace ${workspace.id} has no target repo-clone directory`);
      return;
    }

    // Get changed files from workspace
    const changedFiles = await this.getWorkspaceChangedFiles(workspace);

    // Copy changed files from workspace to deployment repository
    for (const file of changedFiles) {
      const sourcePath = path.join(workspaceTargetPath, file);
      const destPath = path.join(this.localRepoPath, file);

      if (await pathExists(sourcePath)) {
        // Ensure destination directory exists
        await fsp.mkdir(path.dirname(destPath), { recursive: true });
        
        // Copy file
        await fsp.copyFile(sourcePath, destPath);
      }
    }
  }

  /**
   * Generate commit message for combined workspace changes
   */
  private generateCombinedCommitMessage(workspaces: Workspace[]): string {
    const workspaceList = workspaces
      .map(w => `- ${w.title} (${w.id})`)
      .join('\n');

    return `Combined workspace testing deployment

Workspaces included:
${workspaceList}

Generated by workspace testing system
Timestamp: ${new Date().toISOString()}
Deployment ID: ${generateDeploymentId()}`;
  }

  /**
   * Push branch to GitHub
   */
  private async pushBranchToGitHub(branchName: string): Promise<void> {
    await this.git.push('origin', branchName, ['--set-upstream']);
  }

  /**
   * Setup SSH git remote for direct deployment
   */
  private async setupSSHRemote(workspacePath: string): Promise<void> {
    const sshConfig = this.config.ssh;
    const remoteUrl = `${sshConfig.user}@${sshConfig.host}:${sshConfig.repositoryPath}`;
    
    // Mock implementation - replace with actual git operations
    console.log(`Mock: git remote add ${sshConfig.gitRemoteName} ${remoteUrl}`);
    
    // In real implementation:
    // const workspaceGit = simpleGit(workspacePath);
    // try {
    //   await workspaceGit.removeRemote(sshConfig.gitRemoteName);
    // } catch {} // Remote might not exist
    // await workspaceGit.addRemote(sshConfig.gitRemoteName, remoteUrl);
  }

  /**
   * Deploy workspace directly via SSH git push
   */
  async deployWorkspaceViaSSH(workspace: Workspace): Promise<DavinDeploymentResult> {
    const deploymentId = generateDeploymentId();
    const startTime = Date.now();
    
    try {
      const workspaceTargetPath = path.join(workspace.path, 'target', 'repo-clone');
      const branchName = `workspace-${workspace.id}-${Date.now()}`;
      
      // 1. Setup SSH remote in workspace
      await this.setupSSHRemote(workspaceTargetPath);
      
      // 2. Create workspace-specific branch
      await this.createWorkspaceBranch(workspaceTargetPath, branchName);
      
      // 3. Push directly to test server via SSH
      await this.pushToSSHRemote(workspaceTargetPath, branchName);
      
      // 4. Switch branch on remote server via SSH
      await this.switchRemoteBranch(branchName);
      
      // 5. Generate test URL
      const testUrl = generateTestUrl(branchName, this.config);
      
      return {
        success: true,
        branchName,
        testUrl,
        deploymentId,
        workspaceIds: [workspace.id],
        logs: [
          `SSH deployment started for workspace ${workspace.id}`,
          `Created branch: ${branchName}`,
          `Pushed to ${this.config.ssh.host} via SSH`,
          `Switched remote branch to ${branchName}`,
          `Test URL: ${testUrl}`,
          `Deployment completed in ${Math.round((Date.now() - startTime) / 1000)}s`
        ]
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        workspaceIds: [workspace.id],
        logs: [`SSH deployment failed: ${errorMessage}`]
      };
    }
  }

  /**
   * Create workspace-specific branch
   */
  private async createWorkspaceBranch(workspacePath: string, branchName: string): Promise<void> {
    // Mock implementation
    console.log(`Mock: cd ${workspacePath} && git checkout -b ${branchName}`);
    
    // In real implementation:
    // const workspaceGit = simpleGit(workspacePath);
    // await workspaceGit.checkoutLocalBranch(branchName);
  }

  /**
   * Push to SSH remote with force-with-lease
   */
  private async pushToSSHRemote(workspacePath: string, branchName: string): Promise<void> {
    const sshConfig = this.config.ssh;
    const pushOptions = sshConfig.useForceWithLease ? ['--force-with-lease'] : [];
    
    // Mock implementation
    console.log(`Mock: cd ${workspacePath} && git push ${pushOptions.join(' ')} ${sshConfig.gitRemoteName} ${branchName}`);
    
    // In real implementation:
    // const workspaceGit = simpleGit(workspacePath);
    // await workspaceGit.push(sshConfig.gitRemoteName, branchName, pushOptions);
  }

  /**
   * Switch branch on remote server via SSH
   */
  private async switchRemoteBranch(branchName: string): Promise<void> {
    const sshConfig = this.config.ssh;
    const sshCommand = `ssh ${sshConfig.keyPath ? `-i ${sshConfig.keyPath}` : ''} ${sshConfig.user}@${sshConfig.host}`;
    const gitCommands = [
      `cd ${sshConfig.repositoryPath}`,
      `git fetch`,
      `git checkout ${branchName}`,
      `git reset --hard origin/${branchName}`
    ].join(' && ');
    
    // Mock implementation
    console.log(`Mock: ${sshCommand} "${gitCommands}"`);
    
    // In real implementation, use Node.js child_process:
    // const { exec } = require('child_process');
    // await new Promise((resolve, reject) => {
    //   exec(`${sshCommand} "${gitCommands}"`, (error, stdout, stderr) => {
    //     if (error) reject(error);
    //     else resolve(stdout);
    //   });
    // });
  }

  /**
   * Generate workspace deploy script
   */
  generateDeployScript(workspace: Workspace): string {
    const sshConfig = this.config.ssh;
    
    return `#!/bin/bash
# Auto-generated deploy script for workspace: ${workspace.id}
# Generated by Davin Remote Deployment System

set -e  # Exit on any error

WORKSPACE_ID="${workspace.id}"
BRANCH_NAME="workspace-\${WORKSPACE_ID}-$(date +%s)"
SSH_HOST="${sshConfig.host}"
SSH_USER="${sshConfig.user}"
REMOTE_NAME="${sshConfig.gitRemoteName}"
REMOTE_PATH="${sshConfig.repositoryPath}"

echo "🚀 Deploying workspace \${WORKSPACE_ID} to \${SSH_HOST}"

# Get current branch name if not set
if [ -z "\$BRANCH_NAME" ]; then
    BRANCH_NAME=$(git branch --show-current)
fi

echo "📦 Branch: \$BRANCH_NAME"

# Setup remote if it doesn't exist
if ! git remote get-url \$REMOTE_NAME > /dev/null 2>&1; then
    echo "🔧 Adding SSH remote: \$REMOTE_NAME"
    git remote add \$REMOTE_NAME "\${SSH_USER}@\${SSH_HOST}:\${REMOTE_PATH}"
fi

# Create and checkout branch
echo "🌿 Creating workspace branch: \$BRANCH_NAME"
git checkout -b "\$BRANCH_NAME" 2>/dev/null || git checkout "\$BRANCH_NAME"

# Push to remote with force-with-lease for safety
echo "📤 Pushing to remote server..."
git push ${sshConfig.useForceWithLease ? '--force-with-lease' : ''} \$REMOTE_NAME "\$BRANCH_NAME"

# Switch branch on remote server
echo "🔄 Switching remote branch..."
ssh ${sshConfig.keyPath ? `-i ${sshConfig.keyPath}` : ''} "\${SSH_USER}@\${SSH_HOST}" "
    cd \${REMOTE_PATH} && 
    git fetch && 
    git checkout \$BRANCH_NAME && 
    git reset --hard origin/\$BRANCH_NAME
"

# Generate test URL
TEST_URL="${this.config.targetServer.testUrlPattern.replace('{branch}', '$BRANCH_NAME')}"

echo "✅ Deployment complete!"
echo "🔗 Test URL: \$TEST_URL"
echo ""
echo "To rollback: ssh \${SSH_USER}@\${SSH_HOST} 'cd \${REMOTE_PATH} && git checkout main'"
`;
  }

  /**
   * Trigger deployment on Davin server
   */
  private async triggerRemoteDeployment(
    branchName: string, 
    deploymentId: string, 
    workspaces: Workspace[]
  ): Promise<void> {
    const workspaceIds = workspaces.map(w => w.id).join(',');

    if (this.config.deployment.webhookUrl) {
      // Option 1: Webhook approach (if Davin server has webhook endpoint)
      const deploymentPayload = {
        branch: branchName,
        workspaceIds,
        deploymentId,
        repository: this.config.repository.url,
        timestamp: new Date().toISOString(),
        requestedBy: 'workspace-testing-system'
      };

      try {
        const response = await fetch(this.config.deployment.webhookUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.DAVIN_WEBHOOK_TOKEN || ''}`
          },
          body: JSON.stringify(deploymentPayload)
        });

        if (!response.ok) {
          throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to trigger deployment via webhook: ${errorMessage}`);
      }
    } else {
      // Option 2: Log deployment request (manual deployment required)
      console.log(`Manual deployment required for branch: ${branchName}`);
      console.log(`SSH to ${this.config.targetServer.sshHost} and run:`);
      console.log(`cd ${this.config.targetServer.deployPath}`);
      console.log(`./scripts/sync-from-git.sh ${branchName} ${workspaceIds} ${deploymentId}`);
    }
  }

  /**
   * Validate deployment inputs
   */
  private async validateDeploymentInputs(workspaces: Workspace[]): Promise<void> {
    if (workspaces.length === 0) {
      throw new Error('No workspaces provided for deployment');
    }

    for (const workspace of workspaces) {
      if (!workspace.id || !workspace.path) {
        throw new Error(`Invalid workspace: ${JSON.stringify(workspace)}`);
      }

      const workspacePath = workspace.path;
      const pathExists = async (path: string): Promise<boolean> => {
        try {
          await fsp.access(path);
          return true;
        } catch {
          return false;
        }
      };

      if (!await pathExists(workspacePath)) {
        throw new Error(`Workspace path does not exist: ${workspacePath}`);
      }
    }
  }

  /**
   * Cleanup temporary files
   */
  async cleanup(): Promise<void> {
    try {
      const pathExists = async (path: string): Promise<boolean> => {
        try {
          await fsp.access(path);
          return true;
        } catch {
          return false;
        }
      };

      if (await pathExists(this.localRepoPath)) {
        await fsp.rm(this.localRepoPath, { recursive: true, force: true });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('Failed to cleanup temporary files:', errorMessage);
    }
  }

  /**
   * Get deployment status for a specific deployment
   */
  async getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus | null> {
    // This would typically query the deployment tracking system
    // For now, return a mock implementation
    return {
      id: deploymentId,
      status: 'completed',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      logs: ['Deployment completed successfully']
    };
  }

  /**
   * Rollback a deployment
   */
  async rollbackDeployment(deploymentId: string): Promise<boolean> {
    // This would trigger a rollback on the remote server
    // Implementation depends on the rollback mechanism available
    try {
      if (this.config.deployment.webhookUrl) {
        const rollbackPayload = {
          action: 'rollback',
          deploymentId,
          timestamp: new Date().toISOString()
        };

        const response = await fetch(this.config.deployment.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rollbackPayload)
        });

        return response.ok;
      }
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Rollback failed:', errorMessage);
      return false;
    }
  }
}