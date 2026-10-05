/**
 * Small inline icons for the redesigned ("crate") modal system.
 * Stroke icons use currentColor so they inherit the surrounding text color.
 */
type IconProps = { className?: string };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function StarIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"
        fill="#f7c531"
        stroke="#a8650c"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.4 8.9l1.7-3" fill="none" stroke="#fff6c8" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M6 6l12 12M18 6L6 18" {...stroke} strokeWidth={3} />
    </svg>
  );
}

export function StoreIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M4 9.5L5.6 4h12.8L20 9.5v.5a3 3 0 0 1-5.3 1.9 3 3 0 0 1-5.4 0A3 3 0 0 1 4 10z" {...stroke} />
      <path d="M5.5 13.5V20h13v-6.5" {...stroke} />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <circle cx="12" cy="12" r="9" {...stroke} />
      <path d="M12 7v5.2l3.2 2" {...stroke} />
    </svg>
  );
}

export function GiftIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <rect x="4" y="10" width="16" height="10" rx="2" {...stroke} />
      <rect x="3" y="6.5" width="18" height="3.5" rx="1.2" {...stroke} />
      <path d="M12 6.5V20" {...stroke} />
      <path d="M12 6.5C10.2 2.8 6.6 3.6 8 5.7c.6.9 2.3.8 4 .8zm0 0c1.8-3.7 5.4-2.9 4-.8-.6.9-2.3.8-4 .8z" {...stroke} strokeWidth={2} />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18" />
      <path d="M6.5 12.6l3.8 3.8 7.2-8" {...stroke} strokeWidth={3} />
    </svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18" />
      <path d="M12 7v6.2" {...stroke} strokeWidth={3} />
      <circle cx="12" cy="16.8" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <rect x="5.5" y="11" width="13" height="9.5" rx="2.2" {...stroke} />
      <path d="M8.5 11V8.2a3.5 3.5 0 0 1 7 0V11" {...stroke} />
    </svg>
  );
}
