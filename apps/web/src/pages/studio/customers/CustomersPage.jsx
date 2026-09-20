import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Users,
  ArrowUpRight,
  Mail,
  Phone,
  CalendarCheck,
  Image,
  Loader2,
} from 'lucide-react';
import { PageHeading } from '../../../components/workspace/shared';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { customersApi } from '../../../api/services';
import { useAuthStore } from '../../../stores/authStore';

export function CustomersPage() {
  const currentStudio = useAuthStore((s) => s.currentStudio);

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await customersApi.list();
      if (Array.isArray(data)) {
        setCustomers(data);
      }
    } catch (err) {
      console.warn('Customers load fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [currentStudio?.id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;

    try {
      setBusy(true);
      setError('');
      await customersApi.create({
        full_name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });

      setFormName('');
      setFormEmail('');
      setFormPhone('');
      setFormNotes('');
      setOpenModal(false);
      loadCustomers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to register customer');
    } finally {
      setBusy(false);
    }
  };

  const filtered = customers.filter((c) =>
    `${c.full_name || ''} ${c.email || ''} ${c.phone || ''}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  const getInitials = (name) => {
    if (!name) return 'CU';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="GREAT WORK STARTS WITH GREAT RELATIONSHIPS"
        title="Your people"
        description="Keep your clients close and every detail in reach."
      >
        <Button onClick={() => setOpenModal(true)}>
          <Plus size={16} />
          Add customer
        </Button>
      </PageHeading>

      <div className="filter-toolbar">
        <span className="text-sm text-muted">
          {customers.length} client{customers.length === 1 ? '' : 's'} registered
        </span>
        <label className="inline-search">
          <Search size={16} />
          <input
            aria-label="Search customers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or phone…"
          />
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted">
          <Loader2 size={32} className="animate-spin text-brand-primary mr-3" />
          <span>Loading client directory…</span>
        </div>
      ) : (
        <section className="panel table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Shoots</th>
                <th>Galleries</th>
                <th>
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="customer-name">
                      <span className="customer-avatar">
                        {getInitials(c.full_name)}
                      </span>
                      <div>
                        <strong>{c.full_name}</strong>
                        {c.notes && (
                          <span className="text-xs text-muted truncate max-w-xs block">
                            {c.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>{c.email}</div>
                    <small>{c.phone || 'No phone'}</small>
                  </td>
                  <td>{c.total_events || c.events?.length || 0}</td>
                  <td>{c.total_albums || c.albums?.length || 0}</td>
                  <td>
                    <button
                      className="text-link"
                      onClick={() => setSelected(c)}
                    >
                      View details
                      <ArrowUpRight size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="empty-state py-12">
              <Users size={30} className="text-muted mb-2" />
              <h2>No customers found</h2>
              <p className="text-sm text-muted mb-4">
                Try another search or register a new customer profile.
              </p>
              <Button onClick={() => setOpenModal(true)}>
                <Plus size={16} /> Add customer
              </Button>
            </div>
          )}
        </section>
      )}

      {/* Add Customer Modal */}
      <Modal
        open={openModal}
        onOpenChange={(v) => {
          setOpenModal(v);
          if (!v) setError('');
        }}
        title="Add a new client profile"
        description="Registers a client in your studio database to link with shoots and galleries."
      >
        <form className="form-stack" onSubmit={handleCreate}>
          {error && <p className="form-error">{error}</p>}
          <label>
            Full name
            <input
              required
              maxLength={100}
              placeholder="e.g. Sarah Jenkins"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </label>
          <label>
            Email address
            <input
              type="email"
              required
              placeholder="sarah.client@example.com"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
            />
          </label>
          <label>
            Phone number (optional)
            <input
              type="tel"
              maxLength={30}
              placeholder="+1 (555) 0199"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
            />
          </label>
          <label>
            Notes / Client Preferences
            <textarea
              rows={2}
              placeholder="e.g. VIP client, preferred style: natural warm light"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </label>
          <div className="modal-actions">
            <Button
              variant="outline"
              type="button"
              disabled={busy}
              onClick={() => setOpenModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : 'Register Client'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Customer Details Modal */}
      <Modal
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        title={selected?.full_name || 'Customer'}
        description="Client profile and connected studio assets."
      >
        {selected && (
          <div className="customer-detail space-y-4">
            <p className="flex items-center gap-2 text-sm">
              <Mail size={16} className="text-brand-primary" />
              <span>{selected.email}</span>
            </p>
            {selected.phone && (
              <p className="flex items-center gap-2 text-sm">
                <Phone size={16} className="text-brand-primary" />
                <span>{selected.phone}</span>
              </p>
            )}

            {selected.notes && (
              <div className="p-3 bg-surface-2 rounded text-xs text-muted">
                <strong>Notes:</strong> {selected.notes}
              </div>
            )}

            <div className="customer-detail-stats">
              <span>
                <strong>{selected.total_events || selected.events?.length || 0}</strong>
                Linked shoots
              </span>
              <span>
                <strong>{selected.total_albums || selected.albums?.length || 0}</strong>
                Shared galleries
              </span>
            </div>

            {selected.events && selected.events.length > 0 && (
              <div>
                <strong className="text-xs text-muted uppercase block mb-2">Linked Shoots</strong>
                <div className="space-y-1">
                  {selected.events.map((ev) => (
                    <div key={ev.id} className="text-xs flex justify-between p-2 bg-surface-2 rounded">
                      <span>{ev.title}</span>
                      <span className="text-muted capitalize">{ev.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
