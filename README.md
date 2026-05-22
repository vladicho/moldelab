# MoldeLab

MoldeLab e um prototipo web para modelagem de moldes vetoriais de vestuario,
digitalizacao, nesting e importacao/exportacao de arquivos de risco.

## Recursos atuais

- Editor 2D em canvas
- Pecas vetoriais arrastaveis
- Edicao de pontos
- Zoom e pan
- Regua em centimetros
- Espelhamento e rotacao de pecas
- Encaixe automatico simples
- Deteccao de sobreposicao
- Digitalizacao por imagem com calibracao de escala
- Importacao SVG, DXF e PLT simples
- Exportacao SVG

## Formatos

Importacao atual:

- `.svg`
- `.dxf`
- `.plt`

Planejado:

- `.ads` Audaces 7, com compatibilidade parcial focada em geometria, curvas e medidas

Exportacao atual:

- `.svg`

Planejado:

- `.dxf`
- `.pdf`

## Como abrir

Abra `index.html` no navegador ou execute `abrir-moldelab.cmd` no Windows.

## Estrutura

```text
index.html        Interface principal
styles.css        Estilos
app.js            Editor, nesting, digitalizacao e importadores
IMPORTADORES.md   Arquitetura dos importadores
```
