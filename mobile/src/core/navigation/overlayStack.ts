export interface OverlayEntry {
  id: string;
  onDismiss: () => boolean | void;
}

/**
 * Explicit LIFO stack of active modals/bottom-sheets/dialogs so Android's
 * hardware Back button always dismisses the topmost overlay first.
 */
class OverlayStackManager {
  private stack: OverlayEntry[] = [];

  push(entry: OverlayEntry): void {
    this.remove(entry.id);
    this.stack.push(entry);
  }

  remove(id: string): void {
    this.stack = this.stack.filter((item) => item.id !== id);
  }

  hasOpenOverlay(): boolean {
    return this.stack.length > 0;
  }

  dismissTop(): boolean {
    const top = this.stack[this.stack.length - 1];
    if (!top) {
      return false;
    }

    const result = top.onDismiss();
    if (result === false) {
      return true;
    }

    this.remove(top.id);
    return true;
  }
}

export const overlayStack = new OverlayStackManager();
