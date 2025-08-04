const fs = require('fs').promises;
const path = require('path');
const http = require('http');
// Import our comprehensive test
const { testComprehensiveWorkflow } = require('./test-comprehensive');
async function setupTestingFramework() {
  console.log('🛠️ Setting up Context Pipeline Testing Framework...\n');
  try {
    // 1. Create analysis directory structure
    const analysisDir = path.join(__dirname, '../analysis');
    await fs.mkdir(analysisDir, { recursive: true });
    await fs.mkdir(path.join(analysisDir, 'reports'), { recursive: true });
    await fs.mkdir(path.join(analysisDir, 'screenshots'), { recursive: true });
    await fs.mkdir(path.join(analysisDir, 'logs'), { recursive: true });
    console.log('✅ Created analysis directory structure');
    // 2. Check server availability
    const isServerRunning = await checkServerHealth();
    console.log(`✅ Server health check: ${isServerRunning ? 'Running' : 'Not available'}`);
    if (!isServerRunning) {
      console.log('⚠️ Server not running. Please start with: npm start');
      return false;
    }
    // 3. Run comprehensive test suite
    console.log('\n🧪 Running comprehensive test suite...');
    const testResults = await testComprehensiveWorkflow();
    // 4. Generate testing documentation
    await generateTestingGuide(testResults);
    console.log('✅ Generated testing guide for future agents');
    // 5. Create workspace navigation instructions
    await generateNavigationGuide();
    console.log('✅ Created navigation guide');
    // 6. Generate feature matrix
    await generateFeatureMatrix(testResults);
    console.log('✅ Generated feature matrix');
    console.log('\n🎯 Testing framework setup complete!');
    console.log('📁 All files available in ./analysis/ directory');
    return true;
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    return false;
  }
}
async function checkServerHealth() {
  try {
    const result = await makeRequest('http://localhost:3001/api/health');
    return result.status === 200;
  } catch (error) {
    return false;
  }
}
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}
async function generateTestingGuide(testResults) {
  const guide = `# Context Pipeline - Testing Guide for Agents
## Overview
This guide enables AI agents to test Context Pipeline functionality without requiring browser automation tools like Puppeteer.
## Quick Start
\`\`\`bash
# 1. Ensure server is running
npm start
# 2. Run comprehensive tests
node scripts/test-comprehensive.js
# 3. Check results
cat analysis/comprehensive-test-results.json
\`\`\`
## Test Results Summary
**Last Test Run**: ${testResults.timestamp}
**Overall Health**: ${testResults.summary?.overallHealth || 'Unknown'}
**Success Rate**: ${testResults.summary ? Math.round(testResults.summary.passedTests/testResults.summary.totalTests*100) : 0}%
## Available Test Scripts
### 1. Comprehensive Feature Test
\`\`\`bash
node scripts/test-comprehensive.js
\`\`\`
Tests all major features:
- API endpoints health
- Context import simulation
- Workspace creation
- Agent integration
- File operations
- UI analysis
### 2. Simple Analysis
\`\`\`bash
node scripts/analyze-app-simple.js
\`\`\`
Basic UI and API analysis without complex workflows.
### 3. Full Workflow Test
\`\`\`bash
node scripts/test-full-workflow.js
\`\`\`
Tests end-to-end workflows including actual workspace creation.
## API Testing Patterns
### Health Check
\`\`\`javascript
const result = await makeRequest('http://localhost:3001/api/health');
// Expected: { status: 'healthy', timestamp: '...', pipeline: 'context-import-v2-nextjs' }
\`\`\`
### Create Workspace
\`\`\`javascript
const workspaceDraft = {
  id: 'test-workspace-' + Date.now(),
  name: 'Test Workspace',
  context_items: [/* context items */],
  // ... other fields
};
const result = await makeRequest('http://localhost:3001/api/workspaces', {
  method: 'POST',
  body: { action: 'publish', workspaceDraft }
});
\`\`\`
### Test Agent Integration
\`\`\`javascript
const agents = await makeRequest(\`http://localhost:3001/api/workspaces/\${workspaceId}/agents\`);
const status = await makeRequest(\`http://localhost:3001/api/workspaces/\${workspaceId}/agents/status\`);
\`\`\`
## Expected Test Results
### Working Features ✅
- API health endpoints
- Workspace creation and management
- Context import system (with external API config)
- Agent integration endpoints
- File operations
- Basic UI rendering
### Features That Load On-Demand ⏳
- Monaco editor (loads with active workspace)
- Terminal interface (loads with agent deployment)
- File explorer (loads with workspace files)
### Known Limitations ⚠️
- External API integrations require authentication
- Git operations require actual repositories
- Agent CLI tools must be installed for full functionality
## Troubleshooting
### Server Not Responding
\`\`\`bash
# Check if server is running
curl http://localhost:3001/api/health
# Start server if needed
npm start
\`\`\`
### Test Failures
- Check server logs for errors
- Verify all dependencies are installed
- Ensure storage directory permissions
### Browser Testing (Advanced)
If Puppeteer is needed:
\`\`\`bash
# Install system dependencies (Ubuntu/Debian)
sudo apt-get install chromium-browser
# Or install Chrome
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
sudo apt-get update
sudo apt-get install google-chrome-stable
\`\`\`
## For Future Development
When adding new features:
1. Add corresponding test in \`test-comprehensive.js\`
2. Update expected results in this guide
3. Document new API endpoints or UI elements
4. Run full test suite to ensure no regressions
## Test Automation
This testing framework is designed to be:
- **Environment Independent**: Works in WSL, Linux, Docker
- **Browser Free**: No GUI dependencies
- **Comprehensive**: Tests all major functionality
- **Agent Friendly**: Clear success/failure indicators
Use these tests to validate Context Pipeline functionality before and after making changes.
`;
  await fs.writeFile(
    path.join(__dirname, '../analysis/TESTING_GUIDE.md'),
    guide
  );
}
async function generateNavigationGuide() {
  const guide = `# Context Pipeline - Navigation Guide for Agents
## Application Flow
### 1. Homepage (http://localhost:3001)
- **What you see**: Workspace Workshop interface
- **Key elements**:
  - Sidebar with "New Workspace" button
  - Settings button (☰) in top-right
  - Empty state if no workspaces exist
### 2. Creating Context
**Path**: Click "New Workspace" → "Import from Library"
- Opens library view with import button
- Click "Import" to access context import modal
- Select source (JIRA, Git, File, etc.)
- Choose query template or create custom
- Execute query to find context items
- Add items to library
### 3. Creating Workspaces
**Path**: Library → Select items → "Make Workspace"
- Select context items from library
- Choose creation mode:
  - "All Together": One workspace with all items
  - "For Each": Separate workspace per item
- Workspace gets created with 4-component structure
### 4. Working in Workspaces
**Path**: Sidebar → Select workspace
- Workspace opens in IDE-like interface
- **Left**: File explorer (if files exist)
- **Center**: Monaco editor area
- **Right**: Terminal/chat area for agents
- **Bottom**: Status and feedback
### 5. Agent Deployment
**Path**: Workspace → Agent button/tab
- Agent tabs appear in terminal area
- Click "+" to deploy new agent
- Select Claude or Gemini
- Agent loads with workspace context
- Chat interface for interaction
### 6. Settings and Configuration
**Path**: Settings button (☰)
- Credentials management
- Theme selection
- Agent management
- Triggers configuration
## Testing Navigation Programmatically
### Check Homepage Elements
\`\`\`javascript
const html = await getPageHTML('http://localhost:3001');
const hasWorkspaceButton = html.includes('New Workspace');
const hasSettings = html.includes('Settings') || html.includes('☰');
\`\`\`
### Test Context Import Flow
\`\`\`javascript
// Check import templates
const jiraTemplates = await makeRequest('/api/context-workflow/queries/jira');
const gitTemplates = await makeRequest('/api/context-workflow/queries/git');
// Simulate import
const importResult = await makeRequest('/api/context-workflow/import', {
  method: 'POST',
  body: { source: 'git', searchParams: 'anthropics/claude-cli' }
});
\`\`\`
### Test Workspace Creation
\`\`\`javascript
// Create workspace
const workspace = await createTestWorkspace();
const workspaceId = workspace.workspaceId;
// Check workspace files
const files = await makeRequest(\`/api/workspaces/\${workspaceId}/files\`);
const status = await makeRequest(\`/api/workspaces/\${workspaceId}/status\`);
\`\`\`
### Test Agent Integration
\`\`\`javascript
// Check agent endpoints
const agents = await makeRequest(\`/api/workspaces/\${workspaceId}/agents\`);
const agentStatus = await makeRequest(\`/api/workspaces/\${workspaceId}/agents/status\`);
// Note: Actual agent deployment requires CLI tools
\`\`\`
## UI State Expectations
### Empty State
- No workspaces: Shows welcome screen with "Create New Workspace"
- No library items: Shows empty library with "Import" option
### With Workspaces
- Sidebar shows workspace list
- Click workspace to enter IDE view
- File tree, editor, and terminal areas visible
### With Agents
- Agent tabs appear in terminal area
- Chat interface for each agent
- Status indicators show agent activity
## Common Testing Scenarios
### 1. Fresh Installation Test
\`\`\`javascript
// Should show welcome screen
// Should allow workspace creation
// Should handle empty library gracefully
\`\`\`
### 2. Content Import Test
\`\`\`javascript
// Should show import modal
// Should load query templates
// Should handle API authentication gracefully
\`\`\`
### 3. Workspace Functionality Test
\`\`\`javascript
// Should create workspace structure
// Should show files and context
// Should enable agent deployment
\`\`\`
This guide helps agents understand the expected user flow and test each step programmatically.
`;
  await fs.writeFile(
    path.join(__dirname, '../analysis/NAVIGATION_GUIDE.md'),
    guide
  );
}
async function generateFeatureMatrix(testResults) {
  const matrix = {
    timestamp: new Date().toISOString(),
    features: {
      'Workspace Management': {
        implemented: true,
        tested: testResults.tests?.workspaceCreation?.success || false,
        notes: 'Full CRUD operations, file structure creation'
      },
      'Context Import': {
        implemented: true,
        tested: testResults.tests?.contextImport ? true : false,
        notes: 'JIRA and Git import, requires external API config'
      },
      'Agent Integration': {
        implemented: true,
        tested: testResults.tests?.agentIntegration ? true : false,
        notes: 'Claude and Gemini CLI integration, streaming responses'
      },
      'File Operations': {
        implemented: true,
        tested: testResults.tests?.fileOperations ? true : false,
        notes: 'File tree, Monaco editor, read/write operations'
      },
      'Git Integration': {
        implemented: 'partial',
        tested: false,
        notes: 'Diff viewing implemented, commit/push planned'
      },
      'Permission System': {
        implemented: 'partial',
        tested: false,
        notes: 'UI exists, full injection system needed'
      },
      'Agent Checkpoints': {
        implemented: 'partial',
        tested: false,
        notes: 'Session IDs saved, full save/restore needed'
      },
      'Dynamic Triggers': {
        implemented: false,
        tested: false,
        notes: 'Planned feature, not implemented'
      }
    },
    apis: {
      'Health Check': { status: 'working', path: '/api/health' },
      'Workspaces': { status: 'working', path: '/api/workspaces' },
      'Context Library': { status: 'working', path: '/api/context-workflow/library' },
      'Query Templates': { status: 'working', path: '/api/context-workflow/queries/*' },
      'Agent Management': { status: 'working', path: '/api/workspaces/*/agents' },
      'File Operations': { status: 'working', path: '/api/workspaces/*/files' },
      'Git Operations': { status: 'partial', path: '/api/workspaces/*/git' }
    },
    ui_components: {
      'Workspace Workshop': { status: 'working', loads: 'immediately' },
      'Settings Sidebar': { status: 'working', loads: 'on_click' },
      'Import Modal': { status: 'working', loads: 'on_click' },
      'Monaco Editor': { status: 'working', loads: 'with_workspace' },
      'Terminal Interface': { status: 'working', loads: 'with_agent' },
      'File Explorer': { status: 'working', loads: 'with_files' }
    }
  };
  await fs.writeFile(
    path.join(__dirname, '../analysis/feature-matrix.json'),
    JSON.stringify(matrix, null, 2)
  );
}
// Run setup if called directly
if (require.main === module) {
  setupTestingFramework().then(success => {
    if (success) {
      console.log('\n🎉 Testing framework ready!');
      console.log('\n📖 Next steps:');
      console.log('   • Read analysis/TESTING_GUIDE.md for comprehensive testing');
      console.log('   • Read analysis/NAVIGATION_GUIDE.md for UI navigation');
      console.log('   • Check analysis/feature-matrix.json for feature status');
      console.log('   • Run node scripts/test-comprehensive.js anytime');
    } else {
      console.log('\n❌ Setup incomplete. Check errors above.');
    }
  });
}
module.exports = { setupTestingFramework };