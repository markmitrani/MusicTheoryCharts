import styles from './Acc.module.scss';

/** HTML text with ♭/♯ kerned in: the UI faces have no accidentals, so the fallback glyph runs wide. */
export function Acc({ text }: { text: string }) {
  return (
    <>
      {text.split(/([♭♯])/).map((part, i) =>
        part === '♭' || part === '♯' ? (
          <span key={i} className={styles.acc}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
