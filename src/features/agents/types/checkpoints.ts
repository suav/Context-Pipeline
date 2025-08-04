import { Agent, AgentPermissions, AgentMetrics } from './index';
import { ConversationMessage, CommandExecution, WorkspaceContextSnapshot } from './conversation';
export interface Checkpoint {
  id: string;
  title: string;
  description: string;
  conversation_id: string;
  agent_id: string;
  workspace_id: string;
  created_at: string;
  created_by: string;
  // Checkpoint metadata
  tags: string[];
  expertise_areas: string[];
  performance_score: number;
  usage_count: number;
  last_used?: string;
  // Context information
  workspace_context_types: string[];
  context_snapshot: WorkspaceContextSnapshot;
  // State data
  conversation_state: CheckpointConversationState;
  agent_configuration: CheckpointAgentConfig;
  // Analytics
  effectiveness_ratings: number[];
  average_rating: number;
  success_stories: string[];
  common_use_cases: string[];
}
export interface CheckpointConversationState {
  messages: ConversationMessage[];
  total_tokens: number;
  command_history: CommandExecution[];
  knowledge_areas: string[];
  learned_patterns: string[];
  conversation_summary: string;
}
export interface CheckpointAgentConfig {
  model: string;
  permissions: AgentPermissions;
  specialized_commands: string[];
  context_understanding: Record<string, number>;
  performance_metrics: AgentMetrics;
}
export interface CheckpointIndex {
  last_updated: string;
  checkpoints: {
    [checkpoint_id: string]: {
      title: string;
      description: string;
      tags: string[];
      workspace_context_types: string[];
      agent_expertise: string[];
      performance_score: number;
      usage_count: number;
      created_by: string;
      created_at: string;
      last_used?: string;
    };
  };
  search_metadata: {
    tag_frequency: Record<string, number>;
    context_type_frequency: Record<string, number>;
    expertise_areas: string[];
  };
}
export interface CheckpointSummary {
  id: string;
  title: string;
  description: string;
  tags: string[];
  workspace_context_types: string[];
  expertise_areas: string[];
  performance_score: number;
  usage_count: number;
  last_used?: string;
  conversation_preview: string;
  knowledge_areas: string[];
  created_by: string;
  created_at: string;
}
export interface CheckpointFilters {
  context_types: string[];
  expertise_areas: string[];
  performance_threshold: number;
  recently_used: boolean;
  my_checkpoints: boolean;
  tags: string[];
  created_date_range?: [string, string];
}
export interface CheckpointSearchQuery {
  query: string;
  filters: CheckpointFilters;
  sort_by: 'relevance' | 'performance' | 'usage' | 'recent' | 'created';
  limit: number;
  offset: number;
}
export interface CheckpointSearchResult {
  checkpoints: CheckpointSummary[];
  total_count: number;
  search_time_ms: number;
  suggested_tags: string[];
  related_expertise: string[];
}
export interface CheckpointState {
  checkpoint: Checkpoint;
  restoration_data: {
    conversation_messages: ConversationMessage[];
    agent_config: Agent;
    workspace_context: WorkspaceContextSnapshot;
    initial_system_prompt: string;
  };
  continuation_suggestions: string[];
}
// Analytics for checkpoint effectiveness
export interface CheckpointAnalytics {
  checkpoint_id: string;
  usage_patterns: {
    total_uses: number;
    unique_users: number;
    average_session_length: number;
    success_rate: number;
    completion_rate: number;
  };
  performance_metrics: {
    task_completion_improvement: number;
    error_reduction_rate: number;
    user_satisfaction_scores: number[];
    average_rating: number;
  };
  adaptation_data: {
    context_types_used: Record<string, number>;
    command_effectiveness: Record<string, number>;
    knowledge_transfer_success: number;
    learning_curve_improvement: number;
  };
  recommendations: {
    improvement_suggestions: string[];
    related_checkpoints: string[];
    optimization_opportunities: string[];
  };
}
// Agent B Task B1: Enhanced checkpoint interfaces for comprehensive agent state management
export interface AgentCheckpoint {
  id: string;
  title: string;
  description: string;
  agentType: 'claude' | 'gemini';
  conversation_id: string;
  workspace_context: WorkspaceContextSnapshot;
  expertise_summary: string;
  performance_metrics: CheckpointMetrics;
  tags: string[];
  created_at: string;
  last_used?: string;
  usage_count: number;
  // Extended checkpoint data
  agent_id: string;
  workspace_id: string;
  created_by: string;
  // State preservation
  full_conversation_state: CheckpointConversationState;
  agent_configuration: CheckpointAgentConfig;
  // Enhanced metadata
  expertise_areas: string[];
  context_types: string[];
  success_indicators: string[];
  // Analytics integration
  analytics_summary: CheckpointAnalyticsSummary;
}
export interface CheckpointMetrics {
  success_rate: number;
  avg_response_time: number;
  user_satisfaction: number;
  task_completion_rate: number;
  // Extended performance metrics
  commands_executed: number;
  errors_encountered: number;
  tokens_processed: number;
  context_understanding_score: number;
  knowledge_retention_score: number;
  adaptation_efficiency: number;
}
export interface CheckpointAnalyticsSummary {
  total_sessions: number;
  successful_restorations: number;
  average_continuation_length: number;
  user_feedback_score: number;
  most_common_use_cases: string[];
  effectiveness_rating: number;
}
// Validation and utility types
export interface CheckpointValidation {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  completeness_score: number;
  required_fields: string[];
}
export interface CheckpointCreationRequest {
  title: string;
  description: string;
  tags: string[];
  expertise_summary: string;
  context_snapshot_override?: WorkspaceContextSnapshot;
  include_full_conversation?: boolean;
  analytics_enabled?: boolean;
}
// Validation functions
export function validateAgentCheckpoint(checkpoint: Partial<AgentCheckpoint>): CheckpointValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const requiredFields: string[] = [
    'id', 'title', 'description', 'agentType', 'conversation_id',
    'workspace_context', 'expertise_summary', 'performance_metrics',
    'tags', 'created_at', 'agent_id', 'workspace_id', 'created_by'
  ];
  // Check required fields
  requiredFields.forEach(field => {
    if (!checkpoint[field as keyof AgentCheckpoint]) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  // Validate specific fields
  if (checkpoint.title && checkpoint.title.length < 3) {
    errors.push('Title must be at least 3 characters long');
  }
  if (checkpoint.description && checkpoint.description.length < 10) {
    errors.push('Description must be at least 10 characters long');
  }
  if (checkpoint.agentType && !['claude', 'gemini'].includes(checkpoint.agentType)) {
    errors.push('Agent type must be either "claude" or "gemini"');
  }
  if (checkpoint.tags && checkpoint.tags.length === 0) {
    warnings.push('No tags provided - this may make the checkpoint harder to find');
  }
  if (checkpoint.expertise_summary && checkpoint.expertise_summary.length < 20) {
    warnings.push('Expertise summary is very short - consider adding more detail');
  }
  // Calculate completeness score
  const completenessScore = Math.round(
    (requiredFields.length - errors.length) / requiredFields.length * 100
  );
  return {
    is_valid: errors.length === 0,
    errors,
    warnings,
    completeness_score: completenessScore,
    required_fields: requiredFields
  };
}
export function validateCheckpointMetrics(metrics: Partial<CheckpointMetrics>): CheckpointValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const requiredFields: string[] = [
    'success_rate', 'avg_response_time', 'user_satisfaction', 'task_completion_rate'
  ];
  // Check required fields
  requiredFields.forEach(field => {
    if (metrics[field as keyof CheckpointMetrics] === undefined) {
      errors.push(`Missing required metric: ${field}`);
    }
  });
  // Validate ranges
  if (metrics.success_rate !== undefined && (metrics.success_rate < 0 || metrics.success_rate > 1)) {
    errors.push('Success rate must be between 0 and 1');
  }
  if (metrics.user_satisfaction !== undefined && (metrics.user_satisfaction < 0 || metrics.user_satisfaction > 5)) {
    errors.push('User satisfaction must be between 0 and 5');
  }
  if (metrics.task_completion_rate !== undefined && (metrics.task_completion_rate < 0 || metrics.task_completion_rate > 1)) {
    errors.push('Task completion rate must be between 0 and 1');
  }
  if (metrics.avg_response_time !== undefined && metrics.avg_response_time < 0) {
    errors.push('Average response time cannot be negative');
  }
  // Warnings for suspicious values
  if (metrics.success_rate !== undefined && metrics.success_rate < 0.3) {
    warnings.push('Low success rate detected - this checkpoint may need improvement');
  }
  if (metrics.user_satisfaction !== undefined && metrics.user_satisfaction < 2.5) {
    warnings.push('Low user satisfaction - consider reviewing this checkpoint');
  }
  const completenessScore = Math.round(
    (requiredFields.length - errors.length) / requiredFields.length * 100
  );
  return {
    is_valid: errors.length === 0,
    errors,
    warnings,
    completeness_score: completenessScore,
    required_fields: requiredFields
  };
}