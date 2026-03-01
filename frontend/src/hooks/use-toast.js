// Toast system - MUI Snackbar + Alert based
// Maintains same API: toast({ title, description, variant }) and useToast()
import * as React from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Slide from '@mui/material/Slide';

const TOAST_LIMIT = 3;
const TOAST_AUTO_HIDE = 5000;

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
};

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

export const reducer = (state, action) => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t),
      };

    case 'DISMISS_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toastId || action.toastId === undefined
            ? { ...t, open: false }
            : t),
      };

    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return { ...state, toasts: [] };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };

    default:
      return state;
  }
};

const listeners = [];
let memoryState = { toasts: [] };

function dispatch(action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

// Map variant names to MUI Alert severity
const severityMap = {
  default: 'info',
  destructive: 'error',
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
};

function toast({ variant = 'default', ...props }) {
  const id = genId();

  const update = (updateProps) =>
    dispatch({ type: 'UPDATE_TOAST', toast: { ...updateProps, id } });

  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id });

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      variant,
      severity: severityMap[variant] || 'info',
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return { id, dismiss, update };
}

function useToast() {
  const [state, setState] = React.useState(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  };
}

// Slide transition for snackbar
function SlideTransition(props) {
  return <Slide {...props} direction="up" />;
}

// Toast container component - renders MUI Snackbars
export const ToastContainer = () => {
  const { toasts, dismiss } = useToast();

  const handleClose = (id) => (_, reason) => {
    if (reason === 'clickaway') return;
    dismiss(id);
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', toastId: id }), 300);
  };

  return (
    <>
      {toasts.map((t, index) => (
        <Snackbar
          key={t.id}
          open={t.open}
          autoHideDuration={TOAST_AUTO_HIDE}
          onClose={handleClose(t.id)}
          TransitionComponent={SlideTransition}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{ mb: index * 8 }}
        >
          <Alert
            onClose={handleClose(t.id)}
            severity={t.severity || 'info'}
            variant="filled"
            sx={{ width: '100%', minWidth: 280, borderRadius: 3 }}
          >
            {t.title && <AlertTitle>{t.title}</AlertTitle>}
            {t.description || ''}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
};

export { useToast, toast };
