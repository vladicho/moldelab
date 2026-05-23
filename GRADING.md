# Ampliacao e Reducao de Moldes

No MoldeLab, ampliacao e reducao nao devem ser tratadas como escala proporcional
simples. Em modelagem de vestuario, a grade de tamanhos depende de regras por
ponto, por eixo e por regiao da peca.

## Regra Principal

```text
Nao usar escala proporcional como regra de grade profissional.
```

Uma peca pode crescer mais em largura do que em altura, ou crescer somente em
determinados pontos. Ombro, cava, cintura, gancho, barra, gola e bolso podem ter
regras diferentes.

## Modelo Correto

Cada ponto importante do molde deve poder receber uma regra de deslocamento:

```text
Ponto base
|
|-- deslocamento X por tamanho
|-- deslocamento Y por tamanho
|-- regra por grade
`-- observacao tecnica
```

Exemplo:

```text
Tamanho base: 40
Grade: 36, 38, 40, 42, 44, 46

Ponto cintura lateral:
- 36: x -1.0 cm, y 0.0 cm
- 38: x -0.5 cm, y 0.0 cm
- 40: x  0.0 cm, y 0.0 cm
- 42: x +0.5 cm, y 0.0 cm
- 44: x +1.0 cm, y 0.0 cm
- 46: x +1.5 cm, y 0.0 cm
```

## Estrutura Interna Futura

```text
Piece
|-- baseSize
|-- sizes
|-- points
|-- gradingRules

GradingRule
|-- pointIndex
|-- size
|-- dx
|-- dy
```

## Interface Esperada

O usuario deve poder:

- definir tamanho base
- criar grade de tamanhos
- selecionar um ponto
- informar deslocamento por tamanho
- copiar regras entre pontos
- visualizar todos os tamanhos sobrepostos
- ativar/desativar tamanhos no encaixe

## MVP de Gradacao

Primeira versao realista:

1. definir grade: P/M/G ou 36/38/40/42
2. selecionar ponto do molde
3. informar `dx` e `dy` para cada tamanho
4. visualizar contornos coloridos por tamanho
5. exportar tamanho selecionado ou todos os tamanhos

## Observacao

Escala proporcional pode existir apenas como ferramenta auxiliar rapida, nunca
como regra principal de ampliacao/reducao profissional.
