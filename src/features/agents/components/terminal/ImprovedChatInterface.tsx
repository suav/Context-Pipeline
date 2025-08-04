import React, { useState, useEffect, useRef } from 'react';

interface ToolUse {
  id: string;
  name: string;
  input: any;
  timestamp: string;
  operation_summary?: string;
}

interface ToolResult {
  tool_use_id: string;
  is_error: boolean;
  content: any;
  timestamp: string;
  content_preview?: string;
}

interface ConversationMessage {
  id: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    model?: string;
    session_id?: string;
    usage?: any;
    tool_uses?: ToolUse[];
    tool_results?: ToolResult[];
    result?: any;
    [key: string]: any;
  };
}

interface ImprovedMessageDisplayProps {
  message: ConversationMessage;
  isLatest: boolean;
}

const ImprovedMessageDisplay: React.FC<ImprovedMessageDisplayProps> = ({ message, isLatest }) => {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [showFullContent, setShowFullContent] = useState(false);

  const toggleToolExpansion = (toolId: string) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(toolId)) {
      newExpanded.delete(toolId);
    } else {
      newExpanded.add(toolId);
    }
    setExpandedTools(newExpanded);
  };

  const formatToolSummary = (toolUse: ToolUse, toolResult?: ToolResult) => {
    const status = toolResult?.is_error ? '❌' : '✅';
    const name = toolUse.name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    // Create compact parameter summary
    const params = toolUse.input ? Object.keys(toolUse.input).slice(0, 2).join(', ') : '';
    const paramSummary = params ? `(${params})` : '';
    
    // Result preview
    const preview = toolResult?.content_preview || 
                   (typeof toolResult?.content === 'string' ? toolResult.content.substring(0, 50) : '') ||
                   'No result';
    
    return { status, name, paramSummary, preview };
  };

  const getContentPreview = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (message.role === 'user') {
    return (
      <div className="mb-3 flex items-start">
        <span className="text-green-400 mr-2 mt-1">●</span>
        <div className="flex-1">
          <div className="text-white font-medium">{message.content}</div>
        </div>
      </div>
    );
  }

  if (message.role === 'assistant') {
    const hasTools = message.metadata?.tool_uses && message.metadata.tool_uses.length > 0;
    const contentPreview = getContentPreview(message.content);
    const isLongContent = message.content.length > 150;

    return (
      <div className="mb-4 ml-4">
        {/* Main response with compact tool summary */}
        <div className="flex items-start">
          <span className="text-blue-400 mr-2 mt-1">●</span>
          <div className="flex-1">
            <div className="text-gray-300">
              {showFullContent || !isLongContent ? message.content : contentPreview}
              {isLongContent && (
                <button 
                  onClick={() => setShowFullContent(!showFullContent)}
                  className="text-blue-400 hover:text-blue-300 ml-2 text-sm"
                >
                  {showFullContent ? '(ctrl+r to collapse)' : '(ctrl+r to expand)'}
                </button>
              )}
            </div>
            
            {/* Tool uses summary - compact format */}
            {hasTools && (
              <div className="mt-2 space-y-1">
                {message.metadata!.tool_uses!.map((toolUse) => {
                  const toolResult = message.metadata?.tool_results?.find(r => r.tool_use_id === toolUse.id);
                  const { status, name, paramSummary, preview } = formatToolSummary(toolUse, toolResult);
                  const isExpanded = expandedTools.has(toolUse.id);
                  
                  return (
                    <div key={toolUse.id} className="bg-gray-800 rounded border-l-2 border-blue-500">
                      {/* Tool summary line */}
                      <div 
                        className="flex items-center p-2 cursor-pointer hover:bg-gray-700 transition-colors"
                        onClick={() => toggleToolExpansion(toolUse.id)}
                      >
                        <span className="text-blue-400 mr-2">⎿</span>
                        <span className="text-green-400 mr-1">{status}</span>
                        <span className="text-blue-300 font-medium">{name}</span>
                        <span className="text-gray-400">{paramSummary}</span>
                        <div className="flex-1 mx-2 border-t border-gray-600"></div>
                        <span className="text-gray-400 text-xs">
                          {isExpanded ? 'collapse' : 'expand'}
                        </span>
                      </div>
                      
                      {/* Expanded tool details */}
                      {isExpanded && (
                        <div className="px-4 pb-2 space-y-2">
                          {/* Tool input */}
                          {toolUse.input && (
                            <div className="text-xs">
                              <span className="text-yellow-400">Input:</span>
                              <pre className="text-gray-300 ml-2 whitespace-pre-wrap">
                                {JSON.stringify(toolUse.input, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {/* Tool result */}
                          {toolResult && (
                            <div className="text-xs">
                              <span className="text-green-400">Result:</span>
                              <div className="text-gray-300 ml-2 mt-1">
                                {typeof toolResult.content === 'string' ? (
                                  <pre className="whitespace-pre-wrap bg-gray-900 p-2 rounded text-xs">
                                    {toolResult.content}
                                  </pre>
                                ) : (
                                  <pre className="whitespace-pre-wrap bg-gray-900 p-2 rounded text-xs">
                                    {JSON.stringify(toolResult.content, null, 2)}
                                  </pre>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Compact metadata line */}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              {message.metadata?.model && (
                <span className="text-purple-400">
                  🧠 {message.metadata.model.replace('claude-', '').replace('-20250514', '')}
                </span>
              )}
              {message.metadata?.usage && (
                <span className="text-cyan-400">
                  📊 {message.metadata.usage.input_tokens || 0}→{message.metadata.usage.output_tokens || 0}
                </span>
              )}
              {message.metadata?.result && (
                <>
                  <span>⏱️ {(message.metadata.result.duration_ms / 1000).toFixed(1)}s</span>
                  {message.metadata.result.total_cost_usd && (
                    <span>💰 ${message.metadata.result.total_cost_usd.toFixed(4)}</span>
                  )}
                </>
              )}
              {message.metadata?.session_id && (
                <span>Session: {message.metadata.session_id.slice(-8)}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2 text-red-400">
      <span className="mr-2">●</span>
      {message.content}
    </div>
  );
};

export default ImprovedMessageDisplay;