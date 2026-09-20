import React, { useState } from 'react';
import { Download, Heart, Maximize2, Share2 } from 'lucide-react';
import { Button } from '../ui/button';

export function CustomerGallery({ assets = [], studioBranding = {} }) {
  const [selectedAsset, setSelectedAsset] = useState(null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="group relative aspect-[3/2] overflow-hidden rounded-lg bg-surface-2 border border-border cursor-pointer shadow-sm hover:shadow-md transition-all"
            onClick={() => setSelectedAsset(asset)}
          >
            <img
              src={asset.thumbnailUrl || '/placeholder-photo.jpg'}
              alt={asset.filename}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3 text-white">
              <span className="text-xs font-medium truncate max-w-[120px]">{asset.filename}</span>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // toggle favorite
                  }}
                  className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 transition-colors"
                >
                  <Heart className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // download asset
                  }}
                  className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {assets.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
          <p className="text-muted text-sm">No photos uploaded to this gallery yet.</p>
        </div>
      )}
    </div>
  );
}
