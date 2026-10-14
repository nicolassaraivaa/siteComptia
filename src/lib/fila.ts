import { State, type Card } from 'ts-fsrs'
import { LIMITE_BACKLOG_DIA } from '../config'
import type { CardData, Dominio } from './cards'
import { diaSP } from './datas'
import { emAprendizado } from './fsrs'
import type { ProgressoMap } from './progresso'

export { diaSP }

export type Filtro = Dominio | 'todos'

export function passaFiltro(card: CardData, filtro: Filtro): boolean {
  return filtro === 'todos' || card.dominio === filtro
}

export type Baralho = { cards: CardData[]; porId: Map<string, CardData> }

export function montarBaralho(cards: CardData[]): Baralho {
  return { cards, porId: new Map(cards.map((c) => [c.id, c])) }
}

/** Cards de backlog introduzidos hoje (qualquer domínio) */
export function backlogIntroduzidosHoje(baralho: Baralho, progresso: ProgressoMap, now: Date): number {
  const hoje = diaSP(now)
  let n = 0
  for (const [id, p] of progresso) {
    if (baralho.porId.get(id)?.origem === 'backlog' && diaSP(p.createdAt) === hoje) n++
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

export function montarFila(baralho: Baralho, progresso: ProgressoMap, filtro: Filtro, now: Date): FilaInicial {
  const aprendizado: ItemFila[] = []
  const revisoes: ItemFila[] = []
  const novosSim: CardData[] = []
  const novosBack: CardData[] = []

  for (const data of baralho.cards) {
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
  const restanteBacklog = Math.max(0, LIMITE_BACKLOG_DIA - backlogIntroduzidosHoje(baralho, progresso, now))

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
export function proximoVencimento(baralho: Baralho, progresso: ProgressoMap, filtro: Filtro): Date | null {
  let min: Date | null = null
  for (const [id, p] of progresso) {
    const data = baralho.porId.get(id)
    if (!data || !passaFiltro(data, filtro)) continue
    if (!min || p.card.due < min) min = p.card.due
  }
  return min
}
