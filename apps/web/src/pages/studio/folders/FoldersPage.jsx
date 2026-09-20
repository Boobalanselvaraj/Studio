import React, { useState } from 'react';
import { FolderTree } from '../../../components/folder-tree/FolderTree';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { UploadCloud, Plus, Image as ImageIcon } from 'lucide-react';

export function FoldersPage() {
  const [tree] = useState([
    {
      id: 'root-2026',
      name: '2026 Season',
      children: [
        {
          id: 'weddings',
          name: 'Weddings',
          children: [
            {
              id: 'smith-wedding',
              name: 'Smith-Jones Wedding',
              children: [
                { id: 'ceremony', name: 'Ceremony RAWs', children: [] },
                { id: 'reception', name: 'Reception & Party', children: [] },
              ],
            },
          ],
        },
        {
          id: 'portraits',
          name: 'Portraits & Family',
          children: [
            { id: 'david-family', name: 'David Family Session', children: [] },
          ],
        },
      ],
    },
  ]);

  const [selectedFolder, setSelectedFolder] = useState(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Studio Folder Organization</h2>
          <p className="text-sm text-muted">Self-referencing tree structure. Structure albums, events, and assets your way.</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Subfolder
          </Button>
          <Button className="flex items-center gap-2">
            <UploadCloud className="w-4 h-4" /> Upload Media
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <FolderTree
            tree={tree}
            selectedFolderId={selectedFolder?.id}
            onSelectFolder={(node) => setSelectedFolder(node)}
            onCreateFolder={() => null}
          />
        </div>

        <div className="md:col-span-3">
          <Card className="min-h-[500px]">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>{selectedFolder ? selectedFolder.name : 'Select a folder from the tree'}</span>
                {selectedFolder && <span className="text-xs text-muted font-normal">0 items</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <ImageIcon className="w-12 h-12 text-muted mb-3 stroke-1" />
                <h4 className="font-semibold text-sm">No assets in this directory</h4>
                <p className="text-xs text-muted mt-1 max-w-sm">
                  Drag and drop photo files or upload directly through camera SFTP sync to populate this folder.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
