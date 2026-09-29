import type { DOMINIOS, ORIGENS } from '../config'
import cardsJson from '../data/cards.json'

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
}

export const CARDS = cardsJson as CardData[]
export const CARDS_BY_ID = new Map(CARDS.map((c) => [c.id, c]))
