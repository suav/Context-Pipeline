# Davin Remote Deployment Feature

## 🎯 Objective

Implement the first checkpoint of the parallel workspace testing system: deploying workspace changes to Davin's development server (`davinnsv2.davindev.com`) for remote testing.

## 🌐 Target Environment

### Davin Development Server
- **URL**: `https://davinnsv2.davindev.com`
- **Repository**: `git@github.com:Evpatarini/DavinEPV2.git`
- **Primary Branch**: `main`
- **Environment**: Healthcare application development server
- **Owner**: Neetigya Saxena (Davin Healthcare developer)

## 🏗️ Feature Architecture

Following the established feature-first organization:

```
src/features/
└── remote-deployment/
    ├── RemoteDeploymentUI.tsx      # "Deploy to Davin" interface
    ├── RemoteDeploymentAPI.ts      # API calls for deployment
    ├── RemoteDeploymentLogic.ts    # Business logic
    ├── RemoteDeploymentTypes.ts    # TypeScript types
    ├── components/
    │   ├── DavinDeploymentPanel.tsx
    │   ├── DeploymentStatus.tsx
    │   └── DeploymentLogs.tsx
    ├── services/
    │   ├── DavinGitManager.ts      # Git operations for Davin repo
    │   ├── DeploymentTracker.ts    # Track deployment status
    │   └── SyncScriptGenerator.ts  # Generate sync scripts
    └── README.md                   # Feature documentation
```

## 📋 User Workflow

### Step-by-Step Process

1. **Workspace Selection**
   ```
   [Workspace A: UI Polish] [Workspace B: Bug Fix] [Workspace C: New Feature]
   ☑ Selected            ☑ Selected          ☐ Not selected
   
   [🚀 Deploy to Davin Server] [🔍 Check Conflicts]
   ```

2. **Conflict Analysis** 
   ```
   ✅ Analyzing workspace compatibility...
   ✅ No conflicts detected between Workspace A and B
   ✅ Safe to deploy as combined branch
   ```

3. **Deployment Initiation**
   ```
   🌐 Deploying to davinnsv2.davindev.com
   📁 Creating combined branch: test-workspaces-A-B-20250630
   🔄 Pushing to Evpatarini/DavinEPV2.git
   📡 Triggering remote sync...
   ```

4. **Testing Access**
   ```
   ✅ Deployment successful!
   🔗 Test URL: https://test-workspaces-A-B-20250630.davindev.com
   ⏱️ Deployment completed in 2m 34s
   
   [🌐 Open Test Site] [📊 View Logs] [❌ Rollback]
   ```

## 🔧 Implementation Components

### 1. Remote Deployment Configuration

```typescript
// src/features/remote-deployment/RemoteDeploymentTypes.ts
interface DavinDeploymentConfig {
  // Target server configuration
  targetServer: {
    name: "Davin Development Server";
    baseUrl: "https://davinnsv2.davindev.com";
    testUrlPattern: "https://test-{branch}.davindev.com";
    sshHost: "davinnsv2.davindev.com";
    deployPath: "/var/www/davin-app";
  };
  
  // Repository configuration
  repository: {
    url: "git@github.com:Evpatarini/DavinEPV2.git";
    defaultBranch: "main";
    testBranchPrefix: "test-workspaces-";
    deploymentBranch: "deployment-staging";
  };
  
  // Deployment process
  deployment: {
    syncScript: "./scripts/sync-from-git.sh";
    buildScript: "npm run build";
    startScript: "pm2 restart davin-app";
    healthCheckUrl: "/api/health";
    maxDeploymentTime: 300000; // 5 minutes
  };
  
  // Notification settings
  notifications: {
    slackWebhook?: string;
    emailList: ["epatarini@davinhealthcare.com"];
    statusWebhook: "https://api.context-pipeline.local/deployment/status";
  };
}
```

### 2. Git Operations for Davin Repository

```typescript
// src/features/remote-deployment/services/DavinGitManager.ts
class DavinGitManager {
  private config: DavinDeploymentConfig;
  private localRepoPath: string;
  
  constructor(config: DavinDeploymentConfig) {
    this.config = config;
    this.localRepoPath = './temp/davin-repo-clone';
  }
  
  async deployWorkspaceCombination(
    workspaces: Workspace[], 
    combinationName: string
  ): Promise<DavinDeploymentResult> {
    try {
      // 1. Clone or update local copy of Davin repo
      await this.ensureLocalRepository();
      
      // 2. Create combined branch with workspace changes
      const branchName = await this.createCombinedBranch(workspaces, combinationName);
      
      // 3. Push branch to GitHub
      await this.pushBranchToGitHub(branchName);
      
      // 4. Trigger deployment on Davin server
      const deploymentId = await this.triggerRemoteDeployment(branchName);
      
      // 5. Monitor deployment progress
      const result = await this.monitorDeployment(deploymentId, branchName);
      
      return {
        success: true,
        branchName,
        testUrl: this.generateTestUrl(branchName),
        deploymentId,
        workspaceIds: workspaces.map(w => w.id),
        logs: result.logs
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        workspaceIds: workspaces.map(w => w.id)
      };
    }
  }
  
  private async ensureLocalRepository(): Promise<void> {
    if (!fs.existsSync(this.localRepoPath)) {
      // Clone repository
      await git.clone(this.config.repository.url, this.localRepoPath, {
        '--depth': 1,
        '--single-branch': true,
        '--branch': this.config.repository.defaultBranch
      });
    } else {
      // Update existing repository
      await git.cwd(this.localRepoPath);
      await git.checkout(this.config.repository.defaultBranch);
      await git.pull('origin', this.config.repository.defaultBranch);
    }
  }
  
  private async createCombinedBranch(
    workspaces: Workspace[], 
    combinationName: string
  ): Promise<string> {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const branchName = `${this.config.repository.testBranchPrefix}${combinationName}-${timestamp}`;
    
    await git.cwd(this.localRepoPath);
    await git.checkoutLocalBranch(branchName);
    
    // Apply changes from each workspace
    for (const workspace of workspaces) {
      await this.applyWorkspaceChanges(workspace);
    }
    
    // Commit combined changes
    const commitMessage = this.generateCombinedCommitMessage(workspaces);
    await git.add('.');
    await git.commit(commitMessage);
    
    return branchName;
  }
  
  private async applyWorkspaceChanges(workspace: Workspace): Promise<void> {
    // Get workspace changes from the target directory
    const workspaceTargetPath = `${workspace.path}/target/repo-clone`;
    
    if (fs.existsSync(workspaceTargetPath)) {
      // Copy changed files from workspace to the deployment repository
      const changedFiles = await this.getWorkspaceChangedFiles(workspace);
      
      for (const file of changedFiles) {
        const sourcePath = path.join(workspaceTargetPath, file);
        const destPath = path.join(this.localRepoPath, file);
        
        if (fs.existsSync(sourcePath)) {
          await fs.copy(sourcePath, destPath);
        }
      }
    }
  }
  
  private async triggerRemoteDeployment(branchName: string): Promise<string> {
    // Call webhook or SSH command to trigger deployment on Davin server
    const deploymentPayload = {
      branch: branchName,
      repository: this.config.repository.url,
      timestamp: new Date().toISOString(),
      requestedBy: 'workspace-testing-system'
    };
    
    // Option 1: Webhook approach (if Davin server has webhook endpoint)
    if (this.config.deployment.webhookUrl) {
      const response = await fetch(this.config.deployment.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deploymentPayload)
      });
      
      const result = await response.json();
      return result.deploymentId;
    }
    
    // Option 2: SSH command approach
    const deploymentId = generateId();
    await this.executeSshCommand(`
      cd ${this.config.targetServer.deployPath} &&
      git fetch origin &&
      git checkout ${branchName} &&
      git pull origin ${branchName} &&
      ${this.config.deployment.buildScript} &&
      ${this.config.deployment.startScript}
    `);
    
    return deploymentId;
  }
  
  private generateTestUrl(branchName: string): string {
    return this.config.targetServer.testUrlPattern.replace('{branch}', branchName);
  }
}
```

### 3. Deployment Status UI

```tsx
// src/features/remote-deployment/components/DavinDeploymentPanel.tsx
interface DavinDeploymentPanelProps {
  selectedWorkspaces: Workspace[];
  onDeploymentComplete: (result: DavinDeploymentResult) => void;
}

function DavinDeploymentPanel({ selectedWorkspaces, onDeploymentComplete }: DavinDeploymentPanelProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>('idle');
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([]);
  const [testUrl, setTestUrl] = useState<string>('');
  
  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeploymentStatus('preparing');
    
    try {
      // Generate combination name
      const combinationName = selectedWorkspaces
        .map(w => w.title.replace(/[^a-zA-Z0-9]/g, '-'))
        .join('-');
      
      // Start deployment
      const result = await deployToDavin(selectedWorkspaces, combinationName);
      
      if (result.success) {
        setTestUrl(result.testUrl);
        setDeploymentStatus('completed');
        onDeploymentComplete(result);
      } else {
        setDeploymentStatus('failed');
        console.error('Deployment failed:', result.error);
      }
      
    } catch (error) {
      setDeploymentStatus('failed');
      console.error('Deployment error:', error);
    } finally {
      setIsDeploying(false);
    }
  };
  
  return (
    <div className="davin-deployment-panel">
      <div className="deployment-header">
        <h3>🌐 Deploy to Davin Development Server</h3>
        <p>Target: davinnsv2.davindev.com</p>
      </div>
      
      <div className="selected-workspaces">
        <h4>Selected Workspaces ({selectedWorkspaces.length})</h4>
        <div className="workspace-list">
          {selectedWorkspaces.map(workspace => (
            <div key={workspace.id} className="workspace-item">
              <span className="workspace-title">{workspace.title}</span>
              <span className="workspace-id">{workspace.id}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="deployment-controls">
        <button 
          onClick={handleDeploy}
          disabled={isDeploying || selectedWorkspaces.length === 0}
          className="btn-primary deployment-button"
        >
          {isDeploying ? (
            <>🔄 Deploying...</>
          ) : (
            <>🚀 Deploy to Davin Server</>
          )}
        </button>
      </div>
      
      <DeploymentStatus 
        status={deploymentStatus}
        logs={deploymentLogs}
        testUrl={testUrl}
      />
    </div>
  );
}

function DeploymentStatus({ status, logs, testUrl }: DeploymentStatusProps) {
  const getStatusDisplay = () => {
    switch (status) {
      case 'preparing':
        return { icon: '⏳', text: 'Preparing deployment...', color: 'blue' };
      case 'deploying':
        return { icon: '🚀', text: 'Deploying to server...', color: 'blue' };
      case 'completed':
        return { icon: '✅', text: 'Deployment successful!', color: 'green' };
      case 'failed':
        return { icon: '❌', text: 'Deployment failed', color: 'red' };
      default:
        return { icon: '⚪', text: 'Ready to deploy', color: 'gray' };
    }
  };
  
  const statusDisplay = getStatusDisplay();
  
  return (
    <div className="deployment-status">
      <div className={`status-indicator ${statusDisplay.color}`}>
        <span className="status-icon">{statusDisplay.icon}</span>
        <span className="status-text">{statusDisplay.text}</span>
      </div>
      
      {testUrl && (
        <div className="test-url-section">
          <h4>🔗 Test Your Changes</h4>
          <div className="test-url">
            <a href={testUrl} target="_blank" rel="noopener noreferrer" className="test-link">
              {testUrl}
            </a>
            <button 
              onClick={() => navigator.clipboard.writeText(testUrl)}
              className="copy-button"
            >
              📋 Copy
            </button>
          </div>
        </div>
      )}
      
      {logs.length > 0 && (
        <div className="deployment-logs">
          <h4>📋 Deployment Logs</h4>
          <div className="logs-container">
            {logs.map((log, index) => (
              <div key={index} className="log-line">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

## 📁 Storage Integration

### Workspace Testing Component Extension

```json
// workspace-{id}/testing/davin-deployment.json
{
  "deploymentHistory": [
    {
      "id": "deploy-001",
      "timestamp": "2025-06-30T15:30:00Z",
      "branchName": "test-workspaces-ui-polish-bug-fix-20250630",
      "testUrl": "https://test-workspaces-ui-polish-bug-fix-20250630.davindev.com",
      "status": "completed",
      "workspaceIds": ["ws-ui-polish", "ws-bug-fix"],
      "deploymentDuration": 154000,
      "logs": [
        "Creating combined branch...",
        "Applying workspace changes...",
        "Pushing to GitHub...",
        "Triggering remote deployment...",
        "Deployment completed successfully"
      ]
    }
  ],
  "activeDeployments": [
    {
      "id": "deploy-002",
      "timestamp": "2025-06-30T16:00:00Z",
      "status": "deploying",
      "estimatedCompletion": "2025-06-30T16:05:00Z"
    }
  ]
}
```

### Feedback Component Integration

```json
// workspace-{id}/feedback/deployment-results.json
{
  "lastDeployment": {
    "deploymentId": "deploy-001",
    "success": true,
    "testUrl": "https://test-workspaces-ui-polish-bug-fix-20250630.davindev.com",
    "deployedAt": "2025-06-30T15:32:14Z",
    "userFeedback": {
      "tested": true,
      "status": "approved",
      "notes": "UI changes look great, bug fix working as expected",
      "testedBy": "epatarini@davinhealthcare.com",
      "testedAt": "2025-06-30T15:45:00Z"
    }
  }
}
```

## 🚀 Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `src/features/remote-deployment/` feature structure
- [ ] Implement `DavinGitManager` for git operations
- [ ] Set up deployment configuration
- [ ] Create basic UI components

### Phase 2: Git Integration
- [ ] Implement workspace change detection
- [ ] Create combined branch generation
- [ ] Add conflict detection for Davin deployments
- [ ] Test git operations with Davin repository

### Phase 3: Deployment Pipeline
- [ ] Implement remote deployment trigger
- [ ] Add deployment status monitoring
- [ ] Create webhook/SSH integration
- [ ] Add rollback capabilities

### Phase 4: User Interface
- [ ] Build deployment panel UI
- [ ] Add deployment status displays
- [ ] Implement test URL generation
- [ ] Add deployment logs viewer

### Phase 5: Testing & Validation
- [ ] Test with single workspace deployment
- [ ] Test with multiple workspace combinations
- [ ] Validate deployment URL access
- [ ] Test rollback functionality

This feature will enable users to select multiple workspaces, automatically combine their changes, deploy to Davin's development server, and get a test URL to validate their combined changes before creating pull requests.