# MoldeLab

MoldeLab e um prototipo web para modelagem de moldes vetoriais de vestuario,
digitalizacao, nesting e importacao/exportacao de arquivos de risco.

O produto web deve funcionar como SaaS pago, com usuario, senha, planos de
assinatura e pagamento por cartao de credito.

O projeto tambem deve evoluir para um aplicativo nativo de Windows, mantendo a
mesma base visual do editor web e adicionando recursos offline, acesso a
arquivos locais, impressoras, plotters e motores nativos de geometria.

## Recursos atuais

- Editor 2D em canvas
- Botoes compactos com icones e texto no hover/foco
- Menu Arquivo desplegavel para salvar e exportar
- Criacao de moldes do zero por pontos
- Pecas vetoriais arrastaveis
- Lista de pecas para selecao rapida
- Cores por peca para diferenciar modelos e tamanhos no encaixe
- Modelo e tamanho por peca para organizar grades manuais
- Bloqueio de pecas para evitar edicao ou encaixe acidental
- Medidas tecnicas da peca selecionada
- Alinhamento rapido da peca selecionada no tecido
- Movimento fino da peca selecionada pelo teclado
- Renomear, duplicar e apagar pecas para grade manual
- Edicao, insercao e remocao de pontos
- Movimento fino do ponto selecionado pelo teclado
- Ajuste opcional de pontos e pecas na grade
- Piques de costura nos pontos da peca
- Margem de costura visual por peca
- Desfazer e refazer alteracoes do projeto
- Zoom e pan
- Regua em centimetros
- Medicao de distancia em centimetros no canvas
- Tipo de tecido: plano ou tubular
- Seta de fio nas pecas com angulos 0, 45, 90, 135, 180 e 360 graus
- Espelhamento e rotacao de pecas
- Encaixe automatico simples
- Deteccao de sobreposicao
- Digitalizacao por imagem com calibracao de escala
- Importacao SVG, DXF e PLT simples
- Exportacao SVG
- Exportacao DXF
- Exportacao PLT/HPGL para risco em plotter
- Mini risco em JPG
- Salvar e abrir projeto `.moldelab.json`

## Formatos

Importacao atual:

- `.svg`
- `.dxf`
- `.plt`

Planejado:

- `.ads` Audaces 7, com compatibilidade parcial focada em geometria, curvas e medidas

Exportacao atual:

- `.svg`
- `.dxf`
- `.plt`
- `.jpg` mini risco

## Como abrir

Abra `index.html` no navegador ou execute `abrir-moldelab.cmd` no Windows.

## Estrutura

```text
index.html        Interface principal
styles.css        Estilos
app.js            Editor, nesting, digitalizacao e importadores
IMPORTADORES.md   Arquitetura dos importadores
MANUAL_GRADING.md Estrategia de grade manual de tamanhos
PRODUCT_STRATEGY.md Estrategia para superar sistemas legados
QUALITY_ASSURANCE.md Checklist de controle de qualidade
SAAS_BILLING.md   Plano de login, assinaturas e pagamento
WINDOWS_APP.md    Plano para aplicativo nativo Windows
```

## Qualidade

Antes de producao, o MoldeLab deve passar por controle de qualidade cobrindo
editor, importadores, digitalizacao, autenticacao, pagamento, seguranca,
performance, backup e deploy.

## Estrategia de Produto

O objetivo do MoldeLab nao e apenas copiar sistemas legados de modelagem, mas
ser melhor em usabilidade, digitalizacao, nuvem, interoperabilidade, nesting
visual, app Windows e fluxo comercial para pequenas e medias confeccoes.

## Roadmap SaaS

A versao web deve ter autenticacao, controle de acesso por assinatura e
pagamento por cartao. A implementacao recomendada e usar um provedor de
pagamentos como Stripe, Mercado Pago ou Pagar.me, com backend proprio para
validar webhooks e liberar recursos pagos.

## Roadmap Windows

A versao Windows deve ser empacotada futuramente com Tauri ou Electron. A
preferencia inicial e Tauri por ser mais leve e permitir integrar Rust/C/C++
para importadores, nesting e processamento geometrico pesado.
