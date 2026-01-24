import { LucideProps } from "lucide-react";

export const ExtensionIcon = (props: LucideProps) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 2h4v4a2 2 0 1 0 4 0v-4h4v4a2 2 0 1 0 0 4h-4v4a2 2 0 1 0-4 0v-4h-4v-4a2 2 0 1 0 0-4h4V2z" />
    <path d="M19.5 10.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5c-1.66 0-3 1.34-3 3s1.34 3 3 3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5H14c-1.66 0-3-1.34-3-3s-1.34-3-3-3c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5c1.66 0 3-1.34 3-3s-1.34-3-3-3c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5h5.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5c-1.66 0-3 1.34-3 3s1.34 3 3 3z" />
    <path d="M20.5 12h-6.5a2 2 0 0 1-2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4.5a2 2 0 0 1 2-2z" style={{display: 'none'}} /> 
    {/* Custom path based on user sketch: Puzzle piece */}
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.5" />
    <path d="M10 2v2a2 2 0 1 1-4 0V2" />
    <path d="M20 14.5h-2a2 2 0 1 1 0-4h2" />
    <path d="M6 10H4a2 2 0 1 0 0 4h2" />
    <path d="M14 22v-2a2 2 0 1 0-4 0v2" />
  </svg>
);

// Better puzzle piece to match standard look
export const ExtensionWalletIcon = (props: LucideProps) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.5 11.5a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-2a1.5 1.5 0 0 1-1.5-1.5v-2a1.5 1.5 0 0 1 1.5-1.5h2z" />
    <path d="M18.5 2.5a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-2a1.5 1.5 0 0 1-1.5-1.5v-2a1.5 1.5 0 0 1 1.5-1.5h2z" />
    <path d="M4 10a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2z" />
    <path d="M12 2h4a2 2 0 0 1 2 2v4" />
    <path d="M12 18h4a2 2 0 0 0 2-2v-4" />
    <path d="M4 14v4a2 2 0 0 0 2 2h4" />
    <path d="M4 6V4a2 2 0 0 1 2-2h4" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);


export const WebPortalIcon = (props: LucideProps) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="18" rx="2" ry="2" />
    <line x1="2" y1="9" x2="22" y2="9" />
    <path d="M7 13h10" />
    <path d="M7 17h6" />
    <path d="M6 6h1" />
    <path d="M10 6h1" />
    <path d="M14 6h1" />
  </svg>
);
