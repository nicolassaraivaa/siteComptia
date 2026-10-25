# Mascote Castor

## Arquivos

| Arquivo | Uso |
|---|---|
| `castor-neutro.svg` | Estado padrão: em pé na nuvem, mãos no bolso (flutua, abana o rabo, brilho nos óculos) |
| `castor-acertou.svg` | Resposta certa (pula da nuvem, piscadinha, joinha, brilhos) |
| `castor-errou.svg` | Resposta errada (coça a cabeça, gota de suor) |
| `castor-streak.svg` | Meta/streak batida (pula, fogo, confete) |
| `castor-pensando.svg` | Loading / processando (balão com "...") |
| `castor-logo.svg` | Logo em badge (header, redes, PWA) |
| `castor-icone.svg` | Só a cabeça, fundo transparente (avatar, header) |
| `favicon.svg` | Favicon com contorno reforçado pra ler em 16–32px |
| `png/` | Fallbacks estáticos (favicon 16/32, apple-touch-icon 180, logo 512, poses 512) |
| `gerador-build.js` | Script que gera todos os SVGs. Mude cores no objeto `C` e rode `node gerador-build.js` |

As animações são CSS embutido em cada SVG: funcionam com `<img>`, sem JS.
Também respeitam `prefers-reduced-motion` (o castor fica parado pra quem desativou animações no sistema).

## Uso

### HTML puro

```html
<img id="castor" src="/mascote/castor-neutro.svg" alt="" width="160" height="160">

<script>
  const castor = document.getElementById('castor');
  function reagir(mood, voltarEmMs = 2200) {
    castor.src = `/mascote/castor-${mood}.svg`;
    if (voltarEmMs) setTimeout(() => (castor.src = '/mascote/castor-neutro.svg'), voltarEmMs);
  }
  // reagir('acertou') | reagir('errou') | reagir('streak') | reagir('pensando', 0)
</script>
```

Dica: pré-carregue as poses pra troca ser instantânea:

```html
<link rel="preload" as="image" href="/mascote/castor-acertou.svg">
<link rel="preload" as="image" href="/mascote/castor-errou.svg">
```

### React / Next.js

```tsx
type Mood = 'neutro' | 'acertou' | 'errou' | 'streak' | 'pensando';

export function Castor({ mood = 'neutro', size = 160 }: { mood?: Mood; size?: number }) {
  return <img src={`/mascote/castor-${mood}.svg`} alt="" width={size} height={size} />;
}
```

### Favicon

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/png/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/png/apple-touch-icon.png">
```

## Inline (opcional)

Se colar o SVG direto no HTML (pra controlar com CSS da página), pode usar vários ao mesmo tempo:
cada arquivo tem IDs e classes com prefixo próprio (`cn-`, `ca-`, `ce-`, `cs-`, `cp-`…), então não conflitam.

## Paleta

| Token | Hex |
|---|---|
| Hoodie | `#6B4CF5` / claro `#8A70FF` / sombra `#4E35C9` |
| Ciano (escudo) | `#3CD3F5` |
| Pelo | `#9C6440` / focinho `#F3D5AF` |
| Contorno | `#22163A` |
| Fogo (streak) | `#FF7A2F` / `#FFB938` / `#FFF1B8` |
| Gradiente do logo | `#4338CA` → `#8B5CF6` |
