import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs'

const MAXIMO_DIAS = 7 // a prova é em 17/10: nenhum card pode ser agendado para mais de 7 dias

export const f = fsrs(
  generatorParameters({
    request_retention: 0.9,
    maximum_interval: MAXIMO_DIAS,
    enable_fuzz: true,
    enable_short_term: true,
  }),
)

export const GRADES = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const

/**
 * f.repeat com teto rígido de MAXIMO_DIAS. O ts-fsrs força Hard < Good < Easy
 * depois de aplicar maximum_interval, então Good/Easy podem passar de 7 dias.
 */
export function previa(card: Card, now: Date): Record<Grade, Card> {
  const log = f.repeat(card, now)
  const teto = new Date(now.getTime() + MAXIMO_DIAS * 86_400_000)
  const out = {} as Record<Grade, Card>
  for (const g of GRADES) {
    const c = log[g].card
    out[g] = c.due > teto ? { ...c, due: teto, scheduled_days: Math.min(c.scheduled_days, MAXIMO_DIAS) } : c
  }
  return out
}

export type EstadoJson = Omit<Card, 'due' | 'last_review'> & {
  due: string
  last_review: string | null
}

export function serializeCard(card: Card): EstadoJson {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review ? card.last_review.toISOString() : null,
  }
}

export function deserializeCard(estado: EstadoJson): Card {
  const { last_review, due, ...rest } = estado
  return {
    ...rest,
    due: new Date(due),
    ...(last_review ? { last_review: new Date(last_review) } : {}),
  }
}

export function novoCard(): Card {
  return createEmptyCard(new Date())
}

export function emAprendizado(card: Card): boolean {
  return card.state === State.Learning || card.state === State.Relearning
}

export const BOTOES: { grade: Grade; label: string; tecla: string; cor: string }[] = [
  { grade: Rating.Again, label: 'Errei', tecla: '1', cor: 'bg-red-600 hover:bg-red-700' },
  { grade: Rating.Hard, label: 'Difícil', tecla: '2', cor: 'bg-amber-600 hover:bg-amber-700' },
  { grade: Rating.Good, label: 'Bom', tecla: '3', cor: 'bg-green-600 hover:bg-green-700' },
  { grade: Rating.Easy, label: 'Fácil', tecla: '4', cor: 'bg-sky-600 hover:bg-sky-700' },
]

/** "1 min", "10 min", "3 h", "4 d" */
export function formatIntervalo(due: Date, now: Date): string {
  const min = Math.max(1, Math.round((due.getTime() - now.getTime()) / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h`
  return `${Math.round(h / 24)} d`
}
