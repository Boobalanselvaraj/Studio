import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const photos = {
  wedding: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1000&q=85',
  portrait: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1000&q=85',
  editorial: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85',
  landscape: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=85',
};
export const statuses = ['lead', 'booked', 'scheduled', 'shooting', 'editing', 'review', 'delivered', 'archived', 'cancelled'];
export const transitions = { lead: ['booked', 'cancelled'], booked: ['scheduled', 'cancelled'], scheduled: ['shooting', 'cancelled'], shooting: ['editing', 'cancelled'], editing: ['review', 'cancelled'], review: ['delivered', 'editing', 'cancelled'], delivered: ['archived'], archived: [], cancelled: ['lead', 'booked'] };
const initialEvents = [
  { id: '1', title: 'Smith & Jones Wedding', event_type: 'wedding', status: 'scheduled', event_date_start: '2026-09-25T10:00:00', location: 'Grand Palace Hotel', cover: photos.wedding, total_tasks: 8, completed_tasks: 3, initials: 'SJ' },
  { id: '2', title: 'David Family Portraits', event_type: 'portrait', status: 'booked', event_date_start: '2026-09-28T15:30:00', location: 'Sunset Beach', cover: photos.portrait, total_tasks: 5, completed_tasks: 1, initials: 'RD' },
  { id: '3', title: 'TechCorp Brand Story', event_type: 'corporate', status: 'editing', event_date_start: '2026-09-18T09:00:00', location: 'The Creative Studio', cover: photos.editorial, total_tasks: 6, completed_tasks: 4, initials: 'TC' },
  { id: '4', title: 'Into the Mountains', event_type: 'commercial', status: 'review', event_date_start: '2026-09-16T06:00:00', location: 'Alpine National Park', cover: photos.landscape, total_tasks: 4, completed_tasks: 3, initials: 'AM' },
  { id: '5', title: 'Olivia & James', event_type: 'wedding', status: 'lead', event_date_start: '2026-10-04T11:00:00', location: 'The Glasshouse', cover: photos.wedding, total_tasks: 0, completed_tasks: 0, initials: 'OJ' },
  { id: '6', title: 'Autumn Collection', event_type: 'commercial', status: 'delivered', event_date_start: '2026-09-12T10:00:00', location: 'Studio One', cover: photos.editorial, total_tasks: 7, completed_tasks: 7, initials: 'AC' },
];
export const useWorkspace = create(persist((set) => ({
  events: initialEvents,
  tasks: [
    { id: 't1', title: 'Prepare the wedding shot list', project: 'Smith & Jones Wedding', done: false, priority: 'High priority' },
    { id: 't2', title: 'Send previews to TechCorp', project: 'TechCorp Brand Story', done: false, priority: 'Today' },
    { id: 't3', title: 'Back up the original RAW files', project: 'Into the Mountains', done: true, priority: 'Complete' },
    { id: 't4', title: 'Confirm the portrait session', project: 'David Family Portraits', done: false, priority: 'Today' },
  ],
  brand: { name: 'Aurora Studio', color: '#23745d' },
  addEvent: (event) => set((s) => ({ events: [{ ...event, id: crypto.randomUUID(), total_tasks: 0, completed_tasks: 0 }, ...s.events] })),
  moveEvent: (id, status) => set((s) => ({ events: s.events.map((e) => e.id === id && transitions[e.status]?.includes(status) ? { ...e, status } : e) })),
  toggleTask: (id) => set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t) })),
  setBrand: (brand) => set({ brand }),
}), { name: 'studioflow-preview-v1' }));
export function formatDate(date, options = { month: 'short', day: 'numeric' }) {
  return date ? new Date(date).toLocaleDateString(undefined, options) : 'Date to be confirmed';
}


