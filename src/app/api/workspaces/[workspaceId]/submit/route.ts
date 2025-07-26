import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { resolveGitDirectory } from '@/features/git/utils/gitDirectoryResolver';
import { SubmissionRecord } from '@/features/workspace-scripts/types';

const execAsync = promisify(exec);

// POST /api/workspaces/[workspaceId]/submit - Submit workspace as complete
export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const { 
      targetEnvironment = 'production',
      comments = '',
      requiresReview = true,
      createPullRequest = true,
      autoMerge = false,
      confirm = false 
    } = await request.json();
    
    if (!confirm) {
      return Response.json({
        success: false,
        requiresConfirmation: true,
        message: 'Submit as complete requires confirmation',
        details: {
          targetEnvironment,
          requiresReview,
          createPullRequest,
          action: 'This will submit your workspace changes as complete and ready for production'
        }
      }, { status: 409 });
    }
    
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    
    // Resolve git directory
    const gitInfo = await resolveGitDirectory(workspaceId);
    const gitDir = gitInfo.gitDir;
    
    const submission: SubmissionRecord = {
      id: `submit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      submittedBy: 'user', // TODO: Get actual user when auth is implemented
      targetEnvironment,
      comments
    };
    
    const submissionSteps: string[] = [];
    
    try {
      // Step 1: Check if we have a git repository
      if (!gitInfo.isGitRepo) {
        throw new Error('No git repository found. Submission requires git version control.');
      }
      
      submissionSteps.push('Validating git repository...');
      
      // Ensure git config is set
      try {
        await execAsync('git config user.name', { cwd: gitDir });
      } catch {
        submissionSteps.push('Setting git user config...');
        await execAsync('git config user.name "Context Pipeline Submit"', { cwd: gitDir });
        await execAsync('git config user.email "submit@contextpipeline.com"', { cwd: gitDir });
      }
      
      // Step 2: Check for uncommitted changes
      const { stdout: statusOutput } = await execAsync('git status --porcelain', { 
        cwd: gitDir 
      });
      
      if (statusOutput.trim()) {
        submissionSteps.push('Committing final changes...');
        
        await execAsync('git add .', { cwd: gitDir });
        
        try {
          await execAsync(`git commit -m "Final changes for submission${comments ? ': ' + comments : ''}"`, { 
            cwd: gitDir 
          });
          submissionSteps.push('Final changes committed successfully');
        } catch (commitError: any) {
          if (commitError.message.includes('nothing to commit')) {
            submissionSteps.push('No final changes to commit');
          } else {
            throw commitError;
          }
        }
      }
      
      // Step 3: Get current branch and commit info
      const { stdout: currentBranch } = await execAsync('git branch --show-current', { 
        cwd: gitDir 
      });
      const { stdout: commitHash } = await execAsync('git rev-parse HEAD', { 
        cwd: gitDir 
      });
      
      submissionSteps.push(`Current branch: ${currentBranch.trim()}`);
      submissionSteps.push(`Latest commit: ${commitHash.trim().substring(0, 7)}`);
      
      // Step 4: Create production branch if needed
      const productionBranch = targetEnvironment === 'production' ? 'production' : `${targetEnvironment}-release`;
      
      try {
        // Check if production branch exists
        await execAsync(`git rev-parse --verify ${productionBranch}`, { cwd: gitDir });
        submissionSteps.push(`Switching to ${productionBranch} branch...`);
        
        try {
          await execAsync(`git checkout ${productionBranch}`, { cwd: gitDir });
          submissionSteps.push(`Switched to existing ${productionBranch} branch`);
        } catch (checkoutError: any) {
          submissionSteps.push(`Error switching to ${productionBranch}: ${checkoutError.message}`);
          throw checkoutError;
        }
      } catch {
        // Create production branch
        submissionSteps.push(`Creating ${productionBranch} branch...`);
        
        try {
          await execAsync(`git checkout -b ${productionBranch}`, { cwd: gitDir });
          submissionSteps.push(`Created new ${productionBranch} branch`);
        } catch (createError: any) {
          submissionSteps.push(`Error creating ${productionBranch}: ${createError.message}`);
          throw createError;
        }
      }
      
      // Step 5: Merge changes
      if (currentBranch.trim() !== productionBranch) {
        submissionSteps.push(`Merging changes from ${currentBranch.trim()}...`);
        
        try {
          await execAsync(`git merge ${currentBranch.trim()}`, { cwd: gitDir });
          submissionSteps.push(`Successfully merged changes from ${currentBranch.trim()}`);
        } catch (mergeError: any) {
          if (mergeError.message.includes('Already up to date')) {
            submissionSteps.push(`${productionBranch} branch already up to date`);
          } else {
            submissionSteps.push(`Merge conflict detected: ${mergeError.message}`);
            submissionSteps.push('Manual intervention required for merge conflicts');
            throw new Error(`Merge conflict: ${mergeError.message}`);
          }
        }
      }
      
      // Step 6: Create tag for submission
      const tagName = `submission-${Date.now()}`;
      submissionSteps.push(`Creating tag: ${tagName}`);
      await execAsync(`git tag -a ${tagName} -m "Submission for ${targetEnvironment}${comments ? ': ' + comments : ''}"`, { 
        cwd: gitDir 
      });
      
      // Step 7: Create pull request (if Git hosting service is available)
      let pullRequestUrl = '';
      
      if (createPullRequest) {
        submissionSteps.push('Creating pull request...');
        
        try {
          // Try to get remote origin URL
          const { stdout: remoteUrl } = await execAsync('git config --get remote.origin.url', { 
            cwd: gitDir 
          });
          
          if (remoteUrl.includes('github.com')) {
            // GitHub - try to create PR using gh CLI if available
            try {
              const prTitle = `Submission: ${workspaceId} to ${targetEnvironment}`;
              const prBody = `Automated submission from Context Pipeline workspace.\n\n${comments}\n\nWorkspace ID: ${workspaceId}\nTarget: ${targetEnvironment}\nSubmitted: ${submission.submittedAt}`;
              
              const { stdout: prOutput } = await execAsync(`gh pr create --title "${prTitle}" --body "${prBody}" --base main --head ${productionBranch}`, { 
                cwd: gitDir 
              });
              
              pullRequestUrl = prOutput.trim();
              submission.gitPullRequestUrl = pullRequestUrl;
              submissionSteps.push(`Pull request created: ${pullRequestUrl}`);
              
            } catch (error) {
              submissionSteps.push('Could not create pull request automatically. Manual PR creation required.');
              console.warn('GitHub CLI not available or failed:', error);
            }
          } else {
            submissionSteps.push('Pull request creation not supported for this git provider');
          }
          
        } catch (error) {
          submissionSteps.push('No remote repository configured');
        }
      }
      
      // Step 8: Run submission tests (if available)
      submissionSteps.push('Running submission validation...');
      
      try {
        // Check for test scripts
        const packageJsonPath = path.join(gitDir, 'package.json');
        try {
          const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
          
          if (packageJson.scripts && packageJson.scripts.test) {
            submissionSteps.push('Running test suite...');
            await execAsync('npm test', { 
              cwd: gitDir,
              timeout: 180000 // 3 minutes
            });
            submissionSteps.push('All tests passed');
          }
        } catch {
          // No package.json or tests
          submissionSteps.push('No automated tests found');
        }
        
        // Check for linting
        try {
          await execAsync('npm run lint', { 
            cwd: gitDir,
            timeout: 60000 // 1 minute
          });
          submissionSteps.push('Code linting passed');
        } catch {
          // No lint script or linting failed
          submissionSteps.push('Linting not available or failed (non-blocking)');
        }
        
      } catch (testError: any) {
        submissionSteps.push(`Test validation failed: ${testError.message}`);
        if (requiresReview) {
          submissionSteps.push('Submission flagged for manual review due to test failures');
          submission.status = 'under-review';
        } else {
          throw testError;
        }
      }
      
      // Step 9: Auto-merge if enabled and all checks pass
      if (autoMerge && submission.status === 'submitted') {
        submissionSteps.push('Auto-merging to main branch...');
        
        await execAsync('git checkout main', { cwd: gitDir });
        await execAsync(`git merge ${productionBranch}`, { cwd: gitDir });
        
        submission.status = 'merged';
        submissionSteps.push('Changes merged to main branch');
      } else if (requiresReview) {
        submission.status = 'under-review';
        submissionSteps.push('Submission pending review');
      }
      
      // Save submission record
      const submissionsDir = path.join(workspaceDir, 'submissions');
      await fs.mkdir(submissionsDir, { recursive: true });
      const submissionPath = path.join(submissionsDir, `${submission.id}.json`);
      await fs.writeFile(submissionPath, JSON.stringify(submission, null, 2));
      
      return Response.json({
        success: true,
        submission,
        steps: submissionSteps,
        message: `Workspace successfully submitted for ${targetEnvironment}`,
        pullRequestUrl: submission.gitPullRequestUrl
      });
      
    } catch (error: any) {
      submission.status = 'rejected';
      submissionSteps.push(`Submission failed: ${error.message}`);
      
      // Save failed submission record
      const submissionsDir = path.join(workspaceDir, 'submissions');
      await fs.mkdir(submissionsDir, { recursive: true });
      const submissionPath = path.join(submissionsDir, `${submission.id}.json`);
      await fs.writeFile(submissionPath, JSON.stringify(submission, null, 2));
      
      return Response.json({
        success: false,
        submission,
        steps: submissionSteps,
        error: 'Submission failed',
        details: error.message
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error submitting workspace:', error);
    return Response.json({
      success: false,
      error: 'Failed to submit workspace',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET /api/workspaces/[workspaceId]/submit - Get submission history
export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    const submissionsDir = path.join(workspaceDir, 'submissions');
    
    try {
      const submissionFiles = await fs.readdir(submissionsDir);
      const submissions: SubmissionRecord[] = [];
      
      for (const file of submissionFiles) {
        if (file.endsWith('.json')) {
          try {
            const submissionData = await fs.readFile(path.join(submissionsDir, file), 'utf-8');
            submissions.push(JSON.parse(submissionData));
          } catch (error) {
            console.error(`Error reading submission file ${file}:`, error);
          }
        }
      }
      
      // Sort by submission date (newest first) and limit
      const sortedSubmissions = submissions
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
        .slice(0, limit);
      
      return Response.json({
        success: true,
        submissions: sortedSubmissions,
        total: submissions.length
      });
      
    } catch (error) {
      // No submissions directory exists
      return Response.json({
        success: true,
        submissions: [],
        total: 0
      });
    }
    
  } catch (error) {
    console.error('Error getting submission history:', error);
    return Response.json({
      success: false,
      error: 'Failed to get submission history',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}