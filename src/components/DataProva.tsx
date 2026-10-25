import { useState } from 'react'
import { diaSP } from '../lib/datas'
import { salvarDataProva } from '../lib/perfil'
import Castor from './Castor'

type Props = {
  userId: string
  atual: string | null
  /** Primeiro acesso: mostra boas-vindas e a opção de pular */
  primeiroAcesso: boolean
  onSalvo: (dataProva: string | null) => void
  onCancelar?: () => void
}

/** Pergunta a data da prova; ela define a contagem regressiva e o ritmo das revisões */
export default function DataProva({ userId, atual, primeiroAcesso, onSalvo, onCancelar }: Props) {
  const [data, setData] = useState(atual ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const hoje = diaSP(new Date())

  async function salvar(valor: string | null) {
    setErro(null)
    if (valor && valor < hoje) return setErro('Escolha uma data a partir de hoje.')
    setSalvando(true)
    try {
      await salvarDataProva(userId, valor)
    } catch (e) {
      setErro(`Não foi possível salvar (${(e as Error).message}). Tente de novo.`)
      setSalvando(false)
      return
    }
    onSalvo(valor)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      {primeiroAcesso && <Castor tamanho={96} animacao="feliz" className="-ml-2 mb-3" />}
      <h1 className="text-3xl font-extrabold tracking-tight">
        {primeiroAcesso ? 'Bem-vindo ao Sec+ SY0-701' : 'Data da prova'}
      </h1>
      <p className="mt-2 mb-8 text-muted">
        Quando é a sua prova? A data define a contagem regressiva e o ritmo das revisões: perto da prova, todos os cards
        voltam com mais frequência.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (data) void salvar(data)
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="data-prova" className="text-sm font-medium">
            Data da prova
          </label>
          <input
            id="data-prova"
            name="data-prova"
            type="date"
            required
            min={hoje}
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="foco w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink focus:border-ink"
          />
        </div>

        <div aria-live="polite">{erro && <p className="text-sm font-medium text-[var(--d2)]">{erro}</p>}</div>

        <button
          type="submit"
          disabled={salvando || !data}
          className="foco rounded-2xl bg-primary py-4 text-lg font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {salvando ? 'Salvando…' : 'Salvar data'}
        </button>
      </form>

      <div className="mt-4 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => void salvar(null)}
          disabled={salvando}
          className="foco rounded px-2 py-1 text-sm text-muted underline underline-offset-2 hover:text-ink"
        >
          {primeiroAcesso || !atual ? 'Ainda não marquei a prova' : 'Remover a data'}
        </button>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="foco rounded px-2 py-1 text-sm text-muted underline underline-offset-2 hover:text-ink"
          >
            Voltar
          </button>
        )}
      </div>
    </main>
  )
}
