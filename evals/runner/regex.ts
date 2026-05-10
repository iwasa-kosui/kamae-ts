// PCRE-style inline flag groups (e.g. `(?i)`, `(?m)`, `(?im)`) appear in the
// committed eval.yaml graders, but JavaScript's RegExp constructor rejects
// them. Extract the flags and rebuild the pattern with native RegExp flags.

const SUPPORTED_INLINE_FLAGS = /^\(\?([imsu]+)\)/u

export function compilePattern(pattern: string): RegExp {
  let body = pattern
  let flags = ''
  const match = SUPPORTED_INLINE_FLAGS.exec(body)
  if (match !== null) {
    flags = match[1] ?? ''
    body = body.slice(match[0].length)
  }
  return new RegExp(body, flags)
}
