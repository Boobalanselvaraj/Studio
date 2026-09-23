import React from 'react';
import { Modal } from './modal';
import { Button } from './button';
import { AlertTriangle, Info, CheckCircle2, Loader2 } from 'lucide-react';

export function ConfirmModal({
  open,
  onOpenChange,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger', // 'danger' | 'primary' | 'warning'
  onConfirm,
  loading = false,
}) {
  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2.5">
          {variant === 'danger' && (
            <div className="p-2 rounded-full bg-red-500/10 text-red-500">
              <AlertTriangle size={20} />
            </div>
          )}
          {variant === 'warning' && (
            <div className="p-2 rounded-full bg-amber-500/10 text-amber-500">
              <AlertTriangle size={20} />
            </div>
          )}
          {variant === 'primary' && (
            <div className="p-2 rounded-full bg-brand-primary/10 text-brand-primary">
              <Info size={20} />
            </div>
          )}
          <span>{title}</span>
        </div>
      }
      description={description}
    >
      <div className="flex justify-end items-center gap-2 pt-4 border-t border-border mt-4">
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => onOpenChange(false)}
        >
          {cancelText}
        </Button>
        <Button
          type="button"
          disabled={loading}
          onClick={handleConfirm}
          className={
            variant === 'danger'
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
              : variant === 'warning'
              ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
              : 'bg-brand-primary text-white'
          }
        >
          {loading ? <Loader2 size={16} className="animate-spin mr-1.5" /> : null}
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
