import styles from './ErrorPanel.module.css';

interface ErrorPanelProps {
  error?: unknown;
  onRetry?: () => void;
}

export function ErrorPanel({ error, onRetry }: ErrorPanelProps) {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown error');
  return (
    <div className={styles.panel} role="alert">
      <div className={styles.title}>Sleeper hung up on us</div>
      <div className={styles.detail}>({message})</div>
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Redial
        </button>
      )}
    </div>
  );
}
