# Unificar o histórico em `dev_tracker_log` sem perder nem duplicar horas

## Objetivo

O script atual falhou porque somava saldos por sistema e estourava o total (1381 em vez de 1195). A nova abordagem copia o acervo legado item a item, mantendo o detalhe que já existe no histórico e completando só o que falta.

## Como vai funcionar

1. **Chave de correspondência**: cada item de `dev_tracker` (sistema + funcionalidade) recebe uma marca de origem única no histórico. Itens já importados não entram de novo, então o script pode rodar quantas vezes for preciso.
2. **Preservação total**: nada é apagado, truncado ou reduzido. Os ~577h de lançamentos detalhados continuam intactos.
3. **Complemento item a item**: para cada sistema, o script compara as horas já detalhadas no histórico com as horas do acervo legado daquele sistema e importa os itens do acervo até cobrir a diferença — em ordem, começando pelos itens de maior valor, sem ultrapassar o total do sistema.
4. **Ajuste final por sistema**: se sobrar uma fração (por exemplo faltam 7h e o próximo item tem 12h), o item entra com as horas restantes e a descrição indica que é um saldo parcial do acervo.
5. **Validação**: ao final, o total do histórico tem de ficar exatamente igual ao total do acervo legado (1.195h). Se ficar acima ou abaixo, a transação é abortada e nada é gravado.

## Página /dev

- O rodapé passa a mostrar apenas o total do histórico, sem alerta de integridade quando os totais baterem.
- Registros importados do acervo continuam bloqueados para edição/exclusão, com etiqueta de origem.
- Se o total ainda divergir, o alerta permanece com a diferença exata em horas.

## Detalhes técnicos

- Novo arquivo `.lovable/dev_tracker_log_import_legacy.sql`, transacional, sem nenhum `DELETE`.
- Coluna `source` (já criada pelo script anterior, com `ADD COLUMN IF NOT EXISTS`) usada com o valor `legacy_item`, mais uma coluna `legacy_key` (`system_name || '::' || feature_name`) com índice único parcial para garantir idempotência.
- Seleção por sistema com `SUM(hours) OVER (PARTITION BY system_name ORDER BY hours DESC)` para respeitar o teto de horas de cada sistema e calcular o item de saldo parcial.
- Bloco `DO` final com `RAISE EXCEPTION` comparando `SUM(hours)` das duas tabelas.
- `dev_tracker` fica como legado somente-leitura; nenhuma tela nova lê dela além da referência de total.
- `roadmap.md` atualizado com as etapas restantes.
