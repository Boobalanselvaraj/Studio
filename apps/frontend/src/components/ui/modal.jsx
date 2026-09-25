import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
export function Modal({ open, onOpenChange, title, description, children, size, className = '' }) {
  const sizeClass = size === 'wide' ? 'modal-wide' : size === 'large' ? 'max-w-3xl w-full' : '';

  const isMenuOrSelectTarget = (target) => {
    return Boolean(
      target?.closest?.('.ui-select-menu') ||
      target?.closest?.('.ui-select-container') ||
      target?.closest?.('[role="listbox"]')
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal-content ${sizeClass} ${className}`.trim()}
          onPointerDownOutside={(e) => {
            if (isMenuOrSelectTarget(e.target)) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            if (isMenuOrSelectTarget(e.target)) {
              e.preventDefault();
            }
          }}
          onFocusOutside={(e) => {
            if (isMenuOrSelectTarget(e.target)) {
              e.preventDefault();
            }
          }}
        >
          <Dialog.Title className="text-xl font-bold">{title}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted mt-2 mb-6">{description}</Dialog.Description>
          <Dialog.Close className="icon-button modal-close" aria-label="Close dialog">
            <X size={18} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
