import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs'
import { diasAteProva, FIM_DA_VESPERA } from './datas'

/**
 * Intervalo máximo encolhe conforme a prova chega, para todo card voltar
 * várias vezes na reta final sem desperdiçar revisões agora.
 */
export function maximoDias(now: Date): number {
  const faltam = diasAteProva(now)
  if (faltam > 21) return 14
  if (faltam > 7) return 7
  return 3
}

export const f = fsrs(
  generatorParameters({
    request_retention: 0.9,
    maximum_interval: 14, // o teto real é aplicado em previa()
    enable_fuzz: true,
    enable_short_term: true,
  }),
)

export const GRADES = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const

/**
 * f.repeat com teto rígido de maximoDias(now), e nada agendado para depois da
 * véspera da prova. O teto é aplicado aqui porque o ts-fsrs força Hard < Good < Easy
 * depois de aplicar maximum_interval, e Good/Easy podem passar do limite.
 */
export function previa(card: Card, now: Date): Record<Grade, Card> {
  const log = f.repeat(card, now)
  const dias = maximoDias(now)
  let teto = new Date(now.getTime() + dias * 86_400_000)
  if (FIM_DA_VESPERA > now && FIM_DA_VESPERA < teto) teto = FIM_DA_VESPERA
  const out = {} as Record<Grade, Card>
  for (const g of GRADES) {
    const c = log[g].card
    out[g] = c.due > teto ? { ...c, due: teto, scheduled_days: Math.min(c.scheduled_days, dias) } : c
  }
  return out
}

/** Contadores próprios do app (o lapses do FSRS não conta erros em cards novos) */
export type Stats = { revisoes: number; erros: number }

export type EstadoJson = Omit<Card, 'due' | 'last_review'> & {
  due: string
  last_review: string | null
  stats?: Stats
}

export function serializeCard(card: Card, stats: Stats): EstadoJson {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review ? card.last_review.toISOString() : null,
    stats,
  }
}

export function deserializeCard(estado: EstadoJson): Card {
  const { last_review, due, stats: _stats, ...rest } = estado
  return {
    ...rest,
    due: new Date(due),
    ...(last_review ? { last_review: new Date(last_review) } : {}),
  }
}

/** Linhas salvas antes dos contadores existirem: usa reps/lapses do FSRS como aproximação */
export function deserializeStats(estado: EstadoJson): Stats {
  return estado.stats ?? { revisoes: estado.reps, erros: estado.lapses }
}

export function somarStats(anterior: Stats | undefined, grade: Grade): Stats {
  const base = anterior ?? { revisoes: 0, erros: 0 }
  return { revisoes: base.revisoes + 1, erros: base.erros + (grade === Rating.Again ? 1 : 0) }
}

export function novoCard(): Card {
  return createEmptyCard(new Date())
}

export function emAprendizado(card: Card): boolean {
  return card.state === State.Learning || card.state === State.Relearning
}

export const BOTOES: { grade: Grade; label: string; tecla: string; cor: string }[] = [
  { grade: Rating.Again, label: 'Errei', tecla: '1', cor: 'var(--d2)' },
  { grade: Rating.Hard, label: 'Difícil', tecla: '2', cor: 'var(--d4)' },
  { grade: Rating.Good, label: 'Bom', tecla: '3', cor: 'var(--good)' },
  { grade: Rating.Easy, label: 'Fácil', tecla: '4', cor: 'var(--d1)' },
]

/** "1 min", "10 min", "3 h", "4 d" */
export function formatIntervalo(due: Date, now: Date): string {
  const min = Math.max(1, Math.round((due.getTime() - now.getTime()) / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h`
  return `${Math.round(h / 24)} d`
}
