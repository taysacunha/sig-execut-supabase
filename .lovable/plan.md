

## Plano: Corrigir gerador ignorando datas desmarcadas no calendario (Nammos/Botanic)

### Causa raiz

Quando o usuario configura um local externo no modo `weekday` e usa o calendario para selecionar/desmarcar dias especificos, a UI salva os dias selecionados em **duas** tabelas:
- `period_day_configs` — por dia da semana (ex: "monday", "tuesday")
- `period_specific_day_configs` — por data especifica (ex: "2025-04-22")

Ao **desmarcar** o dia 21/04 no calendario, o registro de `period_specific_day_configs` para essa data e removido. Porem, o gerador de escalas para locais no modo `weekday` funciona assim (linha 3174-3199):

1. Procura config especifica para a data → se encontrar, usa
2. Se NAO encontrar E modo = `specific_date` → pula a data
3. Se NAO encontrar E modo = `weekday` → **usa `period_day_configs` pelo dia da semana**

No passo 3, como 21/04 e uma segunda-feira e "monday" esta configurado em `period_day_configs` (porque outras segundas estao selecionadas), o gerador **cria demanda para 21/04 mesmo estando desmarcado**.

Em resumo: desmarcar uma data especifica no calendario nao tem efeito na geracao para locais `weekday`, porque o gerador ignora a ausencia e usa o fallback por dia da semana.

### Correcao

Alterar o gerador em `src/lib/scheduleGenerator.ts` para que, quando um periodo possui registros em `period_specific_day_configs`, esses registros funcionem como **whitelist**: se a data nao esta na lista, pular — independente do `shift_config_mode`.

**Logica nova** (entre linhas 3174 e 3180):

```
// Verificar se este periodo tem configs especificas cadastradas
const periodHasSpecificConfigs = allSpecificConfigs?.some(c => c.period_id === activePeriod.id);

const specificConfig = specificConfigsMap.get(`${activePeriod.id}-${dateStr}`);

if (specificConfig) {
  // usar config especifica (sem mudanca)
} else if (location.shift_config_mode === 'specific_date') {
  continue; // pular (sem mudanca)
} else if (periodHasSpecificConfigs) {
  // NOVO: periodo tem whitelist de datas especificas,
  // mas esta data NAO esta na lista → pular
  continue;
} else {
  // usar period_day_configs por weekday (sem mudanca)
}
```

Para performance, pre-computar um `Set` de period_ids que possuem configs especificas, em vez de iterar `allSpecificConfigs` a cada data.

A mesma correcao deve ser aplicada na funcao `detectUnallocatedDemands` (linha ~5120) para manter consistencia entre geracao e validacao.

### Arquivo alterado

1. **`src/lib/scheduleGenerator.ts`** — adicionar verificacao de whitelist por periodo nas duas funcoes (geracao + validacao)

