/**
 * Terminal Interface Component
 * Terminal-style interface for agent interactions
 */
'use client';
import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { CommandInjector } from '../CommandInjector';
import { SlashCommandAutocomplete } from './SlashCommandAutocomplete';
import { UserCommand } from '../../services/CommandManager';
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
    session_id?: string;
    checkpoint_saved?: boolean;
    checkpoint_name?: string;
    checkpoint_restored?: boolean;
    usage?: any;
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
  // This component now maintains its own state for its specific agent
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
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(agentName);
  const [currentToolOperation, setCurrentToolOperation] = useState<string | null>(null);
  const [pendingToolApproval, setPendingToolApproval] = useState<{
    toolName: string;
    operation: string;
    messageId: string;
    requiresApproval: boolean;
  } | null>(null);
  
  // Tool expansion state for improved display
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [showFullContent, setShowFullContent] = useState<{[key: string]: boolean}>({});
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Add abort controller for proper cleanup and concurrent request handling
  const abortControllerRef = useRef<AbortController | null>(null);
  const isComponentActiveRef = useRef(true);
  const isLoadingHistoryRef = useRef(false);
  const agentMessagesCache = useRef<{[key: string]: ConversationMessage[]}>({});
  const agentHistoryLoaded = useRef<{[key: string]: boolean}>({});
  
  // Tool display helper functions
  const toggleToolExpansion = (toolId: string) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(toolId)) {
      newExpanded.delete(toolId);
    } else {
      newExpanded.add(toolId);
    }
    setExpandedTools(newExpanded);
  };
  
  const formatToolSummary = (toolUse: any, toolResult?: any) => {
    const status = toolResult?.is_error ? '❌' : '✅';
    const name = toolUse.name.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    
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
  
  const toggleFullContent = (messageId: string) => {
    setShowFullContent(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };
  
  // Track user scroll behavior
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Checkpoint saving state
  const [showCheckpointModal, setShowCheckpointModal] = useState(false);
  const [checkpointName, setCheckpointName] = useState('');
  const [checkpointDescription, setCheckpointDescription] = useState('');
  const [isSavingCheckpoint, setIsSavingCheckpoint] = useState(false);
  
  // Slash command autocomplete state
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [slashSearchTerm, setSlashSearchTerm] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  // Load conversation history once when component mounts
  useEffect(() => {
    if (agentId && workspaceId) {
      console.log('Loading conversation history for agent:', agentId);
      loadConversationHistory().then(() => {
        setSessionInitialized(true);
        console.log('Conversation history loaded for agent:', agentId);
        // Check if we need to restore a previous session
        restoreSessionIfNeeded();
      });
    }
  }, [agentId, workspaceId]); // Load history when this component mounts
  // Each component instance maintains its own messages state
  // Handle component initialization for this specific agent - only run once
  useEffect(() => {
    console.log('ChatInterface initialized for agent:', agentId);
    isComponentActiveRef.current = true;
    isLoadingHistoryRef.current = false;
  }, []); // Only run once on component mount
  // Handle visibility changes - maintain component state but don't reload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isComponentActiveRef.current) {
        // User returned to this tab - just re-activate component, don't reload
        console.log('Tab became visible, component reactivated (preserving state)');
        // Focus input and scroll to bottom, but preserve all messages
        if (inputRef.current) {
          inputRef.current.focus();
        }
        scrollToBottom();
      }
    };
    
    // Also handle when the terminal area becomes visible again
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > 0) {
          console.log(`[${componentId.current}] Terminal area became visible - reactivating`);
          if (inputRef.current) {
            inputRef.current.focus();
          }
          scrollToBottom();
          
          // Check if we were processing when the user left - if so, suggest continuing
          const lastMessage = messages[messages.length - 1];
          if (isProcessing && lastMessage?.role === 'user') {
            console.log(`[${componentId.current}] Detected potentially stuck streaming - user may need to continue`);
            // Set a helpful input suggestion
            setTimeout(() => {
              if (!isProcessing && inputValue.trim() === '') {
                setInputValue('/continue');
              }
            }, 2000);
          }
        }
      });
    }, { threshold: 0.1 });
    
    // Observe the terminal ref element
    if (terminalRef.current) {
      observer.observe(terminalRef.current);
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      observer.disconnect();
    };
  }, []);
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
  // Add timeout for tool approvals to prevent getting stuck
  useEffect(() => {
    if (pendingToolApproval) {
      // Auto-deny after 5 minutes if no response
      const timeout = setTimeout(() => {
        console.warn('Tool approval timeout - auto-denying for safety');
        handleToolApproval(false);
      }, 5 * 60 * 1000);
      
      return () => clearTimeout(timeout);
    }
  }, [pendingToolApproval]);
  
  // Add scroll event listener to detect user scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (!terminalRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50; // 50px threshold
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Set scrolling state
      setIsUserScrolling(true);
      setShouldAutoScroll(isNearBottom);
      
      // Reset scrolling state after user stops scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false);
        // If user scrolled back to bottom, resume auto-scroll
        if (isNearBottom) {
          setShouldAutoScroll(true);
        }
      }, 1000);
    };

    const terminal = terminalRef.current;
    if (terminal) {
      terminal.addEventListener('scroll', handleScroll);
      return () => {
        terminal.removeEventListener('scroll', handleScroll);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }
  }, []);

  useEffect(() => {
    // Only auto-scroll if user is not actively scrolling and should auto-scroll
    if (shouldAutoScroll && !isUserScrolling) {
      scrollToBottom();
    }
  }, [messages, isProcessing, shouldAutoScroll, isUserScrolling]);
  useEffect(() => {
    // Focus input when component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  const scrollToBottom = () => {
    if (terminalRef.current) {
      // Smooth scroll to bottom
      terminalRef.current.scrollTo({
        top: terminalRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Force scroll to bottom (for new messages from user)
  const forceScrollToBottom = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      setShouldAutoScroll(true);
      setIsUserScrolling(false);
    }
  };
  // Handle tool approval
  const handleToolApproval = async (approved: boolean) => {
    if (!pendingToolApproval) return;
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/agents/${agentId}/tool-approval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: pendingToolApproval.messageId,
          toolName: pendingToolApproval.toolName,
          approved: approved
        })
      });
      if (response.ok) {
        console.log(`Tool ${pendingToolApproval.toolName} ${approved ? 'approved' : 'denied'}`);
        const toolName = pendingToolApproval.toolName;
        setPendingToolApproval(null);
        
        // No approval message in chat as requested by user - just process the approval
        console.log(`🔧 Tool approval processed: ${toolName} ${approved ? 'APPROVED' : 'DENIED'}`);
        
        // If approved, the agent can continue with tool execution automatically
        // No need to send additional commands - Claude will proceed when approval is processed
      }
    } catch (error) {
      console.error('Tool approval failed:', error);
    }
  };
  
  // Handle checkpoint saving
  const handleSaveCheckpoint = async () => {
    if (!checkpointName.trim()) return;
    
    setIsSavingCheckpoint(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/agents/${agentId}/checkpoints`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: checkpointName.trim(),
          description: checkpointDescription.trim(),
          messages: messages,
          agentName: agentName,
          agentTitle: agentTitle,
          selectedModel: selectedModel,
          metadata: {
            created_at: new Date().toISOString(),
            message_count: messages.length,
            last_session_id: messages.slice().reverse().find(msg => msg.metadata?.session_id)?.metadata?.session_id
          }
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Checkpoint saved successfully:', result);
        
        // Add success message to chat
        const successMessage: ConversationMessage = {
          id: `checkpoint_save_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          role: 'system',
          content: `💾 Checkpoint "${checkpointName}" saved successfully`,
          metadata: { checkpoint_saved: true, checkpoint_name: checkpointName }
        };
        setMessages(prev => [...prev, successMessage]);
        forceScrollToBottom();
        
        // Close modal and reset form
        setShowCheckpointModal(false);
        setCheckpointName('');
        setCheckpointDescription('');
      } else {
        console.error('Failed to save checkpoint');
        alert('Failed to save checkpoint. Please try again.');
      }
    } catch (error) {
      console.error('Error saving checkpoint:', error);
      alert('Error saving checkpoint. Please try again.');
    } finally {
      setIsSavingCheckpoint(false);
    }
  };
  
  // Handle slash command selection
  const handleSelectSlashCommand = (commandText: string) => {
    // Find the slash command in the input and replace it with the command text
    const beforeCursor = inputValue.substring(0, cursorPosition);
    const afterCursor = inputValue.substring(cursorPosition);
    const slashMatch = beforeCursor.match(/\/([^\/\s]*)$/);
    
    if (slashMatch) {
      const slashStart = beforeCursor.lastIndexOf('/' + slashMatch[1]);
      const newInput = beforeCursor.substring(0, slashStart) + commandText + afterCursor;
      setInputValue(newInput);
    } else {
      // If no slash found, just set the command
      setInputValue(commandText);
    }
    
    setShowSlashCommands(false);
    setSlashSearchTerm('');
    
    // Focus the input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };
  
  // Get Claude-optimized command format
  const getClaudeFormattedCommand = (command: UserCommand) => {
    const claudeOptimizedPrompts: Record<string, string> = {
      investigate: `# Investigation Task

## Objective
Analyze this workspace comprehensively to understand the codebase, identify current issues, and recommend next steps.

## Step-by-Step Process

### 1. Initial Assessment
- Use the \`Read\` tool to examine the project structure
- Check for package.json, README.md, and other configuration files
- Identify the primary technology stack and frameworks

### 2. Context Analysis
- Review all context files in the workspace
- Analyze JIRA tickets (if available) for current objectives
- Examine recent git commits for development patterns

### 3. Code Investigation
- Use \`Grep\` to search for key patterns and potential issues
- Identify main application entry points
- Look for TODO comments, FIXME markers, or deprecation warnings

### 4. Documentation Review
- Check for existing documentation
- Identify gaps in documentation
- Review API documentation if available

### 5. Final Report
Provide a structured report including:
- **Architecture Overview**: High-level system design
- **Current State**: What's working and what needs attention
- **Key Issues**: Priority issues that need addressing
- **Recommendations**: Specific next steps with prioritization

## Expected Deliverables
- Comprehensive workspace analysis
- Prioritized list of issues and opportunities
- Specific recommendations for next actions`,

      analyze: `# Code Analysis Task

## Objective
Perform a comprehensive code analysis including architecture review, code quality assessment, and improvement recommendations.

## Step-by-Step Process

### 1. Architecture Analysis
- Use \`Glob\` to map the project structure
- Identify architectural patterns and design principles
- Analyze component relationships and dependencies

### 2. Code Quality Review
- Use \`Grep\` to identify potential code quality issues
- Check for consistent coding standards
- Look for potential security vulnerabilities

### 3. Performance Analysis
- Identify performance bottlenecks
- Check for inefficient algorithms or data structures
- Review database queries and API calls

### 4. Testing Analysis
- Examine test coverage and quality
- Identify missing test cases
- Review test architecture and patterns

### 5. Documentation Assessment
- Check code documentation quality
- Identify undocumented functions or modules
- Review API documentation completeness

## Expected Deliverables
- **Architecture Report**: System design analysis
- **Code Quality Score**: With specific improvement areas
- **Performance Assessment**: Bottlenecks and optimization opportunities
- **Testing Report**: Coverage gaps and recommendations
- **Action Plan**: Prioritized improvements with implementation steps`,

      implement: `# Implementation Task

## Objective
Implement the requested feature or fix based on previous discussions and requirements.

## Step-by-Step Process

### 1. Implementation Planning
- Review the agreed-upon approach and requirements
- Confirm technical design and architecture decisions
- Set up development environment if needed

### 2. Code Implementation
- Follow established coding standards and patterns
- Implement core functionality first
- Add error handling and edge cases

### 3. Testing Integration
- Write unit tests for new functionality
- Run existing tests to ensure no regressions
- Add integration tests if needed

### 4. Code Review Preparation
- Self-review code for quality and completeness
- Ensure code is well-documented
- Clean up any temporary or debugging code

### 5. Deployment Preparation
- Test in development environment
- Prepare deployment notes and procedures
- Update documentation as needed

## Expected Deliverables
- **Working Implementation**: Complete, tested code
- **Test Coverage**: Adequate test coverage for new features
- **Documentation**: Updated documentation and comments
- **Deployment Notes**: Instructions for deployment and rollback

## Important Notes
- Always test thoroughly before marking as complete
- Follow the established code review process
- Ensure backward compatibility unless specifically noted`
    };

    // Use Claude-optimized prompt if available, otherwise use base prompt
    return claudeOptimizedPrompts[command.keyword] || command.base_prompt;
  };
  
  // Restore previous Claude session if available
  const restoreSessionIfNeeded = async () => {
    try {
      // Find the most recent session ID from conversation history
      const lastSessionMessage = messages
        .slice()
        .reverse()
        .find(msg => msg.metadata?.session_id);
      if (lastSessionMessage?.metadata?.session_id) {
        console.log(`🔄 Found previous session ID: ${lastSessionMessage.metadata.session_id}`);
        // Attempt to restore session by sending a "session status" command
        // This will reconnect to the existing Claude session if it's still active
        const sessionCheckResponse = await fetch(`/api/workspaces/${workspaceId}/agents/${agentId}/session-restore`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: lastSessionMessage.metadata.session_id,
            model: selectedModel
          })
        });
        if (sessionCheckResponse.ok) {
          const sessionData = await sessionCheckResponse.json();
          if (sessionData.restored) {
            console.log(`✅ Session ${lastSessionMessage.metadata.session_id} restored successfully`);
            // Add session restore notification
            const restoreMessage: ConversationMessage = {
              id: `session_restore_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date().toISOString(),
              role: 'system',
              content: `🔄 Session restored: ${lastSessionMessage.metadata.session_id.slice(-8)}`,
              metadata: { session_restored: true, session_id: lastSessionMessage.metadata.session_id }
            };
            setMessages(prev => [...prev, restoreMessage]);
            scrollToBottom();
          }
        }
      } else {
        console.log('🆕 No previous session found - will start fresh session');
      }
    } catch (error) {
      console.warn('Session restoration failed:', error);
      // Don't throw - just continue with a fresh session
    }
  };
  // Save a single message to the conversation file immediately
  const saveMessageToFile = async (message: ConversationMessage) => {
    if (!agentId || !workspaceId) return;
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/agents/${agentId}/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.content,
          role: message.role,
          messageId: message.id,
          timestamp: message.timestamp,
          metadata: message.metadata,
          saveOnly: true // Flag to indicate this is just a save operation
        })
      });
      if (!response.ok) {
        console.warn('Failed to save message to file:', response.status);
      } else {
        console.log(`💾 Message saved to file: ${message.role} - ${message.content.substring(0, 50)}...`);
      }
    } catch (error) {
      console.warn('Error saving message to file:', error);
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
    
    // Check if we should restore from a checkpoint
    const urlParams = new URLSearchParams(window.location.search);
    const checkpointId = urlParams.get('checkpoint');
    
    if (checkpointId) {
      console.log('Attempting to restore from checkpoint:', checkpointId);
      try {
        const checkpointResponse = await fetch(`/api/workspaces/${workspaceId}/agents/${agentId}/checkpoints?id=${checkpointId}`, {
          method: 'PATCH'
        });
        
        if (checkpointResponse.ok) {
          const checkpointData = await checkpointResponse.json();
          if (checkpointData.success && checkpointData.checkpoint) {
            console.log('Checkpoint restored successfully:', checkpointData.checkpoint);
            const checkpoint = checkpointData.checkpoint;
            
            // Restore agent state
            setSelectedModel(checkpoint.selectedModel);
            
            // Restore messages
            const messagesFromCheckpoint = checkpoint.messages || [];
            setMessages(messagesFromCheckpoint);
            
            // Extract command history from user messages
            const commands = messagesFromCheckpoint
              .filter((msg: ConversationMessage) => msg.role === 'user')
              .map((msg: ConversationMessage) => msg.content);
            setCommandHistory(commands);
            
            // Add checkpoint restoration notification
            const restoreMessage: ConversationMessage = {
              id: `checkpoint_restore_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date().toISOString(),
              role: 'system',
              content: `💾 Checkpoint "${checkpoint.name}" restored successfully`,
              metadata: { checkpoint_restored: true, checkpoint_name: checkpoint.name }
            };
            setMessages(prev => [...prev, restoreMessage]);
            
            setHistoryLoaded(true);
            setIsProcessing(false);
            
            // Clear checkpoint parameter from URL
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('checkpoint');
            window.history.replaceState({}, '', newUrl.toString());
            
            // Force scroll to bottom after restoration
            setTimeout(() => {
              console.log('Scrolling to bottom after checkpoint restore');
              scrollToBottom();
            }, 200);
            
            return;
          }
        }
        console.warn('Failed to restore checkpoint, loading normal conversation');
      } catch (error) {
        console.error('Error restoring checkpoint:', error);
      }
    }
    
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
        // Only restore processing state if there's actually an active request
        // Check if last message is from user with no assistant response AND it's very recent (last 5 minutes)
        const shouldRestoreProcessing = (
          lastMessage?.role === 'user' &&
          !abortControllerRef.current?.signal.aborted &&
          new Date().getTime() - new Date(lastMessage.timestamp).getTime() < 5 * 60 * 1000 // 5 minutes
        );
        if (shouldRestoreProcessing) {
          console.log('🔄 Detected recent incomplete conversation - checking if request is still active');
          // Only set processing if we have an active abort controller (meaning there's an actual request)
          if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
            console.log('🔄 Active request found - restoring processing state');
            setIsProcessing(true);
          } else {
            console.log('🔄 No active request found - user message was abandoned, not restoring processing state');
            setIsProcessing(false);
          }
        } else {
          // Ensure processing is false for completed conversations
          setIsProcessing(false);
        }
        console.log('Valid messages after filtering:', validMessages.length);
        // Update state with valid messages
        setMessages(validMessages);
        // Cache the messages for this agent
        if (agentId) {
          agentMessagesCache.current[agentId] = validMessages;
          agentHistoryLoaded.current[agentId] = true;
        }
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
      if (agentId) {
        agentHistoryLoaded.current[agentId] = true;
      }
    } finally {
      // Always clear loading flag to prevent getting stuck
      isLoadingHistoryRef.current = false;
      // Set a backup timeout to ensure we don't get stuck
      setTimeout(() => {
        if (!historyLoaded) {
          console.warn('History loading timeout - forcing completion');
          setHistoryLoaded(true);
        }
      }, 5000);
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
    // Save user message immediately to file
    saveMessageToFile(userMessage);
    // Force scroll to bottom immediately after adding user message
    forceScrollToBottom();
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
        let metadata: any = {
          model: null,
          session_id: null,
          tools: [],
          usage: null,
          tool_uses: [],
          tool_results: [],
          thinking: [],
          result: null
        };
        // Create placeholder assistant message
        const assistantMessageId = generateMessageId();
        const placeholderMessage: ConversationMessage = {
          id: assistantMessageId,
          timestamp: new Date().toISOString(),
          role: 'assistant',
          content: ''
        };
        setMessages(prev => [...prev, placeholderMessage]);
        // Save placeholder immediately to reserve the message slot
        saveMessageToFile(placeholderMessage);
        let chunkCount = 0;
        let lastSaveTime = Date.now();
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
                    const content = data.content;
                    // Check if this is a metadata chunk
                    const metadataMatch = content.match(/<<<CLAUDE_METADATA:(\w+):(.*?)>>>/);
                    if (metadataMatch) {
                      const [, metadataType, metadataContent] = metadataMatch;
                      try {
                        const parsedMetadata = JSON.parse(metadataContent);
                        switch (metadataType) {
                          case 'SYSTEM':
                            metadata.model = parsedMetadata.model;
                            metadata.session_id = parsedMetadata.session_id;
                            metadata.tools = parsedMetadata.tools;
                            break;
                          case 'USAGE':
                            metadata.usage = parsedMetadata;
                            break;
                          case 'TOOL_USE':
                            metadata.tool_uses.push(parsedMetadata);
                            // Show current tool operation
                            setCurrentToolOperation(`${parsedMetadata.name}: ${parsedMetadata.operation_summary || 'Processing...'}`);
                            // Check if this tool requires approval - only tools that modify files or run dangerous commands
                            const toolsRequiringApproval = [
                              'bash', 'str_replace_editor', 'computer', 'Edit', 'Bash', 'Write', 
                              'MultiEdit'
                              // Note: Read, LS, Glob, Grep, Task, WebFetch, WebSearch, TodoRead, TodoWrite are now pre-approved
                            ];
                            const requiresApproval = parsedMetadata.approval_required ||
                                                   toolsRequiringApproval.includes(parsedMetadata.name);
                            console.log(`🔧 Tool detected: ${parsedMetadata.name}, requires approval: ${requiresApproval}`);
                            if (requiresApproval) {
                              setPendingToolApproval({
                                toolName: parsedMetadata.name,
                                operation: parsedMetadata.operation_summary || `Execute ${parsedMetadata.name}`,
                                messageId: assistantMessageId,
                                requiresApproval: true
                              });
                              console.log(`⚠️ Tool approval required for: ${parsedMetadata.name}`);
                            }
                            break;
                          case 'TOOL_RESULT':
                            metadata.tool_results.push(parsedMetadata);
                            // Check if this was a file operation and trigger refresh
                            if (parsedMetadata.tool_name && 
                                ['Edit', 'Write', 'MultiEdit', 'str_replace_editor'].includes(parsedMetadata.tool_name)) {
                              console.log('🔄 File operation detected, triggering refresh');
                              window.dispatchEvent(new CustomEvent('agentFileOperation', {
                                detail: { 
                                  toolName: parsedMetadata.tool_name,
                                  operation: 'file_modified',
                                  workspaceId: workspaceId
                                }
                              }));
                            }
                            break;
                          case 'THINKING':
                            metadata.thinking.push(parsedMetadata);
                            break;
                          case 'RESULT':
                            metadata.result = parsedMetadata;
                            break;
                        }
                      } catch (e) {
                        console.warn('Failed to parse metadata:', e);
                      }
                    } else {
                      // Regular content - accumulate it
                      assistantContent += content;
                      chunkCount++;
                      // Turn off processing indicator as soon as content starts arriving
                      if (isProcessing && assistantContent.length > 0) {
                        setIsProcessing(false);
                        setCurrentToolOperation(null); // Clear any tool operation display
                      }
                      // Only update UI if this component is still active (prevent tab bleeding)
                      if (isComponentActiveRef.current && !currentAbortController.signal.aborted) {
                        const updatedMessage = {
                          id: assistantMessageId,
                          timestamp: placeholderMessage.timestamp,
                          role: 'assistant' as const,
                          content: assistantContent,
                          metadata: { ...metadata, backend: 'streaming-live', success: false }
                        };
                        setMessages(prev => {
                          return prev.map(msg =>
                            msg.id === assistantMessageId ? updatedMessage : msg
                          );
                        });
                        scrollToBottom();
                        // Save to file every 5 chunks or every 2 seconds
                        const now = Date.now();
                        if (chunkCount % 5 === 0 || (now - lastSaveTime) > 2000) {
                          console.log(`💾 Chunked save: ${chunkCount} chunks, ${assistantContent.length} chars`);
                          saveMessageToFile(updatedMessage);
                          lastSaveTime = now;
                        }
                      }
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
        // Save final complete message with all metadata
        const finalMessage = {
          id: assistantMessageId,
          timestamp: placeholderMessage.timestamp,
          role: 'assistant' as const,
          content: assistantContent,
          metadata: { ...metadata, backend: 'streaming-complete', success: true }
        };
        // Update UI with final message
        setMessages(prev => {
          return prev.map(msg =>
            msg.id === assistantMessageId ? finalMessage : msg
          );
        });
        // Save final version to file
        console.log(`💾 Final save: Complete message with ${assistantContent.length} chars`);
        saveMessageToFile(finalMessage);
        // Turn off processing state and clear tool operation
        setIsProcessing(false);
        setCurrentToolOperation(null);
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
        // Clear any pending tool approvals on stream end
        if (pendingToolApproval) {
          console.log('Stream ended with pending approval - clearing');
          setPendingToolApproval(null);
        }
        setCurrentToolOperation(null);
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
    // Tool approval shortcuts - highest priority
    if (pendingToolApproval) {
      if (e.key === 'y' && e.ctrlKey) {
        e.preventDefault();
        handleToolApproval(true);
        return;
      } else if (e.key === 'n' && e.ctrlKey) {
        e.preventDefault();
        handleToolApproval(false);
        return;
      }
    }
    
    // If slash command autocomplete is showing, let it handle navigation keys
    if (showSlashCommands && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Escape')) {
      // The SlashCommandAutocomplete component will handle these
      return;
    }
    
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
      } else if (showSlashCommands) {
        setShowSlashCommands(false);
        setSlashSearchTerm('');
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
    <div className="flex flex-col h-full w-full bg-black text-green-400 font-mono text-sm" style={{ height: '100%' }}>
      {/* Fixed Input Area at Top */}
      <div className="flex-shrink-0 bg-black border-b border-gray-700">
        {/* Legacy Command Picker Dropdown - kept for Tab key */}
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
                }, 100);
              }}
            />
          </div>
        )}
        {/* Input Bar */}
        <div className="p-2 flex items-center">
          <span className="text-green-500 mr-2">{`>`}</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              const value = e.target.value;
              const cursorPos = e.target.selectionStart || 0;
              
              setInputValue(value);
              setCursorPosition(cursorPos);
              
              // Detect slash commands
              const beforeCursor = value.substring(0, cursorPos);
              const slashMatch = beforeCursor.match(/\/([^\/\s]*)$/);
              
              if (slashMatch) {
                setSlashSearchTerm(slashMatch[1]);
                setShowSlashCommands(true);
              } else {
                setShowSlashCommands(false);
                setSlashSearchTerm('');
              }
            }}
            onKeyDown={handleKeyDown}
            onSelect={(e) => {
              const target = e.target as HTMLInputElement;
              setCursorPosition(target.selectionStart || 0);
            }}
            onBlur={() => {
              // Hide autocomplete when input loses focus, but with a small delay
              // to allow for clicks on autocomplete items
              setTimeout(() => setShowSlashCommands(false), 200);
            }}
            placeholder={isProcessing ? "Processing..." : `Type your command or "/" for commands...`}
            className="flex-1 bg-transparent border-none outline-none text-green-400"
            disabled={isProcessing}
            autoFocus
          />
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={() => {
                setCheckpointName(`${workspaceId} Expert`);
                setShowCheckpointModal(true);
              }}
              className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
              title="Save Checkpoint"
              disabled={messages.length === 0}
            >
              💾
            </button>
            <button
              onClick={() => setSelectedModel(selectedModel === 'claude' ? 'gemini' : 'claude')}
              className={`text-xs px-2 py-1 text-white rounded transition-colors ${
                selectedModel === 'claude'
                  ? 'bg-purple-600 hover:bg-purple-500'
                  : 'bg-orange-600 hover:bg-orange-500'
              }`}
              title={`Switch to ${selectedModel === 'claude' ? 'Gemini' : 'Claude'}`}
            >
              {selectedModel === 'claude' ? '🧠 C' : '🔷 G'}
            </button>
          </div>
        </div>
        
      </div>
      {/* Scrollable Content Area */}
      <div
        ref={terminalRef}
        className="overflow-y-auto p-4 bg-black relative"
        style={{
          flex: '1 1 auto',
          minHeight: '0',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {/* New Messages Indicator */}
        {!shouldAutoScroll && isProcessing && (
          <div 
            className="absolute bottom-4 right-4 bg-green-600 text-white px-3 py-2 rounded-lg cursor-pointer hover:bg-green-700 transition-colors z-10 flex items-center gap-2"
            onClick={forceScrollToBottom}
          >
            <span className="text-sm">New messages</span>
            <span className="text-xs">⬇</span>
          </div>
        )}
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
                {/* Consolidated Metadata - 2 lines max, importance-based sizing */}
                {(message.metadata?.model || message.metadata?.usage || message.metadata?.tool_uses) && (
                  <div className="text-xs mt-1 space-y-1">
                    {/* Primary Line: Model, Tokens, Tools */}
                    <div className="flex items-center gap-3 text-xs">
                      {message.metadata?.model && (
                        <span className="text-purple-400 font-medium">
                          🤖 {message.metadata.model.replace('claude-', '').replace('-20250514', '')}
                        </span>
                      )}
                      {message.metadata?.usage && (
                        <span className="text-cyan-400">
                          📊 {message.metadata.usage.input_tokens || 0}→{message.metadata.usage.output_tokens || 0}
                          {message.metadata.usage.cache_read_input_tokens && (
                            <span className="text-green-400 ml-1">⚡{message.metadata.usage.cache_read_input_tokens}</span>
                          )}
                        </span>
                      )}
                      {message.metadata?.tool_uses && message.metadata.tool_uses.length > 0 && (
                        <span className="text-blue-400">
                          🔧 {message.metadata.tool_uses.length} tool{message.metadata.tool_uses.length > 1 ? 's' : ''}
                          {message.metadata?.tool_results && message.metadata.tool_results.some((r: any) => r.is_error) && (
                            <span className="text-red-400 ml-1">❌{message.metadata.tool_results.filter((r: any) => r.is_error).length}</span>
                          )}
                        </span>
                      )}
                    </div>
                    {/* Secondary Line: Performance, Cost, Session */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {message.metadata?.result && (
                        <>
                          <span>⏱️ {(message.metadata.result.duration_ms / 1000).toFixed(1)}s</span>
                          {message.metadata.result.total_cost_usd && (
                            <span>💰 ${(message.metadata.result.total_cost_usd).toFixed(4)}</span>
                          )}
                          {message.metadata.result.num_turns && (
                            <span>🔄 {message.metadata.result.num_turns}</span>
                          )}
                        </>
                      )}
                      {message.metadata?.session_id && (
                        <span>Session: {message.metadata.session_id.slice(-8)}</span>
                      )}
                    </div>
                  </div>
                )}
                {/* Legacy metadata support */}
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
              {currentToolOperation && (
                <div className="text-xs text-yellow-400 mt-1">
                  🔧 {currentToolOperation}
                </div>
              )}
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
        {/* Tool Approval UI */}
        {pendingToolApproval && (
          <div className="flex items-center text-yellow-300 bg-yellow-900 bg-opacity-30 p-3 rounded border-l-4 border-yellow-500" key={`approval-${pendingToolApproval.messageId}`}>
            <span className="mr-2 text-yellow-400">🔧</span>
            <div className="flex-1">
              <div className="flex items-center">
                <span className="animate-pulse text-yellow-400 mr-2">⚠️</span>
                <span className="text-sm font-medium">Tool Approval Required</span>
              </div>
              <div className="text-sm mt-1">
                <strong>{pendingToolApproval.toolName}</strong> wants to: {pendingToolApproval.operation}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                This tool can modify files or execute commands. Do you approve?
              </div>
              <div className="text-xs text-gray-500 mt-1">
                ⚡ Shortcuts: Ctrl+Y (Yes) • Ctrl+N (No)
              </div>
            </div>
            <div className="flex gap-2 ml-4">
              <button
                onClick={() => handleToolApproval(true)}
                className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition-colors"
              >
                ✅ Yes (Ctrl+Y)
              </button>
              <button
                onClick={() => handleToolApproval(false)}
                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded transition-colors"
              >
                ❌ No (Ctrl+N)
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Checkpoint Save Modal */}
      {showCheckpointModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowCheckpointModal(false)}
          />
          <div className="relative bg-gray-900 rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">💾 Save Agent Checkpoint</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Checkpoint Name
                </label>
                <input
                  type="text"
                  value={checkpointName}
                  onChange={(e) => setCheckpointName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter checkpoint name..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={checkpointDescription}
                  onChange={(e) => setCheckpointDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Describe this checkpoint..."
                  rows={3}
                />
              </div>
              
              <div className="text-sm text-gray-400">
                This will save the current conversation state and agent expertise for later restoration.
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCheckpointModal(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCheckpoint}
                disabled={!checkpointName.trim() || isSavingCheckpoint}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white rounded-md transition-colors"
              >
                {isSavingCheckpoint ? 'Saving...' : 'Save Checkpoint'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Slash Command Autocomplete - Positioned to overlay */}
      <SlashCommandAutocomplete
        isVisible={showSlashCommands}
        searchTerm={slashSearchTerm}
        onSelectCommand={handleSelectSlashCommand}
        onClose={() => {
          setShowSlashCommands(false);
          setSlashSearchTerm('');
        }}
        workspaceId={workspaceId}
      />
    </div>
  );
}