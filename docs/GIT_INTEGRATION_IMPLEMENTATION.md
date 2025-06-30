# Git Integration Implementation Guide

## 🎯 Overview

This document details the technical implementation of git operations for the parallel workspace testing system, covering both remote deployment and local containerized testing scenarios.

## 🔧 Git Operations Architecture

```typescript
interface GitIntegration {
  // Core git operations
  createCombinedBranch(workspaces: Workspace[]): Promise<string>;
  pushToRemote(branch: string, remote: RemoteConfig): Promise<void>;
  createPullRequests(workspaces: Workspace[], testResults: TestResults): Promise<PullRequest[]>;
  
  // Conflict detection
  analyzeConflicts(workspaces: Workspace[]): Promise<ConflictAnalysis>;
  findSafeCombinations(workspaces: Workspace[]): Promise<string[][]>;
  
  // Merge coordination
  handleMergeBack(pr: PullRequest): Promise<void>;
  syncRelatedWorkspaces(mergedWorkspace: Workspace): Promise<void>;
}
```

## 📁 Repository Structure

```
workspace-git-integration/
├── src/
│   ├── git/
│   │   ├── operations.ts          # Core git operations
│   │   ├── conflict-analyzer.ts   # Conflict detection logic
│   │   ├── branch-manager.ts      # Branch creation/management
│   │   └── merge-coordinator.ts   # PR and merge handling
│   ├── deployment/
│   │   ├── remote-deployer.ts     # Remote deployment logic
│   │   ├── local-container.ts     # Local containerized testing
│   │   └── sync-scripts/          # Remote sync script templates
│   └── integrations/
│       ├── github.ts              # GitHub API integration
│       ├── gitlab.ts              # GitLab API integration
│       └── generic-git.ts         # Generic git provider
└── scripts/
    ├── remote-sync.sh             # Template for remote sync
    └── deploy-test.sh             # Template for deployment
```

## 🔍 Conflict Detection Implementation

### File-Level Conflict Analysis
```typescript
class ConflictAnalyzer {
  async analyzeWorkspaceConflicts(workspaces: Workspace[]): Promise<ConflictAnalysis> {
    const conflicts: Conflict[] = [];
    const changedFiles = new Map<string, Workspace[]>();
    
    // 1. Map all changed files to workspaces
    for (const workspace of workspaces) {
      const gitDiff = await this.getWorkspaceChanges(workspace);
      
      for (const file of gitDiff.changedFiles) {
        if (!changedFiles.has(file.path)) {
          changedFiles.set(file.path, []);
        }
        changedFiles.get(file.path)!.push(workspace);
      }
    }
    
    // 2. Identify conflicts
    for (const [filePath, workspacesChangingFile] of changedFiles) {
      if (workspacesChangingFile.length > 1) {
        const conflict = await this.analyzeFileConflict(filePath, workspacesChangingFile);
        if (conflict.severity !== 'none') {
          conflicts.push(conflict);
        }
      }
    }
    
    return {
      conflicts,
      safeCombinations: this.findSafeCombinations(workspaces, conflicts),
      recommendedAction: this.getRecommendedAction(conflicts)
    };
  }
  
  private async analyzeFileConflict(filePath: string, workspaces: Workspace[]): Promise<Conflict> {
    const diffs = await Promise.all(
      workspaces.map(w => this.getFileDiff(w, filePath))
    );
    
    // Check if changes are in same lines
    const lineConflicts = this.findLineConflicts(diffs);
    
    return {
      filePath,
      workspaces: workspaces.map(w => w.id),
      conflictType: this.determineConflictType(filePath, lineConflicts),
      severity: this.assessSeverity(lineConflicts),
      suggestedResolution: this.generateResolution(filePath, lineConflicts)
    };
  }
  
  private findLineConflicts(diffs: FileDiff[]): LineConflict[] {
    const lineChanges = new Map<number, FileDiff[]>();
    
    // Group changes by line number
    for (const diff of diffs) {
      for (const change of diff.changes) {
        for (let line = change.startLine; line <= change.endLine; line++) {
          if (!lineChanges.has(line)) {
            lineChanges.set(line, []);
          }
          lineChanges.get(line)!.push(diff);
        }
      }
    }
    
    // Find actual conflicts (same line changed by multiple workspaces)
    return Array.from(lineChanges.entries())
      .filter(([_, diffs]) => diffs.length > 1)
      .map(([lineNumber, conflictingDiffs]) => ({
        lineNumber,
        conflictingWorkspaces: conflictingDiffs.map(d => d.workspaceId),
        changeTypes: conflictingDiffs.map(d => d.changeType)
      }));
  }
}
```

### Smart Conflict Resolution
```typescript
class ConflictResolver {
  generateResolutionStrategy(conflict: Conflict): ResolutionStrategy {
    switch (conflict.conflictType) {
      case 'import_statement':
        return {
          type: 'auto_merge',
          strategy: 'combine_imports',
          confidence: 'high'
        };
        
      case 'css_property':
        return {
          type: 'manual_review',
          strategy: 'merge_with_review',
          confidence: 'medium',
          suggestion: 'CSS properties may need manual reconciliation'
        };
        
      case 'business_logic':
        return {
          type: 'separate_testing',
          strategy: 'test_individually',
          confidence: 'low',
          reason: 'Business logic conflicts require careful review'
        };
        
      default:
        return {
          type: 'manual_review',
          strategy: 'human_decision',
          confidence: 'low'
        };
    }
  }
}
```

## 🌐 Remote Deployment Implementation

### Git Operations for Remote Testing
```typescript
class RemoteDeployer {
  private gitProvider: GitProvider;
  private remoteConfig: RemoteConfig;
  
  async deployWorkspaceCombination(
    workspaces: Workspace[], 
    environment: string
  ): Promise<DeploymentResult> {
    try {
      // 1. Create combined branch
      const combinedBranch = await this.createCombinedBranch(workspaces);
      
      // 2. Push to remote repository
      await this.pushCombinedBranch(combinedBranch, workspaces);
      
      // 3. Trigger remote deployment
      const deployment = await this.triggerRemoteDeployment(combinedBranch, environment);
      
      // 4. Monitor deployment status
      const result = await this.monitorDeployment(deployment.id);
      
      return {
        success: true,
        branchName: combinedBranch,
        testUrl: this.generateTestUrl(combinedBranch, environment),
        deploymentId: deployment.id,
        logs: result.logs
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        rollbackInstructions: this.generateRollbackInstructions()
      };
    }
  }
  
  private async createCombinedBranch(workspaces: Workspace[]): Promise<string> {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const branchName = `test-combined-${timestamp}-${workspaces.length}ws`;
    
    // Start from main branch
    await git.checkout('main');
    await git.pull('origin', 'main');
    
    // Create new branch
    await git.checkoutLocalBranch(branchName);
    
    // Apply changes from each workspace
    for (const workspace of workspaces) {
      await this.applyWorkspaceChanges(workspace, branchName);
    }
    
    return branchName;
  }
  
  private async applyWorkspaceChanges(workspace: Workspace, targetBranch: string): Promise<void> {
    // Get the diff for this workspace
    const changes = await git.diff(['main', workspace.branchName]);
    
    // Apply changes using git apply or cherry-pick
    try {
      await git.cherryPick(workspace.commitShas);
    } catch (error) {
      // Handle conflicts
      throw new Error(`Failed to apply changes from workspace ${workspace.id}: ${error.message}`);
    }
  }
  
  private async pushCombinedBranch(branchName: string, workspaces: Workspace[]): Promise<void> {
    // Create commit message
    const commitMessage = this.generateCombinedCommitMessage(workspaces);
    
    // Commit changes
    await git.add('.');
    await git.commit(commitMessage);
    
    // Push to remote
    await git.push('origin', branchName);
  }
  
  private generateCombinedCommitMessage(workspaces: Workspace[]): string {
    const workspaceList = workspaces.map(w => `- ${w.title} (${w.id})`).join('\n');
    
    return `Combined workspace testing deployment
    
Workspaces included:
${workspaceList}

Generated by workspace testing system
Timestamp: ${new Date().toISOString()}`;
  }
}
```

### Remote Sync Script Generation
```typescript
class SyncScriptGenerator {
  generateRemoteSyncScript(config: RemoteConfig): string {
    return `#!/bin/bash
# Auto-generated sync script for workspace testing
# Config: ${config.environment}

set -e  # Exit on any error

BRANCH_NAME=$1
WORKSPACE_IDS=$2
ENVIRONMENT="${config.environment}"

echo "Starting deployment of branch: $BRANCH_NAME"
echo "Workspaces: $WORKSPACE_IDS"

# Pull latest changes
git fetch origin
git checkout $BRANCH_NAME
git pull origin $BRANCH_NAME

# Install dependencies if needed
if [ -f "package.json" ]; then
  npm ci
fi

# Run build
if [ -f "package.json" ]; then
  npm run build
fi

# Custom deployment steps
${config.customSteps.map(step => `echo "Running: ${step}"\n${step}`).join('\n')}

# Deploy to environment
${config.deployCommand}

# Health check
sleep 30
HEALTH_URL="${config.healthCheckUrl}"
if curl -f $HEALTH_URL; then
  echo "Deployment successful! Health check passed."
  echo "Test URL: ${config.testUrlPattern.replace('{branch}', '$BRANCH_NAME')}"
  
  # Notify webhook
  curl -X POST "$WEBHOOK_URL/status" \\
    -H "Authorization: Bearer $API_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d "{
      \\"branch\\": \\"$BRANCH_NAME\\",
      \\"status\\": \\"deployed\\",
      \\"workspaces\\": \\"$WORKSPACE_IDS\\",
      \\"test_url\\": \\"${config.testUrlPattern.replace('{branch}', '$BRANCH_NAME')}\\"
    }"
else
  echo "Deployment failed! Health check failed."
  exit 1
fi`;
  }
}
```

## 🐳 Local Container Testing Implementation

### Docker Integration
```typescript
class LocalContainerTester {
  private portManager = new PortManager();
  private docker = new Docker();
  
  async startWorkspaceTest(
    workspaces: Workspace[], 
    options: LocalTestOptions = {}
  ): Promise<LocalTestResult> {
    try {
      // 1. Create combined branch locally
      const branchName = await this.createLocalTestBranch(workspaces);
      
      // 2. Build Docker image
      const imageTag = await this.buildTestImage(branchName, workspaces);
      
      // 3. Start container
      const port = this.portManager.assignPort(`test-${branchName}`);
      const container = await this.startContainer(imageTag, port, options);
      
      // 4. Wait for readiness
      await this.waitForContainerReady(port);
      
      return {
        success: true,
        branchName,
        port,
        containerId: container.id,
        testUrl: `http://localhost:${port}`,
        workspaceIds: workspaces.map(w => w.id)
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  private async buildTestImage(branchName: string, workspaces: Workspace[]): Promise<string> {
    const dockerfile = this.generateDockerfile(workspaces);
    const imageTag = `workspace-test:${branchName}`;
    
    // Write temporary Dockerfile
    await fs.writeFile('Dockerfile.test', dockerfile);
    
    try {
      // Build image
      await this.docker.build({
        context: '.',
        dockerfile: 'Dockerfile.test',
        tag: imageTag,
        buildArgs: {
          WORKSPACE_BRANCH: branchName,
          WORKSPACE_IDS: workspaces.map(w => w.id).join(',')
        }
      });
      
      return imageTag;
    } finally {
      // Cleanup
      await fs.unlink('Dockerfile.test');
    }
  }
  
  private generateDockerfile(workspaces: Workspace[]): string {
    return `FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Add workspace metadata
LABEL workspace.ids="${workspaces.map(w => w.id).join(',')}"
LABEL workspace.branch="$WORKSPACE_BRANCH"
LABEL test.type="combined"

# Start application
CMD ["npm", "start"]`;
  }
  
  private async startContainer(
    imageTag: string, 
    port: number, 
    options: LocalTestOptions
  ): Promise<Docker.Container> {
    const container = await this.docker.createContainer({
      Image: imageTag,
      ExposedPorts: { '3000/tcp': {} },
      PortBindings: { '3000/tcp': [{ HostPort: port.toString() }] },
      Env: [
        'NODE_ENV=development',
        'TEST_MODE=true',
        `TEST_PORT=${port}`,
        ...Object.entries(options.env || {}).map(([k, v]) => `${k}=${v}`)
      ],
      Labels: {
        'workspace.test': 'true',
        'workspace.port': port.toString(),
        'workspace.type': 'combined'
      }
    });
    
    await container.start();
    return container;
  }
}
```

### Port Management
```typescript
class PortManager {
  private readonly usedPorts = new Set<number>();
  private readonly portAssignments = new Map<string, number>();
  private readonly basePort = 3001;
  private readonly maxPort = 3100;
  
  assignPort(testId: string): number {
    // Reuse existing port if test ID already has one
    if (this.portAssignments.has(testId)) {
      return this.portAssignments.get(testId)!;
    }
    
    // Find next available port
    for (let port = this.basePort; port <= this.maxPort; port++) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port);
        this.portAssignments.set(testId, port);
        return port;
      }
    }
    
    throw new Error('No available ports for testing');
  }
  
  releasePort(testId: string): void {
    const port = this.portAssignments.get(testId);
    if (port) {
      this.usedPorts.delete(port);
      this.portAssignments.delete(testId);
    }
  }
  
  getAllActivePorts(): { testId: string, port: number }[] {
    return Array.from(this.portAssignments.entries())
      .map(([testId, port]) => ({ testId, port }));
  }
}
```

## 🔄 PR Management Implementation

### Automated PR Creation
```typescript
class PRManager {
  private gitProvider: GitProvider;
  
  async createBatchPRs(
    workspaces: Workspace[], 
    testResults: TestResults
  ): Promise<BatchPRResult> {
    const successfulPRs: PullRequest[] = [];
    const failedPRs: PRCreationFailure[] = [];
    
    for (const workspace of workspaces) {
      try {
        const pr = await this.createWorkspacePR(workspace, testResults);
        successfulPRs.push(pr);
      } catch (error) {
        failedPRs.push({
          workspaceId: workspace.id,
          error: error.message
        });
      }
    }
    
    // Link related PRs
    await this.linkRelatedPRs(successfulPRs, testResults);
    
    return {
      successful: successfulPRs,
      failed: failedPRs,
      combinationId: testResults.combinationId
    };
  }
  
  private async createWorkspacePR(
    workspace: Workspace, 
    testResults: TestResults
  ): Promise<PullRequest> {
    const title = this.generatePRTitle(workspace, testResults);
    const description = this.generatePRDescription(workspace, testResults);
    
    const pr = await this.gitProvider.createPullRequest({
      title,
      description,
      head: workspace.branchName,
      base: workspace.baseBranch || 'main',
      labels: this.generatePRLabels(workspace, testResults),
      assignees: workspace.assignees || [],
      reviewers: workspace.reviewers || []
    });
    
    // Add test results as comment
    await this.addTestResultsComment(pr, workspace, testResults);
    
    return pr;
  }
  
  private generatePRDescription(workspace: Workspace, testResults: TestResults): string {
    const testInfo = testResults.workspaceResults.find(r => r.workspaceId === workspace.id);
    
    return `## ${workspace.title}

### Changes
${workspace.description}

### Testing Results
✅ **Tested in combination with:** ${testResults.workspaceIds.filter(id => id !== workspace.id).join(', ')}

📊 **Test Details:**
- **Combination ID:** ${testResults.combinationId}
- **Test Type:** ${testResults.testType}
- **Test URL:** ${testResults.testUrl}
- **Status:** ${testInfo?.status || 'pending'}

${testInfo?.issues?.length ? `
### Issues Found
${testInfo.issues.map(issue => `- ${issue.severity}: ${issue.description}`).join('\n')}
` : '### ✅ No Issues Found'}

### Files Changed
${workspace.changedFiles.map(file => `- \`${file}\``).join('\n')}

---
*This PR was tested as part of a multi-workspace combination. All related PRs are linked below.*`;
  }
  
  private async linkRelatedPRs(prs: PullRequest[], testResults: TestResults): Promise<void> {
    const linkComment = this.generateLinkComment(prs, testResults);
    
    // Add link comment to all PRs
    for (const pr of prs) {
      await this.gitProvider.addComment(pr.id, linkComment);
    }
  }
  
  private generateLinkComment(prs: PullRequest[], testResults: TestResults): string {
    const prLinks = prs.map(pr => `- #${pr.number}: ${pr.title}`).join('\n');
    
    return `🔗 **Related PRs (Tested Together)**

${prLinks}

**Combined Test Results:** ${testResults.reportUrl}
**Test Environment:** ${testResults.testUrl}

All these PRs were tested together successfully and can be merged independently.`;
  }
}
```

### Merge Coordination
```typescript
class MergeCoordinator {
  async handlePRMerge(pr: PullRequest): Promise<MergeResult> {
    try {
      // 1. Merge the PR
      await this.gitProvider.mergePR(pr.id);
      
      // 2. Update workspace status
      const workspace = await this.findWorkspaceByPR(pr);
      await workspace.updateStatus('merged');
      
      // 3. Find and update related workspaces
      const relatedWorkspaces = await this.findRelatedWorkspaces(workspace);
      const syncResults = await this.syncRelatedWorkspaces(relatedWorkspaces);
      
      // 4. Check for new conflicts
      const newConflicts = await this.checkForNewConflicts(relatedWorkspaces);
      
      return {
        success: true,
        mergedWorkspace: workspace.id,
        syncedWorkspaces: syncResults.successful,
        failedSyncs: syncResults.failed,
        newConflicts
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  private async syncRelatedWorkspaces(workspaces: Workspace[]): Promise<SyncResult> {
    const successful: string[] = [];
    const failed: WorkspaceSyncFailure[] = [];
    
    for (const workspace of workspaces) {
      try {
        await this.syncWorkspaceWithMain(workspace);
        successful.push(workspace.id);
      } catch (error) {
        failed.push({
          workspaceId: workspace.id,
          error: error.message,
          requiresManualResolution: error.type === 'merge_conflict'
        });
      }
    }
    
    return { successful, failed };
  }
  
  private async syncWorkspaceWithMain(workspace: Workspace): Promise<void> {
    // Switch to workspace branch
    await git.checkout(workspace.branchName);
    
    // Fetch latest main
    await git.fetch('origin', 'main');
    
    // Attempt merge
    try {
      await git.merge('origin/main');
    } catch (error) {
      if (error.type === 'merge_conflict') {
        // Mark workspace for manual resolution
        await workspace.markForManualResolution({
          type: 'merge_conflict',
          conflictingFiles: await git.getConflictingFiles(),
          suggestedResolution: 'Manual merge required after upstream changes'
        });
        throw error;
      }
      throw error;
    }
    
    // Push updated branch
    await git.push('origin', workspace.branchName);
  }
}
```

## 📊 Monitoring & Analytics

### Git Operations Tracking
```typescript
class GitOperationsTracker {
  async trackOperation(operation: GitOperation): Promise<void> {
    const record: GitOperationRecord = {
      id: generateId(),
      type: operation.type,
      workspaceIds: operation.workspaceIds,
      timestamp: new Date(),
      status: 'started',
      metadata: operation.metadata
    };
    
    await this.storage.saveOperationRecord(record);
    
    try {
      const result = await operation.execute();
      record.status = 'completed';
      record.result = result;
    } catch (error) {
      record.status = 'failed';
      record.error = error.message;
    } finally {
      await this.storage.updateOperationRecord(record);
    }
  }
  
  async getOperationHistory(filters?: OperationFilters): Promise<GitOperationRecord[]> {
    return this.storage.queryOperations(filters);
  }
  
  async getWorkspaceGitStats(workspaceId: string): Promise<GitStats> {
    const operations = await this.getOperationHistory({ workspaceIds: [workspaceId] });
    
    return {
      totalOperations: operations.length,
      successfulMerges: operations.filter(op => op.type === 'merge' && op.status === 'completed').length,
      conflicts: operations.filter(op => op.type === 'conflict_detection').length,
      lastSync: operations.find(op => op.type === 'sync')?.timestamp
    };
  }
}
```

This comprehensive git integration implementation provides the foundation for both remote deployment testing and local containerized testing scenarios, with robust conflict detection, automated PR management, and intelligent merge coordination.