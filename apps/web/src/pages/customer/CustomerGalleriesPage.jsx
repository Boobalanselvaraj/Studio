import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import { Photo } from '../../components/workspace/shared';
import { customerPortalApi } from '../../api/services';

export const fallbackCollections = [];

export function CustomerGalleriesPage() {
  const [galleries, setGalleries] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadGalleries = async () => {
    try {
      setLoading(true);
      const data = await customerPortalApi.getMyGalleries();
      if (Array.isArray(data) && data.length > 0) {
        setGalleries(data);
      } else {
        setGalleries([]);
      }
    } catch (err) {
      console.warn('Customer galleries fallback to demo collections:', err);
      setGalleries(fallbackCollections);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGalleries();
  }, []);

  return (
    <>
      <div className="collection-intro">
        <p className="eyebrow flex items-center gap-1.5 justify-center">
          <Sparkles size={14} className="text-brand-primary" /> YOUR MOMENTS, BEAUTIFULLY PRESERVED
        </p>
        <h1>Stories worth keeping.</h1>
        <p>
          A collection of the little things and the once-in-a-lifetime.
          <br />
          Take your time. Relive it all.
        </p>
      </div>

      {!loading && galleries.length === 0 && <p role="status">No published galleries have been shared with this account.</p>}
      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted">
          <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
          <span>Opening your galleries…</span>
        </div>
      ) : (
        <div className="collection-grid">
          {galleries.map((g) => {
            const coverUrl =
              g.cover ||
              g.cover_image_url ||
              g.assets?.[0]?.thumbnailUrl ||
              '';

            const displayDate =
              g.date ||
              (g.created_at
                ? new Date(g.created_at).toLocaleDateString(undefined, {
                    month: 'long',
                    year: 'numeric',
                  })
                : 'Recent Collection');

            const studioSubtitle =
              g.subtitle ||
              `${g.brand_name || g.studio_name || 'StudioFlow'} · ${g.photo_count || g.assets?.length || 0} Photographs`;

            return (
              <Link to={`/gallery/${g.id}`} className="collection-card" key={g.id}>
                <div className="collection-cover">
                  <Photo src={coverUrl} alt={g.title} />
                  <span>
                    EXPLORE COLLECTION
                    <ArrowUpRight size={17} />
                  </span>
                </div>
                <div className="collection-caption">
                  <div>
                    <small>{displayDate}</small>
                    <h2>{g.title}</h2>
                    <p>{studioSubtitle}</p>
                  </div>
                  <ArrowUpRight size={23} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
