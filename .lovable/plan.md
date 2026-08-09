# Permissões do módulo Despesas: como está hoje e o que corrigir

## Respostas às suas dúvidas (com base no código atual)

**1. Removi o acesso ao sistema de Despesas na página de Usuários, mas não mexi nas permissões por aba. Ele ainda vê?**
Na tela, não: `DespesasLayout` envolve tudo no `SystemGuard system="despesas"`, que mostra "Acesso Negado". Duas ressalvas reais:
- O hook `useSystemAccess` guarda a permissão em cache (5 min "fresco", sem refetch ao remontar), então o usuário já logado pode continuar entrando por alguns minutos até recarregar/expirar o cache.
- No banco não há nenhuma checagem de `system_access`. As políticas RLS de despesas só olham `despesas_aba_permissoes` e `despesas_centros_custo_permissoes`. Ou seja: quem perdeu o acesso ao sistema, mas manteve permissões por aba, continua conseguindo ler os dados via API (fora da interface).

**2. Usuário com acesso ao sistema, mas sem nenhum nível nas abas: vê o quê?**
Se ele **não** for admin/super_admin: nenhuma aba aparece no menu (só Dashboard, Notificações, Perfil e Ajuda, que não têm aba vinculada). Ele abre o Dashboard e as consultas rodam, mas o RLS devolve vazio — KPIs em R$ 0, listas vazias. Não vaza valor, porém a página aparece como se não houvesse nada cadastrado, o que confunde.
Se ele **for** admin/administrador (role), o padrão do sistema é liberar tudo (`nivel = delete`) mesmo sem linha cadastrada — só limita se você criar a linha explícita "sem acesso".

**3. Se eu habilitar só "editar" em Bens Permanentes, ele vê só Bens?**
No menu ele vê: Dashboard, Bens Permanentes, Notificações, Perfil e Ajuda. Calendário, Recorrências, Relatórios, Imóveis, Repasses e Cadastros ficam ocultos. Mas as rotas não estão protegidas: digitando `/despesas/calendario` na URL a página abre (sem dados, por causa do RLS) em vez de mostrar "Acesso negado".

**4. Ele vê os dados de lançamentos de centro de custo que não tem acesso?**
Não. Toda leitura de lançamentos/imóveis/bens/repasses exige ver a aba **e** o centro de custo estar em `despesas_centros_permitidos`. Sem centro concedido, retorna vazio (super_admin vê todos).

**5. Pendências cadastrais e valores dos cards do Dashboard?**
Os cards e a lista de pendências fazem contagens sobre imóveis, recorrências e lançamentos. Como essas tabelas têm RLS por aba + centro de custo, os números já saem filtrados pelo que ele pode ver. O problema é de coerência: o Dashboard mostra cards de Calendário/Imóveis/Repasses para quem não tem essas abas, com links que levam a páginas vazias.

## O que proponho corrigir

1. **Proteger as rotas por aba** (não só o menu): criar um `DespesasAbaGuard` e aplicar em `/despesas/calendario`, `/recorrencias`, `/relatorios` (aba calendário), `/imoveis`, `/bens`, `/repasses`, `/cadastros`. Sem permissão → tela "Acesso negado" com botão para voltar.
2. **Dashboard consciente de permissão**: só consultar e exibir os blocos que o usuário pode ver.
   - KPIs de vencimento/pago, "Próximos vencimentos", gráfico de fluxo e Top centros → só com aba `calendario`.
   - Pendências cadastrais → cada item só aparece se a aba dona dele estiver liberada (imóveis → `imoveis`; recorrências e parciais → `calendario`).
   - Sem nenhuma aba: mostrar um card único "Você ainda não tem permissão em nenhuma aba. Fale com o administrador", sem consultas.
3. **Alinhar o banco com o acesso ao sistema**: incluir a checagem de acesso ao módulo dentro de `despesas_nivel_aba`, de forma que quem não tem `system_access` para `despesas` (e não é super_admin) receba `sem_acesso` em todas as abas. Isso fecha o acesso via API mesmo com permissões de aba antigas.
4. **Cache de permissão mais reativo**: reduzir o tempo de cache e revalidar ao montar nas permissões de sistema e de abas, para que a remoção de acesso valha na próxima navegação em vez de esperar 5 minutos.
5. **Deixar explícito na página de Permissões por Aba** que administradores têm acesso total por padrão quando não existe linha cadastrada, e permitir marcar "sem acesso" explicitamente para eles.

## Detalhes técnicos

- Novo componente `src/components/despesas/DespesasAbaGuard.tsx` usando `useDespesasPermissions().podeVer(aba)` + estado de carregamento; aplicado nas rotas em `src/App.tsx`.
- `src/hooks/useDespesasDashboard.ts` passa a receber as abas permitidas e monta as consultas condicionalmente; `DespesasDashboard.tsx` renderiza só as seções liberadas.
- Migration nova alterando `public.despesas_nivel_aba` para retornar `sem_acesso` quando não houver linha em `system_access` (`system_name = 'despesas'`) para o usuário, exceto `super_admin`. As demais políticas continuam iguais, pois todas passam por essa função.
- Ajuste de `staleTime`/`refetchOnMount` em `useSystemAccess.ts` e `useDespesasPermissions.ts`.