/**
 * Core Agent System Types
 */
// Agent Core Types
export interface Agent {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'idle' | 'paused' | 'error' | 'checkpointed';
  // Visual representation
  color: string;
  avatar?: string;
  // Agent configuration
  model: string;
  preferred_model: 'claude' | 'gemini';
  model_config: {
    temperature?: number;
    max_tokens?: number;
    system_prompt_additions?: string[];
  };
  // Permissions & capabilities
  permissions: AgentPermissions;
  allowed_commands: string[];
  // State management
  conversation_id: string;
  checkpoint_base?: string;
  last_checkpoint?: string;
  // Performance tracking
  metrics: AgentMetrics;
}
export interface AgentPermissions {
  // File system access
  read_context: boolean;
  read_target: boolean;
  write_target: boolean;
  write_feedback: boolean;
  // Git operations
  git_read: boolean;
  git_stage: boolean;
  git_commit: boolean;
  git_push: boolean;
  // External tools
  bash_execution: boolean;
  file_operations: string[];
  // Workspace scope restrictions
  workspace_boundary: boolean;
  deletion_approval: boolean;
  // Command restrictions
  max_commands_per_session: number;
  command_cooldown_ms: number;
}
export interface AgentMetrics {
  total_messages: number;
  total_commands_used: number;
  commands_by_type: Record<string, number>;
  session_duration_ms: number;
  human_interventions: HumanIntervention[];
  performance_scores: {
    task_completion_rate: number;
    error_rate: number;
    context_understanding: number;
  };
}
export interface HumanIntervention {
  timestamp: string;
  type: 'correction' | 'guidance' | 'approval' | 'override';
  description: string;
  command_context?: string;
  resolution: string;
}
// Agent Registry for workspace-level tracking
export interface AgentRegistry {
  workspace_id: string;
  last_updated: string;
  active_agents: {
    [agent_id: string]: {
      name: string;
      status: Agent['status'];
      last_activity: string;
      conversation_id: string;
      checkpoint_base?: string;
      color: string;
    };
  };
  agent_history: {
    created: string[];
    deleted: string[];
    checkpointed: string[];
  };
}
// Export checkpoint types
export * from './checkpoints';
// Export permission types
export * from './permissions';
// Export command types
export * from './commands';
// Export conversation types
export * from './conversation';