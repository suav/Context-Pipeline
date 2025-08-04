/**
 * Tool Execution Tracker Component
 *
 * Shows real-time tool execution progress with Claude Code-like feedback:
 * - Tool execution status
 * - Command output/results
 * - Error handling
 * - Success/failure indicators
 */
'use client';
import { useState, useEffect } from 'react';
interface ToolExecution {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  input: any;
  output?: any;
  error?: string;
  duration?: number;
}
interface ToolExecutionTrackerProps {
  executions: ToolExecution[];
  className?: string;
}
export function ToolExecutionTracker({ executions, className = '' }: ToolExecutionTrackerProps) {
  if (executions.length === 0) return null;
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'running': return '⚡';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '❓';
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'var(--color-warning)';
      case 'running': return 'var(--color-primary)';
      case 'completed': return 'var(--color-success)';
      case 'failed': return 'var(--color-error)';
      default: return 'var(--color-text-muted)';
    }
  };
  const formatDuration = (duration: number) => {
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  };
  const formatToolInput = (name: string, input: any) => {
    switch (name) {
      case 'bash':
        return input.command;
      case 'str_replace_editor':
        if (input.command === 'create') {
          return `Create ${input.path}`;
        } else if (input.command === 'str_replace') {
          return `Edit ${input.path}`;
        } else if (input.command === 'view') {
          return `View ${input.path}`;
        }
        return `${input.command} ${input.path}`;
      default:
        return JSON.stringify(input);
    }
  };
  const formatToolOutput = (name: string, output: any) => {
    if (!output) return null;
    switch (name) {
      case 'bash':
        return output.stdout || output.stderr || 'Command completed';
      case 'str_replace_editor':
        if (typeof output === 'string') return output;
        return output.content || 'Operation completed';
      default:
        if (typeof output === 'string') return output;
        return JSON.stringify(output, null, 2);
    }
  };
  return (
    <div className={`space-y-2 ${className}`}>
      {executions.map((execution) => (
        <div
          key={execution.id}
          className="border rounded-lg p-3"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getStatusIcon(execution.status)}</span>
              <span
                className="font-medium text-sm"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {execution.name}
              </span>
              <span
                className="text-xs px-2 py-1 rounded"
                style={{
                  backgroundColor: getStatusColor(execution.status) + '20',
                  color: getStatusColor(execution.status)
                }}
              >
                {execution.status}
              </span>
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {execution.duration !== undefined && formatDuration(execution.duration)}
            </div>
          </div>
          {/* Command/Input */}
          <div className="mb-2">
            <div className="text-xs text-gray-500 mb-1">Command:</div>
            <div
              className="text-sm font-mono p-2 rounded border"
              style={{
                backgroundColor: 'var(--color-surface-elevated)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)'
              }}
            >
              {formatToolInput(execution.name, execution.input)}
            </div>
          </div>
          {/* Output */}
          {execution.output && (
            <div className="mb-2">
              <div className="text-xs text-gray-500 mb-1">Output:</div>
              <div
                className="text-sm font-mono p-2 rounded border max-h-32 overflow-auto"
                style={{
                  backgroundColor: 'var(--color-surface-elevated)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-secondary)'
                }}
              >
                {formatToolOutput(execution.name, execution.output)}
              </div>
            </div>
          )}
          {/* Error */}
          {execution.error && (
            <div className="mb-2">
              <div className="text-xs text-red-500 mb-1">Error:</div>
              <div
                className="text-sm font-mono p-2 rounded border"
                style={{
                  backgroundColor: 'var(--color-error-background)',
                  borderColor: 'var(--color-error)',
                  color: 'var(--color-error)'
                }}
              >
                {execution.error}
              </div>
            </div>
          )}
          {/* Running indicator */}
          {execution.status === 'running' && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-primary)' }}>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: 'var(--color-primary)' }} />
              <span>Executing...</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}