import { ApiError } from '../../api/client';
import styles from './styles.module.css';

/** The API's reasons (error.details[].message) when it sends them, else the error message. */
export function errorMessages(error: Error): string[] {
  if (error instanceof ApiError && Array.isArray(error.details)) {
    const messages = error.details.flatMap((detail: unknown) =>
      detail && typeof (detail as { message?: unknown }).message === 'string'
        ? [(detail as { message: string }).message]
        : [],
    );
    if (messages.length > 0) return messages;
  }
  return [error.message];
}

export function ErrorList({ error }: { error: Error | null }) {
  if (!error) return null;
  const messages = errorMessages(error);

  return (
    <div role="alert" className={styles.box}>
      {messages.length === 1 ? (
        <p>{messages[0]}</p>
      ) : (
        <ul className={styles.list}>
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
