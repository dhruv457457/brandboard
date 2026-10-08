"use client";

import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Lock, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The sign-in story: five short chapters that show the whole product in one pass. Sign in with X and Privy makes
 * a wallet; spots get drawn on an outfit; brands bid on a car in one tap; a team wears hoodies at demo day; and
 * all three get paid into their Privy wallets. Pure illustration: no real data.
 */

const SCENE_MS = 2900;
const CHAPTERS = [
  { kicker: "Sign in", caption: "Sign in with X. Privy makes your wallet in a second." },
  { kicker: "Draw your spots", caption: "Snap an outfit, a car or a team hoodie. AI cleans it up, you draw the spots." },
  { kicker: "Brands bid", caption: "Brands bid in one tap. No pop-ups, no gas. Privy signs." },
  { kicker: "Show up", caption: "Wear it at the event. Post the photo on X." },
  { kicker: "Get paid", caption: "Everyone gets paid in USDC, straight to their Privy wallet." },
];
const SURFACE_OF_SCENE = [0, 0, 1, 2, 2] as const;
const SURFACES = [
  { label: "Outfits", scene: 1, patches: [[310, 142, 50, 36], [182, 186, 30, 30], [380, 186, 30, 30], [236, 258, 50, 30]], mark: 30 },
  { label: "Cars", scene: 2, patches: [[200, 170, 96, 50], [316, 180, 62, 40], [210, 94, 100, 20], [392, 204, 32, 28]], mark: 30 },
  { label: "Team hoodies", scene: 3, patches: [[197, 143, 40, 25], [198, 214, 37, 17], [349, 143, 40, 25], [350, 214, 37, 17]], mark: 24 },
] as const;
const BRANDS = [
  { name: "Orbit", bg: "#D9CCFF", d: "M12 6a6 6 0 1 0 0.01 0Z", price: 250 },
  { name: "Kite", bg: "#BDEBD3", d: "M12 3 19 12 12 21 5 12Z", price: 150 },
  { name: "Nova", bg: "#FFE58F", d: "M12 3l2.6 5.6 6 .6-4.5 4 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.5-4 6-.6Z", price: 120 },
  { name: "Lumen", bg: "#FFC9DA", d: "M12 8a4 4 0 1 0 0.01 0ZM12 2v2M12 20v2M2 12h2M20 12h2", price: 60 },
];
const PAYOUTS = [{ x: 75, y: 170, amount: 600, who: "@maya.eth" }, { x: 211, y: 172, amount: 580, who: "@ravi.drives" }, { x: 351, y: 170, amount: 420, who: "Team Blocksmith" }];
const WALLET = { x: 436, y: 244, w: 150, h: 96 };
const TOTAL = PAYOUTS.reduce((a, p) => a + p.amount, 0);

const HOODIE_BODY = "M60 70 Q130 46 200 70 L240 110 L260 250 L220 256 L204 150 L200 300 L60 300 L56 150 L40 256 L0 250 L20 110 Z";
const HOOD = "M84 74 Q80 8 130 8 Q180 8 176 74 Q130 100 84 74 Z";
const VAN = "M160 248 V148 Q160 118 192 118 H352 Q372 118 388 140 L418 182 Q432 188 432 204 V248 Z";
const VAN_WINDOWS = "M196 130 H300 V162 H196 Z M312 130 H350 Q362 130 372 146 L390 170 H312 Z";
const X_PATH = "M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8zM16.7 19.2h1.7L7.3 4.7H5.5z";
const INK = "#0B0B0C";
const CREAM = "#FAFAF7";
const SPRING = { type: "spring", stiffness: 260, damping: 18 } as const;

export function StoryPanel({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [loop, setLoop] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => {
      setScene((s) => (s + 1) % CHAPTERS.length);
      setLoop((l) => l + 1);
    }, SCENE_MS);
    return () => clearTimeout(t);
  }, [scene, loop, paused]);

  const go = (s: number) => {
    setScene(s);
    setLoop((l) => l + 1);
  };
  const surface = SURFACE_OF_SCENE[scene];

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-1.5 flex-none" aria-label="How Patched works, in five steps">
        {CHAPTERS.map((c, i) => (
          <button key={c.kicker} onClick={() => go(i)} aria-label={`Step ${i + 1}: ${c.kicker}`} className="flex-1 h-4 flex items-center">
            <span className="block w-full h-1 rounded-full bg-[#0B0B0C]/20 overflow-hidden">
              <span
                key={i === scene ? `now-${loop}` : i}
                className="block h-full bg-[#0B0B0C] origin-left"
                style={
                  i < scene ? { width: "100%" }
                    : i === scene ? { width: "100%", animation: `story-fill ${SCENE_MS}ms linear both`, animationPlayState: paused ? "paused" : "running" }
                    : { width: 0 }
                }
              />
            </span>
          </button>
        ))}
        <button onClick={() => { if (paused) go(scene); setPaused((p) => !p); }} aria-label={paused ? "Play the story" : "Pause the story"}
          className="ml-1 w-7 h-7 rounded-full bg-[#0B0B0C]/10 grid place-items-center text-[#0B0B0C] hover:bg-[#0B0B0C]/20">
          {paused ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
        </button>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 mt-3 flex-none text-[14px] sm:text-[15px] text-[#0B0B0C] whitespace-nowrap overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="What creators patch">
        <span className="hidden sm:inline font-mono text-xs font-semibold tracking-[0.06em]">PATCH ANYTHING</span>
        {SURFACES.map((s, i) => {
          const on = scene >= 1 && scene <= 3 && surface === i;
          return (
            <button key={s.label} role="tab" aria-selected={on} onClick={() => go(s.scene)}
              className="h-8 flex-none whitespace-nowrap border-b-[2.5px] transition-opacity" style={{ borderColor: on ? INK : "transparent", fontWeight: on ? 800 : 600, opacity: on || scene === 4 ? 1 : 0.6 }}>
              {s.label}
            </button>
          );
        })}
      </div>

      <svg viewBox="0 0 592 360" className="w-full h-auto mt-3 lg:flex-1 lg:min-h-0" role="img" aria-label={CHAPTERS[scene].caption}>
        <Stage scene={scene} loop={loop} reduce={!!reduce} />
      </svg>

      <motion.div key={loop} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mt-3 min-h-[84px] lg:min-h-0 flex-none text-[#0B0B0C]">
        <span className="font-mono text-[13px] font-semibold tracking-[0.06em]">0{scene + 1} / 05 · {CHAPTERS[scene].kicker.toUpperCase()}</span>
        <p className="font-display font-extrabold text-[clamp(20px,2.2vw,27px)] lg:text-[clamp(17px,min(2vw,3.2vh),27px)] leading-[1.1] tracking-[-0.03em] mt-1.5">{CHAPTERS[scene].caption}</p>
      </motion.div>
    </div>
  );
}

function Stage({ scene, loop, reduce }: { scene: number; loop: number; reduce: boolean }) {
  return (
    <>
      <Chapter key={`stage-${loop}`} scene={scene} reduce={reduce} />
      <Wallet scene={scene} loop={loop} reduce={reduce} />
    </>
  );
}

/** Everything that belongs to one chapter; it remounts each chapter so its entrances replay. */
function Chapter({ scene, reduce }: { scene: number; reduce: boolean }) {
  const surface = SURFACE_OF_SCENE[scene];
  const s = SURFACES[surface];
  const mid = scene >= 1 && scene <= 3;
  const t = (delay: number) => (reduce ? { duration: 0 } : { ...SPRING, delay });

  return (
    <g>
      {/* The three surfaces, one per chapter */}
      <motion.g initial={false} animate={{ opacity: mid ? 1 : 0 }} transition={{ duration: 0.4 }}>
        <g opacity={surface === 0 && mid ? 1 : 0} fill={CREAM} stroke={INK} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round">
          <g transform="translate(166 20)">
            <path d={HOODIE_BODY} />
            <path d="M108 56 L130 84 L152 56 Q130 50 108 56 Z" fill={INK} />
            <path d="M88 64 L108 56 L130 84 L130 116 Z M172 64 L152 56 L130 84 L130 116 Z" />
            <path d="M130 116 V300 M62 286 H198 M2 236 L41 242 M258 236 L219 242" fill="none" />
          </g>
        </g>
        <g opacity={surface === 1 && mid ? 1 : 0} fill={CREAM} stroke={INK} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round">
          <path d="M140 274 H452" fill="none" strokeOpacity={0.35} />
          <path d={VAN} />
          <path d={VAN_WINDOWS} fill="#DCE8F5" />
          <path d="M306 130 V246 M320 232 H334 M232 118 V114 M288 118 V114 M418 246 H436" fill="none" />
          <circle cx={426} cy={214} r={4} fill="#FFE58F" />
          <circle cx={212} cy={250} r={22} fill={INK} /><circle cx={212} cy={250} r={9} />
          <circle cx={384} cy={250} r={22} fill={INK} /><circle cx={384} cy={250} r={9} />
        </g>
        <g opacity={surface === 2 && mid ? 1 : 0} fill={CREAM} stroke={INK} strokeWidth={4.2} strokeLinejoin="round" strokeLinecap="round">
          {[136, 288].map((x) => (
            <g key={x} transform={`translate(${x} 70) scale(.62)`}>
              <path d={HOODIE_BODY} />
              <path d={HOOD} />
              <path d="M100 70 Q130 30 160 70 Q130 88 100 70 Z" fill="#EFE7D8" />
              <path d="M62 286 H198 M2 236 L41 242 M258 236 L219 242 M112 86 L110 110 M148 86 L150 110" fill="none" />
            </g>
          ))}
        </g>

        {/* Spots: drawn in on the outfit, already there on the car and hoodies */}
        {s.patches.map(([x, y, w, h], i) => (
          <motion.rect key={`${surface}-${i}`} x={x} y={y} width={w} height={h} rx={7} stroke={INK} strokeWidth={2.4}
            initial={scene === 1 && !reduce ? { pathLength: 0, fill: "rgba(255,217,199,0)" } : false}
            animate={{ pathLength: 1, fill: "rgba(255,217,199,1)" }}
            transition={reduce ? { duration: 0 } : { pathLength: { duration: 0.6, delay: 0.5 + i * 0.4 }, fill: { duration: 0.4, delay: 0.9 + i * 0.4 } }} />
        ))}

        {/* Brand logos land on the car (chapter 3) and stay on the hoodies (chapter 4) */}
        {(scene === 2 || scene === 3) && s.patches.map(([x, y, w, h], i) => {
          const m = s.mark;
          return (
            <motion.g key={`b-${surface}-${i}`}
              initial={scene === 2 && !reduce ? { opacity: 0, y: -120, rotate: -20, scale: 0.4 } : false}
              animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
              transition={t(0.35 + i * 0.45)}>
              <rect x={x + w / 2 - m / 2} y={y + h / 2 - m / 2} width={m} height={m} rx={8} fill={BRANDS[i].bg} stroke={INK} strokeWidth={2} />
              <g transform={`translate(${x + w / 2 - 7.5} ${y + h / 2 - 7.5}) scale(${15 / 24})`}>
                <path d={BRANDS[i].d} fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </motion.g>
          );
        })}
      </motion.g>

      {/* Who is on screen */}
      {mid && (
        <motion.g initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} fill={INK}>
          <text x={456} y={30} fontWeight={700} fontSize={15}>{["@maya.eth", "@ravi.drives", "Blocksmith"][surface]}</text>
          <text x={456} y={50} fontSize={13}>{["Creator, 40k on X", "Van at Token2049", "4 builders"][surface]}</text>
        </motion.g>
      )}

      {/* Chapter 3: the live bids, one tap each */}
      {scene === 2 && (
        <g fill={INK}>
          <text x={0} y={84} fontFamily="var(--font-geist-mono), monospace" fontSize={12} fontWeight={600} letterSpacing="0.06em">LIVE BIDS</text>
          {BRANDS.map((b, i) => (
            <motion.g key={b.name} initial={reduce ? false : { opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={t(0.6 + i * 0.45)}>
              <circle cx={6} cy={108 + i * 26} r={5} fill={b.bg} stroke={INK} strokeWidth={1.5} />
              <text x={18} y={113 + i * 26} fontSize={15} fontWeight={700}>{b.name}</text>
              <text x={132} y={113 + i * 26} fontSize={15} textAnchor="end" fontFamily="var(--font-geist-mono), monospace">${b.price}</text>
            </motion.g>
          ))}
          <motion.text x={0} y={234} fontSize={13} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 2.2 }}>
            No pop-up, no gas.
          </motion.text>
        </g>
      )}

      {/* Chapter 4: camera flash and the X post */}
      {scene === 3 && (
        <g>
          <path d="M140 40 V6 H174 M418 6 H452 V40 M452 318 V352 H418 M174 352 H140 V318" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
          <motion.rect x={140} y={6} width={312} height={346} rx={12} fill="#FFFFFF" initial={{ opacity: reduce ? 0 : 0.95 }} animate={{ opacity: 0 }} transition={{ duration: 0.5 }} />
          <g fill={INK}>
            <circle cx={461} cy={96} r={4.5} />
            <text x={472} y={100} fontFamily="var(--font-geist-mono), monospace" fontSize={12} fontWeight={600}>DEMO DAY</text>
            <g transform="translate(456 114) scale(.6)"><path d={X_PATH} /></g>
            <ViewsText reduce={reduce} />
          </g>
        </g>
      )}

      {/* Chapter 5: all three, paid out */}
      {scene === 4 && <Finale reduce={reduce} />}

      {/* Chapter 1: Continue with X, tapped */}
      {scene === 0 && (
        <g>
          <motion.g initial={{ opacity: 1, scale: 1 }} animate={reduce ? { opacity: 0 } : { opacity: [1, 1, 1, 0], scale: [1, 1, 0.94, 1] }}
            transition={reduce ? { duration: 0 } : { duration: 1.9, times: [0, 0.6, 0.66, 1] }} style={{ transformOrigin: "296px 176px" }}>
            <rect x={196} y={150} width={200} height={52} rx={26} fill={INK} />
            <g transform="translate(236 168) scale(.67)" fill={CREAM}><path d={X_PATH} /></g>
            <text x={258} y={181} fill={CREAM} fontWeight={700} fontSize={15}>Continue with X</text>
          </motion.g>
          {!reduce && (
            <motion.circle cx={296} cy={176} r={20} fill="none" stroke={CREAM} strokeWidth={3}
              initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: [0.3, 2.6], opacity: [0.9, 0] }} transition={{ delay: 1.15, duration: 0.6 }} style={{ transformOrigin: "296px 176px" }} />
          )}
        </g>
      )}

    </g>
  );
}

function ViewsText({ reduce }: { reduce: boolean }) {
  const v = useMotionValue(reduce ? 9.8 : 0.2);
  const text = useTransform(v, (n) => `${n.toFixed(1)}k views`);
  useEffect(() => {
    if (reduce) return;
    const a = animate(v, 9.8, { duration: 2.2, ease: "easeOut" });
    return () => a.stop();
  }, [v, reduce]);
  return <motion.text x={474} y={128} fontSize={15} fontWeight={700} fontFamily="var(--font-geist-mono), monospace">{text}</motion.text>;
}

function Finale({ reduce }: { reduce: boolean }) {
  return (
    <motion.g initial={reduce ? false : { opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING} style={{ transformOrigin: "220px 180px" }}>
      <g fill={CREAM} stroke={INK} strokeLinejoin="round" strokeLinecap="round">
        <g transform="translate(20 100) scale(.42)" strokeWidth={5.5}>
          <path d={HOODIE_BODY} />
          <path d="M108 56 L130 84 L152 56 Q130 50 108 56 Z" fill={INK} />
          <path d="M130 84 V300" fill="none" />
          <rect x={144} y={122} width={50} height={36} rx={7} fill="#D9CCFF" />
          <rect x={16} y={166} width={30} height={30} rx={7} fill="#BDEBD3" />
          <rect x={214} y={166} width={30} height={30} rx={7} fill="#FFE58F" />
        </g>
        <g transform="translate(78 108) scale(.45)" strokeWidth={5}>
          <path d={VAN} />
          <path d={VAN_WINDOWS} fill="#DCE8F5" />
          <rect x={200} y={170} width={96} height={50} rx={7} fill="#FFC9DA" />
          <rect x={316} y={180} width={62} height={40} rx={7} fill="#D9CCFF" />
          <circle cx={212} cy={250} r={22} fill={INK} />
          <circle cx={384} cy={250} r={22} fill={INK} />
        </g>
        <g transform="translate(296 100) scale(.42)" strokeWidth={5.5}>
          <path d={HOODIE_BODY} />
          <path d={HOOD} />
          <rect x={98} y={118} width={64} height={40} rx={7} fill="#BDEBD3" />
          <rect x={100} y={232} width={60} height={28} rx={7} fill="#FFE58F" />
        </g>
      </g>
      {PAYOUTS.map((p, i) => (
        <g key={p.who} fill={INK} textAnchor="middle">
          <text x={[75, 211, 351][i]} y={262} fontSize={13} fontWeight={700}>{p.who}</text>
          <text x={[75, 211, 351][i]} y={280} fontSize={13} fontWeight={600} fontFamily="var(--font-geist-mono), monospace">+${p.amount}</text>
        </g>
      ))}
      {!reduce && [0, 1].flatMap((wave) => PAYOUTS.map((p, i) => (
        <motion.g key={`${wave}-${i}`} initial={{ x: p.x, y: p.y, opacity: 0, scale: 0.3 }}
          animate={{ x: [p.x, p.x, WALLET.x + WALLET.w / 2], y: [p.y, p.y - 26, WALLET.y + WALLET.h / 2], opacity: [0, 1, 0], scale: [0.3, 1.1, 0.5] }}
          transition={{ duration: 0.8, delay: 0.2 + wave * 0.5 + i * 0.12, times: [0, 0.2, 1], ease: [0.5, 0, 0.3, 1] }}>
          <circle r={13} fill="#FFE58F" stroke={INK} strokeWidth={2} />
          <text y={4.5} textAnchor="middle" fontSize={13} fontWeight={700} fill={INK} fontFamily="var(--font-geist-mono), monospace">$</text>
        </motion.g>
      )))}
    </motion.g>
  );
}

/** The Privy wallet: made in chapter 1 (centre stage), then it waits in the corner and fills up in chapter 5. */
function Wallet({ scene, loop, reduce }: { scene: number; loop: number; reduce: boolean }) {
  const big = scene === 0;
  const bal = useMotionValue(0);
  const text = useTransform(bal, (n) => `$${Math.round(n).toLocaleString("en-US")}.00`);
  useEffect(() => {
    if (scene !== 4) {
      bal.set(0);
      return;
    }
    if (reduce) {
      bal.set(TOTAL);
      return;
    }
    const a = animate(bal, TOTAL, { duration: 1.4, delay: 0.7, ease: "easeOut" });
    return () => a.stop();
  }, [scene, reduce, bal]);

  const center = { x: 296 - WALLET.w / 2, y: 189 - WALLET.h / 2 };
  return (
    // Position: jumps to the centre for chapter 1 (while hidden), glides to the corner after.
    <motion.g
      initial={false}
      animate={big ? { x: center.x, y: center.y, scale: 1.35 } : { x: WALLET.x, y: WALLET.y, scale: 1 }}
      transition={reduce || big ? { duration: 0 } : SPRING}
      style={{ transformOrigin: `${WALLET.w / 2}px ${WALLET.h / 2}px` }}
    >
      {/* Appears just after "Continue with X" is tapped. */}
      <motion.g
        key={big ? `made-${loop}` : "rest"}
        initial={big && !reduce ? { opacity: 0, scale: 0.6 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...SPRING, delay: big ? 1.6 : 0 }}
        style={{ transformOrigin: `${WALLET.w / 2}px ${WALLET.h / 2}px` }}
      >
        <rect width={WALLET.w} height={WALLET.h} rx={18} fill={INK} />
        <rect x={WALLET.w - 10} y={32} width={18} height={30} rx={8} fill="#FF5A1F" stroke={INK} strokeWidth={2} />
        <g transform="translate(14 13)">
          <foreignObject width={14} height={14}><Lock size={12} color={CREAM} strokeWidth={2.6} /></foreignObject>
          <text x={18} y={11} fill={CREAM} fontSize={12} fontWeight={600}>{scene === 4 ? "Privy wallets" : "Privy wallet"}</text>
        </g>
        <motion.text x={14} y={60} fill={CREAM} fontSize={21} fontWeight={700} fontFamily="var(--font-geist-mono), monospace">{text}</motion.text>
        <text x={14} y={82} fill="#A8A69E" fontSize={11}>USDC · no seed phrase</text>
      </motion.g>
    </motion.g>
  );
}
