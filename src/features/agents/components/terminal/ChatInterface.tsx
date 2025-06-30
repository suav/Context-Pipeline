/**
 * Terminal Interface Component
 * Terminal-style interface for agent interactions
 */

'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
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
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(agentName);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log('ChatInterface mounted/updated for agent:', agentId, 'workspace:', workspaceId);
    if (agentId && workspaceId && !historyLoaded) {
      console.log('Both IDs available and history not loaded yet, loading conversation history...');
      loadConversationHistory();
    } else {
      console.log('Skipping history load:', { agentId, workspaceId, historyLoaded });
    }
  }, [agentId, workspaceId, historyLoaded]); // Reload when agent, workspace changes, or history loaded state changes

  // Reset history loaded state when agent changes
  useEffect(() => {
    setHistoryLoaded(false);
    setMessages([]);
    setCommandHistory([]);
  }, [agentId, workspaceId]);

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
        
        console.log('Raw messages from API:', data.messages);
        setMessages(data.messages || []);
        
        // Extract command history from messages
        const commands = (data.messages || [])
          .filter((msg: ConversationMessage) => msg.role === 'user')
          .map((msg: ConversationMessage) => msg.content);
        setCommandHistory(commands);
        
        console.log('Set messages count:', data.messages?.length || 0);
        console.log('Set command history count:', commands.length);
        console.log('Messages state after setting:', data.messages || []);
        
        // Mark history as loaded
        setHistoryLoaded(true);
        
        // Force scroll to bottom after loading history
        setTimeout(() => scrollToBottom(), 100);
      } else {
        const errorText = await response.text();
        console.error('Failed to load conversation - status:', response.status, 'body:', errorText);
      }
    } catch (error) {
      console.error('Failed to load conversation history (error):', error);
      // Still mark as loaded to prevent infinite retry loops
      setHistoryLoaded(true);
    }
  };

  const sendCommandWithStreaming = async (command: string) => {
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
      // Use streaming endpoint for better response handling
      const response = await fetch(`/api/workspaces/${workspaceId}/agents/${agentId}/conversation/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: command,
          model: selectedModel
        }),
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMessageId = '';
        let assistantContent = '';
        
        // Create placeholder assistant message
        const placeholderMessage: ConversationMessage = {
          id: generateMessageId(),
          timestamp: new Date().toISOString(),
          role: 'assistant',
          content: ''
        };
        
        setMessages(prev => [...prev, placeholderMessage]);
        // Use a callback to get the current length
        const getCurrentMessageIndex = () => {
          return messages.length + 1; // +1 for user message we added earlier
        };
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
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
                    // Update assistant message with new content
                    assistantContent += data.content;
                    setMessages(prev => {
                      const newMessages = [...prev];
                      const messageIndex = newMessages.length - 1; // Last message is our placeholder
                      if (newMessages[messageIndex]) {
                        newMessages[messageIndex] = {
                          ...newMessages[messageIndex],
                          content: assistantContent
                        };
                      }
                      return newMessages;
                    });
                    scrollToBottom();
                  } else if (data.type === 'complete') {
                    // Response completed
                    assistantMessageId = data.message_id;
                  } else if (data.type === 'error') {
                    throw new Error(data.error);
                  }
                } catch (parseError) {
                  console.warn('Failed to parse streaming data:', parseError);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
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
      const errorMessage: ConversationMessage = {
        id: generateMessageId(),
        timestamp: new Date().toISOString(),
        role: 'system',
        content: `✗ Error: ${(error as any).message || 'Network error'}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      console.log(`[${componentId.current}] Setting processing to false (sendCommandWithStreaming)`);
      setIsProcessing(false);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const sendCommand = async () => {
    if (!inputValue.trim() || isProcessing) {
      console.log(`[${componentId.current}] Blocking sendCommand - inputValue: "${inputValue.trim()}", isProcessing: ${isProcessing}`);
      return;
    }

    const command = inputValue.trim();
    setInputValue('');
    await sendCommandWithStreaming(command);
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
        console.log(`[${componentId.current}] Processing command for agent ${agentId}`);
        setInputValue(command);
        // Optionally auto-send the command
        if (event.detail?.autoSend) {
          console.log(`[${componentId.current}] Auto-sending command immediately`);
          // Use the streaming helper function
          sendCommandWithStreaming(command.trim());
          
          // Clear input after a short delay to show the command was processed
          setTimeout(() => {
            setInputValue('');
          }, 100);
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
  }, [agentId, workspaceId]); // Add dependencies to ensure fresh values

  return (
    <div className="flex flex-col flex-1 bg-black text-green-400 font-mono text-sm overflow-y-auto">
      {/* Scrollable Content Area */}
      <div 
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-4 bg-black"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Welcome Message */}
        {messages.length === 0 && (
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

        {/* Message History */}
        {messages.map((message, index) => (
          <div key={message.id} className="mb-2">
            {message.role === 'user' ? (
              <div className="flex items-start">
                <span className="text-green-400 mr-2">{getPromptSymbol(message.role)}</span>
                <span className="text-white flex-1">{message.content}</span>
              </div>
            ) : message.role === 'assistant' ? (
              <div className="ml-4">
                <div className="text-gray-500 text-xs mb-1">
                  [{formatTimestamp(message.timestamp)}] Processing...
                </div>
                <pre className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </pre>
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
              </div>
            ) : (
              <div className="text-red-400">
                <span className="mr-2">{getPromptSymbol(message.role)}</span>
                {message.content}
              </div>
            )}
          </div>
        ))}

        {/* Processing Indicator - Only show for this specific agent */}
        {isProcessing && agentId && (
          <div className="flex items-center text-gray-400" key={`processing-${agentId}`}>
            <span className="mr-2">&gt;</span>
            <span className="animate-pulse">Processing command... (Agent: {agentName} - {agentId.slice(-6)})</span>
          </div>
        )}
      </div>

      {/* Fixed Input Area at Bottom */}
      <div className="flex-shrink-0 bg-black border-t border-gray-700">
        {/* Model Selector */}
        <div className="px-4 py-2 bg-gray-800 border-b border-gray-600 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-xs">AI Model:</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as 'claude' | 'gemini')}
              className="bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600 focus:border-green-400 outline-none"
            >
              <option value="claude">🧠 Claude</option>
              <option value="gemini">💎 Gemini</option>
            </select>
          </div>
          <div className="text-xs text-gray-500">
            {selectedModel === 'claude' ? 'Anthropic Claude AI' : 'Google Gemini AI'}
          </div>
        </div>
        
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
            <span className={selectedModel === 'claude' ? 'text-blue-400' : 'text-purple-400'}>
              {selectedModel === 'claude' ? '🧠' : '💎'}
            </span> |
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