# Cancelar o 2º período como exceção (caso Juliana) + conflito falso

## O problema

Ao editar as férias da Juliana e apagar as datas do 2º período, o sistema continua acusando conflito com Vanésia e não salva.

O padrão continua sendo 2 períodos obrigatórios. O que muda é apenas a possibilidade de **cancelar o 2º período em caráter de exceção**, com motivo e justificativa — como no caso da Juliana, que está sendo desligada e não gozará o 2º período.

Duas causas identificadas no código:

1. **O aviso de conflito não é recalculado quando as datas mudam.** A verificação de conflito só roda quando o diálogo abre (depende apenas de `open` e do id da férias). Existe até uma variável observando as datas, mas ela não é usada como dependência. Resultado: o conflito detectado na abertura fica congelado na tela e continua bloqueando o salvamento mesmo depois de apagar o 2º período.

2. **Hoje não existe caminho para cancelar o 2º período.** Apagar as datas na mão não é um fluxo suportado: sobra o campo de fim preenchido, nada é justificado/auditado e o banco recusa o valor vazio (uma migração tornou `quinzena2_inicio`/`quinzena2_fim` opcionais e outra, posterior, reverteu para obrigatórios).

## O que será feito

### 1. Recalcular conflitos em tempo real
A verificação passa a rodar (com pequeno atraso, para não disparar a cada tecla) sempre que mudarem: colaborador, datas dos dois períodos oficiais, tipo de opção adicional (venda / gozo diferente), dias vendidos, datas de gozo e os sub-períodos de exceção. Assim, ao limpar o 2º período, o aviso some sozinho e o bloqueio no salvar deixa de existir.

### 2. Cancelamento do 2º período — só como exceção
O padrão segue exigindo os 2 períodos: rótulo obrigatório, validação e mensagens de hoje ficam iguais para quem não está em exceção.

Novo comportamento, disponível **apenas com a férias marcada como Exceção**:
- Ação **"Cancelar 2º período"** no card do 2º período, com confirmação (AlertDialog) explicando que o 2º período deixará de existir no registro.
- Exige motivo de exceção (novo motivo **"Desligamento do colaborador"**, somado aos motivos atuais) e justificativa preenchida — sem isso, não salva.
- Bloqueada se o 2º período já foi enviado ao contador.
- Ao cancelar, o sistema limpa início/fim do 2º período e também os campos de gozo/venda vinculados a ele, para não sobrar data solta. Se havia venda atribuída ao 2º período, avisa antes.
- No formulário e na visualização, o 2º período aparece como **"Cancelado (exceção)"** com o motivo, em vez de sumir sem explicação.
- O cancelamento é registrado na auditoria de férias (mesmo caminho já usado para correção de quinzena de venda).

### 3. Banco de dados
Primeiro será confirmada a obrigatoriedade atual das colunas. Se estiverem obrigatórias, uma migração volta `quinzena2_inicio`/`quinzena2_fim` a aceitarem vazio — necessário para gravar o cancelamento. A obrigatoriedade continua sendo garantida pela regra do formulário (só a exceção libera), não pela coluna.

### 4. Efeitos colaterais a conferir
- Relatório do contador e visualização: conferir que o 2º período cancelado apareça identificado como tal e nada exiba "Invalid Date".
- Cálculo de saldo de dias do período aquisitivo já soma o 2º período apenas quando ele existe.

## Detalhes técnicos
- `src/components/ferias/ferias/FeriasDialog.tsx`: usar `watchedFields` (ampliado) como dependência do `useEffect` de conflitos com debounce (~400 ms) e limpar `conflicts` quando não houver intervalos; ação "Cancelar 2º período" (visível só com `is_excecao`) limpando `quinzena2_inicio/fim` e os campos de gozo/venda do período 2; em `validateVacation`, exigir 2º período quando não for exceção e exigir motivo + justificativa quando cancelado; novo motivo `desligamento`; auditoria via `registrar_evento_ferias` com ação `CANCELAMENTO_PERIODO_2`.
- `src/components/ferias/ferias/FeriasViewDialog.tsx`: exibir o 2º período como cancelado (motivo/justificativa) quando as datas estiverem vazias e o registro for exceção.
- Migração nova em `db/migrations/`: `ALTER TABLE ferias_ferias ALTER COLUMN quinzena2_inicio DROP NOT NULL;` e o mesmo para `quinzena2_fim` (apenas se a verificação confirmar que estão NOT NULL).