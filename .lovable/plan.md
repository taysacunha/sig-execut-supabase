## Ajustes no Sistema de Férias

### 1. Dialog "Novo Afastamento" – substituir motivos
Arquivo: `src/components/ferias/colaboradores/AfastamentosSection.tsx`

Atualizar o mapa `MOTIVO_LABELS`:
- Remover: `acidente`, `doenca`, `licenca_medica`
- Adicionar: `atestado_medico` ("Atestado Médico"), `acompanhamento_familiar` ("Acompanhamento de Pessoa da Família"), `doacao_sangue` ("Doação de Sangue")
- Manter: `licenca_maternidade`, `licenca_paternidade`, `outros`
- Trocar o `useState` inicial de `"doenca"` para `"atestado_medico"`

Observação: o campo `motivo` no banco (`ferias_afastamentos`) é texto livre, então não é necessária migração. Registros antigos com `acidente/doenca/licenca_medica` continuarão sendo exibidos com o próprio valor (fallback no `MOTIVO_LABELS[a.motivo] || a.motivo`).

### 2. Novo PDF de Afastamentos (página Colaboradores)
Arquivo novo: `src/components/ferias/colaboradores/AfastamentosPDFGenerator.tsx`
Integração: botão ao lado de "PDF" no header de `src/pages/ferias/FeriasColaboradores.tsx`.

Comportamento:
- Botão "PDF Afastamentos" abre um Dialog com filtros:
  - **Mês/Ano** (seletor de mês — padrão mês atual)
  - **Colaborador**: multi-select com opção "Todos" (combobox com busca)
  - **Motivo**: multi-select com opção "Todos" (lista nova de motivos + "outros" + valores legados se presentes)
- Botão "Gerar PDF" consulta `ferias_afastamentos` filtrando por sobreposição com o mês selecionado (`data_inicio <= fimMes AND data_fim >= inicioMes`) e pelos filtros.
- PDF (jsPDF, paisagem) com cabeçalho azul padrão do sistema, mês de referência, e tabela: Colaborador | Setor | Motivo | Início | Fim | Dias | Observações. Linhas com zebra striping, rodapé com data de geração e total. Nome do arquivo: `afastamentos-{mes}-{ano}.pdf`.

### 3. Dialog "Registrar Perda de Folga" – remover Atestado Médico
Arquivo: `src/components/ferias/folgas/PerdaFolgaDialog.tsx`
- Remover a entrada `{ value: "atestado_medico", label: "Atestado médico" }` de `MOTIVOS_PERDA`.
- Sem migração: registros antigos com `motivo = 'atestado_medico'` permanecem visíveis na listagem (renderização usa o valor bruto como fallback).

### 4. Novo PDF de Perdas de Folga (página Folgas → aba Perdas)
Arquivo novo: `src/components/ferias/folgas/PerdasFolgaPDFGenerator.tsx`
Integração: botão na aba "Perdas de Folga" em `src/pages/ferias/FeriasFolgas.tsx`, ao lado dos controles existentes.

Comportamento idêntico ao do PDF de afastamentos:
- Filtros: **Mês/Ano**, **Colaborador** (multi com "Todos"), **Motivo** (multi com "Todos", usando a lista atualizada de `MOTIVOS_PERDA`).
- Consulta `ferias_folgas_perdas` por `ano`/`mes` e demais filtros, com join em `ferias_colaboradores` para nome/setor.
- PDF paisagem, cabeçalho azul "Perdas de Folga – {Mês}/{Ano}", tabela: Colaborador | Setor | Motivo | Observações | Registrado em. Zebra striping, rodapé com total. Arquivo: `perdas-folga-{mes}-{ano}.pdf`.

### Detalhes técnicos
- Reutilizar padrão visual do `FolgasPDFGenerator.tsx` (cor `(59,130,246)`, helvetica, margens, rodapé).
- Multi-select implementado com `Popover + Command` (mesmo padrão já usado nos dialogs do módulo), com checkbox virtual e item "Todos" no topo que alterna seleção completa.
- Sem mudanças de banco / RLS / tipos. Sem mudanças em outras telas.
- Manter PT-BR em todos os textos e respeitar `canEdit`/permissões existentes (botões de PDF visíveis para quem já vê as páginas).
