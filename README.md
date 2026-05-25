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
- Interface sem lateral de opcoes, com menus superiores para projeto, tecido, digitalizacao, modos, visualizacao, edicao e peca
- Menus superiores fecham ao abrir outro menu, ao clicar fora ou com Esc
- Barra de status com modo, peca selecionada, tecido, zoom e coordenadas do cursor
- Mensagens de importacao, digitalizacao e acoes visiveis na barra de status
- Atalhos de teclado para modos, zoom, nova peca e salvar projeto
- Atalhos Ctrl+D para duplicar e Delete/Backspace para apagar ponto ou peca
- Copiar e colar peca com Ctrl+C/Ctrl+V usando area de transferencia interna do projeto
- Menu contextual com clique direito sobre a peca ou ponto no canvas
- Menu contextual no canvas vazio para nova peca, encaixe, modos e zoom
- Ajustar a tela para enquadrar todas as pecas rapidamente
- Grade visual opcional usando o passo configurado em centimetros
- Botao de grade alterna entre mostrar e ocultar conforme estado atual
- Menu contextual respeita bloqueio da peca e desabilita acoes bloqueadas
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
- Zoom manual ate 1000%
- Atalhos de zoom direto: 1 para 100%, 2 para 250%, 5 para 500% e 9 para 1000%
- Regua em centimetros
- Medicao de distancia em centimetros no canvas
- Tipo de tecido: plano ou tubular
- Seta de fio nas pecas com angulos 0, 45, 90, 135, 180 e 360 graus
- Espelhamento e rotacao de pecas
- Encaixe automatico simples
- Tempo configuravel do encaixe para testar mais combinacoes antes de escolher o melhor resultado
- Botao de encaixe mostra estado de calculo e evita clique duplo durante o processamento
- Encaixe testa estrategias por area, largura, altura, perimetro e proporcao antes das tentativas mistas
- Encaixe faz compactacao final empurrando pecas para a esquerda quando ha espaco livre
- Compactacao pode ajustar pecas para cima/baixo, mantendo pecas de dobra no tecido tubular presas a dobra
- Busca do encaixe tenta preencher vazios antes e acima de pecas ja posicionadas
- Escolha do melhor encaixe prioriza nao deixar pecas fora antes de comparar comprimento e aproveitamento
- Encaixe usa largura fixa do tecido e aumenta o comprimento do risco conforme necessario
- Encaixe tenta reaproveitar vazios entre pecas para aumentar o aproveitamento do tecido
- Margem entre pecas inicia em 0 cm por padrao
- Encaixe pode girar pecas em 180 graus sem mudar o sentido do fio
- Mensagem do encaixe informa porcentagem de aproveitamento e comprimento usado
- Cabecario do risco com largura, comprimento, pecas encaixadas, aproveitamento, grade, modelos e arquivo
- Cabecario mostra status OK ou alerta de colisao/largura antes da exportacao
- Exportacao PLT e mini risco marcam a linha final do encaixe e levam o cabecario fora do tecido
- Linha final do encaixe aparece no editor e no SVG para conferencia antes do plotter
- Exportacao SVG e DXF incluem cabecario fora do tecido e linha final do encaixe
- Deteccao de sobreposicao
- Digitalizacao por imagem com calibracao de escala
- Captura por camera do celular ou webcam para digitalizacao ao vivo
- Scanner local via celular: servidor HTTP/WebSocket, QR/URL mobile e captura de frame pela mesma rede Wi-Fi
- Auto digitalizacao por varredura tipo scanner, contraste e diferenca de cor do fundo
- Importacao SVG, DXF e PLT simples
- Exportacao SVG
- Exportacao DXF
- Exportacao PLT/HPGL para risco em plotter
- Mini risco em JPG
- Exportacoes usam o nome do projeto como nome do arquivo
- Mensagem confirma o nome do arquivo exportado
- Exportacao informa aviso quando ainda existe colisao entre pecas
- Exportacao informa aviso quando existe peca fora da largura do tecido
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

Execute `abrir-moldelab.cmd` no Windows. Esse atalho inicia o servidor local e
abre `http://localhost:8787`, necessario para o QR Code e o scanner pelo celular.

## Estrutura

```text
index.html             Interface principal
styles.css             Estilos
app.js                 Editor, nesting, digitalizacao e importadores
scanner-server.js      Servidor local HTTP/WebSocket para scanner via celular
mobile-scanner.html    Pagina mobile que usa a camera do navegador do celular
abrir-scanner-local.cmd Atalho para iniciar o servidor local no Windows
IMPORTADORES.md        Arquitetura dos importadores
MANUAL_GRADING.md      Estrategia de grade manual de tamanhos
PRODUCT_STRATEGY.md    Estrategia para superar sistemas legados
QUALITY_ASSURANCE.md   Checklist de controle de qualidade
SAAS_BILLING.md        Plano de login, assinaturas e pagamento
WINDOWS_APP.md         Plano para aplicativo nativo Windows
```

## Scanner pelo celular

Execute `abrir-scanner-local.cmd` e abra o MoldeLab pelo endereco local mostrado
no terminal. No menu Digitalizacao, leia o QR Code ou digite a URL mobile no
celular. O QR Code e gerado pelo proprio servidor local, sem depender de internet.
O celular deve estar na mesma rede Wi-Fi. O navegador mobile envia
frames pelo WebSocket para o app, e o botao "Capturar do celular" solicita um
frame para usar como imagem base de calibracao e vetorizacao.

O QR Code so aparece quando o MoldeLab e aberto pelo servidor local
(`http://localhost:8787`). Se abrir `index.html` direto, o navegador nao tem como
consultar o servidor nem gerar o QR. O atalho `abrir-scanner-local.cmd` procura
o Node.js instalado ou o runtime embutido do Codex e abre o navegador
automaticamente.

Se o navegador bloquear camera em HTTP, use o fallback "Foto fallback" na pagina
mobile. Esse fallback envia a foto por HTTP caso o WebSocket nao esteja aberto.
O app desktop tambem consulta o ultimo frame recebido pelo servidor, entao a
foto aparece mesmo se o WebSocket do desktop falhar. Tambem continua sendo
possivel importar uma imagem manualmente no app.

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
