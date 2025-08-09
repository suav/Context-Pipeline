import React, { useState, useEffect } from 'react';

interface LibraryItem {
  id: string;
  name: string;
  description?: string;
  source: string;
  category?: string;
  tags?: string[];
  content_type?: string;
}

interface LibraryItemSelectorProps {
  onItemSelected: (itemId: string) => void;
  onClose: () => void;
}

export const LibraryItemSelector: React.FC<LibraryItemSelectorProps> = ({ 
  onItemSelected, 
  onClose 
}) => {
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');

  useEffect(() => {
    loadLibraryItems();
  }, []);

  const loadLibraryItems = async () => {
    try {
      setLoading(true);
      
      // Load library items from the context library API
      const response = await fetch('/api/context-workflow/library');
      const result = await response.json();
      
      if (response.ok && result.items) {
        setLibraryItems(result.items);
      } else {
        console.error('Failed to load library items:', result.error);
      }
    } catch (error) {
      console.error('Failed to load library items:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = libraryItems.filter(item => {
    // Search filter
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !item.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Category filter
    if (selectedCategory !== 'all' && item.category !== selectedCategory) {
      return false;
    }

    // Source filter
    if (selectedSource !== 'all' && item.source !== selectedSource) {
      return false;
    }

    return true;
  });

  const categories = Array.from(new Set(libraryItems.map(item => item.category).filter(Boolean)));
  const sources = Array.from(new Set(libraryItems.map(item => item.source)));

  const getSourceIcon = (source: string) => {
    switch (source.toLowerCase()) {
      case 'jira': return '🎯';
      case 'git': return '🔗';
      case 'github': return '🐙';
      case 'file': return '📄';
      case 'email': return '📧';
      default: return '📚';
    }
  };

  const getContentTypeIcon = (contentType: string) => {
    switch (contentType) {
      case 'code': return '💻';
      case 'documentation': return '📖';
      case 'configuration': return '⚙️';
      case 'ticket': return '🎟️';
      case 'repository': return '📁';
      default: return '📄';
    }
  };

  if (loading) {
    return (
      <div className="library-selector-overlay">
        <div className="library-selector-modal">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p>Loading library items...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="library-selector-overlay" onClick={onClose}>
      <div className="library-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Select Library Item</h3>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <div className="modal-filters">
          <div className="filter-row">
            <input
              type="text"
              placeholder="Search library items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="filter-row">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Sources</option>
              {sources.map(source => (
                <option key={source} value={source}>{getSourceIcon(source)} {source}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="modal-content">
          <div className="items-grid">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className="library-item-card"
                onClick={() => onItemSelected(item.id)}
              >
                <div className="item-header">
                  <div className="item-icons">
                    <span className="source-icon">{getSourceIcon(item.source)}</span>
                    <span className="content-icon">{getContentTypeIcon(item.content_type || 'file')}</span>
                  </div>
                  <div className="item-category">{item.category}</div>
                </div>
                
                <h4 className="item-name">{item.name}</h4>
                <p className="item-description">{item.description || 'No description available'}</p>
                
                <div className="item-footer">
                  <span className="item-id">ID: {item.id}</span>
                  <div className="item-tags">
                    {item.tags?.slice(0, 3).map(tag => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                    {item.tags && item.tags.length > 3 && (
                      <span className="tag more">+{item.tags.length - 3}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="empty-state">
              <p>No library items found matching your criteria.</p>
              <p className="empty-hint">Try adjusting your search terms or filters.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <p className="selection-hint">Click on an item to select it for your template</p>
          <button onClick={onClose} className="cancel-button">Cancel</button>
        </div>
      </div>

      <style>{`
        .library-selector-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1200;
          padding: 20px;
        }

        .library-selector-modal {
          background: white;
          border-radius: 12px;
          max-width: 1200px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          width: 100%;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .modal-header h3 {
          margin: 0;
          color: #111827;
          font-size: 18px;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
          padding: 4px;
        }

        .close-button:hover {
          color: #374151;
        }

        .modal-filters {
          padding: 16px 24px;
          border-bottom: 1px solid #e5e7eb;
          background: white;
        }

        .filter-row {
          display: flex;
          gap: 12px;
          margin-bottom: 8px;
        }

        .filter-row:last-child {
          margin-bottom: 0;
        }

        .search-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
        }

        .search-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 1px #3b82f6;
        }

        .filter-select {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          min-width: 150px;
        }

        .modal-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }

        .library-item-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
        }

        .library-item-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          transform: translateY(-1px);
        }

        .item-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .item-icons {
          display: flex;
          gap: 4px;
        }

        .source-icon, .content-icon {
          font-size: 16px;
        }

        .item-category {
          background: #f3f4f6;
          color: #374151;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          text-transform: capitalize;
        }

        .item-name {
          margin: 0 0 8px 0;
          color: #111827;
          font-size: 16px;
          font-weight: 600;
          line-height: 1.3;
        }

        .item-description {
          color: #6b7280;
          font-size: 14px;
          line-height: 1.4;
          margin: 0 0 12px 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .item-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: auto;
        }

        .item-id {
          font-size: 11px;
          color: #9ca3af;
          font-family: monospace;
        }

        .item-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .tag {
          background: #e5e7eb;
          color: #374151;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
        }

        .tag.more {
          background: #3b82f6;
          color: white;
        }

        .modal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .selection-hint {
          color: #6b7280;
          font-size: 14px;
          margin: 0;
        }

        .cancel-button {
          background: #6b7280;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .cancel-button:hover {
          background: #4b5563;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #6b7280;
        }

        .empty-state p {
          margin: 0 0 8px 0;
        }

        .empty-hint {
          font-size: 14px;
          color: #9ca3af;
        }

        .loading-content {
          text-align: center;
          padding: 60px 40px;
          color: #6b7280;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #f3f4f6;
          border-top: 3px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};