import cn from 'clsx';
import React from 'react';
import s from './IconButton.module.css';

type Size = 'small' | 'medium' | 'large';
type Color = 'inherit' | 'primary' | 'error';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: Size;
  color?: Color;
  /** Shown as the native tooltip and used as the accessible name. */
  label: string;
}

/**
 * MUI IconButton: round, transparent, a translucent hover in the button's colour. small is 34px,
 * medium 40px and large 48px, each around a 24px icon.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = 'medium', color = 'inherit', label, className, children, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      {...rest}
      className={cn(s.button, s[size], s[color], className)}
    >
      {children}
    </button>
  )
);
IconButton.displayName = 'IconButton';
