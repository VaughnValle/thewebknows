import { useId } from 'react';
import { Icon, type IconName } from './Icon';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

/**
 * A radio group styled as a segmented control. Native radios keep keyboard
 * (arrow keys) and screen-reader behavior; selection is shown with a filled
 * state, a check icon and bold text — never color alone.
 */
export function Segmented<T extends string>({
  legend,
  hideLegend,
  options,
  value,
  onChange,
  allowDeselect,
  size = 'md',
}: {
  legend: string;
  hideLegend?: boolean;
  options: SegmentOption<T>[];
  value: T | null | undefined;
  onChange: (value: T | null) => void;
  allowDeselect?: boolean;
  size?: 'sm' | 'md';
}) {
  const name = useId();
  return (
    <fieldset className={`segmented segmented-${size}`}>
      <legend className={hideLegend ? 'visually-hidden' : 'segmented-legend'}>{legend}</legend>
      <div className="segmented-options">
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label key={o.value} className={`segment${checked ? ' is-checked' : ''}`} data-value={o.value}>
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                onClick={() => {
                  if (allowDeselect && checked) onChange(null);
                }}
              />
              {(o.icon || checked) && <Icon name={o.icon ?? 'check'} size={size === 'sm' ? 14 : 16} />}
              <span>{o.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
