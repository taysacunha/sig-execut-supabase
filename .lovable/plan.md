## Plano: edição de férias com Q1 já gozado (caso Maria de Lourdes)

### Comportamento desejado (confirmado pelo usuário)

1. **Modo Padrão** ao tentar salvar com Q1 em dez/jan já gozado: continuar bloqueando, mas a mensagem de erro deve **explicar o motivo** ("Esta férias está em janeiro/dezembro — exige cadastro como exceção"). A regra de exceção em si está certa.
2. **Modo Exceção** ao vender dias com Q1 já gozado: o componente deve detectar que **o 1º período já foi consumido** e:
   - Não oferecer mais "1º Período" nem "Ambos" na distribuição (só "2º Período" e "Livre").
   - Calcular `diasGozo` com base apenas nos **dias restantes** (15 − vendidos), não 30 − vendidos.
   - Se o usuário **alterar** as datas oficiais do 1º período para datas ainda não gozadas, voltar a oferecer todas as opções (porque deixa de ser "Q1 já consumido").

### Causas raiz

**Problema 1 — mensagem de erro pouco clara em `validateVacation`** (`src/components/ferias/ferias/FeriasDialog.tsx`, linhas 1175–1180):

```ts
if (validation.requiresException && !data.is_excecao) {
  toast.error(validation.errors[0] || "Esta operação requer marcar como exceção");
  return;
}
```

`validation.errors[0]` para o caso `mes_bloqueado` é "Férias em janeiro ou dezembro requerem exceção" — está ok, mas a UX precisa ficar evidente: tipo + ação requerida no toast.

**Problema 2 — `ExcecaoPeriodosSection` ignora dias já gozados** (linhas 167, 189–222, 296–304):

```ts
const diasGozo = 30 - diasVendidos;       // ← assume sempre 30 disponíveis
if (distribuicaoTipo === "ambos") {
  const d1 = Math.ceil(diasGozo / 2);     // ← cria slot para Q1 que já foi gozada
  const d2 = diasGozo - d1;
  ...
}
```

Quando Maria de Lourdes (Q1 22/12/2025–05/01/2026 já gozada) escolhe "vender 5", o componente oferece distribuir 25 dias em "Ambos", obrigando o usuário a inventar datas no 1º período → conflito falso com Iasmin (13/07–27/07).

### Correções

#### A. `FeriasDialog.tsx` — mensagem de erro detalhada

Em `onSubmit` (linha 1175), montar mensagem explícita por motivo:

```ts
if (validation.requiresException && !data.is_excecao) {
  const motivoLabel = {
    mes_bloqueado: "Férias em janeiro ou dezembro",
    venda_acima_limite: "Venda acima de 10 dias",
    conflito_setor: "Conflito de setor",
  }[validation.exceptionReason] || "Esta operação";
  toast.error(`${motivoLabel} exige cadastro como exceção. Clique em "Exceção" no topo do formulário.`, {
    duration: 6000,
  });
  return;
}
```

Mantém a regra original (Q1 em dez/jan **sempre** vai para exceção, mesmo já gozada).

#### B. `FeriasDialog.tsx` — calcular `q1JaGozada` e propagar

Adicionar lógica que detecta se o 1º período oficial **no formulário** corresponde a uma quinzena que já foi gozada anteriormente:

```ts
// Q1 considerada "já gozada" se:
//   - estamos editando E
//   - as datas atuais do form para Q1 são iguais às salvas no banco E
//   - o status é q1_concluida / em_gozo_q2 / em_gozo / concluida
const q1JaGozada = useMemo(() => {
  if (!isEditing || !ferias) return false;
  const q1Unchanged =
    q1Inicio === ferias.quinzena1_inicio &&
    q1Fim === ferias.quinzena1_fim;
  const statusConsumido = ["q1_concluida", "em_gozo_q2", "em_gozo", "concluida"]
    .includes(ferias.status);
  return q1Unchanged && statusConsumido;
}, [isEditing, ferias, q1Inicio, q1Fim]);
```

Passar para `<ExcecaoPeriodosSection>` como nova prop `q1JaGozada`.

> Observação importante: se o usuário alterar a data de início do Q1 no formulário (`q1Inicio` muda), `q1JaGozada` automaticamente vira `false` — exatamente o comportamento que você pediu ("a não ser que esse primeiro período seja modificado para uma data que não foi gozada ainda").

#### C. `ExcecaoPeriodosSection.tsx` — respeitar `q1JaGozada`

Acrescentar prop opcional:

```ts
interface ExcecaoPeriodosSectionProps {
  ...
  q1JaGozada?: boolean; // default false
}
```

Aplicar três efeitos:

**1. Recalcular `diasGozo`:**
```ts
const diasDisponiveis = q1JaGozada ? 15 : 30;
const diasGozo = Math.max(0, diasDisponiveis - diasVendidos);
```

**2. Filtrar opções de distribuição:**
```ts
const opcoesDistribuicao = q1JaGozada
  ? ["2", "livre"]                    // só 2º Período ou Livre
  : ["1", "2", "ambos", "livre"];     // todas as opções
```
Renderizar apenas essas opções nos botões (linha 312).

**3. Limitar input "dias a vender":**
```ts
<Input
  type="number"
  min={1}
  max={diasDisponiveis}              // 15 quando Q1 já gozada
  ...
/>
```

**4. Se `distribuicaoTipo` atual era "1" ou "ambos" e `q1JaGozada` ficou `true`** (ex.: usuário voltou a colocar a data original do Q1): resetar para `"2"` automaticamente:
```ts
useEffect(() => {
  if (isHydrating) return;
  if (q1JaGozada && (distribuicaoTipo === "1" || distribuicaoTipo === "ambos")) {
    onDistribuicaoTipoChange("2");
  }
}, [q1JaGozada]);
```

**5. Atualizar Cartão Resumo:**
```
Dias do período aquisitivo: 30
Já gozados (Q1): -15        ← só aparece se q1JaGozada
Disponíveis: 15
Vendidos: -5
Gozo: 10
```

**6. Alerta informativo** quando `q1JaGozada`:
```
ℹ O 1º período já foi gozado (22/12/2025 a 05/01/2026).
   Apenas o 2º período pode ser distribuído. Para alterar o 1º,
   modifique sua data de início no formulário acima.
```

### Comportamento esperado após correção (caso Maria de Lourdes)

**Cenário 1 — tentar salvar no Padrão com venda de 5 dias do Q2:**
- Toast detalhado: *"Férias em janeiro ou dezembro exige cadastro como exceção. Clique em 'Exceção' no topo do formulário."*

**Cenário 2 — Exceção, vender 5 dias:**
- Detecta `q1JaGozada = true`.
- Input "dias a vender" limitado a 15.
- Distribuição mostra apenas "2º Período" e "Livre".
- Selecionando "2º Período": cria 1 slot com 10 dias de gozo (15 − 5).
- Sem conflito falso com Iasmin.
- Resumo mostra "Já gozados: −15", "Disponíveis: 15", "Vendidos: −5", "Gozo: 10".

**Cenário 3 — usuário muda Q1 para data nova (não gozada):**
- `q1JaGozada` automaticamente vira `false`.
- Volta a oferecer 30 dias, todas as 4 opções de distribuição.

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ferias/ferias/FeriasDialog.tsx` | Toast com motivo explícito quando bloqueia salvar; calcular `q1JaGozada` e passar para `ExcecaoPeriodosSection` |
| `src/components/ferias/ferias/ExcecaoPeriodosSection.tsx` | Nova prop `q1JaGozada`; `diasGozo = (q1JaGozada ? 15 : 30) − diasVendidos`; ocultar opções "1º"/"Ambos" e ajustar max do input quando `q1JaGozada`; alerta informativo; reset automático de `distribuicaoTipo` |

### Notas

- Sem mudanças em schema, RLS, queries do gerador ou regras de exceção em si.
- A regra "jan/dez = sempre exceção" continua intocada — apenas a mensagem fica mais clara.
- A detecção de `q1JaGozada` se baseia em status + datas inalteradas; se o usuário modificar Q1 para datas novas, o sistema trata como reescrita do período e libera todas as opções.
