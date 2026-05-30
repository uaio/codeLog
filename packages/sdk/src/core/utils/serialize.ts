/** 将参数序列化为字符串，正确处理对象 */
export function serializeArgs(args: unknown[]): string {
  if (args.length === 0) return '';

  // Handle format strings: %s %d %i %f %o %O %c
  if (typeof args[0] === 'string' && /%[sdifoOc]/.test(args[0])) {
    return formatConsoleMessage(args[0], args.slice(1));
  }

  return args
    .map((arg) => {
      if (arg === undefined) {
        return 'undefined';
      }
      if (arg === null) {
        return 'null';
      }
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');
}

/** Process printf-style console format strings */
export function formatConsoleMessage(fmt: string, args: unknown[]): string {
  let argIdx = 0;
  const result = fmt.replace(/%([sdifoOc])/g, (_match, spec: string) => {
    if (argIdx >= args.length) return `%${spec}`;
    const val = args[argIdx++];
    switch (spec) {
      case 's':
        return val === undefined ? 'undefined' : val === null ? 'null' : String(val);
      case 'd':
      case 'i':
        return String(parseInt(String(val), 10));
      case 'f':
        return String(parseFloat(String(val)));
      case 'o':
      case 'O':
        try {
          return JSON.stringify(val);
        } catch {
          return String(val);
        }
      case 'c':
        // CSS style directive — consume the argument, emit no text
        return '';
      default:
        return `%${spec}`;
    }
  });
  // Append any remaining args
  const rest = args
    .slice(argIdx)
    .map((a) => {
      if (a === undefined) return 'undefined';
      if (a === null) return 'null';
      if (typeof a === 'object') {
        try { return JSON.stringify(a); } catch { return String(a); }
      }
      return String(a);
    })
    .join(' ');
  return rest ? `${result} ${rest}` : result;
}

/** Extract CSS styles from %c format string args for styled console output */
export function extractConsoleCssStyles(args: unknown[]): string[] {
  const styles: string[] = [];
  if (typeof args[0] !== 'string') return styles;
  let argIdx = 1;
  const fmt = args[0] as string;
  const re = /%([sdifoOc])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fmt)) !== null) {
    if (argIdx >= args.length) break;
    if (m[1] === 'c') {
      styles.push(String(args[argIdx]));
    }
    argIdx++;
  }
  return styles;
}

/** 清理堆栈跟踪，移除拦截器帧 */
export function cleanStackTrace(stack: string | undefined): string | undefined {
  if (!stack) return undefined;

  const lines = stack.split('\n');
  const cleanedLines = lines.filter(
    (line) =>
      !line.includes('interceptConsole') &&
      !line.includes('serializeArgs') &&
      !line.includes('cleanStackTrace'),
  );

  return cleanedLines.join('\n');
}
