// Template System Type Definitions

export interface WorkspaceTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  created_at: string;
  updated_at: string;
  created_by: string;
  version: string;
  
  // Context requirements with wildcard support
  context_requirements: ContextRequirement[];
  
  // Workspace structure definition
  workspace_config: {
    naming_pattern: string; // e.g., "{{type}}: {{jira.key}} - {{jira.summary}}"
    file_templates: FileTemplate[];
    directory_structure: string[];
    permissions_template: string;
    auto_archive_days?: number;
    allow_concurrent_sessions?: boolean;
  };
  
  // Agent deployment patterns
  agent_templates: AgentTemplate[];
  
  // Template variables for customization
  variables: TemplateVariable[];
  
  // Trigger configuration for automated workspace creation
  triggers?: TemplateTrigger[];
  
  // Usage tracking
  usage_stats: TemplateUsageStats;
}

export interface ContextRequirement {
  id: string;
  type: 'explicit' | 'wildcard';
  
  // For explicit requirements
  context_item_id?: string; // Specific library item ID
  
  // For wildcard requirements  
  wildcard_type?: 'generic_ticket' | 'generic_repository' | 'generic_document';
  wildcard_filters?: {
    tags?: string[];
    source?: string[];
    content_type?: string[];
  };
  
  // Common properties
  required: boolean;
  display_name: string;
  description?: string;
}

export interface FileTemplate {
  name: string;
  path: string;
  content: string; // Template with variables
  overwrite_existing: boolean;
}

export interface AgentTemplate {
  name: string;
  model: 'claude' | 'gemini';
  commands: string[]; // References to command library
  permissions: string[];
  auto_deploy: boolean;
  description?: string;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'boolean' | 'number' | 'select' | 'multiselect';
  description: string;
  default_value?: any;
  required: boolean;
  options?: string[]; // For select/multiselect types
  validation?: ValidationRule;
}

export interface ValidationRule {
  pattern?: string; // Regex pattern
  min_length?: number;
  max_length?: number;
  custom_validator?: string; // Function name
}

export interface TemplateUsageStats {
  total_uses: number;
  manual_uses: number;
  automated_uses: number;
  last_used: string | null;
  success_rate: number;
  average_creation_time: number;
}

export type TemplateCategory = 
  | 'development'
  | 'testing' 
  | 'deployment'
  | 'documentation'
  | 'business'
  | 'custom';

// Template-based trigger configuration (simplified from WorkspaceTrigger)
export interface TemplateTrigger {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // Trigger type and configuration
  trigger_type: 'jira_status' | 'git_push' | 'email_received' | 'schedule';
  trigger_config: TemplateTriggerConfig;
  
  // Template variable overrides for this trigger
  variable_overrides: Record<string, any>;
  
  // Context item to monitor (maps to existing library items)
  context_item_id?: string;
  
  // Conditions that activate this trigger
  conditions: TemplateTriggerCondition[];
  
  // Actions to take when triggered
  actions: TemplateTriggerAction[];
}

export interface TemplateTriggerConfig {
  // JIRA triggers
  jira_project?: string;
  status_transition?: string; // 'To Do → In Progress'
  
  // Git triggers
  repository?: string;
  branch_pattern?: string; // 'feature/*', 'main'
  
  // Email triggers
  sender_pattern?: string; // '@company.com'
  subject_pattern?: string; // 'URGENT:'
  
  // Schedule triggers
  cron_expression?: string; // '0 9 * * MON'
  
  // Common settings
  polling_interval_ms?: number;
}

export interface TemplateTriggerCondition {
  id: string;
  type: 'status_change' | 'new_comment' | 'string_match' | 'assignee_change' | 'priority_change';
  config: {
    from_status?: string;
    to_status?: string;
    search_string?: string;
    case_sensitive?: boolean;
    new_assignee?: string;
    from_priority?: string;
    to_priority?: string;
    field_path?: string;
  };
}

export interface TemplateTriggerAction {
  id: string;
  type: 'create_workspace' | 'deploy_agents' | 'notify_users' | 'update_context';
  config: {
    // Workspace creation
    auto_deploy?: boolean;
    workspace_title_override?: string;
    
    // Agent deployment
    agents_to_deploy?: string[]; // Agent template names
    
    // Notifications
    notify_users?: string[];
    notification_message?: string;
    
    // Context updates
    context_refresh?: boolean;
    add_trigger_context?: boolean;
  };
}

// Trigger System Types (designed around templates)
export interface WorkspaceTrigger {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  
  // Template application
  template_id: string;
  template_overrides: TemplateOverrides;
  
  // Context monitoring
  context_listener: {
    context_item_id: string; // Library item to watch
    listener_type: 'jira' | 'git' | 'email' | 'slack';
    trigger_conditions: TriggerCondition[];
    polling_interval_ms: number;
    last_checked?: string;
    last_known_state?: any;
  };
  
  // Variable resolution for template
  variable_mapping: {
    [variableName: string]: VariableMapping;
  };
  
  // Execution settings
  status: 'active' | 'paused' | 'disabled';
  auto_deploy: boolean;
  requires_approval: boolean;
  resource_limits: ResourceLimits;
  
  // Execution tracking
  last_triggered?: string;
  execution_count: number;
  success_count: number;
  failure_count: number;
}

export interface TemplateOverrides {
  naming_pattern?: string;
  agent_configs?: AgentOverride[];
  additional_commands?: string[];
  permissions_overrides?: PermissionOverride[];
  file_template_overrides?: FileTemplateOverride[];
}

export interface AgentOverride {
  name?: string;
  model?: 'claude' | 'gemini';
  commands?: string[];
  permissions?: string[];
  replace_existing?: boolean; // If true, replace template agent; if false, add to template agents
}

export interface PermissionOverride {
  action: 'add' | 'remove' | 'replace';
  permissions: string[];
}

export interface FileTemplateOverride {
  template_name: string;
  content_override?: string;
  path_override?: string;
}

export interface VariableMapping {
  source: 'jira_field' | 'git_context' | 'static' | 'user_input' | 'library_metadata';
  field_path?: string; // e.g., "fields.summary" for JIRA
  default_value?: any;
  transform?: string; // Function name for value transformation
}

export interface TriggerCondition {
  id: string;
  type: TriggerConditionType;
  config: TriggerConditionConfig;
}

export type TriggerConditionType =
  | 'status_change'
  | 'new_comment'
  | 'new_commit'
  | 'pr_created'
  | 'pr_merged'
  | 'assignee_change'
  | 'priority_change'
  | 'label_added'
  | 'string_match';

export interface TriggerConditionConfig {
  // For status_change
  from_status?: string;
  to_status?: string;
  
  // For string_match
  search_string?: string;
  case_sensitive?: boolean;
  
  // For assignee_change
  new_assignee?: string;
  
  // For priority_change
  from_priority?: string;
  to_priority?: string;
  
  // For label_added
  label?: string;
  
  // Common
  field_path?: string;
}

export interface ResourceLimits {
  max_concurrent_workspaces: number;
  max_concurrent_agents: number;
  min_trigger_interval_ms: number;
  timeout_ms: number;
}

// Template Application Result Types
export interface TemplateApplicationResult {
  success: boolean;
  workspace_id?: string;
  errors: TemplateApplicationError[];
  warnings: string[];
  resolved_variables: Record<string, any>;
  applied_context_items: AppliedContextItem[];
  execution_time_ms: number;
}

export interface TemplateApplicationError {
  type: 'validation' | 'context_resolution' | 'workspace_creation' | 'agent_deployment';
  message: string;
  details?: any;
}

export interface AppliedContextItem {
  requirement_id: string;
  context_item_id: string;
  type: 'explicit' | 'wildcard_resolved';
  metadata: any;
}

// Logging Types
export interface TemplateLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'template' | 'trigger' | 'application' | 'system';
  template_id?: string;
  trigger_id?: string;
  workspace_id?: string;
  message: string;
  details?: any;
  execution_context?: string;
}