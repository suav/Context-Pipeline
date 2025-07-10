# Context Pipeline - Navigation Guide for Agents
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
```javascript
const html = await getPageHTML('http://localhost:3001');
const hasWorkspaceButton = html.includes('New Workspace');
const hasSettings = html.includes('Settings') || html.includes('☰');
```
### Test Context Import Flow
```javascript
// Check import templates
const jiraTemplates = await makeRequest('/api/context-workflow/queries/jira');
const gitTemplates = await makeRequest('/api/context-workflow/queries/git');
// Simulate import
const importResult = await makeRequest('/api/context-workflow/import', {
  method: 'POST',
  body: { source: 'git', searchParams: 'anthropics/claude-cli' }
});
```
### Test Workspace Creation
```javascript
// Create workspace
const workspace = await createTestWorkspace();
const workspaceId = workspace.workspaceId;
// Check workspace files
const files = await makeRequest(`/api/workspaces/${workspaceId}/files`);
const status = await makeRequest(`/api/workspaces/${workspaceId}/status`);
```
### Test Agent Integration
```javascript
// Check agent endpoints
const agents = await makeRequest(`/api/workspaces/${workspaceId}/agents`);
const agentStatus = await makeRequest(`/api/workspaces/${workspaceId}/agents/status`);
// Note: Actual agent deployment requires CLI tools
```
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
```javascript
// Should show welcome screen
// Should allow workspace creation
// Should handle empty library gracefully
```
### 2. Content Import Test
```javascript
// Should show import modal
// Should load query templates
// Should handle API authentication gracefully
```
### 3. Workspace Functionality Test
```javascript
// Should create workspace structure
// Should show files and context
// Should enable agent deployment
```
This guide helps agents understand the expected user flow and test each step programmatically.