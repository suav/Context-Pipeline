/**
 * Slash Command Autocomplete Component
 * Shows available commands when user types "/" in terminal
 */
'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { UserCommand } from '../../services/CommandManager';
import CommandClientService from '../../services/CommandClientService';

interface SlashCommandAutocompleteProps {
  isVisible: boolean;
  searchTerm: string;
  onSelectCommand: (commandText: string) => void;
  onClose: () => void;
  anchorPosition?: { top: number; left: number };
  workspaceId: string;
}

export function SlashCommandAutocomplete({
  isVisible,
  searchTerm,
  onSelectCommand,
  onClose,
  anchorPosition,
  workspaceId
}: SlashCommandAutocompleteProps) {
  const [commands, setCommands] = useState<UserCommand[]>([]);
  const [filteredCommands, setFilteredCommands] = useState<UserCommand[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const commandService = CommandClientService.getInstance();

  // Load commands when component mounts
  useEffect(() => {
    loadCommands();
  }, [workspaceId]);

  // Filter commands based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredCommands(commands);
    } else {
      const filtered = commands.filter(cmd => 
        cmd.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cmd.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cmd.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCommands(filtered);
    }
    setSelectedIndex(0);
  }, [searchTerm, commands]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredCommands.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            // Send just the command keyword in Claude Code format
            onSelectCommand(`/${filteredCommands[selectedIndex].keyword}`);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, filteredCommands, selectedIndex, onSelectCommand, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (containerRef.current && selectedIndex >= 0) {
      const selectedElement = containerRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const loadCommands = async () => {
    try {
      setLoading(true);
      const allCommands = await commandService.getAllCommands();
      // Filter to only show commands that are relevant for this workspace
      const relevantCommands = allCommands.filter(cmd => {
        // Include all default commands and any custom commands
        return cmd.is_default || cmd.user_modified || !cmd.is_default;
      });
      setCommands(relevantCommands);
    } catch (error) {
      console.error('Failed to load commands:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) return null;

  // Get the first 100 chars of the command prompt for preview
  const getCommandPreview = (command: UserCommand) => {
    const preview = command.base_prompt
      .replace(/^#.*?\n/gm, '') // Remove markdown headers
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim()
      .substring(0, 100);
    return preview + (command.base_prompt.length > 100 ? '...' : '');
  };

  // Format command for Claude with enhanced prompts
  const formatCommandForClaude = (command: UserCommand) => {
    // Check if command has a specific Claude-optimized format
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

  const style: React.CSSProperties = anchorPosition 
    ? {
        position: 'fixed',
        top: anchorPosition.top,
        left: anchorPosition.left,
        zIndex: 9999,
        height: '400px',
        width: '600px'
      }
    : {
        position: 'fixed',
        bottom: '80px', // Position above the input area
        left: '16px',
        right: '16px',
        zIndex: 9999,
        height: '400px',
        minHeight: '400px'
      };

  const portalContent = (
    <div 
      className="border rounded-md shadow-2xl overflow-hidden flex flex-col"
      style={{ 
        ...style, 
        height: '400px', 
        maxHeight: '400px',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        backgroundColor: '#1a1a1a !important', // Force solid dark background with !important
        borderColor: '#404040',
        opacity: '1 !important',
        zIndex: 99999, // Higher z-index to ensure it's above everything
        isolation: 'isolate', // Create new stacking context
        backdropFilter: 'none', // Disable any backdrop filters
        filter: 'none' // Disable any filters
      }}
    >
      {/* Header */}
      <div 
        className="px-4 py-2 border-b flex items-center justify-between"
        style={{
          backgroundColor: '#2a2a2a', // Force solid dark header
          borderBottomColor: '#404040',
          color: '#ffffff'
        }}
      >
        <span className="text-sm font-medium" style={{ color: '#00ff88' }}>
          Slash Commands {filteredCommands.length > 0 && `(${filteredCommands.length})`}
        </span>
        <span className="text-xs" style={{ color: '#888888' }}>
          ↑↓ Navigate • Enter Select • Esc Close
        </span>
      </div>

      {/* Commands List */}
      <div ref={containerRef} className="overflow-y-auto flex-1">
        {loading ? (
          <div className="p-4 text-center" style={{ color: '#888888' }}>Loading commands...</div>
        ) : filteredCommands.length === 0 ? (
          <div className="p-4 text-center" style={{ color: '#888888' }}>
            No commands found matching "{searchTerm}"
          </div>
        ) : (
          <div className="py-1">
            {filteredCommands.map((command, index) => (
              <div
                key={command.id}
                data-index={index}
                onClick={() => onSelectCommand(`/${command.keyword}`)}
                className="px-4 py-2 cursor-pointer transition-colors border-l-4"
                style={{
                  backgroundColor: index === selectedIndex ? '#333333' : 'transparent',
                  borderLeftColor: index === selectedIndex ? '#00ff88' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2a2a2a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = index === selectedIndex ? '#333333' : 'transparent';
                }}
              >
                <div className="flex items-center gap-3">
                  <span 
                    className="font-mono text-sm font-medium min-w-0"
                    style={{ color: '#00ff88' }}
                  >
                    /{command.keyword}
                  </span>
                  <span 
                    className="text-sm flex-1 min-w-0"
                    style={{ color: '#ffffff' }}
                  >
                    {command.name}
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <span 
                      className="px-2 py-1 rounded"
                      style={{ 
                        color: '#cccccc', 
                        backgroundColor: '#2a2a2a' 
                      }}
                    >
                      {command.category}
                    </span>
                    {command.requires_approval && (
                      <span 
                        className="px-2 py-1 rounded"
                        style={{ 
                          color: '#ff9900', 
                          backgroundColor: '#442200' 
                        }}
                      >
                        ⚠️ approval
                      </span>
                    )}
                    {!command.is_default && (
                      <span 
                        className="px-2 py-1 rounded"
                        style={{ 
                          color: '#00ff88', 
                          backgroundColor: '#002211' 
                        }}
                      >
                        custom
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Simplified description */}
                <div 
                  className="text-xs mt-1 pl-0"
                  style={{ color: '#bbbbbb' }}
                >
                  {getCommandPreview(command)}
                </div>
                
                {/* Show expanded preview only on selection */}
                {index === selectedIndex && (
                  <div 
                    className="mt-3 p-3 rounded border"
                    style={{
                      backgroundColor: '#2a2a2a',
                      borderColor: '#404040'
                    }}
                  >
                    <div 
                      className="text-xs mb-2 font-medium"
                      style={{ color: '#cccccc' }}
                    >
                      Command Details:
                    </div>
                    <div className="text-xs space-y-1" style={{ color: '#ffffff' }}>
                      <div>
                        <span style={{ color: '#888888' }}>Duration:</span> {command.estimated_duration}
                      </div>
                      <div>
                        <span style={{ color: '#888888' }}>Type:</span> {command.category}
                      </div>
                      {command.follow_up_commands && command.follow_up_commands.length > 0 && (
                        <div>
                          <span style={{ color: '#888888' }}>Follow-ups:</span> {command.follow_up_commands.join(', ')}
                        </div>
                      )}
                    </div>
                    <div 
                      className="mt-2 pt-2 border-t"
                      style={{ borderTopColor: '#404040' }}
                    >
                      <div 
                        className="text-xs mb-1"
                        style={{ color: '#888888' }}
                      >
                        Preview:
                      </div>
                      <div 
                        className="text-xs font-mono leading-relaxed"
                        style={{ color: '#cccccc' }}
                      >
                        {command.base_prompt.substring(0, 200)}
                        {command.base_prompt.length > 200 && '...'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Use portal to render outside the parent container to avoid transparency issues
  return typeof window !== 'undefined' 
    ? createPortal(portalContent, document.body)
    : null;
}