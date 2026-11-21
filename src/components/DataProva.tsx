import { useState } from 'react'
import { diaSP } from '../lib/datas'
import { salvarDataProva, salvarTreino } from '../lib/perfil'
import Castor, { type Pose } from './Castor'

type Props = {
  userId: string
  atual: string | null
  /** Está no modo treinamento (sem data de prova) */
  treino?: boolean
  /** Primeiro acesso: mostra boas-vindas e a opção de pular */
  primeiroAcesso: boolean
  /** Abertura no lugar do título padrão (ex.: depois de uma reprovação) */
  intro?: { pose: Pose; titulo: string; texto: string }
  /** treino = escolheu só treinar, sem data */
  onSalvo: (dataProva: string | null, treino: boolean) => void
  onCancelar?: () => void
}

/** Pergunta a data da prova; ela define a contagem regressiva e o ritmo das revisões */
export default function DataProva({ userId, atual, treino = false, primeiroAcesso, intro, onSalvo, onCancelar }: Props) {
  // uma data que já passou (a prova feita) não volta preenchida
  const [data, setData] = useState(() => (atual && atual >= diaSP(new Date()) ? atual : ''))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const hoje = diaSP(new Date())

  async function salvar(valor: string | null, soTreinar = false) {
    setErro(null)
    if (valor && valor < hoje) return setErro('Escolha uma data a partir de hoje.')
    setSalvando(true)
    try {
      if (soTreinar) await salvarTreino(userId)
      else await salvarDataProva(userId, valor)
    } catch (e) {
      setErro(`Não foi possível salvar (${(e as Error).message}). Tente de novo.`)
      setSalvando(false)
      return
    }
    onSalvo(soTreinar ? null : valor, soTreinar)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      {(primeiroAcesso || intro) && <Castor pose={intro?.pose ?? 'neutro'} tamanho={120} className="-ml-3 mb-2" />}
      <h1 className="text-3xl font-extrabold tracking-tight text-balance">
        {intro?.titulo ?? (primeiroAcesso ? 'Bem-vindo ao Sec+ SY0-701' : 'Data da prova')}
      </h1>
      {intro && <p className="mt-2 text-muted">{intro.texto}</p>}
      <p className={`${intro ? 'mt-4' : 'mt-2'} mb-8 text-muted`}>
        Quando é a sua prova? A data define a contagem regressiva e o ritmo das revisões: perto da prova, todos os cards
        voltam com mais frequência. Se for só para treinar, dá para seguir sem data.
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

      <button
        type="button"
        onClick={() => void salvar(null, true)}
        disabled={salvando}
        aria-pressed={treino}
        className={`foco mt-3 rounded-2xl border-2 py-3 font-bold transition-colors hover:bg-surface-2 disabled:opacity-50 ${
          treino ? 'border-ink bg-surface-2' : 'border-line'
        }`}
      >
        {treino ? '✓ Modo treinamento' : 'Só treinar, sem data de prova'}
      </button>

      <div className="mt-4 flex flex-col items-center gap-2">
        {!intro && (
          <button
            type="button"
            onClick={() => void salvar(null)}
            disabled={salvando}
            className="foco rounded px-2 py-1 text-sm text-muted underline underline-offset-2 hover:text-ink"
          >
            {primeiroAcesso || (!atual && !treino) ? 'Ainda não marquei a prova' : 'Remover a data'}
          </button>
        )}
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
