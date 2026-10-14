import type { CardData, Dominio } from './cards'
import { diaSP } from './datas'
import { supabase } from './supabase'

export type Alternativa = { letra: string; pt: string; en: string; imagem?: string }

export type Questao = {
  numero: number
  tipo: 'unica' | 'multipla' | 'simulacao'
  escolha: number
  dominio: Dominio
  enunciado_pt: string
  enunciado_en: string
  alternativas: Alternativa[]
  resposta: string[]
  explicacao: string
  links: string
  nota: string | null
  imagens_enunciado: string[]
  imagens_simulacao_enunciado: string[]
  imagens_simulacao_resposta: string[]
}

export type Resultado = 'certa' | 'errada' | 'parcial' | 'pendente'

export type Resposta = {
  questao: number
  ciclo: number
  simulado_id: string
  marcadas: string[]
  resultado: Resultado
  respondida_em: string
}

const PAGINA = 1000

export async function carregarQuestoes(): Promise<Questao[]> {
  const todas: Questao[] = []
  for (let from = 0; ; from += PAGINA) {
    const { data, error } = await supabase
      .from('questoes')
      .select('*')
      .order('numero')
      .range(from, from + PAGINA - 1)
    if (error) throw error
    todas.push(...(data as Questao[]))
    if (data.length < PAGINA) break
  }
  return todas
}

export async function carregarRespostas(): Promise<Resposta[]> {
  const todas: Resposta[] = []
  for (let from = 0; ; from += PAGINA) {
    const { data, error } = await supabase
      .from('simulado_respostas')
      .select('questao, ciclo, simulado_id, marcadas, resultado, respondida_em')
      .order('respondida_em')
      .range(from, from + PAGINA - 1)
    if (error) throw error
    todas.push(...(data as Resposta[]))
    if (data.length < PAGINA) break
  }
  return todas
}

export async function salvarResposta(userId: string, r: Resposta): Promise<void> {
  const { error } = await supabase
    .from('simulado_respostas')
    .upsert({ user_id: userId, ...r }, { onConflict: 'user_id,questao,ciclo' })
  if (error) throw error
}

/** Só acerta marcando todas as corretas; em "escolha 2", acertar uma é parcial (conta como erro) */
export function corrigir(q: Questao, marcadas: string[]): Resultado {
  if (q.tipo === 'simulacao') return 'pendente'
  const certas = new Set(q.resposta)
  const acertos = marcadas.filter((m) => certas.has(m)).length
  if (acertos === q.resposta.length && marcadas.length === q.resposta.length) return 'certa'
  if (q.tipo === 'multipla' && acertos > 0) return 'parcial'
  return 'errada'
}

export function errou(r: Resultado): boolean {
  return r === 'errada' || r === 'parcial'
}

export type EstadoCiclo = {
  ciclo: number
  vistas: Set<number>
  restantes: number[] // questões ainda não vistas neste ciclo
}

/** Questões só se repetem depois que todas foram vistas no ciclo atual */
export function estadoCiclo(questoes: Questao[], respostas: Resposta[]): EstadoCiclo {
  const ultimo = respostas.reduce((m, r) => Math.max(m, r.ciclo), 1)
  const vistasUltimo = new Set(respostas.filter((r) => r.ciclo === ultimo).map((r) => r.questao))
  const completo = questoes.length > 0 && questoes.every((q) => vistasUltimo.has(q.numero))
  const ciclo = completo ? ultimo + 1 : ultimo
  const vistas = completo ? new Set<number>() : vistasUltimo
  return { ciclo, vistas, restantes: questoes.filter((q) => !vistas.has(q.numero)).map((q) => q.numero) }
}

export function sortear<T>(itens: T[], n: number): T[] {
  const copia = [...itens]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia.slice(0, n)
}

/** O português remete ao texto em inglês (ex.: conteúdo de arquivo que só existe no original) */
export function precisaDoIngles(q: Questao): boolean {
  return /em inglês/i.test(q.enunciado_pt)
}

export function textoResposta(q: Questao): string {
  if (q.tipo === 'simulacao') return 'Resposta nas imagens'
  const certas = q.alternativas.filter((a) => q.resposta.includes(a.letra))
  return `${q.resposta.join(' e ')}. ${certas.map((a) => a.pt || a.en).join(' / ')}`
}

export const prefixoCardQuestao = 'q-'

/** Questões erradas viram flashcards: frente = enunciado, verso = gabarito + explicação */
export function cardsDeQuestoes(questoes: Questao[], respostas: Resposta[]): CardData[] {
  const primeiroErro = new Map<number, string>()
  for (const r of respostas) {
    if (errou(r.resultado) && !primeiroErro.has(r.questao)) primeiroErro.set(r.questao, diaSP(new Date(r.respondida_em)))
  }
  const porNumero = new Map(questoes.map((q) => [q.numero, q]))
  const cards: CardData[] = []
  for (const [numero, dia] of primeiroErro) {
    const q = porNumero.get(numero)
    if (!q) continue
    cards.push({
      id: `${prefixoCardQuestao}${numero}`,
      frente: q.enunciado_pt,
      verso: [textoResposta(q), q.nota ? `⚠ Nota: ${q.nota}` : '', q.explicacao].filter(Boolean).join('\n'),
      dominio: q.dominio,
      origem: 'simulado',
      adicionado_em: dia,
      tags: ['simulado-pdf'],
      questao: q,
    })
  }
  return cards
}
