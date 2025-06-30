# Agent Storage Architecture

## Storage Pattern Philosophy

Following the existing context-pipeline storage patterns:
- **Timestamped JSON files** for state persistence
- **Atomic operations** with backup retention
- **Incremental updates** to minimize storage overhead
- **Index files** for fast querying and search

## File Organization Structure

### 1. Workspace-Level Agent Storage

```
workspace-{id}/
├── agents/
│   ├── agents-registry.json         # Active agents index
│   ├── agent-{agent-id}/
│   │   ├── config.json              # Agent configuration
│   │   ├── permissions.json         # Agent permissions
│   │   ├── metrics.json             # Performance metrics
│   │   ├── conversations/
│   │   │   ├── current.json         # Active conversation
│   │   │   ├── thread-{timestamp}.json  # Historical threads
│   │   │   └── messages/
│   │   │       ├── {timestamp}-user.json
│   │   │       ├── {timestamp}-assistant.json
│   │   │       └── {timestamp}-system.json
│   │   ├── checkpoints/
│   │   │   ├── checkpoint-{id}.json # Checkpoint metadata
│   │   │   └── states/
│   │   │       └── {checkpoint-id}/ # Full state snapshots
│   │   │           ├── conversation.json
│   │   │           ├── context.json
│   │   │           └── files.json
│   │   └── commands/
│   │       ├── executed-commands.json    # Command execution log
│   │       ├── pending-approvals.json   # Commands awaiting approval
│   │       └── performance.json         # Command performance data
│   └── shared/
│       ├── workspace-context.json   # Current workspace context description
│       ├── active-sessions.json     # Currently active agent sessions
│       └── intervention-log.json    # Human interventions across all agents
```

### 2. Global Agent Storage

```
storage/
├── agent-system/
│   ├── command-library/
│   │   ├── library-{timestamp}.json     # Versioned command library
│   │   ├── user-commands-{timestamp}.json   # User customizations
│   │   └── current-library.json        # Symlink to latest
│   ├── checkpoints/
│   │   ├── checkpoint-registry.json    # Searchable checkpoint index
│   │   ├── global-checkpoints/
│   │   │   └── {checkpoint-id}/        # Reusable expert agents
│   │   │       ├── metadata.json
│   │   │       ├── conversation.json
│   │   │       ├── context.json
│   │   │       └── performance.json
│   │   └── backups/
│   │       └── checkpoint-backup-{timestamp}.json
│   ├── analytics/
│   │   ├── command-analytics-{date}.json    # Daily command performance
│   │   ├── agent-performance-{date}.json    # Daily agent metrics
│   │   └── workspace-analytics-{date}.json  # Workspace efficiency data
│   └── templates/
│       ├── agent-templates.json        # Pre-built agent configurations
│       └── command-templates.json      # Command template library
└── ...existing storage structure...
```

## Data Storage Patterns

### 1. Atomic File Operations

```typescript
// Following existing pattern from context-library storage
interface StorageOperation {
  timestamp: string;
  operation: 'create' | 'update' | 'delete' | 'backup';
  file_path: string;
  previous_version?: string;
  checksum: string;
}

// Storage manager interface
interface AgentStorageManager {
  // Agent operations
  createAgent(workspaceId: string, config: AgentConfig): Promise<Agent>;
  updateAgent(agentId: string, updates: Partial<Agent>): Promise<Agent>;
  deleteAgent(agentId: string): Promise<void>;
  
  // Conversation operations
  saveMessage(agentId: string, message: ConversationMessage): Promise<void>;
  loadConversation(agentId: string, threadId?: string): Promise<ConversationThread>;
  
  // Checkpoint operations
  createCheckpoint(agentId: string, title: string, description?: string): Promise<Checkpoint>;
  loadCheckpoint(checkpointId: string): Promise<CheckpointState>;
  searchCheckpoints(query: string, workspaceId?: string): Promise<Checkpoint[]>;
  
  // Analytics operations
  logCommand(agentId: string, command: CommandExecution): Promise<void>;
  logIntervention(agentId: string, intervention: HumanIntervention): Promise<void>;
  getAnalytics(agentId: string, period?: DateRange): Promise<CommandAnalytics>;
}
```

### 2. Incremental Message Storage

```typescript
// Messages stored individually for streaming and memory efficiency
interface MessageFile {
  id: string;
  timestamp: string;
  conversation_id: string;
  agent_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: MessageMetadata;
  file_path: string;
}

// Message indexing for fast retrieval
interface ConversationIndex {
  conversation_id: string;
  agent_id: string;
  message_count: number;
  first_message: string;
  last_message: string;
  message_files: string[];
  total_tokens: number;
  checkpoints: string[];
}
```

### 3. Command Performance Tracking

```typescript
// Command execution stored for analytics
interface CommandExecutionRecord {
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
  context_effectiveness_rating?: number; // 1-10, user provided
}
```

## Index and Search Structures

### 1. Agent Registry
```typescript
interface AgentRegistry {
  workspace_id: string;
  last_updated: string;
  active_agents: {
    [agent_id: string]: {
      name: string;
      status: AgentStatus;
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
```

### 2. Checkpoint Search Index
```typescript
interface CheckpointIndex {
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
      last_used: string;
    };
  };
  search_metadata: {
    tag_frequency: Record<string, number>;
    context_type_frequency: Record<string, number>;
    expertise_areas: string[];
  };
}
```

### 3. Command Analytics Index
```typescript
interface CommandAnalyticsIndex {
  period: string; // "daily", "weekly", "monthly"
  date_range: [string, string];
  workspace_performance: {
    [workspace_id: string]: {
      total_commands: number;
      success_rate: number;
      avg_completion_time: number;
      top_commands: string[];
      human_intervention_rate: number;
    };
  };
  command_effectiveness: {
    [command_id: string]: {
      usage_count: number;
      success_rate: number;
      context_effectiveness: Record<string, number>;
      avg_duration: number;
    };
  };
  agent_insights: {
    most_efficient_agents: string[];
    learning_curve_data: Record<string, number[]>;
    specialization_patterns: Record<string, string[]>;
  };
}
```

## Backup and Recovery Strategy

### 1. Incremental Backups
- Agent configurations backed up on every change
- Conversation messages backed up in batches (every 10 messages or 1 hour)
- Checkpoints immediately backed up upon creation
- Analytics data backed up daily

### 2. Recovery Procedures
```typescript
interface RecoveryManager {
  restoreAgent(agentId: string, timestamp?: string): Promise<Agent>;
  restoreConversation(conversationId: string, timestamp?: string): Promise<ConversationThread>;
  restoreCheckpoint(checkpointId: string): Promise<CheckpointState>;
  validateDataIntegrity(workspaceId: string): Promise<IntegrityReport>;
}
```

### 3. Data Retention Policy
- Active conversations: Indefinite retention
- Completed conversations: 1 year retention
- Agent metrics: 6 months detailed, 2 years summarized
- Command analytics: 3 months detailed, 1 year aggregated
- Checkpoints: User-controlled retention (can be permanent)

This storage architecture ensures:
- ✅ Scalable storage that grows with usage
- ✅ Fast agent and checkpoint lookup
- ✅ Comprehensive analytics data collection
- ✅ Reliable backup and recovery
- ✅ Efficient conversation streaming
- ✅ Cross-workspace checkpoint sharing