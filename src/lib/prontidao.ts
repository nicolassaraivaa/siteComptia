import type { Certificacao } from '../certificacoes'
import type { Prova, Resposta } from './questoes'

/** Quantos simulados de prova recentes entram na média */
export const PROVAS_NA_MEDIA = 3
/** Parte do banco que precisa ter sido vista ao menos uma vez para confiar na média */
export const COBERTURA_MINIMA = 80

export type Prontidao = {
  nivel: 'sem-dados' | 'cedo' | 'quase' | 'pronto'
  /** Média de acerto dos últimos simulados de prova (%), ou null sem nenhum */
  media: number | null
  /** Quantos simulados de prova entraram na média */
  provas: number
  /** % das questões do banco já respondidas pelo menos uma vez */
  cobertura: number
}

/**
 * Estimativa "pronto para a prova?": média dos últimos simulados de prova comparada com a zona
 * segura da certificação, e quanto do banco já foi visto. É referência de estudo, não previsão
 * da nota oficial.
 */
export function calcularProntidao(cert: Certificacao, provas: Prova[], respostas: Resposta[], totalQuestoes: number): Prontidao {
  const vistas = new Set(respostas.map((r) => r.questao)).size
  const cobertura = totalQuestoes === 0 ? 0 : Math.round((vistas / totalQuestoes) * 100)

  const recentes = [...provas].sort((a, b) => b.finalizada_em.localeCompare(a.finalizada_em)).slice(0, PROVAS_NA_MEDIA)
  const placares = recentes.flatMap((p) => {
    const rs = respostas.filter((r) => r.simulado_id === p.id && r.resultado !== 'pendente')
    return rs.length === 0 ? [] : [(rs.filter((r) => r.resultado === 'certa').length / rs.length) * 100]
  })
  if (placares.length === 0) return { nivel: 'sem-dados', media: null, provas: 0, cobertura }

  const media = Math.round(placares.reduce((s, x) => s + x, 0) / placares.length)
  const nivel =
    media >= cert.zonaSegura && cobertura >= COBERTURA_MINIMA ? 'pronto' : media >= cert.zonaSegura - 10 ? 'quase' : 'cedo'
  return { nivel, media, provas: placares.length, cobertura }
}
