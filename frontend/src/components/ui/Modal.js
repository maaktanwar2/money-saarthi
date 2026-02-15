// Modal Component v3.0 — Design-token-aware
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './index';

export const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  description,
  children, 
  size = 'default',
  showClose = true,
  className 
}) => {
  const overlayRef = useRef(null);
  
  const sizes = {
    sm: 'max-w-md',
    default: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw] max-h-[90vh]',
  };

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={handleOverlayClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
            className={cn(
              'relative w-full bg-surface-2 border border-border rounded-xl shadow-2xl overflow-hidden',
              sizes[size],
              className
            )}
          >
            {(title || showClose) && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  {title && <h2 className="text-base font-semibold">{title}</h2>}
                  {description && (
                    <p className="text-xs text-foreground-muted mt-0.5">{description}</p>
                  )}
                </div>
                {showClose && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onClose}
                    className="rounded-lg -mr-1"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
            
            <div className="px-5 py-4 overflow-y-auto max-h-[70vh] scrollbar-thin">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}) => (
  <Modal isOpen={isOpen} onClose={onClose} size="sm" title={title}>
    <p className="text-sm text-foreground-muted mb-5">{message}</p>
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" onClick={onClose}>
        {cancelText}
      </Button>
      <Button 
        variant={variant === 'destructive' ? 'destructive' : 'default'}
        size="sm"
        onClick={() => {
          onConfirm();
          onClose();
        }}
      >
        {confirmText}
      </Button>
    </div>
  </Modal>
);

export default Modal;
