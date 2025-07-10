# Permissions & Commands Implementation Guide
## Overview
This guide provides concrete implementation steps for the highest priority feature: injecting permissions and commands when agents are instantiated in workspaces.
## Current State
### What Exists
- Basic tool approval UI (`ToolApprovalOverlay.tsx`)
- Command library data structure (`commandLibrary.ts`)
- Agent service that loads workspace context (`AgentService.ts`)
- Design documentation (`AGENT_PERMISSION_SYSTEM.md`)
### What's Missing
- Permission injection on agent instantiation
- CLAUDE.md generation in workspaces
- Command injection system
- Global configuration management
- Hot command detection and injection
## Implementation Plan
### Phase 1: Global Configuration System
#### 1.1 Create Global Config Store
```typescript
// src/lib/global-config.ts
export // Duplicate type removed: GlobalConfig (see ./AGENT_WORK_PACKAGES.md);
  commands: {
    library: CommandDefinition[];
    categories: string[];
    hotKeys: Record<string, string>; // key -> commandId
  };
  documents: {
    claudeMd: string; // Template for CLAUDE.md
    codingStandards: string;
    additionalContext: string[];
  };
}
// Store in: storage/config/global-config.json
```
#### 1.2 Create Config Management API
```typescript
// src/app/api/config/route.ts
// GET: Retrieve global config
// PUT: Update global config (admin only)
// POST: Validate config structure
```
### Phase 2: Workspace Document Generation
#### 2.1 CLAUDE.md Generation
```typescript
// src/features/workspaces/services/WorkspaceDocumentGenerator.ts
export class WorkspaceDocumentGenerator {
  static async generateClaudeMd(
    workspaceId: string,
    workspaceContext: WorkspaceContext
  ): Promise<void> {
    const template = await loadGlobalConfig().documents.claudeMd;
    const customized = interpolateTemplate(template, {
      workspaceName: workspaceContext.name,
      contextItems: workspaceContext.items,
      permissions: workspaceContext.permissions,
      commands: workspaceContext.availableCommands
    });
    await saveToWorkspace(workspaceId, 'CLAUDE.md', customized);
  }
}
```
#### 2.2 Trigger on First Agent
```typescript
// src/features/agents/services/AgentService.ts
// In loadWorkspaceContext():
if (!workspaceHasClaudeMd(workspaceId)) {
  await WorkspaceDocumentGenerator.generateClaudeMd(workspaceId, context);
  await WorkspaceDocumentGenerator.generatePermissions(workspaceId, context);
  await WorkspaceDocumentGenerator.generateCommands(workspaceId, context);
}
```
### Phase 3: Permission Injection System
#### 3.1 Permission Structure
```typescript
// src/features/agents/types/permissions.ts
export interface WorkspacePermissions {
  fileSystem: {
    read: string[]; // Allowed paths
    write: string[]; // Allowed paths
    execute: string[]; // Allowed commands
  };
  git: {
    allowedOperations: ('diff' | 'commit' | 'push' | 'branch')[];
    protectedBranches: string[];
    requiresApproval: string[];
  };
  external: {
    allowedHosts: string[];
    apiKeys: Record<string, string>; // Masked in UI
  };
}
```
#### 3.2 Permission Injection
```typescript
// src/features/agents/services/BaseAIService.ts
// In buildSystemPrompt():
const permissions = await loadWorkspacePermissions(workspaceId);
const permissionText = formatPermissionsForAgent(permissions);
systemPrompt += `\n\n## Workspace Permissions\n${permissionText}`;
systemPrompt += `\n\n## Available Commands\n${commandsText}`;
```
### Phase 4: Command Management System
#### 4.1 Command Enhancement
```typescript
// Extend existing commandLibrary.ts
export interface EnhancedCommand extends Command {
  id: string;
  hotKey?: string; // e.g., "/test", "/commit"
  requiredPermissions: string[];
  contextRequirements: string[]; // e.g., "git-repo", "test-framework"
  template: string;
  examples: CommandExample[];
}
```
#### 4.2 Command Injection Service
```typescript
// src/features/agents/services/CommandInjectionService.ts
export class CommandInjectionService {
  static async detectHotCommand(
    message: string,
    workspaceContext: WorkspaceContext
  ): Promise<EnhancedCommand | null> {
    // Check for hot commands like /test, /commit
    const hotKeyMatch = message.match(/^\/(\w+)/);
    if (hotKeyMatch) {
      return await this.getCommandByHotKey(hotKeyMatch[1]);
    }
    // Check for contextual commands
    return await this.suggestContextualCommand(message, workspaceContext);
  }
  static async injectCommand(
    command: EnhancedCommand,
    context: Record<string, any>
  ): Promise<string> {
    // Interpolate command template with context
    return interpolateTemplate(command.template, context);
  }
}
```
### Phase 5: Integration Points
#### 5.1 Agent Message Processing
```typescript
// src/features/agents/services/AgentService.ts
async generateStreamingResponse(
  workspaceId: string,
  agentId: string,
  userMessage: string,
  conversationHistory: ConversationMessage[],
  preferredModel?: string
): Promise<AsyncIterable<string>> {
  // 1. Check for hot commands
  const command = await CommandInjectionService.detectHotCommand(
    userMessage,
    workspaceContext
  );
  if (command) {
    // 2. Check permissions
    const hasPermission = await this.checkCommandPermission(
      command,
      workspacePermissions
    );
    if (!hasPermission) {
      return this.createPermissionDeniedStream(command);
    }
    // 3. Inject command
    userMessage = await CommandInjectionService.injectCommand(
      command,
      { workspace: workspaceContext, original: userMessage }
    );
  }
  // Continue with normal flow...
}
```
#### 5.2 UI Integration
```typescript
// src/features/agents/components/terminal/CommandPalette.tsx
// Show available commands based on:
// - Workspace context
// - Current permissions
// - Recent usage
// - Contextual relevance
```
### Phase 6: Testing & Validation
#### 6.1 Permission Validation
```typescript
// src/features/agents/services/PermissionValidator.ts
export class PermissionValidator {
  static async validateOperation(
    operation: string,
    target: string,
    permissions: WorkspacePermissions
  ): Promise<ValidationResult> {
    // Check against permission rules
    // Log all checks for audit
    // Return allow/deny with reason
  }
}
```
#### 6.2 Command Testing
```typescript
// Create test workspace with known context
// Test each command with various inputs
// Verify permission checks work
// Test hot command detection
```
## File Structure
```
src/
├── lib/
│   └── global-config.ts         # Global configuration types & loader
├── features/
│   ├── agents/
│   │   ├── services/
│   │   │   ├── CommandInjectionService.ts
│   │   │   ├── PermissionValidator.ts
│   │   │   └── (updated) AgentService.ts
│   │   └── types/
│   │       └── (updated) permissions.ts
│   └── workspaces/
│       └── services/
│           └── WorkspaceDocumentGenerator.ts
└── app/
    └── api/
        └── config/
            └── route.ts         # Global config API
```
## Configuration Examples
### Global Permissions Template
```json
{
  "permissions": {
    "defaults": {
      "fileSystem": {
        "read": ["./src", "./docs", "./package.json"],
        "write": ["./src"],
        "execute": ["npm test", "npm run lint"]
      },
      "git": {
        "allowedOperations": ["diff", "commit"],
        "requiresApproval": ["push"],
        "protectedBranches": ["main", "production"]
      }
    },
    "templates": {
      "readonly": { ... },
      "developer": { ... },
      "admin": { ... }
    }
  }
}
```
### Command Library Entry
```json
{
  "id": "run-tests",
  "name": "Run Tests",
  "hotKey": "/test",
  "category": "testing",
  "requiredPermissions": ["fileSystem.execute"],
  "contextRequirements": ["test-framework"],
  "template": "Please run the test suite for {{context}}. First check which test framework is being used (jest, mocha, etc.), then run the appropriate test command. If any tests fail, analyze the errors and suggest fixes.",
  "examples": [
    {
      "input": "/test",
      "context": "Full project",
      "output": "npm test"
    }
  ]
}
```
## Implementation Timeline
### Week 1: Foundation
- [ ] Create global config system
- [ ] Build config management API
- [ ] Design permission structures
### Week 2: Document Generation
- [ ] Implement CLAUDE.md generator
- [ ] Create workspace document templates
- [ ] Test document generation
### Week 3: Permission System
- [ ] Build permission validator
- [ ] Integrate with agent service
- [ ] Add audit logging
### Week 4: Command System
- [ ] Enhance command library
- [ ] Build command injection service
- [ ] Implement hot command detection
### Week 5: Integration & Testing
- [ ] Full integration testing
- [ ] UI enhancements
- [ ] Documentation updates
## Success Criteria
1. **Every agent receives permissions** on instantiation
2. **CLAUDE.md exists** in every workspace with an agent
3. **Commands are globally managed** but contextually applied
4. **Hot commands work** with proper permission checks
5. **Audit trail exists** for all permission checks
6. **UI shows available commands** based on context
## Notes for Implementation
1. Start with read-only permissions and gradually add write operations
2. Use the existing tool approval UI as a foundation
3. Keep permission checks fast to not slow down agent responses
4. Make permissions visible in the UI for transparency
5. Consider workspace templates for common permission sets
6. Plan for permission inheritance and overrides
7. Ensure backward compatibility with existing workspaces
This implementation guide provides a concrete path to building the permission and command injection system that will make agents more effective and secure within Context Pipeline.