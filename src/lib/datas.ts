import { FUSO } from '../config'

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })

/** YYYY-MM-DD no fuso de São Paulo */
export function diaSP(d: Date): string {
  return fmtDia.format(d)
}

/** Dias corridos entre duas datas YYYY-MM-DD */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000)
}

export function diasAteProva(now: Date, dataProva: string): number {
  return diasEntre(diaSP(now), dataProva)
}

/** Último instante da véspera da prova (23:59 em São Paulo, UTC-3) */
export function fimDaVespera(dataProva: string): Date {
  return new Date(Date.parse(`${dataProva}T00:00:00-03:00`) - 60_000)
}

const fmtDataLonga = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' })

/** "21 de novembro" */
export function formatarDataProva(dataProva: string): string {
  return fmtDataLonga.format(new Date(`${dataProva}T12:00:00Z`))
}

/** Soma (ou subtrai) dias corridos de uma data YYYY-MM-DD */
export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
