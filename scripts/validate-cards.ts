import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ORIGENS } from '../src/config.ts'
import { CERTIFICACOES } from '../src/certificacoes.ts'

const CAMPOS_TEXTO = ['id', 'frente', 'verso', 'dominio', 'origem', 'adicionado_em'] as const
let falhou = false

// Um cards.json por certificação: src/data/<id>/cards.json
for (const cert of CERTIFICACOES) {
  const arquivo = `src/data/${cert.id}/cards.json`
  const path = fileURLToPath(new URL(`../${arquivo}`, import.meta.url))
  if (!existsSync(path)) continue
  const DOMINIOS = Object.fromEntries(cert.dominios.map((d) => [d.id, d.nome]))
  if (!validar(arquivo, path, DOMINIOS)) falhou = true
}
process.exit(falhou ? 1 : 0)

function validar(arquivo: string, path: string, DOMINIOS: Record<string, string>): boolean {
const erros: string[] = []
let cards: unknown

try {
  cards = JSON.parse(readFileSync(path, 'utf8'))
} catch (e) {
  console.error(`${arquivo} inválido: ${(e as Error).message}`)
  return false
}

if (!Array.isArray(cards)) {
  console.error(`${arquivo} precisa ser um array`)
  return false
}

const ids = new Set<string>()

cards.forEach((card: Record<string, unknown>, i) => {
  const ref = `card[${i}]${typeof card?.id === 'string' ? ` (${card.id})` : ''}`
  if (typeof card !== 'object' || card === null) {
    erros.push(`${ref}: não é um objeto`)
    return
  }

  for (const campo of CAMPOS_TEXTO) {
    const v = card[campo]
    if (typeof v !== 'string' || v.trim() === '') erros.push(`${ref}: campo "${campo}" ausente ou vazio`)
  }

  if (card.questao_original !== undefined && typeof card.questao_original !== 'string') {
    erros.push(`${ref}: campo "questao_original" precisa ser texto`)
  }

  if (!Array.isArray(card.tags) || card.tags.some((t) => typeof t !== 'string' || t.trim() === '')) {
    erros.push(`${ref}: campo "tags" precisa ser um array de strings não vazias`)
  }

  if (typeof card.id === 'string') {
    if (ids.has(card.id)) erros.push(`${ref}: id duplicado`)
    ids.add(card.id)
  }

  if (typeof card.dominio === 'string' && !(card.dominio in DOMINIOS)) {
    erros.push(`${ref}: dominio "${card.dominio}" inválido (use ${Object.keys(DOMINIOS).join(', ')})`)
  }

  if (typeof card.origem === 'string' && !(ORIGENS as readonly string[]).includes(card.origem)) {
    erros.push(`${ref}: origem "${card.origem}" inválida (use ${ORIGENS.join(', ')})`)
  }

  if (typeof card.adicionado_em === 'string') {
    const d = card.adicionado_em
    const valida = /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d
    if (!valida) erros.push(`${ref}: adicionado_em "${d}" fora do formato YYYY-MM-DD`)
  }
})

if (erros.length > 0) {
  console.error(`✗ ${erros.length} erro(s) em ${arquivo}:`)
  for (const e of erros) console.error(`  - ${e}`)
  return false
}

console.log(`✓ ${arquivo}: ${cards.length} cards válidos`)
return true
}
