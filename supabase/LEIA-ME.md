# Banco (Supabase)

Cada arquivo é rodado uma vez no SQL Editor, nesta ordem. Num projeto novo, rode todos; no projeto
atual, todos até `resultado_prova.sql` já foram aplicados.

| Ordem | Arquivo | O que cria |
| --- | --- | --- |
| 1 | `schema.sql` | `progresso` (estado de cada flashcard) e `atividade` (dias da ofensiva) |
| 2 | `revisoes.sql` | `revisoes` (uma linha por avaliação) e a view `revisoes_por_dia` |
| 3 | `simulado.sql` | `questoes`, `simulado_respostas` e o bucket de imagens das questões |
| 4 | `provas.sql` | `provas` (simulados de prova concluídos) |
| 5 | `simulado_tempos.sql` | `simulado_tempos` (tempo dos simulados normais) |
| 6 | `perfil.sql` | `perfil` (dono das anotações) |
| 7 | `resultado_prova.sql` | Resultado da prova, modo treinamento e "zerar flashcards" |
| 8 | `multi_certificacao.sql` | Várias certificações: coluna `certificacao` em tudo, `perfil_certificacao`, `trilha`, ofensiva única |

`multi_certificacao.sql` copia os campos que `resultado_prova.sql` colocou em `perfil` para
`perfil_certificacao`, então precisa rodar depois dele. Rode-o logo antes de publicar o código que
usa várias certificações.

As questões de cada certificação vêm do importador em `scripts/` (material de origem em `materiais/`,
fora do git).
