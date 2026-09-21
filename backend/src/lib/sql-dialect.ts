/**
 * Translates the ClickHouse SQL the services are written in to Snowflake SQL, so the same
 * query strings serve both warehouses and a fix on the ClickHouse branch carries over as is.
 *
 * Covers exactly what the services use: the -If aggregate combinators, uniqExact, any,
 * groupUniqArray / arraySort / arrayStringConcat, argMaxIf over a tuple, week/month bucketing,
 * multiIf, today(), and the {name:Type} parameters (arrays expand into IN lists). Anything
 * else passes through unchanged, which is why a new ClickHouse-only function in a service
 * needs a rule here before it will run on Snowflake.
 */

export interface TranslatedQuery {
  sql: string
  binds: Array<string | number | boolean | null>
  /** Upper-cased alias → the alias as written, since Snowflake folds unquoted names to upper. */
  aliases: Map<string, string>
}

/** Splits a call's argument list on top-level commas, ignoring commas inside parens or strings. */
function splitArgs(inner: string): string[] {
  const args: string[] = []
  let depth = 0
  let quote: string | null = null
  let start = 0
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (quote) {
      if (ch === quote && inner[i - 1] !== '\\') quote = null
      continue
    }
    if (ch === "'" || ch === '"') quote = ch
    else if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      args.push(inner.slice(start, i).trim())
      start = i + 1
    }
  }
  const last = inner.slice(start).trim()
  if (last || args.length) args.push(last)
  return args
}

/** Index of the parenthesis closing the one at `open`, skipping string literals. */
function matchParen(sql: string, open: number): number {
  let depth = 0
  let quote: string | null = null
  for (let i = open; i < sql.length; i++) {
    const ch = sql[i]
    if (quote) {
      if (ch === quote && sql[i - 1] !== '\\') quote = null
      continue
    }
    if (ch === "'" || ch === '"') quote = ch
    else if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  throw new Error(`Unbalanced parentheses in SQL near: ${sql.slice(open, open + 60)}`)
}

type Rule = (args: string[], params: string[] | null) => string

/** Parametric aggregates such as groupUniqArray(500)(x) carry a second argument list. */
const PARAMETRIC = new Set(['groupUniqArray'])

/** Tuple keys like (ETL_BATCH_TIME, DATE) become one sortable string, since MAX_BY takes a scalar. */
function tupleKey(expr: string): string {
  const t = expr.trim()
  if (!t.startsWith('(') || matchParen(t, 0) !== t.length - 1) return t
  const parts = splitArgs(t.slice(1, -1))
  if (parts.length < 2) return t
  return parts.map((p) => `TO_VARCHAR(${p}, 'YYYY-MM-DD HH24:MI:SS.FF6')`).join(" || '|' || ")
}

const RULES: Record<string, Rule> = {
  sumIf: ([x, c]) => `SUM(CASE WHEN ${c} THEN ${x} END)`,
  avgIf: ([x, c]) => `AVG(CASE WHEN ${c} THEN ${x} END)`,
  countIf: ([c]) => `COUNT_IF(${c})`,
  uniqExactIf: ([x, c]) => `COUNT(DISTINCT CASE WHEN ${c} THEN ${x} END)`,
  uniqExact: (args) => `COUNT(DISTINCT ${args.join(', ')})`,
  count: (args) => (args.length === 0 || (args.length === 1 && args[0] === '') ? 'COUNT(*)' : `COUNT(${args.join(', ')})`),
  any: ([x]) => `ANY_VALUE(${x})`,
  // The limit is only a guard against runaway arrays; the dimensions here are small.
  groupUniqArray: (args, params) => `ARRAY_AGG(DISTINCT ${params ? params[0] : args[0]})`,
  arraySort: ([x]) => `ARRAY_SORT(${x})`,
  arrayStringConcat: ([arr, sep]) => `ARRAY_TO_STRING(${arr}, ${sep ?? "''"})`,
  argMaxIf: ([x, key, c]) => `MAX_BY(CASE WHEN ${c} THEN ${x} END, CASE WHEN ${c} THEN ${tupleKey(key ?? '')} END)`,
  argMax: ([x, key]) => `MAX_BY(${x}, ${tupleKey(key ?? '')})`,
  // Monday-start weeks without depending on the session's WEEK_START.
  toStartOfWeek: ([x]) => `DATEADD(DAY, 1 - DAYOFWEEKISO(${x}), ${x})`,
  toStartOfMonth: ([x]) => `DATE_TRUNC('MONTH', ${x})`,
  toString: ([x]: string[]) => `TO_VARCHAR(${x})`,
  replaceRegexpAll: ([s, p, r]) => `REGEXP_REPLACE(${s}, ${p}, ${r})`,
  today: () => 'CURRENT_DATE()',
  multiIf: (args) => {
    const parts: string[] = []
    for (let i = 0; i + 1 < args.length; i += 2) parts.push(`WHEN ${args[i]} THEN ${args[i + 1]}`)
    return `CASE ${parts.join(' ')} ELSE ${args[args.length - 1]} END`
  },
}

const CALL = new RegExp(`\\b(${Object.keys(RULES).join('|')})\\s*\\(`, 'g')

/** Rewrites every known call, innermost arguments first, until none are left. */
function rewriteCalls(sql: string): string {
  let out = ''
  let pos = 0
  CALL.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CALL.exec(sql))) {
    const name = m[1] as string
    const open = m.index + m[0].length - 1
    let close = matchParen(sql, open)
    let args = splitArgs(sql.slice(open + 1, close)).map(rewriteCalls)
    let params: string[] | null = null
    if (PARAMETRIC.has(name) && sql[close + 1] === '(') {
      const open2 = close + 1
      const close2 = matchParen(sql, open2)
      params = splitArgs(sql.slice(open2 + 1, close2)).map(rewriteCalls)
      close = close2
    }
    out += sql.slice(pos, m.index) + (RULES[name] as Rule)(args, params)
    pos = close + 1
    CALL.lastIndex = pos
  }
  return out + sql.slice(pos)
}

/** {name:Type} placeholders become positional binds; arrays expand to (?, ?, …). */
function bindParams(sql: string, params: Record<string, unknown>): { sql: string; binds: TranslatedQuery['binds'] } {
  const binds: TranslatedQuery['binds'] = []
  const out = sql.replace(/\{(\w+):([A-Za-z0-9_()]+)\}/g, (_all, name: string, type: string) => {
    if (!(name in params)) throw new Error(`Missing query parameter "${name}"`)
    const value = params[name]
    if (type.startsWith('Array')) {
      const values = Array.isArray(value) ? value : []
      if (values.length === 0) return '(NULL)'
      for (const v of values) binds.push(v as string)
      return `(${values.map(() => '?').join(', ')})`
    }
    binds.push(value === undefined ? null : (value as string | number | boolean | null))
    return '?'
  })
  return { sql: out, binds }
}

/** Every `AS alias` in the query, so result keys can be restored to the case the code expects. */
function collectAliases(sql: string): Map<string, string> {
  const aliases = new Map<string, string>()
  for (const m of sql.matchAll(/\bAS\s+([A-Za-z_][A-Za-z0-9_]*)/gi)) {
    const alias = m[1] as string
    aliases.set(alias.toUpperCase(), alias)
  }
  return aliases
}

export function translate(sql: string, params: Record<string, unknown> = {}, qualifiedSchema: string): TranslatedQuery {
  const aliases = collectAliases(sql)
  let out = sql.replace(/\bmigration__marketplace\./gi, `${qualifiedSchema}.`)
  out = rewriteCalls(out)
  const bound = bindParams(out, params)
  return { sql: bound.sql, binds: bound.binds, aliases }
}
