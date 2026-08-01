# Repasses: saldo por imóvel na competência

## O que muda

### 1. Saldo por imóvel visível
Na competência aberta no diálogo de repasse, cada imóvel passa a ter um saldo calculado:

```text
saldo do imóvel = créditos do imóvel − débitos do imóvel − repasses já lançados com esse imóvel
```

Onde aparece:
- Novo bloco "Saldo por imóvel" no topo da aba Beneficiários, listando código + descrição do imóvel, crédito, débito, já repassado e **disponível**, com linha de totais e uma linha "Sem imóvel" para o que não foi vinculado.
- No bloco expansível de repasses de cada beneficiário, o seletor "Imóvel de origem" mostra o disponível junto ao nome (ex.: `15077 — Sala 3 · disponível R$ 6.000,00`).
- Os valores respeitam o botão do olho (ficam mascarados quando os valores estão ocultos).

### 2. Imóveis sem saldo não aparecem
- No seletor "Imóvel de origem" (novo repasse e edição de repasse), só entram imóveis com disponível > 0 — mais o imóvel já selecionado na linha em edição, para não perder o vínculo.
- Se nenhum imóvel tiver saldo, o campo fica desabilitado com a mensagem "Nenhum imóvel com saldo disponível".
- No bloco "Saldo por imóvel", imóveis zerados ficam ocultos por padrão, com um botão "Mostrar imóveis sem saldo" para conferência.
- Ao lançar um repasse acima do disponível do imóvel escolhido, aparece aviso indicando o saldo do imóvel (mantendo as validações de limite mês/ano já existentes).

## Detalhes técnicos

- Tudo em `src/components/despesas/RepasseDialog.tsx` (cálculo derivado, sem migration):
  - Novo cálculo `saldosPorImovel` a partir de `repasse.itens` (tipo crédito/débito, `imovel_id`, `valor`) e dos `pagamentos` de todos os beneficiários da competência.
  - `imovelOptions` ganha a variante `imovelOptionsComSaldo(idAtual?)`, usada nos seletores de repasse; a lista completa continua nos itens.
  - Bloco de saldo renderizado com a tabela existente e o `money()` do escopo de valores do diálogo.