/**
 * FloatingIcons — decorative background layer for the landing HERO.
 *
 * Pure CSS drift animation (no JS / rAF).
 * GPU-friendly: only `transform` is animated.
 * Respects `prefers-reduced-motion` (icons stay static).
 * Mobile-light: half the icons are hidden on xs screens.
 * All icons are aria-hidden and pointer-events-none.
 */

// Each icon entry: filename (without .svg), position (top%, left%),
// size (px), animation duration (s), animation delay (s), mobile visibility.
const ICONS: Array<{
  file: string;
  top: number;   // percentage
  left: number;  // percentage
  size: number;  // px (24–34 range)
  dur: number;   // seconds
  delay: number; // seconds
  mobile: boolean; // false = hidden on small screens
}> = [
  { file: "mercadopago",    top:  8, left:  4,  size: 32, dur: 14, delay: 0,    mobile: true  },
  { file: "uala",           top: 15, left: 88,  size: 28, dur: 18, delay: 1.5,  mobile: true  },
  { file: "brubank",        top: 72, left:  7,  size: 26, dur: 16, delay: 3,    mobile: false },
  { file: "lemon",          top: 82, left: 92,  size: 30, dur: 12, delay: 0.8,  mobile: true  },
  { file: "naranja-x",      top: 35, left:  2,  size: 24, dur: 20, delay: 5,    mobile: false },
  { file: "modo",           top: 55, left: 95,  size: 28, dur: 15, delay: 2.2,  mobile: true  },
  { file: "cocos",          top: 90, left: 45,  size: 26, dur: 17, delay: 4,    mobile: false },
  { file: "banco-galicia",  top: 22, left: 78,  size: 30, dur: 13, delay: 1,    mobile: true  },
  { file: "banco-nacion",   top: 60, left: 18,  size: 28, dur: 19, delay: 6,    mobile: false },
  { file: "banco-bbva",     top:  5, left: 55,  size: 26, dur: 22, delay: 3.5,  mobile: false },
  { file: "banco-santander",top: 45, left: 90,  size: 24, dur: 16, delay: 7,    mobile: false },
  { file: "prex",           top: 78, left: 62,  size: 28, dur: 11, delay: 2,    mobile: true  },
  { file: "belo",           top: 28, left: 12,  size: 26, dur: 21, delay: 4.5,  mobile: false },
  { file: "buenbit",        top: 68, left: 80,  size: 24, dur: 18, delay: 0.5,  mobile: false },
  { file: "banco-provincia",top: 12, left: 32,  size: 30, dur: 14, delay: 8,    mobile: false },
  { file: "banco-ciudad",   top: 50, left: 50,  size: 24, dur: 20, delay: 9,    mobile: false },
];

export function FloatingIcons() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none"
      aria-hidden="true"
    >
      {ICONS.map(({ file, top, left, size, dur, delay, mobile }) => (
        <img
          key={file}
          src={`/icons/ar/bancos-billeteras/${file}.svg`}
          alt=""
          width={size}
          height={size}
          className={[
            "absolute rounded-lg",
            "opacity-[0.09]",
            "grayscale-[30%] brightness-110",
            "animate-float-drift",
            mobile ? "" : "hidden sm:block",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            top: `${top}%`,
            left: `${left}%`,
            width: size,
            height: size,
            animationDuration: `${dur}s`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  );
}
