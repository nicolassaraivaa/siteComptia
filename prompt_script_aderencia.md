# Prompt — Script de aderência de inventário de firewalls

## Objetivo

Crie um script Python, organizado como um pequeno projeto documentado, que mede a **aderência** de uma base de inventário de firewalls em relação a uma **base de referência** (fonte da verdade). O script gera um **relatório executivo** explicando o resultado.

- Referência (fonte da verdade): `OPREDE_v12.xlsx`
- Base avaliada: `Netops.xlsx`

O script precisa ser genérico. No futuro vou rodar a mesma análise com outra base avaliada (ex.: NetShield), trocando só o arquivo de entrada e o arquivo de mapeamento de colunas.

## Regras gerais

- Python 3.10+, com pandas, openpyxl, python-docx e PyYAML. Não use outras bibliotecas sem me perguntar.
- Nunca altere os arquivos de entrada.
- Leia todas as células como texto (`dtype=str`). Serial e IP nunca podem virar número nem notação científica.
- Toda regra numérica (pesos, notas, faixas, alertas, campos obrigatórios) fica em arquivo de configuração, não no código.
- Código com type hints, docstrings em português e funções pequenas. Nenhuma lógica de negócio dentro do CLI.
- **Antes de implementar,** liste os cabeçalhos reais das duas planilhas e me mostre o mapeamento de colunas proposto (seção 3). Só continue depois que eu confirmar.

---

## 1. Estrutura do projeto

```
aderencia_inventario/
├── README.md
├── requirements.txt
├── config/
│   ├── regras.yaml                # pesos, notas, faixas, alertas, campos obrigatórios
│   └── mapeamento_netops.yaml     # de-para de colunas: base avaliada → referência
├── src/aderencia/
│   ├── __init__.py
│   ├── __main__.py                # permite rodar com python -m aderencia
│   ├── cli.py                     # argumentos e orquestração
│   ├── leitura.py                 # leitura das planilhas e dos cabeçalhos
│   ├── normalizacao.py            # hostname, IP, serial e valores vazios
│   ├── pareamento.py              # identifica o mesmo equipamento nas duas bases
│   ├── indicadores.py             # cobertura, completude, exatidão, registros válidos
│   ├── classificacao.py           # aderência, nota, criticidade, alertas, nota por equipamento
│   ├── relatorio_excel.py         # planilha de detalhamento
│   └── relatorio_executivo.py     # resumo executivo em .docx
├── tests/
│   ├── conftest.py                # bases sintéticas pequenas
│   ├── test_normalizacao.py
│   ├── test_pareamento.py
│   └── test_indicadores.py
└── resultados/                    # saída (não versionar)
```

## 2. Uso

```
python -m aderencia --referencia OPREDE_v12.xlsx --alvo Netops.xlsx --mapeamento config/mapeamento_netops.yaml --saida resultados/
```

Parâmetros opcionais:
- `--aba-referencia` e `--aba-alvo`. Padrão: a primeira aba visível.
- `--regras`. Padrão: `config/regras.yaml`.
- `--nome-alvo`. Padrão: o `nome_base` do mapeamento. É o nome que aparece no relatório.

Saídas:
- `resultados/aderencia_<alvo>_AAAAMMDD.docx`: relatório executivo
- `resultados/aderencia_<alvo>_AAAAMMDD.xlsx`: detalhamento
- No terminal: aderência, criticidade e os 3 principais motivos.

---

## 3. Mapeamento de colunas (`config/mapeamento_netops.yaml`)

O mapeamento diz qual coluna da base avaliada corresponde a cada campo obrigatório da referência. Campo sem coluna equivalente fica `null` e conta como coluna ausente.

Ponto de partida para o NetOps (confirme com os cabeçalhos reais):

```yaml
nome_base: NetOps
campos:
  Hostname: Nome
  IP: IP
  Fabricante: null
  Modelo: Modelo
  OS Version: OS Version
  Localidade: Localizacao
  Tipo: null                 # o "Tipo" do NetOps é o conector/API, não a função do ativo
  Ambiente: Ambiente
  Subambiente: Subambiente
  Serial number: Serial Number
  End Of Support HW: HW End of Support
  End Of Support SW: SW End of Support
  Fisico/Virtual: null
  STATUS Ativado/Desativado: null
hostname_alternativo: Hostname   # usado só no pareamento, quando o principal não casar
```

Compare os cabeçalhos normalizados: sem acento, minúsculo, com espaços e quebras de linha colapsados.

---

## 4. Regras (`config/regras.yaml`)

### 4.1 Campos obrigatórios (14)

| Nível | Campos | Peso | Nota se vazio |
|---|---|---|---|
| A – Identificação | Hostname, IP, Serial number | 3 | 8 |
| A – Identificação | Fabricante, Modelo, STATUS Ativado/Desativado | 3 | 7 |
| B – Versão e suporte | OS Version, End Of Support HW, End Of Support SW | 2 | 5 |
| C – Contexto | Localidade, Tipo, Ambiente, Subambiente, Fisico/Virtual | 1 | 2 |

Coluna de criticidade na referência: `Criticidade Firewall`. O valor mais crítico é `1`.

### 4.2 O que conta como vazio

Conta como não preenchido:
- célula vazia ou só com espaços
- `N/A`, `NA`, `N/D`, `-`, `NULL`, `NONE`
- `#N/A` e outros erros do Excel (`#REF!`, `#VALUE!` etc.)
- IP inválido, incluindo IP gravado como número sem pontos

### 4.3 Indicadores

| Indicador | Fórmula | Peso |
|---|---|---|
| Cobertura | equipamentos pareados ÷ equipamentos da referência | 40% |
| Completude | soma dos pesos dos campos preenchidos ÷ soma dos pesos dos campos aplicáveis, em todos os pareados | 25% |
| Exatidão | pares com hostname, IP e serial iguais ÷ total de pares | 20% |
| Registros válidos | equipamentos pareados ÷ registros da base avaliada | 15% |

- **Campo aplicável:** a referência tem valor naquele campo para aquele equipamento. Se a referência também está vazia ou N/A no campo, ele sai do numerador e do denominador.
- **Coluna obrigatória ausente** na base avaliada: conta como vazia em todos os pareados.
- **Exatidão:** compare os valores normalizados. N/A nos dois lados conta como igual. IP inválido no alvo conta como diferente.

```
Aderência = 0,40 × Cobertura + 0,25 × Completude + 0,20 × Exatidão + 0,15 × Registros válidos   (0 a 100%)
Nota da base = (100 − Aderência) ÷ 10
Pontos perdidos por indicador = peso × (100 − valor do indicador)
```

### 4.4 Criticidade

| Aderência | Criticidade |
|---|---|
| 80% ou mais | Baixa |
| 60% a 79,9% | Média |
| 40% a 59,9% | Alta |
| Abaixo de 40% | Crítica |

Alertas. A criticidade final é a pior entre a faixa e os alertas:
- Cobertura abaixo de 80% → Crítica
- Cobertura entre 80% e 95% → no mínimo Alta
- Firewall de criticidade 1 faltando na base → no mínimo Alta
- Exatidão ou completude abaixo de 50% → no mínimo Alta

### 4.5 Nota por equipamento (fila de correção)

| Problema | Nota |
|---|---|
| Está na referência e falta na base | 10 |
| Hostname, IP ou serial diferente ou vazio | 8 |
| Fabricante, Modelo ou STATUS vazio | 7 |
| Está na base e não está na referência (inclui duplicado) | 6 |
| OS Version ou End Of Support vazio | 5 |
| Localidade, Tipo, Ambiente, Subambiente ou Físico/Virtual vazio | 2 |

- Equipamento com criticidade 1 na referência ganha +2, até o máximo de 10.
- A nota do equipamento é a do seu pior problema.
- Na nota por equipamento, **colunas ausentes não entram**: são um problema estrutural, corrigido uma vez só e listado à parte. Entram só células vazias de colunas que existem.

---

## 5. Normalização

A normalização serve só para comparar. Os relatórios mostram sempre o valor original.

- **Hostname:** maiúsculo, sem espaços nas pontas, sem domínio (tudo após o primeiro "."). "/", "_" e espaço viram "-", e "--" vira "-".
- **IP:** sem espaços nem caracteres invisíveis, validado como IPv4. Número sem pontos = inválido, mas guarde os dígitos para o pareamento.
- **Serial:** maiúsculo, sem espaços nas pontas, sem ".0" no final. Os valores vazios da seção 4.2 e "0" contam como sem serial.

## 6. Pareamento (1 para 1, nesta ordem)

Linha que casa sai do pool e não participa dos passos seguintes.

1. **Serial igual.** Ignorar linha sem serial e serial repetido dentro da mesma base.
2. **Hostname igual.** Usar o campo Hostname do mapeamento; se não casar, tentar o `hostname_alternativo`.
3. **IP igual,** só se pelo menos um dos lados não tiver serial válido. Ignorar IP repetido na mesma base. Para IP do alvo sem pontos, comparar os dígitos com o IP da referência sem pontos e aceitar só se bater com um único.

Casos especiais:
- **Empate** (mais de um candidato no mesmo passo): desempatar por serial, depois IP, depois a primeira linha. Registrar o desempate.
- **Linhas idênticas na referência** (mesmo hostname, serial e IP) contam como um equipamento só.
- **Sobra da referência** = faltando na base.
- **Sobra do alvo** = a mais na base. Marcar como "duplicado" quando a mesma identidade já foi pareada.

**Conferência obrigatória:** referência = pareados + faltando (+ duplicados da referência); alvo = pareados + a mais. Se os totais não fecharem, o script para com erro.

---

## 7. Relatório executivo (.docx), no máximo 2 páginas

Linguagem objetiva, frases curtas e números sempre com o total ("100 de 370"). Estrutura fixa:

1. **Título e dados:** "Aderência do <alvo> à <referência>", data e total de registros de cada base.
2. **Resultado:** aderência em %, criticidade e nota, em destaque, mais uma frase de conclusão. Exemplo: "O NetOps tem 74% de aderência à OPREDE. Criticidade Crítica, principalmente porque 100 de 370 firewalls estão fora do inventário."
3. **Indicadores:** tabela com os 4 indicadores (valor, peso e pontos perdidos).
4. **Por que essa aderência:** os motivos, do que mais tira pontos ao que menos tira. Um motivo por linha, com número e impacto. Cobrir:
   - Equipamentos faltando na base: total e os 3 ambientes ou fabricantes com mais casos
   - Equipamentos a mais na base: total, e quantos são duplicados
   - Identificação divergente: quantos por campo (hostname, IP, serial) e quantos IPs estão sem pontos
   - Colunas obrigatórias ausentes: lista
   - Campos obrigatórios vazios: total de células e os 5 campos com mais vazios
   - Alertas acionados
5. **Fila de correção:** quantos equipamentos há em cada nota (10, 8, 7, 6, 5, 2).
6. **Critério:** no máximo 3 linhas explicando o cálculo, mais "Detalhamento por equipamento na planilha <nome>.xlsx".

Não incluir: hashes, nomes de funções, metodologia longa, categorias como "revisar" ou "candidato", nem explicações de limitações técnicas.

## 8. Planilha de detalhamento (.xlsx)

Abas, nesta ordem:
1. **Resumo:** os mesmos números do relatório, mais a conferência de totais
2. **Faltando na base:** linhas da referência sem par (todas as colunas, linha original e nota)
3. **A mais na base:** linhas do alvo sem par (todas as colunas, linha original e motivo: "sem correspondência" ou "duplicado")
4. **Identificação divergente:** hostname, linha no alvo, linha na referência, campo, valor no alvo e valor na referência
5. **Campos vazios:** um equipamento por linha, com hostname, linha no alvo, quantidade de vazios, lista dos campos e nota
6. **Colunas ausentes:** campo obrigatório, nível e coluna equivalente no alvo (ou "não existe")
7. **Fila de correção:** todos os equipamentos com algum problema, com nota e motivo principal, ordenados pela nota
8. **Critérios:** pesos, notas, faixas e alertas usados (lidos do `regras.yaml`)

Formato: cabeçalho em negrito, filtro ativado, primeira linha congelada, largura das colunas ajustada, IP e serial gravados como texto.

## 9. Testes

Crie bases sintéticas pequenas (10 a 15 linhas) em `tests/conftest.py`, cobrindo:
- par por serial, por hostname e por IP
- IP sem pontos no alvo
- contexto sem serial (N/A nos dois lados)
- equipamento faltando e equipamento a mais
- duplicado no alvo
- coluna obrigatória ausente
- campo vazio no alvo com a referência preenchida, e com a referência também vazia
- firewall de criticidade 1 faltando (aciona o alerta)

Confira os indicadores calculados à mão nesses casos. O `pytest` precisa passar antes de rodar nas planilhas reais.

## 10. README.md

- O que o script faz, em 3 linhas
- Como instalar e rodar
- Como avaliar outra base (criar um novo `mapeamento_<base>.yaml`)
- Como ler o resultado: o que é cada indicador e a criticidade
- Onde alterar pesos, notas e faixas

## 11. Ordem de trabalho

1. Mostrar os cabeçalhos das duas planilhas e o mapeamento proposto, e esperar minha confirmação.
2. Criar a estrutura e implementar.
3. Rodar os testes.
4. Rodar com as planilhas reais.
5. Responder só com: aderência, criticidade, os 3 principais motivos e o caminho dos arquivos gerados.
