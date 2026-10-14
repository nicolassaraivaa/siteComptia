"""
Extrai as questões do PDF do simulado (SY0-701 EN/PT-BR) para JSON + imagens.

Uso (precisa de PyMuPDF: pip install pymupdf):
    python scripts/importar_questoes.py SY0-701_PT-BR_completo.pdf questoes-import/

Saída (fora do git):
    questoes-import/questoes.json
    questoes-import/imagens/q{N}_{k}.{ext}   -> enviar para o bucket "questoes" do Storage
    questoes-import/sql/questoes-{1..4}.sql  -> rodar no SQL Editor depois de supabase/simulado.sql

O domínio de cada questão vem de scripts/dominios_questoes.json (classificação manual).

Layout do PDF (gerado pelo Chromium):
- "Questão N" em fonte 12, com "(escolha 2)" em fonte 9 na mesma linha visual
- enunciado em inglês em x=49; tradução dentro de um retângulo azul-claro
- alternativas: "A." em fonte 10.2, texto em inglês 9.6 e tradução 9.4
- "Resposta: X", "EXPLICAÇÃO", "LINKS (ORIGINAL)" (fonte 8)
- "⚠ Nota" dentro de um retângulo laranja; aviso de simulação num retângulo vermelho
"""

import json
import re
import sys
from pathlib import Path

import fitz  # PyMuPDF

AZUL = (0.95, 0.96, 0.99)  # caixa da tradução
NOTA = (1.0, 0.96, 0.88)  # caixa "⚠ Nota"
SIMULACAO = (0.99, 0.93, 0.93)  # caixa "Questão de simulação/hotspot"

# Nas simulações o PDF traz todas as imagens juntas (enunciado e depois a resposta preenchida).
# Quantas das primeiras imagens são enunciado, conferido visualmente imagem por imagem:
SIMULACAO_IMAGENS_ENUNCIADO = {76: 1, 77: 7, 310: 5, 322: 2, 462: 3}


def mesma_cor(a, b):
    return a is not None and all(abs(x - y) < 0.015 for x, y in zip(a, b))


def caixas(desenhos, cor):
    return [d["rect"] for d in desenhos if mesma_cor(d.get("fill"), cor) and d["rect"].height > 5]


def dentro(y, x, rects):
    return any(r.y0 - 2 <= y <= r.y1 + 2 and r.x0 - 2 <= x <= r.x1 + 2 for r in rects)


def itens_da_pagina(doc, pno):
    """Linhas de texto e imagens da página, em ordem de leitura."""
    page = doc[pno]
    desenhos = [d for d in page.get_drawings() if d.get("fill") and d["rect"].height > 5]
    azul, nota, sim = caixas(desenhos, AZUL), caixas(desenhos, NOTA), caixas(desenhos, SIMULACAO)
    out = []
    for b in page.get_text("dict")["blocks"]:
        if b["type"] == 1:
            out.append({"tipo": "img", "y": b["bbox"][1], "x": b["bbox"][0], "ext": b["ext"], "bytes": b["image"],
                        "w": b["width"], "h": b["height"], "pagina": pno + 1})
            continue
        for linha in b["lines"]:
            spans = [s for s in linha["spans"] if s["text"].strip()]
            if not spans:
                continue
            texto = "".join(s["text"] for s in linha["spans"]).strip()
            tamanho = round(spans[0]["size"], 1)
            y, x = linha["bbox"][1], linha["bbox"][0]
            out.append({
                "tipo": "txt", "y": y, "x": x, "texto": texto, "tam": tamanho, "pagina": pno + 1,
                "azul": dentro(y + 3, x + 3, azul), "nota": dentro(y + 3, x + 3, nota), "sim": dentro(y + 3, x + 3, sim),
            })
    # itens com até 3px de diferença vertical são a mesma linha visual (ex.: "A." e o texto da alternativa)
    out.sort(key=lambda i: i["y"])
    linhas, atual = [], []
    for i in out:
        if atual and i["y"] - atual[0]["y"] > 3:
            linhas.append(atual)
            atual = []
        atual.append(i)
    if atual:
        linhas.append(atual)
    return [i for linha in linhas for i in sorted(linha, key=lambda i: i["x"])]


class Texto:
    """Junta linhas quebradas pelo PDF, preservando parágrafos e listas."""

    def __init__(self):
        self.partes: list[str] = []
        self.ultimo = None  # (pagina, y)

    def add(self, item):
        t = item["texto"]
        novo_paragrafo = False
        if self.ultimo is not None:
            pag, y = self.ultimo
            if pag == item["pagina"] and item["y"] - y > 17:
                novo_paragrafo = True
            if re.match(r"^(\d+\.|[-•]) ", t):
                novo_paragrafo = True
        if not self.partes:
            self.partes.append(t)
        elif novo_paragrafo:
            self.partes.append("\n" + t)
        else:
            self.partes.append(" " + t)
        self.ultimo = (item["pagina"], item["y"])

    def valor(self):
        return re.sub(r"[ \t]+", " ", "".join(self.partes)).strip()


def nova_questao(numero):
    return {
        "numero": numero, "escolha": 1, "simulacao": False,
        "enunciado_en": Texto(), "enunciado_pt": Texto(),
        "alternativas": [], "resposta_bruta": None,
        "explicacao": Texto(), "links": Texto(), "nota": Texto(),
        "imagens_enunciado": [], "imagens_explicacao": [], "imagens_simulacao": [], "imagens_alternativas": [],
    }


def extrair(pdf_path, saida):
    doc = fitz.open(pdf_path)
    (saida / "imagens").mkdir(parents=True, exist_ok=True)
    questoes = []
    q = None
    estado = None
    alt = None

    def salvar_imagem(item, lista):
        total = sum(len(q[k]) for k in ("imagens_enunciado", "imagens_explicacao", "imagens_simulacao", "imagens_alternativas"))
        nome = f"q{q['numero']}_{total}.{item['ext']}"
        (saida / "imagens" / nome).write_bytes(item["bytes"])
        lista.append(nome)

    for pno in range(len(doc)):
        for it in itens_da_pagina(doc, pno):
            if it["tipo"] == "txt" and it["tam"] <= 7.5:
                continue  # rodapé

            if it["tipo"] == "txt":
                m = re.match(r"^Questão (\d+)\s*(\(escolha (\d)\))?$", it["texto"])
                if m and it["tam"] >= 11.5:
                    if q:
                        questoes.append(q)
                    q = nova_questao(int(m.group(1)))
                    if m.group(3):
                        q["escolha"] = int(m.group(3))
                    estado, alt = "enunciado", None
                    continue
            if q is None:
                continue  # capa

            if it["tipo"] == "img":
                if q["simulacao"]:
                    salvar_imagem(it, q["imagens_simulacao"])
                elif estado in ("explicacao", "links"):
                    salvar_imagem(it, q["imagens_explicacao"])
                elif estado == "alternativas" and alt is not None:
                    salvar_imagem(it, q["imagens_alternativas"])
                    alt["imagem"] = q["imagens_alternativas"][-1]
                else:
                    salvar_imagem(it, q["imagens_enunciado"])
                continue

            t = it["texto"]
            if t.startswith("Questões com ⚠"):
                break  # última página: índice das notas, não é conteúdo de questão
            m = re.match(r"^\(escolha (\d)\)$", t)
            if m:
                q["escolha"] = int(m.group(1))
                continue
            if it["nota"]:
                q["nota"].add({**it, "texto": re.sub(r"^⚠\s*Nota:\s*", "", t)})
                continue
            if it["sim"]:
                q["simulacao"] = True
                continue

            m = re.match(r"^Resposta:\s*(.*)$", t)
            if m and it["tam"] >= 10.4:
                q["resposta_bruta"] = m.group(1).strip()
                estado = "resposta"
                continue
            if t == "EXPLICAÇÃO" and it["tam"] <= 8.5:
                estado = "explicacao"
                continue
            if t.startswith("LINKS (ORIGINAL)") and it["tam"] <= 8.5:
                estado = "links"
                continue

            if estado in ("enunciado", "alternativas"):
                m = re.match(r"^([A-H])\.\s*(.*)$", t)
                if m and it["tam"] >= 10 and it["x"] < 70:
                    alt = {"letra": m.group(1), "en": Texto(), "pt": Texto()}
                    q["alternativas"].append(alt)
                    estado = "alternativas"
                    if m.group(2):
                        alt["en"].add({**it, "texto": m.group(2)})
                    continue
                if estado == "alternativas" and alt is not None:
                    (alt["pt"] if it["tam"] <= 9.45 else alt["en"]).add(it)
                    continue
                (q["enunciado_pt"] if it["azul"] else q["enunciado_en"]).add(it)
                continue
            if estado == "explicacao":
                q["explicacao"].add(it)
                continue
            if estado == "links":
                q["links"].add(it)
                continue
            if estado == "resposta":
                # texto entre a resposta e a explicação (raro): trata como explicação
                q["explicacao"].add(it)
                continue

    if q:
        questoes.append(q)

    final = []
    for q in questoes:
        bruta = q["resposta_bruta"] or ""
        letras = sorted(set(re.findall(r"[A-H]", bruta))) if "imagem" not in bruta.lower() else []
        final.append({
            "numero": q["numero"],
            "tipo": "simulacao" if q["simulacao"] or "imagem" in bruta.lower() else ("multipla" if q["escolha"] > 1 else "unica"),
            "escolha": q["escolha"],
            "enunciado_pt": q["enunciado_pt"].valor(),
            "enunciado_en": q["enunciado_en"].valor(),
            "alternativas": [
                {"letra": a["letra"], "en": a["en"].valor(), "pt": a["pt"].valor() or a["en"].valor(),
                 **({"imagem": a["imagem"]} if a.get("imagem") else {})}
                for a in q["alternativas"]
            ],
            "resposta": letras,
            "resposta_bruta": bruta,
            "explicacao": q["explicacao"].valor(),
            "links": q["links"].valor(),
            "nota": q["nota"].valor() or None,
            "imagens_enunciado": q["imagens_enunciado"],
            "imagens_explicacao": q["imagens_explicacao"],
            "imagens_simulacao_enunciado": q["imagens_simulacao"][: SIMULACAO_IMAGENS_ENUNCIADO.get(q["numero"], 0)],
            "imagens_simulacao_resposta": q["imagens_simulacao"][SIMULACAO_IMAGENS_ENUNCIADO.get(q["numero"], 0):],
        })
    return final


DOMINIOS = json.loads((Path(__file__).parent / "dominios_questoes.json").read_text())
PARTES_SQL = 4


def gerar_sql(questoes, saida):
    colunas = ["numero", "tipo", "escolha", "dominio", "enunciado_pt", "enunciado_en", "alternativas", "resposta",
               "explicacao", "links", "nota", "imagens_enunciado", "imagens_simulacao_enunciado",
               "imagens_simulacao_resposta"]
    (saida / "sql").mkdir(exist_ok=True)
    tamanho = -(-len(questoes) // PARTES_SQL)
    for i in range(PARTES_SQL):
        lote = [{c: q[c] for c in colunas} for q in questoes[i * tamanho:(i + 1) * tamanho]]
        dados = json.dumps(lote, ensure_ascii=False)
        assert "$questoes$" not in dados
        sql = (
            f"-- Questões {lote[0]['numero']} a {lote[-1]['numero']} (parte {i + 1} de {PARTES_SQL})\n"
            f"insert into public.questoes ({', '.join(colunas)})\n"
            f"select {', '.join(colunas)} from jsonb_populate_recordset(null::public.questoes, $questoes${dados}$questoes$::jsonb)\n"
            f"on conflict (numero) do update set {', '.join(f'{c} = excluded.{c}' for c in colunas[1:])};\n"
        )
        (saida / "sql" / f"questoes-{i + 1}.sql").write_text(sql)


def validar(questoes):
    erros = []
    numeros = [q["numero"] for q in questoes]
    esperado = list(range(1, max(numeros) + 1))
    if numeros != esperado:
        faltam = sorted(set(esperado) - set(numeros))
        dup = sorted({n for n in numeros if numeros.count(n) > 1})
        erros.append(f"numeração: faltam {faltam}, duplicadas {dup}")
    for q in questoes:
        n = q["numero"]
        if q.get("dominio") not in ("1.0", "2.0", "3.0", "4.0", "5.0"):
            erros.append(f"Q{n}: sem domínio em dominios_questoes.json")
        if not q["enunciado_en"]:
            erros.append(f"Q{n}: sem enunciado em inglês")
        if not q["enunciado_pt"]:
            erros.append(f"Q{n}: sem enunciado em português")
        if q["tipo"] == "simulacao":
            if n not in SIMULACAO_IMAGENS_ENUNCIADO:
                erros.append(f"Q{n}: simulação nova; defina quantas imagens são enunciado")
            elif not q["imagens_simulacao_enunciado"] or not q["imagens_simulacao_resposta"]:
                erros.append(f"Q{n}: simulação sem imagens de enunciado ou de resposta")
            continue
        letras = [a["letra"] for a in q["alternativas"]]
        if letras != [chr(65 + i) for i in range(len(letras))] or len(letras) < 2:
            erros.append(f"Q{n}: alternativas fora de ordem ou faltando: {letras}")
        for a in q["alternativas"]:
            if not a["en"] and not a.get("imagem"):
                erros.append(f"Q{n}: alternativa {a['letra']} vazia")
        if not q["resposta"]:
            erros.append(f"Q{n}: sem resposta ({q['resposta_bruta']!r})")
        if any(r not in letras for r in q["resposta"]):
            erros.append(f"Q{n}: resposta {q['resposta']} não está entre {letras}")
        if len(q["resposta"]) != q["escolha"]:
            erros.append(f"Q{n}: escolha {q['escolha']} mas resposta {q['resposta']}")
        if not q["explicacao"]:
            erros.append(f"Q{n}: sem explicação")
    return erros


if __name__ == "__main__":
    pdf, saida = Path(sys.argv[1]), Path(sys.argv[2])
    questoes = extrair(pdf, saida)
    for q in questoes:
        q["dominio"] = DOMINIOS.get(str(q["numero"]))
    (saida / "questoes.json").write_text(json.dumps(questoes, ensure_ascii=False, indent=1))
    erros = validar(questoes)
    tipos = {}
    for q in questoes:
        tipos[q["tipo"]] = tipos.get(q["tipo"], 0) + 1
    print(f"{len(questoes)} questões | tipos: {tipos}")
    print(f"com nota ⚠: {sum(1 for q in questoes if q['nota'])} | "
          f"imagens: enunciado {sum(len(q['imagens_enunciado']) for q in questoes)}, "
          f"explicação {sum(len(q['imagens_explicacao']) for q in questoes)}, "
          f"simulação {sum(len(q['imagens_simulacao_enunciado']) + len(q['imagens_simulacao_resposta']) for q in questoes)}, "
          f"alternativas {sum(1 for q in questoes for a in q['alternativas'] if a.get('imagem'))}")
    if erros:
        print(f"\n✗ {len(erros)} problema(s):")
        for e in erros:
            print("  -", e)
        sys.exit(1)
    gerar_sql(questoes, saida)
    print(f"✓ todas as questões válidas | SQL em {saida / 'sql'}")
