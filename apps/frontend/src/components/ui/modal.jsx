import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
export function Modal({ open, onOpenChange, title, description, children, size }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="modal-overlay" /><Dialog.Content className={`modal-content ${size === "wide" ? "modal-wide" : ""}`}><Dialog.Title className="text-xl font-bold">{title}</Dialog.Title><Dialog.Description className="text-sm text-muted mt-2 mb-6">{description}</Dialog.Description><Dialog.Close className="icon-button modal-close" aria-label="Close dialog"><X size={18} /></Dialog.Close>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
