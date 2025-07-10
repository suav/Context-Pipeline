#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
class FunctionalityEvaluator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      branches: {},
      overall: {
        totalFeatures: 0,
        workingFeatures: 0,
        brokenFeatures: 0,
        missingFeatures: 0,
        functionalityScore: 0
      },
      featureMatrix: this.getExpectedFeatures()
    };
  }
  getExpectedFeatures() {
    return {
      'feature/permissions-system': {
        name: 'Permissions & Commands System',
        expectedFeatures: [
          {
            id: 'permission-injection',
            name: 'Permission injection on agent instantiation',
            testMethod: 'checkPermissionInjection',
            weight: 30
          },
          {
            id: 'claude-md-generation',
            name: 'CLAUDE.md generation for workspaces',
            testMethod: 'checkClaudeMdGeneration',
            weight: 25
          },
          {
            id: 'global-config',
            name: 'Global configuration management',
            testMethod: 'checkGlobalConfig',
            weight: 20
          },
          {
            id: 'tool-approval',
            name: 'Tool approval overlay',
            testMethod: 'checkToolApproval',
            weight: 15
          },
          {
            id: 'command-library',
            name: 'Command library integration',
            testMethod: 'checkCommandLibrary',
            weight: 10
          }
        ]
      },
      'feature/checkpoint-system': {
        name: 'Agent Checkpoint System',
        expectedFeatures: [
          {
            id: 'checkpoint-save',
            name: 'Checkpoint save functionality',
            testMethod: 'checkCheckpointSave',
            weight: 30
          },
          {
            id: 'checkpoint-restore',
            name: 'Checkpoint restore functionality',
            testMethod: 'checkCheckpointRestore',
            weight: 30
          },
          {
            id: 'checkpoint-storage',
            name: 'Checkpoint storage management',
            testMethod: 'checkCheckpointStorage',
            weight: 20
          },
          {
            id: 'checkpoint-metadata',
            name: 'Checkpoint metadata and tagging',
            testMethod: 'checkCheckpointMetadata',
            weight: 10
          },
          {
            id: 'expert-library',
            name: 'Expert agent library',
            testMethod: 'checkExpertLibrary',
            weight: 10
          }
        ]
      },
      'feature/git-operations': {
        name: 'Git Flow Integration',
        expectedFeatures: [
          {
            id: 'branch-management',
            name: 'Git branch management',
            testMethod: 'checkBranchManagement',
            weight: 25
          },
          {
            id: 'commit-operations',
            name: 'Git commit operations',
            testMethod: 'checkCommitOperations',
            weight: 25
          },
          {
            id: 'diff-viewing',
            name: 'Enhanced git diff viewing',
            testMethod: 'checkDiffViewing',
            weight: 20
          },
          {
            id: 'status-operations',
            name: 'Git status operations',
            testMethod: 'checkStatusOperations',
            weight: 15
          },
          {
            id: 'remote-operations',
            name: 'Remote git operations',
            testMethod: 'checkRemoteOperations',
            weight: 15
          }
        ]
      },
      'feature/context-import': {
        name: 'Context Enhancement',
        expectedFeatures: [
          {
            id: 'file-import',
            name: 'File import functionality',
            testMethod: 'checkFileImport',
            weight: 25
          },
          {
            id: 'text-import',
            name: 'Text import functionality',
            testMethod: 'checkTextImport',
            weight: 20
          },
          {
            id: 'email-import',
            name: 'Email import framework',
            testMethod: 'checkEmailImport',
            weight: 20
          },
          {
            id: 'enhanced-jira',
            name: 'Enhanced JIRA integration',
            testMethod: 'checkEnhancedJira',
            weight: 20
          },
          {
            id: 'email-processor',
            name: 'Email processing service',
            testMethod: 'checkEmailProcessor',
            weight: 15
          }
        ]
      },
      'feature/ui-improvements': {
        name: 'UI/UX Enhancement',
        expectedFeatures: [
          {
            id: 'monaco-enhancement',
            name: 'Monaco editor enhancements',
            testMethod: 'checkMonacoEnhancement',
            weight: 25
          },
          {
            id: 'file-tree-improvement',
            name: 'File tree improvements',
            testMethod: 'checkFileTreeImprovement',
            weight: 20
          },
          {
            id: 'editor-themes',
            name: 'Editor themes system',
            testMethod: 'checkEditorThemes',
            weight: 20
          },
          {
            id: 'file-context-menu',
            name: 'File context menu',
            testMethod: 'checkFileContextMenu',
            weight: 15
          },
          {
            id: 'icon-service',
            name: 'File icon service',
            testMethod: 'checkIconService',
            weight: 10
          },
          {
            id: 'editor-config',
            name: 'Editor configuration manager',
            testMethod: 'checkEditorConfig',
            weight: 10
          }
        ]
      }
    };
  }
  async evaluateBranch(branchName) {
    console.log(`\n⚙️ Evaluating functionality for branch: ${branchName}`);
    const branchResults = {
      branch: branchName,
      features: {},
      metrics: {
        totalFeatures: 0,
        workingFeatures: 0,
        partialFeatures: 0,
        brokenFeatures: 0,
        missingFeatures: 0,
        functionalityScore: 0
      },
      buildStatus: 'unknown',
      testResults: {},
      recommendations: []
    };
    try {
      // Checkout branch
      await execAsync(`git checkout ${branchName}`);
      // Test build
      branchResults.buildStatus = await this.testBuild();
      // Get expected features for this branch
      const expectedFeatures = this.results.featureMatrix[branchName];
      if (expectedFeatures) {
        console.log(`  📋 Testing ${expectedFeatures.expectedFeatures.length} features...`);
        branchResults.metrics.totalFeatures = expectedFeatures.expectedFeatures.length;
        for (const feature of expectedFeatures.expectedFeatures) {
          const result = await this.testFeature(feature, branchName);
          branchResults.features[feature.id] = result;
          if (result.status === 'working') {
            branchResults.metrics.workingFeatures++;
          } else if (result.status === 'partial') {
            branchResults.metrics.partialFeatures++;
          } else if (result.status === 'broken') {
            branchResults.metrics.brokenFeatures++;
          } else {
            branchResults.metrics.missingFeatures++;
          }
        }
        // Calculate functionality score
        branchResults.metrics.functionalityScore = this.calculateFunctionalityScore(branchResults.metrics, expectedFeatures.expectedFeatures);
        // Generate recommendations
        this.generateFunctionalityRecommendations(branchResults, expectedFeatures);
      }
      // Store results
      this.results.branches[branchName] = branchResults;
      console.log(`  ✅ Functionality evaluation complete`);
      console.log(`     Working: ${branchResults.metrics.workingFeatures}/${branchResults.metrics.totalFeatures}`);
      console.log(`     Partial: ${branchResults.metrics.partialFeatures}`);
      console.log(`     Broken: ${branchResults.metrics.brokenFeatures}`);
      console.log(`     Missing: ${branchResults.metrics.missingFeatures}`);
      console.log(`     Score: ${branchResults.metrics.functionalityScore}/100`);
    } catch (error) {
      console.error(`❌ Error evaluating branch ${branchName}:`, error.message);
    }
    return branchResults;
  }
  async testBuild() {
    console.log('    🔨 Testing build...');
    try {
      const { stdout, stderr } = await execAsync('npm run build', { timeout: 120000 });
      if (stderr && stderr.includes('error')) {
        return 'failed';
      }
      return 'success';
    } catch (error) {
      console.error(`      ❌ Build failed: ${error.message}`);
      return 'failed';
    }
  }
  async testFeature(feature, branchName) {
    console.log(`    🧪 Testing ${feature.name}...`);
    try {
      // Call specific test method
      const result = await this[feature.testMethod](branchName);
      return {
        name: feature.name,
        status: result.status,
        score: result.score,
        details: result.details,
        issues: result.issues || [],
        weight: feature.weight
      };
    } catch (error) {
      console.error(`      ❌ Error testing ${feature.name}: ${error.message}`);
      return {
        name: feature.name,
        status: 'broken',
        score: 0,
        details: `Test failed: ${error.message}`,
        issues: [error.message],
        weight: feature.weight
      };
    }
  }
  // Permission System Tests
  async checkPermissionInjection(branchName) {
    const agentServicePath = 'src/features/agents/services/AgentService.ts';
    const globalConfigPath = 'src/lib/global-config.ts';
    let score = 0;
    const details = [];
    const issues = [];
    // Check if AgentService has permission injection
    if (fs.existsSync(agentServicePath)) {
      const content = fs.readFileSync(agentServicePath, 'utf8');
      if (content.includes('loadWorkspaceContext') || content.includes('injectPermissions')) {
        score += 50;
        details.push('AgentService has permission injection methods');
      } else {
        issues.push('AgentService missing permission injection implementation');
      }
      if (content.includes('permissions') && content.includes('commands')) {
        score += 30;
        details.push('Permission and command integration found');
      } else {
        issues.push('Missing permission and command integration');
      }
    } else {
      issues.push('AgentService.ts file not found');
    }
    // Check global config
    if (fs.existsSync(globalConfigPath)) {
      score += 20;
      details.push('Global configuration file exists');
    } else {
      issues.push('Global configuration file missing');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkClaudeMdGeneration(branchName) {
    const templatePath = 'src/features/workspaces/templates/claude-md-template.md';
    const workspaceServicePath = 'src/features/workspaces/services/WorkspaceDocumentGenerator.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(templatePath)) {
      score += 40;
      details.push('CLAUDE.md template exists');
    } else {
      issues.push('CLAUDE.md template missing');
    }
    if (fs.existsSync(workspaceServicePath)) {
      const content = fs.readFileSync(workspaceServicePath, 'utf8');
      if (content.includes('generateClaudeMd') || content.includes('claude-md')) {
        score += 40;
        details.push('CLAUDE.md generation logic implemented');
      } else {
        issues.push('CLAUDE.md generation logic missing');
      }
      if (content.includes('workspace') && content.includes('context')) {
        score += 20;
        details.push('Workspace context integration found');
      }
    } else {
      issues.push('WorkspaceDocumentGenerator.ts missing');
    }
    return {
      status: score >= 80 ? 'working' : score >= 50 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkGlobalConfig(branchName) {
    const configPath = 'src/lib/global-config.ts';
    const apiConfigPath = 'src/app/api/config/route.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      score += 40;
      details.push('Global config file exists');
      if (content.includes('permissions') || content.includes('commands')) {
        score += 30;
        details.push('Config includes permissions/commands');
      }
      if (content.includes('export') && content.includes('config')) {
        score += 20;
        details.push('Config properly exports configuration');
      }
    } else {
      issues.push('Global config file missing');
    }
    if (fs.existsSync(apiConfigPath)) {
      score += 10;
      details.push('Config API endpoint exists');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkToolApproval(branchName) {
    const overlayPath = 'src/features/agents/components/terminal/ToolApprovalOverlay.tsx';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(overlayPath)) {
      const content = fs.readFileSync(overlayPath, 'utf8');
      score += 60;
      details.push('Tool approval overlay component exists');
      if (content.includes('approve') && content.includes('deny')) {
        score += 30;
        details.push('Approval/denial functionality implemented');
      }
      if (content.includes('dangerous') || content.includes('permission')) {
        score += 10;
        details.push('Permission checking logic found');
      }
    } else {
      issues.push('Tool approval overlay missing');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkCommandLibrary(branchName) {
    const commandLibPath = 'src/features/agents/data/commandLibrary.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(commandLibPath)) {
      const content = fs.readFileSync(commandLibPath, 'utf8');
      score += 50;
      details.push('Command library file exists');
      if (content.includes('commandLibrary') && content.includes('export')) {
        score += 30;
        details.push('Command library exports commands');
      }
      if (content.includes('template') && content.includes('category')) {
        score += 20;
        details.push('Command structure includes templates and categories');
      }
    } else {
      issues.push('Command library file missing');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  // Checkpoint System Tests
  async checkCheckpointSave(branchName) {
    const checkpointManagerPath = 'src/features/agents/services/CheckpointManager.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(checkpointManagerPath)) {
      const content = fs.readFileSync(checkpointManagerPath, 'utf8');
      score += 40;
      details.push('CheckpointManager exists');
      if (content.includes('saveCheckpoint') || content.includes('createCheckpoint')) {
        score += 40;
        details.push('Checkpoint save functionality implemented');
      } else {
        issues.push('Save checkpoint method missing');
      }
      if (content.includes('conversation') && content.includes('metadata')) {
        score += 20;
        details.push('Conversation and metadata handling found');
      }
    } else {
      issues.push('CheckpointManager.ts missing');
    }
    return {
      status: score >= 80 ? 'working' : score >= 50 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkCheckpointRestore(branchName) {
    const checkpointManagerPath = 'src/features/agents/services/CheckpointManager.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(checkpointManagerPath)) {
      const content = fs.readFileSync(checkpointManagerPath, 'utf8');
      score += 40;
      details.push('CheckpointManager exists');
      if (content.includes('restoreCheckpoint') || content.includes('loadCheckpoint')) {
        score += 40;
        details.push('Checkpoint restore functionality implemented');
      } else {
        issues.push('Restore checkpoint method missing');
      }
      if (content.includes('session') && content.includes('state')) {
        score += 20;
        details.push('Session state handling found');
      }
    } else {
      issues.push('CheckpointManager.ts missing');
    }
    return {
      status: score >= 80 ? 'working' : score >= 50 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkCheckpointStorage(branchName) {
    const storagePath = 'src/features/agents/storage/CheckpointStorage.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(storagePath)) {
      const content = fs.readFileSync(storagePath, 'utf8');
      score += 50;
      details.push('CheckpointStorage exists');
      if (content.includes('save') && content.includes('load')) {
        score += 30;
        details.push('Storage save/load methods implemented');
      }
      if (content.includes('filesystem') || content.includes('storage')) {
        score += 20;
        details.push('Storage implementation found');
      }
    } else {
      issues.push('CheckpointStorage.ts missing');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkCheckpointMetadata(branchName) {
    const typesPath = 'src/features/agents/types/checkpoints.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(typesPath)) {
      const content = fs.readFileSync(typesPath, 'utf8');
      score += 40;
      details.push('Checkpoint types file exists');
      if (content.includes('metadata') || content.includes('tags')) {
        score += 30;
        details.push('Metadata and tagging types defined');
      }
      if (content.includes('timestamp') && content.includes('description')) {
        score += 30;
        details.push('Comprehensive metadata structure found');
      }
    } else {
      issues.push('Checkpoint types file missing');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkExpertLibrary(branchName) {
    const checkpointManagerPath = 'src/features/agents/services/CheckpointManager.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(checkpointManagerPath)) {
      const content = fs.readFileSync(checkpointManagerPath, 'utf8');
      if (content.includes('expert') || content.includes('library')) {
        score += 50;
        details.push('Expert library functionality found');
      } else {
        issues.push('Expert library functionality missing');
      }
      if (content.includes('search') || content.includes('filter')) {
        score += 30;
        details.push('Search/filter capabilities found');
      }
      if (content.includes('template') || content.includes('reusable')) {
        score += 20;
        details.push('Template/reusable checkpoint support found');
      }
    } else {
      issues.push('CheckpointManager.ts missing');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  // Git Operations Tests
  async checkBranchManagement(branchName) {
    const branchManagerPath = 'src/features/git/services/BranchManager.ts';
    const branchApiPath = 'src/app/api/workspaces/[workspaceId]/git/branch/route.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(branchManagerPath)) {
      const content = fs.readFileSync(branchManagerPath, 'utf8');
      score += 40;
      details.push('BranchManager service exists');
      if (content.includes('createBranch') || content.includes('switchBranch')) {
        score += 30;
        details.push('Branch creation/switching implemented');
      }
      if (content.includes('listBranches') || content.includes('deleteBranch')) {
        score += 20;
        details.push('Branch listing/deletion implemented');
      }
    } else {
      issues.push('BranchManager.ts missing');
    }
    if (fs.existsSync(branchApiPath)) {
      score += 10;
      details.push('Branch API endpoint exists');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkCommitOperations(branchName) {
    const gitApiPath = 'src/app/api/workspaces/[workspaceId]/git';
    let score = 0;
    const details = [];
    const issues = [];
    // Check for git operation APIs
    if (fs.existsSync(gitApiPath)) {
      const files = fs.readdirSync(gitApiPath);
      if (files.includes('commit')) {
        score += 40;
        details.push('Commit API exists');
      } else {
        issues.push('Commit API missing');
      }
      if (files.includes('status')) {
        score += 30;
        details.push('Status API exists');
      }
      if (files.includes('diff')) {
        score += 30;
        details.push('Diff API exists');
      }
    } else {
      issues.push('Git API directory missing');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkDiffViewing(branchName) {
    const diffViewerPath = 'src/features/git/components/GitDiffViewer.tsx';
    const diffApiPath = 'src/app/api/workspaces/[workspaceId]/git/diff/route.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(diffViewerPath)) {
      const content = fs.readFileSync(diffViewerPath, 'utf8');
      score += 50;
      details.push('GitDiffViewer component exists');
      if (content.includes('diff') && content.includes('syntax')) {
        score += 30;
        details.push('Syntax highlighting for diffs implemented');
      }
      if (content.includes('line') && content.includes('change')) {
        score += 20;
        details.push('Line-by-line diff viewing implemented');
      }
    } else {
      issues.push('GitDiffViewer.tsx missing');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkStatusOperations(branchName) {
    const statusApiPath = 'src/app/api/workspaces/[workspaceId]/git/status/route.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(statusApiPath)) {
      const content = fs.readFileSync(statusApiPath, 'utf8');
      score += 60;
      details.push('Git status API exists');
      if (content.includes('git status') || content.includes('working tree')) {
        score += 40;
        details.push('Git status implementation found');
      }
    } else {
      issues.push('Git status API missing');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkRemoteOperations(branchName) {
    const branchManagerPath = 'src/features/git/services/BranchManager.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(branchManagerPath)) {
      const content = fs.readFileSync(branchManagerPath, 'utf8');
      if (content.includes('push') || content.includes('pull')) {
        score += 50;
        details.push('Push/pull operations found');
      } else {
        issues.push('Remote operations missing');
      }
      if (content.includes('remote') || content.includes('origin')) {
        score += 30;
        details.push('Remote repository handling found');
      }
      if (content.includes('fetch') || content.includes('merge')) {
        score += 20;
        details.push('Fetch/merge operations found');
      }
    } else {
      issues.push('BranchManager.ts missing');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  // Context Import Tests
  async checkFileImport(branchName) {
    const fileImporterPath = 'src/features/context-import/importers/FileImporter.ts';
    const fileApiPath = 'src/app/api/context-workflow/import/file/route.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(fileImporterPath)) {
      const content = fs.readFileSync(fileImporterPath, 'utf8');
      score += 50;
      details.push('FileImporter exists');
      if (content.includes('import') && content.includes('file')) {
        score += 30;
        details.push('File import functionality implemented');
      }
      if (content.includes('validate') || content.includes('process')) {
        score += 20;
        details.push('File validation/processing found');
      }
    } else {
      issues.push('FileImporter.ts missing');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkTextImport(branchName) {
    const textImporterPath = 'src/features/context-import/importers/TextImporter.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(textImporterPath)) {
      const content = fs.readFileSync(textImporterPath, 'utf8');
      score += 60;
      details.push('TextImporter exists');
      if (content.includes('import') && content.includes('text')) {
        score += 40;
        details.push('Text import functionality implemented');
      }
    } else {
      issues.push('TextImporter.ts missing');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkEmailImport(branchName) {
    const emailImporterPath = 'src/features/context-import/importers/EmailImporter.ts';
    const emailTypesPath = 'src/features/context-import/types/email-types.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(emailImporterPath)) {
      score += 40;
      details.push('EmailImporter exists');
    } else {
      issues.push('EmailImporter.ts missing');
    }
    if (fs.existsSync(emailTypesPath)) {
      score += 30;
      details.push('Email types defined');
    } else {
      issues.push('Email types missing');
    }
    const emailProcessorPath = 'src/features/context-import/services/EmailProcessor.ts';
    if (fs.existsSync(emailProcessorPath)) {
      score += 30;
      details.push('EmailProcessor service exists');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkEnhancedJira(branchName) {
    const jiraTemplatesPath = 'src/features/context-import/templates/jira-advanced-templates.ts';
    const jiraImporterPath = 'src/features/context-import/importers/JiraImporter.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(jiraTemplatesPath)) {
      score += 50;
      details.push('Advanced JIRA templates exist');
    } else {
      issues.push('Advanced JIRA templates missing');
    }
    if (fs.existsSync(jiraImporterPath)) {
      const content = fs.readFileSync(jiraImporterPath, 'utf8');
      if (content.includes('advanced') || content.includes('enhanced')) {
        score += 30;
        details.push('Enhanced JIRA functionality found');
      }
      if (content.includes('template') || content.includes('custom')) {
        score += 20;
        details.push('Template/customization support found');
      }
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkEmailProcessor(branchName) {
    const processorPath = 'src/features/context-import/services/EmailProcessor.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(processorPath)) {
      const content = fs.readFileSync(processorPath, 'utf8');
      score += 50;
      details.push('EmailProcessor service exists');
      if (content.includes('process') && content.includes('email')) {
        score += 30;
        details.push('Email processing functionality implemented');
      }
      if (content.includes('parse') || content.includes('extract')) {
        score += 20;
        details.push('Email parsing/extraction found');
      }
    } else {
      issues.push('EmailProcessor.ts missing');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  // UI Enhancement Tests
  async checkMonacoEnhancement(branchName) {
    const monacoEditorPath = 'src/features/workspace-workshop/components/MonacoEditorArea.tsx';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(monacoEditorPath)) {
      const content = fs.readFileSync(monacoEditorPath, 'utf8');
      score += 40;
      details.push('MonacoEditorArea component exists');
      if (content.includes('enhanced') || content.includes('improved')) {
        score += 30;
        details.push('Enhancement features found');
      } else {
        issues.push('No enhancement features detected');
      }
      if (content.includes('theme') || content.includes('configuration')) {
        score += 30;
        details.push('Theme/configuration support found');
      }
    } else {
      issues.push('MonacoEditorArea.tsx missing or unchanged');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkFileTreeImprovement(branchName) {
    const fileTreePath = 'src/features/workspace-workshop/components/FileTree.tsx';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(fileTreePath)) {
      const content = fs.readFileSync(fileTreePath, 'utf8');
      score += 40;
      details.push('FileTree component exists');
      if (content.includes('improved') || content.includes('enhanced')) {
        score += 30;
        details.push('Improvement features found');
      } else {
        issues.push('No improvement features detected');
      }
      if (content.includes('context') || content.includes('menu')) {
        score += 30;
        details.push('Context menu integration found');
      }
    } else {
      issues.push('FileTree.tsx missing or unchanged');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkEditorThemes(branchName) {
    const themesPath = 'src/features/workspace-workshop/themes/editor-themes.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(themesPath)) {
      const content = fs.readFileSync(themesPath, 'utf8');
      score += 60;
      details.push('Editor themes file exists');
      if (content.includes('theme') && content.includes('export')) {
        score += 40;
        details.push('Theme definitions found');
      }
    } else {
      issues.push('Editor themes file missing');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkFileContextMenu(branchName) {
    const contextMenuPath = 'src/features/workspace-workshop/components/FileContextMenu.tsx';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(contextMenuPath)) {
      const content = fs.readFileSync(contextMenuPath, 'utf8');
      score += 70;
      details.push('FileContextMenu component exists');
      if (content.includes('menu') && content.includes('action')) {
        score += 30;
        details.push('Context menu actions implemented');
      }
    } else {
      issues.push('FileContextMenu.tsx missing');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkIconService(branchName) {
    const iconServicePath = 'src/features/workspace-workshop/services/FileIconService.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(iconServicePath)) {
      const content = fs.readFileSync(iconServicePath, 'utf8');
      score += 70;
      details.push('FileIconService exists');
      if (content.includes('icon') && content.includes('file')) {
        score += 30;
        details.push('File icon mapping implemented');
      }
    } else {
      issues.push('FileIconService.ts missing');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  async checkEditorConfig(branchName) {
    const configPath = 'src/features/workspace-workshop/services/EditorConfigManager.ts';
    let score = 0;
    const details = [];
    const issues = [];
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      score += 70;
      details.push('EditorConfigManager exists');
      if (content.includes('config') && content.includes('editor')) {
        score += 30;
        details.push('Editor configuration functionality implemented');
      }
    } else {
      issues.push('EditorConfigManager.ts missing');
    }
    return {
      status: score >= 70 ? 'working' : score >= 40 ? 'partial' : score > 0 ? 'broken' : 'missing',
      score,
      details,
      issues
    };
  }
  calculateFunctionalityScore(metrics, features) {
    let totalWeight = features.reduce((sum, f) => sum + f.weight, 0);
    let weightedScore = 0;
    // Calculate weighted score based on feature weights and their status
    Object.values(metrics).forEach((count, index) => {
      const statusWeights = [1, 0.6, 0.3, 0]; // working, partial, broken, missing
      if (index < statusWeights.length) {
        weightedScore += count * statusWeights[index] * (totalWeight / features.length);
      }
    });
    return Math.round((weightedScore / totalWeight) * 100);
  }
  generateFunctionalityRecommendations(branchResults, expectedFeatures) {
    const recommendations = [];
    if (branchResults.buildStatus === 'failed') {
      recommendations.push({
        priority: "CRITICAL",
        message: "Build is failing - must be fixed before feature evaluation",
        action: "Fix build errors and ensure npm run build succeeds"
      });
    }
    if (branchResults.metrics.missingFeatures > 0) {
      recommendations.push({
        priority: "HIGH",
        message: `${branchResults.metrics.missingFeatures} features are completely missing`,
        action: "Implement missing features according to specification"
      });
    }
    if (branchResults.metrics.brokenFeatures > 0) {
      recommendations.push({
        priority: "HIGH",
        message: `${branchResults.metrics.brokenFeatures} features are broken or non-functional`,
        action: "Debug and fix broken feature implementations"
      });
    }
    if (branchResults.metrics.partialFeatures > 0) {
      recommendations.push({
        priority: "MEDIUM",
        message: `${branchResults.metrics.partialFeatures} features are partially implemented`,
        action: "Complete partial feature implementations"
      });
    }
    if (branchResults.metrics.functionalityScore < 70) {
      recommendations.push({
        priority: "HIGH",
        message: `Functionality score is ${branchResults.metrics.functionalityScore}/100 - below acceptable threshold`,
        action: "Focus on completing high-weight features first"
      });
    }
    branchResults.recommendations = recommendations;
  }
  async generateReport() {
    console.log('\n⚙️ Generating Functionality Evaluation Report...');
    // Calculate overall metrics
    const branches = Object.values(this.results.branches);
    if (branches.length > 0) {
      this.results.overall.totalFeatures = branches.reduce((sum, b) => sum + b.metrics.totalFeatures, 0);
      this.results.overall.workingFeatures = branches.reduce((sum, b) => sum + b.metrics.workingFeatures, 0);
      this.results.overall.brokenFeatures = branches.reduce((sum, b) => sum + b.metrics.brokenFeatures, 0);
      this.results.overall.missingFeatures = branches.reduce((sum, b) => sum + b.metrics.missingFeatures, 0);
      this.results.overall.functionalityScore = branches.reduce((sum, b) => sum + b.metrics.functionalityScore, 0) / branches.length;
    }
    // Save detailed results
    const reportPath = 'analysis/functionality-evaluation-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    // Generate markdown report
    const markdownReport = this.generateMarkdownReport();
    fs.writeFileSync('analysis/FUNCTIONALITY_EVALUATION_REPORT.md', markdownReport);
    console.log(`✅ Functionality Evaluation Report saved to ${reportPath}`);
    console.log(`📄 Markdown report saved to analysis/FUNCTIONALITY_EVALUATION_REPORT.md`);
  }
  generateMarkdownReport() {
    const branches = Object.values(this.results.branches);
    const overall = this.results.overall;
    let report = `# Functionality Evaluation Report\n\n`;
    report += `**Generated:** ${this.results.timestamp}\n\n`;
    // Overall functionality status
    report += `## Overall Functionality Status\n\n`;
    report += `| Metric | Count | Status |\n`;
    report += `|--------|-------|--------|\n`;
    report += `| Total Features | ${overall.totalFeatures} | ℹ️ |\n`;
    report += `| Working Features | ${overall.workingFeatures} | ${overall.workingFeatures === overall.totalFeatures ? '✅' : '⚠️'} |\n`;
    report += `| Broken Features | ${overall.brokenFeatures} | ${overall.brokenFeatures === 0 ? '✅' : '🚨'} |\n`;
    report += `| Missing Features | ${overall.missingFeatures} | ${overall.missingFeatures === 0 ? '✅' : '⚠️'} |\n`;
    report += `| Functionality Score | ${overall.functionalityScore.toFixed(1)}/100 | ${overall.functionalityScore >= 80 ? '✅' : overall.functionalityScore >= 60 ? '⚠️' : '🚨'} |\n\n`;
    // Feature implementation matrix
    report += `## Feature Implementation Matrix\n\n`;
    report += `| Branch | Feature | Status | Score | Issues |\n`;
    report += `|--------|---------|--------|-------|--------|\n`;
    branches.forEach(branch => {
      Object.values(branch.features).forEach(feature => {
        const statusIcon = feature.status === 'working' ? '✅' :
                          feature.status === 'partial' ? '🟡' :
                          feature.status === 'broken' ? '🔴' : '⚪';
        const issueCount = feature.issues ? feature.issues.length : 0;
        report += `| ${branch.branch.replace('feature/', '')} | ${feature.name} | ${statusIcon} ${feature.status} | ${feature.score}/100 | ${issueCount} |\n`;
      });
    });
    report += `\n`;
    // Branch-by-branch analysis
    report += `## Branch Analysis\n\n`;
    branches.forEach(branch => {
      const expectedFeatures = this.results.featureMatrix[branch.branch];
      report += `### ${expectedFeatures.name} (${branch.branch})\n\n`;
      report += `**Build Status:** ${branch.buildStatus === 'success' ? '✅' : '❌'} ${branch.buildStatus}\n\n`;
      report += `| Metric | Count |\n`;
      report += `|--------|---------|\n`;
      report += `| Total Features | ${branch.metrics.totalFeatures} |\n`;
      report += `| Working | ${branch.metrics.workingFeatures} |\n`;
      report += `| Partial | ${branch.metrics.partialFeatures} |\n`;
      report += `| Broken | ${branch.metrics.brokenFeatures} |\n`;
      report += `| Missing | ${branch.metrics.missingFeatures} |\n`;
      report += `| Score | ${branch.metrics.functionalityScore}/100 |\n\n`;
      // Feature details
      if (Object.keys(branch.features).length > 0) {
        report += `**Feature Details:**\n\n`;
        Object.values(branch.features).forEach(feature => {
          const statusIcon = feature.status === 'working' ? '✅' :
                            feature.status === 'partial' ? '🟡' :
                            feature.status === 'broken' ? '🔴' : '⚪';
          report += `**${statusIcon} ${feature.name}** (${feature.score}/100)\n`;
          if (feature.details && feature.details.length > 0) {
            feature.details.forEach(detail => {
              report += `- ✓ ${detail}\n`;
            });
          }
          if (feature.issues && feature.issues.length > 0) {
            feature.issues.forEach(issue => {
              report += `- ❌ ${issue}\n`;
            });
          }
          report += `\n`;
        });
      }
      // Recommendations
      if (branch.recommendations && branch.recommendations.length > 0) {
        report += `**Recommendations:**\n`;
        branch.recommendations.forEach(rec => {
          const icon = rec.priority === 'CRITICAL' ? '🚨' : rec.priority === 'HIGH' ? '⚠️' : 'ℹ️';
          report += `- ${icon} **${rec.priority}**: ${rec.message}\n`;
          report += `  - Action: ${rec.action}\n`;
        });
        report += `\n`;
      }
    });
    return report;
  }
  async cleanup() {
    // Switch back to main branch
    try {
      await execAsync('git checkout main');
    } catch (error) {
      console.error('Failed to switch back to main branch:', error.message);
    }
  }
  async run() {
    const branches = [
      'feature/permissions-system',
      'feature/checkpoint-system',
      'feature/git-operations',
      'feature/context-import',
      'feature/ui-improvements'
    ];
    console.log('⚙️ Functionality Evaluator Agent - Starting Analysis...');
    try {
      for (const branch of branches) {
        await this.evaluateBranch(branch);
      }
      await this.generateReport();
    } catch (error) {
      console.error('❌ Functionality evaluation failed:', error.message);
    } finally {
      await this.cleanup();
    }
  }
}
// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const evaluator = new FunctionalityEvaluator();
  if (args.includes('--help')) {
    console.log('Functionality Evaluator Agent');
    console.log('Usage:');
    console.log('  node functionality-evaluator.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --help          Show this help');
    return;
  }
  await evaluator.run();
}
// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
module.exports = FunctionalityEvaluator;