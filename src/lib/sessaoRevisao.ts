import { diaSP } from './datas'
import type { Filtro } from './fila'

/** Revisão em andamento guardada no navegador, para continuar de onde parou após recarregar a página */
export type RevisaoGuardada = {
  dia: string // só vale no mesmo dia
  filtro: Filtro
  feitos: number
  atual: string | null // card que estava na tela
  mostrando: boolean // se a resposta já estava aberta
  aprendendo: string[] // cards em aprendizado que ainda vão voltar nesta sessão
}

const chave = (userId: string) => `revisao-em-andamento:${userId}`

export function lerRevisaoGuardada(userId: string): RevisaoGuardada | null {
  try {
    const bruto = localStorage.getItem(chave(userId))
    if (!bruto) return null
    const g = JSON.parse(bruto) as RevisaoGuardada
    if (g.dia === diaSP(new Date())) return g
    localStorage.removeItem(chave(userId))
  } catch {
    // sem armazenamento local a revisão só não é retomada
  }
  return null
}

export function guardarRevisao(userId: string, g: RevisaoGuardada | null) {
  try {
    if (g) localStorage.setItem(chave(userId), JSON.stringify(g))
    else localStorage.removeItem(chave(userId))
  } catch {
    // idem
  }
}
