# Reconstruir definitivamente o histórico da página /dev

## Princípio da correção

- Parar de tratar **1.195h** como meta obrigatória e não assumir que **1.381h** seja o total correto.
- O total oficial será a soma das horas comprovadas de cada atividade, depois de eliminar apenas inconsistências identificadas — nunca um número escolhido previamente.
- Não executar novamente os scripts de importação atuais. O script `dev_tracker_log_import_legacy.sql` está conceitualmente incorreto: ele limita o saldo global e ainda insere as atividades restantes com `0h`.
- A execução que informou 1.381h terminou com `RAISE EXCEPTION` dentro de uma transação; portanto, aquela tentativa foi revertida. Ainda assim, o estado real do banco será consultado antes de qualquer alteração.

## 1. Auditoria integral, sem alterar dados

- Liberar temporariamente a leitura do banco ou executar uma consulta diagnóstica única no SQL Editor.
- Inventariar todas as linhas de `dev_tracker` e `dev_tracker_log`, incluindo identificador, sistema, atividade, descrição, data, horas, origem e chave legada.
- Apurar separadamente:
  - total e quantidade de registros de cada tabela;
  - atividades com `0h`, horas nulas ou negativas;
  - duplicidades exatas e prováveis;
  - registros presentes nas duas tabelas;
  - registros exclusivos de cada fonte;
  - totais por sistema, origem e atividade.
- Produzir uma tabela de conciliação atividade por atividade, mostrando qual fonte sustenta cada hora e por que uma linha deve ser mantida, complementada ou classificada como duplicada.

## 2. Determinar o total verdadeiro

- Usar como evidência os registros existentes, seeds históricos, migrations e datas documentadas no projeto.
- Para atividades duplicadas entre as duas tabelas, não somar automaticamente: confirmar se representam o mesmo trabalho ou entregas diferentes.
- Para atividades zeradas, recuperar a carga horária da fonte original quando houver evidência. Quando não houver, marcar como **pendente de apuração**, sem inventar horas e sem contabilizá-la silenciosamente.
- Calcular o novo total somente depois dessa conciliação. Se o resultado for 1.195h, 1.381h ou outro valor, apresentar a composição completa antes da gravação.

## 3. Corrigir o banco com segurança

- Criar uma migração transacional baseada no resultado auditado, substituindo os scripts defeituosos.
- Preservar os lançamentos legítimos e impedir novas importações com `0h`.
- Corrigir atividades zeradas apenas quando existir uma hora comprovada; inconsistências sem comprovação ficam sinalizadas para decisão explícita.
- Usar chaves de origem estáveis para impedir duplicação em reexecuções.
- Antes e depois da mudança, validar quantidade de linhas, total por sistema, total geral, duplicidades e atividades inválidas; abortar se qualquer resultado divergir da conciliação aprovada.
- Arquivar os scripts antigos como inválidos para que não sejam executados novamente.

## 4. Corrigir e proteger a página /dev

- Exibir uma única fonte oficial e o total calculado a partir das atividades válidas.
- Destacar atividades com horas pendentes em vez de mostrá-las como trabalho de `0h` normal.
- Impedir a criação ou edição de lançamentos com `0h` ou horas negativas.
- Remover a comparação fixa com o legado e substituí-la por verificações reais: horas inválidas, duplicidades e itens pendentes.
- Manter os PDFs coerentes com a tela e bloquear a emissão enquanto houver inconsistências não resolvidas.

## 5. Automatização daqui em diante

- Ao concluir cada desenvolvimento fora da própria `/dev`, registrar automaticamente um lançamento com data, sistema, título, descrição, tipo e horas estimadas maiores que zero.
- Validar a gravação e atualizar a tela; se falhar, informar a falha em vez de considerar o registro concluído.
- Adicionar uma verificação periódica de integridade para detectar zero, valor negativo, duplicidade de chave ou divergência entre tela e relatório.

## Critério de conclusão

- Nenhuma atividade zerada tratada como válida.
- Nenhuma duplicidade contabilizada sem justificativa.
- Total geral demonstrável pela soma da conciliação atividade por atividade.
- Tela, filtros, totais por sistema e PDFs exibindo exatamente o mesmo acervo.
- Importação antiga impossibilitada de voltar a criar registros zerados.

## Dependência para execução

A leitura direta do Supabase está bloqueada nas permissões atuais. Para iniciar a auditoria, será necessário habilitar **Read database** nas configurações do conector ou executar no SQL Editor a consulta de auditoria que será fornecida. Nenhuma escrita será feita antes da apresentação da conciliação.