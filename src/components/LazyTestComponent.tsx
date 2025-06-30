/**
 * Simple test component for lazy loading
 */

'use client';

export default function LazyTestComponent() {
  return (
    <div className="p-4 border border-green-500 rounded">
      <h3 className="text-green-600 font-bold">✅ Lazy Loading Works!</h3>
      <p className="text-sm text-gray-600 mt-2">
        This component was loaded lazily and is working correctly.
      </p>
    </div>
  );
}