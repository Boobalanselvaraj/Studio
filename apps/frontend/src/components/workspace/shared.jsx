import React, { useState } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Select } from '../ui/select';
import { Plus, ArrowUpRight, Aperture, Loader2 } from 'lucide-react';
import { useWorkspace } from '../../data/workspace';
import { eventsApi } from '../../api/services';

export function PageHeading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}

export function Status({ value }) {
  return (
    <span className={`status-pill status-${value}`}>
      <i />
      {value}
    </span>
  );
}

export function Photo({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);
  return failed || !src ? (
    <div className={`photo-fallback ${className}`} role="img" aria-label={alt}>
      <Aperture size={36} strokeWidth={1} />
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

export function NewEventButton({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const addWorkspaceEvent = useWorkspace((s) => s.addEvent);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    const form = new FormData(e.currentTarget);
    const title = form.get('title')?.toString().trim();
    const event_type = form.get('event_type')?.toString();
    const date = form.get('date')?.toString();
    const location = form.get('location')?.toString().trim();
    const notes = form.get('notes')?.toString().trim();

    const payload = {
      title,
      event_type,
      status: 'lead',
      source: 'manual',
      event_date_start: date ? new Date(date).toISOString() : null,
      location: location || null,
      notes: notes || null,
    };

    try {
      const created = await eventsApi.create(payload);
      addWorkspaceEvent({ ...payload, id: created.id });
      setOpen(false);
      onCreated?.(created);
    } catch (err) {
      console.warn('API event creation fallback:', err);
      // If network/offline, save to local workspace
      addWorkspaceEvent(payload);
      setOpen(false);
      onCreated?.(payload);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} />
        New event
      </Button>

      <Modal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setError('');
        }}
        title="Every great shoot starts here."
        description="Schedule a new shoot or lead directly in your studio pipeline."
      >
        <form onSubmit={submit} className="form-stack">
          {error && <p className="form-error">{error}</p>}
          <label>
            Event name
            <input
              name="title"
              placeholder="e.g. Olivia & James Wedding"
              required
              maxLength={120}
              pattern=".*\S.*"
            />
          </label>
          <div className="form-grid">
            <label>
              Event type
              <Select
                name="event_type"
                defaultValue="wedding"
                options={[
                  { value: 'wedding', label: 'Wedding' },
                  { value: 'portrait', label: 'Portrait' },
                  { value: 'corporate', label: 'Corporate' },
                  { value: 'commercial', label: 'Commercial' },
                ]}
              />
            </label>
            <label>
              Shoot date & time
              <input name="date" type="datetime-local" required />
            </label>
          </div>
          <label>
            Location
            <input name="location" placeholder="Venue or studio address" maxLength={200} />
          </label>
          <label>
            Notes & Creative direction
            <textarea
              name="notes"
              rows={3}
              placeholder="A little context for your team…"
              maxLength={2000}
            />
          </label>
          <div className="modal-actions">
            <Button
              variant="outline"
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Create event
                  <ArrowUpRight size={15} />
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
