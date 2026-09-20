import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Image as ImageIcon, Calendar } from 'lucide-react';

export function CustomerGalleriesPage() {
  const galleries = [
    {
      id: 'smith-wedding-album',
      title: 'Our Wedding Day Highlights',
      shootDate: 'Sep 25, 2026',
      photoCount: 340,
      coverUrl: '/placeholder-photo.jpg'
    },
    {
      id: 'smith-prewedding-album',
      title: 'Sunset Engagement Session',
      shootDate: 'Aug 14, 2026',
      photoCount: 85,
      coverUrl: '/placeholder-photo.jpg'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Your Private Photo Collections</h2>
        <p className="text-sm text-muted">Select an album to browse, mark favorites, and download high-resolution photos.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {galleries.map((g) => (
          <Link key={g.id} to={`/gallery/${g.id}`} className="group block">
            <Card className="overflow-hidden hover:border-brand-primary transition-all shadow-sm">
              <div className="aspect-[16/10] bg-surface-2 flex items-center justify-center relative overflow-hidden">
                <ImageIcon className="w-12 h-12 text-muted stroke-1 group-hover:scale-110 transition-transform" />
                <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                  {g.photoCount} photos
                </span>
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-base text-foreground group-hover:text-brand-primary transition-colors">
                  {g.title}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-muted mt-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{g.shootDate}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
