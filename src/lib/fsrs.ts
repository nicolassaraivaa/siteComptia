import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs'
import { diasAteProva, fimDaVespera } from './datas'

/**
 * Intervalo máximo encolhe conforme a prova chega, para todo card voltar
 * várias vezes na reta final sem desperdiçar revisões agora.
 * Sem data de prova (ou prova já passada), fica em 14 dias.
 */
export function maximoDias(now: Date, dataProva: string | null): number {
  if (!dataProva) return 14
  const faltam = diasAteProva(now, dataProva)
  if (faltam < 0) return 14
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

const DIA = 86_400_000

export const GRADES = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const

/**
 * Encolhe um intervalo para ficar abaixo do limite, com diferença visível na tela
 * (ex.: "8 d" e "14 d", nunca "14 d" e "14 d"). Se já está abaixo, fica como está.
 */
function abaixoDe(ms: number, limite: number): number {
  const rotulo = (x: number) => formatIntervalo(new Date(x), new Date(0))
  if (ms < limite && rotulo(ms) !== rotulo(limite)) return ms
  for (const fator of [0.6, 0.5, 0.4, 0.3, 0.2]) {
    const x = limite * fator
    if (rotulo(x) !== rotulo(limite)) return x
  }
  return limite * 0.1
}

/**
 * f.repeat com teto rígido de maximoDias(), e nada agendado para depois da
 * véspera da prova. Depois do teto, garante Difícil < Bom < Fácil: sem isso,
 * os três batiam no limite e ficavam iguais (ex.: 14 d, 14 d, 14 d).
 * Quando o teto corta, Fácil fica no teto, Bom em ~60% dele e Difícil em ~60% do Bom.
 */
export function previa(card: Card, now: Date, dataProva: string | null): Record<Grade, Card> {
  const log = f.repeat(card, now)
  const dias = maximoDias(now, dataProva)
  let teto = new Date(now.getTime() + dias * DIA)
  const vespera = dataProva ? fimDaVespera(dataProva) : null
  if (vespera && vespera > now && vespera < teto) teto = vespera

  const t = now.getTime()
  const ms = (g: Grade) => Math.min(log[g].card.due.getTime(), teto.getTime()) - t
  const facil = ms(Rating.Easy)
  const bom = abaixoDe(ms(Rating.Good), facil)
  const dificil = abaixoDe(ms(Rating.Hard), bom)
  const intervalo: Record<Grade, number> = {
    [Rating.Again]: ms(Rating.Again),
    [Rating.Hard]: dificil,
    [Rating.Good]: bom,
    [Rating.Easy]: facil,
  }

  const out = {} as Record<Grade, Card>
  for (const g of GRADES) {
    const c = log[g].card
    const due = t + intervalo[g]
    out[g] = due === c.due.getTime() ? c : { ...c, due: new Date(due), scheduled_days: Math.round(intervalo[g] / DIA) }
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

/**
 * Linhas salvas antes dos contadores existirem começam do zero: reps/lapses do FSRS
 * não registram "Errei" em card novo e deixariam o acerto artificialmente em 100%.
 */
export function deserializeStats(estado: EstadoJson): Stats {
  return estado.stats ?? { revisoes: 0, erros: 0 }
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
