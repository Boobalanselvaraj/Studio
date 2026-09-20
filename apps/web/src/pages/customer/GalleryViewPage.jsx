import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { CustomerGallery } from '../../components/gallery/CustomerGallery';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Download, Heart } from 'lucide-react';

export function GalleryViewPage() {
  const { albumId } = useParams();

  const assets = [
    { id: '1', filename: 'IMG_001.JPG', thumbnailUrl: null },
    { id: '2', filename: 'IMG_002.JPG', thumbnailUrl: null },
    { id: '3', filename: 'IMG_003.JPG', thumbnailUrl: null },
    { id: '4', filename: 'IMG_004.JPG', thumbnailUrl: null },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link to="/customer/galleries" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground mb-2">
            <ArrowLeft className="w-4 h-4" /> All Collections
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Our Wedding Day Highlights</h2>
          <p className="text-sm text-muted">Photographed on Sep 25, 2026 • 340 High-Res Photos</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" className="flex items-center gap-1.5">
            <Heart className="w-4 h-4" /> My Favorites (0)
          </Button>
          <Button className="flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Download Gallery (.ZIP)
          </Button>
        </div>
      </div>

      <CustomerGallery assets={assets} />
    </div>
  );
}
