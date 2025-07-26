import { promises as fs } from 'fs';
import * as path from 'path';
import { Command, STARTUP_COMMANDS, REPLY_COMMANDS } from '../data/commandLibrary';

export interface UserCommand extends Command {
  created_at: string;
  updated_at: string;
  is_default: boolean;
  custom_additions?: string[];
  roles?: string[]; // Array of roles this command applies to
}

export interface CommandStorage {
  commands: UserCommand[];
  categories: string[];
  version: string;
  last_updated: string;
}

export class CommandManager {
  private static instance: CommandManager;
  private storageDir: string;
  private userCommandsFile: string;

  private constructor() {
    this.storageDir = path.join(process.cwd(), 'storage', 'commands');
    this.userCommandsFile = path.join(this.storageDir, 'user-commands.json');
  }

  static getInstance(): CommandManager {
    if (!CommandManager.instance) {
      CommandManager.instance = new CommandManager();
    }
    return CommandManager.instance;
  }

  async initializeStorage(): Promise<void> {
    try {
      // Ensure storage directory exists
      await fs.mkdir(this.storageDir, { recursive: true });

      // Check if user commands file exists
      try {
        await fs.access(this.userCommandsFile);
        // File exists, migrate existing commands to add roles if needed
        await this.migrateExistingCommands();
      } catch {
        // File doesn't exist, create it with default commands
        await this.seedDefaultCommands();
      }
    } catch (error) {
      console.error('Failed to initialize command storage:', error);
      throw error;
    }
  }

  async seedDefaultCommands(): Promise<void> {
    const roleTemplates = this.createRoleBasedCommandTemplates();
    
    // Flatten all role commands into a single array
    const allCommands: UserCommand[] = [];
    Object.values(roleTemplates).forEach(roleTemplate => {
      allCommands.push(...roleTemplate.commands);
    });

    const storage: CommandStorage = {
      commands: allCommands,
      categories: ['analysis', 'development', 'testing', 'documentation', 'planning'],
      version: '1.0.0',
      last_updated: new Date().toISOString()
    };

    await fs.writeFile(this.userCommandsFile, JSON.stringify(storage, null, 2));
    console.log('✅ Role-based command templates seeded successfully');
  }

  async migrateExistingCommands(): Promise<void> {
    try {
      const storage = await this.loadStorage();
      let hasChanges = false;

      // Add roles to existing commands that don't have them
      const updatedCommands = storage.commands.map(cmd => {
        if (!cmd.roles || cmd.roles.length === 0) {
          hasChanges = true;
          
          // Assign default roles based on command characteristics
          let defaultRoles: string[] = [];
          
          if (cmd.id.startsWith('dev_') || cmd.keyword === 'implement' || cmd.keyword === 'debug') {
            defaultRoles = ['developer'];
          } else if (cmd.id.startsWith('review_') || cmd.keyword === 'review') {
            defaultRoles = ['reviewer'];
          } else if (cmd.id.startsWith('test_') || cmd.keyword === 'test') {
            defaultRoles = ['tester'];
          } else if (cmd.id.startsWith('plan_') || cmd.keyword === 'plan') {
            defaultRoles = ['planner'];
          } else if (cmd.keyword === 'investigate' || cmd.keyword === 'analyze') {
            defaultRoles = ['developer', 'reviewer', 'tester', 'planner'];
          } else {
            // Default to developer role for unknown commands
            defaultRoles = ['developer'];
          }

          return {
            ...cmd,
            roles: defaultRoles,
            updated_at: new Date().toISOString()
          };
        }
        return cmd;
      });

      if (hasChanges) {
        const updatedStorage = {
          ...storage,
          commands: updatedCommands,
          last_updated: new Date().toISOString()
        };
        
        await fs.writeFile(this.userCommandsFile, JSON.stringify(updatedStorage, null, 2));
        console.log('✅ Existing commands migrated with roles');
      }
    } catch (error) {
      console.error('Failed to migrate existing commands:', error);
    }
  }

  async getAllCommands(): Promise<UserCommand[]> {
    try {
      const data = await fs.readFile(this.userCommandsFile, 'utf8');
      const storage: CommandStorage = JSON.parse(data);
      return storage.commands;
    } catch (error) {
      console.error('Failed to load commands:', error);
      return [];
    }
  }

  async getCommand(id: string): Promise<UserCommand | null> {
    const commands = await this.getAllCommands();
    return commands.find(cmd => cmd.id === id) || null;
  }

  async getCommandsByRole(role: string): Promise<UserCommand[]> {
    const commands = await this.getAllCommands();
    return commands.filter(cmd => {
      // Check if command has roles array and includes the specified role
      return cmd.roles?.includes(role) || cmd.id.startsWith(role + '_');
    });
  }

  getRoleTemplates() {
    return this.createRoleBasedCommandTemplates();
  }

  async getCommandsByMode(mode: 'startup' | 'reply'): Promise<UserCommand[]> {
    const commands = await this.getAllCommands();
    const modeCommands = mode === 'startup' ? ['investigate', 'analyze', 'plan', 'setup'] : ['implement', 'debug', 'review', 'test', 'explain', 'continue'];
    return commands.filter(cmd => modeCommands.includes(cmd.keyword));
  }

  async getCommandsByCategory(category: string): Promise<UserCommand[]> {
    const commands = await this.getAllCommands();
    return commands.filter(cmd => cmd.category === category);
  }

  async saveCommand(command: UserCommand): Promise<void> {
    try {
      const storage = await this.loadStorage();
      const existingIndex = storage.commands.findIndex(cmd => cmd.id === command.id);
      
      if (existingIndex >= 0) {
        // Update existing command
        storage.commands[existingIndex] = {
          ...command,
          updated_at: new Date().toISOString()
        };
      } else {
        // Add new command
        storage.commands.push({
          ...command,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      storage.last_updated = new Date().toISOString();
      await fs.writeFile(this.userCommandsFile, JSON.stringify(storage, null, 2));
    } catch (error) {
      console.error('Failed to save command:', error);
      throw error;
    }
  }

  async deleteCommand(id: string): Promise<void> {
    try {
      const storage = await this.loadStorage();
      storage.commands = storage.commands.filter(cmd => cmd.id !== id);
      storage.last_updated = new Date().toISOString();
      await fs.writeFile(this.userCommandsFile, JSON.stringify(storage, null, 2));
    } catch (error) {
      console.error('Failed to delete command:', error);
      throw error;
    }
  }


  private async loadStorage(): Promise<CommandStorage> {
    try {
      const data = await fs.readFile(this.userCommandsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // Return empty storage if file doesn't exist
      return {
        commands: [],
        categories: [],
        version: '1.0.0',
        last_updated: new Date().toISOString()
      };
    }
  }

  private createRoleBasedCommandTemplates() {
    const now = new Date().toISOString();
    
    // Define shared commands first
    const sharedCommands: UserCommand[] = [
      {
        id: 'investigate',
        name: 'Investigate Workspace',
        keyword: 'investigate',
        category: 'analysis',
        base_prompt: `# Workspace Investigation

## Objective
Analyze the workspace comprehensively to understand the codebase, current state, and identify next steps.

## Process
1. **Initial Assessment**: Examine project structure and configuration
2. **Context Analysis**: Review all context files and documentation
3. **Code Investigation**: Search for patterns, issues, and opportunities
4. **Documentation Review**: Check existing documentation and gaps
5. **Final Report**: Provide structured findings and recommendations

## Deliverables
- Comprehensive workspace analysis
- Prioritized list of issues and opportunities
- Specific recommendations for next actions`,
        context_adaptations: { git: 'Focus on recent commits', jira: 'Link to relevant tickets' },
        requires_approval: false,
        estimated_duration: '10-15 minutes',
        follow_up_commands: ['implement', 'plan', 'review'],
        usage_count: 0,
        success_rate: 0.0,
        average_completion_time_ms: 0,
        required_permissions: ['read_context', 'read_target', 'git_access'],
        user_modified: false,
        created_at: now,
        updated_at: now,
        is_default: true,
        roles: ['developer', 'reviewer', 'tester', 'planner']
      },
      {
        id: 'analyze',
        name: 'Code Analysis',
        keyword: 'analyze',
        category: 'analysis',
        base_prompt: `# Code Analysis

## Objective
Perform comprehensive code analysis including quality, security, and performance assessment.

## Process
1. **Architecture Analysis**: Map project structure and patterns
2. **Code Quality Review**: Check for best practices and maintainability
3. **Performance Analysis**: Identify bottlenecks and optimization opportunities
4. **Security Review**: Look for potential vulnerabilities
5. **Documentation Assessment**: Review code documentation quality

## Deliverables
- Architecture overview and assessment
- Code quality report with recommendations
- Performance optimization suggestions
- Security findings and remediation advice`,
        context_adaptations: { git: 'Analyze recent changes', jira: 'Reference analysis tickets' },
        requires_approval: false,
        estimated_duration: '15-25 minutes',
        follow_up_commands: ['implement', 'review', 'test'],
        usage_count: 0,
        success_rate: 0.0,
        average_completion_time_ms: 0,
        required_permissions: ['read_context', 'read_target', 'git_access'],
        user_modified: false,
        created_at: now,
        updated_at: now,
        is_default: true,
        roles: ['developer', 'reviewer', 'tester']
      }
    ];

    // Developer-specific commands
    const developerCommands: UserCommand[] = [
      {
        id: 'implement',
        name: 'Implement Feature',
        keyword: 'implement',
        category: 'development',
        base_prompt: `# Feature Implementation

## Objective
Develop and implement the requested feature according to specifications.

## Process
1. **Requirements Review**: Confirm acceptance criteria and constraints
2. **Technical Design**: Plan implementation approach and architecture
3. **Code Development**: Write clean, maintainable, and tested code
4. **Testing Integration**: Add comprehensive tests for new functionality
5. **Documentation**: Update relevant documentation and comments

## Deliverables
- Working feature implementation
- Comprehensive test coverage
- Updated documentation`,
        context_adaptations: { jira: 'Reference ticket requirements', git: 'Follow branching strategy' },
        requires_approval: false,
        estimated_duration: '30-45 minutes',
        follow_up_commands: ['test', 'review'],
        usage_count: 0,
        success_rate: 0.0,
        average_completion_time_ms: 0,
        required_permissions: ['read_context', 'write_target', 'git_access'],
        user_modified: false,
        created_at: now,
        updated_at: now,
        is_default: true,
        roles: ['developer']
      },
      {
        id: 'debug',
        name: 'Debug Issue',
        keyword: 'debug',
        category: 'development',
        base_prompt: `# Debug Investigation

## Objective
Systematically identify and resolve the reported issue.

## Process
1. **Issue Reproduction**: Replicate the problem in development environment
2. **Root Cause Analysis**: Trace the source using debugging tools and logs
3. **Solution Design**: Plan the fix approach considering side effects
4. **Implementation**: Apply the fix with proper testing
5. **Verification**: Ensure the issue is resolved without regressions

## Deliverables
- Root cause analysis report
- Working fix implementation
- Regression tests to prevent recurrence`,
        context_adaptations: { git: 'Check recent changes', jira: 'Update bug ticket status' },
        requires_approval: false,
        estimated_duration: '20-30 minutes',
        follow_up_commands: ['test', 'review'],
        usage_count: 0,
        success_rate: 0.0,
        average_completion_time_ms: 0,
        required_permissions: ['read_context', 'write_target', 'git_access'],
        user_modified: false,
        created_at: now,
        updated_at: now,
        is_default: true,
        roles: ['developer']
      }
    ];

    // Reviewer-specific commands
    const reviewerCommands: UserCommand[] = [
      {
        id: 'review',
        name: 'Code Review',
        keyword: 'review',
        category: 'analysis',
        base_prompt: `# Code Review

## Objective
Conduct thorough code review focusing on quality, security, and maintainability.

## Process
1. **Code Quality**: Check for best practices, patterns, and maintainability
2. **Security Review**: Identify potential vulnerabilities and security issues
3. **Performance Assessment**: Evaluate efficiency and optimization opportunities
4. **Testing Evaluation**: Review test coverage and quality
5. **Documentation Review**: Check code comments and documentation

## Deliverables
- Code quality assessment with specific feedback
- Security findings and recommendations
- Performance optimization suggestions
- Review summary with actionable items`,
        context_adaptations: { git: 'Focus on diff and recent commits', jira: 'Link to review tickets' },
        requires_approval: false,
        estimated_duration: '15-25 minutes',
        follow_up_commands: ['implement', 'test'],
        usage_count: 0,
        success_rate: 0.0,
        average_completion_time_ms: 0,
        required_permissions: ['read_context', 'read_target', 'git_access'],
        user_modified: false,
        created_at: now,
        updated_at: now,
        is_default: true,
        roles: ['reviewer']
      }
    ];

    // Tester-specific commands
    const testerCommands: UserCommand[] = [
      {
        id: 'test',
        name: 'Run Tests',
        keyword: 'test',
        category: 'testing',
        base_prompt: `# Test Execution and Analysis

## Objective
Execute comprehensive testing and provide detailed analysis of results.

## Process
1. **Test Planning**: Define test scenarios and coverage requirements
2. **Test Execution**: Run unit, integration, and end-to-end tests
3. **Results Analysis**: Analyze test outcomes and identify failures
4. **Gap Analysis**: Identify missing test coverage
5. **Reporting**: Generate comprehensive test report with recommendations

## Deliverables
- Test execution results and coverage report
- Failure analysis and root cause identification
- Recommendations for improving test coverage
- Test strategy improvements`,
        context_adaptations: { git: 'Test against specific commits', jira: 'Reference test requirements' },
        requires_approval: false,
        estimated_duration: '20-30 minutes',
        follow_up_commands: ['debug', 'review'],
        usage_count: 0,
        success_rate: 0.0,
        average_completion_time_ms: 0,
        required_permissions: ['read_context', 'read_target', 'git_access'],
        user_modified: false,
        created_at: now,
        updated_at: now,
        is_default: true,
        roles: ['tester']
      }
    ];

    // Planner-specific commands
    const plannerCommands: UserCommand[] = [
      {
        id: 'plan',
        name: 'Project Planning',
        keyword: 'plan',
        category: 'planning',
        base_prompt: `# Project Planning

## Objective
Create comprehensive project plan with timelines, resources, and risk assessment.

## Process
1. **Requirements Analysis**: Gather and analyze project requirements
2. **Task Breakdown**: Create detailed work breakdown structure
3. **Timeline Creation**: Develop realistic project timeline with milestones
4. **Resource Planning**: Identify required resources and skills
5. **Risk Assessment**: Identify potential risks and mitigation strategies

## Deliverables
- Project roadmap with clear milestones
- Detailed task breakdown structure
- Resource allocation plan
- Risk assessment with mitigation strategies
- Timeline with dependencies and buffers`,
        context_adaptations: { jira: 'Integrate with project tickets', git: 'Review project history' },
        requires_approval: false,
        estimated_duration: '30-45 minutes',
        follow_up_commands: ['implement', 'review'],
        usage_count: 0,
        success_rate: 0.0,
        average_completion_time_ms: 0,
        required_permissions: ['read_context', 'write_feedback'],
        user_modified: false,
        created_at: now,
        updated_at: now,
        is_default: true,
        roles: ['planner']
      }
    ];

    // Combine all commands
    const allCommands = [
      ...sharedCommands,
      ...developerCommands,
      ...reviewerCommands,
      ...testerCommands,
      ...plannerCommands
    ];

    return {
      all: {
        name: 'All Commands',
        description: 'All available commands',
        commands: allCommands
      },
      developer: {
        name: 'Developer',
        description: 'Full-stack development commands',
        commands: allCommands.filter(cmd => cmd.roles?.includes('developer'))
      },
      reviewer: {
        name: 'Reviewer',
        description: 'Code review and quality assessment commands',
        commands: allCommands.filter(cmd => cmd.roles?.includes('reviewer'))
      },
      tester: {
        name: 'Tester',
        description: 'Testing and quality assurance commands',
        commands: allCommands.filter(cmd => cmd.roles?.includes('tester'))
      },
      planner: {
        name: 'Planner',
        description: 'Project planning and strategy commands',
        commands: allCommands.filter(cmd => cmd.roles?.includes('planner'))
      }
    };
  }

  private rewriteCommandForClaude(command: Command): string {
    // Rewrite commands to be more formulaic and step-by-step for Claude Code
    const claudeFormattedPrompts: Record<string, string> = {
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

      plan: `# Development Planning Task

## Objective
Create a detailed development plan including task breakdown, timeline, and implementation strategy.

## Step-by-Step Process

### 1. Requirements Analysis
- Review JIRA tickets and specifications
- Identify functional and non-functional requirements
- Clarify acceptance criteria and constraints

### 2. Task Breakdown
- Break down work into manageable tasks
- Identify dependencies between tasks
- Estimate effort for each task

### 3. Technical Planning
- Design technical approach and architecture
- Identify required tools and technologies
- Plan testing and deployment strategy

### 4. Timeline Creation
- Create realistic timeline with milestones
- Account for testing, review, and deployment time
- Include buffer time for unexpected issues

### 5. Risk Assessment
- Identify potential risks and blockers
- Plan mitigation strategies
- Define escalation procedures

## Expected Deliverables
- **Task Breakdown**: Detailed work breakdown structure
- **Timeline**: Project timeline with milestones
- **Technical Design**: Architecture and implementation approach
- **Risk Analysis**: Identified risks with mitigation plans
- **Success Metrics**: How to measure project success`,

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
- Ensure backward compatibility unless specifically noted`,

      debug: `# Debug Investigation Task

## Objective
Systematically investigate and resolve the reported issue.

## Step-by-Step Process

### 1. Issue Reproduction
- Reproduce the issue in the development environment
- Document exact steps to reproduce
- Gather error messages and stack traces

### 2. Root Cause Analysis
- Use debugging tools to trace the issue
- Check logs for relevant error messages
- Identify the source of the problem

### 3. Impact Assessment
- Determine the scope and severity of the issue
- Identify affected users or functionality
- Assess urgency and priority

### 4. Solution Development
- Design fix that addresses root cause
- Consider multiple solution approaches
- Evaluate trade-offs and side effects

### 5. Fix Implementation
- Implement the fix with appropriate testing
- Ensure fix doesn't introduce new issues
- Document the solution for future reference

## Expected Deliverables
- **Problem Analysis**: Clear description of root cause
- **Solution Design**: Detailed fix approach
- **Implementation**: Working fix with tests
- **Documentation**: Updated documentation and troubleshooting guide

## Debugging Tools to Use
- Browser developer tools
- Application logs and monitoring
- Database query analysis
- Network traffic inspection`
    };

    return claudeFormattedPrompts[command.id] || command.base_prompt;
  }
}

export default CommandManager;