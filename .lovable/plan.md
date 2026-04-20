

## Plano: corrigir conflito falso no diálogo de férias (Lidiane × Camily)

### Causa raiz

Em `src/components/ferias/ferias/FeriasDialog.tsx` (`checkConflicts`, linhas 569–678), a verificação usa `allSectorIds = [setor_titular do selecionado, ...setores onde o selecionado é substituto]` e busca colegas cujo **setor titular** esteja nesse conjunto. Isso considera apenas um lado da relação de substituição.

Resultado: se em algum momento existiu um vínculo (mesmo já removido) ou se há sujeira em `ferias_colaborador_setores_substitutos`, o filtro pode trazer colegas sem nenhuma relação atual de cobertura. Pior: a regra ideal — "conflito existe quando, se ambos saírem, o setor de algum dos dois fica descoberto" — não está implementada de forma simétrica nem rigorosa.

A regra correta acordada com o usuário:

> Conflito existe se **(a)** ambos têm o mesmo setor titular, **OU (b)** o selecionado é substituto do setor titular do colega, **OU (c)** o colega é substituto do setor titular do selecionado.

### Mudanças

**Arquivo principal**: `src/components/ferias/ferias/FeriasDialog.tsx`

#### 1. Recarregar substitutos dos dois lados antes do filtro

Em `checkConflicts`, substituir o bloco atual (linhas 569–584) por:

- Buscar `mySubstituteSectors = setor_id[]` onde `colaborador_id = selecionado` (já existe).
- Buscar `colabsThatCoverMySector = colaborador_id[]` onde `setor_id = selectedColab.setor_titular_id` em `ferias_colaborador_setores_substitutos` (novo — descobre quem é substituto do setor do selecionado).
- Construir `relevantColabIds` por união:
  - colegas com `setor_titular_id = selectedColab.setor_titular_id` (mesmo setor) — caso (a)
  - colegas com `setor_titular_id IN mySubstituteSectors` (eu cubro o setor titular deles) — caso (b)
  - colegas em `colabsThatCoverMySector` (eles cobrem meu setor titular) — caso (c)
- Substituir a query `sameSetorColabs` por uma query que filtra por `id IN relevantColabIds` e `status = 'ativo'`, excluindo o próprio.

Isso garante que apenas colegas com relação real de cobertura sejam avaliados.

#### 2. Rotular o tipo de conflito corretamente

No bloco que monta `foundConflicts` (linhas 665–675), substituir o `isSubstitute` simples por classificação explícita usando os três sets (`mesmoSetor`, `euCubro`, `eleCobre`):
- `tipo: "Mesmo setor"` se `colega.setor_titular_id === selectedColab.setor_titular_id`
- `tipo: "Setor substituto (você cobre)"` se o colega é titular num setor onde eu sou substituto
- `tipo: "Setor substituto (ele cobre)"` se o colega é substituto do meu setor titular
- (se cair em mais de um, prioriza "Mesmo setor")

Isso ajuda o usuário a entender de onde vem o conflito e descobrir vínculos errados no cadastro.

#### 3. Aplicar a mesma correção no gerador automático

`src/lib/vacationGenerator.ts` (`checkWindowConflicts`, linhas 167–227 e função `fetchSubstituteSectors` linhas 128–141): hoje carrega só substitutos do colaborador iterado e filtra `allocSetorId IN allSectorIds` (mesmo padrão unidirecional). Mudanças:

- Em `fetchSubstituteSectors`, retornar dois mapas: `colabToSectors` (já existe) e o **inverso** `sectorToColabs` (`Record<setor_id, colaborador_id[]>`).
- Em `checkWindowConflicts`, receber também `sectorToCovers` e o `setorTitularDeCadaColab` (já calculável via `forms`/`existingVacations`); a regra de conflito passa a ser a tripla (a)/(b)/(c) acima, simétrica.

### Notas técnicas

- Não há mudança de schema nem de RLS.
- `ferias_conflitos` (conflitos familiares manuais) continua intacta.
- A correção não toca em `afastamentos` nem na regra "familiar deve coincidir".
- Edge case: se `mySubstituteSectors` estiver vazio E `colabsThatCoverMySector` estiver vazio, `relevantColabIds` colapsa para "mesmo setor titular apenas" — comportamento correto e mínimo.
- Após o deploy, o caso Lidiane × Camily deixa de aparecer (assumindo que de fato nenhuma é substituta da outra). Se ainda aparecer, o usuário verá a label "Mesmo setor" e poderá investigar o cadastro de setor titular.

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ferias/ferias/FeriasDialog.tsx` | Reescrever `checkConflicts` para considerar relação simétrica (3 casos) e rotular o tipo corretamente |
| `src/lib/vacationGenerator.ts` | Tornar `checkWindowConflicts` simétrico (mesmo critério) e expor mapa inverso de substitutos |

