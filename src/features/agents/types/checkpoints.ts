/**
 * Checkpoint System Types
 */

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