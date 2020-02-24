import { comp } from "../func/comp";
import { iterator } from "../iterator";
import { filter } from "./filter";
import { takeLast } from "./take-last";
import type { Predicate } from "@thi.ng/api";
import type { Transducer } from "../api";

/**
 * Transducer composition / syntax sugar for:
 *
 * @example
 * ```ts
 * comp(filter(pred), takeLast(1))
 * ```
 *
 * Yields none or only the last value which passed the predicate check.
 * If `src` input is given, returns last match found (or `undefined`).
 *
 * @example
 * ```ts
 * matchLast((x) => x >= 5, [3, 1, 6, 5, 4, 2])
 * // 5
 *
 * transduce(
 *   comp(
 *     matchLast((x) => x >= 5),
 *     map((x) => x * 10)
 *   ),
 *   last(),
 *   [3, 1, 4, 2, 6, 5]
 * )
 * // 50
 * ```
 *
 * @param pred - predicate function
 * @param src -
 */
export function matchLast<T>(pred: Predicate<T>): Transducer<T, T>;
export function matchLast<T>(
    pred: Predicate<T>,
    src: Iterable<T>
): T | undefined;
export function matchLast<T>(pred: Predicate<T>, src?: Iterable<T>): any {
    return src
        ? [...iterator(matchLast(pred), src)][0]
        : comp(filter(pred), takeLast(1));
}
