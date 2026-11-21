import { useEffect, useRef, useState } from 'react'
import { zerarFlashcards } from '../lib/perfil'
import Castor from './Castor'

type Props = {
  /** Flashcards com progresso salvo: o que some ao apagar */
  totalFlashcards: number
  /** Continuar estudando com os flashcards como estão */
  onContinuar: () => void
  /** Flashcards apagados no banco: o app recarrega os dados da conta */
  onZerado: () => void
}

type Etapa = 'festa' | 'escolha' | 'confirmar' | 'apagando' | 'zerado'

/** Tempo da comemoração antes de perguntar o que fazer com os flashcards */
const FESTA_MS = 3500

/** Aprovação na prova: o Nickols bate palma e depois pergunta se mantém ou apaga os flashcards */
export default function Aprovado({ totalFlashcards, onContinuar, onZerado }: Props) {
  const [etapa, setEtapa] = useState<Etapa>('festa')
  const [erro, setErro] = useState<string | null>(null)
  const foco = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (etapa !== 'festa') return
    const id = setTimeout(() => setEtapa('escolha'), FESTA_MS)
    return () => clearTimeout(id)
  }, [etapa])

  // Cada etapa nova recebe o foco no botão principal
  useEffect(() => {
    foco.current?.focus()
  }, [etapa])

  async function apagar() {
    setErro(null)
    setEtapa('apagando')
    try {
      await zerarFlashcards()
    } catch (e) {
      setErro(`Não foi possível apagar (${(e as Error).message}). Nada foi apagado; tente de novo.`)
      setEtapa('confirmar')
      return
    }
    setEtapa('zerado')
  }

  const festa = etapa === 'festa'

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4 py-10 text-center">
      <Castor
        pose={etapa === 'zerado' ? 'neutro' : 'aplaudindo'}
        tamanho={festa ? 260 : 170}
        rotulo={etapa === 'zerado' ? 'Nickols, o castor' : 'Nickols, o castor, batendo palmas'}
        className="motion-safe:animate-castor-entrar transition-[width,height] duration-500"
      />

      {etapa !== 'zerado' && (
        <>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Aprovado!</h1>
          <p className="mt-2 font-medium text-[var(--good)]">Parabéns pela Security+. O Nickols está aplaudindo de pé.</p>
        </>
      )}

      {festa && (
        <button
          ref={foco}
          onClick={() => setEtapa('escolha')}
          className="foco mt-8 rounded-full px-4 py-2 text-sm font-medium text-muted underline underline-offset-2 hover:text-ink"
        >
          Continuar
        </button>
      )}

      {etapa === 'escolha' && (
        <section aria-labelledby="flash-titulo" className="mt-8 w-full motion-safe:animate-castor-entrar">
          <h2 id="flash-titulo" className="text-xl font-bold">
            E os flashcards?
          </h2>
          <p className="mt-1 text-sm text-muted">
            Você pode continuar revisando ou apagar tudo, já que a prova passou.
          </p>
          <button
            ref={foco}
            onClick={onContinuar}
            className="foco mt-5 w-full rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90"
          >
            Continuar com os flashcards
          </button>
          <button
            onClick={() => setEtapa('confirmar')}
            className="foco mt-2 w-full rounded-2xl border-2 py-3 font-bold transition-colors hover:bg-surface-2"
            style={{ borderColor: 'var(--d2)', color: 'var(--d2)' }}
          >
            Apagar os flashcards
          </button>
        </section>
      )}

      {(etapa === 'confirmar' || etapa === 'apagando') && (
        <section
          role="alertdialog"
          aria-labelledby="apagar-titulo"
          aria-describedby="apagar-texto"
          className="mt-8 w-full rounded-3xl border border-line bg-surface p-5 text-left"
        >
          <h2 id="apagar-titulo" className="text-xl font-bold">
            Apagar todos os flashcards?
          </h2>
          <div id="apagar-texto" className="mt-2 flex flex-col gap-2 text-sm">
            <p>
              Apaga o progresso de {totalFlashcards} {totalFlashcards === 1 ? 'flashcard' : 'flashcards'} e o histórico de
              revisões. <strong>Não dá para desfazer.</strong>
            </p>
            <p className="text-muted">
              O histórico do simulado e das provas continua guardado. Se você fizer o simulado de novo, ele começa uma
              volta nova pelo banco e os erros novos voltam a virar flashcards.
            </p>
          </div>
          <div aria-live="polite">{erro && <p className="mt-3 text-sm font-medium text-[var(--d2)]">{erro}</p>}</div>
          <button
            onClick={() => void apagar()}
            disabled={etapa === 'apagando'}
            className="foco mt-5 w-full rounded-2xl py-4 text-lg font-bold text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: 'var(--d2)' }}
          >
            {etapa === 'apagando' ? 'Apagando…' : 'Apagar tudo'}
          </button>
          <button
            ref={foco}
            onClick={() => setEtapa('escolha')}
            disabled={etapa === 'apagando'}
            className="foco mt-2 w-full rounded-2xl border border-line py-3 font-bold transition-colors hover:bg-surface-2 disabled:opacity-60"
          >
            Voltar
          </button>
        </section>
      )}

      {etapa === 'zerado' && (
        <section aria-labelledby="zerado-titulo" className="mt-4 w-full">
          <h1 id="zerado-titulo" className="text-3xl font-extrabold tracking-tight">
            Flashcards apagados
          </h1>
          <p className="mt-2 text-muted">
            Tudo zerado. Se quiser voltar a treinar, é só começar um simulado na tela inicial.
          </p>
          <button
            ref={foco}
            onClick={onZerado}
            className="foco mt-8 w-full rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90"
          >
            Ir para o início
          </button>
        </section>
      )}
    </main>
  )
}
