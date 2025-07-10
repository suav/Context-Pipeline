export interface Command {
  id: string;
  name: string;                   // Display name (e.g., "Investigate")
  keyword: string;               // Dropdown keyword (e.g., "investigate")
  category: string;              // "analysis", "development", "testing", etc.
  // Context-aware prompting
  base_prompt: string;           // Core command prompt
  context_adaptations: {
    [context_type: string]: string;  // Additional context for jira, git, etc.
  };
  // Command configuration
  requires_approval: boolean;
  estimated_duration: string;    // "5-10 minutes", "30+ minutes"
  follow_up_commands: string[];  // Suggested next commands
  // Usage tracking
  usage_count: number;
  success_rate: number;
  average_completion_time_ms: number;
  // Permissions required
  required_permissions: string[];
  // User customization
  user_modified: boolean;
  custom_prompt_additions?: string[];
}
export interface CommandCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  commands: string[];            // Command IDs in this category
  recommended_for: string[];     // Context types this category works well for
}
export interface CommandLibrary {
  categories: CommandCategory[];
  commands: Command[];
  startup_commands: string[];
  quick_access: string[];
}

// Startup Commands (for new agents)
export const STARTUP_COMMANDS: Command[] = [
  {
    id: "investigate",
    name: "Investigate",
    keyword: "investigate",
    category: "analysis",
    base_prompt: "Please investigate this workspace and provide an overview of the codebase, current issues, and recommendations for next steps.",
    context_adaptations: {
      jira: "Focus on the JIRA tickets in context and their relationship to the codebase.",
      git: "Pay special attention to recent commits and changes in the repository.",
      email: "Consider the email context and any requests or issues mentioned."
    },
    requires_approval: false,
    estimated_duration: "5-10 minutes",
    follow_up_commands: ["analyze", "debug", "plan"],
    usage_count: 0,
    success_rate: 0.95,
    average_completion_time_ms: 300000,
    required_permissions: ["read_context", "read_target"],
    user_modified: false
  },
  {
    id: "analyze",
    name: "Analyze Code",
    keyword: "analyze",
    category: "analysis",
    base_prompt: "Perform a comprehensive code analysis of this workspace, including architecture review, code quality assessment, and potential improvements.",
    context_adaptations: {
      jira: "Focus analysis on areas related to the current tickets.",
      git: "Analyze recent changes and their impact on the codebase.",
      files: "Pay attention to the specific files and components mentioned in context."
    },
    requires_approval: false,
    estimated_duration: "10-15 minutes",
    follow_up_commands: ["refactor", "test", "document"],
    usage_count: 0,
    success_rate: 0.92,
    average_completion_time_ms: 600000,
    required_permissions: ["read_context", "read_target"],
    user_modified: false
  },
  {
    id: "plan",
    name: "Create Plan",
    keyword: "plan",
    category: "development",
    base_prompt: "Create a detailed development plan for this workspace, including task breakdown, timeline, and implementation strategy.",
    context_adaptations: {
      jira: "Base the plan on the JIRA tickets and their priorities.",
      git: "Consider the current state of the repository and recent development.",
      email: "Include any requirements or deadlines mentioned in email context."
    },
    requires_approval: false,
    estimated_duration: "15-20 minutes",
    follow_up_commands: ["implement", "estimate", "research"],
    usage_count: 0,
    success_rate: 0.89,
    average_completion_time_ms: 900000,
    required_permissions: ["read_context", "read_target"],
    user_modified: false
  },
  {
    id: "setup",
    name: "Setup Environment",
    keyword: "setup",
    category: "development",
    base_prompt: "Help set up the development environment for this workspace, including dependencies, configuration, and initial setup steps.",
    context_adaptations: {
      git: "Focus on repository-specific setup requirements.",
      files: "Use any setup documentation or config files in context."
    },
    requires_approval: true,
    estimated_duration: "20-30 minutes",
    follow_up_commands: ["test", "build", "validate"],
    usage_count: 0,
    success_rate: 0.87,
    average_completion_time_ms: 1200000,
    required_permissions: ["read_context", "read_target", "write_target"],
    user_modified: false
  },
  {
    id: "security_audit",
    name: "Security Audit",
    keyword: "security_audit", 
    category: "analysis",
    base_prompt: "Perform a comprehensive security audit of this codebase, identifying potential vulnerabilities, security best practices violations, and recommendations for improvement.",
    context_adaptations: {
      git: "Focus on code patterns, dependency security, and authentication mechanisms.",
      jira: "Consider security requirements mentioned in tickets.",
      files: "Review configuration files for security misconfigurations."
    },
    requires_approval: false,
    estimated_duration: "15-25 minutes",
    follow_up_commands: ["implement", "document", "test"],
    usage_count: 0,
    success_rate: 0.92,
    average_completion_time_ms: 1200000,
    required_permissions: ["read_context", "read_target"],
    user_modified: false
  }
];
// Reply Commands (for ongoing conversations)
export const REPLY_COMMANDS: Command[] = [
  {
    id: "implement",
    name: "Implement",
    keyword: "implement",
    category: "development",
    base_prompt: "Implement the requested feature or fix based on our previous discussion.",
    context_adaptations: {
      jira: "Implement according to the JIRA ticket requirements.",
      git: "Consider the current codebase structure and patterns."
    },
    requires_approval: true,
    estimated_duration: "30+ minutes",
    follow_up_commands: ["test", "review", "document"],
    usage_count: 0,
    success_rate: 0.84,
    average_completion_time_ms: 1800000,
    required_permissions: ["read_context", "read_target", "write_target"],
    user_modified: false
  },
  {
    id: "debug",
    name: "Debug Issue",
    keyword: "debug",
    category: "analysis",
    base_prompt: "Debug the issue we've been discussing and provide a solution.",
    context_adaptations: {
      jira: "Focus on the specific bug described in the ticket.",
      git: "Look at recent changes that might have introduced the issue."
    },
    requires_approval: false,
    estimated_duration: "15-25 minutes",
    follow_up_commands: ["fix", "test", "validate"],
    usage_count: 0,
    success_rate: 0.91,
    average_completion_time_ms: 1000000,
    required_permissions: ["read_context", "read_target"],
    user_modified: false
  },
  {
    id: "review",
    name: "Review Code",
    keyword: "review",
    category: "analysis",
    base_prompt: "Review the code changes or implementation we've been working on.",
    context_adaptations: {
      git: "Focus on the specific commits or changes mentioned.",
      files: "Review the particular files or components discussed."
    },
    requires_approval: false,
    estimated_duration: "10-15 minutes",
    follow_up_commands: ["refactor", "optimize", "document"],
    usage_count: 0,
    success_rate: 0.94,
    average_completion_time_ms: 800000,
    required_permissions: ["read_context", "read_target"],
    user_modified: false
  },
  {
    id: "test",
    name: "Create Tests",
    keyword: "test",
    category: "testing",
    base_prompt: "Create comprehensive tests for the feature or fix we've been working on.",
    context_adaptations: {
      jira: "Test according to the acceptance criteria in the ticket.",
      git: "Test the specific changes made in recent commits."
    },
    requires_approval: true,
    estimated_duration: "20-30 minutes",
    follow_up_commands: ["validate", "coverage", "integration"],
    usage_count: 0,
    success_rate: 0.88,
    average_completion_time_ms: 1400000,
    required_permissions: ["read_context", "read_target", "write_target"],
    user_modified: false
  },
  {
    id: "explain",
    name: "Explain",
    keyword: "explain",
    category: "analysis",
    base_prompt: "Explain the code, concept, or solution in detail.",
    context_adaptations: {
      files: "Focus on explaining the specific files or code sections.",
      jira: "Explain in the context of the current ticket requirements."
    },
    requires_approval: false,
    estimated_duration: "5-10 minutes",
    follow_up_commands: ["document", "clarify", "example"],
    usage_count: 0,
    success_rate: 0.96,
    average_completion_time_ms: 400000,
    required_permissions: ["read_context", "read_target"],
    user_modified: false
  },
  {
    id: "continue",
    name: "Continue",
    keyword: "continue",
    category: "development",
    base_prompt: "Continue with the previous task or pick up where we left off.",
    context_adaptations: {
      jira: "Continue based on the current ticket progress.",
      git: "Continue from the last commit or change."
    },
    requires_approval: false,
    estimated_duration: "Variable",
    follow_up_commands: ["complete", "review", "test"],
    usage_count: 0,
    success_rate: 0.90,
    average_completion_time_ms: 600000,
    required_permissions: ["read_context", "read_target"],
    user_modified: false
  },
  {
    id: "optimize_performance",
    name: "Optimize Performance",
    keyword: "optimize",
    category: "development",
    base_prompt: "Analyze and optimize the performance of the code we've been working on, identifying bottlenecks and implementing improvements.",
    context_adaptations: {
      git: "Consider performance patterns in the existing codebase.",
      jira: "Focus on performance requirements mentioned in tickets."
    },
    requires_approval: true,
    estimated_duration: "25-35 minutes",
    follow_up_commands: ["test", "benchmark", "review"],
    usage_count: 0,
    success_rate: 0.85,
    average_completion_time_ms: 1600000,
    required_permissions: ["read_context", "read_target", "write_target"],
    user_modified: false
  }
];
// Command Categories
export const COMMAND_CATEGORIES: CommandCategory[] = [
  {
    id: "analysis",
    name: "Analysis",
    description: "Commands for analyzing code, investigating issues, and understanding the workspace",
    icon: "🔍",
    commands: ["investigate", "analyze", "debug", "review", "explain"],
    recommended_for: ["jira", "git", "files"]
  },
  {
    id: "development",
    name: "Development",
    description: "Commands for implementing features, planning work, and making changes",
    icon: "⚡",
    commands: ["plan", "setup", "implement", "continue"],
    recommended_for: ["jira", "git"]
  },
  {
    id: "testing",
    name: "Testing",
    description: "Commands for creating tests, validation, and quality assurance",
    icon: "🧪",
    commands: ["test"],
    recommended_for: ["jira", "git", "files"]
  }
];
// Build the complete command library
export const COMMAND_LIBRARY: CommandLibrary = {
  commands: [...STARTUP_COMMANDS, ...REPLY_COMMANDS].reduce((acc, cmd) => {
    acc[cmd.id] = cmd;
    return acc;
  }, {} as Record<string, Command>),
  categories: COMMAND_CATEGORIES,
  user_custom_commands: {},
  workspace_command_overrides: {}
};