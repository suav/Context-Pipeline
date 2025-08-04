export interface DavinDeploymentConfig {
  // Target server configuration
  targetServer: {
    name: string;
    baseUrl: string;
    testUrlPattern: string;
    sshHost: string;
    deployPath: string;
  };
  // Repository configuration
  repository: {
    url: string;
    defaultBranch: string;
    testBranchPrefix: string;
    deploymentBranch: string;
  };
  // Deployment process
  deployment: {
    syncScript: string;
    buildScript: string;
    startScript: string;
    healthCheckUrl: string;
    maxDeploymentTime: number;
    webhookUrl?: string;
  };
  // SSH configuration for direct git operations
  ssh: {
    host: string;
    user: string;
    port?: number;
    keyPath?: string;
    gitRemoteName: string;
    repositoryPath: string;
    useForceWithLease: boolean;
  };
  // Notification settings
  notifications: {
    slackWebhook?: string;
    emailList: string[];
    statusWebhook: string;
  };
}
export interface DavinDeploymentResult {
  success: boolean;
  branchName?: string;
  testUrl?: string;
  deploymentId?: string;
  workspaceIds: string[];
  logs?: string[];
  error?: string;
}
export interface DeploymentStatus {
  id: string;
  status: 'idle' | 'preparing' | 'deploying' | 'completed' | 'failed';
  branchName?: string;
  testUrl?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  logs: string[];
}
export interface WorkspaceDeploymentHistory {
  deploymentId: string;
  timestamp: string;
  branchName: string;
  testUrl: string;
  status: 'completed' | 'failed' | 'rolled-back';
  workspaceIds: string[];
  deploymentDuration: number;
  logs: string[];
  userFeedback?: {
    tested: boolean;
    status: 'approved' | 'rejected' | 'needs-changes';
    notes: string;
    testedBy: string;
    testedAt: string;
  };
}
// Default configuration for Davin Healthcare development environment
export const defaultDavinConfig: DavinDeploymentConfig = {
  targetServer: {
    name: "Davin Development Server",
    baseUrl: "https://davinepv2.davindev.com",
    testUrlPattern: "https://test-{branch}.davindev.com",
    sshHost: "davinepv2.davindev.com",
    deployPath: "/var/www/davin-app"
  },
  repository: {
    url: "git@github.com:Evpatarini/DavinEPV2.git",
    defaultBranch: "main",
    testBranchPrefix: "test-workspaces-",
    deploymentBranch: "deployment-staging"
  },
  deployment: {
    syncScript: "./scripts/sync-from-git.sh",
    buildScript: "npm run build",
    startScript: "pm run restart davin-app",
    healthCheckUrl: "/api/health",
    maxDeploymentTime: 300000, // 5 minutes
    webhookUrl: process.env.DAVIN_DEPLOYMENT_WEBHOOK
  },
  // SSH configuration for direct git push workflow
  ssh: {
    host: "davinepv2.davindev.com",
    user: process.env.DAVIN_SSH_USER || "deploy",
    port: 22,
    keyPath: process.env.DAVIN_SSH_KEY_PATH || "~/.ssh/davin_deploy_key",
    gitRemoteName: "testserver",
    repositoryPath: "/var/www/davin-app",
    useForceWithLease: true
  },
  notifications: {
    emailList: ["epatarini@davinhealthcare.com"],
    statusWebhook: process.env.CONTEXT_PIPELINE_WEBHOOK || "http://localhost:3000/api/deployment/status"
  }
};
// Environment-specific configurations
export const getDavinConfig = (environment: 'development' | 'staging' | 'production' = 'development'): DavinDeploymentConfig => {
  const baseConfig = { ...defaultDavinConfig };
  switch (environment) {
    case 'staging':
      return {
        ...baseConfig,
        targetServer: {
          ...baseConfig.targetServer,
          baseUrl: "https://davinstaging.davindev.com",
          testUrlPattern: "https://test-{branch}.staging.davindev.com"
        }
      };
    case 'production':
      return {
        ...baseConfig,
        targetServer: {
          ...baseConfig.targetServer,
          baseUrl: "https://davin.davinhealthcare.com",
          testUrlPattern: "https://test-{branch}.davinhealthcare.com"
        },
        deployment: {
          ...baseConfig.deployment,
          maxDeploymentTime: 600000 // 10 minutes for production
        }
      };
    default:
      return baseConfig;
  }
};
// Validation utilities
export const validateDavinConfig = (config: DavinDeploymentConfig): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (!config.repository.url) {
    errors.push("Repository URL is required");
  }
  if (!config.targetServer.baseUrl) {
    errors.push("Target server base URL is required");
  }
  if (!config.deployment.healthCheckUrl) {
    errors.push("Health check URL is required");
  }
  if (config.deployment.maxDeploymentTime < 60000) {
    errors.push("Max deployment time must be at least 1 minute");
  }
  return {
    valid: errors.length === 0,
    errors
  };
};
// Utility functions
export const generateBranchName = (workspaceIds: string[]): string => {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const workspaceNames = workspaceIds
    .map(id => id.replace(/[^a-zA-Z0-9]/g, '-'))
    .join('-');
  return `${defaultDavinConfig.repository.testBranchPrefix}${workspaceNames}-${timestamp}`;
};
export const generateTestUrl = (branchName: string, config: DavinDeploymentConfig = defaultDavinConfig): string => {
  return config.targetServer.testUrlPattern.replace('{branch}', branchName);
};
export const generateDeploymentId = (): string => {
  return `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};