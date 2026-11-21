import { supabase } from './supabase'

export type ResultadoProva = 'aprovado' | 'reprovado'

/** Da conta toda (tabela perfil) */
export type PerfilConta = {
  /** Só a conta do dono vê as anotações escritas à mão (src/data/<cert>/cards.json) */
  cards_pessoais: boolean
  /** Última certificação treinada: destaque na tela de entrada */
  ultima_certificacao: string | null
}

/** De uma certificação (tabela perfil_certificacao) */
export type Perfil = {
  /** YYYY-MM-DD, ou null se a pessoa ainda não marcou a prova */
  data_prova: string | null
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
  treino: false,
  resultado: null,
  resultado_data: null,
  flashcards_zerados_em: null,
  ciclo_inicio: 1,
}

export const CONTA_VAZIA: PerfilConta = { cards_pessoais: false, ultima_certificacao: null }

const COLUNAS_CERT = 'certificacao, data_prova, treino, resultado, resultado_data, flashcards_zerados_em, ciclo_inicio'

function lerPerfil(d: Partial<Perfil>): Perfil {
  return {
    data_prova: d.data_prova ?? null,
    treino: d.treino ?? false,
    resultado: d.resultado ?? null,
    resultado_data: d.resultado_data ?? null,
    flashcards_zerados_em: d.flashcards_zerados_em ?? null,
    ciclo_inicio: d.ciclo_inicio ?? 1,
  }
}

export async function carregarConta(): Promise<PerfilConta> {
  const { data, error } = await supabase.from('perfil').select('cards_pessoais, ultima_certificacao').maybeSingle()
  if (error) throw error
  return { ...CONTA_VAZIA, ...(data as Partial<PerfilConta> | null) }
}

export async function salvarUltimaCertificacao(userId: string, cert: string): Promise<void> {
  const { error } = await supabase
    .from('perfil')
    .upsert({ user_id: userId, ultima_certificacao: cert }, { onConflict: 'user_id' })
  if (error) throw error
}

/** Perfil de cada certificação que a pessoa já abriu, pelo id da certificação */
export async function carregarPerfis(): Promise<Map<string, Perfil>> {
  const { data, error } = await supabase.from('perfil_certificacao').select(COLUNAS_CERT)
  if (error) throw error
  return new Map((data as (Partial<Perfil> & { certificacao: string })[]).map((d) => [d.certificacao, lerPerfil(d)]))
}

/** null = primeira vez nesta certificação */
export async function carregarPerfil(cert: string): Promise<Perfil | null> {
  const { data, error } = await supabase.from('perfil_certificacao').select(COLUNAS_CERT).eq('certificacao', cert).maybeSingle()
  if (error) throw error
  return data ? lerPerfil(data as Partial<Perfil>) : null
}

async function gravar(userId: string, cert: string, campos: Partial<Perfil>): Promise<void> {
  const { error } = await supabase
    .from('perfil_certificacao')
    .upsert({ user_id: userId, certificacao: cert, ...campos }, { onConflict: 'user_id,certificacao' })
  if (error) throw error
}

/** Marca a data da prova (sai do modo treinamento) ou, com null, fica sem data */
export function salvarDataProva(userId: string, cert: string, dataProva: string | null): Promise<void> {
  return gravar(userId, cert, { data_prova: dataProva, treino: false })
}

/** Modo treinamento: sem data de prova, sem contagem regressiva */
export function salvarTreino(userId: string, cert: string): Promise<void> {
  return gravar(userId, cert, { data_prova: null, treino: true })
}

export function salvarResultado(userId: string, cert: string, resultado: ResultadoProva, dataProva: string): Promise<void> {
  return gravar(userId, cert, { resultado, resultado_data: dataProva })
}

/** Apaga progresso e histórico de revisões desta certificação e recomeça a volta do simulado */
export async function zerarFlashcards(cert: string): Promise<void> {
  const { error } = await supabase.rpc('zerar_flashcards', { p_certificacao: cert })
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
