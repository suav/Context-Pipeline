/**
 * Credentials Testing API
 * Tests connectivity and validates credentials for various services
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCredentialById } from '../route';
import fs from 'fs/promises';
import path from 'path';

const CREDENTIALS_FILE = path.join(process.cwd(), 'storage', 'credentials.json');

/**
 * Test JIRA connection
 */
async function testJiraConnection(fields: Record<string, string>): Promise<{ success: boolean; message: string; details?: any }> {
  const { url, email, api_token } = fields;
  
  if (!url || !email || !api_token) {
    return {
      success: false,
      message: 'Missing required fields: url, email, and api_token are required for JIRA'
    };
  }
  
  try {
    const jiraUrl = url.startsWith('http') ? url : `https://${url}`;
    const testEndpoint = `${jiraUrl}/rest/api/3/myself`;
    
    const response = await fetch(testEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${email}:${api_token}`).toString('base64')}`,
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      return {
        success: true,
        message: 'JIRA connection successful',
        details: {
          user: userData.displayName,
          email: userData.emailAddress,
          accountId: userData.accountId
        }
      };
    } else {
      return {
        success: false,
        message: `JIRA connection failed: ${response.status} ${response.statusText}`
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `JIRA connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Test GitHub connection
 */
async function testGitHubConnection(fields: Record<string, string>): Promise<{ success: boolean; message: string; details?: any }> {
  const { token, username } = fields;
  
  if (!token) {
    return {
      success: false,
      message: 'Missing required field: token is required for GitHub'
    };
  }
  
  try {
    const response = await fetch('https://api.github.com/user', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Context-Pipeline'
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      return {
        success: true,
        message: 'GitHub connection successful',
        details: {
          user: userData.login,
          name: userData.name,
          id: userData.id
        }
      };
    } else {
      return {
        success: false,
        message: `GitHub connection failed: ${response.status} ${response.statusText}`
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `GitHub connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Test GitLab connection
 */
async function testGitLabConnection(fields: Record<string, string>): Promise<{ success: boolean; message: string; details?: any }> {
  const { url, token, username } = fields;
  
  if (!token) {
    return {
      success: false,
      message: 'Missing required field: token is required for GitLab'
    };
  }
  
  try {
    const gitlabUrl = url || 'https://gitlab.com';
    const testEndpoint = `${gitlabUrl}/api/v4/user`;
    
    const response = await fetch(testEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      return {
        success: true,
        message: 'GitLab connection successful',
        details: {
          user: userData.username,
          name: userData.name,
          id: userData.id
        }
      };
    } else {
      return {
        success: false,
        message: `GitLab connection failed: ${response.status} ${response.statusText}`
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `GitLab connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Test Email (IMAP) connection
 */
async function testEmailConnection(fields: Record<string, string>): Promise<{ success: boolean; message: string; details?: any }> {
  const { host, port, email, password } = fields;
  
  if (!host || !email || !password) {
    return {
      success: false,
      message: 'Missing required fields: host, email, and password are required for Email'
    };
  }
  
  // For now, return a mock test since we don't want to implement full IMAP in the API
  return {
    success: true,
    message: 'Email configuration validated (connection test not implemented)',
    details: {
      host,
      port: port || '993',
      email,
      note: 'Actual IMAP connection testing requires additional dependencies'
    }
  };
}

/**
 * Test Slack connection
 */
async function testSlackConnection(fields: Record<string, string>): Promise<{ success: boolean; message: string; details?: any }> {
  const { token, workspace } = fields;
  
  if (!token) {
    return {
      success: false,
      message: 'Missing required field: token is required for Slack'
    };
  }
  
  try {
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.ok) {
        return {
          success: true,
          message: 'Slack connection successful',
          details: {
            user: data.user,
            team: data.team,
            url: data.url
          }
        };
      } else {
        return {
          success: false,
          message: `Slack connection failed: ${data.error}`
        };
      }
    } else {
      return {
        success: false,
        message: `Slack connection failed: ${response.status} ${response.statusText}`
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Slack connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Test custom API connection
 */
async function testCustomConnection(fields: Record<string, string>): Promise<{ success: boolean; message: string; details?: any }> {
  const { url, api_key, auth_header } = fields;
  
  if (!url) {
    return {
      success: false,
      message: 'Missing required field: url is required for Custom API'
    };
  }
  
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (api_key && auth_header) {
      headers[auth_header] = api_key;
    } else if (api_key) {
      headers['Authorization'] = `Bearer ${api_key}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers
    });
    
    return {
      success: response.ok,
      message: response.ok 
        ? 'Custom API connection successful' 
        : `Custom API connection failed: ${response.status} ${response.statusText}`,
      details: {
        status: response.status,
        statusText: response.statusText
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Custom API connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// POST - Test credential connection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { credentialId } = body;
    
    if (!credentialId) {
      return NextResponse.json({
        success: false,
        error: 'Credential ID is required'
      }, { status: 400 });
    }
    
    // Get the credential with decrypted fields
    const credential = await getCredentialById(credentialId);
    
    if (!credential) {
      return NextResponse.json({
        success: false,
        message: 'Credential not found'
      }, { status: 404 });
    }
    
    let testResult;
    
    switch (credential.service) {
      case 'jira':
        testResult = await testJiraConnection(credential.fields);
        break;
      case 'github':
        testResult = await testGitHubConnection(credential.fields);
        break;
      case 'gitlab':
        testResult = await testGitLabConnection(credential.fields);
        break;
      case 'email':
        testResult = await testEmailConnection(credential.fields);
        break;
      case 'slack':
        testResult = await testSlackConnection(credential.fields);
        break;
      case 'custom':
        testResult = await testCustomConnection(credential.fields);
        break;
      default:
        testResult = {
          success: false,
          message: `Testing not implemented for service type: ${credential.service}`
        };
    }
    
    // Update credential status based on test result
    if (testResult.success) {
      // Update the credential's last used time and status
      try {
        const data = await fs.readFile(CREDENTIALS_FILE, 'utf8');
        const credentialsData = JSON.parse(data);
        const credentialIndex = credentialsData.credentials.findIndex((c: any) => c.id === credentialId);
        
        if (credentialIndex !== -1) {
          credentialsData.credentials[credentialIndex].status = 'active';
          credentialsData.credentials[credentialIndex].lastUsed = new Date().toISOString();
          credentialsData.last_updated = new Date().toISOString();
          
          await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(credentialsData, null, 2));
        }
      } catch (error) {
        console.error('Failed to update credential status:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      test_result: testResult,
      credential_name: credential.name,
      service: credential.service
    });
    
  } catch (error) {
    console.error('Failed to test credential:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test credential'
    }, { status: 500 });
  }
}