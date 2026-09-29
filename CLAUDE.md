# Sec+ Flashcards — instruções

App de flashcards para a Security+ SY0-701 (prova em 17/10/2026). Cards em `src/data/cards.json`, progresso no Supabase.

## Quando eu mandar erros de simulado ou anotações

1. Leia `src/data/cards.json` inteiro antes de criar qualquer coisa, para evitar duplicatas.
2. Para cada erro, gere de 1 a 3 cards seguindo as regras abaixo.
3. Se o conceito já tem card: não duplique. Melhore o verso do card existente (mantendo o id) ou, se o erro for uma confusão diferente, crie um card de contraste novo.
4. `origem`: `"simulado"` para erros do dia. `"backlog"` só quando eu disser que é a carga das anotações antigas.
5. `adicionado_em` = data de hoje.
6. Rode `npm run validate` e corrija até passar.
7. Faça commit com a mensagem `cards: +N (dominios X, Y)` e push.
8. No fim, me diga quantos cards criou por domínio e liste as frentes.

**Quando a tarefa for só adicionar cards, não mexa no código do app.**

## Regras de qualidade dos cards

- Um conceito por card.
- A frente é uma pergunta sobre o conceito. Nunca "qual a resposta da questão X" nem referência à letra marcada.
- Se o erro foi de aplicação, use um cenário curto na frente, porque a prova é baseada em cenários. Exemplo: "Uma pessoa sem crachá entra no prédio logo atrás de um funcionário. Qual é o ataque?"
- Verso: primeira linha com a resposta direta, depois 1 ou 2 linhas de explicação. Se houve confusão, adicione uma linha "Não confundir: X ≠ Y porque...". Máximo de 5 linhas.
- Termos técnicos em inglês, como aparecem na prova (tailgating, RPO, SASE, etc.). Explicação em português.
- Se o erro foi confundir dois conceitos, crie um card de contraste: uma pergunta que só um dos dois responde. Se valer a pena, crie um card para cada lado.
- Listas e sequências (por exemplo, as fases de incident response): nunca "liste as N fases". Divida em cards do tipo "o que acontece na fase X" ou "qual fase vem depois de X".
- Se a anotação estiver ambígua, pergunte antes de criar. Não invente conteúdo.
- id: `d{numero-do-dominio}-{slug-do-conceito}`, por exemplo `d5-rpo-vs-rto`. Se já existir, use o sufixo `-2`, `-3`.
- **Nunca altere nem reutilize um id existente.** O progresso das revisões está ligado a ele.
- Nunca apague cards. Se um card estiver errado, corrija o texto mantendo o id.

## Segurança

- Só a anon key vai no frontend. Nunca use `service_role`.
- `.env.local` nunca vai para o git.
