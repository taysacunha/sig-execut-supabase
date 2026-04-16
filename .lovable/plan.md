

## Correção: Afastamento deve bloquear folga do mês inteiro + erro na perda

### Problemas identificados

1. **Gerador aloca colaborador afastado**: A função `isAfastadoAllSaturdays` (GeradorFolgasDialog.tsx, linha 383) só exclui quem está afastado em TODOS os sábados. Ivone está afastada até 17/05, cobrindo alguns sábados mas não o 23/05 — então o gerador a inclui. A regra correta é: se o afastamento cobre QUALQUER sábado do mês, o colaborador perde o direito à folga no mês inteiro.

2. **Erro ao registrar perda**: O diálogo `PerdaFolgaDialog` não verifica se o colaborador já está afastado. Além disso, a mensagem de erro é genérica ("Erro ao registrar perda") sem detalhar o motivo.

3. **Falta validação no diálogo de perda**: Não há checagem de afastamentos — deveria mostrar um aviso claro de que o colaborador já está afastado e portanto já não entra na escala.

### Solução

#### 1. GeradorFolgasDialog.tsx — renomear e corrigir lógica de exclusão

Renomear `isAfastadoAllSaturdays` para `isAfastadoAnySaturday` e alterar a lógica para verificar se o afastamento cobre **qualquer** sábado do mês (não todos):

```typescript
const isAfastadoAnySaturday = (colabId: string): boolean => {
  const colabAfastamentos = afastamentos.filter(a => a.colaborador_id === colabId);
  if (colabAfastamentos.length === 0) return false;
  return saturdaysOfMonth.some(sat =>
    colabAfastamentos.some(a => sat >= a.data_inicio && sat <= a.data_fim)
  );
};
```

Atualizar a referência na exclusão (linha 427) para usar a nova função.

#### 2. PerdaFolgaDialog.tsx — adicionar verificação de afastamento

- Buscar afastamentos ativos no mês selecionado via query adicional
- Ao selecionar um colaborador afastado, mostrar um alerta: "Este colaborador está afastado de DD/MM a DD/MM e já não entra na escala de folgas deste mês."
- Bloquear o botão "Registrar Perda" para colaboradores afastados (não faz sentido registrar perda se já está excluído)
- Melhorar a mensagem de erro genérica para incluir detalhes do erro retornado pelo banco

#### 3. Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ferias/folgas/GeradorFolgasDialog.tsx` | `isAfastadoAllSaturdays` → `isAfastadoAnySaturday` (any em vez de every) |
| `src/components/ferias/folgas/PerdaFolgaDialog.tsx` | Query afastamentos, alerta visual, bloqueio de submit para afastados, mensagem de erro detalhada |

