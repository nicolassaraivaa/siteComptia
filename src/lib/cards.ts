import type { ORIGENS } from '../config'
import type { Questao } from './questoes'

/** Id do domínio dentro da certificação (ex.: "1.0"); a lista fica em src/certificacoes.ts */
export type Dominio = string
export type Origem = (typeof ORIGENS)[number]

export type CardData = {
  id: string
  frente: string
  verso: string
  dominio: Dominio
  origem: Origem
  adicionado_em: string
  questao_original?: string
  tags: string[]
  /** Presente nos cards gerados a partir de questões erradas no simulado */
  questao?: Questao
  /** Dia (YYYY-MM-DD) do erro mais recente no simulado, nos cards de questões */
  ultimo_erro?: string
}
