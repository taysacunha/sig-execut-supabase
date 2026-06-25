## Análise

O finding `vulnerable_dependencies_high` restante cobre 2 pacotes — ambos sem patch disponível e sem exposição real:

| Pacote | Versão atual | Por que ignorar |
|---|---|---|
| `vitest` | 4.1.9 (última) | **DevDependency**, roda só localmente via `npm test`. As CVEs são todas no `vite` dev-server / `picomatch` ReDoS, que **não vão para produção** — `vite build` gera HTML/JS estático. Não há vite dev server exposto a usuários. |
| `xlsx` | 0.18.5 (última pública no npm) | Já justificado: app só **exporta** planilhas com dados internos, nunca chama `XLSX.read()` em upload de usuário. Sem vetor para prototype pollution / ReDoS. |

Não há atualização que resolva: vitest 4.1.9 é a mais recente, e xlsx não publica mais no npm (só CDN próprio).

## Execução

1. Marcar o finding `vulnerable_dependencies_high` como **ignored** via `security--manage_security_finding` com justificativa cobrindo os dois pacotes.
2. Atualizar `@security-memory` adicionando vitest/vite dev-only à lista de riscos aceitos (xlsx já está lá).

Sem mudanças de código ou de dependências.
