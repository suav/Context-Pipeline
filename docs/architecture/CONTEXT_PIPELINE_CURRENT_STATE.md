# Context Pipeline - Current State & Architecture (January 2025)
## Overview
This document reflects the actual current state of Context Pipeline as of January 2025, superseding earlier design documents. Context Pipeline has evolved from a ticket-focused system to a comprehensive context engineering and agent deployment platform.
## Current Architecture
### System Components
```
┌─────────────────────────────────────────────────────────────────┐
│                    Context Pipeline System                       │
├─────────────────────────────────────────────────────────────────┤
│  UI Layer (Workspace Workshop)                                  │
│  ├── WorkspaceSidebar (Workspace selection & management)        │
│  ├── ActiveWorkspaceView (IDE-like interface)                  │
│  │   ├── FileTree (File explorer)                              │
│  │   ├── MonacoEditor (Code editing)                           │
│  │   └── TerminalArea (Agent chat interface)                   │
│  ├── LibraryView (Context import & management)                 │
│  └── AgentManagementModal (Global agent settings)              │
├─────────────────────────────────────────────────────────────────┤
│  Service Layer                                                  │
│  ├── AgentService (Orchestrates AI services)                   │
│  ├── ClaudeService (Claude CLI integration)                    │
│  ├── GeminiService (Gemini CLI integration)                    │
│  ├── ContextProcessor (Universal context processing)           │
│  └── DavinGitManager (Git operations - partial)                │
├─────────────────────────────────────────────────────────────────┤
│  Storage Layer (File-based)                                    │
│  ├── /storage/workspaces/[id]/ (Workspace data)               │
│  ├── /storage/library/ (Shared context items)                 │
│  └── /storage/archives/ (Archived items)                      │
├─────────────────────────────────────────────────────────────────┤
│  External Integrations                                         │
│  ├── JIRA API (Ticket import)                                 │
│  ├── Git CLI (Repository operations)                          │
│  ├── Claude CLI (AI assistant)                                │
│  └── Gemini CLI (AI assistant)                                │
└─────────────────────────────────────────────────────────────────┘
```
## Data Flow
### Context Import Flow (Current)
```
[JIRA/Git] → [Import Modal] → [Context Processor] → [Library Storage]
                                       ↓
                              [Context Item JSON]
                                       ↓
                              [Library UI Display]
```
### Workspace Creation Flow (Current)
```
[Library Items] → [Selection] → [Workspace Draft] → [Publish]
                                        ↓
                              [Workspace Directory]
                                        ↓
                                [Context Copied]
                                        ↓
                              [Ready for Agents]
```
### Agent Interaction Flow (Current)
```
[User Message] → [Agent Service] → [CLI Tool] → [AI Response]
                         ↓               ↑
                  [Context Injection]    ↓
                         ↓               ↓
                  [System Prompt]   [Streaming Response]
                                         ↓
                                  [Chat Interface]
```
## Storage Structure (Actual)
```
storage/
├── workspaces/
│   └── [workspace-id]/
│       ├── workspace.json           # Workspace metadata
│       ├── context-manifest.json    # List of context items
│       ├── context/                 # Copied context files
│       │   ├── jira/               # JIRA ticket data
│       │   └── git/                # Git repository data
│       ├── agents/                 # Agent data
│       │   └── [agent-id]/
│       │       ├── agent.json      # Agent configuration
│       │       └── conversation.json # Chat history with session IDs
│       └── feedback.json           # Workspace feedback/notes
│
├── library/
│   ├── context-library.json        # Library index
│   └── items/                     # Individual context items
│       └── [item-id].json
│
└── drafts/
    └── workspace-drafts.json       # Unpublished workspaces
```
## Key Features Status
### ✅ Implemented & Working
1. **Context Import**
   - JIRA ticket import with search
   - Git repository import (read-only and writeable modes)
   - Query templates for common searches
2. **Library Management**
   - Add/remove items
   - Filter and search
   - Workspace creation from selections
   - Archive system (basic)
3. **Workspace Operations**
   - Create from library items
   - IDE-like interface with file tree
   - Monaco editor integration
   - File viewing and editing
   - Git diff viewing
4. **Agent Integration**
   - Claude CLI integration
   - Gemini CLI integration
   - Streaming chat responses
   - Session ID persistence
   - Tool approval UI
5. **Performance Optimizations**
   - API caching system
   - Lazy loading components
   - WSL-optimized file operations
### 🚧 Partially Implemented
1. **Git Operations**
   - Basic diff viewing works
   - Commit/push operations planned
   - Branch management planned
2. **Permission System**
   - Tool approval UI exists
   - Full permission injection needed
   - Command library structure ready
3. **Checkpoint System**
   - Session IDs saved
   - Full checkpoint save/restore needed
### 📋 Planned but Not Started
1. **Dynamic Context Triggers**
   - JIRA webhooks
   - Git hooks
   - Email triggers
   - Automated workspace creation
2. **Advanced Git Flow**
   - Branching strategies
   - PR creation
   - Merge conflict resolution
3. **Analytics & Metrics**
   - Agent effectiveness tracking
   - Usage patterns
   - Performance metrics
4. **Testing Framework**
   - Automated testing
   - Coverage reporting
   - Agent-driven test creation
## API Routes (Current)
### Workspace Management
- `GET/POST /api/workspaces` - List and create workspaces
- `GET/PUT/DELETE /api/workspaces/[id]` - Workspace CRUD
- `GET/POST /api/workspaces/[id]/status` - Workspace status
- `POST /api/workspaces/[id]/validate` - Validate workspace
### Context Workflow
- `POST /api/context-workflow/import` - Import from sources
- `GET/POST /api/context-workflow/library` - Library management
- `GET /api/context-workflow/queries/[source]` - Query templates
- `GET/POST /api/context-workflow/archives` - Archive management
### Agent Operations
- `GET/POST /api/workspaces/[id]/agents` - Agent management
- `POST /api/workspaces/[id]/agents/[agentId]/conversation` - Send message
- `GET /api/workspaces/[id]/agents/[agentId]/conversation/stream` - Stream response
- `POST /api/workspaces/[id]/agents/[agentId]/tool-approval` - Approve tools
### File Operations
- `GET/POST /api/workspaces/[id]/files` - File tree and operations
- `GET /api/workspaces/[id]/files/content` - Read file content
- `POST /api/workspaces/[id]/files/save` - Save file changes
### Git Operations
- `GET /api/workspaces/[id]/git/diff` - Get git diff
## Technology Stack
- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Components**: Custom React components, Monaco Editor
- **Styling**: Tailwind CSS with dynamic theming
- **State Management**: React hooks and local storage
- **Backend**: Next.js API routes
- **Storage**: File system (no database)
- **AI Integration**: CLI tools (claude, gemini)
- **Performance**: In-memory caching, lazy loading
## Known Limitations
1. **No Database**: All data stored in file system
2. **Single User**: No multi-user support currently
3. **Local Only**: No cloud deployment considerations
4. **Limited Git**: Basic operations only
5. **No CI/CD**: Manual deployment required
## Migration from Original Design
The system has evolved from the original ticket-centric design to a more flexible context-based approach:
1. **"Tickets" → "Context Items"**: Any source can be context
2. **"Ticket Hub" → "Library"**: More generic content management
3. **"Build Workspace" → "Workspace Workshop"**: IDE-like interface
4. **Fixed workflow → Flexible context engineering**: User-driven
## Next Development Phase
Based on current priorities:
1. **Permission & Command Injection** (Highest Priority)
   - Implement full permission system
   - Auto-generate CLAUDE.md in workspaces
   - Global command management
   - Hot command injection
2. **Complete Checkpoint System**
   - Save full conversation state
   - Restore from checkpoints
   - Share expertise between workspaces
3. **Git Flow Integration**
   - Branch management
   - Commit creation
   - Push operations
   - PR workflows
4. **Dynamic Triggers**
   - JIRA webhook listeners
   - Git hook integration
   - Automated workspace creation
This document represents the actual state of Context Pipeline as built, not the original design vision. Use this for understanding current capabilities and planning future development.