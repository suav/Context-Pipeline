import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { TemplateLogEntry } from '../types';

export class TemplateLogger {
  private static instance: TemplateLogger;
  private logDir: string;
  private sessionId: string;

  private constructor() {
    this.logDir = join(process.cwd(), 'storage', 'logs', 'templates');
    this.sessionId = new Date().toISOString().replace(/[:.]/g, '-');
    this.ensureLogDirectory();
  }

  static getInstance(): TemplateLogger {
    if (!TemplateLogger.instance) {
      TemplateLogger.instance = new TemplateLogger();
    }
    return TemplateLogger.instance;
  }

  private ensureLogDirectory(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  private createLogEntry(
    level: 'info' | 'warn' | 'error' | 'debug',
    category: 'template' | 'trigger' | 'application' | 'system',
    message: string,
    options: {
      template_id?: string;
      trigger_id?: string;
      workspace_id?: string;
      details?: any;
      execution_context?: string;
    } = {}
  ): TemplateLogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      ...options
    };
  }

  private writeLog(entry: TemplateLogEntry): void {
    const logLine = JSON.stringify(entry) + '\n';
    
    // Write to category-specific log file
    const categoryFile = join(this.logDir, `${entry.category}-${this.sessionId}.log`);
    appendFileSync(categoryFile, logLine);
    
    // Also write to main log file
    const mainFile = join(this.logDir, `main-${this.sessionId}.log`);
    appendFileSync(mainFile, logLine);
    
    // Console output for development
    const consoleMessage = `[${entry.timestamp}] ${entry.level.toUpperCase()} [${entry.category}] ${entry.message}`;
    
    switch (entry.level) {
      case 'error':
        console.error(consoleMessage, entry.details || '');
        break;
      case 'warn':
        console.warn(consoleMessage, entry.details || '');
        break;
      case 'debug':
        console.debug(consoleMessage, entry.details || '');
        break;
      default:
        console.log(consoleMessage, entry.details || '');
    }
  }

  // Template-specific logging methods
  templateCreated(templateId: string, name: string, details?: any): void {
    const entry = this.createLogEntry('info', 'template', `Template created: ${name}`, {
      template_id: templateId,
      details,
      execution_context: 'template_creation'
    });
    this.writeLog(entry);
  }

  templateUpdated(templateId: string, changes: any): void {
    const entry = this.createLogEntry('info', 'template', `Template updated`, {
      template_id: templateId,
      details: changes,
      execution_context: 'template_update'
    });
    this.writeLog(entry);
  }

  templateDeleted(templateId: string, name: string): void {
    const entry = this.createLogEntry('info', 'template', `Template deleted: ${name}`, {
      template_id: templateId,
      execution_context: 'template_deletion'
    });
    this.writeLog(entry);
  }

  templateApplicationStarted(templateId: string, triggerId?: string, workspaceId?: string): void {
    const entry = this.createLogEntry('info', 'application', `Template application started`, {
      template_id: templateId,
      trigger_id: triggerId,
      workspace_id: workspaceId,
      execution_context: 'template_application_start'
    });
    this.writeLog(entry);
  }

  templateApplicationCompleted(templateId: string, workspaceId: string, executionTimeMs: number): void {
    const entry = this.createLogEntry('info', 'application', `Template application completed in ${executionTimeMs}ms`, {
      template_id: templateId,
      workspace_id: workspaceId,
      details: { execution_time_ms: executionTimeMs },
      execution_context: 'template_application_success'
    });
    this.writeLog(entry);
  }

  templateApplicationFailed(templateId: string, error: any, details?: any): void {
    const entry = this.createLogEntry('error', 'application', `Template application failed: ${error.message || error}`, {
      template_id: templateId,
      details: { error, ...details },
      execution_context: 'template_application_error'
    });
    this.writeLog(entry);
  }

  // Trigger-specific logging methods
  triggerCreated(triggerId: string, templateId: string, name: string): void {
    const entry = this.createLogEntry('info', 'trigger', `Trigger created: ${name}`, {
      trigger_id: triggerId,
      template_id: templateId,
      execution_context: 'trigger_creation'
    });
    this.writeLog(entry);
  }

  triggerActivated(triggerId: string, templateId: string, condition: string): void {
    const entry = this.createLogEntry('info', 'trigger', `Trigger activated: ${condition}`, {
      trigger_id: triggerId,
      template_id: templateId,
      details: { condition },
      execution_context: 'trigger_activation'
    });
    this.writeLog(entry);
  }

  triggerFailed(triggerId: string, error: any, context?: any): void {
    const entry = this.createLogEntry('error', 'trigger', `Trigger execution failed: ${error.message || error}`, {
      trigger_id: triggerId,
      details: { error, context },
      execution_context: 'trigger_error'
    });
    this.writeLog(entry);
  }

  // Context resolution logging
  contextResolutionStarted(templateId: string, requirements: any[]): void {
    const entry = this.createLogEntry('debug', 'application', `Starting context resolution for ${requirements.length} requirements`, {
      template_id: templateId,
      details: { requirements_count: requirements.length },
      execution_context: 'context_resolution_start'
    });
    this.writeLog(entry);
  }

  wildcardResolved(templateId: string, wildcardType: string, resolvedItemId: string): void {
    const entry = this.createLogEntry('info', 'application', `Wildcard resolved: ${wildcardType} -> ${resolvedItemId}`, {
      template_id: templateId,
      details: { wildcard_type: wildcardType, resolved_item_id: resolvedItemId },
      execution_context: 'wildcard_resolution'
    });
    this.writeLog(entry);
  }

  wildcardResolutionFailed(templateId: string, wildcardType: string, error: any): void {
    const entry = this.createLogEntry('error', 'application', `Wildcard resolution failed: ${wildcardType}`, {
      template_id: templateId,
      details: { wildcard_type: wildcardType, error },
      execution_context: 'wildcard_resolution_error'
    });
    this.writeLog(entry);
  }

  // Variable resolution logging
  variableResolved(templateId: string, variableName: string, value: any, source: string): void {
    const entry = this.createLogEntry('debug', 'application', `Variable resolved: ${variableName} = ${JSON.stringify(value)}`, {
      template_id: templateId,
      details: { variable_name: variableName, value, source },
      execution_context: 'variable_resolution'
    });
    this.writeLog(entry);
  }

  variableResolutionFailed(templateId: string, variableName: string, error: any): void {
    const entry = this.createLogEntry('warn', 'application', `Variable resolution failed: ${variableName}`, {
      template_id: templateId,
      details: { variable_name: variableName, error },
      execution_context: 'variable_resolution_error'
    });
    this.writeLog(entry);
  }

  // System logging methods
  systemInfo(message: string, details?: any): void {
    const entry = this.createLogEntry('info', 'system', message, { details });
    this.writeLog(entry);
  }

  systemWarning(message: string, details?: any): void {
    const entry = this.createLogEntry('warn', 'system', message, { details });
    this.writeLog(entry);
  }

  systemError(message: string, error: any): void {
    const entry = this.createLogEntry('error', 'system', message, { details: { error } });
    this.writeLog(entry);
  }

  // Utility method to get recent logs
  getRecentLogs(category?: string, limit: number = 100): TemplateLogEntry[] {
    // This would typically read from the log files
    // For now, return empty array - could implement file reading if needed
    return [];
  }

  // Method to clear old logs
  clearOldLogs(olderThanDays: number = 7): void {
    this.systemInfo(`Log cleanup initiated for logs older than ${olderThanDays} days`);
    // Implementation would scan log directory and remove old files
  }
}

// Export singleton instance
export const templateLogger = TemplateLogger.getInstance();