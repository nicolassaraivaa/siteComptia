import { useState } from 'react'
import { precisaDoIngles, type Questao } from '../lib/questoes'
import ImagemQuestao from './ImagemQuestao'

type Props = {
  q: Questao
  /** Letras marcadas (simulado ou correção) */
  marcadas?: string[]
  /** Quando presente, as alternativas são clicáveis */
  onAlternar?: (letra: string) => void
  /** Mostra gabarito, explicação, nota e imagens de resposta das simulações */
  revelar?: boolean
}

export default function QuestaoVisao({ q, marcadas = [], onAlternar, revelar = false }: Props) {
  const [ingles, setIngles] = useState(() => precisaDoIngles(q))
  const multipla = q.tipo === 'multipla'

  return (
    <div className="flex flex-col gap-4">
      <div>
        {multipla && (
          <p className="mb-2 inline-block rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold">
            Escolha {q.escolha}
          </p>
        )}
        <p className="text-lg leading-snug font-bold whitespace-pre-line break-words">{q.enunciado_pt}</p>
        <button
          type="button"
          onClick={() => setIngles((v) => !v)}
          aria-expanded={ingles}
          className="foco mt-2 rounded text-sm text-muted underline underline-offset-2 hover:text-ink"
        >
          {ingles ? 'Ocultar original em inglês' : 'Ver original em inglês'}
        </button>
        {ingles && (
          <p lang="en" className="mt-2 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed whitespace-pre-line break-words">
            {q.enunciado_en}
          </p>
        )}
      </div>

      {q.imagens_enunciado.map((nome, i) => (
        <ImagemQuestao key={nome} nome={nome} alt={`Imagem ${i + 1} do enunciado da questão ${q.numero}`} />
      ))}

      {q.tipo === 'simulacao' ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Simulação: resolva olhando as imagens (toque para ampliar). No fim do simulado você compara com a resposta e
            marca se acertou.
          </p>
          {q.imagens_simulacao_enunciado.map((nome, i) => (
            <ImagemQuestao key={nome} nome={nome} alt={`Tela ${i + 1} da simulação da questão ${q.numero}`} />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2" role={onAlternar ? (multipla ? 'group' : 'radiogroup') : undefined}>
          {q.alternativas.map((a) => {
            const marcada = marcadas.includes(a.letra)
            const correta = q.resposta.includes(a.letra)
            let estilo = 'border-line'
            if (revelar && correta) estilo = 'border-[var(--good)] bg-[color-mix(in_srgb,var(--good)_12%,var(--surface))]'
            else if (revelar && marcada) estilo = 'border-[var(--d2)] bg-[color-mix(in_srgb,var(--d2)_10%,var(--surface))]'
            else if (marcada) estilo = 'border-ink bg-surface-2'
            const conteudo = (
              <>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
                    marcada ? 'border-ink bg-ink text-bg' : 'border-line'
                  }`}
                  aria-hidden="true"
                >
                  {a.letra}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words">{a.pt || a.en}</span>
                  {ingles && a.en && a.en !== a.pt && (
                    <span lang="en" className="mt-0.5 block text-sm text-muted break-words">
                      {a.en}
                    </span>
                  )}
                  {a.imagem && (
                    <span className="mt-2 block">
                      <ImagemQuestao nome={a.imagem} alt={`Alternativa ${a.letra} da questão ${q.numero}`} />
                    </span>
                  )}
                  {revelar && (correta || marcada) && (
                    <span className={`mt-1 block text-xs font-bold ${correta ? 'text-[var(--good)]' : 'text-[var(--d2)]'}`}>
                      {correta ? (marcada ? 'Correta · sua resposta' : 'Correta') : 'Sua resposta'}
                    </span>
                  )}
                </span>
              </>
            )
            return (
              <li key={a.letra}>
                {onAlternar ? (
                  <button
                    type="button"
                    role={multipla ? 'checkbox' : 'radio'}
                    aria-checked={marcada}
                    onClick={() => onAlternar(a.letra)}
                    className={`foco flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition-colors hover:bg-surface-2 ${estilo}`}
                  >
                    {conteudo}
                  </button>
                ) : (
                  <div className={`flex items-start gap-3 rounded-2xl border-2 p-3 ${estilo}`}>{conteudo}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {revelar && (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          {q.tipo === 'simulacao' && (
            <>
              <p className="font-bold">Resposta</p>
              {q.imagens_simulacao_resposta.map((nome, i) => (
                <ImagemQuestao key={nome} nome={nome} alt={`Resposta ${i + 1} da simulação da questão ${q.numero}`} />
              ))}
            </>
          )}
          {q.nota && (
            <p className="rounded-xl border-l-4 border-[var(--d4)] bg-surface-2 p-3 text-sm">
              <span className="font-bold">⚠ Nota do tradutor: </span>
              {q.nota}
            </p>
          )}
          {q.explicacao && <p className="leading-relaxed whitespace-pre-line break-words">{q.explicacao}</p>}
          {q.links && (
            <details className="text-sm text-muted">
              <summary className="foco cursor-pointer rounded">Links de referência</summary>
              <p className="mt-2 whitespace-pre-line break-all">{q.links}</p>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
