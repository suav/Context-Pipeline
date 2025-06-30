/**
 * Workspace Validation Alert Component
 * Shows check engine light warning for invalid workspaces
 */

'use client';

import React, { useState } from 'react';

interface WorkspaceValidationAlertProps {
  workspaceId: string;
  workspaceName: string;
  issues: string[];
  onMoveToDrafts: () => void;
  onDismiss: () => void;
  className?: string;
}

export function WorkspaceValidationAlert({
  workspaceId,
  workspaceName,
  issues,
  onMoveToDrafts,
  onDismiss,
  className = ''
}: WorkspaceValidationAlertProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  const handleMoveToDrafts = async () => {
    setIsMoving(true);
    try {
      await onMoveToDrafts();
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Check Engine Light Icon */}
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center animate-pulse">
              <span className="text-white text-lg">⚠️</span>
            </div>
          </div>
          
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-yellow-800 mb-1">
              Workspace Validation Issues
            </h3>
            <p className="text-sm text-yellow-700 mb-2">
              <span className="font-medium">{workspaceName}</span> has integrity issues and needs attention.
            </p>
            
            {/* Issues Summary */}
            <div className="text-sm text-yellow-700">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-yellow-600 hover:text-yellow-800 underline"
              >
                {isExpanded ? 'Hide' : 'Show'} {issues.length} issue{issues.length !== 1 ? 's' : ''}
              </button>
              
              {isExpanded && (
                <div className="mt-2 space-y-1">
                  {issues.map((issue, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-yellow-500 mt-0.5">•</span>
                      <span className="text-sm">{issue}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="text-yellow-600 hover:text-yellow-800 text-sm"
          title="Dismiss warning"
        >
          ✕
        </button>
      </div>
      
      {/* Action Buttons */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={handleMoveToDrafts}
          disabled={isMoving}
          className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          {isMoving ? (
            <>
              <span className="inline-block animate-spin mr-2">⟳</span>
              Moving to Drafts...
            </>
          ) : (
            <>
              🔧 Move to Drafts & Rebuild
            </>
          )}
        </button>
        
        <button
          onClick={() => window.open(`/api/workspaces/validate?workspaceId=${workspaceId}`, '_blank')}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          📋 View Details
        </button>
      </div>
      
      {/* Help Text */}
      <div className="mt-3 text-xs text-yellow-600">
        💡 <strong>Tip:</strong> Moving to drafts preserves your context items and allows you to rebuild the workspace properly.
      </div>
    </div>
  );
}

/**
 * Minimal Check Engine Light Badge
 * For use in workspace lists and cards
 */
export function CheckEngineBadge({ 
  issueCount, 
  onClick, 
  className = '' 
}: { 
  issueCount: number; 
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium hover:bg-yellow-200 transition-colors ${className}`}
      title={`${issueCount} validation issue${issueCount !== 1 ? 's' : ''}`}
    >
      <span className="animate-pulse">⚠️</span>
      <span>{issueCount}</span>
    </button>
  );
}