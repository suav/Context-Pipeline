/**
 * Environment Setup API
 * Handles automatic .env file creation for fresh installations
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const ENV_FILE = path.join(process.cwd(), '.env');
const ENV_EXAMPLE_FILE = path.join(process.cwd(), '.env.example');

interface EnvSetupRequest {
  credentials?: {
    jira?: { url: string; email: string; api_token: string };
    github?: { token: string };
    gitlab?: { url?: string; token: string };
    gemini?: { api_key: string };
    claude?: { api_key: string };
  };
  settings?: {
    port?: string;
    node_env?: string;
    master_key?: string;
  };
}

/**
 * Generate a secure master key for credential encryption
 */
function generateMasterKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Check if .env file exists
 */
async function envFileExists(): Promise<boolean> {
  try {
    await fs.access(ENV_FILE);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load existing .env file
 */
async function loadExistingEnv(): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(ENV_FILE, 'utf8');
    const env: Record<string, string> = {};
    
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    
    return env;
  } catch {
    return {};
  }
}

/**
 * Create .env file content
 */
function createEnvContent(setup: EnvSetupRequest, existingEnv: Record<string, string> = {}): string {
  const env = { ...existingEnv };
  
  // Basic application settings
  env.NODE_ENV = setup.settings?.node_env || env.NODE_ENV || 'development';
  env.PORT = setup.settings?.port || env.PORT || '3001';
  
  // Generate or use existing master key for credential encryption
  env.CREDENTIALS_MASTER_KEY = setup.settings?.master_key || env.CREDENTIALS_MASTER_KEY || generateMasterKey();
  
  // JIRA credentials
  if (setup.credentials?.jira) {
    env.JIRA_URL = setup.credentials.jira.url;
    env.JIRA_EMAIL = setup.credentials.jira.email;
    env.JIRA_API_TOKEN = setup.credentials.jira.api_token;
  }
  
  // GitHub credentials
  if (setup.credentials?.github) {
    env.GITHUB_TOKEN = setup.credentials.github.token;
  }
  
  // GitLab credentials
  if (setup.credentials?.gitlab) {
    if (setup.credentials.gitlab.url) {
      env.GITLAB_URL = setup.credentials.gitlab.url;
    }
    env.GITLAB_TOKEN = setup.credentials.gitlab.token;
  }
  
  // AI service credentials
  if (setup.credentials?.gemini) {
    env.GEMINI_API_KEY = setup.credentials.gemini.api_key;
  }
  
  if (setup.credentials?.claude) {
    env.CLAUDE_API_KEY = setup.credentials.claude.api_key;
  }
  
  // Create formatted content
  const lines = [
    '# Context Pipeline Environment Configuration',
    '# Generated automatically by the setup wizard',
    '# ',
    '# WARNING: This file contains sensitive information.',
    '# Do not commit this file to version control.',
    '',
    '# Application Settings',
    `NODE_ENV=${env.NODE_ENV}`,
    `PORT=${env.PORT}`,
    '',
    '# Security',
    `CREDENTIALS_MASTER_KEY=${env.CREDENTIALS_MASTER_KEY}`,
    ''
  ];
  
  // Add service credentials if they exist
  if (env.JIRA_URL || env.JIRA_EMAIL || env.JIRA_API_TOKEN) {
    lines.push(
      '# JIRA Integration',
      `JIRA_URL=${env.JIRA_URL || ''}`,
      `JIRA_EMAIL=${env.JIRA_EMAIL || ''}`,
      `JIRA_API_TOKEN=${env.JIRA_API_TOKEN || ''}`,
      ''
    );
  }
  
  if (env.GITHUB_TOKEN) {
    lines.push(
      '# GitHub Integration',
      `GITHUB_TOKEN=${env.GITHUB_TOKEN}`,
      ''
    );
  }
  
  if (env.GITLAB_URL || env.GITLAB_TOKEN) {
    lines.push(
      '# GitLab Integration',
      `GITLAB_URL=${env.GITLAB_URL || 'https://gitlab.com'}`,
      `GITLAB_TOKEN=${env.GITLAB_TOKEN || ''}`,
      ''
    );
  }
  
  if (env.GEMINI_API_KEY || env.CLAUDE_API_KEY) {
    lines.push('# AI Services');
    if (env.GEMINI_API_KEY) {
      lines.push(`GEMINI_API_KEY=${env.GEMINI_API_KEY}`);
    }
    if (env.CLAUDE_API_KEY) {
      lines.push(`CLAUDE_API_KEY=${env.CLAUDE_API_KEY}`);
    }
    lines.push('');
  }
  
  lines.push(
    '# Additional environment variables can be added below',
    '# See .env.example for more options',
    ''
  );
  
  return lines.join('\n');
}

/**
 * Validate setup request
 */
function validateSetup(setup: EnvSetupRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check JIRA credentials format
  if (setup.credentials?.jira) {
    const { url, email, api_token } = setup.credentials.jira;
    if (!url || !email || !api_token) {
      errors.push('JIRA credentials require url, email, and api_token');
    }
    if (email && !email.includes('@')) {
      errors.push('JIRA email must be a valid email address');
    }
  }
  
  // Check GitHub token format
  if (setup.credentials?.github) {
    const { token } = setup.credentials.github;
    if (!token) {
      errors.push('GitHub credentials require a token');
    }
    if (token && !token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
      errors.push('GitHub token appears to be invalid format');
    }
  }
  
  // Check GitLab token
  if (setup.credentials?.gitlab) {
    const { token } = setup.credentials.gitlab;
    if (!token) {
      errors.push('GitLab credentials require a token');
    }
  }
  
  // Check AI API keys
  if (setup.credentials?.gemini) {
    const { api_key } = setup.credentials.gemini;
    if (!api_key) {
      errors.push('Gemini credentials require an api_key');
    }
  }
  
  if (setup.credentials?.claude) {
    const { api_key } = setup.credentials.claude;
    if (!api_key) {
      errors.push('Claude credentials require an api_key');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// GET - Check setup status
export async function GET(request: NextRequest) {
  try {
    const envExists = await envFileExists();
    const existingEnv = envExists ? await loadExistingEnv() : {};
    
    // Check what's already configured
    const configured = {
      hasEnvFile: envExists,
      hasMasterKey: !!existingEnv.CREDENTIALS_MASTER_KEY,
      hasJira: !!(existingEnv.JIRA_URL && existingEnv.JIRA_EMAIL && existingEnv.JIRA_API_TOKEN),
      hasGitHub: !!existingEnv.GITHUB_TOKEN,
      hasGitLab: !!existingEnv.GITLAB_TOKEN,
      hasGemini: !!existingEnv.GEMINI_API_KEY,
      hasClaude: !!existingEnv.CLAUDE_API_KEY,
    };
    
    const needsSetup = !configured.hasEnvFile || !configured.hasMasterKey;
    
    return NextResponse.json({
      success: true,
      needsSetup,
      configured,
      message: needsSetup 
        ? 'Setup required - missing .env file or master key'
        : 'Environment already configured'
    });
  } catch (error) {
    console.error('Failed to check setup status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check setup status'
    }, { status: 500 });
  }
}

// POST - Create or update .env file
export async function POST(request: NextRequest) {
  try {
    const setup: EnvSetupRequest = await request.json();
    
    // Validate the setup request
    const validation = validateSetup(setup);
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid setup configuration',
        errors: validation.errors
      }, { status: 400 });
    }
    
    // Load existing environment if file exists
    const existingEnv = await loadExistingEnv();
    
    // Create new .env content
    const envContent = createEnvContent(setup, existingEnv);
    
    // Backup existing .env if it exists
    const envExists = await envFileExists();
    if (envExists) {
      const backupFile = `${ENV_FILE}.backup.${Date.now()}`;
      await fs.copyFile(ENV_FILE, backupFile);
      console.log(`Backed up existing .env to ${backupFile}`);
    }
    
    // Write the new .env file
    await fs.writeFile(ENV_FILE, envContent, 'utf8');
    
    // Create credentials from the setup if provided
    const credentialsCreated = [];
    if (setup.credentials) {
      // This would integrate with the credentials API to create initial credentials
      // For now, we'll just report what would be created
      
      if (setup.credentials.jira) {
        credentialsCreated.push('JIRA');
      }
      if (setup.credentials.github) {
        credentialsCreated.push('GitHub');
      }
      if (setup.credentials.gitlab) {
        credentialsCreated.push('GitLab');
      }
      if (setup.credentials.gemini) {
        credentialsCreated.push('Gemini');
      }
      if (setup.credentials.claude) {
        credentialsCreated.push('Claude');
      }
    }
    
    return NextResponse.json({
      success: true,
      message: '.env file created successfully',
      details: {
        envFileCreated: true,
        backupCreated: envExists,
        credentialsConfigured: credentialsCreated,
        masterKeyGenerated: !existingEnv.CREDENTIALS_MASTER_KEY
      }
    });
    
  } catch (error) {
    console.error('Failed to create .env file:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create .env file'
    }, { status: 500 });
  }
}