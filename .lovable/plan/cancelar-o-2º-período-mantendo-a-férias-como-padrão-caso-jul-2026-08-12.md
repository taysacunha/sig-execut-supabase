# Cancelar o 2º período mantendo a férias como Padrão (caso Juliana)

## O problema

Ao editar as férias da Juliana e apagar as datas do 2º período, o sistema continua acusando conflito com Vanésia e não salva.

A férias da Juliana é e continua **Padrão**: as datas seguem as regras normais e o 1º período foi gozado integralmente. A única mudança é o **cancelamento do 2º período por desligamento**. Isso não transforma o cadastro em "Exceção" — não muda aba, não exige motivo de exceção e não afeta as demais regras.

Duas causas identificadas no código:

1. **O aviso de conflito não é recalculado quando as datas mudam.** A verificação de conflito só roda quando o diálogo abre (depende apenas de `open` e do id da férias). Existe até uma variável observando as datas, mas ela não é usada como dependência. Resultado: o conflito detectado na abertura fica congelado na tela e continua bloqueando o salvamento mesmo depois de apagar o 2º período.

2. **Hoje não existe caminho para cancelar o 2º período.** Apagar as datas na mão não é um fluxo suportado: sobra o campo de fim preenchido, nada fica registrado sobre o porquê e o banco recusa o valor vazio (uma migração tornou `quinzena2_inicio`/`quinzena2_fim` opcionais e outra, posterior, reverteu para obrigatórios).

## O que será feito

### 1. Recalcular conflitos em tempo real
A verificação passa a rodar (com pequeno atraso, para não disparar a cada tecla) sempre que mudarem: colaborador, datas dos dois períodos oficiais, tipo de opção adicional (venda / gozo diferente), dias vendidos, datas de gozo e os sub-períodos de exceção. Assim, ao limpar o 2º período, o aviso some sozinho e o bloqueio no salvar deixa de existir.

### 2. Cancelar o 2º período (ação própria, independente de exceção)
No card do 2º período, uma ação **"Cancelar 2º período"** com confirmação, disponível tanto em cadastro Padrão quanto em Exceção:
- Pede o motivo do cancelamento (lista curta: **Desligamento**, **Aviso prévio**, **Outro**) e uma justificativa em texto.
- Ao confirmar, limpa início/fim do 2º período e os campos de gozo/venda vinculados a ele. Se havia venda atribuída ao 2º período, avisa antes.
- Bloqueada se o 2º período já foi enviado ao contador.
- O cadastro **continua Padrão**: nada de marcar `is_excecao`, nada de trocar de aba, nada de exigir motivo de exceção.
- Enquanto o 2º período não estiver cancelado, ele segue obrigatório como hoje.
- Pode ser desfeito ("Reativar 2º período"), voltando a exigir as datas.

### 3. Como isso aparece no sistema
- No formulário e na visualização, o card do 2º período mostra **"Cancelado — Desligamento"** com a justificativa e a data/usuário do cancelamento.
- Relatório do contador e demais telas: o 2º período não é listado como férias a gozar, e sim identificado como cancelado.
- Registro na auditoria de férias.

### 4. Banco de dados
- Confirmar a obrigatoriedade atual de `quinzena2_inicio`/`quinzena2_fim`; se estiverem obrigatórias, migração para aceitarem vazio (a obrigatoriedade passa a ser garantida pela regra do formulário).
- Novas colunas em `ferias_ferias` para o cancelamento: `q2_cancelado` (booleano, padrão falso), `q2_cancelamento_motivo`, `q2_cancelamento_justificativa`, `q2_cancelado_em`, `q2_cancelado_por`.

### 5. Efeitos colaterais a conferir
- Visualização e PDF do contador: nada deve exibir "Invalid Date" com o 2º período vazio.
- Cálculo de saldo de dias do período aquisitivo já soma o 2º período apenas quando ele existe.

## Detalhes técnicos
- `src/components/ferias/ferias/FeriasDialog.tsx`: usar `watchedFields` (ampliado) como dependência do `useEffect` de conflitos com debounce (~400 ms) e limpar `conflicts` quando não houver intervalos; estado `q2Cancelado` + AlertDialog de confirmação com motivo/justificativa; ao cancelar, limpar `quinzena2_inicio/fim`, `gozo_quinzena2_*` e venda do período 2; em `validateVacation`, exigir 2º período apenas quando `q2_cancelado` for falso; payload grava as novas colunas — `is_excecao` permanece inalterado.
- `src/components/ferias/ferias/FeriasViewDialog.tsx` e gerador de PDF do contador: renderizar o 2º período como cancelado (motivo + justificativa) em vez de datas.
- Migração em `db/migrations/`: `DROP NOT NULL` em `quinzena2_inicio`/`quinzena2_fim` (se aplicável) e `ADD COLUMN IF NOT EXISTS` das cinco colunas de cancelamento.
- `registrar_evento_ferias`: incluir `CANCELAMENTO_PERIODO_2` (e `REATIVACAO_PERIODO_2`) na lista de ações permitidas da função.