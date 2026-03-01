// Modal Component - MUI Dialog based
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Fade from '@mui/material/Fade';
import { X } from 'lucide-react';
import { Button } from './index';

const sizeMap = {
  sm: 'xs',
  default: 'sm',
  lg: 'md',
  xl: 'lg',
  full: 'xl',
};

export const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'default',
  showClose = true,
  className,
}) => {
  const maxWidth = sizeMap[size] || 'sm';

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      TransitionComponent={Fade}
      className={className}
    >
      {(title || showClose) && (
        <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            {title && <Typography variant="h6" fontWeight={600}>{title}</Typography>}
            {description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {description}
              </Typography>
            )}
          </Box>
          {showClose && (
            <IconButton onClick={onClose} size="small" sx={{ mt: -0.5, mr: -1 }}>
              <X style={{ width: 20, height: 20 }} />
            </IconButton>
          )}
        </DialogTitle>
      )}
      <DialogContent sx={{ overflowY: 'auto' }}>
        {children}
      </DialogContent>
    </Dialog>
  );
};

// Confirmation Dialog
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
  <Dialog open={isOpen} onClose={onClose} maxWidth="xs" fullWidth TransitionComponent={Fade}>
    <DialogTitle>{title}</DialogTitle>
    <DialogContent>
      <Typography color="text.secondary">{message}</Typography>
    </DialogContent>
    <DialogActions>
      <Button variant="outline" onClick={onClose}>{cancelText}</Button>
      <Button
        variant={variant === 'destructive' ? 'destructive' : 'default'}
        onClick={() => { onConfirm(); onClose(); }}
      >
        {confirmText}
      </Button>
    </DialogActions>
  </Dialog>
);

export default Modal;
