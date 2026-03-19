

## Plano: Corrigir contagens de externos + Atualizar Deploy Guide

### Problema 1: Contagens erradas nos Vínculos e "Por que não alocou"

Os dados de `finalExternalCount` nas abas "Vínculos" e "Por que não alocou" vêm do **trace de geração** (snapshot do momento da geração). Mas após a escala ser salva, edições manuais, trocas ou substituições alteram os números reais. A Adjane pode ter 3 externos na escala final, mas o trace ainda mostra 1/2.

A solução: o `result.brokerReports` (da validação pós-geração) já tem o `externalCount` **real** calculado a partir das assignments finais. Basta cruzar esses dados.

**Arquivo: `src/components/ValidationReportPanel.tsx`**

- Na `EligibilityView` e na `DiagnosticView`, construir um `Map<brokerId, realExternalCount>` a partir de `result.brokerReports`
- Substituir `broker.finalExternalCount` pelo valor real do mapa quando disponível
- Passar `result` como prop adicional para ambas as views internas
- Na badge, mostrar o número real de externos, não o do trace

### Problema 2: Deploy Guide precisa de especificações de VM

O guia atual assume Windows Server direto. O cenário real é: **Windows Server 2022 hospedando uma VM Linux (Ubuntu LTS)**.

**Arquivo: `src/pages/DeployGuide.tsx`**

Adicionar um novo Step 0 (ou reformular Step 1) com as especificações da VM:

- **Infraestrutura**: VM Linux rodando no Windows Server 2022 (Hyper-V)
- **S.O. da VM**: Ubuntu 24.04 LTS (ou 22.04 LTS)
- **vCPU**: mínimo 4 vCPUs (recomendado 6+ para Supabase + Nginx + Frontend)
- **RAM**: mínimo 8 GB (recomendado 16 GB — Supabase sozinho usa ~4-6 GB)
- **Disco**: mínimo 80 GB SSD (recomendado 120 GB+ para backups e logs)
- **Portas**: 80 (HTTP), 443 (HTTPS), 22 (SSH para gerenciamento)
- Remover toda a parte de WSL2/Docker Desktop (não se aplica a VM Linux)
- Simplificar para Docker Engine direto no Ubuntu
- Backup: diário automático via cron (pg_dump comprimido), retenção de 30 dias, com recomendação de cópia externa (NAS/objeto storage)
- Atualizar título/subtítulo: "VM Linux (Ubuntu LTS) no Windows Server 2022"
- Atualizar checklist final com os itens de VM

### Arquivos alterados
1. `src/components/ValidationReportPanel.tsx` — cruzar `finalExternalCount` com dados reais
2. `src/pages/DeployGuide.tsx` — reescrever para cenário VM Linux

