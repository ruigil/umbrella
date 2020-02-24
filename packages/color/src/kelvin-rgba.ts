import { clamp01 } from "@thi.ng/math";
import { setC4 } from "@thi.ng/vectors";
import type { Color } from "./api";

const G1 = -0.6088425710866344;
const G2 = -0.001748900018414868;
const G3 = 0.4097731842899564;
const G4 = 1.2762722061615583;
const G5 = 0.0003115080994769546;
const G6 = 0.11013841706194392;
const R1 = 1.3803015908551253;
const R2 = 0.0004478684462124118;
const R3 = -0.15785750232675008;
const B1 = -0.9990954974165059;
const B2 = 0.0032447435545127036;
const B3 = 0.453646839257496;

/**
 * Based on:
 * - {@link https://github.com/neilbartlett/color-temperature/blob/master/index.js}
 * - {@link http://www.zombieprototypes.com/?p=210}
 *
 * Uses adjusted coefficients to produce normalized RGB values.
 *
 * @param out - result
 * @param kelvin - color temperature
 * @param alpha - target alpha channel
 */
export const kelvinRgba = (out: Color | null, kelvin: number, alpha = 1) => {
    kelvin *= 0.01;
    let t: number;
    return kelvin < 66
        ? setC4(
              out || [],
              1,
              clamp01(G1 + G2 * (t = kelvin - 2) + G3 * Math.log(t)),
              kelvin < 20
                  ? 0
                  : clamp01(B1 + B2 * (t = kelvin - 10) + B3 * Math.log(t)),
              alpha
          )
        : setC4(
              out || [],
              clamp01(R1 + R2 * (t = kelvin - 55) + R3 * Math.log(t)),
              clamp01(G4 + G5 * (t = kelvin - 50) - G6 * Math.log(t)),
              1,
              alpha
          );
};
