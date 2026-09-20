import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { CustomerGallery } from '../../components/gallery/CustomerGallery';
import { photos } from '../../data/workspace';
import { fallbackCollections } from './CustomerGalleriesPage';
import { customerPortalApi } from '../../api/services';

export function GalleryViewPage() {
  const { albumId } = useParams();
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await customerPortalApi.getMyGalleries();
        let found = null;
        if (Array.isArray(data)) {
          found = data.find((g) => g.id === albumId);
        }
        if (!found) {
          found = fallbackCollections.find((g) => g.id === albumId);
        }
        setCollection(found || null);
      } catch (err) {
        setCollection(fallbackCollections.find((g) => g.id === albumId) || null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [albumId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24 text-muted">
        <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
        <span>Loading collection…</span>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="empty-state py-16">
        <h1>Collection not found</h1>
        <p className="mb-4">This collection may not be published or shared yet.</p>
        <Link className="button-outline" to="/customer/galleries">
          Back to collections
        </Link>
      </div>
    );
  }

  const sampleImages =
    albumId === 'smith-wedding-album'
      ? [
          photos.wedding,
          photos.portrait,
          photos.landscape,
          photos.wedding,
          photos.editorial,
          photos.portrait,
        ]
      : [photos.landscape, photos.portrait, photos.landscape, photos.editorial];

  const assets =
    collection.album_assets && collection.album_assets.length > 0
      ? collection.album_assets.map((aa, i) => ({
          id: aa.asset?.id || `${albumId}-${i}`,
          filename: aa.asset?.filename || `Frame ${String(i + 1).padStart(2, '0')}`,
          thumbnailUrl:
            aa.asset?.original_path && aa.asset.original_path.startsWith('http')
              ? aa.asset.original_path
              : sampleImages[i % sampleImages.length],
        }))
      : sampleImages.map((url, i) => ({
          id: `${albumId}-${i}`,
          filename: `Moment ${String(i + 1).padStart(2, '0')}`,
          thumbnailUrl: url,
        }));

  const subtitle =
    collection.subtitle ||
    `${collection.studio_name || 'Studio'} · ${assets.length} Photographs`;

  const dateHeading =
    collection.date ||
    (collection.created_at
      ? new Date(collection.created_at).toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        })
      : 'COLLECTION');

  return (
    <>
      <Link className="back-link" to="/customer/galleries">
        <ArrowLeft size={15} />
        All collections
      </Link>

      <div className="collection-intro gallery-intro">
        <p className="eyebrow">{dateHeading.toUpperCase()}</p>
        <h1>{collection.title}</h1>
        <p>{subtitle}</p>
      </div>

      <CustomerGallery
        key={albumId}
        galleryId={albumId}
        assets={assets}
      />
    </>
  );
}
