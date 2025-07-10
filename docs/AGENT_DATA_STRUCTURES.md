# Agent System Data Structures
## Core Agent Types
### Agent Instance
```typescript
interface Agent {
  id: string;                    // Unique agent identifier
  workspace_id: string;          // Associated workspace
  name: string;                  // User-provided agent name
  created_at: string;            // ISO timestamp
  updated_at: string;            // Last activity timestamp
  status: 'active' | 'idle' | 'paused' | 'error' | 'checkpointed';
  // Visual representation
  color: string;                 // Agent stripe color
  avatar?: string;               // Optional avatar/icon
  // Agent configuration
  model: string;                 // 'claude', 'gemini', 'codex', etc.
  model_config: {
    temperature?: number;
    max_tokens?: number;
    system_prompt_additions?: string[];
  };
  // Permissions & capabilities
  permissions: AgentPermissions;
  allowed_commands: string[];    // Command IDs this agent can use
  // State management
  conversation_id: string;       // Current conversation thread
  checkpoint_base?: string;      // If started from checkpoint
  last_checkpoint?: string;      // Most recent checkpoint created
  // Performance tracking
  metrics: AgentMetrics;
}
```
### Agent Permissions
```typescript
interface AgentPermissions {
  // File system access
  read_context: boolean;         // Can read context folder
  read_target: boolean;          // Can read target folder
  write_target: boolean;         // Can write to target folder
  write_feedback: boolean;       // Can write feedback files
  // Git operations
  git_read: boolean;             // Can read git status, diff, log
  git_stage: boolean;            // Can stage changes
  git_commit: boolean;           // Can commit changes
  git_push: boolean;             // Can push to remote (future)
  // External tools
  bash_execution: boolean;       // Can run bash commands
  file_operations: string[];     // Allowed file operations: ['create', 'edit', 'delete', 'move']
  // Workspace scope restrictions
  workspace_boundary: boolean;   // Must stay within workspace folder
  deletion_approval: boolean;    // Requires user approval for deletions
  // Command restrictions
  max_commands_per_session: number;
  command_cooldown_ms: number;
}
```
### Agent Metrics
```typescript
interface AgentMetrics {
  total_messages: number;
  total_commands_used: number;
  commands_by_type: Record<string, number>;
  session_duration_ms: number;
  human_interventions: HumanIntervention[];
  performance_scores: {
    task_completion_rate: number;
    error_rate: number;
    context_understanding: number;  // User-rated 1-10
  };
}
interface HumanIntervention {
  timestamp: string;
  type: 'correction' | 'guidance' | 'approval' | 'override';
  description: string;
  command_context?: string;       // Which command triggered intervention
  resolution: string;
}
```
## Conversation & Checkpoint System
### Conversation Thread
```typescript
interface ConversationThread {
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
  parent_checkpoint?: string;     // If spawned from another checkpoint
  // Performance tracking
  total_tokens_used: number;
  commands_executed: CommandExecution[];
  status: 'active' | 'paused' | 'completed' | 'checkpointed';
}
interface ConversationMessage {
  id: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    command_id?: string;
    file_changes?: string[];
    approval_required?: boolean;
    human_intervention?: boolean;
  };
}
// Duplicate type removed: CommandExecution (see ./src/features/agents/types/conversation.ts)
```
### Workspace Context Snapshot
```typescript
// Duplicate type removed: WorkspaceContextSnapshot (see ./src/features/agents/types/conversation.ts);
  git_state: {
    branch: string;
    commit_hash: string;
    modified_files: string[];
    staged_files: string[];
  };
  context_description: string;    // Auto-generated workspace description
}
interface ContextItem {
  id: string;
  type: 'jira_ticket' | 'git_repository' | 'file' | 'email' | 'documentation';
  title: string;
  description: string;
  context_value: string;          // What this adds to investigation context
  metadata: Record<string, any>;
}
```
## Command System
### Global Command Library
```typescript
// Duplicate type removed: CommandLibrary (see ./src/features/agents/types/commands.ts)
// Duplicate type removed: Command (see ./src/features/agents/data/commandLibrary.ts);
  // Command configuration
  requires_approval: boolean;
  estimated_duration: string;    // "5-10 minutes", "30+ minutes"
  follow_up_commands: string[];  // Suggested next commands
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
// Duplicate type removed: CommandCategory (see ./src/features/agents/data/commandLibrary.ts)
```
### Command Usage Analytics
```typescript
interface CommandAnalytics {
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
      context_effectiveness: Record<string, number>; // By context type
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
```
## Storage File Structure
```
workspace-{id}/
├── agents/
│   ├── agent-{id}.json              # Agent configuration
│   ├── agent-{id}-metrics.json     # Agent performance metrics
│   └── conversations/
│       ├── thread-{id}.json         # Conversation thread
│       ├── thread-{id}-messages/    # Individual message files
│       │   ├── msg-001.json
│       │   └── ...
│       └── checkpoints/
│           ├── checkpoint-{id}.json # Checkpoint metadata
│           └── checkpoint-{id}-state/ # Full conversation state
├── feedback/
│   ├── agent-activity.json         # All agent activities log
│   ├── command-analytics.json      # Command usage analytics
│   ├── deletion-requests.json      # Files agents want to delete
│   └── human-interventions.json    # All human interventions log
└── ...existing structure...
# Global storage
storage/
├── command-library/
│   ├── default-commands.json       # Built-in commands
│   ├── user-commands.json          # User custom commands
│   └── command-analytics.json      # Global command performance
├── agent-checkpoints/
│   ├── checkpoint-{id}/             # Reusable checkpoint states
│   │   ├── metadata.json
│   │   ├── conversation.json
│   │   └── context-snapshot.json
│   └── checkpoint-index.json       # Searchable checkpoint registry
└── agent-templates/
    ├── investigation-expert.json   # Pre-built expert templates
    └── documentation-specialist.json
```
This structure supports:
- ✅ Per-workspace agent isolation
- ✅ Persistent conversation history
- ✅ Checkpointable expert agents
- ✅ Command performance tracking
- ✅ Context-aware command adaptation
- ✅ Human intervention logging
- ✅ Granular permission system
- ✅ Cross-workspace checkpoint reuse