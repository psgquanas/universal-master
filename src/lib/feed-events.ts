type FeedChangeListener = () => void;

const listeners = new Set<FeedChangeListener>();

export function notifyFeedChanged() {
  listeners.forEach((listener) => listener());
}

export function subscribeToFeedChanges(listener: FeedChangeListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
