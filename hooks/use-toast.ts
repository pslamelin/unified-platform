import { useState, useEffect } from "react";

// Global state to hold our active toasts
let memoryState: any[] = [];
let listeners: Function[] = [];

// The function you call from your pages to trigger a notification
export function toast(props: any) {
  const id = Math.random().toString(36).substring(2, 9);
  const newToast = { ...props, id, open: true };
  
  memoryState = [...memoryState, newToast];
  listeners.forEach((listener) => listener(memoryState));

  // Auto-dismiss the toast after 3.5 seconds
  setTimeout(() => {
    memoryState = memoryState.filter((t) => t.id !== id);
    listeners.forEach((listener) => listener(memoryState));
  }, 3500);
}

// The hook used by the Toaster to listen for updates
export function useToast() {
  const [toasts, setToasts] = useState<any[]>(memoryState);

  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  }, []);

  return {
    toasts,
    toast,
    dismiss: (toastId?: string) => {
      memoryState = toastId ? memoryState.filter(t => t.id !== toastId) : [];
      listeners.forEach((listener) => listener(memoryState));
    }
  };
}