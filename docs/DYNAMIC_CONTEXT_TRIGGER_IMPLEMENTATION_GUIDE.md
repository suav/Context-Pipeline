# Dynamic Context Trigger Implementation Guide

## Overview
This guide provides step-by-step instructions for implementing the Dynamic Context Trigger system, including architecture decisions, code organization, and implementation phases.

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  Library Cards  │  Trigger Modal  │  Dashboard  │  Role Views   │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                           API Layer                              │
├─────────────────────────────────────────────────────────────────┤
│  REST Endpoints  │  WebSocket Server  │  Auth Middleware        │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                       Business Logic Layer                       │
├─────────────────────────────────────────────────────────────────┤
│  Trigger Engine  │  Action Dispatcher  │  Resource Manager      │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                        Service Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  Listener Service  │  Workspace Service  │  Deployment Service  │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                         Data Layer                               │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL  │  Redis (Queue)  │  File Storage  │  Audit Logs  │
└─────────────────────────────────────────────────────────────────┘
```

## Phase 1: Core Infrastructure (Week 1-2)

### 1.1 Database Schema

```sql
-- Core trigger tables
CREATE TABLE dynamic_context_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'active',
  priority INTEGER DEFAULT 5,
  
  -- Foreign keys
  context_item_id UUID REFERENCES context_library(id),
  workspace_draft_id UUID REFERENCES workspace_drafts(id),
  
  -- Configuration
  listener_config JSONB NOT NULL,
  workspace_config JSONB NOT NULL,
  agent_config JSONB NOT NULL,
  deliverables JSONB DEFAULT '[]',
  resource_limits JSONB NOT NULL,
  
  -- Metadata
  last_triggered TIMESTAMP WITH TIME ZONE,
  execution_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  
  -- Role-specific
  trigger_type VARCHAR(50), -- 'development', 'testing', 'deployment', 'business'
  requires_agent BOOLEAN DEFAULT true,
  
  CONSTRAINT valid_priority CHECK (priority BETWEEN 1 AND 10)
);

-- Trigger conditions
CREATE TABLE trigger_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID REFERENCES dynamic_context_triggers(id) ON DELETE CASCADE,
  condition_type VARCHAR(50) NOT NULL,
  condition_config JSONB NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger actions
CREATE TABLE trigger_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID REFERENCES dynamic_context_triggers(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  action_config JSONB NOT NULL,
  requires_agent BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Execution history
CREATE TABLE trigger_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID REFERENCES dynamic_context_triggers(id),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) NOT NULL,
  triggered_by JSONB NOT NULL,
  context_snapshot JSONB,
  workspace_id UUID REFERENCES workspaces(id),
  agent_id UUID REFERENCES agents(id),
  deliverables_completed JSONB DEFAULT '[]',
  error_message TEXT,
  metrics JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX idx_triggers_context_item ON dynamic_context_triggers(context_item_id);
CREATE INDEX idx_triggers_status ON dynamic_context_triggers(status);
CREATE INDEX idx_executions_trigger ON trigger_executions(trigger_id);
CREATE INDEX idx_executions_status ON trigger_executions(status);
CREATE INDEX idx_executions_started ON trigger_executions(started_at DESC);
```

### 1.2 Core Type Definitions

```typescript
// src/features/triggers/types/index.ts
export interface DynamicContextTrigger {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  status: TriggerStatus;
  priority: number;
  
  // Core configuration
  context_item_id: string;
  workspace_draft_id: string;
  
  // Component configs
  listener_config: ContextListener;
  workspace_config: TriggerWorkspaceConfig;
  agent_config: TriggerAgentConfig;
  deliverables: TriggerDeliverable[];
  resource_limits: TriggerResourceLimits;
  
  // Execution tracking
  last_triggered?: string;
  execution_count: number;
  failure_count: number;
  
  // Role-specific
  trigger_type?: TriggerType;
  requires_agent: boolean;
}

export type TriggerStatus = 'active' | 'paused' | 'disabled' | 'error';
export type TriggerType = 'development' | 'testing' | 'deployment' | 'business';

export interface ContextListener {
  context_item_id: string;
  listener_type: 'jira' | 'email' | 'slack' | 'git';
  trigger_conditions: TriggerCondition[];
  polling_interval_ms: number;
  last_checked?: string;
  last_known_state?: Record<string, any>;
  error_count: number;
  last_error?: string;
}

export interface TriggerCondition {
  id: string;
  type: ConditionType;
  config: ConditionConfig;
  order_index: number;
}

export type ConditionType = 
  | 'status_change' 
  | 'new_comment' 
  | 'new_message' 
  | 'string_match' 
  | 'assignee_change'
  | 'priority_change'
  | 'branch_ready'
  | 'pr_approved'
  | 'tests_passed';

export interface TriggerAction {
  id: string;
  type: ActionType;
  config: ActionConfig;
  requires_agent: boolean;
  order_index: number;
}

export type ActionType =
  | 'create_workspace'
  | 'update_workspace'
  | 'deploy_environment'
  | 'merge_branches'
  | 'create_pull_request'
  | 'run_tests'
  | 'notify_users'
  | 'update_ticket'
  | 'archive_workspace';
```

### 1.3 Listener Service Implementation

```typescript
// src/features/triggers/services/ListenerService.ts
import { EventEmitter } from 'events';
import { DynamicContextTrigger } from '../types';
import { JiraClient } from '@/lib/integrations/jira';
import { EmailClient } from '@/lib/integrations/email';
import { SlackClient } from '@/lib/integrations/slack';
import { GitClient } from '@/lib/integrations/git';

export class ListenerService extends EventEmitter {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private clients: {
    jira: JiraClient;
    email: EmailClient;
    slack: SlackClient;
    git: GitClient;
  };

  constructor() {
    super();
    this.initializeClients();
  }

  async startListener(trigger: DynamicContextTrigger): Promise<void> {
    const { listener_config } = trigger;
    
    // Clear existing interval if any
    this.stopListener(trigger.id);
    
    // Set up polling interval
    const interval = setInterval(async () => {
      try {
        const hasChanged = await this.checkForChanges(trigger);
        if (hasChanged) {
          this.emit('trigger:activated', trigger);
        }
      } catch (error) {
        this.emit('trigger:error', { trigger, error });
      }
    }, listener_config.polling_interval_ms);
    
    this.intervals.set(trigger.id, interval);
    
    // Initial check
    await this.checkForChanges(trigger);
  }

  stopListener(triggerId: string): void {
    const interval = this.intervals.get(triggerId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(triggerId);
    }
  }

  private async checkForChanges(trigger: DynamicContextTrigger): Promise<boolean> {
    const { listener_config } = trigger;
    const client = this.clients[listener_config.listener_type];
    
    // Get current state
    const currentState = await client.getState(listener_config.context_item_id);
    
    // Compare with last known state
    const lastState = listener_config.last_known_state;
    if (!lastState) {
      // First check, just save state
      await this.updateListenerState(trigger.id, currentState);
      return false;
    }
    
    // Check each condition
    for (const condition of listener_config.trigger_conditions) {
      const triggered = await this.evaluateCondition(
        condition,
        lastState,
        currentState,
        listener_config.listener_type
      );
      
      if (triggered) {
        await this.updateListenerState(trigger.id, currentState);
        return true;
      }
    }
    
    // Update state even if not triggered
    await this.updateListenerState(trigger.id, currentState);
    return false;
  }

  private async evaluateCondition(
    condition: TriggerCondition,
    lastState: any,
    currentState: any,
    listenerType: string
  ): Promise<boolean> {
    switch (condition.type) {
      case 'status_change':
        return this.evaluateStatusChange(condition, lastState, currentState);
      
      case 'new_comment':
        return this.evaluateNewComment(condition, lastState, currentState);
      
      case 'string_match':
        return this.evaluateStringMatch(condition, currentState);
      
      case 'branch_ready':
        return this.evaluateBranchReady(condition, currentState);
      
      // Add more condition evaluators
      default:
        return false;
    }
  }

  // Condition evaluators
  private evaluateStatusChange(
    condition: TriggerCondition,
    lastState: any,
    currentState: any
  ): boolean {
    const config = condition.config as StatusChangeConfig;
    
    if (lastState.status === currentState.status) {
      return false;
    }
    
    if (config.from_status && lastState.status !== config.from_status) {
      return false;
    }
    
    if (config.to_status && currentState.status !== config.to_status) {
      return false;
    }
    
    return true;
  }

  private evaluateNewComment(
    condition: TriggerCondition,
    lastState: any,
    currentState: any
  ): boolean {
    const config = condition.config as NewCommentConfig;
    
    const lastCommentCount = lastState.comments?.length || 0;
    const currentCommentCount = currentState.comments?.length || 0;
    
    if (currentCommentCount <= lastCommentCount) {
      return false;
    }
    
    const newComments = currentState.comments.slice(lastCommentCount);
    
    for (const comment of newComments) {
      if (config.from_user && comment.author !== config.from_user) {
        continue;
      }
      
      if (config.min_length && comment.body.length < config.min_length) {
        continue;
      }
      
      if (config.contains_keywords) {
        const hasKeyword = config.contains_keywords.some(keyword =>
          comment.body.toLowerCase().includes(keyword.toLowerCase())
        );
        if (!hasKeyword) continue;
      }
      
      return true;
    }
    
    return false;
  }

  private async updateListenerState(
    triggerId: string,
    newState: any
  ): Promise<void> {
    // Update in database
    await db.query(
      `UPDATE dynamic_context_triggers 
       SET listener_config = jsonb_set(
         listener_config, 
         '{last_known_state}', 
         $1::jsonb
       ),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(newState), triggerId]
    );
  }
}
```

## Phase 2: Trigger Engine (Week 3-4)

### 2.1 Trigger Engine Implementation

```typescript
// src/features/triggers/services/TriggerEngine.ts
import { Queue } from 'bull';
import { DynamicContextTrigger, TriggerExecution } from '../types';
import { WorkspaceService } from '@/features/workspaces/services';
import { AgentService } from '@/features/agents/services';
import { ResourceManager } from './ResourceManager';
import { ActionDispatcher } from './ActionDispatcher';

export class TriggerEngine {
  private triggerQueue: Queue;
  private resourceManager: ResourceManager;
  private actionDispatcher: ActionDispatcher;
  private workspaceService: WorkspaceService;
  private agentService: AgentService;

  constructor() {
    this.triggerQueue = new Queue('trigger-execution', {
      redis: process.env.REDIS_URL
    });
    
    this.resourceManager = new ResourceManager();
    this.actionDispatcher = new ActionDispatcher();
    this.workspaceService = new WorkspaceService();
    this.agentService = new AgentService();
    
    this.setupQueueProcessing();
  }

  async executeTrigger(
    trigger: DynamicContextTrigger,
    activatedCondition: TriggerCondition
  ): Promise<void> {
    // Check rate limiting
    const canExecute = await this.checkRateLimit(trigger);
    if (!canExecute) {
      await this.queueTrigger(trigger, activatedCondition);
      return;
    }
    
    // Check resource availability
    const resourcesAvailable = await this.resourceManager.checkAvailability(trigger);
    if (!resourcesAvailable) {
      await this.queueTrigger(trigger, activatedCondition);
      return;
    }
    
    // Execute immediately
    await this.processTrigger(trigger, activatedCondition);
  }

  private async processTrigger(
    trigger: DynamicContextTrigger,
    activatedCondition: TriggerCondition
  ): Promise<void> {
    const execution = await this.createExecution(trigger, activatedCondition);
    
    try {
      // Reserve resources
      await this.resourceManager.reserveResources(trigger);
      
      // Execute actions in order
      const actions = await this.loadTriggerActions(trigger.id);
      
      for (const action of actions) {
        await this.actionDispatcher.dispatch(action, trigger, execution);
      }
      
      // Mark execution as completed
      await this.completeExecution(execution.id, 'completed');
      
    } catch (error) {
      await this.completeExecution(execution.id, 'failed', error.message);
      throw error;
      
    } finally {
      // Release resources
      await this.resourceManager.releaseResources(trigger);
    }
  }

  private async checkRateLimit(trigger: DynamicContextTrigger): Promise<boolean> {
    const lastExecution = await this.getLastExecution(trigger.id);
    
    if (!lastExecution) {
      return true;
    }
    
    const timeSinceLastExecution = Date.now() - new Date(lastExecution.started_at).getTime();
    const minInterval = trigger.resource_limits.min_trigger_interval_ms;
    
    return timeSinceLastExecution >= minInterval;
  }

  private setupQueueProcessing(): void {
    this.triggerQueue.process(async (job) => {
      const { trigger, condition } = job.data;
      await this.processTrigger(trigger, condition);
    });
    
    // Priority processing
    setInterval(async () => {
      await this.processPriorityQueue();
    }, 5000); // Check every 5 seconds
  }

  private async processPriorityQueue(): Promise<void> {
    // Get all queued triggers sorted by priority
    const queuedTriggers = await this.getQueuedTriggers();
    
    // Check resource availability
    const availableSlots = await this.resourceManager.getAvailableSlots();
    
    // Process high priority triggers first
    for (const queuedTrigger of queuedTriggers) {
      if (availableSlots.agents <= 0 && queuedTrigger.trigger.requires_agent) {
        continue;
      }
      
      if (availableSlots.workspaces <= 0) {
        continue;
      }
      
      // Process this trigger
      await this.processTrigger(queuedTrigger.trigger, queuedTrigger.condition);
      
      // Update available slots
      if (queuedTrigger.trigger.requires_agent) {
        availableSlots.agents--;
      }
      availableSlots.workspaces--;
      
      if (availableSlots.agents <= 0 && availableSlots.workspaces <= 0) {
        break;
      }
    }
  }
}
```

### 2.2 Action Dispatcher

```typescript
// src/features/triggers/services/ActionDispatcher.ts
export class ActionDispatcher {
  private handlers: Map<ActionType, ActionHandler> = new Map();

  constructor() {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.handlers.set('create_workspace', new CreateWorkspaceHandler());
    this.handlers.set('deploy_environment', new DeployEnvironmentHandler());
    this.handlers.set('merge_branches', new MergeBranchesHandler());
    this.handlers.set('create_pull_request', new CreatePRHandler());
    this.handlers.set('run_tests', new RunTestsHandler());
    this.handlers.set('notify_users', new NotifyUsersHandler());
  }

  async dispatch(
    action: TriggerAction,
    trigger: DynamicContextTrigger,
    execution: TriggerExecution
  ): Promise<void> {
    const handler = this.handlers.get(action.type);
    
    if (!handler) {
      throw new Error(`No handler for action type: ${action.type}`);
    }
    
    await handler.execute(action, trigger, execution);
  }
}

// Example handler for environment deployment (no agent required)
class DeployEnvironmentHandler implements ActionHandler {
  async execute(
    action: TriggerAction,
    trigger: DynamicContextTrigger,
    execution: TriggerExecution
  ): Promise<void> {
    const config = action.config as DeployEnvironmentConfig;
    
    // Merge branches if needed
    if (config.merge_before_deploy) {
      await this.mergeBranches(config.source_branch, config.target_branch);
    }
    
    // Deploy to environment
    await this.deployToEnvironment(config.environment, config.target_branch);
    
    // Create test workspace if configured
    if (config.create_test_workspace) {
      await this.createTestWorkspace(trigger, config);
    }
    
    // Update execution record
    await this.updateExecutionMetrics(execution.id, {
      environment_deployed: config.environment,
      deployment_time: Date.now()
    });
  }

  private async createTestWorkspace(
    trigger: DynamicContextTrigger,
    config: DeployEnvironmentConfig
  ): Promise<void> {
    // Create workspace without agents
    const workspace = await this.workspaceService.createFromDraft(
      trigger.workspace_draft_id,
      {
        title: `Test Environment: ${config.environment}`,
        disable_agents: true,
        context_refresh: true
      }
    );
    
    // Add test-specific context
    await this.workspaceService.addContext(workspace.id, {
      type: 'test_environment',
      environment: config.environment,
      deployed_branch: config.target_branch,
      test_suites: config.test_suites
    });
  }
}
```

## Phase 3: UI Components (Week 5-6)

### 3.1 Library Card Extension

```tsx
// src/features/context-library/components/LibraryCardTriggers.tsx
import React, { useState } from 'react';
import { LibraryItem } from '../types';
import { TriggerButton } from '@/features/triggers/components/TriggerButton';
import { TriggerIndicator } from '@/features/triggers/components/TriggerIndicator';
import { useTriggers } from '@/features/triggers/hooks/useTriggers';

interface LibraryCardTriggersProps {
  item: LibraryItem;
}

export const LibraryCardTriggers: React.FC<LibraryCardTriggersProps> = ({ item }) => {
  const { triggers, loading } = useTriggers(item.id);
  const [showModal, setShowModal] = useState(false);
  
  // Only show for dynamic context types
  const isDynamic = ['jira_ticket', 'email_thread', 'slack_message', 'git_repository']
    .includes(item.type);
  
  if (!isDynamic) {
    return null;
  }
  
  return (
    <div className="library-card-triggers">
      <div className="trigger-summary">
        <TriggerIndicator 
          count={triggers.length}
          hasErrors={triggers.some(t => t.status === 'error')}
          lastActivity={triggers[0]?.last_triggered}
        />
        
        <TriggerButton
          onClick={() => setShowModal(true)}
          variant={triggers.length > 0 ? 'manage' : 'add'}
        />
      </div>
      
      {showModal && (
        <TriggerManagementModal
          contextItem={item}
          initialTriggers={triggers}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};
```

### 3.2 Trigger Management Modal

```tsx
// src/features/triggers/components/TriggerManagementModal.tsx
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TriggerList } from './TriggerList';
import { TriggerForm } from './TriggerForm';
import { TriggerMonitoring } from './TriggerMonitoring';
import { useUserRole } from '@/hooks/useUserRole';

export const TriggerManagementModal: React.FC<Props> = ({
  contextItem,
  initialTriggers,
  onClose
}) => {
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const userRole = useUserRole();
  
  // Get role-specific view
  const getRoleView = () => {
    switch (userRole) {
      case 'tester':
        return <TesterTriggerView contextItem={contextItem} />;
      case 'product_manager':
        return <ManagerTriggerView contextItem={contextItem} />;
      default:
        return <DeveloperTriggerView contextItem={contextItem} />;
    }
  };
  
  return (
    <Modal isOpen onClose={onClose} size="xl">
      <ModalHeader>
        <h2>Manage Triggers: {contextItem.title}</h2>
      </ModalHeader>
      
      <ModalBody>
        <Tabs defaultValue="triggers">
          <TabsList>
            <TabsTrigger value="triggers">Triggers</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="triggers">
            {view === 'list' && (
              <TriggerList
                triggers={initialTriggers}
                onSelect={setSelectedTrigger}
                onAdd={() => setView('create')}
              />
            )}
            
            {view === 'create' && (
              <TriggerForm
                contextItem={contextItem}
                roleView={getRoleView()}
                onSave={() => setView('list')}
                onCancel={() => setView('list')}
              />
            )}
            
            {view === 'edit' && selectedTrigger && (
              <TriggerForm
                contextItem={contextItem}
                triggerId={selectedTrigger}
                roleView={getRoleView()}
                onSave={() => setView('list')}
                onCancel={() => setView('list')}
              />
            )}
          </TabsContent>
          
          <TabsContent value="monitoring">
            <TriggerMonitoring
              triggers={initialTriggers}
              contextItem={contextItem}
            />
          </TabsContent>
          
          <TabsContent value="history">
            <TriggerHistory
              triggers={initialTriggers}
              contextItem={contextItem}
            />
          </TabsContent>
        </Tabs>
      </ModalBody>
    </Modal>
  );
};
```

### 3.3 Role-Specific Views

```tsx
// src/features/triggers/components/roles/TesterTriggerView.tsx
export const TesterTriggerView: React.FC<Props> = ({ contextItem }) => {
  const [config, setConfig] = useState<TesterTriggerConfig>({
    auto_merge: true,
    target_environment: 'qa',
    create_test_workspace: true,
    disable_agents: true,
    link_test_suites: []
  });
  
  return (
    <div className="tester-trigger-config">
      <Section title="Test Environment Setup">
        <EnvironmentSelector
          value={config.target_environment}
          onChange={(env) => setConfig({ ...config, target_environment: env })}
          environments={['qa', 'staging', 'uat']}
        />
        
        <Toggle
          label="Automatically merge branch to test environment"
          checked={config.auto_merge}
          onChange={(checked) => setConfig({ ...config, auto_merge: checked })}
        />
        
        <Toggle
          label="Create test workspace (no coding agents)"
          checked={config.create_test_workspace}
          onChange={(checked) => setConfig({ ...config, create_test_workspace: checked })}
        />
      </Section>
      
      <Section title="Test Configuration">
        <TestSuiteSelector
          selected={config.link_test_suites}
          onChange={(suites) => setConfig({ ...config, link_test_suites: suites })}
        />
        
        <TextArea
          label="Test instructions template"
          value={config.test_instructions}
          onChange={(value) => setConfig({ ...config, test_instructions: value })}
          placeholder="Instructions for manual testing..."
        />
      </Section>
      
      <Section title="Trigger Conditions">
        <ConditionBuilder
          allowedTypes={['branch_ready', 'pr_approved', 'status_change']}
          onChange={(conditions) => setConfig({ ...config, conditions })}
        />
      </Section>
    </div>
  );
};
```

## Phase 4: Integration & Testing (Week 7-8)

### 4.1 API Endpoints

```typescript
// src/app/api/triggers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { TriggerService } from '@/features/triggers/services/TriggerService';
import { withAuth } from '@/lib/auth/middleware';
import { validateTriggerPermissions } from '@/features/triggers/permissions';

export const GET = withAuth(async (req: NextRequest, user: User) => {
  const { searchParams } = new URL(req.url);
  const contextItemId = searchParams.get('context_item_id');
  
  const triggers = await TriggerService.getTriggers({
    contextItemId,
    userId: user.id
  });
  
  return NextResponse.json({ triggers });
});

export const POST = withAuth(async (req: NextRequest, user: User) => {
  const data = await req.json();
  
  // Validate permissions
  const canCreate = await validateTriggerPermissions(user, 'create', data);
  if (!canCreate) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  
  // Create trigger
  const trigger = await TriggerService.createTrigger({
    ...data,
    created_by: user.id
  });
  
  return NextResponse.json({ trigger });
});
```

### 4.2 WebSocket Server

```typescript
// src/lib/websocket/trigger-events.ts
import { Server } from 'socket.io';
import { TriggerEventEmitter } from '@/features/triggers/events';

export function setupTriggerWebSocket(io: Server) {
  const triggerEvents = TriggerEventEmitter.getInstance();
  
  // Trigger execution events
  triggerEvents.on('execution:started', (data) => {
    io.to(`trigger:${data.triggerId}`).emit('trigger:executed', data);
  });
  
  triggerEvents.on('execution:completed', (data) => {
    io.to(`trigger:${data.triggerId}`).emit('trigger:completed', data);
  });
  
  triggerEvents.on('execution:failed', (data) => {
    io.to(`trigger:${data.triggerId}`).emit('trigger:failed', data);
  });
  
  // Environment events
  triggerEvents.on('environment:deployed', (data) => {
    io.to('environments').emit('environment:deployed', data);
  });
  
  // Client connection handling
  io.on('connection', (socket) => {
    socket.on('subscribe:trigger', (triggerId: string) => {
      socket.join(`trigger:${triggerId}`);
    });
    
    socket.on('subscribe:environments', () => {
      socket.join('environments');
    });
  });
}
```

## Phase 5: Monitoring & Analytics (Week 9-10)

### 5.1 Monitoring Dashboard

```tsx
// src/features/triggers/components/TriggerDashboard.tsx
export const TriggerDashboard: React.FC = () => {
  const { metrics, loading } = useTriggerMetrics();
  const { healthStatus } = useTriggerHealth();
  
  return (
    <Dashboard>
      <MetricCard
        title="Active Triggers"
        value={metrics.activeTriggers}
        change={metrics.activeTriggersTrend}
      />
      
      <MetricCard
        title="Executions Today"
        value={metrics.executionsToday}
        subtitle={`${metrics.successRate}% success rate`}
      />
      
      <MetricCard
        title="Avg Response Time"
        value={formatDuration(metrics.avgResponseTime)}
        status={metrics.avgResponseTime > 60000 ? 'warning' : 'success'}
      />
      
      <HealthIndicator status={healthStatus} />
      
      <TriggerActivityChart data={metrics.activityData} />
      
      <FailureAnalysis failures={metrics.recentFailures} />
    </Dashboard>
  );
};
```

### 5.2 Performance Monitoring

```typescript
// src/features/triggers/monitoring/performance.ts
export class TriggerPerformanceMonitor {
  async collectMetrics(): Promise<TriggerMetrics> {
    const [
      executionMetrics,
      resourceMetrics,
      failureMetrics,
      businessMetrics
    ] = await Promise.all([
      this.getExecutionMetrics(),
      this.getResourceMetrics(),
      this.getFailureMetrics(),
      this.getBusinessMetrics()
    ]);
    
    return {
      ...executionMetrics,
      ...resourceMetrics,
      ...failureMetrics,
      ...businessMetrics,
      collected_at: new Date().toISOString()
    };
  }
  
  private async getExecutionMetrics() {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_executions,
        COUNT(*) FILTER (WHERE status = 'completed') as successful_executions,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000) as avg_duration_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000) as p95_duration_ms
      FROM trigger_executions
      WHERE started_at >= NOW() - INTERVAL '24 hours'
    `);
    
    return {
      executionsToday: result.rows[0].total_executions,
      successRate: (result.rows[0].successful_executions / result.rows[0].total_executions) * 100,
      avgResponseTime: result.rows[0].avg_duration_ms,
      p95ResponseTime: result.rows[0].p95_duration_ms
    };
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
// src/features/triggers/__tests__/TriggerEngine.test.ts
describe('TriggerEngine', () => {
  let engine: TriggerEngine;
  let mockResourceManager: jest.Mocked<ResourceManager>;
  
  beforeEach(() => {
    engine = new TriggerEngine();
    mockResourceManager = createMockResourceManager();
  });
  
  describe('executeTrigger', () => {
    it('should execute immediately when resources available', async () => {
      mockResourceManager.checkAvailability.mockResolvedValue(true);
      
      const trigger = createMockTrigger();
      const condition = createMockCondition();
      
      await engine.executeTrigger(trigger, condition);
      
      expect(mockResourceManager.reserveResources).toHaveBeenCalledWith(trigger);
    });
    
    it('should queue trigger when rate limited', async () => {
      const trigger = createMockTrigger({
        last_triggered: new Date().toISOString(),
        resource_limits: { min_trigger_interval_ms: 60000 }
      });
      
      await engine.executeTrigger(trigger, createMockCondition());
      
      expect(mockQueue.add).toHaveBeenCalled();
    });
  });
});
```

### Integration Tests

```typescript
// src/features/triggers/__tests__/integration/trigger-flow.test.ts
describe('Trigger Flow Integration', () => {
  it('should handle complete JIRA to deployment flow', async () => {
    // Create test context
    const jiraTicket = await createTestJiraTicket({
      status: 'In Progress'
    });
    
    const trigger = await createTestTrigger({
      context_item_id: jiraTicket.id,
      conditions: [{ type: 'status_change', to_status: 'Ready for QA' }],
      actions: [
        { type: 'merge_branches', config: { source: 'feature/test', target: 'qa' } },
        { type: 'deploy_environment', config: { environment: 'qa' } },
        { type: 'create_workspace', config: { disable_agents: true } }
      ]
    });
    
    // Simulate status change
    await updateJiraStatus(jiraTicket.id, 'Ready for QA');
    
    // Wait for trigger execution
    await waitForTriggerExecution(trigger.id);
    
    // Verify results
    const execution = await getLatestExecution(trigger.id);
    expect(execution.status).toBe('completed');
    
    const deployment = await getEnvironmentStatus('qa');
    expect(deployment.branch).toBe('qa');
    expect(deployment.merged_from).toContain('feature/test');
    
    const workspace = await getWorkspace(execution.workspace_id);
    expect(workspace.agents).toHaveLength(0);
  });
});
```

## Deployment Guide

### Environment Variables

```bash
# Trigger System Configuration
TRIGGER_POLLING_MIN_INTERVAL=5000
TRIGGER_MAX_CONCURRENT_EXECUTIONS=50
TRIGGER_RESOURCE_LIMITS_ENABLED=true

# Global Resource Limits
MAX_CONCURRENT_AGENTS=100
MAX_CONCURRENT_WORKSPACES=200
PRIORITY_AGENT_RESERVATION_PERCENT=30

# External Service Credentials
JIRA_API_TOKEN=xxx
SLACK_BOT_TOKEN=xxx
EMAIL_SERVICE_KEY=xxx
GIT_INTEGRATION_TOKEN=xxx

# Redis Configuration (for queuing)
REDIS_URL=redis://localhost:6379
REDIS_QUEUE_DB=1

# Monitoring
ENABLE_TRIGGER_METRICS=true
METRICS_RETENTION_DAYS=90
ALERT_WEBHOOK_URL=https://alerts.example.com/webhook
```

### Database Migrations

```bash
# Run migrations
npm run db:migrate

# Verify schema
npm run db:verify

# Create indexes for performance
npm run db:optimize
```

### Service Startup

```bash
# Start all services
npm run services:start

# Start individual services
npm run listener:start
npm run trigger-engine:start
npm run monitor:start

# Health check
curl http://localhost:3000/api/health/triggers
```

## Monitoring & Maintenance

### Key Metrics to Track
1. Trigger execution success rate
2. Average execution time by trigger type
3. Resource utilization (agents, workspaces)
4. Queue depth and wait times
5. Error rates by integration type

### Alerts to Configure
1. High failure rate (>10% in 5 minutes)
2. Long queue wait times (>5 minutes)
3. Resource exhaustion (>90% utilization)
4. Integration connection failures
5. Execution timeouts

### Maintenance Tasks
1. Clean up old execution records (>90 days)
2. Archive completed workspace data
3. Update integration credentials
4. Review and optimize slow triggers
5. Capacity planning based on usage trends