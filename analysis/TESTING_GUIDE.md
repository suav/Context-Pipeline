# Context Pipeline - Testing Guide for Agents
## Overview
This guide enables AI agents to test Context Pipeline functionality without requiring browser automation tools like Puppeteer.
## Quick Start
```bash
# 1. Ensure server is running
npm start
# 2. Run comprehensive tests
node scripts/test-comprehensive.js
# 3. Check results
cat analysis/comprehensive-test-results.json
```
## Test Results Summary
**Last Test Run**: 2025-07-08T00:36:39.402Z
**Overall Health**: Good
**Success Rate**: 85%
## Available Test Scripts
### 1. Comprehensive Feature Test
```bash
node scripts/test-comprehensive.js
```
Tests all major features:
- API endpoints health
- Context import simulation
- Workspace creation
- Agent integration
- File operations
- UI analysis
### 2. Simple Analysis
```bash
node scripts/analyze-app-simple.js
```
Basic UI and API analysis without complex workflows.
### 3. Full Workflow Test
```bash
node scripts/test-full-workflow.js
```
Tests end-to-end workflows including actual workspace creation.
## API Testing Patterns
### Health Check
```javascript
const result = await makeRequest('http://localhost:3001/api/health');
// Expected: { status: 'healthy', timestamp: '...', pipeline: 'context-import-v2-nextjs' }
```
### Create Workspace
```javascript
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
```
### Test Agent Integration
```javascript
const agents = await makeRequest(`http://localhost:3001/api/workspaces/${workspaceId}/agents`);
const status = await makeRequest(`http://localhost:3001/api/workspaces/${workspaceId}/agents/status`);
```
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
```bash
# Check if server is running
curl http://localhost:3001/api/health
# Start server if needed
npm start
```
### Test Failures
- Check server logs for errors
- Verify all dependencies are installed
- Ensure storage directory permissions
### Browser Testing (Advanced)
If Puppeteer is needed:
```bash
# Install system dependencies (Ubuntu/Debian)
sudo apt-get install chromium-browser
# Or install Chrome
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
sudo apt-get update
sudo apt-get install google-chrome-stable
```
## For Future Development
When adding new features:
1. Add corresponding test in `test-comprehensive.js`
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