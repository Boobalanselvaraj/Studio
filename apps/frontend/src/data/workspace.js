import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const photos = {
  wedding: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1000&q=85',
  portrait: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1000&q=85',
  editorial: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85',
  landscape: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=85',
};

export const statuses = ['lead', 'booked', 'scheduled', 'shooting', 'editing', 'review', 'delivered', 'archived', 'cancelled'];

export const transitions = {
  lead: ['booked', 'cancelled'],
  booked: ['scheduled', 'cancelled'],
  scheduled: ['shooting', 'cancelled'],
  shooting: ['editing', 'cancelled'],
  editing: ['review', 'cancelled'],
  review: ['delivered', 'editing', 'cancelled'],
  delivered: ['archived'],
  archived: [],
  cancelled: ['lead', 'booked'],
};

// No mock events or mock tasks - pure production database state
export const useWorkspace = create(
  persist(
    (set) => ({
      events: [],
      tasks: [],
      brand: { name: 'Studio Workspace', color: '#3B82F6' },
      addEvent: (event) => set((s) => ({ events: [{ ...event, id: crypto.randomUUID(), total_tasks: 0, completed_tasks: 0 }, ...s.events] })),
      moveEvent: (id, status) => set((s) => ({ events: s.events.map((e) => (e.id === id && transitions[e.status]?.includes(status) ? { ...e, status } : e)) })),
      toggleTask: (id) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),
      setBrand: (brand) => set({ brand }),
    }),
    { name: 'studioflow-store-v2' }
  )
);

export function formatDate(date, options = { month: 'short', day: 'numeric' }) {
  return date ? new Date(date).toLocaleDateString(undefined, options) : 'Date to be confirmed';
}
