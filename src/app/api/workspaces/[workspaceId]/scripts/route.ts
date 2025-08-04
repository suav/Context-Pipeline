import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { WorkspaceScriptConfig, WorkspaceScript, ScriptExecution } from '@/features/workspace-scripts/types';

const execAsync = promisify(exec);

// Default workspace script configuration
const DEFAULT_SCRIPT_CONFIG: WorkspaceScriptConfig = {
  workspaceId: '',
  scripts: [
    {
      id: 'deploy-test',
      name: 'Deploy to Test',
      description: 'Deploy current workspace to test environment',
      command: 'npm run deploy:test',
      type: 'deploy',
      environment: 'staging',
      requiresConfirmation: true,
      estimatedDuration: 120
    },
    {
      id: 'submit-complete',
      name: 'Submit as Complete',
      description: 'Submit workspace changes as complete and ready for production',
      command: 'npm run submit:complete',
      type: 'submit',
      environment: 'production',
      requiresConfirmation: true,
      estimatedDuration: 60
    },
    {
      id: 'run-tests',
      name: 'Run Tests',
      description: 'Execute test suite for workspace',
      command: 'npm test',
      type: 'test',
      requiresConfirmation: false,
      estimatedDuration: 30
    },
    {
      id: 'build-project',
      name: 'Build Project',
      description: 'Build the project for deployment',
      command: 'npm run build',
      type: 'build',
      requiresConfirmation: false,
      estimatedDuration: 90
    }
  ],
  gitIntegration: {
    enabled: true,
    autoCommitBeforeDeploy: true,
    autoTagOnSubmit: true,
    targetBranch: 'main',
    testingBranch: 'testing',
    productionBranch: 'production'
  },
  deployProtocol: {
    enabled: true,
    testEnvironmentUrl: 'https://test.example.com',
    stagingEnvironmentUrl: 'https://staging.example.com',
    productionEnvironmentUrl: 'https://production.example.com',
    requiresApproval: false
  },
  submitProtocol: {
    enabled: true,
    requiresTesting: true,
    requiresReview: true,
    targetEnvironment: 'production'
  }
};

async function getWorkspaceScriptConfig(workspaceId: string): Promise<WorkspaceScriptConfig> {
  try {
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    const configPath = path.join(workspaceDir, 'workspace-scripts.json');
    
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      // Config doesn't exist, create default one
      const defaultConfig = { ...DEFAULT_SCRIPT_CONFIG, workspaceId };
      await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }
  } catch (error) {
    console.error('Error getting workspace script config:', error);
    return { ...DEFAULT_SCRIPT_CONFIG, workspaceId };
  }
}

async function saveWorkspaceScriptConfig(workspaceId: string, config: WorkspaceScriptConfig): Promise<void> {
  try {
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    const configPath = path.join(workspaceDir, 'workspace-scripts.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving workspace script config:', error);
    throw error;
  }
}

// GET /api/workspaces/[workspaceId]/scripts - Get workspace script configuration
export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const config = await getWorkspaceScriptConfig(workspaceId);
    
    return Response.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Error getting workspace scripts:', error);
    return Response.json({
      success: false,
      error: 'Failed to get workspace scripts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/workspaces/[workspaceId]/scripts - Update workspace script configuration
export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const updateData = await request.json();
    
    // Get current config
    const currentConfig = await getWorkspaceScriptConfig(workspaceId);
    
    // Merge with updates
    const updatedConfig: WorkspaceScriptConfig = {
      ...currentConfig,
      ...updateData,
      workspaceId // Ensure workspaceId is preserved
    };
    
    // Save updated config
    await saveWorkspaceScriptConfig(workspaceId, updatedConfig);
    
    return Response.json({
      success: true,
      config: updatedConfig,
      message: 'Workspace script configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating workspace scripts:', error);
    return Response.json({
      success: false,
      error: 'Failed to update workspace scripts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT /api/workspaces/[workspaceId]/scripts - Execute a workspace script
export async function PUT(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const { scriptId, confirm = false } = await request.json();
    
    if (!scriptId) {
      return Response.json({
        success: false,
        error: 'Script ID is required'
      }, { status: 400 });
    }
    
    const config = await getWorkspaceScriptConfig(workspaceId);
    const script = config.scripts.find(s => s.id === scriptId);
    
    if (!script) {
      return Response.json({
        success: false,
        error: 'Script not found'
      }, { status: 404 });
    }
    
    if (script.requiresConfirmation && !confirm) {
      return Response.json({
        success: false,
        requiresConfirmation: true,
        script: script,
        message: 'This script requires confirmation before execution'
      }, { status: 409 });
    }
    
    // Execute the script
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    const targetDir = path.join(workspaceDir, 'target');
    
    // Check if we should run in repo-clone directory for git repos
    let executionDir = targetDir;
    const repoCloneDir = path.join(targetDir, 'repo-clone');
    
    try {
      const repoCloneStats = await fs.stat(repoCloneDir);
      if (repoCloneStats.isDirectory()) {
        // Check if there's a single repo in repo-clone
        const repoCloneContents = await fs.readdir(repoCloneDir);
        if (repoCloneContents.length === 1) {
          const repoDir = path.join(repoCloneDir, repoCloneContents[0]);
          const repoStats = await fs.stat(repoDir);
          if (repoStats.isDirectory()) {
            executionDir = repoDir;
          }
        }
      }
    } catch {
      // repo-clone doesn't exist, use target
    }
    
    const execution: ScriptExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      scriptId: script.id,
      workspaceId,
      status: 'running',
      startedAt: new Date().toISOString(),
      output: [],
      triggeredBy: 'user' // TODO: Get actual user when auth is implemented
    };
    
    try {
      console.log(`Executing script "${script.name}" in directory: ${executionDir}`);
      console.log(`Command: ${script.command}`);
      
      const { stdout, stderr } = await execAsync(script.command, {
        cwd: executionDir,
        maxBuffer: 2 * 1024 * 1024, // 2MB buffer
        timeout: (script.estimatedDuration || 300) * 1000 // Convert to milliseconds
      });
      
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      execution.output = stdout.split('\n').filter(line => line.trim());
      execution.exitCode = 0;
      
      if (stderr.trim()) {
        execution.errorOutput = stderr.split('\n').filter(line => line.trim());
      }
      
      // Save execution record
      const executionsDir = path.join(workspaceDir, 'script-executions');
      await fs.mkdir(executionsDir, { recursive: true });
      const executionPath = path.join(executionsDir, `${execution.id}.json`);
      await fs.writeFile(executionPath, JSON.stringify(execution, null, 2));
      
      return Response.json({
        success: true,
        execution,
        message: `Script "${script.name}" executed successfully`
      });
      
    } catch (execError: any) {
      execution.status = 'failed';
      execution.completedAt = new Date().toISOString();
      execution.errorOutput = execError.message.split('\n').filter((line: string) => line.trim());
      execution.exitCode = execError.code || 1;
      
      // Save failed execution record
      const executionsDir = path.join(workspaceDir, 'script-executions');
      await fs.mkdir(executionsDir, { recursive: true });
      const executionPath = path.join(executionsDir, `${execution.id}.json`);
      await fs.writeFile(executionPath, JSON.stringify(execution, null, 2));
      
      return Response.json({
        success: false,
        execution,
        error: 'Script execution failed',
        details: execError.message
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error executing workspace script:', error);
    return Response.json({
      success: false,
      error: 'Failed to execute workspace script',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}