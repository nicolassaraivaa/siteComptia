import { useState, type FormEvent } from 'react'
import { CERTIFICACOES, certificacaoPorId, type Certificacao } from '../certificacoes'
import { diaSP, diasEntre, formatarDataCompleta } from '../lib/datas'
import {
  apagarItem,
  atualizarItem,
  criarItem,
  situacaoValidade,
  validade,
  type ItemTrilha,
  type NovoItemTrilha,
} from '../lib/trilha'
import BadgeCertificacao from './BadgeCertificacao'
import Castor from './Castor'

type Props = {
  userId: string
  trilha: ItemTrilha[]
  onTrilha: (t: ItemTrilha[]) => void
  onTreinar: (cert: Certificacao) => void
  onVoltar: () => void
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`
}

/** "Minhas certificações": as conquistadas (com validade e credencial) e as próximas metas */
export default function MinhasCertificacoes({ userId, trilha, onTrilha, onTreinar, onVoltar }: Props) {
  const [editando, setEditando] = useState<ItemTrilha | 'nova-conquistada' | 'nova-meta' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const hoje = diaSP(new Date())

  const conquistadas = trilha
    .filter((i) => i.status === 'conquistada')
    .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))
  const metas = trilha.filter((i) => i.status === 'meta').sort((a, b) => (a.data ?? '9999').localeCompare(b.data ?? '9999'))

  async function apagar(item: ItemTrilha) {
    if (!window.confirm(`Apagar "${item.nome}" da sua trilha?`)) return
    setErro(null)
    try {
      await apagarItem(item.id)
    } catch (e) {
      setErro(`Não foi possível apagar (${(e as Error).message}).`)
      return
    }
    onTrilha(trilha.filter((i) => i.id !== item.id))
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-6">
      <button
        onClick={onVoltar}
        className="foco -ml-2 flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <span aria-hidden="true">←</span> Certificações
      </button>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Minhas certificações</h1>
      <p className="mt-1 text-muted">As que você já conquistou e as próximas da sua trilha.</p>

      <div aria-live="polite">{erro && <p className="mt-4 text-sm font-medium text-[var(--d2)]">{erro}</p>}</div>

      <section aria-labelledby="conq-titulo" className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="conq-titulo" className="text-xl font-extrabold">
            Conquistadas
          </h2>
          <button
            onClick={() => setEditando('nova-conquistada')}
            aria-label="Adicionar certificação conquistada"
            className="foco shrink-0 rounded-full border border-line px-3 py-1.5 text-sm font-bold transition-colors hover:bg-surface-2"
          >
            + Adicionar
          </button>
        </div>
        {conquistadas.length === 0 ? (
          <div className="flex items-center gap-4 rounded-3xl border border-dashed border-line p-5">
            <Castor pose="pensando" tamanho={64} className="-my-2 shrink-0" />
            <p className="text-sm text-muted">
              Nenhuma ainda. Ao marcar "Aprovado" numa certificação do app ela entra aqui sozinha. As que você tirou fora
              do app, adicione à mão.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {conquistadas.map((i) => {
              const v = situacaoValidade(i, hoje)
              const corValidade =
                v.tipo === 'expirada' ? 'var(--d2)' : v.tipo === 'renovar' ? 'var(--d4)' : 'var(--good)'
              return (
                <li key={i.id} className="flex flex-col rounded-3xl border border-line bg-surface p-5">
                  <div className="flex items-center gap-4">
                    <BadgeCertificacao cert={certificacaoPorId(i.certificacao)} rotulo={i.nome} tamanho={80} />
                    <div className="min-w-0">
                      <p className="text-lg leading-tight font-extrabold">{i.nome}</p>
                      {i.emissor && <p className="text-sm text-muted">{i.emissor}</p>}
                      {i.data && <p className="mt-1 text-sm">Conquistada em {formatarDataCompleta(i.data)}</p>}
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-medium" style={{ color: v.tipo === 'sem-validade' ? 'var(--muted)' : corValidade }}>
                    {v.tipo === 'sem-validade'
                      ? 'Não expira'
                      : v.tipo === 'expirada'
                        ? `Expirou em ${formatarDataCompleta(i.expira_em!)}`
                        : v.tipo === 'renovar'
                          ? `Renove: vence em ${plural(v.dias!, 'dia', 'dias')} (${formatarDataCompleta(i.expira_em!)})`
                          : `Válida até ${formatarDataCompleta(i.expira_em!)}`}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-sm">
                    {i.credencial_url && (
                      <a
                        href={i.credencial_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="foco rounded font-bold underline underline-offset-2"
                      >
                        Verificar credencial
                      </a>
                    )}
                    <button onClick={() => setEditando(i)} className="foco rounded text-muted underline underline-offset-2 hover:text-ink">
                      Editar
                    </button>
                    <button onClick={() => void apagar(i)} className="foco rounded text-muted underline underline-offset-2 hover:text-[var(--d2)]">
                      Apagar
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="metas-titulo" className="mt-10">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="metas-titulo" className="text-xl font-extrabold">
            Próximas certificações
          </h2>
          <button
            onClick={() => setEditando('nova-meta')}
            aria-label="Adicionar meta"
            className="foco shrink-0 rounded-full border border-line px-3 py-1.5 text-sm font-bold transition-colors hover:bg-surface-2"
          >
            + Adicionar
          </button>
        </div>
        {metas.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line p-5 text-sm text-muted">
            Planeje as próximas: escolha a certificação e quando pretende fazer a prova.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {metas.map((i) => {
              const cert = certificacaoPorId(i.certificacao)
              const dias = i.data ? diasEntre(hoje, i.data) : null
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-4 rounded-3xl border border-dashed border-line p-4">
                  <BadgeCertificacao cert={cert} rotulo={i.nome} tamanho={56} apagado />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">{i.nome}</p>
                    <p className="text-sm text-muted">
                      {i.data
                        ? `${formatarDataCompleta(i.data)}${dias !== null && dias > 0 ? ` · em ${plural(dias, 'dia', 'dias')}` : ''}`
                        : 'Sem data planejada'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {cert?.disponivel && (
                      <button
                        onClick={() => onTreinar(cert)}
                        className="foco rounded-xl bg-primary px-3 py-2 font-bold text-on-primary transition-opacity hover:opacity-90"
                      >
                        Treinar
                      </button>
                    )}
                    <button onClick={() => setEditando(i)} className="foco rounded text-muted underline underline-offset-2 hover:text-ink">
                      Editar
                    </button>
                    <button onClick={() => void apagar(i)} className="foco rounded text-muted underline underline-offset-2 hover:text-[var(--d2)]">
                      Apagar
                    </button>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {editando && (
        <FormItem
          userId={userId}
          item={typeof editando === 'string' ? null : editando}
          status={typeof editando === 'string' ? (editando === 'nova-meta' ? 'meta' : 'conquistada') : editando.status}
          onCancelar={() => setEditando(null)}
          onSalvo={(salvo) => {
            const outros = trilha.filter((i) => i.id !== salvo.id)
            onTrilha([...outros, salvo])
            setEditando(null)
          }}
        />
      )}
    </main>
  )
}

const OUTRA = '__outra__'

type FormProps = {
  userId: string
  item: ItemTrilha | null
  status: ItemTrilha['status']
  onCancelar: () => void
  onSalvo: (i: ItemTrilha) => void
}

/** Adicionar ou editar uma conquista ou meta */
function FormItem({ userId, item, status, onCancelar, onSalvo }: FormProps) {
  const [catalogo, setCatalogo] = useState(item ? (item.certificacao ?? OUTRA) : CERTIFICACOES[0].id)
  const [nome, setNome] = useState(item?.nome ?? '')
  const [emissor, setEmissor] = useState(item?.emissor ?? '')
  const [data, setData] = useState(item?.data ?? '')
  const [expira, setExpira] = useState(item?.expira_em ?? '')
  const [url, setUrl] = useState(item?.credencial_url ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const cert = certificacaoPorId(catalogo)
  const conquistada = status === 'conquistada'

  function trocarData(d: string) {
    setData(d)
    // validade sugerida pela certificação do catálogo (dá para mudar)
    if (conquistada && cert && d) setExpira(validade(cert, d) ?? '')
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const nomeFinal = cert ? cert.nome : nome.trim()
    if (!nomeFinal) return setErro('Informe o nome da certificação.')
    if (url.trim() && !/^https:\/\//i.test(url.trim())) return setErro('O link da credencial precisa começar com https://')
    const novo: NovoItemTrilha = {
      status,
      certificacao: cert?.id ?? null,
      nome: nomeFinal,
      emissor: cert ? cert.emissor : emissor.trim() || null,
      data: data || null,
      expira_em: conquistada ? expira || null : null,
      credencial_url: conquistada ? url.trim() || null : null,
    }
    setSalvando(true)
    try {
      onSalvo(item ? await atualizarItem(item.id, novo) : await criarItem(userId, novo))
    } catch (err) {
      setErro(`Não foi possível salvar (${(err as Error).message}).`)
      setSalvando(false)
    }
  }

  const input = 'foco w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink focus:border-ink'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-titulo"
      onKeyDown={(e) => e.key === 'Escape' && !salvando && onCancelar()}
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/60 p-4 backdrop-blur-md sm:items-center"
    >
      <form
        onSubmit={(e) => void salvar(e)}
        className="flex max-h-[90dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-xl"
      >
        <h2 id="form-titulo" className="text-xl font-extrabold">
          {item ? 'Editar' : conquistada ? 'Adicionar conquista' : 'Adicionar meta'}
        </h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-cert" className="text-sm font-medium">
            Certificação
          </label>
          <select id="f-cert" value={catalogo} onChange={(e) => setCatalogo(e.target.value)} className={input} autoFocus>
            {CERTIFICACOES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} ({c.codigo})
              </option>
            ))}
            <option value={OUTRA}>Outra certificação</option>
          </select>
        </div>

        {!cert && (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="f-nome" className="text-sm font-medium">
                Nome
              </label>
              <input id="f-nome" value={nome} onChange={(e) => setNome(e.target.value)} className={input} placeholder="Ex.: CCNA" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="f-emissor" className="text-sm font-medium">
                Emissor
              </label>
              <input id="f-emissor" value={emissor} onChange={(e) => setEmissor(e.target.value)} className={input} placeholder="Ex.: Cisco" />
            </div>
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-data" className="text-sm font-medium">
            {conquistada ? 'Data da aprovação' : 'Quando pretende fazer a prova'}
          </label>
          <input id="f-data" type="date" value={data} onChange={(e) => trocarData(e.target.value)} className={input} />
        </div>

        {conquistada && (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="f-expira" className="text-sm font-medium">
                Validade
              </label>
              <input id="f-expira" type="date" value={expira} onChange={(e) => setExpira(e.target.value)} className={input} />
              <p className="text-xs text-muted">
                {cert?.validadeAnos
                  ? `A ${cert.nomeCurto} vale ${cert.validadeAnos} anos. Deixe em branco se não expira.`
                  : 'Deixe em branco se não expira.'}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="f-url" className="text-sm font-medium">
                Link de verificação (Credly)
              </label>
              <input
                id="f-url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className={input}
                placeholder="https://www.credly.com/badges/..."
              />
            </div>
          </>
        )}

        <div aria-live="polite">{erro && <p className="text-sm font-medium text-[var(--d2)]">{erro}</p>}</div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={salvando}
            className="foco flex-1 rounded-2xl border border-line py-3 font-bold transition-colors hover:bg-surface-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="foco flex-1 rounded-2xl bg-primary py-3 font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
