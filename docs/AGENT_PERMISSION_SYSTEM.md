# Agent Permission System

## Permission Philosophy

The permission system ensures agents can do everything they need within their workspace scope while preventing any unauthorized actions outside that boundary. All permissions are workspace-scoped and role-based.

## Core Permission Structure

### 1. Workspace Boundary Enforcement
```typescript
interface WorkspaceBoundary {
  workspace_root: string;           // Absolute path to workspace root
  allowed_paths: {
    context: {
      path: string;                // workspace-id/context/
      permissions: ['read'];       // Read-only access to context
    };
    target: {
      path: string;                // workspace-id/target/
      permissions: ['read', 'write', 'create', 'edit'];
    };
    feedback: {
      path: string;                // workspace-id/feedback/
      permissions: ['read', 'write', 'create', 'edit'];
    };
    agents: {
      path: string;                // workspace-id/agents/
      permissions: ['read'];       // Can read other agent states
      own_agent_path: string;      // Can write to own agent folder
    };
  };
  
  // Strict boundaries
  cannot_access: string[];         // Paths explicitly forbidden
  parent_directory_access: false;  // Cannot access ../
  symlink_following: false;        // Cannot follow symlinks outside workspace
  
  // Special file handling
  deletion_safety: {
    requires_approval: string[];   // File patterns requiring approval
    forbidden_deletions: string[]; // Files that cannot be deleted
    deletion_log: string;         // Log all deletion requests
  };
}
```

### 2. File System Permissions
```typescript
interface FileSystemPermissions {
  // Context folder (Read-only)
  context_access: {
    read_files: boolean;           // Can read context files
    list_directory: boolean;       // Can see what files exist
    read_metadata: boolean;        // Can read file metadata
    search_content: boolean;       // Can search within files
    
    // Forbidden operations
    write_files: false;
    delete_files: false;
    create_files: false;
    modify_permissions: false;
  };
  
  // Target folder (Read/Write)
  target_access: {
    read_files: boolean;
    write_files: boolean;
    create_files: boolean;
    edit_files: boolean;
    delete_files: boolean;         // With approval system
    rename_files: boolean;
    create_directories: boolean;
    
    // Restrictions
    max_file_size: number;         // Prevent huge file creation
    allowed_extensions: string[];  // Restrict file types if needed
    backup_before_edit: boolean;   // Auto-backup before changes
  };
  
  // Feedback folder (Read/Write)
  feedback_access: {
    read_files: boolean;
    write_files: boolean;
    create_files: boolean;
    append_files: boolean;         // For logs
    
    // Special files
    can_write_status: boolean;     // status.json
    can_write_progress: boolean;   // progress.json
    can_write_logs: boolean;       // Agent execution logs
    can_request_deletions: boolean; // deletion-requests.json
  };
}
```

### 3. Git Operation Permissions
```typescript
interface GitPermissions {
  // Read operations (generally allowed)
  git_status: boolean;             // git status
  git_diff: boolean;               // git diff
  git_log: boolean;                // git log
  git_show: boolean;               // git show
  git_blame: boolean;              // git blame
  
  // Write operations (controlled)
  git_add: boolean;                // git add (stage files)
  git_commit: boolean;             // git commit
  git_stash: boolean;              // git stash
  
  // Restricted operations
  git_push: false;                 // Never allowed for agents
  git_pull: false;                 // Handled by workspace sync
  git_merge: false;                // Handled by version control system
  git_rebase: false;               // Too dangerous for agents
  git_reset: false;                // Could lose work
  
  // Branch operations
  git_branch: boolean;             // Can create/list branches
  git_checkout: boolean;           // Can switch branches (with restrictions)
  
  // Safety measures
  commit_message_required: boolean;
  max_commits_per_session: number;
  require_staged_changes: boolean; // Must use git add first
}
```

### 4. Command Execution Permissions
```typescript
interface CommandPermissions {
  // Bash command categories
  file_operations: {
    allowed: string[];             // ['ls', 'cat', 'head', 'tail', 'find', 'grep']
    forbidden: string[];           // ['rm', 'mv', 'cp'] - use file APIs instead
    requires_approval: string[];   // ['chmod', 'chown']
  };
  
  // System operations
  system_info: {
    allowed: string[];             // ['pwd', 'whoami', 'date', 'env']
    forbidden: string[];           // ['sudo', 'su', 'passwd', 'kill']
  };
  
  // Network operations
  network: {
    allowed: string[];             // ['curl', 'wget'] - for API calls
    forbidden: string[];           // ['ssh', 'scp', 'ftp', 'telnet']
    rate_limited: string[];        // Prevent DoS attacks
  };
  
  // Development tools
  development: {
    build_tools: string[];         // ['npm', 'yarn', 'make', 'cargo', 'mvn']
    test_runners: string[];        // ['jest', 'pytest', 'go test']
    linters: string[];             // ['eslint', 'pylint', 'rustfmt']
    
    // Restrictions
    no_global_installs: boolean;   // Prevent global package installs
    sandbox_execution: boolean;    // Run in contained environment
  };
  
  // Command safety
  timeout_seconds: number;         // Kill long-running commands
  max_concurrent: number;          // Limit parallel execution
  resource_limits: {
    max_memory_mb: number;
    max_cpu_percent: number;
    max_disk_write_mb: number;
  };
}
```

### 5. Approval System
```typescript
interface ApprovalSystem {
  // Deletion requests
  file_deletions: {
    auto_approve: string[];        // Safe patterns: ['*.tmp', '*.log']
    require_approval: string[];    // Important files: ['*.js', '*.ts', '*.py']
    forbidden: string[];           // Critical files: ['package.json', '.git/*']
    
    approval_timeout: number;      // Auto-reject after timeout
    batch_approvals: boolean;      // Allow approving multiple files
  };
  
  // Dangerous operations
  system_changes: {
    permission_changes: 'require_approval';
    environment_variables: 'require_approval';
    external_network_calls: 'require_approval';
    large_file_operations: 'require_approval'; // > 10MB
  };
  
  // Approval UI
  approval_notifications: {
    in_terminal: boolean;          // Show in terminal UI
    desktop_notification: boolean;
    email_notification: boolean;
    
    approval_context: {
      show_file_preview: boolean;
      show_impact_analysis: boolean;
      show_undo_option: boolean;
    };
  };
}
```

## Permission Roles and Templates

### 1. Agent Role Templates
```typescript
interface AgentRoleTemplate {
  // Investigation Agent (Safe, broad access)
  investigator: {
    description: "Can read and analyze all workspace content";
    permissions: {
      context_access: 'full_read';
      target_access: 'read_only';
      feedback_access: 'write_logs_and_reports';
      git_permissions: 'read_only';
      bash_commands: 'safe_read_commands';
      approvals_required: 'none';
    };
  };
  
  // Development Agent (Full workspace access)
  developer: {
    description: "Can modify code and create files";
    permissions: {
      context_access: 'full_read';
      target_access: 'full_write';
      feedback_access: 'full_write';
      git_permissions: 'stage_and_commit';
      bash_commands: 'development_tools';
      approvals_required: 'deletions_only';
    };
  };
  
  // Documentation Agent (Limited write access)
  documenter: {
    description: "Can create and edit documentation";
    permissions: {
      context_access: 'full_read';
      target_access: 'write_docs_only';  // *.md, *.txt, docs/ folder
      feedback_access: 'write_reports';
      git_permissions: 'commit_docs';
      bash_commands: 'safe_commands';
      approvals_required: 'deletions_and_renames';
    };
  };
  
  // Testing Agent (Test-focused permissions)
  tester: {
    description: "Can run tests and analyze results";
    permissions: {
      context_access: 'full_read';
      target_access: 'read_and_test_files';
      feedback_access: 'write_test_reports';
      git_permissions: 'read_only';
      bash_commands: 'test_runners_and_tools';
      approvals_required: 'all_modifications';
    };
  };
}
```

### 2. Custom Permission Builder
```typescript
interface PermissionBuilder {
  // Base template
  base_template: AgentRoleTemplate;
  
  // Custom overrides
  custom_overrides: {
    additional_commands: string[];
    restricted_paths: string[];
    elevated_permissions: ElevatedPermission[];
    reduced_permissions: string[];
  };
  
  // Workspace-specific rules
  workspace_rules: {
    required_approvals: string[];
    forbidden_operations: string[];
    special_file_handling: Record<string, PermissionRule>;
  };
  
  // Validation
  validate(): PermissionValidationResult;
  preview(): PermissionSummary;
  save(): AgentPermissions;
}

interface ElevatedPermission {
  operation: string;
  justification: string;
  requires_user_approval: boolean;
  expires_after: string;          // Duration or "never"
}
```

## Permission Enforcement Engine

### 1. Runtime Permission Checking
```typescript
interface PermissionEnforcer {
  // File system checks
  checkFileAccess(agentId: string, filePath: string, operation: FileOperation): Promise<PermissionResult>;
  
  // Command execution checks
  checkCommandPermission(agentId: string, command: string, args: string[]): Promise<PermissionResult>;
  
  // Git operation checks
  checkGitOperation(agentId: string, gitCommand: string): Promise<PermissionResult>;
  
  // Batch permission checks
  checkBatchOperations(agentId: string, operations: Operation[]): Promise<BatchPermissionResult>;
  
  // Permission escalation
  requestPermissionEscalation(agentId: string, operation: string, justification: string): Promise<EscalationResult>;
}

interface PermissionResult {
  allowed: boolean;
  reason?: string;
  requires_approval?: boolean;
  approval_context?: ApprovalContext;
  suggested_alternative?: string;
}
```

### 2. Audit and Monitoring
```typescript
interface PermissionAuditLog {
  timestamp: string;
  agent_id: string;
  operation: string;
  permission_check: PermissionResult;
  actual_execution: boolean;
  user_intervention?: string;
  
  // Context
  file_paths?: string[];
  command_executed?: string;
  git_operation?: string;
  
  // Security flags
  boundary_violation_attempt: boolean;
  permission_escalation_used: boolean;
  approval_overridden: boolean;
}

interface SecurityMonitoring {
  // Real-time monitoring
  detectAnomalousPermissionRequests(agentId: string): SecurityAlert[];
  detectBoundaryViolationAttempts(agentId: string): SecurityAlert[];
  detectPermissionEscalationPatterns(agentId: string): SecurityAlert[];
  
  // Reporting
  generateSecurityReport(workspaceId: string, period: DateRange): SecurityReport;
  generatePermissionUsageReport(agentId: string): PermissionUsageReport;
}
```

This permission system ensures:
- ✅ Strict workspace boundary enforcement
- ✅ Role-based permission templates
- ✅ Safe deletion approval system
- ✅ Git operation controls
- ✅ Command execution sandboxing
- ✅ Real-time permission monitoring
- ✅ Comprehensive audit logging
- ✅ Permission escalation when needed