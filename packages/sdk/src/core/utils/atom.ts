import type { SerializedValue } from '../../types/index.js';

const MAX_DEPTH = 5;
const MAX_PROPS = 50;
const MAX_ITEMS = 100;

/**
 * Serialize any JS value into a structured SerializedValue tree.
 * Handles circular references via a WeakSet.
 */
export function serializeValue(val: unknown, depth = 0, seen?: WeakSet<object>): SerializedValue {
  if (val === null) return { t: 'null' };
  if (val === undefined) return { t: 'undefined' };

  const type = typeof val;

  if (type === 'string') return { t: 'str', v: val as string };
  if (type === 'number') return { t: 'num', v: val as number };
  if (type === 'boolean') return { t: 'bool', v: val as boolean };
  if (type === 'bigint') return { t: 'bigint', v: String(val) };
  if (type === 'symbol') return { t: 'sym', v: (val as symbol).toString() };
  if (type === 'function') return { t: 'fn', name: (val as Function).name || '(anonymous)' };

  // Object types
  const obj = val as object;

  if (!seen) seen = new WeakSet();
  if (seen.has(obj)) return { t: 'circ' };
  seen.add(obj);

  if (val instanceof RegExp) return { t: 'regexp', src: val.source, flags: val.flags };
  if (val instanceof Date) return { t: 'date', iso: val.toISOString() };
  if (val instanceof Error) return { t: 'err', name: val.name, msg: val.message, stack: val.stack };

  if (depth >= MAX_DEPTH) {
    // Too deep — return a stub
    if (Array.isArray(val)) return { t: 'arr', items: [], len: val.length, more: true };
    return { t: 'obj', tag: getTag(val), props: [], more: true };
  }

  if (val instanceof Map) {
    const entries: Array<[SerializedValue, SerializedValue]> = [];
    let i = 0;
    for (const [k, v] of val) {
      if (i++ >= MAX_ITEMS) break;
      entries.push([serializeValue(k, depth + 1, seen), serializeValue(v, depth + 1, seen)]);
    }
    return { t: 'map', entries, size: val.size };
  }

  if (val instanceof Set) {
    const values: SerializedValue[] = [];
    let i = 0;
    for (const v of val) {
      if (i++ >= MAX_ITEMS) break;
      values.push(serializeValue(v, depth + 1, seen));
    }
    return { t: 'set', values, size: val.size };
  }

  if (Array.isArray(val)) {
    const more = val.length > MAX_ITEMS;
    const items = val.slice(0, MAX_ITEMS).map((item) => serializeValue(item, depth + 1, seen));
    return { t: 'arr', items, len: val.length, more };
  }

  // Plain object / class instance
  const tag = getTag(val);
  const keys = Object.keys(obj);
  const more = keys.length > MAX_PROPS;
  const props: Array<[string, SerializedValue]> = keys
    .slice(0, MAX_PROPS)
    .map((k) => [k, serializeValue((obj as any)[k], depth + 1, seen)]);
  return { t: 'obj', tag, props, more };
}

/** Serialize multiple console args to rich structures */
export function serializeConsoleArgs(args: unknown[]): SerializedValue[] {
  const seen = new WeakSet<object>();
  return args.map((a) => serializeValue(a, 0, seen));
}

function getTag(obj: object): string {
  const tag = Object.prototype.toString.call(obj);
  // [object Foo] → Foo
  const m = tag.match(/\[object (.+)\]/);
  return m ? m[1] : 'Object';
}
