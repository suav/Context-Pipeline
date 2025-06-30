/**
 * Workspace Validation Utilities
 * Validates workspace integrity including git repo and context manifest
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export interface WorkspaceValidationResult {
  isValid: boolean;
  issues: string[];
  hasGitRepo: boolean;
  hasContextManifest: boolean;
  hasTargetFiles: boolean;
  contextItemsCount: number;
  missingContextFiles: string[];
  recommendedAction: 'none' | 'rebuild' | 'move_to_drafts';
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  created_at?: string;
}

/**
 * Validates a workspace for integrity and proper setup
 */
export async function validateWorkspace(workspacePath: string): Promise<WorkspaceValidationResult> {
  const result: WorkspaceValidationResult = {
    isValid: true,
    issues: [],
    hasGitRepo: false,
    hasContextManifest: false,
    hasTargetFiles: false,
    contextItemsCount: 0,
    missingContextFiles: [],
    recommendedAction: 'none'
  };

  try {
    // Check if workspace directory exists
    try {
      await fs.access(workspacePath);
    } catch {
      result.isValid = false;
      result.issues.push('Workspace directory does not exist');
      result.recommendedAction = 'move_to_drafts';
      return result;
    }

    // Check for git repository in target/repo-clone subdirectories
    const targetPath = path.join(workspacePath, 'target');
    const repoClonePath = path.join(targetPath, 'repo-clone');
    
    // Use synchronous operations for more reliable checking
    if (fsSync.existsSync(targetPath)) {
      if (fsSync.existsSync(repoClonePath)) {
        try {
          const repoCloneContents = fsSync.readdirSync(repoClonePath);
          
          for (const item of repoCloneContents) {
            if (item.startsWith('.')) continue; // Skip hidden files
            
            const itemPath = path.join(repoClonePath, item);
            const stat = fsSync.statSync(itemPath);
            
            if (stat.isDirectory()) {
              const gitPath = path.join(itemPath, '.git');
              if (fsSync.existsSync(gitPath)) {
                result.hasGitRepo = true;
                break;
              }
            }
          }
          
          if (!result.hasGitRepo) {
            result.issues.push('Repository clone directory exists but no git repository found');
            result.isValid = false;
          }
        } catch (error) {
          result.issues.push(`Error reading repository clone directory: ${(error as Error).message}`);
          result.isValid = false;
        }
      } else {
        result.issues.push('Target directory exists but no repo-clone directory found');
        result.isValid = false;
      }
    } else {
      result.issues.push('No target directory found');
      result.isValid = false;
    }

    // Check for context manifest
    const manifestPath = path.join(workspacePath, 'context', 'context-manifest.json');
    
    if (fsSync.existsSync(manifestPath)) {
      try {
        const manifestData = fsSync.readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestData);
        result.hasContextManifest = true;
        result.contextItemsCount = manifest.context_items?.length || 0;

        // Validate context files exist
        if (manifest.context_items && manifest.context_items.length > 0) {
          for (const item of manifest.context_items) {
            if (item.content_file) {
              const contextFilePath = path.join(workspacePath, item.content_file);
              if (!fsSync.existsSync(contextFilePath)) {
                result.missingContextFiles.push(item.content_file);
                result.issues.push(`Missing context file: ${item.content_file}`);
              }
            }
          }
        }
      } catch (error) {
        result.issues.push(`Context manifest corrupted: ${(error as Error).message}`);
        result.isValid = false;
      }
    } else {
      result.issues.push('Context manifest missing or corrupted');
      result.isValid = false;
    }

    // Check for target files
    if (fsSync.existsSync(targetPath)) {
      try {
        const targetContents = fsSync.readdirSync(targetPath);
        result.hasTargetFiles = targetContents.length > 0;
      } catch {
        result.hasTargetFiles = false;
        result.issues.push('Target directory is empty or inaccessible');
      }
    } else {
      result.hasTargetFiles = false;
    }

    // Determine recommended action
    if (!result.hasGitRepo || !result.hasContextManifest) {
      result.recommendedAction = 'move_to_drafts';
      result.isValid = false;
    } else if (result.missingContextFiles.length > 0) {
      result.recommendedAction = 'rebuild';
      result.isValid = false;
    }

  } catch (error) {
    result.isValid = false;
    result.issues.push(`Validation error: ${(error as Error).message}`);
    result.recommendedAction = 'move_to_drafts';
  }

  return result;
}

/**
 * Validates multiple workspaces and returns summary
 */
export async function validateAllWorkspaces(workspaceBaseDir: string): Promise<{
  valid: WorkspaceInfo[];
  invalid: Array<WorkspaceInfo & { validation: WorkspaceValidationResult }>;
  total: number;
}> {
  const result = {
    valid: [] as WorkspaceInfo[],
    invalid: [] as Array<WorkspaceInfo & { validation: WorkspaceValidationResult }>,
    total: 0
  };

  try {
    const workspaceDirs = await fs.readdir(workspaceBaseDir);
    
    for (const dir of workspaceDirs) {
      const workspacePath = path.join(workspaceBaseDir, dir);
      const stat = await fs.stat(workspacePath);
      
      if (stat.isDirectory()) {
        result.total++;
        
        const validation = await validateWorkspace(workspacePath);
        const workspaceInfo: WorkspaceInfo = {
          id: dir,
          name: dir,
          path: workspacePath
        };

        if (validation.isValid) {
          result.valid.push(workspaceInfo);
        } else {
          result.invalid.push({
            ...workspaceInfo,
            validation
          });
        }
      }
    }
  } catch (error) {
    console.error('Failed to validate workspaces:', error);
  }

  return result;
}

/**
 * Moves invalid workspace back to drafts
 */
export async function moveWorkspaceToDrafts(
  workspacePath: string, 
  workspaceId: string,
  validation: WorkspaceValidationResult
): Promise<{ success: boolean; draftId?: string; error?: string }> {
  try {
    // Read workspace data to create draft
    const contextPath = path.join(workspacePath, 'context', 'context-manifest.json');
    let workspaceData: any = {
      id: workspaceId,
      name: workspaceId,
      context_items: [],
      status: 'needs_rebuild',
      validation_issues: validation.issues,
      moved_from_workspace: true,
      moved_at: new Date().toISOString()
    };

    try {
      const manifestData = await fs.readFile(contextPath, 'utf-8');
      const manifest = JSON.parse(manifestData);
      workspaceData = {
        ...workspaceData,
        name: manifest.name || workspaceId,
        description: manifest.description,
        context_items: manifest.context_items || []
      };
    } catch {
      // Use defaults if manifest can't be read
    }

    // Create draft with check engine status
    const draftId = `${workspaceId}-rebuild-${Date.now()}`;
    const draft = {
      id: draftId,
      name: `${workspaceData.name} (⚠️ Needs Rebuild)`,
      description: `${workspaceData.description || ''}\n\n⚠️ Moved from workspace due to validation issues:\n${validation.issues.join('\n')}`,
      context_items: workspaceData.context_items,
      status: 'needs_rebuild',
      validation_issues: validation.issues,
      original_workspace_id: workspaceId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Archive the original workspace before removal
    const archiveDir = path.join(path.dirname(workspacePath), '..', 'workspace-archives');
    await fs.mkdir(archiveDir, { recursive: true });
    
    const archiveFile = `workspace-${workspaceId}-archived-${Date.now()}.json`;
    const archivePath = path.join(archiveDir, archiveFile);
    
    await fs.writeFile(archivePath, JSON.stringify({
      workspace_id: workspaceId,
      archived_at: new Date().toISOString(),
      reason: 'validation_failure',
      validation_issues: validation.issues,
      original_data: workspaceData
    }, null, 2));

    return {
      success: true,
      draftId: draft.id
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to move workspace to drafts: ${(error as Error).message}`
    };
  }
}