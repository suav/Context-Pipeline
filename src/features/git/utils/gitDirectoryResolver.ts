import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Resolves the correct git directory for a workspace
 * Priority order:
 * 1. repo-clone/<repo-name> - for imported writeable repositories
 * 2. target/ - for created/initialized repositories
 * 3. fallback to workspace root for backwards compatibility
 */
export async function resolveGitDirectory(workspaceId: string, repoName?: string): Promise<{
  gitDir: string;
  repoType: 'repo-clone' | 'target' | 'workspace-root';
  repoName?: string;
  isGitRepo: boolean;
}> {
  const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
  
  // Option 1: Check for specific repo in repo-clone
  if (repoName) {
    const repoCloneDir = path.join(workspaceDir, 'target', 'repo-clone', repoName);
    if (await isGitRepository(repoCloneDir)) {
      return {
        gitDir: repoCloneDir,
        repoType: 'repo-clone',
        repoName,
        isGitRepo: true
      };
    }
  }
  
  // Option 2: Check for any repo in repo-clone directory
  const repoCloneBaseDir = path.join(workspaceDir, 'target', 'repo-clone');
  try {
    const repoCloneDirs = await fs.readdir(repoCloneBaseDir);
    for (const dir of repoCloneDirs) {
      const potentialRepoDir = path.join(repoCloneBaseDir, dir);
      const stat = await fs.stat(potentialRepoDir);
      if (stat.isDirectory() && await isGitRepository(potentialRepoDir)) {
        return {
          gitDir: potentialRepoDir,
          repoType: 'repo-clone',
          repoName: dir,
          isGitRepo: true
        };
      }
    }
  } catch {
    // repo-clone directory doesn't exist or is empty
  }
  
  // Option 3: Check target directory
  const targetDir = path.join(workspaceDir, 'target');
  if (await isGitRepository(targetDir)) {
    return {
      gitDir: targetDir,
      repoType: 'target',
      isGitRepo: true
    };
  }
  
  // Option 4: Fallback to workspace root (backwards compatibility)
  if (await isGitRepository(workspaceDir)) {
    return {
      gitDir: workspaceDir,
      repoType: 'workspace-root',
      isGitRepo: true
    };
  }
  
  // Default: return target directory even if not a git repo (for initialization)
  return {
    gitDir: targetDir,
    repoType: 'target',
    isGitRepo: false
  };
}

/**
 * Get all git repositories in a workspace
 */
export async function getAllGitRepositories(workspaceId: string): Promise<Array<{
  gitDir: string;
  repoType: 'repo-clone' | 'target' | 'workspace-root';
  repoName?: string;
  isActive: boolean;
}>> {
  const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
  const repositories = [];
  
  // Check repo-clone directories
  const repoCloneBaseDir = path.join(workspaceDir, 'target', 'repo-clone');
  try {
    const repoCloneDirs = await fs.readdir(repoCloneBaseDir);
    for (const dir of repoCloneDirs) {
      const repoDir = path.join(repoCloneBaseDir, dir);
      const stat = await fs.stat(repoDir);
      if (stat.isDirectory()) {
        const isGitRepo = await isGitRepository(repoDir);
        repositories.push({
          gitDir: repoDir,
          repoType: 'repo-clone' as const,
          repoName: dir,
          isActive: isGitRepo
        });
      }
    }
  } catch {
    // repo-clone directory doesn't exist
  }
  
  // Check target directory
  const targetDir = path.join(workspaceDir, 'target');
  if (await isGitRepository(targetDir)) {
    repositories.push({
      gitDir: targetDir,
      repoType: 'target',
      isActive: true
    });
  }
  
  // Check workspace root (backwards compatibility)
  if (await isGitRepository(workspaceDir)) {
    repositories.push({
      gitDir: workspaceDir,
      repoType: 'workspace-root',
      isActive: true
    });
  }
  
  return repositories;
}

/**
 * Check if a directory is a git repository
 */
async function isGitRepository(dir: string): Promise<boolean> {
  try {
    await fs.access(dir);
    await execAsync('git rev-parse --git-dir', { cwd: dir });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get workspace metadata to determine which repos should be available
 */
export async function getWorkspaceGitContext(workspaceId: string): Promise<{
  hasGitRepos: boolean;
  repos: Array<{
    id: string;
    name: string;
    cloneMode: 'read-only' | 'writeable';
    cloneUrl?: string;
    expectedPath: string;
  }>;
}> {
  try {
    const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
    const workspaceMetadataPath = path.join(workspaceDir, 'workspace.json');
    const metadata = JSON.parse(await fs.readFile(workspaceMetadataPath, 'utf-8'));
    
    const gitRepos = metadata.context_items?.filter((item: any) => 
      item.source === 'git' && item.type === 'git_repository'
    ) || [];
    
    const repos = gitRepos.map((repo: any) => {
      const repoName = repo.content?.repo || repo.title?.split('/').pop()?.replace('Repository: ', '') || repo.id;
      return {
        id: repo.id,
        name: repoName,
        cloneMode: repo.library_metadata?.clone_mode || 'read-only',
        cloneUrl: repo.content?.clone_url || repo.content?.repo_url,
        expectedPath: path.join(workspaceDir, 'target', 'repo-clone', repoName)
      };
    });
    
    return {
      hasGitRepos: repos.length > 0,
      repos
    };
  } catch {
    return {
      hasGitRepos: false,
      repos: []
    };
  }
}