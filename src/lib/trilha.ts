import type { Certificacao } from '../certificacoes'
import { diasEntre } from './datas'
import { supabase } from './supabase'

/** Certificação conquistada ou meta futura (tabela trilha) */
export type ItemTrilha = {
  id: string
  status: 'conquistada' | 'meta'
  /** Id do catálogo do app, quando é uma das certificações daqui (usa o badge dela) */
  certificacao: string | null
  nome: string
  emissor: string | null
  /** Conquistada: quando passou. Meta: quando pretende fazer */
  data: string | null
  /** Validade da conquistada; null = não expira */
  expira_em: string | null
  credencial_url: string | null
}

export type NovoItemTrilha = Omit<ItemTrilha, 'id'>

const COLUNAS = 'id, status, certificacao, nome, emissor, data, expira_em, credencial_url'

export async function carregarTrilha(): Promise<ItemTrilha[]> {
  const { data, error } = await supabase.from('trilha').select(COLUNAS).order('data', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as ItemTrilha[]
}

export async function criarItem(userId: string, item: NovoItemTrilha): Promise<ItemTrilha> {
  const { data, error } = await supabase.from('trilha').insert({ user_id: userId, ...item }).select(COLUNAS).single()
  if (error) throw error
  return data as ItemTrilha
}

export async function atualizarItem(id: string, item: NovoItemTrilha): Promise<ItemTrilha> {
  const { data, error } = await supabase.from('trilha').update(item).eq('id', id).select(COLUNAS).single()
  if (error) throw error
  return data as ItemTrilha
}

export async function apagarItem(id: string): Promise<void> {
  const { error } = await supabase.from('trilha').delete().eq('id', id)
  if (error) throw error
}

/** Data de validade a partir da aprovação (null = não expira) */
export function validade(cert: Certificacao, aprovadoEm: string): string | null {
  if (cert.validadeAnos === null) return null
  const [a, m, d] = aprovadoEm.split('-').map(Number)
  return `${a + cert.validadeAnos}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Aprovada no app: vira conquista na trilha (uma vez por certificação e data) e a meta
 * dessa certificação, se havia, sai da lista.
 */
export async function registrarConquista(userId: string, cert: Certificacao, aprovadoEm: string): Promise<void> {
  const { data, error } = await supabase
    .from('trilha')
    .select('id, status')
    .eq('certificacao', cert.id)
  if (error) throw error
  const itens = data as { id: string; status: string }[]
  for (const meta of itens.filter((i) => i.status === 'meta')) await apagarItem(meta.id)
  const { data: mesma, error: e2 } = await supabase
    .from('trilha')
    .select('id')
    .eq('certificacao', cert.id)
    .eq('status', 'conquistada')
    .eq('data', aprovadoEm)
  if (e2) throw e2
  if ((mesma as unknown[]).length > 0) return
  await criarItem(userId, {
    status: 'conquistada',
    certificacao: cert.id,
    nome: cert.nome,
    emissor: cert.emissor,
    data: aprovadoEm,
    expira_em: validade(cert, aprovadoEm),
    credencial_url: null,
  })
}

/** Antecedência do aviso de renovação */
export const AVISO_RENOVACAO_DIAS = 180

export type SituacaoValidade = { tipo: 'valida' | 'renovar' | 'expirada' | 'sem-validade'; dias: number | null }

export function situacaoValidade(item: ItemTrilha, hoje: string): SituacaoValidade {
  if (!item.expira_em) return { tipo: 'sem-validade', dias: null }
  const dias = diasEntre(hoje, item.expira_em)
  if (dias < 0) return { tipo: 'expirada', dias }
  if (dias <= AVISO_RENOVACAO_DIAS) return { tipo: 'renovar', dias }
  return { tipo: 'valida', dias }
}
