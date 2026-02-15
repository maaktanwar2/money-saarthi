// useConfirm hook — replaces window.confirm with ConfirmDialog
import { useState, useCallback } from 'react';
import { ConfirmDialog } from '../components/ui/Modal';

/**
 * Hook that returns [ConfirmDialogElement, confirm(options)]
 *
 * Usage:
 *   const [ConfirmEl, confirm] = useConfirm();
 *   // ...
 *   const ok = await confirm({ title, message, confirmText, variant });
 *   if (ok) { ... }
 *   // render {ConfirmEl} in JSX
 */
export function useConfirm() {
  const [state, setState] = useState({
    open: false,
    title: 'Confirm',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'default',
    resolve: null,
  });

  const confirm = useCallback(
    ({ title = 'Confirm', message = 'Are you sure?', confirmText = 'Confirm', cancelText = 'Cancel', variant = 'default' } = {}) =>
      new Promise((resolve) => {
        setState({ open: true, title, message, confirmText, cancelText, variant, resolve });
      }),
    []
  );

  const handleClose = useCallback(() => {
    setState((s) => {
      s.resolve?.(false);
      return { ...s, open: false, resolve: null };
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState((s) => {
      s.resolve?.(true);
      return { ...s, open: false, resolve: null };
    });
  }, []);

  const element = (
    <ConfirmDialog
      isOpen={state.open}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={state.title}
      message={state.message}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      variant={state.variant}
    />
  );

  return [element, confirm];
}

export default useConfirm;
