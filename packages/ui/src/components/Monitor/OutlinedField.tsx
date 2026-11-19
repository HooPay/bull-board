import cn from 'clsx';
import React, { useId, useState } from 'react';
import s from './OutlinedField.module.css';

interface OutlinedFieldProps {
  label: string;
  id?: string;
  className?: string;
  /** Keeps the label floated even when empty, as MUI does for a select with a value. */
  shrink?: boolean;
  endAdornment?: React.ReactNode;
  children: (props: {
    id: string;
    className: string;
    onFocus: () => void;
    onBlur: () => void;
  }) => React.ReactNode;
  filled: boolean;
}

/**
 * Bull Monitor's `TextField variant="outlined" size="small"`: a 40px box with a 1px outline and a
 * label that rests inside it and floats into a notch in the outline once the field is focused
 * or has a value.
 */
export const OutlinedField = ({
  label,
  id: fixedId,
  className,
  shrink,
  endAdornment,
  children,
  filled,
}: OutlinedFieldProps) => {
  const generatedId = useId();
  const id = fixedId ?? generatedId;
  const [focused, setFocused] = useState(false);
  const floated = shrink || focused || filled;

  return (
    <div
      className={cn(s.root, className, {
        [s.focused]: focused,
        [s.floated]: floated,
        [s.withAdornment]: !!endAdornment,
      })}
    >
      <label className={s.label} htmlFor={id}>
        {label}
      </label>
      {children({
        id,
        className: s.input,
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      })}
      {endAdornment && <span className={s.adornment}>{endAdornment}</span>}
      <fieldset aria-hidden="true" className={s.outline}>
        <legend className={s.legend}>
          <span>{label}</span>
        </legend>
      </fieldset>
    </div>
  );
};

/** A text input inside an OutlinedField. */
export const OutlinedInput = ({
  label,
  value,
  onChange,
  className,
  endAdornment,
  inputProps,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  endAdornment?: React.ReactNode;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}) => (
  <OutlinedField
    label={label}
    id={inputProps?.id}
    className={className}
    filled={value !== ''}
    endAdornment={endAdornment}
  >
    {({ id, className: inputClass, onFocus, onBlur }) => (
      <input
        type="text"
        autoComplete="off"
        spellCheck={false}
        {...inputProps}
        id={id}
        className={inputClass}
        value={value}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={({ currentTarget }) => onChange(currentTarget.value)}
      />
    )}
  </OutlinedField>
);

/** A native select inside an OutlinedField, with MUI's dropdown arrow. */
export const OutlinedSelect = ({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; text: string }[];
  className?: string;
}) => (
  <OutlinedField label={label} className={cn(s.select, className)} filled shrink>
    {({ id, className: inputClass, onFocus, onBlur }) => (
      <>
        <select
          id={id}
          className={inputClass}
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={({ currentTarget }) => onChange(currentTarget.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.text}
            </option>
          ))}
        </select>
        <svg className={s.arrow} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </>
    )}
  </OutlinedField>
);
