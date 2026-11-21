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

// A Security+ mantém a chave antiga: uma revisão em andamento sobrevive à atualização do app
const chave = (userId: string, cert: string) =>
  cert === 'secplus' ? `revisao-em-andamento:${userId}` : `revisao-em-andamento:${userId}:${cert}`

export function lerRevisaoGuardada(userId: string, cert: string): RevisaoGuardada | null {
  try {
    const bruto = localStorage.getItem(chave(userId, cert))
    if (!bruto) return null
    const g = JSON.parse(bruto) as RevisaoGuardada
    if (g.dia === diaSP(new Date())) return g
    localStorage.removeItem(chave(userId, cert))
  } catch {
    // sem armazenamento local a revisão só não é retomada
  }
  return null
}

export function guardarRevisao(userId: string, cert: string, g: RevisaoGuardada | null) {
  try {
    if (g) localStorage.setItem(chave(userId, cert), JSON.stringify(g))
    else localStorage.removeItem(chave(userId, cert))
  } catch {
    // idem
  }
}
