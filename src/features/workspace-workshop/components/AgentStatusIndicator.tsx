/**
 * Agent Status Indicator Component
 * 
 * Shows agent status with color-coded indicators and count
 */

'use client';

interface AgentStatusIndicatorProps {
  status: 'active' | 'idle' | 'offline';
  count: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function AgentStatusIndicator({ 
  status, 
  count, 
  size = 'md', 
  showLabel = false 
}: AgentStatusIndicatorProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return {
          color: '#10b981', // green-500
          bgColor: 'rgba(16, 185, 129, 0.1)',
          icon: '🤖',
          label: 'Active',
          pulse: true,
        };
      case 'idle':
        return {
          color: '#f59e0b', // amber-500
          bgColor: 'rgba(245, 158, 11, 0.1)',
          icon: '🤖',
          label: 'Idle',
          pulse: false,
        };
      case 'offline':
        return {
          color: '#6b7280', // gray-500
          bgColor: 'rgba(107, 114, 128, 0.1)',
          icon: '🤖',
          label: 'Offline',
          pulse: false,
        };
      default:
        return {
          color: '#6b7280',
          bgColor: 'rgba(107, 114, 128, 0.1)',
          icon: '🤖',
          label: 'Unknown',
          pulse: false,
        };
    }
  };

  const sizeConfig = {
    sm: {
      containerClass: 'text-xs',
      iconSize: '12px',
      dotSize: '6px',
      padding: 'px-1.5 py-0.5',
    },
    md: {
      containerClass: 'text-sm',
      iconSize: '14px',
      dotSize: '8px',
      padding: 'px-2 py-1',
    },
    lg: {
      containerClass: 'text-base',
      iconSize: '16px',
      dotSize: '10px',
      padding: 'px-3 py-1.5',
    },
  };

  const statusConfig = getStatusConfig(status);
  const sizes = sizeConfig[size];

  return (
    <div 
      className={`inline-flex items-center gap-1.5 rounded-full ${sizes.containerClass} ${sizes.padding}`}
      style={{
        backgroundColor: statusConfig.bgColor,
        color: statusConfig.color,
      }}
    >
      {/* Status Dot */}
      <div className="flex items-center gap-1">
        <div 
          className={`rounded-full ${statusConfig.pulse ? 'animate-pulse' : ''}`}
          style={{
            width: sizes.dotSize,
            height: sizes.dotSize,
            backgroundColor: statusConfig.color,
          }}
        />
        
        {/* Agent Icon */}
        <span style={{ fontSize: sizes.iconSize }}>
          {statusConfig.icon}
        </span>
        
        {/* Agent Count */}
        <span className="font-medium">
          {count}
        </span>
      </div>

      {/* Optional Label */}
      {showLabel && (
        <span className="font-medium">
          {statusConfig.label}
        </span>
      )}
    </div>
  );
}