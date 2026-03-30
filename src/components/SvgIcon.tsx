type IconName = "close" | "monitor" | "refresh" | "settings" | "spinner";

type SvgIconProps = {
  name: IconName;
  className?: string;
};

export function SvgIcon({ name, className }: SvgIconProps) {
  const props = {
    className: className ? `ui-icon ${className}` : "ui-icon",
    viewBox: "0 0 24 24",
    "aria-hidden": "true" as const,
  };

  switch (name) {
    case "refresh":
      return (
        <svg {...props}>
          <path
            d="M20 11a8 8 0 1 0 2.2 5.5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <path
            d="M20 4v7h-7"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "spinner":
      return (
        <svg {...props}>
          <circle
            cx="12"
            cy="12"
            r="8"
            fill="none"
            opacity="0.25"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M20 12a8 8 0 0 0-8-8"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <path
            d="M12 8.7a3.3 3.3 0 1 0 0 6.6a3.3 3.3 0 0 0 0-6.6Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="m19.4 15l1.2 2.1l-2.1 2.1l-2.1-1.2a7.9 7.9 0 0 1-2 .8L14 21h-4l-.4-2.2a7.9 7.9 0 0 1-2-.8l-2.1 1.2l-2.1-2.1L4.6 15a7.9 7.9 0 0 1-.8-2L1.6 12l2.2-1a7.9 7.9 0 0 1 .8-2L3.4 6.9l2.1-2.1l2.1 1.2a7.9 7.9 0 0 1 2-.8L10 3h4l.4 2.2a7.9 7.9 0 0 1 2 .8l2.1-1.2l2.1 2.1L19.4 9c.4.6.6 1.3.8 2l2.2 1l-2.2 1c-.2.7-.4 1.4-.8 2Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.4"
          />
        </svg>
      );
    case "close":
      return (
        <svg {...props}>
          <path
            d="M6 6l12 12M18 6L6 18"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "monitor":
      return (
        <svg {...props}>
          <rect
            x="4"
            y="5"
            width="16"
            height="11"
            rx="1.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M9 19h6M12 16v3"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
  }
}
