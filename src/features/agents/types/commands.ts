/**
 * Command System Types
 */

export interface CommandLibrary {
  commands: Record<string, Command>;
  categories: CommandCategory[];
  user_custom_commands: Record<string, Command>;
  workspace_command_overrides: Record<string, Partial<Command>>;
}

export interface Command {
  id: string;
  name: string;
  keyword: string;
  category: string;
  
  // Context-aware prompting
  base_prompt: string;
  context_adaptations: {
    [context_type: string]: string;
  };
  
  // Command configuration
  requires_approval: boolean;
  estimated_duration: string;
  follow_up_commands: string[];
  
  // Usage tracking
  usage_count: number;
  success_rate: number;
  average_completion_time_ms: number;
  
  // Permissions required
  required_permissions: string[];
  
  // User customization
  user_modified: boolean;
  custom_prompt_additions?: string[];
}

export interface CommandCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  commands: string[];
  recommended_for: string[];
}

export interface CommandExecutionRecord {
  id: string;
  timestamp: string;
  agent_id: string;
  workspace_id: string;
  command_id: string;
  input_context: {
    workspace_context: string;
    user_input: string;
    command_params: Record<string, any>;
  };
  execution: {
    start_time: string;
    end_time: string;
    duration_ms: number;
    success: boolean;
    output: string;
    error?: string;
  };
  human_interaction: {
    approval_required: boolean;
    approval_given: boolean;
    intervention_count: number;
    feedback_provided?: string;
  };
  files_affected: string[];
  context_effectiveness_rating?: number;
}

export interface CommandAnalytics {
  workspace_id: string;
  agent_id: string;
  period_start: string;
  period_end: string;
  
  command_performance: {
    [command_id: string]: {
      usage_count: number;
      success_rate: number;
      average_duration_ms: number;
      human_intervention_rate: number;
      context_effectiveness: Record<string, number>;
    };
  };
  
  agent_efficiency: {
    commands_per_hour: number;
    task_completion_rate: number;
    context_understanding_score: number;
  };
  
  workspace_optimization_suggestions: {
    underperforming_commands: string[];
    missing_permissions: string[];
    context_gaps: string[];
    recommended_checkpoints: string[];
  };
}