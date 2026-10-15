import { supabase } from './supabase'

export type Perfil = {
  /** YYYY-MM-DD, ou null se a pessoa ainda não marcou a prova */
  data_prova: string | null
  /** Só a conta do dono vê os cards escritos à mão (cards.json) */
  cards_pessoais: boolean
}

/** null = conta ainda sem perfil (primeiro acesso) */
export async function carregarPerfil(): Promise<Perfil | null> {
  const { data, error } = await supabase.from('perfil').select('data_prova, cards_pessoais').maybeSingle()
  if (error) throw error
  return data as Perfil | null
}

export async function salvarDataProva(userId: string, dataProva: string | null): Promise<void> {
  const { error } = await supabase
    .from('perfil')
    .upsert({ user_id: userId, data_prova: dataProva }, { onConflict: 'user_id' })
  if (error) throw error
}
