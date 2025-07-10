/**
 * Credentials Management API
 * Manages credentials in .env.local file through the UI
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Types
interface Credential {
  id: string;
  name: string;
  service: 'jira' | 'github' | 'gitlab' | 'email' | 'slack' | 'custom';
  status: 'active' | 'inactive' | 'error';
  lastUsed?: string;
  fields: Record<string, string>;
  created_at: string;
  updated_at: string;
}

interface EnvCredential {
  id: string;
  service: string;
  variables: Record<string, string>;
}

// Service to environment variable mapping
const SERVICE_ENV_MAP: Record<string, { vars: string[], display: string[] }> = {
  jira: {
    vars: ['JIRA_BASE_URL', 'JIRA_USERNAME', 'JIRA_API_TOKEN'],
    display: ['url', 'email', 'api_token']
  },
  github: {
    vars: ['GITHUB_TOKEN', 'REPO_URL', 'SSH_KEY_PATH', 'GIT_USER_NAME', 'GIT_USER_EMAIL'],
    display: ['token', 'repo_url', 'ssh_key_path', 'user_name', 'user_email']
  },
  gitlab: {
    vars: ['GITLAB_URL', 'GITLAB_TOKEN'],
    display: ['url', 'token']
  },
  email: {
    vars: ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD'],
    display: ['host', 'port', 'email', 'password']
  },
  slack: {
    vars: ['SLACK_TOKEN', 'SLACK_WORKSPACE'],
    display: ['token', 'workspace']
  }
};

// Helper to mask sensitive values
function maskSensitive(key: string, value: string): string {
  const sensitiveKeys = ['token', 'api_token', 'password', 'api_key', 'secret'];
  if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
    if (value.length > 8) {
      return value.substring(0, 4) + '••••' + value.substring(value.length - 4);
    }
    return '••••••••';
  }
  return value;
}

/**
 * Read and parse .env.local file
 */
async function readEnvFile(): Promise<{ lines: string[], vars: Record<string, string> }> {
  const envPath = path.join(process.cwd(), '.env.local');
  
  try {
    const content = await fs.readFile(envPath, 'utf8');
    const lines = content.split('\n');
    const vars: Record<string, string> = {};
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          vars[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    
    return { lines, vars };
  } catch (error) {
    // File doesn't exist, return empty
    return { lines: [], vars: {} };
  }
}

/**
 * Write .env.local file
 */
async function writeEnvFile(lines: string[]): Promise<void> {
  const envPath = path.join(process.cwd(), '.env.local');
  await fs.writeFile(envPath, lines.join('\n'), 'utf8');
}

/**
 * Load credentials from environment variables
 */
async function loadCredentialsFromEnv(): Promise<Credential[]> {
  const { vars } = await readEnvFile();
  const credentials: Credential[] = [];
  const timestamp = new Date().toISOString();
  
  // Check for JIRA credentials
  if (vars.JIRA_BASE_URL || vars.JIRA_URL) {
    const jiraUrl = vars.JIRA_BASE_URL || vars.JIRA_URL;
    const jiraEmail = vars.JIRA_USERNAME || vars.JIRA_EMAIL || vars.USER_EMAIL;
    const jiraToken = vars.JIRA_API_TOKEN;
    
    if (jiraUrl && jiraEmail && jiraToken) {
      credentials.push({
        id: 'jira-env-1',
        name: 'JIRA Account',
        service: 'jira',
        status: 'active',
        fields: {
          url: jiraUrl.replace('https://', '').replace('http://', ''),
          email: jiraEmail,
          api_token: maskSensitive('api_token', jiraToken)
        },
        created_at: timestamp,
        updated_at: timestamp
      });
    }
  }
  
  // Check for GitHub token credentials
  if (vars.GITHUB_TOKEN) {
    credentials.push({
      id: 'github-token-1',
      name: 'GitHub Token',
      service: 'github',
      status: 'active',
      fields: {
        token: maskSensitive('token', vars.GITHUB_TOKEN)
      },
      created_at: timestamp,
      updated_at: timestamp
    });
  }
  
  // Check for Git repositories (numbered system for multiple repos)
  const repoUrls = Object.keys(vars).filter(key => key === 'REPO_URL' || key.startsWith('REPO_URL_'));
  
  repoUrls.forEach((urlKey, index) => {
    const repoUrl = vars[urlKey];
    if (!repoUrl) return;
    
    // Determine corresponding keys for this repository
    const suffix = urlKey === 'REPO_URL' ? '' : `_${urlKey.split('_')[2]}`;
    const sshKeyKey = `SSH_KEY_PATH${suffix}`;
    const userNameKey = `GIT_USER_NAME${suffix}`;
    const userEmailKey = `GIT_USER_EMAIL${suffix}`;
    
    const sshKeyPath = vars[sshKeyKey];
    const userName = vars[userNameKey];
    const userEmail = vars[userEmailKey];
    
    // Extract repository name from URL for display
    const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'Repository';
    
    const fields: Record<string, string> = {
      repo_url: repoUrl
    };
    
    if (sshKeyPath) {
      fields.ssh_key_path = sshKeyPath;
    }
    if (userName) {
      fields.user_name = userName;
    }
    if (userEmail) {
      fields.user_email = userEmail;
    }
    
    credentials.push({
      id: `git-repo-${index + 1}`,
      name: `Git: ${repoName}`,
      service: 'github',
      status: 'active',
      fields,
      created_at: timestamp,
      updated_at: timestamp
    });
  });
  
  // Check for GitLab credentials
  if (vars.GITLAB_TOKEN) {
    credentials.push({
      id: 'gitlab-env-1',
      name: 'GitLab Account',
      service: 'gitlab',
      status: 'active',
      fields: {
        url: vars.GITLAB_URL || 'gitlab.com',
        token: maskSensitive('token', vars.GITLAB_TOKEN)
      },
      created_at: timestamp,
      updated_at: timestamp
    });
  }
  
  return credentials;
}

/**
 * Add or update environment variables in .env.local
 */
async function updateEnvVars(service: string, fields: Record<string, string>): Promise<void> {
  const { lines, vars } = await readEnvFile();
  const serviceMap = SERVICE_ENV_MAP[service];
  
  if (!serviceMap) {
    throw new Error(`Unknown service: ${service}`);
  }
  
  // Create a new lines array
  let newLines = [...lines];
  
  // Map fields to environment variables
  const updates: Record<string, string> = {};
  serviceMap.display.forEach((displayKey, index) => {
    const envVar = serviceMap.vars[index];
    const value = fields[displayKey];
    if (value) {
      updates[envVar] = value;
    }
  });
  
  // Special handling for different services
  if (service === 'jira') {
    if (fields.url) {
      const fullUrl = fields.url.startsWith('http') ? fields.url : `https://${fields.url}`;
      updates['JIRA_BASE_URL'] = fullUrl;
    }
    if (fields.email) {
      updates['JIRA_USERNAME'] = fields.email;
    }
  } else if (service === 'github' && fields.repo_url) {
    // Handle Git repositories - find next available slot
    const { vars } = await readEnvFile();
    const existingRepoUrls = Object.keys(vars).filter(key => key === 'REPO_URL' || key.startsWith('REPO_URL_'));
    
    // Check if this repo URL already exists
    const existingUrl = existingRepoUrls.find(key => vars[key] === fields.repo_url);
    if (existingUrl) {
      throw new Error('Repository URL already exists');
    }
    
    // Find next available slot
    let nextSlot = '';
    if (!vars.REPO_URL) {
      nextSlot = 'REPO_URL';
    } else {
      let counter = 2;
      while (vars[`REPO_URL_${counter}`]) {
        counter++;
      }
      nextSlot = `REPO_URL_${counter}`;
    }
    
    const suffix = nextSlot === 'REPO_URL' ? '' : `_${nextSlot.split('_')[2]}`;
    
    updates[nextSlot] = fields.repo_url;
    
    if (fields.ssh_key_path) {
      updates[`SSH_KEY_PATH${suffix}`] = fields.ssh_key_path;
    }
    if (fields.user_name) {
      updates[`GIT_USER_NAME${suffix}`] = fields.user_name;
    }
    if (fields.user_email) {
      updates[`GIT_USER_EMAIL${suffix}`] = fields.user_email;
    }
  }
  
  // Update or add variables
  Object.entries(updates).forEach(([key, value]) => {
    const existingIndex = newLines.findIndex(line => {
      const trimmed = line.trim();
      return trimmed.startsWith(`${key}=`) || trimmed.startsWith(`# ${key}=`);
    });
    
    if (existingIndex >= 0) {
      // Update existing line
      newLines[existingIndex] = `${key}=${value}`;
    } else {
      // Add new line
      // Try to group with related variables
      let insertIndex = newLines.length;
      
      // Find where to insert based on service
      if (service === 'jira') {
        const jiraIndex = newLines.findIndex(line => line.includes('JIRA'));
        if (jiraIndex >= 0) {
          // Find the last JIRA variable
          let lastJiraIndex = jiraIndex;
          for (let i = jiraIndex; i < newLines.length; i++) {
            if (newLines[i].includes('JIRA')) {
              lastJiraIndex = i;
            } else if (newLines[i].trim() === '') {
              break;
            }
          }
          insertIndex = lastJiraIndex + 1;
        }
      }
      
      newLines.splice(insertIndex, 0, `${key}=${value}`);
    }
  });
  
  await writeEnvFile(newLines);
}

/**
 * Delete environment variables from .env.local
 */
async function deleteEnvVars(service: string): Promise<void> {
  const { lines } = await readEnvFile();
  const serviceMap = SERVICE_ENV_MAP[service];
  
  if (!serviceMap) {
    throw new Error(`Unknown service: ${service}`);
  }
  
  // Comment out the variables instead of deleting them
  const newLines = lines.map(line => {
    const trimmed = line.trim();
    for (const envVar of serviceMap.vars) {
      if (trimmed.startsWith(`${envVar}=`)) {
        return `# ${line} # Removed via UI`;
      }
    }
    return line;
  });
  
  await writeEnvFile(newLines);
}

/**
 * Delete a specific Git repository by ID
 */
async function deleteGitRepo(credentialId: string): Promise<void> {
  const { lines, vars } = await readEnvFile();
  const repoUrls = Object.keys(vars).filter(key => key === 'REPO_URL' || key.startsWith('REPO_URL_'));
  const repoIndex = parseInt(credentialId.split('-')[2]) - 1;
  
  if (repoIndex < 0 || repoIndex >= repoUrls.length) {
    throw new Error('Repository not found');
  }
  
  const urlKey = repoUrls[repoIndex];
  const suffix = urlKey === 'REPO_URL' ? '' : `_${urlKey.split('_')[2]}`;
  const sshKeyKey = `SSH_KEY_PATH${suffix}`;
  const userNameKey = `GIT_USER_NAME${suffix}`;
  const userEmailKey = `GIT_USER_EMAIL${suffix}`;
  
  // Comment out all related variables
  const newLines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${urlKey}=`) || 
        trimmed.startsWith(`${sshKeyKey}=`) ||
        trimmed.startsWith(`${userNameKey}=`) ||
        trimmed.startsWith(`${userEmailKey}=`)) {
      return `# ${line} # Removed via UI`;
    }
    return line;
  });
  
  await writeEnvFile(newLines);
}

/**
 * Update a specific Git repository by ID
 */
async function updateGitRepo(credentialId: string, fields: Record<string, string>): Promise<void> {
  const { lines, vars } = await readEnvFile();
  const repoUrls = Object.keys(vars).filter(key => key === 'REPO_URL' || key.startsWith('REPO_URL_'));
  const repoIndex = parseInt(credentialId.split('-')[2]) - 1;
  
  if (repoIndex < 0 || repoIndex >= repoUrls.length) {
    throw new Error('Repository not found');
  }
  
  const urlKey = repoUrls[repoIndex];
  const suffix = urlKey === 'REPO_URL' ? '' : `_${urlKey.split('_')[2]}`;
  
  // Map fields to environment variable keys
  const updates: Record<string, string> = {};
  
  if (fields.repo_url) {
    updates[urlKey] = fields.repo_url;
  }
  if (fields.ssh_key_path) {
    updates[`SSH_KEY_PATH${suffix}`] = fields.ssh_key_path;
  }
  if (fields.user_name) {
    updates[`GIT_USER_NAME${suffix}`] = fields.user_name;
  }
  if (fields.user_email) {
    updates[`GIT_USER_EMAIL${suffix}`] = fields.user_email;
  }
  
  // Update the lines
  let newLines = [...lines];
  
  Object.entries(updates).forEach(([key, value]) => {
    const existingIndex = newLines.findIndex(line => {
      const trimmed = line.trim();
      return trimmed.startsWith(`${key}=`) || trimmed.startsWith(`# ${key}=`);
    });
    
    if (existingIndex >= 0) {
      // Update existing line
      newLines[existingIndex] = `${key}=${value}`;
    } else {
      // Add new line in Git section
      const gitSectionIndex = newLines.findIndex(line => 
        line.includes('Git Configuration') || line.includes('REPO_URL')
      );
      
      if (gitSectionIndex >= 0) {
        // Find the end of the Git section
        let insertIndex = gitSectionIndex + 1;
        for (let i = gitSectionIndex + 1; i < newLines.length; i++) {
          if (newLines[i].trim() === '' && !newLines[i + 1]?.includes('REPO_URL') && !newLines[i + 1]?.includes('SSH_KEY_PATH') && !newLines[i + 1]?.includes('GIT_USER_')) {
            insertIndex = i;
            break;
          }
          if (newLines[i].includes('REPO_URL') || newLines[i].includes('SSH_KEY_PATH') || newLines[i].includes('GIT_USER_') || newLines[i].includes('DEFAULT_BRANCH')) {
            insertIndex = i + 1;
          }
        }
        newLines.splice(insertIndex, 0, `${key}=${value}`);
      } else {
        newLines.push(`${key}=${value}`);
      }
    }
  });
  
  await writeEnvFile(newLines);
}

/**
 * Get the full credential with unmasked values for API usage
 */
export async function getCredentialById(id: string): Promise<Credential | null> {
  const { vars } = await readEnvFile();
  const timestamp = new Date().toISOString();
  
  switch (id) {
    case 'jira-env-1': {
      const jiraUrl = vars.JIRA_BASE_URL || vars.JIRA_URL;
      const jiraEmail = vars.JIRA_USERNAME || vars.JIRA_EMAIL || vars.USER_EMAIL;
      const jiraToken = vars.JIRA_API_TOKEN;
      
      if (jiraUrl && jiraEmail && jiraToken) {
        return {
          id: 'jira-env-1',
          name: 'JIRA Account',
          service: 'jira',
          status: 'active',
          fields: {
            url: jiraUrl.replace('https://', '').replace('http://', ''),
            email: jiraEmail,
            api_token: jiraToken // Unmasked for API usage
          },
          created_at: timestamp,
          updated_at: timestamp
        };
      }
      break;
    }
    case 'github-token-1': {
      if (vars.GITHUB_TOKEN) {
        return {
          id: 'github-token-1',
          name: 'GitHub Token',
          service: 'github',
          status: 'active',
          fields: {
            token: vars.GITHUB_TOKEN // Unmasked for API usage
          },
          created_at: timestamp,
          updated_at: timestamp
        };
      }
      break;
    }
    default: {
      // Handle git-repo-X IDs dynamically
      if (id.startsWith('git-repo-')) {
        const repoUrls = Object.keys(vars).filter(key => key === 'REPO_URL' || key.startsWith('REPO_URL_'));
        const repoIndex = parseInt(id.split('-')[2]) - 1;
        
        if (repoIndex >= 0 && repoIndex < repoUrls.length) {
          const urlKey = repoUrls[repoIndex];
          const repoUrl = vars[urlKey];
          
          if (repoUrl) {
            const suffix = urlKey === 'REPO_URL' ? '' : `_${urlKey.split('_')[2]}`;
            const sshKeyKey = `SSH_KEY_PATH${suffix}`;
            const userNameKey = `GIT_USER_NAME${suffix}`;
            const userEmailKey = `GIT_USER_EMAIL${suffix}`;
            
            const sshKeyPath = vars[sshKeyKey];
            const userName = vars[userNameKey];
            const userEmail = vars[userEmailKey];
            const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'Repository';
            
            const fields: Record<string, string> = {
              repo_url: repoUrl
            };
            
            if (sshKeyPath) {
              fields.ssh_key_path = sshKeyPath;
            }
            if (userName) {
              fields.user_name = userName;
            }
            if (userEmail) {
              fields.user_email = userEmail;
            }
            
            return {
              id,
              name: `Git: ${repoName}`,
              service: 'github',
              status: 'active',
              fields,
              created_at: timestamp,
              updated_at: timestamp
            };
          }
        }
      }
      break;
    }
    case 'gitlab-env-1': {
      if (vars.GITLAB_TOKEN) {
        return {
          id: 'gitlab-env-1',
          name: 'GitLab Account',
          service: 'gitlab',
          status: 'active',
          fields: {
            url: vars.GITLAB_URL || 'gitlab.com',
            token: vars.GITLAB_TOKEN // Unmasked for API usage
          },
          created_at: timestamp,
          updated_at: timestamp
        };
      }
      break;
    }
  }
  
  return null;
}

// GET - List all credentials
export async function GET(request: NextRequest) {
  try {
    const credentials = await loadCredentialsFromEnv();
    
    return NextResponse.json({
      success: true,
      credentials,
      count: credentials.length
    });
  } catch (error) {
    console.error('Failed to load credentials:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load credentials'
    }, { status: 500 });
  }
}

// POST - Create new credential (updates .env.local)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { service, fields } = body;
    
    if (!service || !fields) {
      return NextResponse.json({
        success: false,
        error: 'Service and fields are required'
      }, { status: 400 });
    }
    
    // Update environment variables
    await updateEnvVars(service, fields);
    
    // Return the created credential
    const credentials = await loadCredentialsFromEnv();
    const newCredential = credentials.find(c => c.service === service);
    
    return NextResponse.json({
      success: true,
      credential: newCredential,
      message: 'Credential added to .env.local successfully'
    });
  } catch (error) {
    console.error('Failed to create credential:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create credential'
    }, { status: 500 });
  }
}

// PUT - Update credential (updates .env.local)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, fields } = body;
    
    if (!id || !fields) {
      return NextResponse.json({
        success: false,
        error: 'ID and fields are required'
      }, { status: 400 });
    }
    
    // Handle different credential types
    if (id.startsWith('git-repo-')) {
      // Handle dynamic Git repository updates
      await updateGitRepo(id, fields);
    } else {
      // Determine service from ID
      let service = '';
      if (id.startsWith('jira')) service = 'jira';
      else if (id.startsWith('github')) service = 'github';
      else if (id.startsWith('gitlab')) service = 'gitlab';
      else {
        return NextResponse.json({
          success: false,
          error: 'Unknown credential ID'
        }, { status: 400 });
      }
      
      // Update environment variables
      await updateEnvVars(service, fields);
    }
    
    // Return the updated credential
    const credentials = await loadCredentialsFromEnv();
    const updatedCredential = credentials.find(c => c.id === id);
    
    return NextResponse.json({
      success: true,
      credential: updatedCredential,
      message: 'Credential updated in .env.local successfully'
    });
  } catch (error) {
    console.error('Failed to update credential:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update credential'
    }, { status: 500 });
  }
}

// DELETE - Delete credential (comments out in .env.local)
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Credential ID is required'
      }, { status: 400 });
    }
    
    // Handle different credential types
    if (id.startsWith('git-repo-')) {
      // Handle dynamic Git repository deletion
      await deleteGitRepo(id);
    } else {
      // Determine service from ID
      let service = '';
      if (id.startsWith('jira')) service = 'jira';
      else if (id.startsWith('github')) service = 'github';
      else if (id.startsWith('gitlab')) service = 'gitlab';
      else {
        return NextResponse.json({
          success: false,
          error: 'Unknown credential ID'
        }, { status: 400 });
      }
      
      // Delete (comment out) environment variables
      await deleteEnvVars(service);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Credential removed from .env.local successfully'
    });
  } catch (error) {
    console.error('Failed to delete credential:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete credential'
    }, { status: 500 });
  }
}