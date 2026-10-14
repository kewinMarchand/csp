import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import {
  buildCsp,
  cspReportRoute,
  defaultDirectives,
  handleCspReport,
  MAX_REPORT_LENGTH,
  startupLine,
} from '../src/index.ts'

import type { Directives } from '../src/index.ts'

interface Cases {
  header: {
    name: string
    apiOrigin: string | null
    extra: Directives
    reportUri: string | null
    expected: string
  }[]
  reports: { name: string; body: string; status: number; line: string | null }[]
}

// Mêmes cas que les tests PHP : les deux implémentations doivent écrire exactement les mêmes en-têtes et les mêmes phrases
const cases = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8')) as Cases

/** Corps JSON valide d'exactement `length` caractères. */
const bodyOfLength = (length: number) => {
  const shell = '{"csp-report":{"blocked-uri":""}}'
  return shell.replace('""', `"${'a'.repeat(length - shell.length)}"`)
}

describe('en-tête', () => {
  it.each(cases.header)('$name', ({ apiOrigin, extra, reportUri, expected }) => {
    const directives = defaultDirectives({ apiOrigin: apiOrigin ?? undefined, extra })
    expect(buildCsp(directives, reportUri ? { reportUri } : {})).toBe(expected)
  })
})

describe('rapport', () => {
  it.each(cases.reports)('$name', ({ body, status, line }) => {
    const result = handleCspReport(body)
    expect(result.status).toBe(status)
    expect(result.line ?? null).toBe(line)
  })

  it(`accepte ${MAX_REPORT_LENGTH} caractères et refuse au-delà (413)`, () => {
    expect(handleCspReport(bodyOfLength(MAX_REPORT_LENGTH)).status).toBe(204)
    expect(handleCspReport(bodyOfLength(MAX_REPORT_LENGTH + 1))).toEqual({ status: 413 })
  })
})

describe('route', () => {
  const post = (body: BodyInit, headers: HeadersInit = {}) =>
    new Request('http://localhost/api/csp-report', {
      method: 'POST',
      body,
      headers,
      duplex: 'half',
    } as RequestInit)

  it('répond 204 et écrit la ligne du rapport', async () => {
    const log = vi.fn()
    const [report] = cases.reports
    if (!report) throw new Error('tests/cases.json : aucun rapport')
    const response = await cspReportRoute({ log })(post(report.body))
    expect(response.status).toBe(204)
    expect(log).toHaveBeenCalledExactlyOnceWith(report.line)
  })

  it('répond 400 sans rien écrire', async () => {
    const log = vi.fn()
    expect((await cspReportRoute({ log })(post('pas du JSON'))).status).toBe(400)
    expect(log).not.toHaveBeenCalled()
  })

  it('répond 413 sur un corps trop long', async () => {
    const log = vi.fn()
    expect((await cspReportRoute({ log })(post(bodyOfLength(MAX_REPORT_LENGTH + 1)))).status).toBe(
      413,
    )
    expect(log).not.toHaveBeenCalled()
  })

  it('répond 413 sur un Content-Length annoncé trop grand, sans lire le corps', async () => {
    const response = await cspReportRoute()(
      post('{}', { 'content-length': String(MAX_REPORT_LENGTH * 10) }),
    )
    expect(response.status).toBe(413)
  })

  it("s'arrête dès la limite dépassée sur un envoi par morceaux", async () => {
    let sent = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1
        controller.enqueue(new TextEncoder().encode('a'.repeat(4_000)))
        if (sent === 100) controller.close()
      },
    })
    const response = await cspReportRoute()(post(stream))
    expect(response.status).toBe(413)
    expect(sent).toBeLessThan(10)
  })
})

it('écrit la ligne de démarrage du serveur', () => {
  expect(startupLine('boutique', 'production')).toBe('[boutique] serveur démarré (production)')
})
