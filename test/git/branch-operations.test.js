#!/usr/bin/env node

/**
 * Git Branch Operations Test
 * 
 * Tests the git branch operations API endpoints and services
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  title: (msg) => console.log(`${colors.cyan}${colors.bright}🧪 ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.magenta}${colors.bright}${msg}${colors.reset}`)
};

async function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const { method = 'GET', headers = {}, body } = options;
    
    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    
    req.end();
  });
}

async function createTestWorkspace() {
  log.info('Creating test workspace...');
  
  const workspaceData = {
    title: 'Git Test Workspace',
    description: 'Test workspace for git operations',
    context: 'Testing git branch operations and services'
  };
  
  const response = await makeRequest('/api/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: workspaceData
  });
  
  if (response.status === 201 && response.data.id) {
    log.success(`Workspace created: ${response.data.id}`);
    return response.data.id;
  } else {
    throw new Error(`Failed to create workspace: ${response.status}`);
  }
}

async function initializeGitRepo(workspaceId) {
  log.info('Initializing git repository...');
  
  const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
  
  try {
    // Initialize git repo
    execSync('git init', { cwd: workspaceDir, stdio: 'pipe' });
    execSync('git config user.name "Test User"', { cwd: workspaceDir, stdio: 'pipe' });
    execSync('git config user.email "test@example.com"', { cwd: workspaceDir, stdio: 'pipe' });
    
    // Create initial commit
    fs.writeFileSync(path.join(workspaceDir, 'README.md'), '# Test Repository\n\nThis is a test repository for git operations.');
    execSync('git add README.md', { cwd: workspaceDir, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: workspaceDir, stdio: 'pipe' });
    
    log.success('Git repository initialized');
  } catch (error) {
    throw new Error(`Failed to initialize git repo: ${error.message}`);
  }
}

async function testBranchOperations(workspaceId) {
  log.step('Testing Branch Operations...');
  
  // Test 1: Get branches
  log.info('Getting branches...');
  const branchResponse = await makeRequest(`/api/workspaces/${workspaceId}/git/branch`);
  
  if (branchResponse.status === 200 && branchResponse.data.success) {
    log.success(`Found ${branchResponse.data.branches.length} branches`);
    
    const currentBranch = branchResponse.data.branches.find(b => b.current);
    if (currentBranch) {
      log.success(`Current branch: ${currentBranch.name}`);
    }
  } else {
    throw new Error(`Failed to get branches: ${branchResponse.status}`);
  }
  
  // Test 2: Create new branch
  log.info('Creating new branch...');
  const createResponse = await makeRequest(`/api/workspaces/${workspaceId}/git/branch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { branchName: 'feature/test-branch', baseBranch: 'main' }
  });
  
  if (createResponse.status === 200 && createResponse.data.success) {
    log.success('Branch created successfully');
  } else {
    throw new Error(`Failed to create branch: ${createResponse.status}`);
  }
  
  // Test 3: Switch branch
  log.info('Switching to main branch...');
  const switchResponse = await makeRequest(`/api/workspaces/${workspaceId}/git/branch`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: { branchName: 'main' }
  });
  
  if (switchResponse.status === 200 && switchResponse.data.success) {
    log.success('Branch switched successfully');
  } else {
    throw new Error(`Failed to switch branch: ${switchResponse.status}`);
  }
  
  // Test 4: Delete branch
  log.info('Deleting test branch...');
  const deleteResponse = await makeRequest(`/api/workspaces/${workspaceId}/git/branch?branch=feature/test-branch`, {
    method: 'DELETE'
  });
  
  if (deleteResponse.status === 200 && deleteResponse.data.success) {
    log.success('Branch deleted successfully');
  } else {
    throw new Error(`Failed to delete branch: ${deleteResponse.status}`);
  }
}

async function testGitStatus(workspaceId) {
  log.step('Testing Git Status...');
  
  const workspaceDir = path.join(process.cwd(), 'storage', 'workspaces', workspaceId);
  
  // Create some changes
  log.info('Creating test changes...');
  fs.writeFileSync(path.join(workspaceDir, 'test.txt'), 'This is a test file');
  fs.appendFileSync(path.join(workspaceDir, 'README.md'), '\n\nAdded some content');
  
  // Test git status
  log.info('Getting git status...');
  const statusResponse = await makeRequest(`/api/workspaces/${workspaceId}/git/status`);
  
  if (statusResponse.status === 200 && statusResponse.data.success) {
    const status = statusResponse.data.status;
    log.success(`Status loaded - ${status.unstaged.length} unstaged, ${status.untracked.length} untracked`);
    
    if (status.hasChanges) {
      log.success('Changes detected correctly');
    }
  } else {
    throw new Error(`Failed to get git status: ${statusResponse.status}`);
  }
  
  // Test staging files
  log.info('Staging files...');
  const stageResponse = await makeRequest(`/api/workspaces/${workspaceId}/git/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { action: 'stageAll' }
  });
  
  if (stageResponse.status === 200 && stageResponse.data.success) {
    log.success('Files staged successfully');
  } else {
    throw new Error(`Failed to stage files: ${stageResponse.status}`);
  }
}

async function testGitDiff(workspaceId) {
  log.step('Testing Git Diff...');
  
  // Test file diff
  log.info('Getting file diff...');
  const fileDiffResponse = await makeRequest(`/api/workspaces/${workspaceId}/git/diff?type=file&file=README.md`);
  
  if (fileDiffResponse.status === 200 && fileDiffResponse.data.success) {
    log.success('File diff retrieved successfully');
    
    if (fileDiffResponse.data.hasChanges) {
      log.success('Changes detected in file diff');
    }
  } else {
    throw new Error(`Failed to get file diff: ${fileDiffResponse.status}`);
  }
  
  // Test staged diff
  log.info('Getting staged diff...');
  const stagedDiffResponse = await makeRequest(`/api/workspaces/${workspaceId}/git/diff?type=staged`);
  
  if (stagedDiffResponse.status === 200 && stagedDiffResponse.data.success) {
    log.success('Staged diff retrieved successfully');
    
    if (stagedDiffResponse.data.hasChanges) {
      log.success('Staged changes detected correctly');
    }
  } else {
    throw new Error(`Failed to get staged diff: ${stagedDiffResponse.status}`);
  }
}

async function runTests() {
  log.title('Git Branch Operations Test Suite');
  
  let workspaceId = null;
  let testsPassed = 0;
  let testsTotal = 0;
  
  try {
    // Test 1: Server health check
    testsTotal++;
    log.info('Checking server health...');
    const healthResponse = await makeRequest('/api/health');
    
    if (healthResponse.status === 200) {
      log.success('Server is healthy');
      testsPassed++;
    } else {
      throw new Error(`Server health check failed: ${healthResponse.status}`);
    }
    
    // Test 2: Create workspace
    testsTotal++;
    workspaceId = await createTestWorkspace();
    testsPassed++;
    
    // Test 3: Initialize git repo
    testsTotal++;
    await initializeGitRepo(workspaceId);
    testsPassed++;
    
    // Test 4: Branch operations
    testsTotal++;
    await testBranchOperations(workspaceId);
    testsPassed++;
    
    // Test 5: Git status
    testsTotal++;
    await testGitStatus(workspaceId);
    testsPassed++;
    
    // Test 6: Git diff
    testsTotal++;
    await testGitDiff(workspaceId);
    testsPassed++;
    
    log.title('✅ All tests passed!');
    
  } catch (error) {
    log.error(`Test failed: ${error.message}`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  log.title('Git Branch Operations Test Summary');
  console.log('='.repeat(60));
  console.log(`${colors.bright}📊 Tests: ${testsPassed}/${testsTotal} passed (${Math.round(testsPassed/testsTotal*100)}%)${colors.reset}`);
  
  if (testsPassed === testsTotal) {
    console.log(`${colors.green}🎯 Overall Status: All tests passed!${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠️  Overall Status: Some tests failed${colors.reset}`);
  }
  
  if (workspaceId) {
    console.log(`${colors.cyan}🗂️  Test workspace: ${workspaceId}${colors.reset}`);
  }
  
  console.log('='.repeat(60));
  
  process.exit(testsPassed === testsTotal ? 0 : 1);
}

// Run the tests
runTests().catch(error => {
  log.error(`Test suite failed: ${error.message}`);
  process.exit(1);
});