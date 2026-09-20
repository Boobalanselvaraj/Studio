import React, { useState } from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronDown, Plus, Image, Calendar } from 'lucide-react';
import { Button } from '../ui/button';

export function FolderTreeNode({ node, onSelect, selectedId }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div className="select-none">
      <div
        onClick={() => onSelect(node)}
        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
          isSelected ? 'bg-brand-primary text-brand-primary-foreground' : 'hover:bg-surface-2 text-foreground'
        }`}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="p-0.5 hover:bg-black/10 rounded"
          >
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {isOpen ? (
          <FolderOpen className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-brand-primary'}`} />
        ) : (
          <Folder className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-brand-primary'}`} />
        )}

        <span className="font-medium truncate">{node.name}</span>
      </div>

      {isOpen && hasChildren && (
        <div className="pl-4 ml-2 border-l border-border mt-1 space-y-1">
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTree({ tree = [], onSelectFolder, selectedFolderId, onCreateFolder }) {
  return (
    <div className="w-full bg-surface border border-border rounded-lg p-3">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-border">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">Folder Explorer</span>
        <Button size="sm" variant="ghost" onClick={onCreateFolder} className="h-7 px-2">
          <Plus className="w-4 h-4 mr-1" /> New
        </Button>
      </div>

      <div className="space-y-1">
        {tree.map((node) => (
          <FolderTreeNode
            key={node.id}
            node={node}
            onSelect={onSelectFolder}
            selectedId={selectedFolderId}
          />
        ))}
        {tree.length === 0 && (
          <div className="text-center py-6 text-xs text-muted">
            No folders created yet
          </div>
        )}
      </div>
    </div>
  );
}
