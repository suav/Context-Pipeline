# Lazy Loading Framework Documentation

## 🎯 Overview

The lazy loading framework provides a comprehensive set of utilities for implementing progressive component loading, viewport-based rendering, and data fetching optimization. This framework is designed to reduce initial bundle size and improve application startup performance.

## 📦 Framework Components

### 1. Core Loading Utilities (`src/lib/loading-utils.tsx`)

#### Lazy Component Creation
```typescript
export const createLazyComponent = <T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> => {
  return lazy(importFn);
};
```

**Usage:**
```typescript
// Create lazy components
const LazyChart = createLazyComponent(() => import('./Chart'));
const LazyDashboard = createLazyComponent(() => import('./Dashboard'));

// Use with Suspense
<Suspense fallback={<div>Loading chart...</div>}>
  <LazyChart data={chartData} />
</Suspense>
```

#### Progressive Data Loading Hook
```typescript
export const useProgressiveData = <T>(
  fetchFn: () => Promise<T>,
  dependencies: React.DependencyList = []
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
} => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    fetchFn()
      .then((result) => {
        if (mounted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, dependencies);

  return { data, loading, error };
};
```

**Usage:**
```typescript
function DataComponent() {
  const { data, loading, error } = useProgressiveData(
    () => fetch('/api/heavy-data').then(r => r.json()),
    [userId] // Dependencies
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!data) return null;

  return <DataDisplay data={data} />;
}
```

#### Viewport Observer Hook
```typescript
export const useInViewport = (
  elementRef: RefObject<HTMLElement>,
  options: IntersectionObserverInit = {}
): boolean => {
  const [isInViewport, setIsInViewport] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [elementRef, options]);

  return isInViewport;
};
```

**Usage:**
```typescript
function ViewportSensitiveComponent() {
  const elementRef = useRef<HTMLDivElement>(null);
  const isVisible = useInViewport(elementRef);

  return (
    <div ref={elementRef}>
      {isVisible ? (
        <ExpensiveComponent />
      ) : (
        <div style={{ height: '200px' }}>Placeholder</div>
      )}
    </div>
  );
}
```

### 2. Viewport Loader Component (`src/components/ViewportLoader.tsx`)

```typescript
interface ViewportLoaderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  threshold?: number | number[];
  once?: boolean;
}

export const ViewportLoader: React.FC<ViewportLoaderProps> = ({
  children,
  fallback = <div>Loading...</div>,
  rootMargin = '50px',
  threshold = 0.1,
  once = true,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isIntersecting = entry.isIntersecting;
        setIsVisible(isIntersecting);
        
        if (isIntersecting && !hasBeenVisible) {
          setHasBeenVisible(true);
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold, hasBeenVisible]);

  const shouldRender = once ? hasBeenVisible : isVisible;

  return (
    <div ref={elementRef}>
      {shouldRender ? children : fallback}
    </div>
  );
};
```

**Usage:**
```typescript
function App() {
  return (
    <div>
      <Header />
      
      {/* Load hero section immediately */}
      <HeroSection />
      
      {/* Load features when in viewport */}
      <ViewportLoader fallback={<SkeletonLoader />}>
        <FeaturesSection />
      </ViewportLoader>
      
      {/* Load heavy components only when needed */}
      <ViewportLoader 
        fallback={<div className="h-96 bg-gray-100 animate-pulse" />}
        rootMargin="100px"
      >
        <ChartsSection />
      </ViewportLoader>
    </div>
  );
}
```

## 🚀 Implementation Patterns

### 1. Component-Level Lazy Loading

#### Heavy Components
```typescript
// Heavy dashboard component
const LazyDashboard = createLazyComponent(
  () => import('@/components/Dashboard')
);

function App() {
  const [showDashboard, setShowDashboard] = useState(false);

  return (
    <div>
      <button onClick={() => setShowDashboard(true)}>
        Load Dashboard
      </button>
      
      {showDashboard && (
        <Suspense fallback={<DashboardSkeleton />}>
          <LazyDashboard />
        </Suspense>
      )}
    </div>
  );
}
```

#### Modal Components
```typescript
// Load modal only when needed
const LazyModal = createLazyComponent(
  () => import('@/components/Modal')
);

function Page() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setIsModalOpen(true)}>
        Open Modal
      </button>
      
      {isModalOpen && (
        <Suspense fallback={<div>Loading modal...</div>}>
          <LazyModal onClose={() => setIsModalOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
```

### 2. Route-Level Code Splitting

```typescript
// Route-level lazy loading
const LazyWorkspacePage = createLazyComponent(
  () => import('@/app/workspace/[id]/page')
);

const LazyAgentPage = createLazyComponent(
  () => import('@/app/agent/[id]/page')
);

// Router configuration
const routes = [
  {
    path: '/workspace/:id',
    component: LazyWorkspacePage,
  },
  {
    path: '/agent/:id',
    component: LazyAgentPage,
  },
];
```

### 3. Data-Driven Lazy Loading

```typescript
// Load components based on data
function DynamicContentLoader({ contentType, contentId }: {
  contentType: string;
  contentId: string;
}) {
  const componentMap = {
    chart: () => import('@/components/Chart'),
    table: () => import('@/components/Table'),
    form: () => import('@/components/Form'),
  };

  const LazyComponent = useMemo(() => {
    const importFn = componentMap[contentType];
    return importFn ? createLazyComponent(importFn) : null;
  }, [contentType]);

  if (!LazyComponent) {
    return <div>Unknown content type: {contentType}</div>;
  }

  return (
    <Suspense fallback={<ComponentSkeleton type={contentType} />}>
      <LazyComponent id={contentId} />
    </Suspense>
  );
}
```

### 4. Progressive Enhancement

```typescript
// Progressive enhancement pattern
function ProgressiveFeature() {
  const [enhanced, setEnhanced] = useState(false);
  
  // Basic functionality loads immediately
  const basicComponent = <BasicComponent />;
  
  // Enhanced features load later
  const LazyEnhancedComponent = createLazyComponent(
    () => import('@/components/EnhancedComponent')
  );

  return (
    <div>
      {basicComponent}
      
      <button onClick={() => setEnhanced(true)}>
        Enable Enhanced Features
      </button>
      
      {enhanced && (
        <Suspense fallback={<div>Loading enhanced features...</div>}>
          <LazyEnhancedComponent />
        </Suspense>
      )}
    </div>
  );
}
```

## 🎨 Loading States and Fallbacks

### 1. Skeleton Loading
```typescript
// Create skeleton components
export const ComponentSkeleton: React.FC<{ type: string }> = ({ type }) => {
  const skeletons = {
    chart: (
      <div className="animate-pulse">
        <div className="h-64 bg-gray-200 rounded"></div>
        <div className="mt-4 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    ),
    table: (
      <div className="animate-pulse space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded"></div>
        ))}
      </div>
    ),
    form: (
      <div className="animate-pulse space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i}>
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    ),
  };

  return skeletons[type] || <div className="animate-pulse h-32 bg-gray-200 rounded"></div>;
};
```

### 2. Progressive Loading States
```typescript
function ProgressiveLoader({ children }: { children: React.ReactNode }) {
  const [loadingStage, setLoadingStage] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setLoadingStage(1), 500),
      setTimeout(() => setLoadingStage(2), 1000),
      setTimeout(() => setLoadingStage(3), 1500),
    ];

    return () => timers.forEach(clearTimeout);
  }, []);

  const loadingStages = [
    <div>Initializing...</div>,
    <div>Loading components...</div>,
    <div>Preparing data...</div>,
    children,
  ];

  return loadingStages[loadingStage] || loadingStages[0];
}
```

## 📊 Performance Monitoring

### 1. Lazy Loading Metrics
```typescript
// Track lazy loading performance
export class LazyLoadingMonitor {
  private metrics: Array<{
    component: string;
    loadTime: number;
    timestamp: number;
  }> = [];

  measureComponentLoad<T>(
    componentName: string,
    loadFn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    
    return loadFn().then((result) => {
      const loadTime = Date.now() - start;
      
      this.metrics.push({
        component: componentName,
        loadTime,
        timestamp: start,
      });
      
      // Log slow loads
      if (loadTime > 2000) {
        console.warn(`Slow lazy load: ${componentName} took ${loadTime}ms`);
      }
      
      return result;
    });
  }

  getMetrics() {
    return this.metrics;
  }

  getAverageLoadTime(componentName?: string) {
    const filtered = componentName 
      ? this.metrics.filter(m => m.component === componentName)
      : this.metrics;
    
    if (filtered.length === 0) return 0;
    
    return filtered.reduce((sum, m) => sum + m.loadTime, 0) / filtered.length;
  }
}

export const lazyLoadMonitor = new LazyLoadingMonitor();
```

### 2. Viewport Performance
```typescript
// Monitor viewport intersection performance
export const useViewportMetrics = (elementRef: RefObject<HTMLElement>) => {
  const [metrics, setMetrics] = useState({
    timeToVisible: 0,
    intersectionRatio: 0,
    isIntersecting: false,
  });

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const startTime = Date.now();
    const observer = new IntersectionObserver(
      ([entry]) => {
        setMetrics({
          timeToVisible: entry.isIntersecting ? Date.now() - startTime : 0,
          intersectionRatio: entry.intersectionRatio,
          isIntersecting: entry.isIntersecting,
        });
      },
      { threshold: [0, 0.1, 0.5, 1] }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef]);

  return metrics;
};
```

## 🛠 Advanced Patterns

### 1. Conditional Lazy Loading
```typescript
// Load different components based on conditions
function ConditionalLazyLoader({ 
  userType, 
  feature 
}: {
  userType: 'admin' | 'user';
  feature: string;
}) {
  const componentMap = {
    admin: {
      dashboard: () => import('@/components/AdminDashboard'),
      settings: () => import('@/components/AdminSettings'),
    },
    user: {
      dashboard: () => import('@/components/UserDashboard'),
      settings: () => import('@/components/UserSettings'),
    },
  };

  const importFn = componentMap[userType]?.[feature];
  if (!importFn) return <div>Feature not available</div>;

  const LazyComponent = createLazyComponent(importFn);

  return (
    <Suspense fallback={<FeatureSkeleton feature={feature} userType={userType} />}>
      <LazyComponent />
    </Suspense>
  );
}
```

### 2. Preloading Strategy
```typescript
// Preload components on hover or other triggers
export const usePreloadComponent = (
  importFn: () => Promise<any>
) => {
  const [preloaded, setPreloaded] = useState(false);

  const preload = useCallback(() => {
    if (!preloaded) {
      importFn().then(() => setPreloaded(true));
    }
  }, [importFn, preloaded]);

  return { preload, preloaded };
};

function PreloadableButton({ onClick }: { onClick: () => void }) {
  const { preload } = usePreloadComponent(
    () => import('@/components/HeavyModal')
  );

  return (
    <button
      onClick={onClick}
      onMouseEnter={preload}  // Preload on hover
      onFocus={preload}       // Preload on focus
    >
      Open Heavy Modal
    </button>
  );
}
```

### 3. Error Boundaries for Lazy Components
```typescript
class LazyComponentErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy component failed to load:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 border border-red-200 rounded bg-red-50">
          <h3 className="text-red-800 font-medium">Component failed to load</h3>
          <p className="text-red-600 text-sm mt-2">
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## 📋 Best Practices

### 1. Component Design
- **Single Responsibility**: Keep lazy components focused on one feature
- **Clear Boundaries**: Define clear interfaces between lazy and eager components
- **Fallback Strategy**: Always provide meaningful loading states
- **Error Handling**: Implement robust error boundaries

### 2. Performance Optimization
- **Bundle Size**: Monitor lazy chunk sizes
- **Load Timing**: Optimize when components are loaded
- **Preloading**: Use strategic preloading for better UX
- **Caching**: Leverage browser caching for lazy chunks

### 3. User Experience
- **Loading States**: Provide smooth loading transitions
- **Skeleton Loading**: Use skeleton screens for better perceived performance
- **Progressive Enhancement**: Start with basic functionality
- **Accessibility**: Ensure loading states are accessible

## 🔮 Future Enhancements

### 1. Intelligent Preloading
```typescript
// AI-powered preloading based on user behavior
export const useIntelligentPreloading = () => {
  const [userBehavior] = useUserBehaviorTracking();
  
  useEffect(() => {
    // Analyze user patterns and preload likely components
    if (userBehavior.likelyToUseFeature('dashboard')) {
      import('@/components/Dashboard');
    }
  }, [userBehavior]);
};
```

### 2. Network-Aware Loading
```typescript
// Adjust loading strategy based on network conditions
export const useNetworkAwareLoading = () => {
  const [networkInfo] = useNetworkInfo();
  
  return {
    shouldLazyLoad: networkInfo.effectiveType === '4g',
    chunkSize: networkInfo.downlink > 10 ? 'large' : 'small',
  };
};
```

## ✅ Implementation Status

The lazy loading framework has been successfully implemented with:
- ✅ **Core utilities** created and tested
- ✅ **Viewport observer** integration working
- ✅ **Progressive data loading** patterns established
- ✅ **Component examples** implemented and verified
- ✅ **Error handling** and fallback strategies in place

This framework provides a solid foundation for implementing lazy loading across the application, with room for future enhancements based on specific use cases and performance requirements.