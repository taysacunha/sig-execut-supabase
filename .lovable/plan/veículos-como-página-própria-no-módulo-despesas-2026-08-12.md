# Veículos como página própria no módulo Despesas

Hoje Veículos é apenas uma aba dentro de Cadastros, então quem tem acesso a Cadastros vê veículos junto com pessoas, categorias, contas etc. A mudança transforma Veículos em página independente, com permissão própria — igual a Imóveis e Bens Permanentes.

## O que muda

- Nova página `/despesas/veiculos` com o mesmo padrão visual das outras carteiras: cabeçalho "Veículos" + botão "Novo veículo", busca, tabela (Modelo, Placa, Motorista, Proprietário, Centro de custo, Documentos ativos, Ações) e os botões de editar, desativar e "Gerar encargos" já existentes (com o diálogo informativo de documentos/valor estimado).
- Item "Veículos" no menu lateral, entre **Bens Permanentes** e **Repasses**.
- A aba "Veículos" some da página de Cadastros; o restante das abas continua igual.
- Nova aba de permissão **Veículos** na página "Permissões por Aba", com os mesmos níveis (sem acesso / ver / editar / excluir) e incluída nos perfis-modelo.
- Valores monetários seguem o botão do olho, como nas demais páginas.

## Detalhes técnicos

Migration (`db/migrations/…_despesas_veiculos_aba.sql`):
- Incluir `'veiculos'` no CHECK de `despesas_aba_permissoes.aba`.
- Substituir as políticas RLS de `despesas_veiculos` e `despesas_veiculo_documentos` para usarem `despesas_pode_ver_aba/editar_aba/excluir_aba(auth.uid(), 'veiculos')` no lugar de `'cadastros'`.
- Migrar o nível atual de `cadastros` de cada usuário para uma linha `veiculos`, preservando o acesso de quem já tinha (sem alterar `cadastros`).

Frontend:
- `src/pages/despesas/DespesasVeiculos.tsx` — extrai o conteúdo de `VeiculosTab` de `DespesasCadastros.tsx` (nenhuma lógica nova; hooks de `useDespesasVeiculos.ts` reaproveitados).
- Remover a aba/`VeiculosTab` de `src/pages/despesas/DespesasCadastros.tsx`.
- Rota lazy em `src/App.tsx`; item de menu em `src/components/DespesasSidebar.tsx` com `aba: "veiculos"`.
- `DespesasAba` em `src/hooks/useDespesasPermissions.ts` e lista de abas/perfis em `src/pages/despesas/DespesasPermissoes.tsx` ganham `veiculos`.

Como no caso de Bens, o SQL precisa ser executado no Supabase para as permissões novas valerem.
