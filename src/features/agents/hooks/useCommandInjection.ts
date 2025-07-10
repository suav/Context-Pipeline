export function useCommandInjection() {
  const injectCommand = (command: string, autoSend: boolean = false) => {
    const event = new CustomEvent('injectCommand', {
      detail: { command, autoSend }
    });
    window.dispatchEvent(event);
  };
  return { injectCommand };
}
// Global function for easy access from console
if (typeof window !== 'undefined') {
  (window as any).injectCommand = (command: string, autoSend: boolean = false) => {
    const event = new CustomEvent('injectCommand', {
      detail: { command, autoSend }
    });
    window.dispatchEvent(event);
  };
}