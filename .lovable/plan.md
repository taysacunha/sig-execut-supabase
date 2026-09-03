# Restaurar integralmente as 1.195 horas da página /dev

## Compromisso de segurança

- Não apagar, substituir, truncar nem reduzir nenhum registro de `dev_tracker` ou `dev_tracker_log`.
- Não executar os scripts atuais que contêm `DELETE` (`dev_tracker_log_backfill.sql` e `dev_tracker_reconcile.sql`).
- Fazer a recuperação exclusivamente com operações aditivas e idempotentes (`INSERT` dos registros ausentes).
- Antes de inserir, registrar uma fotografia de auditoria com os totais e registros existentes; depois, validar que o total final é exatamente **1.195 horas** e abortar a transação se ficar abaixo ou acima disso.

## Diagnóstico confirmado no código

- A página `/dev` foi alterada para carregar somente `dev_tracker_log` em todas as abas e no rodapé.
- Por isso, o total exibido caiu para o conteúdo atualmente existente nessa tabela — as 577h informadas — embora o acervo consolidado anterior tivesse 1.195h.
- O cadastro legado `dev_tracker`, seus seeds e suas funcionalidades continuam presentes no projeto; a falha foi trocar a fonte exibida antes de migrar integralmente esse acervo.
- O formulário “Novo lançamento” já insere diretamente em `dev_tracker_log` pelo cliente Supabase autenticado. Portanto, **sim, é possível inserir e manter os registros pela própria página `/dev`**, sem Lovable Cloud.

## Recuperação

### 1. Auditar sem alterar dados

- Levantar no Supabase puro os totais gerais, por sistema e por registro de `dev_tracker` e `dev_tracker_log`.
- Identificar quais funcionalidades do legado ainda não possuem lançamento correspondente no histórico e quais já estão representadas, evitando duplicação.
- Usar os arquivos versionados de seeds, migrations e planos para recuperar título, descrição, sistema, horas e a melhor data documental disponível.

### 2. Restaurar somente o que falta

- Criar uma migração aditiva e idempotente, sem qualquer `DELETE`, para inserir em `dev_tracker_log` os registros históricos ausentes.
- Preservar todos os lançamentos que hoje formam as 577h.
- Distribuir as horas faltantes em registros identificáveis por funcionalidade e sistema; não criar um único lançamento genérico de 618h.
- Usar uma chave técnica/origem de reconciliação para impedir duplicações em uma reexecução.
- Executar tudo em transação com validações: total anterior preservado, nenhuma linha removida, nenhuma hora negativa e total final exatamente igual ao acervo legítimo de 1.195h.

### 3. Proteger contra nova perda

- Manter `dev_tracker_log` como fonte única das duas visualizações somente depois da restauração completa.
- Bloquear no frontend a exclusão de registros importados do acervo; lançamentos manuais continuarão editáveis, mas qualquer exclusão exigirá confirmação reforçada.
- Exibir um alerta de integridade se o total oficial cair abaixo de 1.195h ou se houver registros inválidos.
- Remover da rotina de recuperação qualquer SQL destrutivo e substituir os scripts perigosos por versões somente aditivas.

### 4. Validar a entrega

- Conferir na página: total geral de 1.195h, totais por sistema e histórico cronológico.
- Confirmar que as abas “Todos”, por sistema e “Histórico” usam os mesmos registros e fecham no mesmo total sem filtros.
- Testar criação e edição de um lançamento pela própria `/dev` e confirmar persistência no Supabase.
- Validar os dois PDFs com o mesmo total de 1.195h.

## Detalhes técnicos

- A conexão continuará sendo diretamente com o Supabase externo já configurado; Lovable Cloud não será usado nem solicitado.
- A restauração será baseada em comparação por funcionalidade/sistema e marcadores idempotentes, nunca em limpeza prévia.
- Se a auditoria mostrar que o consolidado real no banco diverge das 1.195h, a execução será interrompida e a divergência será apresentada antes de qualquer inserção.
- A correção da própria `/dev` permanece fora do histórico, conforme a regra do projeto.