import type { DOMINIOS, ORIGENS } from '../config'
import cardsJson from '../data/cards.json'
import type { Questao } from './questoes'

export type Dominio = keyof typeof DOMINIOS
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
}

/** Cards escritos à mão (cards.json). O baralho completo inclui também as questões erradas no simulado. */
export const CARDS = cardsJson as CardData[]
