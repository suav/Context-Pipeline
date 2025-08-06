import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { resolveGitDirectory } from '@/features/git/utils/gitDirectoryResolver';
import { DeploymentRecord } from '@/features/workspace-scripts/types';

const execAsync = promisify(exec);

// POST /api/workspaces/[workspaceId]/deploy - Deploy to test environment
export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const { 
      environment = 'staging',
      autoCommit = true,
      commitMessage = 'Deploy to test environment',
      confirm = false 
    } = await request.json();
    
    if (!confirm) {
      return Response.json({
        success: false,
        requiresConfirmation: true,
        message: 'Deploy to test requires confirmation',
        details: {
          environment,
          autoCommit,
          action: 'This will deploy your current workspace changes to the test environment'
        }
      }, { status: 409 });
    }
    
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    
    // Resolve git directory
    const gitInfo = await resolveGitDirectory(workspaceId);
    const gitDir = gitInfo.gitDir;
    
    const deployment: DeploymentRecord = {
      id: `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      environment,
      status: 'pending',
      deployedAt: new Date().toISOString(),
      triggeredBy: 'user', // TODO: Get actual user when auth is implemented
      scriptExecutions: []
    };
    
    const deploymentSteps: string[] = [];
    
    try {
      // Step 1: Check git status if we have a git repo
      if (gitInfo.isGitRepo) {
        deploymentSteps.push('Checking git status...');
        
        // Ensure git config is set
        try {
          await execAsync('git config user.name', { cwd: gitDir });
        } catch {
          deploymentSteps.push('Setting git user config...');
          await execAsync('git config user.name "Context Pipeline Deploy"', { cwd: gitDir });
          await execAsync('git config user.email "deploy@contextpipeline.com"', { cwd: gitDir });
        }
        
        const { stdout: statusOutput } = await execAsync('git status --porcelain', { 
          cwd: gitDir 
        });
        
        // Step 2: Ensure ALL changes are staged and committed for deployment
        deploymentSteps.push('Preparing changes for deployment...');
        
        // Check what files need to be committed
        const { stdout: allChanges } = await execAsync('git status --porcelain', { cwd: gitDir });
        if (allChanges.trim()) {
          deploymentSteps.push(`Found changes to commit: ${allChanges.split('\n').length} files`);
        }
        
        // Always stage ALL changes (tracked, untracked, and modified)
        deploymentSteps.push('Staging ALL changes for deployment...');
        await execAsync('git add -A', { cwd: gitDir }); // -A stages everything including deletions
        
        // Verify staging worked
        const { stdout: stagedCheck } = await execAsync('git diff --cached --name-only', { cwd: gitDir });
        if (stagedCheck.trim()) {
          deploymentSteps.push(`Staged files: ${stagedCheck.split('\n').filter(f => f.trim()).length} files`);
        }
        
        // Always attempt to commit (this ensures we have a commit to push)
        deploymentSteps.push('Committing ALL staged changes for deployment...');
        let commitCreated = false;
        
        try {
          await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { 
            cwd: gitDir 
          });
          
          // Get the new commit hash
          const { stdout: commitHash } = await execAsync('git rev-parse HEAD', { 
            cwd: gitDir 
          });
          deployment.gitCommitHash = commitHash.trim();
          deploymentSteps.push(`✅ New commit created: ${deployment.gitCommitHash?.substring(0, 7)}`);
          commitCreated = true;
          
        } catch (commitError: any) {
          if (commitError.message.includes('nothing to commit')) {
            // No new changes, but get current commit for push
            deploymentSteps.push('No new changes to commit');
            try {
              const { stdout: currentCommitHash } = await execAsync('git rev-parse HEAD', { 
                cwd: gitDir 
              });
              deployment.gitCommitHash = currentCommitHash.trim();
              deploymentSteps.push(`Using existing commit: ${deployment.gitCommitHash?.substring(0, 7)}`);
            } catch (error) {
              throw new Error('Could not get current commit hash for deployment');
            }
          } else {
            throw new Error(`Commit failed: ${commitError.message}`);
          }
        }
        
        // Ensure we have a commit hash before proceeding
        if (!deployment.gitCommitHash) {
          throw new Error('No commit available for deployment');
        }
        
        // Final verification: ensure working directory is clean before push
        const { stdout: finalStatus } = await execAsync('git status --porcelain', { cwd: gitDir });
        if (finalStatus.trim()) {
          deploymentSteps.push(`⚠️  Warning: Working directory not clean after commit!`);
          deploymentSteps.push(`Uncommitted files: ${finalStatus.trim()}`);
          // Try one more staging and commit
          await execAsync('git add -A', { cwd: gitDir });
          try {
            await execAsync(`git commit -m "${commitMessage} (cleanup)"`, { cwd: gitDir });
            deploymentSteps.push(`✅ Cleanup commit created`);
            const { stdout: newCommitHash } = await execAsync('git rev-parse HEAD', { cwd: gitDir });
            deployment.gitCommitHash = newCommitHash.trim();
          } catch (cleanupError) {
            deploymentSteps.push(`⚠️  Could not create cleanup commit: ${(cleanupError as Error).message}`);
          }
        } else {
          deploymentSteps.push(`✅ Working directory clean, ready for push`);
        }
        
        // Get current branch before switching
        try {
          const { stdout: currentBranch } = await execAsync('git branch --show-current', { 
            cwd: gitDir 
          });
          deployment.gitBranch = currentBranch.trim();
        } catch (branchError) {
          deploymentSteps.push('Warning: Could not determine current branch');
          deployment.gitBranch = 'unknown';
        }
        
        // Step 3: Push commit to remote (commit-push sequence)
        deploymentSteps.push(`Pushing commit ${deployment.gitCommitHash.substring(0, 7)} to remote...`);
        
        try {
            // Check if we have a remote
            const { stdout: remotes } = await execAsync('git remote', { cwd: gitDir });
            
            if (remotes.trim()) {
              const remoteName = remotes.split('\n')[0].trim(); // Use first remote
              const currentBranch = deployment.gitBranch || 'main';
              
              // Push current branch
              await execAsync(`git push ${remoteName} ${currentBranch}`, { cwd: gitDir });
              deploymentSteps.push(`Pushed ${currentBranch} to ${remoteName}`);
              
              // If environment is staging, also try to push to testing branch
              if (environment === 'staging') {
                try {
                  // Check if testing branch exists locally
                  const { stdout: localBranches } = await execAsync('git branch', { cwd: gitDir });
                  const hasLocalTesting = localBranches.includes('testing');
                  
                  if (!hasLocalTesting) {
                    // Create testing branch from current commit
                    await execAsync('git branch testing', { cwd: gitDir });
                    deploymentSteps.push('Created testing branch from current commit');
                  }
                  
                  // Push testing branch
                  await execAsync(`git push ${remoteName} testing`, { cwd: gitDir });
                  deploymentSteps.push(`Pushed testing branch to ${remoteName}`);
                  
                  // Testing branch pushed successfully
                } catch (testingError: any) {
                  deploymentSteps.push(`Warning: Could not push to testing branch: ${testingError.message}`);
                  // Continue with current branch
                }
              } else {
                // Using current branch for deployment
              }
            } else {
              deploymentSteps.push('Warning: No git remote configured, skipping push');
            }
          } catch (pushError: any) {
            if (pushError.message.includes('Authentication failed') || pushError.message.includes('Permission denied')) {
              deploymentSteps.push('Warning: Push failed due to authentication. Changes committed locally.');
            } else {
              deploymentSteps.push(`Warning: Push failed: ${pushError.message}`);
            }
          }
      }
      
      // Step 4: Run deployment script
      deploymentSteps.push('Running deployment script...');
      deployment.status = 'deploying';
      
      // Try to find and run deployment script
      const executionDir = gitInfo.isGitRepo ? gitDir : path.join(workspaceDir, 'target');
      
      let deployCommand = '';
      
      // Check for package.json and deploy script
      try {
        const packageJsonPath = path.join(executionDir, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        
        if (packageJson.scripts) {
          if (packageJson.scripts['deploy:test']) {
            deployCommand = 'npm run deploy:test';
          } else if (packageJson.scripts['deploy']) {
            deployCommand = 'npm run deploy';
          } else if (packageJson.scripts['build']) {
            deployCommand = 'npm run build';
          }
        }
      } catch {
        // No package.json, try other deployment methods
      }
      
      // Fallback deployment commands
      if (!deployCommand) {
        // Check for common deployment files
        const deployFiles = ['deploy.sh', 'deploy.js', 'Dockerfile', 'docker-compose.yml'];
        
        for (const file of deployFiles) {
          try {
            await fs.access(path.join(executionDir, file));
            switch (file) {
              case 'deploy.sh':
                deployCommand = './deploy.sh';
                break;
              case 'deploy.js':
                deployCommand = 'node deploy.js';
                break;
              case 'Dockerfile':
                deployCommand = 'docker build -t workspace-deploy .';
                break;
              case 'docker-compose.yml':
                deployCommand = 'docker-compose up -d';
                break;
            }
            break;
          } catch {
            // File doesn't exist, try next
          }
        }
      }
      
      if (!deployCommand) {
        // Default to build command if available
        deployCommand = 'echo "No deployment script found. Creating deployment placeholder..."';
      }
      
      console.log(`Executing deployment command: ${deployCommand}`);
      const { stdout: deployOutput, stderr: deployError } = await execAsync(deployCommand, {
        cwd: executionDir,
        maxBuffer: 2 * 1024 * 1024, // 2MB buffer
        timeout: 300000 // 5 minutes
      });
      
      deploymentSteps.push('Deployment script completed');
      
      if (deployError.trim()) {
        deploymentSteps.push(`Deployment warnings: ${deployError.trim()}`);
      }
      
      // Step 5: Generate deployment URL (placeholder)
      const deploymentUrl = `https://${environment}.example.com/workspaces/${workspaceId}`;
      deployment.deploymentUrl = deploymentUrl;
      deployment.status = 'deployed';
      
      deploymentSteps.push(`Deployed to: ${deploymentUrl}`);
      
      // Save deployment record
      const deploymentsDir = path.join(workspaceDir, 'deployments');
      await fs.mkdir(deploymentsDir, { recursive: true });
      const deploymentPath = path.join(deploymentsDir, `${deployment.id}.json`);
      await fs.writeFile(deploymentPath, JSON.stringify(deployment, null, 2));
      
      return Response.json({
        success: true,
        deployment,
        steps: deploymentSteps,
        message: `Successfully deployed to ${environment}`,
        deploymentUrl: deployment.deploymentUrl
      });
      
    } catch (error: any) {
      deployment.status = 'failed';
      deploymentSteps.push(`Deployment failed: ${error.message}`);
      
      // Save failed deployment record
      const deploymentsDir = path.join(workspaceDir, 'deployments');
      await fs.mkdir(deploymentsDir, { recursive: true });
      const deploymentPath = path.join(deploymentsDir, `${deployment.id}.json`);
      await fs.writeFile(deploymentPath, JSON.stringify(deployment, null, 2));
      
      return Response.json({
        success: false,
        deployment,
        steps: deploymentSteps,
        error: 'Deployment failed',
        details: error.message
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error deploying workspace:', error);
    return Response.json({
      success: false,
      error: 'Failed to deploy workspace',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET /api/workspaces/[workspaceId]/deploy - Get deployment history
export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    const deploymentsDir = path.join(workspaceDir, 'deployments');
    
    try {
      const deploymentFiles = await fs.readdir(deploymentsDir);
      const deployments: DeploymentRecord[] = [];
      
      for (const file of deploymentFiles) {
        if (file.endsWith('.json')) {
          try {
            const deploymentData = await fs.readFile(path.join(deploymentsDir, file), 'utf-8');
            deployments.push(JSON.parse(deploymentData));
          } catch (error) {
            console.error(`Error reading deployment file ${file}:`, error);
          }
        }
      }
      
      // Sort by deployment date (newest first) and limit
      const sortedDeployments = deployments
        .sort((a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime())
        .slice(0, limit);
      
      return Response.json({
        success: true,
        deployments: sortedDeployments,
        total: deployments.length
      });
      
    } catch (error) {
      // No deployments directory exists
      return Response.json({
        success: true,
        deployments: [],
        total: 0
      });
    }
    
  } catch (error) {
    console.error('Error getting deployment history:', error);
    return Response.json({
      success: false,
      error: 'Failed to get deployment history',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}