import type { Card } from 'ts-fsrs'
import { deserializeCard, deserializeStats, serializeCard, type EstadoJson, type Stats } from './fsrs'
import { supabase } from './supabase'

export type Progresso = {
  card: Card
  createdAt: Date
  updatedAt: Date
  stats: Stats
}

export type ProgressoMap = Map<string, Progresso>

type Row = { card_id: string; estado: EstadoJson; created_at: string; updated_at: string }

const PAGINA = 1000

export async function carregarProgresso(): Promise<ProgressoMap> {
  const map: ProgressoMap = new Map()
  for (let from = 0; ; from += PAGINA) {
    const { data, error } = await supabase
      .from('progresso')
      .select('card_id, estado, created_at, updated_at')
      .order('card_id')
      .range(from, from + PAGINA - 1)
    if (error) throw error
    for (const row of data as Row[]) {
      map.set(row.card_id, {
        card: deserializeCard(row.estado),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        stats: deserializeStats(row.estado),
      })
    }
    if (data.length < PAGINA) break
  }
  return map
}

export async function salvarProgresso(userId: string, cardId: string, card: Card, stats: Stats): Promise<void> {
  const now = new Date().toISOString()
  // created_at não é enviado: fica com a data da primeira revisão
  const { error } = await supabase.from('progresso').upsert(
    {
      user_id: userId,
      card_id: cardId,
      estado: serializeCard(card, stats),
      due: card.due.toISOString(),
      updated_at: now,
    },
    { onConflict: 'user_id,card_id' },
  )
  if (error) throw error
}
