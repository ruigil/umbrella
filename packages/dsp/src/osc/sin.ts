import { TAU } from "@thi.ng/math";
import type { StatelessOscillator } from "../api";

export const sin: StatelessOscillator = (phase, freq, amp = 1, dc = 0) =>
    dc + amp * Math.sin(phase * freq * TAU);
