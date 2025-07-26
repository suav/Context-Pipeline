// Workspace Scripts Type Definitions

export interface WorkspaceScript {
  id: string;
  name: string;
  description: string;
  command: string;
  type: 'deploy' | 'test' | 'build' | 'submit' | 'custom';
  environment?: 'development' | 'staging' | 'production';
  requiresConfirmation?: boolean;
  estimatedDuration?: number; // in seconds
}

export interface WorkspaceScriptConfig {
  workspaceId: string;
  scripts: WorkspaceScript[];
  gitIntegration: {
    enabled: boolean;
    autoCommitBeforeDeploy?: boolean;
    autoTagOnSubmit?: boolean;
    targetBranch?: string;
    testingBranch?: string;
    productionBranch?: string;
  };
  deployProtocol: {
    enabled: boolean;
    testEnvironmentUrl?: string;
    stagingEnvironmentUrl?: string;
    productionEnvironmentUrl?: string;
    requiresApproval?: boolean;
    approvalUsers?: string[];
  };
  submitProtocol: {
    enabled: boolean;
    requiresTesting?: boolean;
    requiresReview?: boolean;
    targetEnvironment: 'staging' | 'production';
    notificationChannels?: string[];
  };
}

export interface ScriptExecution {
  id: string;
  scriptId: string;
  workspaceId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  output: string[];
  errorOutput?: string[];
  exitCode?: number;
  triggeredBy: string;
}

export interface DeploymentRecord {
  id: string;
  workspaceId: string;
  environment: string;
  deploymentUrl?: string;
  gitCommitHash?: string;
  gitBranch?: string;
  status: 'pending' | 'deploying' | 'deployed' | 'failed' | 'rolled-back';
  deployedAt: string;
  triggeredBy: string;
  scriptExecutions: string[]; // ScriptExecution IDs
}

export interface SubmissionRecord {
  id: string;
  workspaceId: string;
  status: 'submitted' | 'under-review' | 'approved' | 'rejected' | 'merged';
  submittedAt: string;
  submittedBy: string;
  reviewers?: string[];
  targetEnvironment: string;
  gitPullRequestUrl?: string;
  deploymentRecord?: string; // DeploymentRecord ID
  comments?: string;
}