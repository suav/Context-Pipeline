/**
 * Client-side logger for template operations
 * This is used in browser contexts where we can't access Node.js fs module
 */

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'template' | 'trigger' | 'application' | 'system';
  template_id?: string;
  trigger_id?: string;
  workspace_id?: string;
  message: string;
  details?: any;
  execution_context?: string;
}

export class ClientLogger {
  private static instance: ClientLogger;
  private logs: LogEntry[] = [];
  private maxLogs = 100; // Keep only recent logs in memory

  private constructor() {}

  static getInstance(): ClientLogger {
    if (!ClientLogger.instance) {
      ClientLogger.instance = new ClientLogger();
    }
    return ClientLogger.instance;
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
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      ...options
    };
  }

  private writeLog(entry: LogEntry): void {
    // Add to in-memory logs
    this.logs.push(entry);
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
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

    // Send to server-side logger if API is available
    this.sendToServer(entry);
  }

  private async sendToServer(entry: LogEntry): Promise<void> {
    try {
      // Don't wait for response to avoid blocking UI
      fetch('/api/templates/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry })
      }).catch(() => {
        // Ignore failures - logging shouldn't break functionality
      });
    } catch (error) {
      // Ignore - client-side logging is secondary
    }
  }

  // Template-specific logging methods
  templateSelected(templateId: string, name: string, details?: any): void {
    const entry = this.createLogEntry('info', 'template', `Template selected: ${name}`, {
      template_id: templateId,
      details,
      execution_context: 'template_selection'
    });
    this.writeLog(entry);
  }

  templateApplicationStarted(templateId: string, details?: any): void {
    const entry = this.createLogEntry('info', 'application', `Template application started`, {
      template_id: templateId,
      details,
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

  // Utility method to get recent logs for debugging
  getRecentLogs(category?: string, limit: number = 50): LogEntry[] {
    let filtered = [...this.logs];
    
    if (category) {
      filtered = filtered.filter(log => log.category === category);
    }
    
    return filtered.slice(-limit);
  }

  // Method to clear logs
  clearLogs(): void {
    this.logs = [];
  }
}

// Export singleton instance for client-side use
export const clientLogger = ClientLogger.getInstance();