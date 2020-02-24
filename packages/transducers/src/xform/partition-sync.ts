import { isArray } from "@thi.ng/checks";
import { identity } from "@thi.ng/compose";
import { illegalState } from "@thi.ng/errors";
import { $iter, iterator } from "../iterator";
import { isReduced } from "../reduced";
import type { Fn, IObjectOf } from "@thi.ng/api";
import type { Reducer, Transducer } from "../api";

export interface PartitionSyncOpts<T> {
    key: Fn<T, PropertyKey>;
    mergeOnly: boolean;
    reset: boolean;
    all: boolean;
    /**
     * If greater than 0, then each labeled input will cache upto the
     * stated number of input values, even if other inputs have not yet
     * produced new values. Once the limit is reached, `partitionSync()`
     * will throw an `IllegalState` error.
     *
     * Enabling this option will cause the same behavior as if `reset`
     * is enabled (regardless of the actual configured `reset` setting).
     * I.e. new results are only produced when ALL required inputs have
     * available values...
     */
    backPressure: number;
}

/**
 * Transducer intended for synchronization and provenance tracking of
 * possibly previously merged inputs. Partitions the input into labeled
 * tuple objects with the object keys obtained from the user provided
 * `keyfn` (which is applied to each input value).
 *
 * @remarks
 * By default, a new result is only produced once values from **all**
 * given labeled sources have been received. Only labels contained in
 * the provided key set are used, others are skipped. The result tuples
 * will contain the most recent consumed value from each labeled input.
 * In dataflow scenarios this can be used to ensure a subsequent
 * operation consuming these tuples has all necessary inputs, regardless
 * of the individual rates of change of each original (pre-merge) input.
 *
 * If the `mergeOnly` option is set to true (default: false), **no**
 * synchronization (waiting) of inputs is applied and potentially
 * partially populated tuple objects will be emitted for each received
 * input value, however as with the default behavior, tuples will retain
 * the most recent consumed value from other inputs.
 *
 * @example
 * ```ts
 * src = [
 *   ["a", 1], ["a", 2], ["d", 100], ["b", 10],
 *   ["b", 11], ["c", 0], ["a", 3]
 * ];
 *
 * // form tuples for values only from sources "a" & "b"
 * // here the label is the first element of each input item
 * [...partitionSync(["a", "b"], { key: (x) => x[0] }, src)]
 * // [ { a: ["a", 2], b: ["b", 10] },
 * //   { b: ["b", 11], a: ["a", 3] } ]
 * ```
 *
 * In addition to the default mode of operation, i.e. waiting for new
 * values from *all* named inputs before a new tuple is produced, the
 * behavior for *all but the first tuple* can be changed to emit new
 * tuples as soon as a new value with a qualifying label has become
 * available (with other values in the tuple remaining). Compare with
 * above example:
 *
 * ```ts
 * // passing `false` to disable tuple reset
 * [...partitionSync(
 *   ["a", "b"],
 *   {
 *     key: (x) => x[0],
 *     reset: false
 *   },
 *   src
 * )]
 * // [ { a: ["a", 2], b: ["b", 10] },
 * //   { a: ["a", 2], b: ["b", 11] },
 * //   { a: ["a", 3], b: ["b", 11] } ]
 * ```
 *
 * By default, the last emitted tuple is allowed to be incomplete (in
 * case the input closed). To only allow complete tuples, set the
 * optional `all` arg to false.
 *
 * Note: If the `keys` set of allowed labels is modified externally, the
 * tuple size will adjust accordingly (only if given as set, will not work
 * if keys are provided as array).
 *
 * @param keys - allowed label set
 * @param keyfn - label extraction function
 * @param reset - true if each tuple should contain only new values
 * @param all - true if last tuple is allowed to be incomplete
 */
// prettier-ignore
export function partitionSync<T>(keys: PropertyKey[] | Set<PropertyKey>,opts?: Partial<PartitionSyncOpts<T>>): Transducer<T, IObjectOf<T>>;
// prettier-ignore
export function partitionSync<T>(keys: PropertyKey[] | Set<PropertyKey>, src: Iterable<T>): IterableIterator<IObjectOf<T>>;
// prettier-ignore
export function partitionSync<T>(keys: PropertyKey[] | Set<PropertyKey>, opts: Partial<PartitionSyncOpts<T>>, src: Iterable<T>): IterableIterator<IObjectOf<T>>;
export function partitionSync<T>(...args: any[]): any {
    return (
        $iter(partitionSync, args, iterator) ||
        (([init, complete, reduce]: Reducer<any, IObjectOf<T>>) => {
            let curr: IObjectOf<T> = {};
            let first = true;
            const currKeys = new Set<PropertyKey>();
            const { key, mergeOnly, reset, all, backPressure } = <
                PartitionSyncOpts<T>
            >{
                key: <any>identity,
                mergeOnly: false,
                reset: true,
                all: true,
                backPressure: 0,
                ...args[1]
            };
            const ks: Set<PropertyKey> = isArray(args[0])
                ? new Set(args[0])
                : args[0];
            if (mergeOnly || backPressure < 1) {
                return <Reducer<any, T>>[
                    init,
                    (acc) => {
                        if (
                            (reset && all && currKeys.size > 0) ||
                            (!reset && first)
                        ) {
                            acc = reduce(acc, curr);
                            curr = {};
                            currKeys.clear();
                            first = false;
                        }
                        return complete(acc);
                    },
                    (acc, x) => {
                        const k = key(x);
                        if (ks.has(k)) {
                            curr[<any>k] = x;
                            currKeys.add(k);
                            if (mergeOnly || requiredInputs(ks, currKeys)) {
                                acc = reduce(acc, curr);
                                first = false;
                                if (reset) {
                                    curr = {};
                                    currKeys.clear();
                                } else {
                                    curr = { ...curr };
                                }
                            }
                        }
                        return acc;
                    }
                ];
            } else {
                // with backpressure / caching...
                const cache: Map<PropertyKey, T[]> = new Map();
                return <Reducer<any, T>>[
                    init,
                    (acc) => {
                        if (all && currKeys.size > 0) {
                            acc = reduce(acc, collect(cache, currKeys));
                            currKeys.clear();
                        }
                        return complete(acc);
                    },
                    (acc, x) => {
                        const k = key(x);
                        if (ks.has(k)) {
                            let slot = cache.get(k);
                            !slot && cache.set(k, (slot = []));
                            slot.length >= backPressure &&
                                illegalState(
                                    `max back pressure (${backPressure}) exceeded for input: ${String(
                                        k
                                    )}`
                                );
                            slot.push(x);
                            currKeys.add(k);
                            while (requiredInputs(ks, currKeys)) {
                                acc = reduce(acc, collect(cache, currKeys));
                                first = false;
                                if (isReduced(acc)) break;
                            }
                        }
                        return acc;
                    }
                ];
            }
        })
    );
}

const requiredInputs = (required: Set<PropertyKey>, curr: Set<PropertyKey>) => {
    if (curr.size < required.size) return false;
    for (let id of required) {
        if (!curr.has(id)) return false;
    }
    return true;
};

const collect = <T>(
    cache: Map<PropertyKey, T[]>,
    currKeys: Set<PropertyKey>
) => {
    const curr: IObjectOf<T> = {};
    for (let id of currKeys) {
        const slot = cache.get(id)!;
        curr[<any>id] = slot.shift()!;
        !slot.length && currKeys.delete(id);
    }
    return curr;
};
