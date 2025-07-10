/**
 * Tool Approval Overlay Component
 *
 * Provides Claude Code-like tool approval interface with:
 * - Command synopsis showing what will happen
 * - Approval/denial controls
 * - Risk assessment
 * - Tool execution feedback
 */
'use client';
import { useState, useEffect } from 'react';
interface ToolUse {
  id: string;
  name: string;
  input: any;
  description?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}
interface ToolApprovalOverlayProps {
  toolUse: ToolUse | null;
  onApprove: (toolId: string, remember?: boolean) => void;
  onDeny: (toolId: string, remember?: boolean) => void;
  onClose: () => void;
  isVisible: boolean;
}
export function ToolApprovalOverlay({
  toolUse,
  onApprove,
  onDeny,
  onClose,
  isVisible
}: ToolApprovalOverlayProps) {
  const [rememberChoice, setRememberChoice] = useState(false);
  if (!isVisible || !toolUse) return null;
  const getRiskColor = (risk: string = 'medium') => {
    switch (risk) {
      case 'low': return 'var(--color-success)';
      case 'high': return 'var(--color-error)';
      default: return 'var(--color-warning)';
    }
  };
  const getRiskDescription = (toolName: string, input: any) => {
    switch (toolName) {
      case 'bash':
      case 'str_replace_editor':
        return 'This tool can modify files and execute system commands';
      case 'computer':
        return 'This tool can interact with your desktop';
      default:
        return 'This tool will perform actions on your system';
    }
  };
  const getToolSynopsis = (toolName: string, input: any) => {
    switch (toolName) {
      case 'bash':
        return `Execute command: ${input.command}`;
      case 'str_replace_editor':
        if (input.command === 'create') {
          return `Create file: ${input.path}`;
        } else if (input.command === 'str_replace') {
          return `Edit file: ${input.path} (replace text)`;
        } else if (input.command === 'view') {
          return `View file: ${input.path}`;
        }
        return `File operation: ${input.command} on ${input.path}`;
      case 'computer':
        return `Computer interaction: ${input.action}`;
      default:
        return `Tool use: ${toolName}`;
    }
  };
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-96 max-w-[90vw] rounded-lg border shadow-2xl"
        style={{
          backgroundColor: 'var(--color-surface-elevated)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getRiskColor(toolUse.riskLevel) }}
            />
            <h3 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Tool Approval Required
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-xl hover:bg-opacity-20 rounded px-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ✕
          </button>
        </div>
        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Tool Info */}
          <div>
            <div className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
              🔧 {toolUse.name}
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {getRiskDescription(toolUse.name, toolUse.input)}
            </div>
          </div>
          {/* Synopsis */}
          <div
            className="p-3 rounded border"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)'
            }}
          >
            <div className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              📋 What this will do:
            </div>
            <div className="text-sm font-mono" style={{ color: 'var(--color-text-secondary)' }}>
              {getToolSynopsis(toolUse.name, toolUse.input)}
            </div>
          </div>
          {/* Input Details */}
          {Object.keys(toolUse.input).length > 0 && (
            <details className="text-sm">
              <summary
                className="cursor-pointer font-medium mb-2"
                style={{ color: 'var(--color-text-primary)' }}
              >
                📄 Tool Parameters
              </summary>
              <pre
                className="text-xs p-3 rounded border overflow-auto max-h-32"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-secondary)'
                }}
              >
                {JSON.stringify(toolUse.input, null, 2)}
              </pre>
            </details>
          )}
          {/* Remember Choice */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={rememberChoice}
              onChange={(e) => setRememberChoice(e.target.checked)}
              className="rounded"
            />
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Remember this choice for "{toolUse.name}" tool
            </span>
          </label>
        </div>
        {/* Actions */}
        <div
          className="px-4 py-3 border-t flex gap-2 justify-end"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            onClick={() => onDeny(toolUse.id, rememberChoice)}
            className="px-4 py-2 rounded transition-colors text-sm"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
              border: '1px solid',
            }}
          >
            ❌ Deny
          </button>
          <button
            onClick={() => onApprove(toolUse.id, rememberChoice)}
            className="px-4 py-2 rounded transition-colors text-sm"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
            }}
          >
            ✅ Approve
          </button>
        </div>
      </div>
    </>
  );
}