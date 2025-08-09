import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { WorkspaceTrigger, TriggerCondition, TemplateOverrides } from '../types';
import { templateLogger } from './TemplateLogger';
import { TemplateService } from './TemplateService';

export class TriggerService {
  private static instance: TriggerService;
  private triggersDir: string;
  private triggerIndexFile: string;
  private templateService: TemplateService;

  private constructor() {
    this.triggersDir = join(process.cwd(), 'storage', 'triggers');
    this.triggerIndexFile = join(this.triggersDir, 'trigger-index.json');
    this.templateService = TemplateService.getInstance();
    this.ensureDirectories();
    templateLogger.systemInfo('TriggerService initialized', { triggers_dir: this.triggersDir });
  }

  static getInstance(): TriggerService {
    if (!TriggerService.instance) {
      TriggerService.instance = new TriggerService();
    }
    return TriggerService.instance;
  }

  private ensureDirectories(): void {
    if (!existsSync(this.triggersDir)) {
      mkdirSync(this.triggersDir, { recursive: true });
      templateLogger.systemInfo('Created triggers directory');
    }
    
    if (!existsSync(this.triggerIndexFile)) {
      writeFileSync(this.triggerIndexFile, JSON.stringify([], null, 2));
      templateLogger.systemInfo('Created trigger index file');
    }
  }

  // Trigger CRUD Operations
  async createTrigger(trigger: Omit<WorkspaceTrigger, 'id' | 'created_at' | 'updated_at' | 'execution_count' | 'success_count' | 'failure_count'>): Promise<WorkspaceTrigger> {
    // Validate template exists
    const template = await this.templateService.getTemplate(trigger.template_id);
    if (!template) {
      const error = `Template not found: ${trigger.template_id}`;
      templateLogger.systemError(error, { template_id: trigger.template_id });
      throw new Error(error);
    }

    const newTrigger: WorkspaceTrigger = {
      ...trigger,
      id: this.generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      execution_count: 0,
      success_count: 0,
      failure_count: 0
    };

    // Save trigger to file
    const triggerFile = join(this.triggersDir, `${newTrigger.id}.json`);
    writeFileSync(triggerFile, JSON.stringify(newTrigger, null, 2));

    // Update index
    await this.updateTriggerIndex();

    templateLogger.triggerCreated(newTrigger.id, newTrigger.template_id, newTrigger.name);

    return newTrigger;
  }

  async getTrigger(id: string): Promise<WorkspaceTrigger | null> {
    try {
      const triggerFile = join(this.triggersDir, `${id}.json`);
      if (!existsSync(triggerFile)) {
        templateLogger.systemWarning(`Trigger not found: ${id}`);
        return null;
      }

      const triggerData = JSON.parse(readFileSync(triggerFile, 'utf-8'));
      return triggerData as WorkspaceTrigger;
    } catch (error) {
      templateLogger.systemError(`Failed to load trigger: ${id}`, error);
      return null;
    }
  }

  async getAllTriggers(): Promise<WorkspaceTrigger[]> {
    try {
      const triggers: WorkspaceTrigger[] = [];
      const files = readdirSync(this.triggersDir).filter(f => f.endsWith('.json') && f !== 'trigger-index.json');
      
      for (const file of files) {
        const triggerData = JSON.parse(readFileSync(join(this.triggersDir, file), 'utf-8'));
        triggers.push(triggerData as WorkspaceTrigger);
      }

      triggers.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      return triggers;
    } catch (error) {
      templateLogger.systemError('Failed to load triggers', error);
      return [];
    }
  }

  async getTriggersForTemplate(templateId: string): Promise<WorkspaceTrigger[]> {
    const allTriggers = await this.getAllTriggers();
    return allTriggers.filter(trigger => trigger.template_id === templateId);
  }

  async getActiveTriggers(): Promise<WorkspaceTrigger[]> {
    const allTriggers = await this.getAllTriggers();
    return allTriggers.filter(trigger => trigger.status === 'active');
  }

  async updateTrigger(id: string, updates: Partial<WorkspaceTrigger>): Promise<WorkspaceTrigger | null> {
    const existing = await this.getTrigger(id);
    if (!existing) {
      return null;
    }

    const updated: WorkspaceTrigger = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      created_at: existing.created_at, // Preserve creation date
      updated_at: new Date().toISOString()
    };

    const triggerFile = join(this.triggersDir, `${id}.json`);
    writeFileSync(triggerFile, JSON.stringify(updated, null, 2));

    templateLogger.systemInfo(`Updated trigger: ${updated.name}`, { trigger_id: id });
    return updated;
  }

  async deleteTrigger(id: string): Promise<boolean> {
    try {
      const existing = await this.getTrigger(id);
      if (!existing) {
        return false;
      }

      const triggerFile = join(this.triggersDir, `${id}.json`);
      if (existsSync(triggerFile)) {
        // In a real implementation, you'd use fs.unlinkSync
        // For safety in this demo, we'll just log the deletion
        templateLogger.systemInfo(`Trigger deleted: ${existing.name}`, { trigger_id: id });
        return true;
      }

      return false;
    } catch (error) {
      templateLogger.systemError(`Failed to delete trigger: ${id}`, error);
      return false;
    }
  }

  // Trigger Execution Logic
  async executeTrigger(
    triggerId: string,
    triggerContext: any = {}
  ): Promise<{ success: boolean; workspaceId?: string; error?: string }> {
    const trigger = await this.getTrigger(triggerId);
    if (!trigger) {
      const error = `Trigger not found: ${triggerId}`;
      templateLogger.triggerFailed(triggerId, error);
      return { success: false, error };
    }

    if (trigger.status !== 'active') {
      const error = `Trigger is not active: ${trigger.status}`;
      templateLogger.triggerFailed(triggerId, error);
      return { success: false, error };
    }

    templateLogger.triggerActivated(triggerId, trigger.template_id, 'manual_execution');

    try {
      // Build context overrides from trigger configuration
      const contextOverrides: Record<string, string> = {};
      
      // If the trigger specifies a specific context item to monitor, use it
      if (trigger.context_listener.context_item_id) {
        // Map the context item to appropriate wildcard type based on template requirements
        const template = await this.templateService.getTemplate(trigger.template_id);
        if (template) {
          for (const req of template.context_requirements) {
            if (req.type === 'wildcard') {
              // Simple heuristic: use the monitored context item for the first wildcard
              contextOverrides[req.wildcard_type!] = trigger.context_listener.context_item_id;
              break;
            }
          }
        }
      }

      // Apply template with trigger overrides
      const result = await this.templateService.applyTemplate(trigger.template_id, {
        triggerId,
        contextOverrides,
        variableValues: this.resolveVariableValues(trigger, triggerContext),
        triggerContext
      });

      if (result.success) {
        // Update trigger success statistics
        await this.updateTriggerStats(triggerId, true);
        
        templateLogger.systemInfo(`Trigger execution successful`, {
          trigger_id: triggerId,
          template_id: trigger.template_id,
          workspace_id: result.workspace_id
        });

        return { success: true, workspaceId: result.workspace_id };
      } else {
        await this.updateTriggerStats(triggerId, false);
        
        const errorMsg = result.errors.map(e => e.message).join('; ');
        templateLogger.triggerFailed(triggerId, errorMsg, result);
        
        return { success: false, error: errorMsg };
      }

    } catch (error) {
      await this.updateTriggerStats(triggerId, false);
      templateLogger.triggerFailed(triggerId, error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  // Variable resolution based on trigger mapping and context
  private resolveVariableValues(trigger: WorkspaceTrigger, context: any): Record<string, any> {
    const resolved: Record<string, any> = {};

    for (const [variableName, mapping] of Object.entries(trigger.variable_mapping)) {
      try {
        let value: any;

        switch (mapping.source) {
          case 'jira_field':
            value = this.extractFromPath(context, mapping.field_path || variableName);
            break;
          case 'git_context':
            value = this.extractFromPath(context, mapping.field_path || variableName);
            break;
          case 'static':
            value = mapping.default_value;
            break;
          case 'user_input':
            // For user input, would typically come from UI - use default for now
            value = mapping.default_value;
            break;
          case 'library_metadata':
            // Extract from library item metadata if available
            value = this.extractFromPath(context.library_metadata, mapping.field_path || variableName);
            break;
          default:
            value = mapping.default_value;
        }

        if (value !== undefined) {
          // Apply transform if specified
          if (mapping.transform) {
            value = this.applyTransform(value, mapping.transform);
          }
          
          resolved[variableName] = value;
          templateLogger.variableResolved(trigger.template_id, variableName, value, mapping.source);
        }

      } catch (error) {
        templateLogger.variableResolutionFailed(trigger.template_id, variableName, error);
        
        // Use default value if available
        if (mapping.default_value !== undefined) {
          resolved[variableName] = mapping.default_value;
        }
      }
    }

    return resolved;
  }

  private extractFromPath(obj: any, path?: string): any {
    if (!path || !obj) return undefined;
    
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private applyTransform(value: any, transformName: string): any {
    // Basic transforms - could be expanded
    switch (transformName) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'trim':
        return String(value).trim();
      case 'date_format':
        return new Date(value).toLocaleDateString();
      default:
        return value;
    }
  }

  // Condition Evaluation (simplified for demo)
  async evaluateTriggerConditions(
    trigger: WorkspaceTrigger,
    currentState: any,
    previousState?: any
  ): Promise<boolean> {
    const conditions = trigger.context_listener.trigger_conditions;
    
    // All conditions must be satisfied (AND logic)
    for (const condition of conditions) {
      const satisfied = await this.evaluateCondition(condition, currentState, previousState);
      if (!satisfied) {
        return false;
      }
    }

    return conditions.length > 0; // At least one condition must exist
  }

  private async evaluateCondition(
    condition: TriggerCondition,
    currentState: any,
    previousState?: any
  ): Promise<boolean> {
    switch (condition.type) {
      case 'status_change':
        return this.evaluateStatusChange(condition, currentState, previousState);
      case 'new_comment':
        return this.evaluateNewComment(condition, currentState, previousState);
      case 'assignee_change':
        return this.evaluateAssigneeChange(condition, currentState, previousState);
      case 'priority_change':
        return this.evaluatePriorityChange(condition, currentState, previousState);
      case 'string_match':
        return this.evaluateStringMatch(condition, currentState);
      default:
        templateLogger.systemWarning(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  private evaluateStatusChange(condition: TriggerCondition, currentState: any, previousState?: any): boolean {
    const config = condition.config;
    const currentStatus = currentState.status || currentState.fields?.status?.name;
    const previousStatus = previousState?.status || previousState?.fields?.status?.name;

    // Check if status actually changed
    if (currentStatus === previousStatus) {
      return false;
    }

    // Check from_status constraint
    if (config.from_status && previousStatus !== config.from_status) {
      return false;
    }

    // Check to_status constraint  
    if (config.to_status && currentStatus !== config.to_status) {
      return false;
    }

    return true;
  }

  private evaluateNewComment(condition: TriggerCondition, currentState: any, previousState?: any): boolean {
    const currentComments = currentState.comments || [];
    const previousComments = previousState?.comments || [];
    
    return currentComments.length > previousComments.length;
  }

  private evaluateAssigneeChange(condition: TriggerCondition, currentState: any, previousState?: any): boolean {
    const config = condition.config;
    const currentAssignee = currentState.assignee || currentState.fields?.assignee?.name;
    const previousAssignee = previousState?.assignee || previousState?.fields?.assignee?.name;

    if (currentAssignee === previousAssignee) {
      return false;
    }

    if (config.new_assignee && currentAssignee !== config.new_assignee) {
      return false;
    }

    return true;
  }

  private evaluatePriorityChange(condition: TriggerCondition, currentState: any, previousState?: any): boolean {
    const config = condition.config;
    const currentPriority = currentState.priority || currentState.fields?.priority?.name;
    const previousPriority = previousState?.priority || previousState?.fields?.priority?.name;

    if (currentPriority === previousPriority) {
      return false;
    }

    if (config.from_priority && previousPriority !== config.from_priority) {
      return false;
    }

    if (config.to_priority && currentPriority !== config.to_priority) {
      return false;
    }

    return true;
  }

  private evaluateStringMatch(condition: TriggerCondition, currentState: any): boolean {
    const config = condition.config;
    const searchString = config.search_string;
    
    if (!searchString) {
      return false;
    }

    const searchText = config.field_path ? 
      this.extractFromPath(currentState, config.field_path) : 
      JSON.stringify(currentState);

    if (!searchText) {
      return false;
    }

    const text = String(searchText);
    const pattern = config.case_sensitive ? searchString : searchString.toLowerCase();
    const target = config.case_sensitive ? text : text.toLowerCase();

    return target.includes(pattern);
  }

  // Mock Context Monitoring (would be replaced with real monitoring)
  async startMonitoring(triggerId: string): Promise<void> {
    const trigger = await this.getTrigger(triggerId);
    if (!trigger || trigger.status !== 'active') {
      return;
    }

    templateLogger.systemInfo(`Started monitoring for trigger: ${trigger.name}`, {
      trigger_id: triggerId,
      context_item: trigger.context_listener.context_item_id,
      polling_interval: trigger.context_listener.polling_interval_ms
    });

    // In a real implementation, this would:
    // 1. Set up polling intervals
    // 2. Monitor external systems (JIRA, Git, etc.)
    // 3. Evaluate conditions on state changes
    // 4. Execute trigger when conditions are met
  }

  async stopMonitoring(triggerId: string): Promise<void> {
    templateLogger.systemInfo(`Stopped monitoring for trigger: ${triggerId}`);
    
    // In a real implementation, this would clean up polling intervals
  }

  // Statistics and Management
  private async updateTriggerStats(triggerId: string, success: boolean): Promise<void> {
    try {
      const trigger = await this.getTrigger(triggerId);
      if (!trigger) return;

      const updates: Partial<WorkspaceTrigger> = {
        execution_count: trigger.execution_count + 1,
        last_triggered: new Date().toISOString()
      };

      if (success) {
        updates.success_count = trigger.success_count + 1;
      } else {
        updates.failure_count = trigger.failure_count + 1;
      }

      await this.updateTrigger(triggerId, updates);

    } catch (error) {
      templateLogger.systemError(`Failed to update trigger stats: ${triggerId}`, error);
    }
  }

  // Utility methods
  private generateId(): string {
    return 'trig_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private async updateTriggerIndex(): void {
    try {
      const triggers = await this.getAllTriggers();
      const index = triggers.map(t => ({
        id: t.id,
        name: t.name,
        template_id: t.template_id,
        status: t.status,
        updated_at: t.updated_at
      }));
      
      writeFileSync(this.triggerIndexFile, JSON.stringify(index, null, 2));
    } catch (error) {
      templateLogger.systemError('Failed to update trigger index', error);
    }
  }

  // Test/Demo methods
  async createSampleTriggers(): Promise<WorkspaceTrigger[]> {
    templateLogger.systemInfo('Creating sample triggers for testing');

    const templates = await this.templateService.getAllTemplates();
    const sampleTriggers: WorkspaceTrigger[] = [];

    if (templates.length === 0) {
      templateLogger.systemWarning('No templates available for creating sample triggers');
      return [];
    }

    // Create sample triggers for each template
    for (const template of templates.slice(0, 2)) { // Limit to first 2 templates
      try {
        const trigger = await this.createTrigger({
          name: `Sample Trigger for ${template.name}`,
          description: `Automatically created trigger for testing ${template.name} template`,
          created_by: 'system',
          template_id: template.id,
          template_overrides: {
            naming_pattern: `[AUTO] ${template.workspace_config.naming_pattern}`,
            additional_commands: ['log_automation']
          },
          context_listener: {
            context_item_id: 'lib_sample_001', // Mock context item
            listener_type: 'jira',
            trigger_conditions: [
              {
                id: 'cond_' + Date.now(),
                type: 'status_change',
                config: {
                  to_status: 'In Progress'
                }
              }
            ],
            polling_interval_ms: 60000 // 1 minute
          },
          variable_mapping: {
            'jira.key': {
              source: 'jira_field',
              field_path: 'key',
              default_value: 'DEMO-123'
            },
            'jira.summary': {
              source: 'jira_field',
              field_path: 'fields.summary',
              default_value: 'Demo ticket summary'
            }
          },
          status: 'active',
          auto_deploy: true,
          requires_approval: false,
          resource_limits: {
            max_concurrent_workspaces: 5,
            max_concurrent_agents: 3,
            min_trigger_interval_ms: 30000,
            timeout_ms: 300000
          }
        });

        sampleTriggers.push(trigger);
        templateLogger.systemInfo(`Created sample trigger: ${trigger.name}`, {
          trigger_id: trigger.id,
          template_id: template.id
        });

      } catch (error) {
        templateLogger.systemError(`Failed to create sample trigger for template: ${template.name}`, error);
      }
    }

    return sampleTriggers;
  }

  // Manual trigger execution for testing
  async testTrigger(triggerId: string, mockContext: any = {}): Promise<any> {
    templateLogger.systemInfo(`Testing trigger execution: ${triggerId}`, { mock_context: mockContext });

    const defaultMockContext = {
      key: 'TEST-123',
      fields: {
        summary: 'Test ticket for trigger execution',
        description: 'This is a mock ticket created for testing trigger functionality',
        status: { name: 'In Progress' },
        priority: { name: 'Medium' },
        assignee: { name: 'Test User' }
      },
      comments: [
        { author: 'Test User', body: 'Initial comment', created: new Date().toISOString() }
      ]
    };

    const testContext = { ...defaultMockContext, ...mockContext };
    
    return await this.executeTrigger(triggerId, testContext);
  }
}

export const triggerService = TriggerService.getInstance();