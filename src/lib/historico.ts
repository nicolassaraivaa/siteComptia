import type { Grade } from 'ts-fsrs'
import { diaSP } from './datas'
import type { Resposta } from './questoes'
import { supabase } from './supabase'

/** Flashcards revisados num dia */
export type CardsDoDia = { cards: number; erros: number }
export type CardsPorDia = Map<string, CardsDoDia>

/** Grava uma linha por avaliação de card (tabela revisoes) */
export async function registrarRevisao(userId: string, cardId: string, nota: Grade): Promise<void> {
  const { error } = await supabase.from('revisoes').insert({ user_id: userId, card_id: cardId, nota })
  if (error) throw error
}

export async function carregarCardsPorDia(): Promise<CardsPorDia> {
  const { data, error } = await supabase.from('revisoes_por_dia').select('dia, cards, erros')
  if (error) throw error
  return new Map((data as { dia: string; cards: number; erros: number }[]).map((r) => [r.dia, { cards: r.cards, erros: r.erros }]))
}

/** Questões do simulado respondidas num dia */
export type QuestoesDoDia = { questoes: number; certas: number; corrigidas: number; simulados: number }

export function questoesPorDia(respostas: Resposta[]): Map<string, QuestoesDoDia> {
  const dias = new Map<string, QuestoesDoDia & { ids: Set<string> }>()
  for (const r of respostas) {
    const dia = diaSP(new Date(r.respondida_em))
    let d = dias.get(dia)
    if (!d) dias.set(dia, (d = { questoes: 0, certas: 0, corrigidas: 0, simulados: 0, ids: new Set() }))
    d.questoes++
    if (r.resultado !== 'pendente') d.corrigidas++
    if (r.resultado === 'certa') d.certas++
    d.ids.add(r.simulado_id)
    d.simulados = d.ids.size
  }
  return dias
}

/** Um simulado feito, montado a partir das respostas com o mesmo simulado_id */
export type SimuladoFeito = {
  id: string
  inicio: Date
  dia: string
  total: number
  certas: number
  erradas: number // errada + parcial
  pendentes: number
}

export function simuladosFeitos(respostas: Resposta[]): SimuladoFeito[] {
  const porId = new Map<string, SimuladoFeito>()
  for (const r of respostas) {
    const quando = new Date(r.respondida_em)
    let s = porId.get(r.simulado_id)
    if (!s) porId.set(r.simulado_id, (s = { id: r.simulado_id, inicio: quando, dia: '', total: 0, certas: 0, erradas: 0, pendentes: 0 }))
    if (quando < s.inicio) s.inicio = quando
    s.total++
    if (r.resultado === 'certa') s.certas++
    else if (r.resultado === 'pendente') s.pendentes++
    else s.erradas++
  }
  const lista = [...porId.values()]
  for (const s of lista) s.dia = diaSP(s.inicio)
  return lista.sort((a, b) => b.inicio.getTime() - a.inicio.getTime())
}
