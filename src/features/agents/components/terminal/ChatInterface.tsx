/**
 * Terminal Interface Component
 * Terminal-style interface for agent interactions
 */

'use client';

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { CommandInjector } from '../CommandInjector';

interface ConversationMessage {
  id: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    command_id?: string;
    file_changes?: string[];
    approval_required?: boolean;
    human_intervention?: boolean;
  };
}

interface ChatInterfaceProps {
  agentId: string;
  workspaceId: string;
  agentName: string;
  agentTitle?: string;
  agentColor: string;
  onAgentNameUpdate?: (newName: string) => void;
}

export function ChatInterface({ agentId, workspaceId, agentName, agentTitle, agentColor, onAgentNameUpdate }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const componentId = useRef(`chat-${agentId}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showCommandInjector, setShowCommandInjector] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'claude' | 'gemini'>('claude');
  const [agentLoaded, setAgentLoaded] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(agentName);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Add abort controller for proper cleanup and concurrent request handling
  const abortControllerRef = useRef<AbortController | null>(null);
  const isComponentActiveRef = useRef(true);
  const isLoadingHistoryRef = useRef(false);

  useEffect(() => {
    console.log('ChatInterface mounted/updated for agent:', agentId, 'workspace:', workspaceId);
    if (agentId && workspaceId) {
      console.log('Both IDs available, loading conversation history...');
      loadConversationHistory();
    } else {
      console.log('Skipping history load:', { agentId, workspaceId });
    }
  }, [agentId, workspaceId]); // Reload when agent or workspace changes

  // Reset state when agent changes
  useEffect(() => {
    console.log('Resetting state for new agent:', agentId);
    
    // Cancel any ongoing requests for the previous agent
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setHistoryLoaded(false);
    setAgentLoaded(false);
    setMessages([]);
    setCommandHistory([]);
    setIsProcessing(false); // Reset processing state on agent change
    isComponentActiveRef.current = true;
    isLoadingHistoryRef.current = false;
  }, [agentId, workspaceId]);
  
  // Handle visibility changes - reload conversation when returning to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isComponentActiveRef.current) {
        // User returned to this tab and component is active, reload conversation
        console.log('Tab became visible, reloading conversation to get latest updates');
        loadConversationHistory();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [agentId, workspaceId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isComponentActiveRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Load agent state to get preferred model
  useEffect(() => {
    const loadAgentState = async () => {
      if (!agentId || !workspaceId || agentLoaded) return;
      
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/agents/${agentId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.agent.preferred_model) {
            setSelectedModel(data.agent.preferred_model);
          }
        }
      } catch (error) {
        console.warn('Could not load agent preferences, using default:', error);
      } finally {
        setAgentLoaded(true);
      }
    };
    
    loadAgentState();
  }, [agentId, workspaceId, agentLoaded]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  useEffect(() => {
    // Focus input when component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const scrollToBottom = () => {
    if (terminalRef.current) {
      // Force immediate scroll to bottom
      const scrollToEnd = () => {
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      };
      
      // Immediate scroll
      scrollToEnd();
      
      // Multiple delayed attempts to ensure it works
      setTimeout(scrollToEnd, 10);
      setTimeout(scrollToEnd, 50);
      setTimeout(scrollToEnd, 100);
      setTimeout(scrollToEnd, 200);
    }
  };

  const loadConversationHistory = async () => {
    if (!agentId || !workspaceId) {
      console.log('Skipping conversation load - missing IDs:', { agentId, workspaceId });
      return;
    }

    // Prevent duplicate history loading requests
    if (isLoadingHistoryRef.current) {
      console.log('History loading already in progress, skipping duplicate request');
      return;
    }

    isLoadingHistoryRef.current = true;
    console.log('Loading conversation history for:', { workspaceId, agentId });
    
    try {
      const url = `/api/workspaces/${workspaceId}/agents/${agentId}/conversation`;
      console.log('Fetching conversation from:', url);
      
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });
      console.log('Conversation response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Conversation data received:', data);
        
        const messagesFromAPI = data.messages || [];
        console.log('Raw messages from API:', messagesFromAPI);
        console.log('Number of messages to display:', messagesFromAPI.length);
        
        // Ensure we have valid message objects
        const validMessages = messagesFromAPI.filter((msg: any) => 
          msg && msg.id && msg.role && msg.content !== undefined
        );
        
        // Check if the last message indicates processing was in progress
        const lastMessage = validMessages[validMessages.length - 1];
        const secondLastMessage = validMessages[validMessages.length - 2];
        
        // If last message is from user and there's no assistant response, or
        // if last assistant message is empty/incomplete, restore processing state
        const shouldRestoreProcessing = (
          lastMessage?.role === 'user' ||
          (lastMessage?.role === 'assistant' && (!lastMessage.content || lastMessage.content.trim() === ''))
        );
        
        if (shouldRestoreProcessing) {
          console.log('🔄 Detected incomplete conversation - restoring processing state');
          setIsProcessing(true);
        }
        
        console.log('Valid messages after filtering:', validMessages.length);
        
        // Update state with valid messages
        setMessages(validMessages);
        
        // Extract command history from user messages
        const commands = validMessages
          .filter((msg: ConversationMessage) => msg.role === 'user')
          .map((msg: ConversationMessage) => msg.content);
        setCommandHistory(commands);
        
        console.log('Set messages count:', validMessages.length);
        console.log('Set command history count:', commands.length);
        
        // Mark history as loaded
        setHistoryLoaded(true);
        
        // Force scroll to bottom after loading history
        setTimeout(() => {
          console.log('Scrolling to bottom after history load');
          scrollToBottom();
        }, 200);
      } else {
        const errorText = await response.text();
        console.error('Failed to load conversation - status:', response.status, 'body:', errorText);
        setHistoryLoaded(true);
      }
    } catch (error) {
      console.error('Failed to load conversation history (error):', error);
      // Still mark as loaded to prevent infinite retry loops
      setHistoryLoaded(true);
    } finally {
      isLoadingHistoryRef.current = false;
    }
  };

  const sendCommandWithStreaming = useCallback(async (command: string) => {
    // Check if component is still active (prevent tab bleeding)
    if (!isComponentActiveRef.current) {
      console.log(`[${componentId.current}] Component inactive, ignoring command`);
      return;
    }

    // Cancel any existing request for this agent
    if (abortControllerRef.current) {
      console.log(`[${componentId.current}] Aborting previous request`);
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    const currentAbortController = abortControllerRef.current;

    const userMessage: ConversationMessage = {
      id: generateMessageId(),
      timestamp: new Date().toISOString(),
      role: 'user',
      content: command
    };

    // Add to messages and command history
    setMessages(prev => [...prev, userMessage]);
    setCommandHistory(prev => [...prev, command]);
    setHistoryIndex(-1);
    console.log(`[${componentId.current}] Setting processing to true (sendCommandWithStreaming)`);
    setIsProcessing(true);
    
    // Scroll to bottom immediately after adding user message
    scrollToBottom();

    try {
      // Use streaming endpoint with abort signal for proper cleanup
      const response = await fetch(`/api/workspaces/${workspaceId}/agents/${agentId}/conversation/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: command,
          model: selectedModel
        }),
        signal: currentAbortController.signal  // Add abort signal
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = '';
        
        // Create placeholder assistant message
        const assistantMessageId = generateMessageId();
        const placeholderMessage: ConversationMessage = {
          id: assistantMessageId,
          timestamp: new Date().toISOString(),
          role: 'assistant',
          content: ''
        };
        
        setMessages(prev => [...prev, placeholderMessage]);
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log('Stream ended normally');
              break;
            }
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.type === 'start') {
                    // Response started
                    continue;
                  } else if (data.type === 'chunk') {
                    // Always accumulate content for server processing, but only update UI if component is active
                    assistantContent += data.content;
                    
                    // Only update UI if this component is still active (prevent tab bleeding)
                    if (isComponentActiveRef.current && !currentAbortController.signal.aborted) {
                      setMessages(prev => {
                        return prev.map(msg => 
                          msg.id === assistantMessageId 
                            ? { ...msg, content: assistantContent }
                            : msg
                        );
                      });
                      scrollToBottom();
                    }
                  } else if (data.type === 'complete') {
                    // Response completed successfully
                    console.log('Response completed successfully');
                    break; // Exit the loop on completion
                  } else if (data.type === 'error') {
                    throw new Error(data.error);
                  }
                } catch (parseError) {
                  // Only warn for actual parse errors, not expected stream end
                  if (line.trim() !== 'data: ') {
                    console.warn('Failed to parse streaming data:', parseError);
                  }
                }
              }
            }
          }
        } catch (streamError) {
          // Handle stream reading errors gracefully
          console.warn('Stream reading completed with minor error (expected):', streamError);
        } finally {
          try {
            reader.releaseLock();
          } catch (releaseError) {
            // Reader might already be released, ignore
            console.warn('Reader release warning (expected):', releaseError);
          }
        }
        
        // Final scroll to bottom
        scrollToBottom();
        
      } else {
        // Fallback to non-streaming response
        const data = await response.json();
        if (data.response) {
          const assistantMessage: ConversationMessage = {
            id: generateMessageId(),
            timestamp: new Date().toISOString(),
            role: 'assistant',
            content: data.response,
            metadata: data.metadata
          };
          setMessages(prev => [...prev, assistantMessage]);
          scrollToBottom();
        } else {
          throw new Error(data.error || 'Failed to get response');
        }
      }
    } catch (error) {
      // Only show error if request wasn't aborted and component is still active
      if (!currentAbortController.signal.aborted && isComponentActiveRef.current) {
        const errorMessage: ConversationMessage = {
          id: generateMessageId(),
          timestamp: new Date().toISOString(),
          role: 'system',
          content: `✗ Error: ${(error as any).message || 'Network error'}`
        };
        setMessages(prev => [...prev, errorMessage]);
      } else if (currentAbortController.signal.aborted) {
        console.log(`[${componentId.current}] Request aborted - no error shown`);
      }
    } finally {
      // Only update UI state if component is still active
      if (isComponentActiveRef.current) {
        console.log(`[${componentId.current}] Setting processing to false (sendCommandWithStreaming)`);
        setIsProcessing(false);
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
      
      // Clear abort controller reference
      if (abortControllerRef.current === currentAbortController) {
        abortControllerRef.current = null;
      }
    }
  }, [workspaceId, agentId, selectedModel, setMessages, setCommandHistory, setHistoryIndex, setIsProcessing, scrollToBottom, messages.length]);

  const sendCommand = async () => {
    if (!inputValue.trim()) {
      console.log(`[${componentId.current}] Blocking sendCommand - empty input`);
      return;
    }
    
    // Block concurrent requests to prevent message corruption
    if (isProcessing) {
      console.log(`[${componentId.current}] Blocking concurrent request - already processing`);
      return;
    }

    const command = inputValue.trim();
    setInputValue(''); // Clear input immediately
    
    // Await the command to maintain proper state management
    try {
      await sendCommandWithStreaming(command);
    } catch (error) {
      console.error(`[${componentId.current}] Command failed:`, error);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendCommand();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setShowCommandInjector(!showCommandInjector);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (showCommandInjector) {
        setShowCommandInjector(false);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputValue('');
      }
    } else if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      setMessages([]);
    }
  };

  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleNameSave = async () => {
    if (editedName.trim() && editedName.trim() !== agentName) {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/agents/${agentId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: editedName.trim()
          }),
        });

        if (response.ok) {
          onAgentNameUpdate?.(editedName.trim());
          setIsEditingName(false);
        } else {
          console.error('Failed to update agent name');
          setEditedName(agentName); // Reset to original
        }
      } catch (error) {
        console.error('Error updating agent name:', error);
        setEditedName(agentName); // Reset to original
      }
    } else {
      setIsEditingName(false);
      setEditedName(agentName); // Reset to original
    }
  };

  const handleNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNameSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditingName(false);
      setEditedName(agentName);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getPromptSymbol = (role: string) => {
    switch (role) {
      case 'user':
        return '$';
      case 'assistant':
        return '>';
      case 'system':
        return '!';
      default:
        return '#';
    }
  };

  const renderFormattedContent = (content: string) => {
    // Enhanced text formatting with VS Code-like styling
    const lines = content.split('\n');
    return lines.map((line, index) => {
      // Code blocks
      if (line.startsWith('```')) {
        return (
          <div key={index} className="text-blue-400 bg-gray-900 px-2 py-1 rounded text-xs">
            {line}
          </div>
        );
      }
      
      // Command outputs
      if (line.startsWith('$ ') || line.startsWith('> ')) {
        return (
          <div key={index} className="text-green-400 font-bold">
            {line}
          </div>
        );
      }
      
      // File paths
      if (line.includes('/') && (line.includes('.js') || line.includes('.ts') || line.includes('.json') || line.includes('.md'))) {
        return (
          <div key={index} className="text-cyan-400">
            {line}
          </div>
        );
      }
      
      // Error messages
      if (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed') || line.includes('✗')) {
        return (
          <div key={index} className="text-red-400">
            {line}
          </div>
        );
      }
      
      // Success messages
      if (line.toLowerCase().includes('success') || line.toLowerCase().includes('completed') || line.includes('✓')) {
        return (
          <div key={index} className="text-green-400">
            {line}
          </div>
        );
      }
      
      // Warning messages
      if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('warn') || line.includes('⚠')) {
        return (
          <div key={index} className="text-yellow-400">
            {line}
          </div>
        );
      }
      
      // Default
      return (
        <div key={index}>
          {line}
        </div>
      );
    });
  };

  // Handle external command injection
  useEffect(() => {
    const eventName = `injectCommand_${agentId}`;
    const globalEventName = 'injectCommand';
    
    const handleCommandInjection = (event: CustomEvent) => {
      console.log(`[${componentId.current}] Command injection received:`, event.detail);
      
      // Check if this command is for this specific agent
      const targetAgentId = event.detail?.targetAgentId;
      if (targetAgentId && targetAgentId !== agentId) {
        console.log(`[${componentId.current}] Ignoring command - target agent: ${targetAgentId}, this agent: ${agentId}`);
        return;
      }
      
      // For global events without targetAgentId, ignore to prevent cross-contamination
      if (event.type === 'injectCommand' && !targetAgentId) {
        console.log(`[${componentId.current}] Ignoring global command without targetAgentId to prevent cross-contamination`);
        return;
      }
      
      const command = event.detail?.command;
      if (command && typeof command === 'string') {
        console.log(`[${componentId.current}] Processing command for agent ${agentId}: "${command}"`);
        setInputValue(command);
        
        // Auto-send the command if requested
        if (event.detail?.autoSend) {
          console.log(`[${componentId.current}] Auto-sending command immediately: "${command}"`);
          
          // Wait for history to load before auto-sending
          const tryAutoSend = () => {
            if (historyLoaded) {
              console.log(`[${componentId.current}] History loaded, sending command now: "${command}"`);
              sendCommandWithStreaming(command.trim());
              
              // Clear input after a short delay
              setTimeout(() => {
                setInputValue('');
              }, 100);
            } else {
              console.log(`[${componentId.current}] History not loaded yet, retrying in 100ms`);
              setTimeout(tryAutoSend, 100);
            }
          };
          
          tryAutoSend();
        }
      }
    };

    // Listen for both agent-specific and global commands
    window.addEventListener(eventName as any, handleCommandInjection);
    window.addEventListener(globalEventName as any, handleCommandInjection);
    
    return () => {
      window.removeEventListener(eventName as any, handleCommandInjection);
      window.removeEventListener(globalEventName as any, handleCommandInjection);
    };
  }, [agentId, workspaceId, historyLoaded, sendCommandWithStreaming]); // Add dependencies to ensure fresh values

  return (
    <div className="flex flex-col flex-1 bg-black text-green-400 font-mono text-sm overflow-y-auto">
      {/* Scrollable Content Area */}
      <div 
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-4 bg-black"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Welcome Message */}
        {messages.length === 0 && historyLoaded && (
          <div className="mb-4">
            <div className="text-green-500 mb-2">
              {`┌─────────────────────────────────────────────────┐`}
            </div>
            <div className="text-green-500 mb-2 flex items-center">
              <span>{`│ `}</span>
              {isEditingName ? (
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  onBlur={handleNameSave}
                  className="bg-transparent border-none outline-none text-green-500 font-mono flex-1"
                  maxLength={40}
                  autoFocus
                />
              ) : (
                <span 
                  onClick={() => setIsEditingName(true)}
                  className="cursor-pointer hover:bg-gray-800 px-1 rounded"
                  title="Click to edit agent name"
                >
                  {agentName}
                  {agentTitle && (
                    <span className="text-blue-400 ml-2">({agentTitle})</span>
                  )}
                </span>
              )}
              <span>{` │`.padStart(48 - agentName.length - (agentTitle ? agentTitle.length + 3 : 0))}</span>
            </div>
            <div className="text-green-500 mb-2">
              {`│ Workspace Agent Terminal v1.0                   │`}
            </div>
            <div className="text-green-500 mb-4">
              {`└─────────────────────────────────────────────────┘`}
            </div>
            <div className="text-gray-400 mb-2">
              Type 'help' for available commands
            </div>
            <div className="text-gray-400 mb-2">
              Use ↑/↓ for command history, Tab for command picker, Ctrl+L to clear
            </div>
            <div className="text-gray-400 mb-2">
              This agent is powered by Claude AI and can help with:
            </div>
            <div className="text-gray-400 mb-2 ml-4">
              • Analyzing and understanding your codebase
            </div>
            <div className="text-gray-400 mb-2 ml-4">
              • Writing and modifying code within the workspace
            </div>
            <div className="text-gray-400 mb-2 ml-4">
              • Debugging and solving technical problems
            </div>
            <div className="text-gray-400 mb-2 ml-4">
              • Running commands and exploring the project
            </div>
            <div className="mb-2 mt-4">
              <span className="text-gray-500">[{formatTimestamp(new Date().toISOString())}]</span>
              <span className="text-yellow-400 ml-2">Agent {agentId.slice(-6)} initialized and ready</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {!historyLoaded && (
          <div className="flex items-center text-gray-400 mb-4">
            <span className="animate-pulse">Loading conversation history...</span>
          </div>
        )}

        {/* Message History */}
        {messages.length > 0 && messages.map((message, index) => (
          <div key={message.id} className="mb-2">
            {message.role === 'user' ? (
              <div className="flex items-start">
                <span className="text-green-400 mr-2">{getPromptSymbol(message.role)}</span>
                <span className="text-white flex-1">{message.content}</span>
              </div>
            ) : message.role === 'assistant' ? (
              <div className="ml-4">
                <div className="text-gray-500 text-xs mb-1">
                  [{formatTimestamp(message.timestamp)}] {isProcessing ? 'Processing...' : 'Completed'}
                </div>
                <div className="text-gray-300 whitespace-pre-wrap leading-relaxed font-mono">
                  {renderFormattedContent(message.content)}
                </div>
                {message.metadata?.command_id && (
                  <div className="text-blue-400 text-xs mt-1">
                    → Command ID: {message.metadata.command_id}
                  </div>
                )}
                {message.metadata?.file_changes && message.metadata.file_changes.length > 0 && (
                  <div className="text-yellow-400 text-xs mt-1">
                    → Files modified: {message.metadata.file_changes.join(', ')}
                  </div>
                )}
                {message.metadata?.approval_required && (
                  <div className="mt-2 p-2 bg-yellow-900 border border-yellow-600 rounded">
                    <div className="text-yellow-300 text-sm mb-2">⚠️ This action requires approval:</div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded">
                        ✓ Approve
                      </button>
                      <button className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded">
                        ✗ Deny
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-400">
                <span className="mr-2">{getPromptSymbol(message.role)}</span>
                {message.content}
              </div>
            )}
          </div>
        ))}

        {/* Enhanced Processing Indicator - VS Code-like */}
        {isProcessing && agentId && (
          <div className="flex items-center text-gray-400 bg-gray-900 p-2 rounded border-l-4 border-blue-500" key={`processing-${agentId}`}>
            <span className="mr-2 text-blue-400">&gt;</span>
            <div className="flex-1">
              <div className="flex items-center">
                <span className="animate-pulse text-blue-400 mr-2">●</span>
                <span className="text-sm">Waiting for AI response...</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Agent: {agentName} ({agentId.slice(-6)}) • Timeout: 3 minutes
              </div>
              <div className="text-xs text-gray-500">
                💡 Long responses are normal for complex requests
              </div>
              <div className="text-xs text-gray-500">
                ⚡ If stuck, try a simpler request or refresh the page
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Input Area at Bottom */}
      <div className="flex-shrink-0 bg-black border-t border-gray-700">
        
        {/* Command Picker Dropdown */}
        {showCommandInjector && (
          <div className="border-b border-gray-700 bg-gray-900 p-2">
            <CommandInjector
              mode="reply"
              workspaceContext={{
                has_jira: true,
                has_git: true,
                has_files: true,
                has_email: false
              }}
              onCommandSelect={(command) => {
                setInputValue(command);
                setShowCommandInjector(false);
                // Send the command immediately with streaming
                setTimeout(async () => {
                  if (command.trim()) {
                    await sendCommandWithStreaming(command.trim());
                  }
                }, 50); // Small delay to ensure state updates
                inputRef.current?.focus();
              }}
              className="mb-0"
            />
          </div>
        )}
        
        {/* Input Line */}
        <div className="px-4 py-2 flex items-center gap-2">
          <span className="text-green-400">$</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-white caret-green-400"
            placeholder={isProcessing ? "Processing..." : "Type command or press Tab for command picker..."}
            disabled={isProcessing}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            onClick={() => setShowCommandInjector(!showCommandInjector)}
            className="text-gray-500 hover:text-green-400 px-2 py-1 text-xs border border-gray-700 rounded hover:bg-gray-800 transition-colors"
            title="Command Library (Tab)"
          >
            📚
          </button>
          {isProcessing && (
            <span className="text-yellow-400 text-xs animate-pulse">●</span>
          )}
        </div>
        
        {/* Status Line */}
        <div className="px-4 py-1 bg-gray-900 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
          <div>
            <span style={{ color: agentColor }}>{agentName}</span>
            {agentTitle && <span className="text-blue-400"> ({agentTitle})</span>} |
            {messages.length} msgs |
            {commandHistory.length} history
          </div>
          <div className="flex items-center gap-2">
            <span>{isProcessing ? 'BUSY' : 'READY'}</span>
            <span>•</span>
            <span>Tab: Commands</span>
            <span>•</span>
            <span>↑↓: History</span>
          </div>
        </div>
      </div>
    </div>
  );
}