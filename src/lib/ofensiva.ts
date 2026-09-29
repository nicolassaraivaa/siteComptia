import { diaSP } from './fila'
import type { ProgressoMap } from './progresso'
import { supabase } from './supabase'

/** Dias (YYYY-MM-DD, fuso SP) com pelo menos uma revisão */
export async function carregarDias(): Promise<Set<string>> {
  const { data, error } = await supabase.from('atividade').select('dia')
  if (error) throw error
  return new Set((data as { dia: string }[]).map((r) => r.dia))
}

export async function registrarDia(userId: string, dia: string): Promise<void> {
  const { error } = await supabase
    .from('atividade')
    .upsert({ user_id: userId, dia }, { onConflict: 'user_id,dia', ignoreDuplicates: true })
  if (error) throw error
}

/** Dias de revisão que dá para deduzir do progresso (primeira e última revisão de cada card) */
export function diasDoProgresso(progresso: ProgressoMap): string[] {
  const dias: string[] = []
  for (const p of progresso.values()) dias.push(diaSP(p.createdAt), diaSP(p.updatedAt))
  return dias
}

export function diaAnterior(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export type Ofensiva = {
  atual: number
  hojeFeito: boolean
  recorde: number
  semana: { dia: string; feito: boolean }[] // últimos 7 dias, terminando hoje
}

export function calcularOfensiva(dias: Set<string>, hoje: string): Ofensiva {
  const hojeFeito = dias.has(hoje)
  // Se ainda não revisou hoje, a ofensiva de ontem continua viva até o fim do dia
  let atual = 0
  for (let d = hojeFeito ? hoje : diaAnterior(hoje); dias.has(d); d = diaAnterior(d)) atual++

  let recorde = 0
  for (const d of dias) {
    if (dias.has(diaAnterior(d))) continue // só conta a partir do início de cada sequência
    let n = 0
    for (let x = d; dias.has(x); ) {
      n++
      const prox = new Date(`${x}T12:00:00Z`)
      prox.setUTCDate(prox.getUTCDate() + 1)
      x = prox.toISOString().slice(0, 10)
    }
    recorde = Math.max(recorde, n)
  }

  const semana: Ofensiva['semana'] = []
  for (let i = 0, d = hoje; i < 7; i++, d = diaAnterior(d)) semana.unshift({ dia: d, feito: dias.has(d) })

  return { atual, hojeFeito, recorde, semana }
}
