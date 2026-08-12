# Remover o 2º período de férias sem falso conflito

## O problema

Ao editar as férias da Juliana e apagar as datas do 2º período, o sistema continua acusando conflito com Vanésia e não salva.

Duas causas identificadas no código:

1. **O aviso de conflito não é recalculado quando as datas mudam.** A verificação de conflito só roda quando o diálogo abre (depende apenas de `open` e do id da férias). Existe até uma variável observando as datas, mas ela não é usada como dependência. Resultado: o conflito detectado na abertura fica congelado na tela e continua bloqueando o salvamento mesmo depois de apagar o 2º período.

2. **O 2º período provavelmente não pode ficar vazio no banco.** Houve uma migração tornando `quinzena2_inicio`/`quinzena2_fim` opcionais e, depois, outra revertendo para obrigatórios. O formulário já envia vazio como nulo, mas o banco recusaria — aparecendo como "Erro ao salvar férias".

## O que será feito

### 1. Recalcular conflitos em tempo real
A verificação passa a rodar (com pequeno atraso, para não disparar a cada tecla) sempre que mudarem: colaborador, datas dos dois períodos oficiais, tipo de opção adicional (venda / gozo diferente), dias vendidos, datas de gozo e os sub-períodos de exceção. Assim, ao limpar o 2º período, o aviso some sozinho e o bloqueio no salvar deixa de existir.

### 2. Permitir férias com apenas 1 período
- Botão **"Remover 2º período"** no card do 2º período, que limpa início e fim de uma vez (hoje, apagando só o início, o campo de fim continua preenchido e sobra meio período órfão). O botão fica desabilitado se o 2º período já foi enviado ao contador.
- Rótulo do campo deixa de ser obrigatório (`Data de Início *` → `Data de Início`), com nota de que o 2º período pode ficar em branco quando não será gozado.
- Ao remover o 2º período, os campos de gozo/venda ligados a ele também são limpos, para não sobrar data solta.
- Se o 2º período for removido e existir venda vinculada a ele, o formulário avisa antes de salvar.

### 3. Banco de dados
Primeiro será confirmada a obrigatoriedade atual das colunas. Se estiverem obrigatórias, uma migração volta `quinzena2_inicio` e `quinzena2_fim` a aceitarem vazio (elas já são tratadas como opcionais em vários pontos do sistema, inclusive na função de mudança automática de status, que já lida com o 2º período ausente).

### 4. Efeitos colaterais a conferir
- Visualização das férias e relatório do contador: períodos vazios já são tratados condicionalmente; será conferido que nada exiba "Invalid Date".
- Cálculo de saldo de dias do período aquisitivo já soma o 2º período apenas quando ele existe.

## Detalhes técnicos
- `src/components/ferias/ferias/FeriasDialog.tsx`: usar `watchedFields` (ampliado) como dependência do `useEffect` de conflitos com debounce (~400 ms); limpar `conflicts` quando não houver intervalos; adicionar ação "Remover 2º período" limpando `quinzena2_inicio`, `quinzena2_fim` e campos de gozo/venda do período 2; ajustar rótulo/hint.
- Migração nova em `db/migrations/`: `ALTER TABLE ferias_ferias ALTER COLUMN quinzena2_inicio DROP NOT NULL;` e o mesmo para `quinzena2_fim` (apenas se a verificação confirmar que estão NOT NULL).