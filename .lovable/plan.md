## Análise dos findings

Todos os 3 findings são do mesmo scanner (`supply_chain` = npm audit). Nenhum é problema do código do app — são versões de pacotes npm.

| Pacote | Versão | Sev | Ação |
|---|---|---|---|
| `vitest` | 4.0.18 | crítico/alto/médio | **Atualizar** para `^4.1.0+` (corrige vite + picomatch + launch-editor). Dev-only, mas elimina o crítico. |
| `react-router-dom` | 6.30.1 | alto/médio | **Atualizar** para `^6.31.0+` (corrige XSS via open redirect / protocol-relative URL). Roda em produção. |
| `@supabase/supabase-js` | 2.76.0 | alto/médio | **Atualizar** para `^2.78.0+` (puxa `ws` corrigido). |
| `recharts` | 2.15.4 | alto/médio | **Atualizar** para `^2.15.5+` (puxa `lodash` corrigido). |
| `jspdf` | 4.2.1 | médio (DOMPurify) | **Atualizar** para `^4.3.0+` se houver release com fix; caso contrário **ignorar** — usamos jsPDF apenas para gerar PDFs server-side de dados próprios, sem HTML de usuário sendo sanitizado por DOMPurify. |
| `xlsx` | 0.18.5 | alto | **Ignorar como não aplicável** — SheetJS não publica no npm desde 0.18.5 (apenas no CDN deles). O app só **exporta** XLSX com dados próprios (nunca faz `read()` de arquivo enviado pelo usuário), então o prototype-pollution/ReDoS não tem vetor. |

## Execução

1. Rodar `bun add` apenas para os pacotes com fix disponível:
   ```
   bun add vitest@latest react-router-dom@latest @supabase/supabase-js@latest recharts@latest jspdf@latest
   ```
2. Re-rodar `code--dependency_scan` para confirmar redução dos findings.
3. Para o que sobrar sem fix (provavelmente `xlsx` e talvez parte de `jspdf`), chamar `security--manage_security_finding` com `operation: "ignore"` e justificativa por finding, e atualizar `@security-memory` via `security--update_memory` registrando:
   - `xlsx@0.18.5` é a última versão pública no npm; o app apenas exporta, nunca importa arquivos do usuário → não há superfície de ataque.
   - `jspdf`/DOMPurify: usado só para PDFs gerados internamente, sem HTML controlado pelo usuário.

## Fora de escopo

- Migrar `xlsx` para `exceljs` (mudaria APIs em `src/lib/exportUtils.ts` e botões de export).
- Migrar `vitest` 4→5 se introduzir breaking changes maiores (mantém 4.x).
- Mudanças no app — apenas `package.json`/lockfile.
