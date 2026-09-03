/**
 * Lumina — rate-functions.ts
 * Full ManimCE rate function catalogue (doc 02 §E) + the easing.net family,
 * all exported at top level. Rate functions map raw time t∈[0,1] → alpha.
 */

export type RateFunc = (t: number) => number;

export const linear: RateFunc = (t) => t;

/** Manim smooth — smoothstep with inflection ~10. */
export function smooth(t: number): number {
  const inflect = 10;
  const error = t - 0.5;
  return 0.5 * (1 + Math.tanh(inflect * error / Math.sqrt(1 - 4 * error * error)));
}
export const smoothstep: RateFunc = (t) => t * t * (3 - 2 * t);
export const smootherstep: RateFunc = (t) =>
  t * t * t * (t * (6 * t - 15) + 10);
export const smoothererstep: RateFunc = (t) =>
  t * t * t * t * (t * (t * (20 * t - 70) + 84) - 35);

export const thereAndBack: RateFunc = (t) => {
  const s = smoothstep(t);
  return 2 * (s < 0.5 ? s : 1 - s);
};
export const thereAndBackWithPause: RateFunc = (t, pauseRatio = 1 / 3) => {
  const a = 1.5 * pauseRatio;
  const b = 1 - a;
  if (t < a) return thereAndBack(t / a);
  if (t < b) return 1;
  return thereAndBack((t - b) / a);
};
export function there_and_back_with_pause(t: number, pauseRatio = 1 / 3) {
  return thereAndBackWithPause(t, pauseRatio);
}

export const rushFrom: RateFunc = (t) => 2 * t - t * t;
export const rushInto: RateFunc = (t) => t * t;
export const slowInto: RateFunc = (t) => t * t * (3 - 2 * t);
export const lingering: RateFunc = (t) => 1 - Math.exp(-3 * t) * Math.cos(3 * t);
export const runningStart: RateFunc = (t, pullFactor = -0.7) => {
  const [a, b] = [pullFactor, 1];
  const u = t < 0.5 ? (t / 0.5) : (1 - t) / 0.5;
  return a + (b - a) * smoothstep(u);
};
export const wiggle: RateFunc = (t, wiggles = 4) => t * (1 - 0.5 * Math.cos(wiggles * Math.PI * t));
export const exponentialDecay: RateFunc = (t, halfLife = 0.1) =>
  1 - Math.pow(2, -t / halfLife) * Math.cos(Math.PI * t);
export const doubleSmooth: RateFunc = (t) =>
  t < 0.5 ? 0.5 * smooth(2 * t) : 0.5 + 0.5 * smooth(2 * (t - 0.5));

export function notQuiteThere(func: RateFunc = smooth, proportion = 0.7): RateFunc {
  return (t) => proportion * func(t);
}

export function squishRateFunc(func: RateFunc, a: number, b: number): RateFunc {
  return (t) => func(Math.min(1, Math.max(0, a + (b - a) * t)));
}
export const squish_rate_func = squishRateFunc;

export const unitInterval: RateFunc = (t) => t;
export const zero: RateFunc = () => 0;

/* ---------------- easing.net family ---------------- */

const easeIn = (p: (t: number) => number): RateFunc => (t) => p(t);
const easeOut = (p: (t: number) => number): RateFunc => (t) => 1 - p(1 - t);
const easeInOut = (p: (t: number) => number): RateFunc => (t) =>
  t < 0.5 ? p(2 * t) / 2 : 1 - p(2 * (1 - t)) / 2;

const pow = (n: number) => (t: number) => Math.pow(t, n);
const sine = (t: number) => 1 - Math.cos((t * Math.PI) / 2);
const expo = (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1)));
const circ = (t: number) => 1 - Math.sqrt(1 - t * t);
const back = (s: number) => (t: number) =>
  t * t * ((s + 1) * t - s);
const elastic = (t: number) => {
  if (t === 0 || t === 1) return t;
  const c = (2 * Math.PI) / 3;
  return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c);
};
const bounceOut: RateFunc = (t) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

function family(name: string, p: (t: number) => number) {
  return {
    [`easeIn${name}`]: easeIn(p),
    [`easeOut${name}`]: easeOut(p),
    [`easeInOut${name}`]: easeInOut(p),
  };
}

const families: Record<string, RateFunc> = {
  ...family('Sine', sine),
  ...family('Quad', pow(2)),
  ...family('Cubic', pow(3)),
  ...family('Quart', pow(4)),
  ...family('Quint', pow(5)),
  ...family('Expo', expo),
  ...family('Circ', circ),
  ...family('Back', back(1.70158)),
  easeInElastic: easeIn(elastic),
  easeOutElastic: easeOut(elastic),
  easeInOutElastic: easeInOut(elastic),
  easeInBounce: easeIn(bounceOut),
  easeOutBounce: bounceOut,
  easeInOutBounce: easeInOut(bounceOut),
};

export const easeInSine = families.easeInSine as RateFunc;
export const easeOutSine = families.easeOutSine as RateFunc;
export const easeInOutSine = families.easeInOutSine as RateFunc;
export const easeInQuad = families.easeInQuad as RateFunc;
export const easeOutQuad = families.easeOutQuad as RateFunc;
export const easeInOutQuad = families.easeInOutQuad as RateFunc;
export const easeInCubic = families.easeInCubic as RateFunc;
export const easeOutCubic = families.easeOutCubic as RateFunc;
export const easeInOutCubic = families.easeInOutCubic as RateFunc;
export const easeInQuart = families.easeInQuart as RateFunc;
export const easeOutQuart = families.easeOutQuart as RateFunc;
export const easeInOutQuart = families.easeInOutQuart as RateFunc;
export const easeInQuint = families.easeInQuint as RateFunc;
export const easeOutQuint = families.easeOutQuint as RateFunc;
export const easeInOutQuint = families.easeInOutQuint as RateFunc;
export const easeInExpo = families.easeInExpo as RateFunc;
export const easeOutExpo = families.easeOutExpo as RateFunc;
export const easeInOutExpo = families.easeInOutExpo as RateFunc;
export const easeInCirc = families.easeInCirc as RateFunc;
export const easeOutCirc = families.easeOutCirc as RateFunc;
export const easeInOutCirc = families.easeInOutCirc as RateFunc;
export const easeInBack = families.easeInBack as RateFunc;
export const easeOutBack = families.easeOutBack as RateFunc;
export const easeInOutBack = families.easeInOutBack as RateFunc;
export const easeInElastic = families.easeInElastic as RateFunc;
export const easeOutElastic = families.easeOutElastic as RateFunc;
export const easeInOutElastic = families.easeInOutElastic as RateFunc;
export const easeInBounce = families.easeInBounce as RateFunc;
export const easeOutBounce = families.easeOutBounce as RateFunc;
export const easeInOutBounce = families.easeInOutBounce as RateFunc;

export const EASING = families;

const NAMED: Record<string, RateFunc> = {
  linear, smooth, smoothstep, smootherstep, smoothererstep,
  thereAndBack, thereAndBackWithPause, rushFrom, rushInto, slowInto,
  lingering, runningStart, wiggle, exponentialDecay, doubleSmooth,
  ...families,
};

/** Accept a function or a string name like "smooth" / "easeOutCubic". */
export function resolveRateFunc(f: RateFunc | string | undefined): RateFunc {
  if (!f) return smooth;
  if (typeof f === 'function') return f;
  return NAMED[f] ?? smooth;
}
