# Arquitetura de Importadores

O MoldeLab deve trabalhar com compatibilidade parcial dos formatos de modelagem.
O foco inicial e importar geometria, curvas e medidas. Metadados proprietarios,
regras internas e automacoes especificas de outros sistemas podem ser ignorados.

## Formatos

Importar:

- `.ads` Audaces 7, quando houver amostras suficientes para mapear geometria
- `.dxf` para interoperabilidade CAD
- `.svg` para vetor web
- `.plt` para plotter/risco

Exportar:

- `.dxf`
- `.svg`
- `.pdf`

## Camada de Importacao

```text
Import Layer
├── ads_parser.c
├── dxf_parser.c
├── svg_parser.c
├── plt_parser.c
└── internal_geometry.c
```

No prototipo web atual:

- SVG cria pecas internas a partir de `polygon`, `polyline` e `path` simples
  com comandos `M`, `L`, `H`, `V` e `Z`.
- DXF importa `LWPOLYLINE`, `POLYLINE`/`VERTEX` e `LINE` simples.
- PLT importa caminhos HPGL basicos com `PU`, `PD` e `PA`.
- ADS fica como parser experimental dependente de amostras reais do Audaces 7.

## Estrutura Interna

```c
typedef struct {
    float x;
    float y;
} Point;

typedef struct {
    Point *points;
    int count;
} Polyline;
```

No editor, cada `Polyline` vira uma peca vetorial. A renderizacao, encaixe,
edicao de pontos e exportacao trabalham sobre essa geometria interna.

## Estrategia para ADS

`.ads` deve ser tratado como importador experimental. O primeiro objetivo nao e
replicar todo o Audaces, mas recuperar contornos, piques, curvas e medidas
basicas. Para isso, precisamos analisar arquivos reais exportados do Audaces 7.

Fluxo ideal:

```text
Arquivo .ads
↓
Parser experimental
↓
Geometria interna
↓
Editor MoldeLab
↓
Exportacao DXF/SVG/PDF
```
