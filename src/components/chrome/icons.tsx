/**
 * Inline icon set, light Material-Symbols flavor matching toolbar.png.
 * All icons are 24×24 stroke/fill-current so CSS color drives them.
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps): IconProps => ({
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...props,
});

export const SelectIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 3.5 L18.5 11.2 L12.6 12.8 L9.8 18.3 Z" fill="currentColor" stroke="none" />
  </svg>
);

export const MoveIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3v18M3 12h18" />
    <path d="m12 3-2.6 2.6M12 3l2.6 2.6M12 21l-2.6-2.6M12 21l2.6-2.6M3 12l2.6-2.6M3 12l2.6 2.6M21 12l-2.6-2.6M21 12l-2.6 2.6" />
  </svg>
);

export const FrameIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    <path d="M3.5 9.5h6.5V5" />
  </svg>
);

export const UploadIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 3.5h8l4 4V18a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 4 18V5.5A2 2 0 0 1 6 3.5Z" />
    <path d="M14 3.5V8h4.5" />
    <path d="M12 16.5v-5M12 11.5l-2.2 2.2M12 11.5l2.2 2.2" />
  </svg>
);

export const LayersIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m12 4 8.5 4.5L12 13 3.5 8.5Z" fill="currentColor" stroke="none" />
    <path d="m4.5 12.5 7.5 4 7.5-4M4.5 16.5l7.5 4 7.5-4" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const GearIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.5a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.07-.4.1-.8.1-1.2Z" />
  </svg>
);

export const ShareIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 14V4M12 4 8.5 7.5M12 4l3.5 3.5" />
    <path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" />
  </svg>
);

export const PlayIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 5.5 18 12 8 18.5Z" fill="currentColor" stroke="none" />
  </svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m14.5 5.5-6 6.5 6 6.5" />
  </svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m9.5 5.5 6 6.5-6 6.5" />
  </svg>
);

export const ChevronUpIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5.5 14.5 6.5-6 6.5 6" />
  </svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5.5 9.5 6.5 6 6.5-6" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const BringForwardIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 13V6a2 2 0 0 1 2-2h7" opacity="0.45" />
    <path d="M14.5 11.5v8M14.5 11.5 11 15M14.5 11.5 18 15" transform="rotate(180 14.5 15.5)" />
  </svg>
);

export const SendBackwardIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="11" height="11" rx="2" opacity="0.45" />
    <path d="M5 13V6a2 2 0 0 1 2-2h7" />
    <path d="M14.5 12v7M14.5 19 11 15.5M14.5 19l3.5-3.5" />
  </svg>
);

export const BringToFrontIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="8" y="8" width="8" height="8" rx="2" />
    <path d="M5 11V6a1 1 0 0 1 1-1h5" opacity="0.45" />
    <path d="M13 19h5a1 1 0 0 0 1-1v-5" opacity="0.45" />
  </svg>
);

export const SendToBackIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="8" y="8" width="8" height="8" rx="2" opacity="0.45" />
    <path d="M5 11V6a1 1 0 0 1 1-1h5" />
    <path d="M13 19h5a1 1 0 0 0 1-1v-5" />
  </svg>
);

export const EllipsisIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const InfoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <circle cx="12" cy="7.8" r="0.4" fill="currentColor" stroke="currentColor" />
  </svg>
);

export const KeyboardIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" />
  </svg>
);

export const LightbulbIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.55 1.1 1.3 1.2 2.2h4.8c.1-.9.5-1.65 1.2-2.2A6 6 0 0 0 12 3Z" />
  </svg>
);

export const SeventhIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <text
      x="12"
      y="16.5"
      textAnchor="middle"
      fontSize="14"
      fontWeight="600"
      fill="currentColor"
      stroke="none"
      fontFamily="inherit"
    >
      7
    </text>
  </svg>
);
