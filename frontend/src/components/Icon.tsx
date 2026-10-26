import type { ReactNode } from 'react'

export type IconName =
  | 'overview'
  | 'quality'
  | 'anomalies'
  | 'investigations'
  | 'reports'
  | 'menu'
  | 'close'
  | 'upload'
  | 'database'
  | 'layers'

const paths: Record<IconName, ReactNode> = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  quality: <><path d="M12 2 20 5v6c0 5.5-3.5 9-8 11-4.5-2-8-5.5-8-11V5l8-3Z" /><path d="m9 12 2 2 4-4" /></>,
  anomalies: <path d="M2 12h4l2.5-6 4 12 3-7 1.5 3H22" />,
  investigations: <><path d="m12 2 1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2Z" /><path d="m19 17 .7 1.3L21 19l-1.3.7L19 21l-.7-1.3L17 19l1.3-.7L19 17ZM4 16l.6 1.4L6 18l-1.4.6L4 20l-.6-1.4L2 18l1.4-.6L4 16Z" /></>,
  reports: <><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 16v-4m4 4V8m4 8v-6" /></>,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  close: <path d="M5 5l14 14M19 5 5 19" />,
  upload: <><path d="M12 16V4m0 0-4 4m4-4 4 4" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" /></>,
}

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  )
}
