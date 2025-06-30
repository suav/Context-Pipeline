/**
 * Permission System Types
 */

export interface WorkspaceBoundary {
  workspace_root: string;
  allowed_paths: {
    context: {
      path: string;
      permissions: ['read'];
    };
    target: {
      path: string;
      permissions: ['read', 'write', 'create', 'edit'];
    };
    feedback: {
      path: string;
      permissions: ['read', 'write', 'create', 'edit'];
    };
    agents: {
      path: string;
      permissions: ['read'];
      own_agent_path: string;
    };
  };
  
  cannot_access: string[];
  parent_directory_access: false;
  symlink_following: false;
  
  deletion_safety: {
    requires_approval: string[];
    forbidden_deletions: string[];
    deletion_log: string;
  };
}

export interface FileSystemPermissions {
  context_access: {
    read_files: boolean;
    list_directory: boolean;
    read_metadata: boolean;
    search_content: boolean;
    write_files: false;
    delete_files: false;
    create_files: false;
    modify_permissions: false;
  };
  
  target_access: {
    read_files: boolean;
    write_files: boolean;
    create_files: boolean;
    edit_files: boolean;
    delete_files: boolean;
    rename_files: boolean;
    create_directories: boolean;
    max_file_size: number;
    allowed_extensions: string[];
    backup_before_edit: boolean;
  };
  
  feedback_access: {
    read_files: boolean;
    write_files: boolean;
    create_files: boolean;
    append_files: boolean;
    can_write_status: boolean;
    can_write_progress: boolean;
    can_write_logs: boolean;
    can_request_deletions: boolean;
  };
}

export interface GitPermissions {
  git_status: boolean;
  git_diff: boolean;
  git_log: boolean;
  git_show: boolean;
  git_blame: boolean;
  git_add: boolean;
  git_commit: boolean;
  git_stash: boolean;
  git_push: false;
  git_pull: false;
  git_merge: false;
  git_rebase: false;
  git_reset: false;
  git_branch: boolean;
  git_checkout: boolean;
  commit_message_required: boolean;
  max_commits_per_session: number;
  require_staged_changes: boolean;
}

export interface CommandPermissions {
  file_operations: {
    allowed: string[];
    forbidden: string[];
    requires_approval: string[];
  };
  
  system_info: {
    allowed: string[];
    forbidden: string[];
  };
  
  network: {
    allowed: string[];
    forbidden: string[];
    rate_limited: string[];
  };
  
  development: {
    build_tools: string[];
    test_runners: string[];
    linters: string[];
    no_global_installs: boolean;
    sandbox_execution: boolean;
  };
  
  timeout_seconds: number;
  max_concurrent: number;
  resource_limits: {
    max_memory_mb: number;
    max_cpu_percent: number;
    max_disk_write_mb: number;
  };
}

export interface ApprovalSystem {
  file_deletions: {
    auto_approve: string[];
    require_approval: string[];
    forbidden: string[];
    approval_timeout: number;
    batch_approvals: boolean;
  };
  
  system_changes: {
    permission_changes: 'require_approval';
    environment_variables: 'require_approval';
    external_network_calls: 'require_approval';
    large_file_operations: 'require_approval';
  };
  
  approval_notifications: {
    in_terminal: boolean;
    desktop_notification: boolean;
    email_notification: boolean;
    approval_context: {
      show_file_preview: boolean;
      show_impact_analysis: boolean;
      show_undo_option: boolean;
    };
  };
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  requires_approval?: boolean;
  approval_context?: ApprovalContext;
  suggested_alternative?: string;
}

export interface ApprovalContext {
  operation: string;
  file_paths: string[];
  impact_analysis: string;
  undo_available: boolean;
  timeout_ms: number;
}

export interface PermissionAuditLog {
  timestamp: string;
  agent_id: string;
  operation: string;
  permission_check: PermissionResult;
  actual_execution: boolean;
  user_intervention?: string;
  file_paths?: string[];
  command_executed?: string;
  git_operation?: string;
  boundary_violation_attempt: boolean;
  permission_escalation_used: boolean;
  approval_overridden: boolean;
}

export interface SecurityAlert {
  type: 'boundary_violation' | 'permission_escalation' | 'anomalous_behavior';
  severity: 'low' | 'medium' | 'high' | 'critical';
  agent_id: string;
  description: string;
  timestamp: string;
  requires_action: boolean;
}

export interface AgentRoleTemplate {
  id: string;
  name: string;
  description: string;
  permissions: {
    context_access: string;
    target_access: string;
    feedback_access: string;
    git_permissions: string;
    bash_commands: string;
    approvals_required: string;
  };
  default_commands: string[];
  risk_level: 'low' | 'medium' | 'high';
}

export interface ElevatedPermission {
  operation: string;
  justification: string;
  requires_user_approval: boolean;
  expires_after: string;
  granted_at: string;
  used_count: number;
}