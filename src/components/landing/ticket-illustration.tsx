// Hero ticket motif. Decorative SVG illustration of a coach ticket showing the
// product's core promise: a £24 original sliding down to £9 as departure
// approaches. Pure presentation — no state, server component.

export function TicketIllustration({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <svg
        viewBox="0 0 320 200"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
        role="img"
      >
        <title>Coach ticket illustration</title>

        {/* Drop shadow */}
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="6"
              stdDeviation="8"
              floodColor="oklch(0.36 0.055 160)"
              floodOpacity="0.15"
            />
          </filter>
          <pattern
            id="perf"
            patternUnits="userSpaceOnUse"
            width="4"
            height="8"
          >
            <circle cx="2" cy="4" r="1" fill="oklch(0.89 0.015 85)" />
          </pattern>
        </defs>

        {/* Ticket body */}
        <g filter="url(#shadow)">
          <rect
            x="14"
            y="20"
            width="292"
            height="160"
            rx="14"
            fill="white"
            stroke="oklch(0.89 0.015 85)"
            strokeWidth="1"
          />
          {/* Perforated divider */}
          <line
            x1="210"
            y1="32"
            x2="210"
            y2="168"
            stroke="url(#perf)"
            strokeWidth="4"
            strokeDasharray="2,4"
          />
          {/* Notch top */}
          <circle cx="210" cy="20" r="6" fill="oklch(0.975 0.012 88)" />
          {/* Notch bottom */}
          <circle cx="210" cy="180" r="6" fill="oklch(0.975 0.012 88)" />
        </g>

        {/* LEFT SIDE — route + time */}
        <g fontFamily="var(--font-geist-sans), system-ui, sans-serif">
          {/* Operator badge */}
          <rect
            x="30"
            y="36"
            width="58"
            height="18"
            rx="9"
            fill="oklch(0.36 0.055 160)"
          />
          <text
            x="59"
            y="49"
            textAnchor="middle"
            fontSize="9"
            fontWeight="700"
            letterSpacing="0.5"
            fill="oklch(0.975 0.012 88)"
          >
            MEGABUS
          </text>

          {/* Live dot */}
          <circle cx="190" cy="44" r="4" fill="oklch(0.68 0.16 33)">
            <animate
              attributeName="opacity"
              values="1;0.35;1"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
          <text
            x="180"
            y="48"
            textAnchor="end"
            fontSize="9"
            fontWeight="600"
            fill="oklch(0.68 0.16 33)"
            letterSpacing="0.5"
          >
            LIVE
          </text>

          {/* Route */}
          <text
            x="30"
            y="86"
            fontSize="13"
            fontWeight="500"
            fill="oklch(0.46 0.015 100)"
          >
            London Victoria
          </text>
          <text
            x="30"
            y="106"
            fontFamily="var(--font-fraunces), Georgia, serif"
            fontSize="20"
            fontWeight="600"
            fill="oklch(0.18 0 0)"
          >
            → Manchester
          </text>

          {/* Time + date */}
          <text
            x="30"
            y="138"
            fontSize="11"
            fill="oklch(0.46 0.015 100)"
            letterSpacing="0.5"
          >
            TUE · 14:30 · 4h 25m
          </text>

          {/* T-minus countdown */}
          <rect
            x="30"
            y="148"
            width="80"
            height="22"
            rx="6"
            fill="oklch(0.94 0.018 85)"
          />
          <text
            x="70"
            y="163"
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill="oklch(0.30 0.05 160)"
          >
            T-45 min
          </text>
        </g>

        {/* RIGHT SIDE — pricing */}
        <g fontFamily="var(--font-geist-sans), system-ui, sans-serif">
          <text
            x="226"
            y="50"
            fontSize="9"
            fontWeight="600"
            fill="oklch(0.46 0.015 100)"
            letterSpacing="1"
          >
            PRICE
          </text>

          {/* Crossed-out original */}
          <text
            x="226"
            y="72"
            fontSize="13"
            fill="oklch(0.46 0.015 100)"
            textDecoration="line-through"
          >
            £24.00
          </text>
          <line
            x1="223"
            y1="68"
            x2="263"
            y2="68"
            stroke="oklch(0.46 0.015 100)"
            strokeWidth="1.2"
          />

          {/* Big current price */}
          <text
            x="226"
            y="118"
            fontFamily="var(--font-fraunces), Georgia, serif"
            fontSize="36"
            fontWeight="700"
            fill="oklch(0.36 0.055 160)"
          >
            £9
          </text>

          {/* Discount badge */}
          <rect
            x="226"
            y="134"
            width="62"
            height="22"
            rx="11"
            fill="oklch(0.68 0.16 33)"
          />
          <text
            x="257"
            y="149"
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill="oklch(0.99 0 0)"
            letterSpacing="0.3"
          >
            −63%
          </text>
        </g>
      </svg>
    </div>
  );
}
