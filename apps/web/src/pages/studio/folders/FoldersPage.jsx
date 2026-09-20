import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Folder,
  Plus,
  ArrowUpRight,
  Image,
  Search,
  Trash2,
  ChevronRight,
  Loader2,
  FolderTree as FolderTreeIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeading, Photo } from '../../../components/workspace/shared';
import { photos } from '../../../data/workspace';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { foldersApi } from '../../../api/services';
import { useAuthStore } from '../../../stores/authStore';

export function FoldersPage() {
  const currentStudio = useAuthStore((s) => s.currentStudio);

  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState('#3B82F6');
  const [parentFolderId, setParentFolderId] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const loadTree = async () => {
    try {
      setLoading(true);
      const data = await foldersApi.getTree();
      if (Array.isArray(data)) {
        setTree(data);
      }
    } catch (err) {
      console.warn('Folders tree load fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, [currentStudio?.id]);

  const flattenFolders = (nodes) => {
    let result = [];
    nodes.forEach((n) => {
      result.push(n);
      if (n.children && n.children.length > 0) {
        result = result.concat(flattenFolders(n.children));
      }
    });
    return result;
  };

  const allFolders = flattenFolders(tree);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    try {
      setBusy(true);
      await foldersApi.create({
        name: folderName.trim(),
        color: folderColor,
        parent_folder_id: parentFolderId || undefined,
      });

      setFolderName('');
      setParentFolderId('');
      setOpenModal(false);
      loadTree();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create folder');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (folderId) => {
    if (!window.confirm('Are you sure you want to delete this folder?')) return;
    try {
      await foldersApi.delete(folderId);
      if (selectedFolder?.id === folderId) {
        setSelectedFolder(null);
      }
      loadTree();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete folder');
    }
  };

  const activeDisplayFolders = selectedFolder
    ? selectedFolder.children || []
    : tree;

  const filteredFolders = activeDisplayFolders.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="EVERY FRAME IN ITS PLACE"
        title="Your creative library"
        description="A little organization. A lot more room for inspiration."
      >
        <Button onClick={() => setOpenModal(true)}>
          <Plus size={16} />
          New folder
        </Button>
      </PageHeading>

      <div className="filter-toolbar">
        <div className="library-tabs">
          <button
            className={!selectedFolder ? 'selected' : ''}
            onClick={() => setSelectedFolder(null)}
          >
            All folders <span>{allFolders.length}</span>
          </button>
          {selectedFolder && (
            <span className="flex items-center gap-1">
              / <strong>{selectedFolder.name}</strong>
            </span>
          )}
        </div>

        <label className="inline-search">
          <Search size={16} />
          <input
            aria-label="Search collections"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a folder or collection…"
          />
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted">
          <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
          <span>Loading studio folders…</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Breadcrumb back navigation if in a subfolder */}
          {selectedFolder && (
            <div className="flex items-center justify-between panel p-4">
              <div className="flex items-center gap-2">
                <button
                  className="text-link text-sm"
                  onClick={() => setSelectedFolder(null)}
                >
                  Root
                </button>
                <ChevronRight size={14} className="text-muted" />
                <span className="font-semibold">{selectedFolder.name}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-red-500 hover:text-red-600"
                onClick={() => handleDelete(selectedFolder.id)}
              >
                <Trash2 size={14} className="mr-1" /> Delete Folder
              </Button>
            </div>
          )}

          {/* Folder Grid */}
          <div className="library-grid">
            {filteredFolders.map((f) => {
              const subCount = f.children?.length || 0;
              const itemsCount = f.folder_items?.length || 0;

              return (
                <div
                  className="library-folder panel text-left cursor-pointer relative group"
                  key={f.id}
                  onClick={() => setSelectedFolder(f)}
                >
                  <div
                    className="library-folder-cover"
                    style={{ borderTop: `3px solid ${f.color || '#3B82F6'}` }}
                  >
                    <Photo src={photos.landscape} alt={f.name} />
                    <span>
                      <FolderOpen size={18} />
                    </span>
                  </div>
                  <div className="library-folder-info">
                    <h2>
                      {f.name}
                      <ArrowUpRight size={16} />
                    </h2>
                    <p>
                      {subCount} subfolders · {itemsCount} items
                    </p>
                    <small style={{ color: f.color || 'var(--brand-primary)' }}>
                      ● Studio Directory
                    </small>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredFolders.length === 0 && (
            <div className="empty-state py-12">
              <Folder size={32} className="text-muted mb-2" />
              <h2>No folders in this directory</h2>
              <p className="text-sm text-muted mb-4">
                Create a folder to organize your shoots, assets, and albums.
              </p>
              <Button onClick={() => setOpenModal(true)}>
                <Plus size={16} /> New folder
              </Button>
            </div>
          )}

          {selectedFolder && (
            <section className="panel p-6 mt-6">
              <div className="panel-heading p-0 mb-4">
                <div>
                  <h2>Folder details: {selectedFolder.name}</h2>
                  <p className="text-xs text-muted">
                    Created on {new Date(selectedFolder.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="neutral-tag">Studio Storage</span>
              </div>

              <div className="library-photo-grid">
                {[photos.wedding, photos.portrait, photos.landscape].map((url, i) => (
                  <Photo key={i} src={url} alt={`${selectedFolder.name} frame ${i + 1}`} />
                ))}
              </div>

              <div className="mt-6 flex justify-between items-center gap-4">
                <p className="text-xs text-muted">
                  Organized under studio-managed storage.
                </p>
                <Link className="text-link" to="/customer/galleries">
                  Client gallery preview
                  <ArrowUpRight size={15} />
                </Link>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create Folder Modal */}
      <Modal
        open={openModal}
        onOpenChange={setOpenModal}
        title="A new home for your work"
        description="Create a directory in your studio storage hierarchy."
      >
        <form className="form-stack" onSubmit={handleCreate}>
          <label>
            Folder name
            <input
              required
              maxLength={80}
              placeholder="e.g. 2026 Weddings"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
            />
          </label>

          <label>
            Parent Folder (optional)
            <select
              value={parentFolderId}
              onChange={(e) => setParentFolderId(e.target.value)}
            >
              <option value="">Root (No Parent)</option>
              {allFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Folder Accent Color
            <div className="brand-color-input">
              <input
                type="color"
                value={folderColor}
                onChange={(e) => setFolderColor(e.target.value)}
              />
              <input
                type="text"
                value={folderColor}
                onChange={(e) => setFolderColor(e.target.value)}
                pattern="#[0-9a-fA-F]{6}"
              />
            </div>
          </label>

          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpenModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : 'Create folder'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
