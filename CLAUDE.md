# Context Pipeline - Agent Navigation Guide
## 🎯 Project Vision
Context Pipeline is a **context engineering and agent deployment tool** designed to streamline AI-assisted development workflows. Think of it as a limited-scope workspace manager where each workspace represents one developer on a team, working on specific tickets with AI agents that understand the full context.
## 🚀 Current State (January 2025)
### ✅ What's Working
- **Workspace Workshop Interface**: IDE-like interface with file explorer, Monaco editor, and terminal
- **Context Library**: Import from JIRA and Git repositories (read-only and writeable modes)
- **Basic Agent Integration**: Claude and Gemini CLI integration with streaming responses
- **Session Persistence**: Agent conversations are saved with session IDs (partial checkpoint implementation)
- **File Operations**: View, edit, and save files within workspaces
- **Git Diff Viewing**: Basic git diff functionality for understanding changes
### 🏗️ What's In Progress
- **Agent Checkpoint System**: Session IDs exist, need full checkpoint save/restore functionality
- **Permissions & Commands Injection**: Framework exists but needs implementation
- **Git Flow Integration**: Basic git operations exist, need full workflow implementation
## 📍 Priority Development Areas
### 1. **Permissions & Commands System** (HIGHEST PRIORITY)
**Goal**: Inject permissions and commands when agents are instantiated in workspaces
**Key Requirements**:
- Generate CLAUDE.md in workspace on first agent touchdown
- Validate all required files exist for subsequent agents
- Global command management in Claude Code format
- Workspace-level permission customization
- Manual approval UI for dangerous operations
- "Hot command" injection when agents are prompted
**Implementation Guide**:
```typescript
// See: src/features/agents/services/AgentService.ts
// Need to extend loadWorkspaceContext() to inject:
// 1. Permissions from global config
// 2. Commands from command library
// 3. CLAUDE.md and other context docs
```
**Key Files**:
- `src/features/agents/components/terminal/ToolApprovalOverlay.tsx` - Approval UI exists
- `src/features/agents/data/commandLibrary.ts` - Command structure ready
- `docs/agents/AGENT_PERMISSION_SYSTEM.md` - Full design specification
### 2. **Agent Checkpoint System**
**Goal**: Save and restore agent expertise/context across sessions
**Current State**:
- Session IDs are saved in conversation history
- Basic conversation persistence works
**Next Steps**:
1. Implement checkpoint creation from conversation states
2. Add checkpoint metadata and tagging
3. Create checkpoint search/restore functionality
4. Build expert agent library for reusable checkpoints
**Key Files**:
- `src/features/agents/types/checkpoints.ts` - Type definitions exist
- `src/features/agents/services/AgentService.ts` - Add checkpoint methods
- `docs/agents/AGENT_BUILD_PLAN.md` - Full checkpoint system design
### 3. **Git Flow Integration**
**Goal**: Each workspace operates like a developer with standard git workflows
**Vision**:
- Workspace = Individual developer branch
- Automated branching from configured base
- Push to testing branches
- Full PR creation workflow
- Deep integration with git diffs
**Key Components**:
- `src/app/api/workspaces/[workspaceId]/git/diff/route.ts` - Diff viewing exists
- Need: Branch management, commit creation, PR workflows
- Reference: `docs/implementation/GIT_INTEGRATION_IMPLEMENTATION.md`
### 4. **Dynamic Context Triggers**
**Goal**: Automate workspace creation and agent deployment based on events
**Planned Triggers**:
- JIRA ticket status changes
- Git repository updates
- Email from specific users (future)
- Workspace state changes
**Implementation Path**:
1. Create trigger definition system
2. Implement JIRA webhook listener
3. Add git hook integration
4. Build trigger → workspace creation pipeline
**Key Files**:
- `docs/implementation/DYNAMIC_CONTEXT_TRIGGER_DESIGN.md` - Full design
- `docs/implementation/DYNAMIC_CONTEXT_TRIGGER_IMPLEMENTATION_GUIDE.md` - Implementation steps
## 🗺️ Code Navigation
### Core Application Structure
```
src/
├── app/                          # Next.js app router
│   ├── api/                      # API routes
│   │   ├── workspaces/          # Workspace CRUD and operations
│   │   ├── context-workflow/    # Context import/library management
│   │   └── workspace-drafts/    # Draft workspace management
│   └── page.tsx                 # Main app entry (WorkspaceWorkshop)
│
├── features/                    # Feature-based modules
│   ├── agents/                 # Agent system (CLI integration)
│   │   ├── services/          # AgentService, ClaudeService, GeminiService
│   │   ├── components/        # Terminal UI, chat interface
│   │   └── types/            # TypeScript definitions
│   │
│   ├── context-import/        # Import from external sources
│   │   ├── importers/        # JIRA, Git importers
│   │   └── components/       # Import modal UI
│   │
│   ├── context-library/       # Library management
│   │   └── components/       # Library cards, archive manager
│   │
│   └── workspace-workshop/    # Main IDE interface
│       └── components/       # File explorer, editor, terminal
│
└── lib/                       # Shared utilities
    ├── api-cache.ts          # Performance optimization
    └── context-processor.ts  # Universal context processing
```
### Key Integration Points
#### Adding New Features
1. **New Context Sources**: Implement in `src/features/context-import/importers/`
2. **New Agent Commands**: Add to `src/features/agents/data/commandLibrary.ts`
3. **New Workspace Operations**: Add API routes in `src/app/api/workspaces/`
4. **New UI Components**: Add to relevant feature folder
#### Working with Agents
```typescript
// Agent instantiation flow:
// 1. User clicks agent in workspace
// 2. WorkspaceWorkshop → TerminalModal → ChatInterface
// 3. AgentService.generateStreamingResponse()
// 4. Need to inject permissions/commands here!
```
#### Storage Patterns
```
storage/
├── workspaces/
│   ├── [workspace-id]/
│   │   ├── workspace.json       # Workspace metadata
│   │   ├── context-manifest.json # Context items manifest
│   │   ├── agents/             # Agent data
│   │   │   └── [agent-id]/
│   │   │       └── conversation.json
│   │   └── context/            # Imported context files
│   │
├── library/                    # Shared context library
└── archives/                   # Archived items
```
## 🔧 Development Workflow
### Testing a Feature
1. Run `npm run dev` (port 3001)
2. Create a workspace from library items
3. Deploy an agent to test functionality
4. Check storage files for persistence
5. **Run comprehensive testing after any changes** (Required):
   ```bash
   # Browser-free testing (always available)
   node scripts/test-comprehensive.js
   # Full browser testing (when possible)
   node scripts/setup-puppeteer-testing.js
   ```
### Testing Requirements
**IMPORTANT**: After completing any task, you MUST validate functionality using our testing framework:
#### Required Testing Steps:
1. **Quick Validation**: `node scripts/test-comprehensive.js` (85% coverage, no browser needed)
2. **Full UI Testing**: Puppeteer-based testing when browser is available
3. **Manual Verification**: Check that your changes work in the actual UI
#### Testing Documentation:
- **Complete Testing Guide**: `analysis/TESTING_GUIDE.md`
- **UI Navigation Guide**: `analysis/NAVIGATION_GUIDE.md`
- **Feature Status Matrix**: `analysis/feature-matrix.json`
- **Test Results**: `analysis/comprehensive-test-results.json`
#### Browser Testing Setup:
```bash
# Install Chrome/Chromium (Ubuntu/Debian)
sudo apt-get install chromium-browser
# Or install Chrome manually
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
sudo apt-get update && sudo apt-get install google-chrome-stable
# Run Puppeteer tests
node scripts/capture-app-screenshots.js
```
**Testing Philosophy**: We maintain both browser-free testing (for reliability) and browser testing (for complete UI validation). Use browser-free testing for quick feedback, browser testing for comprehensive validation.
### Common Tasks
#### Add a New Command
```typescript
// In src/features/agents/data/commandLibrary.ts
export const commandLibrary = [
  {
    id: 'new-command',
    name: 'New Command Name',
    description: 'What it does',
    template: 'The prompt template with {{field}} placeholders',
    category: 'category-name',
    fields: [
      { name: 'field', description: 'Field description', required: true }
    ]
  }
];
```
#### Implement a Git Operation
```typescript
// In src/app/api/workspaces/[workspaceId]/git/[operation]/route.ts
export async function POST(request: Request, { params }: { params: { workspaceId: string } }) {
  // 1. Load workspace
  // 2. Execute git command using child_process
  // 3. Return results
}
```
## 📋 Implementation Checklist
### Immediate Priorities
- [ ] Implement permission injection on agent instantiation
- [ ] Create CLAUDE.md generation for workspaces
- [ ] Complete checkpoint save/restore functionality
- [ ] Add git branch management operations
- [ ] Implement basic commit/push workflows
- [ ] **RUN TESTING AFTER EACH IMPLEMENTATION** ⚠️
### Next Phase
- [ ] Dynamic context triggers for JIRA
- [ ] File/text import for documentation
- [ ] Git flow automation (branching strategies)
- [ ] Testing framework integration
- [ ] Command hot-key system
- [ ] **VALIDATE WITH BOTH BROWSER-FREE AND PUPPETEER TESTS** ⚠️
### Future Enhancements
- [ ] Email triggers (when email import is ready)
- [ ] Analytics dashboard for agent effectiveness
- [ ] Multi-workspace coordination
- [ ] Advanced checkpoint sharing/templates
### Testing Validation Requirements ⚠️
**MANDATORY**: After completing ANY task above:
1. **Quick Test**: `node scripts/test-comprehensive.js` (Required - 2 minutes)
2. **Full UI Test**: `node scripts/setup-puppeteer-testing.js` (When browser available)
3. **Manual Check**: Verify changes work in actual browser at http://localhost:3001
4. **Update Documentation**: Update `analysis/feature-matrix.json` if new features added
**Failure to test properly will result in broken deployments and user frustration.**
## 🚨 Important Notes
1. **Permissions First**: Every agent MUST receive permissions on instantiation
2. **Git Integration**: All workspaces should support git operations
3. **Context is King**: The more context provided, the better agents perform
4. **Workspace = Developer**: Think of each workspace as an individual developer
5. **Limited Scope**: This is NOT a full IDE - it's a context engineering tool
## 🤝 Contributing Guidelines
1. **Follow Existing Patterns**: Check similar features before implementing
2. **Update Documentation**: Keep docs in sync with implementation
3. **Test Storage Operations**: Ensure all data persists correctly
4. **Consider Agent Context**: How will agents understand your feature?
5. **Think Git Flow**: How does this fit into developer workflows?
## 📚 Essential Documentation
**Priority Reading**:
1. `docs/agents/AGENT_PERMISSION_SYSTEM.md` - Critical for next phase
2. `docs/agents/AGENT_BUILD_PLAN.md` - Checkpoint system design
3. `docs/implementation/GIT_INTEGRATION_IMPLEMENTATION.md` - Git workflow vision
4. `docs/implementation/DYNAMIC_CONTEXT_TRIGGER_DESIGN.md` - Automation goals
**Testing & Validation** (REQUIRED):
- `docs/testing/TESTING_GUIDE.md` - **Comprehensive testing requirements**
- `docs/testing/NAVIGATION_GUIDE.md` - **UI interaction patterns**
- `analysis/feature-matrix.json` - **Current feature status**
- `analysis/comprehensive-test-results.json` - **Latest test results**
**Architecture**:
- `docs/architecture/CONTEXT_PIPELINE_DESIGN.md` - Original vision (partially outdated)
- `docs/agents/AGENT_DATA_STRUCTURES.md` - Type definitions
- `docs/architecture/WORKSPACE_4_COMPONENT_DESIGN.md` - UI architecture
**Performance** (if needed):
- `docs/performance/PERFORMANCE_OPTIMIZATION_COMPLETE.md` - How we fixed performance
- `docs/performance/API_CACHING_SYSTEM.md` - Caching implementation
- `docs/performance/WSL_PERFORMANCE_OPTIMIZATION.md` - WSL-specific optimizations
## 🎯 Remember the Vision
This tool empowers developers to:
1. Quickly create workspaces for tickets
2. Deploy AI agents with full context
3. Review and refine AI-generated solutions
4. Push to testing with confidence
5. Reduce manual coding tasks over time
The goal is accessibility - making AI coding assistants effective within real business workflows without requiring deep technical knowledge of prompt engineering or AI systems.