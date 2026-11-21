/**
 * Catálogo das certificações treinadas no app. Cada certificação é descrita só aqui:
 * domínios (com peso na prova e cor), formato do simulado de prova, badge e validade.
 *
 * Para adicionar uma certificação: um objeto novo em CERTIFICACOES, o badge em
 * public/certificacoes/<id>.png e, quando houver, as anotações em src/data/<id>/cards.json.
 * As questões vão para a tabela questoes com certificacao = <id>.
 */
import type { CardData } from './lib/cards'
import cardsSecplus from './data/secplus/cards.json'

export type DominioCert = {
  /** Como aparece nas questões e nos cards (ex.: "1.0") */
  id: string
  nome: string
  /** Variável de cor definida em index.css */
  cor: string
  /** Peso no exame, em %: define quantas questões de cada domínio entram no simulado de prova */
  peso: number
}

export type Certificacao = {
  /** Identificador nos dados e na URL (?cert=secplus). Nunca mude depois de criado. */
  id: string
  /** Código do exame (ex.: SY0-701) */
  codigo: string
  nome: string
  /** Nome curto para cabeçalhos e mensagens */
  nomeCurto: string
  emissor: string
  /** Badge oficial (baixado do Credly) em public/certificacoes/; sem o arquivo aparece um selo neutro */
  badge: string
  dominios: DominioCert[]
  /** Simulado de prova: quantas questões e quanto tempo */
  prova: { questoes: number; duracaoMin: number }
  /** % de acerto considerado seguro nos simulados (referência de estudo, não a nota oficial) */
  zonaSegura: number
  /** Anos de validade depois da aprovação; null = não expira */
  validadeAnos: number | null
  /** false = aparece como "em breve" (ainda sem banco de questões) */
  disponivel: boolean
  /** Anotações escritas à mão (só aparecem na conta do dono) */
  cards: CardData[]
}

export const CERTIFICACOES: Certificacao[] = [
  {
    id: 'secplus',
    codigo: 'SY0-701',
    nome: 'CompTIA Security+',
    nomeCurto: 'Security+',
    emissor: 'CompTIA',
    badge: '/certificacoes/secplus.png',
    dominios: [
      { id: '1.0', nome: 'General Security Concepts', cor: 'var(--d1)', peso: 12 },
      { id: '2.0', nome: 'Threats, Vulnerabilities, and Mitigations', cor: 'var(--d2)', peso: 22 },
      { id: '3.0', nome: 'Security Architecture', cor: 'var(--d3)', peso: 18 },
      { id: '4.0', nome: 'Security Operations', cor: 'var(--d4)', peso: 28 },
      { id: '5.0', nome: 'Security Program Management and Oversight', cor: 'var(--d5)', peso: 20 },
    ],
    prova: { questoes: 90, duracaoMin: 90 },
    zonaSegura: 85,
    validadeAnos: 3,
    disponivel: true,
    cards: cardsSecplus as CardData[],
  },
  {
    id: 'az900',
    codigo: 'AZ-900',
    nome: 'Microsoft Azure Fundamentals',
    nomeCurto: 'AZ-900',
    emissor: 'Microsoft',
    badge: '/certificacoes/az900.png',
    // Provisório: conferir domínios, pesos e formato no guia oficial antes de importar as questões
    dominios: [
      { id: '1.0', nome: 'Describe cloud concepts', cor: 'var(--d1)', peso: 27 },
      { id: '2.0', nome: 'Describe Azure architecture and services', cor: 'var(--d3)', peso: 38 },
      { id: '3.0', nome: 'Describe Azure management and governance', cor: 'var(--d5)', peso: 35 },
    ],
    prova: { questoes: 50, duracaoMin: 45 },
    zonaSegura: 85,
    validadeAnos: null,
    disponivel: false,
    cards: [],
  },
]

export const PADRAO = CERTIFICACOES[0]

export function certificacaoPorId(id: string | null | undefined): Certificacao | null {
  return CERTIFICACOES.find((c) => c.id === id) ?? null
}

export function dominioDe(cert: Certificacao, id: string): DominioCert {
  return cert.dominios.find((d) => d.id === id) ?? { id, nome: id, cor: 'var(--muted)', peso: 0 }
}
