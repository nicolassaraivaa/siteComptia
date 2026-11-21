import { supabase } from './supabase'

export type ResultadoProva = 'aprovado' | 'reprovado'

export type Perfil = {
  /** YYYY-MM-DD, ou null se a pessoa ainda não marcou a prova */
  data_prova: string | null
  /** Só a conta do dono vê os cards escritos à mão (cards.json) */
  cards_pessoais: boolean
  /** Estudando só para treinar, sem data de prova */
  treino: boolean
  /** Resultado informado pela pessoa, e a data_prova a que ele se refere */
  resultado: ResultadoProva | null
  resultado_data: string | null
  /** ISO: flashcards de antes disso foram apagados e não aparecem mais */
  flashcards_zerados_em: string | null
  /** Volta do simulado em que recomeçar depois de zerar */
  ciclo_inicio: number
}

export const PERFIL_VAZIO: Perfil = {
  data_prova: null,
  cards_pessoais: false,
  treino: false,
  resultado: null,
  resultado_data: null,
  flashcards_zerados_em: null,
  ciclo_inicio: 1,
}

/** null = conta ainda sem perfil (primeiro acesso) */
export async function carregarPerfil(): Promise<Perfil | null> {
  // select('*'): sem a migração resultado_prova.sql as colunas novas só ficam com o valor padrão
  const { data, error } = await supabase.from('perfil').select('*').maybeSingle()
  if (error) throw error
  if (!data) return null
  const d = data as Partial<Perfil>
  return {
    ...PERFIL_VAZIO,
    data_prova: d.data_prova ?? null,
    cards_pessoais: d.cards_pessoais ?? false,
    treino: d.treino ?? false,
    resultado: d.resultado ?? null,
    resultado_data: d.resultado_data ?? null,
    flashcards_zerados_em: d.flashcards_zerados_em ?? null,
    ciclo_inicio: d.ciclo_inicio ?? 1,
  }
}

/** Marca a data da prova (sai do modo treinamento) ou, com null, fica sem data */
export async function salvarDataProva(userId: string, dataProva: string | null): Promise<void> {
  const { error } = await supabase
    .from('perfil')
    .upsert({ user_id: userId, data_prova: dataProva, treino: false }, { onConflict: 'user_id' })
  if (!error) return
  // sem a migração resultado_prova.sql a coluna treino não existe: grava só a data, como antes
  if (error.code !== 'PGRST204') throw error
  const semTreino = await supabase.from('perfil').upsert({ user_id: userId, data_prova: dataProva }, { onConflict: 'user_id' })
  if (semTreino.error) throw semTreino.error
}

/** Modo treinamento: sem data de prova, sem contagem regressiva */
export async function salvarTreino(userId: string): Promise<void> {
  const { error } = await supabase
    .from('perfil')
    .upsert({ user_id: userId, data_prova: null, treino: true }, { onConflict: 'user_id' })
  if (error) throw error
}

export async function salvarResultado(userId: string, resultado: ResultadoProva, dataProva: string): Promise<void> {
  const { error } = await supabase
    .from('perfil')
    .upsert({ user_id: userId, resultado, resultado_data: dataProva }, { onConflict: 'user_id' })
  if (error) throw error
}

/** Apaga progresso e histórico de revisões da conta e recomeça a volta do simulado */
export async function zerarFlashcards(): Promise<void> {
  const { error } = await supabase.rpc('zerar_flashcards')
  if (error) throw error
}

/** A prova já chegou e a pessoa ainda não disse como foi */
export function aguardandoResultado(perfil: Perfil | null | undefined, hoje: string): boolean {
  return !!perfil?.data_prova && !perfil.treino && hoje >= perfil.data_prova && perfil.resultado_data !== perfil.data_prova
}

/** Aprovada na prova marcada: antes de um novo simulado, pergunta se vai refazer a prova ou só treinar */
export function aprovadoSemObjetivo(perfil: Perfil | null | undefined): boolean {
  return !!perfil?.data_prova && !perfil.treino && perfil.resultado === 'aprovado' && perfil.resultado_data === perfil.data_prova
}
