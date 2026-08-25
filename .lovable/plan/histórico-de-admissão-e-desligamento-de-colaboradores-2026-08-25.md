# Histórico de admissão e desligamento de colaboradores

Hoje o colaborador só tem "data de admissão" e um status Ativo/Inativo. Quando alguém sai, não fica registrado quando saiu, por quê, nem o que acontece se voltar. A proposta é transformar isso em um histórico de vínculos.

## Como vai funcionar

**Ao cadastrar**

- A data de admissão informada abre automaticamente o 1º vínculo do colaborador.

**Ao desativar (novo diálogo de confirmação)**

- Pergunta o motivo: **Desligamento** ou **Inativação temporária** (ex.: licença, afastamento longo, suspensão).
- Se for desligamento: exige a **data de demissão**, e pede o **tipo** (pedido de demissão, dispensa sem justa causa, dispensa por justa causa, fim de contrato, aposentadoria, falecimento, outro) e uma observação opcional. O vínculo atual é encerrado nessa data.
- Se for inativação temporária: só pede motivo/observação e a data de início; o vínculo continua aberto.
- Em ambos os casos o status vai para Inativo.

**Ao reativar (novo diálogo)**

- Se a saída foi **desligamento**: exige uma **nova data de admissão**, que abre um novo vínculo (recontratação). A data de admissão principal do cadastro passa a ser a do vínculo vigente, mas a original continua no histórico.
- Se foi **inativação temporária**: apenas reativa, mantendo o vínculo e a admissão originais.

**Onde o histórico aparece**

- Nova seção "Histórico de vínculos" no diálogo de visualização do colaborador: lista cada período (admissão → demissão), tipo/motivo da saída, tempo de casa daquele vínculo e quem registrou.
- Na lista de colaboradores: coluna/tooltip com data de demissão para inativos e badge distinguindo "Desligado" de "Inativo (temporário)".
- Exportações (PDF/Excel) passam a incluir data de demissão e motivo.

## Sugestões adicionais (o que está faltando)

1. **Distinguir "Desligado" de "Inativo temporário"** também no filtro de status — hoje tudo cai em "Inativo". Inclua
2. **Tempo de casa** calculado (total somando vínculos e do vínculo atual), útil para férias e premiações. Não inclua
3. **Integração com aviso prévio**: já existe `aviso_previo_inicio/fim`; ao desligar, sugerir a data de demissão a partir do fim do aviso prévio. Inclua
4. **Impacto em férias**: ao desligar, avisar se o colaborador tem férias futuras agendadas, saldo de períodos aquisitivos em aberto ou folgas de crédito não gozadas, com opção de cancelar as férias futuras. Inclua
5. **Reset de período aquisitivo na recontratação**: um novo vínculo reinicia a contagem — o novo vínculo deve ser a referência para os cálculos, sem apagar o histórico antigo. Inclua
6. **Bloqueios de cadastro**: impedir lançar férias/folgas com data fora do período de vínculo ativo. Inclua
7. **Auditoria**: registrar cada desligamento/reativação em `module_audit_logs` (módulo férias), com autor e data, no mesmo padrão já usado nas alterações de férias. Inclua
8. **Relatório de rotatividade** (opcional, fase 2): admissões x desligamentos por mês/setor/unidade. Não inclua
9. **Validações**: demissão não pode ser anterior à admissão do vínculo; nova admissão não pode ser anterior à última demissão; sem sobreposição de vínculos. Inclua

## Detalhes técnicos

- Nova tabela `ferias_colaborador_vinculos`: `colaborador_id`, `data_admissao`, `data_demissao` (nulo = vínculo aberto), `tipo_desligamento`, `motivo`, `observacao`, `registrado_por`, timestamps. GRANTs + RLS no mesmo padrão das demais tabelas de férias (leitura para autenticados com acesso ao sistema, escrita para quem pode editar `ferias`).
- Migration de backfill: cria um vínculo aberto para cada colaborador existente usando a `data_admissao` atual; colaboradores já inativos ficam com vínculo aberto e sinalizados para o usuário completar a data de saída depois.
- Campos em `ferias_colaboradores`: `motivo_inativacao` ('desligamento' | 'temporario' | null) e `data_demissao` (denormalizado do vínculo vigente, para filtro/exportação rápidos), mantidos por trigger.
- Triggers de validação (não CHECK): coerência entre datas e não sobreposição de vínculos.
- Frontend: `DesativarColaboradorDialog.tsx` e `ReativarColaboradorDialog.tsx` em `src/components/ferias/colaboradores/`, hook `useColaboradorVinculos.ts`, seção de histórico em `ColaboradorViewDialog.tsx`, ajustes em `FeriasColaboradores.tsx` (badge, coluna, filtro, exportações) e `ColaboradorDialog.tsx` (status deixa de ser um select solto e passa pelos diálogos).