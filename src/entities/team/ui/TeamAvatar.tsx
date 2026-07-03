import { useState, type CSSProperties } from 'react';
import styles from './TeamAvatar.module.css';

interface TeamAvatarProps {
  src: string;
  size: number;
  alt?: string;
  /** Border, shadows etc. supplied by the consuming component. */
  style?: CSSProperties;
  className?: string;
}

/** Sleeper avatar with per-image 404 handling (replaces the legacy
    document-level img error listener). */
export function TeamAvatar({ src, size, alt = '', style, className }: TeamAvatarProps) {
  const [broken, setBroken] = useState(false);
  return (
    <img
      src={src || undefined}
      alt={alt}
      width={size}
      height={size}
      style={style}
      className={`${styles.avatar} ${broken || !src ? styles.hidden : ''} ${className ?? ''}`}
      onError={() => setBroken(true)}
      onLoad={() => setBroken(false)}
    />
  );
}
