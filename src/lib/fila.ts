import { State, type Card } from 'ts-fsrs'
import { FUSO, LIMITE_BACKLOG_DIA } from '../config'
import { CARDS, CARDS_BY_ID, type CardData, type Dominio } from './cards'
import { emAprendizado } from './fsrs'
import type { ProgressoMap } from './progresso'

export type Filtro = Dominio | 'todos'

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })

/** YYYY-MM-DD no fuso de São Paulo */
export function diaSP(d: Date): string {
  return fmtDia.format(d)
}

export function passaFiltro(card: CardData, filtro: Filtro): boolean {
  return filtro === 'todos' || card.dominio === filtro
}

/** Cards de backlog introduzidos hoje (qualquer domínio) */
export function backlogIntroduzidosHoje(progresso: ProgressoMap, now: Date): number {
  const hoje = diaSP(now)
  let n = 0
  for (const [id, p] of progresso) {
    if (CARDS_BY_ID.get(id)?.origem === 'backlog' && diaSP(p.createdAt) === hoje) n++
  }
  return n
}

function porAdicionado(a: CardData, b: CardData): number {
  return a.adicionado_em.localeCompare(b.adicionado_em)
}

export type ItemFila = { data: CardData; card: Card | null }

export type FilaInicial = {
  aprendizado: ItemFila[] // due <= agora, ordenado por due
  revisoes: ItemFila[]
  novosSimulado: ItemFila[]
  novosBacklog: ItemFila[]
}

export function montarFila(progresso: ProgressoMap, filtro: Filtro, now: Date): FilaInicial {
  const aprendizado: ItemFila[] = []
  const revisoes: ItemFila[] = []
  const novosSim: CardData[] = []
  const novosBack: CardData[] = []

  for (const data of CARDS) {
    if (!passaFiltro(data, filtro)) continue
    const p = progresso.get(data.id)
    if (!p) {
      if (data.origem === 'simulado') novosSim.push(data)
      else novosBack.push(data)
      continue
    }
    if (p.card.due > now) continue
    if (emAprendizado(p.card)) aprendizado.push({ data, card: p.card })
    else if (p.card.state === State.Review) revisoes.push({ data, card: p.card })
  }

  const byDue = (a: ItemFila, b: ItemFila) => a.card!.due.getTime() - b.card!.due.getTime()
  const restanteBacklog = Math.max(0, LIMITE_BACKLOG_DIA - backlogIntroduzidosHoje(progresso, now))

  return {
    aprendizado: aprendizado.sort(byDue),
    revisoes: revisoes.sort(byDue),
    novosSimulado: novosSim.sort(porAdicionado).map((data) => ({ data, card: null })),
    novosBacklog: novosBack
      .sort(porAdicionado)
      .slice(0, restanteBacklog)
      .map((data) => ({ data, card: null })),
  }
}

/** Próximo vencimento entre os cards do filtro (para a tela de fim) */
export function proximoVencimento(progresso: ProgressoMap, filtro: Filtro): Date | null {
  let min: Date | null = null
  for (const [id, p] of progresso) {
    const data = CARDS_BY_ID.get(id)
    if (!data || !passaFiltro(data, filtro)) continue
    if (!min || p.card.due < min) min = p.card.due
  }
  return min
}
