export const LIMITE_BACKLOG_DIA = 20

export const FUSO = 'America/Sao_Paulo'

export const DATA_PROVA = '2026-11-21'

/** "21 de novembro" */
export const DATA_PROVA_TEXTO = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
}).format(new Date(`${DATA_PROVA}T12:00:00Z`))

export const DOMINIOS = {
  '1.0': 'General Security Concepts',
  '2.0': 'Threats, Vulnerabilities, and Mitigations',
  '3.0': 'Security Architecture',
  '4.0': 'Security Operations',
  '5.0': 'Security Program Management and Oversight',
} as const

export const ORIGENS = ['backlog', 'simulado'] as const

/** Cor de cada domínio (variáveis definidas em index.css) */
export const DOMINIO_COR = {
  '1.0': 'var(--d1)',
  '2.0': 'var(--d2)',
  '3.0': 'var(--d3)',
  '4.0': 'var(--d4)',
  '5.0': 'var(--d5)',
} as const
