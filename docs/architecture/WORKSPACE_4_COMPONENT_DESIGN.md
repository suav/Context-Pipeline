# 4-Component Workspace Architecture
## Overview
Each workspace consists of exactly 4 components, designed for maximum clarity and modularity:
1. **Context** - Input data and context information
2. **Target** - The buildable/workable area (repository, code, etc.)
3. **Feedback** - Output files for agent-to-app communication
4. **Agent(s)** - Multi-agent configurations and settings
## Component Structure
```
workspace-{id}/
├── context/
│   ├── context-manifest.json          # Explains what each piece is with metadata
│   ├── tickets/              # JIRA tickets and related data
│   ├── files/                # Additional context files
│   └── data/                 # Arbitrary context data
├── target/
│   ├── repo-clone/           # Cloned repository
│   ├── build/                # Build artifacts
│   └── workspace/            # Workspace-specific files
├── feedback/
│   ├── status.json           # Current status updates
│   ├── progress.json         # Progress reports
│   ├── results/              # Generated results
│   └── logs/                 # Agent execution logs
└── agents/
    ├── agent-{id}.json       # Individual agent configurations
    ├── shared-settings.json  # Shared agent settings
    └── states/               # Agent runtime states
```
## Multi-Agent Support
- **Multiple agents per workspace**: Each agent has its own configuration file
- **Agent coordination**: Shared settings and coordination mechanisms
- **Role-based permissions**: Different agents can have different access levels
- **Parallel execution**: Agents can work simultaneously with proper coordination
## Component Details
### 1. Context Component
- **Purpose**: Provide all input data and context
- **Key File**: `context/context-manifest.json` - explains what each piece is
- **Contents**: Tickets, files, data, requirements, specifications
### 2. Target Component
- **Purpose**: The actual work area - code, repositories, buildable assets
- **Key File**: Repository clone and workspace files
- **Contents**: Source code, build scripts, deployment configs
### 3. Feedback Component
- **Purpose**: Agent output and communication back to the app
- **Key File**: `feedback/status.json` - current agent status
- **Contents**: Progress updates, results, logs, generated artifacts
### 4. Agent(s) Component
- **Purpose**: Agent configurations, permissions, and runtime state
- **Key File**: `agents/agent-{id}.json` - individual agent settings
- **Contents**: Permissions, commands, model settings, initialization context
## Multi-Agent Coordination
```json
{
  "agent-001": {
    "name": "Development Agent",
    "role": "developer",
    "permissions": ["read", "write", "execute"],
    "commands": ["build", "test", "commit"],
    "model": "claude-3-opus",
    "priority": 1
  },
  "agent-002": {
    "name": "Review Agent",
    "role": "reviewer",
    "permissions": ["read", "feedback"],
    "commands": ["review", "validate"],
    "model": "claude-3-sonnet",
    "priority": 2
  }
}
```