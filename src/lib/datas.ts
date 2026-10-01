import { DATA_PROVA, FUSO } from '../config'

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })

/** YYYY-MM-DD no fuso de São Paulo */
export function diaSP(d: Date): string {
  return fmtDia.format(d)
}

/** Dias corridos entre duas datas YYYY-MM-DD */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000)
}

export function diasAteProva(now: Date): number {
  return diasEntre(diaSP(now), DATA_PROVA)
}

/** Último instante da véspera da prova (23:59 em São Paulo, UTC-3) */
export const FIM_DA_VESPERA = new Date(Date.parse(`${DATA_PROVA}T00:00:00-03:00`) - 60_000)
