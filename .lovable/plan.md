Plano para corrigir o caso dos 67 disponíveis vs 23 exibidas:

1. Corrigir a regra da aba “Disponíveis”
   - A aba “Disponíveis” deve usar `estoque_saldos` como fonte principal, porque disponibilidade real de estoque é saldo agregado.
   - O total 67 continuará vindo do saldo, e a lista principal também passará a listar esses 67 por material/local/tipo/tamanho, incluindo “Aluga”.
   - A tabela de `estoque_placas` continuará sendo usada para placas físicas individualizadas, mas não será mais a única fonte da aba “Disponíveis”.

2. Mostrar claramente quantidade total, códigos cadastrados e pendentes
   - Na tabela de disponíveis, cada linha será por material + local.
   - Colunas previstas: Material, Tipo, Tamanho, Local, Disponível, Códigos já cadastrados, Pendentes de código, Ações.
   - Exemplo esperado: `Placa Aluga 2x2 Lona` aparece com sua quantidade mesmo sem código individual ainda.

3. Ajustar filtros para “Aluga” funcionar de verdade
   - O filtro Tipo de uso será aplicado em cima dos saldos resolvidos por material, não só em cima de registros físicos de `estoque_placas`.
   - O filtro Material/Local/Tamanho também será aplicado na mesma fonte de dados.

4. Manter ações operacionais
   - Para linhas de saldo disponível, manter ação de “Nova saída para imóvel” usando o material/local daquela linha.
   - Ajustar `NovaSaidaDialog` para aceitar material/local pré-selecionados quando a ação vier da tabela de disponíveis.
   - Quando houver unidades pendentes de código, permitir atribuir/criar um código para uma unidade física sem alterar o saldo, apenas criando o registro individual em `estoque_placas` vinculado ao material/local.

5. Preservar a lista de placas físicas onde ela faz sentido
   - Nas abas “Instaladas” e “Baixadas”, continuar mostrando registros físicos individuais de `estoque_placas`.
   - Na aba “Disponíveis”, se necessário, mostrar os códigos físicos disponíveis como informação auxiliar/contagem, mas a lista principal será o saldo real.

6. Validar o cenário citado
   - Com total de 67 disponíveis, a aba “Disponíveis” deve mostrar 67 no total e a tabela deve incluir as placas “Aluga”.
   - Ao filtrar Tipo = Aluga, a linha da placa aluga deve aparecer com sua quantidade correta.
   - Verificar TypeScript após a implementação.