# Terminal UI Implementation Requirements
## Terminal Modal Design
### 1. Modal Structure
```typescript
interface TerminalModal {
  // Modal properties
  isOpen: boolean;
  workspaceId: string;
  activeAgentId: string | null;
  // Layout configuration
  size: 'almost-fullscreen';      // Leaves workspace context visible on sides
  position: 'center';
  backdrop: 'semi-transparent';   // Allow some workspace context to show through
  // Close behavior
  closeOnOutsideClick: true;
  closeOnEscape: true;
  // Content areas
  header: TerminalHeader;
  tabBar: AgentTabBar;
  chatArea: ChatInterface;
  inputArea: CommandInput;
}
```
### 2. Agent Tab Management
```typescript
interface AgentTabBar {
  tabs: AgentTab[];
  activeTabId: string;
  maxVisibleTabs: number;        // Overflow to dropdown if needed
  // Tab operations
  onTabSelect: (agentId: string) => void;
  onTabClose: (agentId: string) => void;
  onNewAgent: () => void;
  // Tab indicators
  showActiveIndicator: boolean;   // Green dot for active agents
  showUnreadCount: boolean;       // Message count since last viewed
}
interface AgentTab {
  agentId: string;
  name: string;
  color: string;                  // Agent stripe color
  status: 'active' | 'idle' | 'error' | 'loading';
  unreadCount: number;
  isCloseable: boolean;           // Can user close this tab?
}
```
### 3. Chat Interface
```typescript
interface ChatInterface {
  // Message display
  messages: ChatMessage[];
  isLoading: boolean;
  loadingIndicator: 'typing' | 'thinking' | 'executing';
  // Scroll behavior
  autoScroll: boolean;            // Auto-scroll to bottom on new messages
  scrollToBottom: () => void;
  // Message rendering
  messageRenderer: MessageRenderer;
  codeHighlighting: boolean;
  filePreview: boolean;           // Show file changes inline
  // Interaction
  onMessageSelect: (messageId: string) => void;
  onCheckpointCreate: (messageId: string) => void;  // Pin button functionality
  // History loading
  historyLoader: ConversationHistoryLoader;
  infiniteScroll: boolean;        // Load older messages on scroll up
}
interface ChatMessage {
  id: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  // Message metadata
  isCheckpointable: boolean;      // Show pin button?
  commandExecution?: CommandExecution;
  fileChanges?: FileChange[];
  approvalRequired?: boolean;
  // Visual indicators
  status: 'sending' | 'sent' | 'delivered' | 'error';
  isSelected: boolean;
  isHighlighted: boolean;         // For search results, etc.
}
```
### 4. Command Input System
```typescript
interface CommandInput {
  // Input modes
  mode: 'command' | 'freetext' | 'checkpoint-selection';
  // Command dropdown
  commandDropdown: CommandDropdown;
  quickCommentBox: CommentBox;
  // Input field
  textInput: FormattedTextInput;
  // Actions
  onSend: (content: string, command?: string, comment?: string) => void;
  onClear: () => void;
  onModeSwitch: (mode: InputMode) => void;
  // Checkpoint selection (for new agents)
  checkpointSelector?: CheckpointSelector;
}
interface CommandDropdown {
  // Command categories
  categories: CommandCategory[];
  recommendedCommands: Command[];    // Based on workspace context
  recentCommands: Command[];         // Recently used by this user
  // Search and filter
  searchQuery: string;
  filteredCommands: Command[];
  // Selection
  selectedCommand: Command | null;
  onCommandSelect: (command: Command) => void;
  // UI behavior
  isOpen: boolean;
  placement: 'above' | 'below';    // Smart positioning
  maxHeight: number;
}
interface CommentBox {
  placeholder: string;             // "Add details or context..."
  maxLength: number;               // Character limit
  value: string;
  onChange: (value: string) => void;
  // Auto-suggestions
  suggestions: string[];           // Based on workspace context
  showSuggestions: boolean;
}
interface FormattedTextInput {
  // Rich text features
  supportMarkdown: boolean;
  syntaxHighlighting: boolean;
  autoComplete: boolean;
  // Text processing
  value: string;
  placeholder: string;
  maxLength: number;
  minHeight: number;
  maxHeight: number;               // Auto-expand up to limit
  // Formatting toolbar
  showToolbar: boolean;
  toolbarItems: TextFormatTool[];
  // Keyboard shortcuts
  shortcuts: KeyboardShortcut[];
  // Submission
  onSubmit: () => void;
  submitOnEnter: boolean;          // Ctrl+Enter or Enter?
  submitOnCtrlEnter: boolean;
}
```
### 5. Checkpoint Selection Interface
```typescript
interface CheckpointSelector {
  // For new agent creation
  isVisible: boolean;
  searchQuery: string;
  // Checkpoint data
  availableCheckpoints: CheckpointSummary[];
  filteredCheckpoints: CheckpointSummary[];
  selectedCheckpoint: CheckpointSummary | null;
  // Search and filter
  onSearch: (query: string) => void;
  onFilter: (filters: CheckpointFilters) => void;
  onSelect: (checkpoint: CheckpointSummary) => void;
  // Actions
  onStartFresh: () => void;        // Start without checkpoint
  onStartFromCheckpoint: (checkpointId: string) => void;
}
interface CheckpointSummary {
  id: string;
  title: string;
  description: string;
  tags: string[];
  // Context info
  workspaceContextTypes: string[];
  expertiseAreas: string[];
  // Performance metrics
  performanceScore: number;        // 1-10 based on past usage
  usageCount: number;
  lastUsed: string;
  // Preview
  conversationPreview: string;     // First few messages
  knowledgeAreas: string[];        // What this agent knows about
}
interface CheckpointFilters {
  contextTypes: string[];
  expertiseAreas: string[];
  performanceThreshold: number;
  recentlyUsed: boolean;
  myCheckpoints: boolean;          // Only user's checkpoints
}
```
## Terminal Keyboard Shortcuts
```typescript
interface TerminalShortcuts {
  // Tab management
  'Ctrl+T': 'newAgent';
  'Ctrl+W': 'closeActiveTab';
  'Ctrl+Tab': 'nextTab';
  'Ctrl+Shift+Tab': 'previousTab';
  'Ctrl+1-9': 'selectTabByIndex';
  // Message input
  'Enter': 'submitMessage';        // If single-line mode
  'Ctrl+Enter': 'submitMessage';   // If multi-line mode
  'Shift+Enter': 'newLine';       // In multi-line mode
  'Escape': 'clearInput';
  // Command selection
  'Ctrl+K': 'openCommandPalette';
  'Tab': 'autocompleteCommand';
  'Up/Down': 'navigateCommands';
  // Chat navigation
  'Ctrl+F': 'searchMessages';
  'Ctrl+G': 'findNext';
  'Ctrl+Shift+G': 'findPrevious';
  'PageUp/PageDown': 'scrollMessages';
  'Home': 'scrollToTop';
  'End': 'scrollToBottom';
  // Checkpoint actions
  'Ctrl+P': 'pinCurrentMessage';   // Create checkpoint
  'Ctrl+L': 'loadCheckpoint';      // Show checkpoint selector
  // Terminal management
  'Ctrl+Shift+C': 'copyCurrentConversation';
  'Ctrl+Shift+E': 'exportConversation';
  'F11': 'toggleFullscreen';
}
```
## State Management Requirements
```typescript
interface TerminalState {
  // Modal state
  isOpen: boolean;
  workspaceId: string;
  // Active agents
  activeAgents: Map<string, AgentSession>;
  currentAgentId: string | null;
  // UI state
  tabOrder: string[];
  unreadCounts: Map<string, number>;
  scrollPositions: Map<string, number>;
  // Input state
  commandHistory: string[];
  currentInput: string;
  selectedCommand: Command | null;
  commentText: string;
  // Checkpoint state
  showingCheckpointSelector: boolean;
  availableCheckpoints: CheckpointSummary[];
  checkpointSearchQuery: string;
  // Performance
  messageCache: Map<string, ConversationMessage[]>;
  loadingStates: Map<string, boolean>;
}
interface AgentSession {
  agent: Agent;
  conversationId: string;
  messages: ConversationMessage[];
  isLoading: boolean;
  lastActivity: string;
  // UI state specific to this agent
  scrollPosition: number;
  unreadCount: number;
  inputHistory: string[];
  // Connection state
  isConnected: boolean;
  connectionError?: string;
}
```
## Performance Considerations
### 1. Message Virtualization
- Render only visible messages (virtual scrolling)
- Load older messages on demand
- Cache rendered message components
- Lazy load file previews and images
### 2. Real-time Updates
- WebSocket connection per active agent
- Efficient state updates using React hooks
- Debounced search and filtering
- Optimistic UI updates for better responsiveness
### 3. Memory Management
- Limit cached conversations per agent
- Clean up inactive agent sessions
- Compress older message history
- Efficient checkpoint loading
This terminal implementation provides:
- ✅ Multi-agent tab management
- ✅ Context-aware command selection
- ✅ Seamless checkpoint system
- ✅ Rich text input with formatting
- ✅ Keyboard-first interaction
- ✅ Real-time conversation updates
- ✅ Efficient performance for long conversations