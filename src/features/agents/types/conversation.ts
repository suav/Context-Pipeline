export interface ConversationThread {
  id: string;
  agent_id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
  // Conversation data
  messages: ConversationMessage[];
  context_snapshot: WorkspaceContextSnapshot;
  // Checkpoint system
  is_checkpoint: boolean;
  checkpoint_title?: string;
  checkpoint_description?: string;
  parent_checkpoint?: string;
  // Performance tracking
  total_tokens_used: number;
  commands_executed: CommandExecution[];
  status: 'active' | 'paused' | 'completed' | 'checkpointed';
}
export // Duplicate type removed: ConversationMessage (see ./src/features/agents/components/terminal/ChatInterface.tsx);
}
export interface CommandExecution {
  id: string;
  command_id: string;
  timestamp: string;
  input_params: Record<string, any>;
  output: string;
  success: boolean;
  error_message?: string;
  human_approved: boolean;
  execution_time_ms: number;
}
export interface WorkspaceContextSnapshot {
  timestamp: string;
  workspace_structure: {
    context_items: ContextItem[];
    target_files: FileTreeNode[];
    feedback_files: FeedbackFile[];
  };
  git_state: {
    branch: string;
    commit_hash: string;
    modified_files: string[];
    staged_files: string[];
  };
  context_description: string;
}
export interface ContextItem {
  id: string;
  type: 'jira_ticket' | 'git_repository' | 'file' | 'email' | 'documentation';
  title: string;
  description: string;
  context_value: string;
  metadata: Record<string, any>;
}
export interface FileTreeNode {
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  children?: FileTreeNode[];
}
export interface FeedbackFile {
  path: string;
  type: 'status' | 'progress' | 'log' | 'result';
  content: any;
  last_modified: string;
}
// Conversation indexing for fast retrieval
export interface ConversationIndex {
  conversation_id: string;
  agent_id: string;
  message_count: number;
  first_message: string;
  last_message: string;
  message_files: string[];
  total_tokens: number;
  checkpoints: string[];
}
// Message file storage for streaming efficiency
export interface MessageFile {
  id: string;
  timestamp: string;
  conversation_id: string;
  agent_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: any;
  file_path: string;
}