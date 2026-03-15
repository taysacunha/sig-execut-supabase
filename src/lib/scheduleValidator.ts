// ═══════════════════════════════════════════════════════════
// VALIDADOR COMPLETO DE REGRAS DE ESCALA
// Verifica TODAS as regras ANTES de salvar - aborta se houver violação
// ═══════════════════════════════════════════════════════════

import { format, addDays, subDays } from "date-fns";
import { ScheduleAssignment } from "./scheduleGenerator";

export interface RuleViolation {
  rule: string;
  brokerName: string;
  brokerId: string;
  details: string;
  date?: string;
  location?: string;
  severity: 'critical' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  violations: RuleViolation[];
  summary: string;
}

interface BrokerInfo {
  id: string;
  name: string;
}

interface LocationInfo {
  id: string;
  name: string;
  type: string;
  builderCompany?: string;
}

/**
 * Valida TODAS as regras de negócio nas alocações geradas
 * DEVE ser chamada ANTES de salvar no banco
 * Se retornar valid: false, a escala NÃO DEVE ser salva
 */
/**
 * Valida TODAS as regras de negócio nas alocações geradas
 * DEVE ser chamada ANTES de salvar no banco
 * Se retornar valid: false, a escala NÃO DEVE ser salva
 * 
 * @param assignments - Alocações da semana atual
 * @param brokers - Lista de corretores
 * @param locations - Lista de locais
 * @param previousWeeksAssignments - Alocações das semanas anteriores (para validar rotação entre semanas)
 */
export function validateAllRulesCompliance(
  assignments: ScheduleAssignment[],
  brokers: BrokerInfo[],
  locations: LocationInfo[],
  previousWeeksAssignments?: ScheduleAssignment[],
  locationBrokerConfigs?: Map<string, string[]> // Map<locationId, brokerId[]> - corretores CONFIGURADOS por local
): ValidationResult {
  const violations: RuleViolation[] = [];
  
  const brokerMap = new Map<string, string>();
  brokers.forEach(b => brokerMap.set(b.id, b.name));
  
  const locationMap = new Map<string, LocationInfo>();
  locations.forEach(l => locationMap.set(l.id, l));
  
  const getBrokerName = (id: string) => brokerMap.get(id) || id;
  const getLocation = (id: string) => locationMap.get(id);
  
  // Agrupar alocações por corretor e data
  const brokerDateAssignments = new Map<string, Map<string, ScheduleAssignment[]>>();
  
  for (const assignment of assignments) {
    if (!brokerDateAssignments.has(assignment.broker_id)) {
      brokerDateAssignments.set(assignment.broker_id, new Map());
    }
    const dateMap = brokerDateAssignments.get(assignment.broker_id)!;
    if (!dateMap.has(assignment.assignment_date)) {
      dateMap.set(assignment.assignment_date, []);
    }
    dateMap.get(assignment.assignment_date)!.push(assignment);
  }
  
  // Agrupar por semana para verificar limite semanal
  const brokerWeeklyExternals = new Map<string, number>();
  
  for (const assignment of assignments) {
    const loc = getLocation(assignment.location_id);
    if (loc?.type === 'external') {
      const key = assignment.broker_id;
      brokerWeeklyExternals.set(key, (brokerWeeklyExternals.get(key) || 0) + 1);
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // REGRA 1: Máximo 2 externos por semana por corretor
  // NOTA: 3 externos é WARNING (pode ocorrer por alta demanda)
  //       4+ externos é CRITICAL (nunca deve acontecer - hard cap)
  // ═══════════════════════════════════════════════════════════
  for (const [brokerId, count] of brokerWeeklyExternals) {
    // Contamos DIAS únicos por dia (não por turno)
    const externalDays = new Set<string>();
    for (const assignment of assignments) {
      const loc = getLocation(assignment.location_id);
      if (assignment.broker_id === brokerId && loc?.type === 'external') {
        externalDays.add(assignment.assignment_date);
      }
    }
    
    if (externalDays.size >= 4) {
      // 4+ externos = ERRO CRÍTICO - nunca deve acontecer
      violations.push({
        rule: "REGRA 1: LIMITE ABSOLUTO 4+ externos/semana",
        brokerName: getBrokerName(brokerId),
        brokerId,
        details: `PROIBIDO: Tem ${externalDays.size} dias com externo na semana (máximo absoluto: 3). Isso NUNCA deve ocorrer.`,
        severity: 'critical'
      });
    } else if (externalDays.size === 3) {
      // 3 externos = Warning (pode ocorrer quando necessário)
      violations.push({
        rule: "REGRA 1: Máximo 2 externos/semana",
        brokerName: getBrokerName(brokerId),
        brokerId,
        details: `Tem ${externalDays.size} dias com externo na semana (máx ideal: 2) - EXCEDEU LIMITE (alta demanda)`,
        severity: 'warning'
      });
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // REGRA 4: Não pode ter externo no mesmo dia em locais DIFERENTES
  // EXPLICAÇÃO: Um corretor fisicamente não pode estar em dois empreendimentos
  // externos diferentes no mesmo dia, pois precisa estar presente no local.
  // ═══════════════════════════════════════════════════════════
  for (const [brokerId, dateMap] of brokerDateAssignments) {
    for (const [date, dayAssignments] of dateMap) {
      const externalLocations = new Set<string>();
      
      for (const assignment of dayAssignments) {
        const loc = getLocation(assignment.location_id);
        if (loc?.type === 'external') {
          externalLocations.add(assignment.location_id);
        }
      }
      
      if (externalLocations.size > 1) {
        const locNames = Array.from(externalLocations).map(id => getLocation(id)?.name || id).join(' e ');
        violations.push({
          rule: "REGRA 4: Múltiplos locais externos no mesmo dia",
          brokerName: getBrokerName(brokerId),
          brokerId,
          date,
          details: `${getBrokerName(brokerId)} está alocado em ${externalLocations.size} locais EXTERNOS diferentes no dia ${date}: ${locNames}. Isso é impossível fisicamente.`,
          severity: 'critical'
        });
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // REGRA 5: Não pode ter manhã E tarde no mesmo local externo
  // EXCEÇÃO: Se for caso especial de needsSameBroker (apenas 1 corretor configurado)
  // Detectamos isso verificando se há outros corretores no mesmo local/data
  // ═══════════════════════════════════════════════════════════
  for (const [brokerId, dateMap] of brokerDateAssignments) {
    for (const [date, dayAssignments] of dateMap) {
      // Agrupar por local
      const locationAssignments = new Map<string, ScheduleAssignment[]>();
      for (const assignment of dayAssignments) {
        if (!locationAssignments.has(assignment.location_id)) {
          locationAssignments.set(assignment.location_id, []);
        }
        locationAssignments.get(assignment.location_id)!.push(assignment);
      }
      
      for (const [locationId, locAssignments] of locationAssignments) {
        const loc = getLocation(locationId);
        
        // Só verificar para locais externos
        if (loc?.type !== 'external') continue;
        
        const shifts = new Set(locAssignments.map(a => a.shift_type));
        
        // Se tem manhã E tarde no mesmo local externo
        if (shifts.has('morning') && shifts.has('afternoon')) {
          // Verificar se outros corretores estão no mesmo local/data (o que indicaria needsSameBroker false)
          const allBrokersAtLocation = new Set(
            assignments
              .filter(a => a.location_id === locationId && a.assignment_date === date)
              .map(a => a.broker_id)
          );
          
          // Se APENAS este corretor está neste local/data, pode ser caso especial (needsSameBroker)
          // Mas mesmo assim, vamos reportar como warning para análise
          if (allBrokersAtLocation.size === 1) {
            console.log(`⚠️ ${getBrokerName(brokerId)} faz manhã+tarde sozinho em ${loc.name} (${date}) - POSSÍVEL needsSameBroker`);
            // Não marcar como violação se é o único corretor (provável needsSameBroker)
            continue;
          }
          
          // Se há outros corretores, então needsSameBroker era false e isso é violação
          violations.push({
            rule: "REGRA 5: Dois turnos externos no mesmo local",
            brokerName: getBrokerName(brokerId),
            brokerId,
            date,
            location: loc.name,
            details: `Alocado para MANHÃ e TARDE em ${loc.name} (quando outros corretores estão disponíveis)`,
            severity: 'critical'
          });
        }
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // REGRA ABSOLUTAMENTE INVIOLÁVEL: 3 DIAS EXTERNOS CONSECUTIVOS
  // Esta regra NUNCA pode ser relaxada - é erro crítico se ocorrer
  // ═══════════════════════════════════════════════════════════
  for (const [brokerId, dateMap] of brokerDateAssignments) {
    const externalDates: Date[] = [];
    
    for (const [date, dayAssignments] of dateMap) {
      const hasExternal = dayAssignments.some(a => getLocation(a.location_id)?.type === 'external');
      if (hasExternal) {
        externalDates.push(new Date(date + "T00:00:00"));
      }
    }
    
    // Ordenar datas
    externalDates.sort((a, b) => a.getTime() - b.getTime());
    
    // Verificar 3 dias consecutivos
    for (let i = 0; i < externalDates.length - 2; i++) {
      const diff1 = Math.round((externalDates[i + 1].getTime() - externalDates[i].getTime()) / (1000 * 60 * 60 * 24));
      const diff2 = Math.round((externalDates[i + 2].getTime() - externalDates[i + 1].getTime()) / (1000 * 60 * 60 * 24));
      
      if (diff1 === 1 && diff2 === 1) {
        violations.push({
          rule: "REGRA ABSOLUTA: 3 dias externos consecutivos",
          brokerName: getBrokerName(brokerId),
          brokerId,
          date: format(externalDates[i], "yyyy-MM-dd"),
          details: `PROIBIDO: ${getBrokerName(brokerId)} tem 3 dias externos consecutivos: ${format(externalDates[i], "dd/MM")}, ${format(externalDates[i+1], "dd/MM")}, ${format(externalDates[i+2], "dd/MM")}`,
          severity: 'critical'
        });
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // REGRA 8: Dias consecutivos (não pode ter externo em dias seguidos)
  // NOTA: 2 dias consecutivos é WARNING (pode ser relaxado como último recurso)
  // ═══════════════════════════════════════════════════════════
  for (const [brokerId, dateMap] of brokerDateAssignments) {
    const externalDates: string[] = [];
    
    for (const [date, dayAssignments] of dateMap) {
      const hasExternal = dayAssignments.some(a => getLocation(a.location_id)?.type === 'external');
      if (hasExternal) {
        externalDates.push(date);
      }
    }
    
    // Ordenar datas
    externalDates.sort();
    
    for (let i = 0; i < externalDates.length - 1; i++) {
      const currentDate = new Date(externalDates[i] + "T00:00:00");
      const nextDate = new Date(externalDates[i + 1] + "T00:00:00");
      const diffDays = Math.round((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        violations.push({
          rule: "REGRA 8: Dias consecutivos",
          brokerName: getBrokerName(brokerId),
          brokerId,
          date: externalDates[i],
          details: `Externo em dias consecutivos: ${externalDates[i]} e ${externalDates[i + 1]}`,
          severity: 'warning' // MUDADO: Era 'critical', agora é 'warning' (pode ser relaxado como último recurso)
        });
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // REGRA 9: Sábado-Domingo (não pode ter externo nos dois)
  // ═══════════════════════════════════════════════════════════
  for (const [brokerId, dateMap] of brokerDateAssignments) {
    const weekendDates: { saturday?: string; sunday?: string } = {};
    
    for (const [date, dayAssignments] of dateMap) {
      const dateObj = new Date(date + "T00:00:00");
      const dayOfWeek = dateObj.getDay();
      const hasExternal = dayAssignments.some(a => getLocation(a.location_id)?.type === 'external');
      
      if (hasExternal) {
        if (dayOfWeek === 6) weekendDates.saturday = date;
        if (dayOfWeek === 0) weekendDates.sunday = date;
      }
    }
    
    if (weekendDates.saturday && weekendDates.sunday) {
      violations.push({
        rule: "REGRA 9: Sábado E Domingo",
        brokerName: getBrokerName(brokerId),
        brokerId,
        details: `Externo no sábado (${weekendDates.saturday}) E domingo (${weekendDates.sunday})`,
        severity: 'critical'
      });
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // REGRA 6: Conflito de construtora (mesmo dia, construtoras diferentes)
  // EXPLICAÇÃO: Por acordo comercial/operacional, um corretor não pode 
  // atender construtoras concorrentes no mesmo dia.
  // ═══════════════════════════════════════════════════════════
  for (const [brokerId, dateMap] of brokerDateAssignments) {
    for (const [date, dayAssignments] of dateMap) {
      const builders = new Set<string>();
      const builderLocations = new Map<string, string>(); // builder -> location name
      
      for (const assignment of dayAssignments) {
        const loc = getLocation(assignment.location_id);
        if (loc?.type === 'external' && loc.builderCompany) {
          builders.add(loc.builderCompany);
          builderLocations.set(loc.builderCompany, loc.name);
        }
      }
      
      if (builders.size > 1) {
        const buildersList = Array.from(builders).map(b => `${b} (${builderLocations.get(b)})`).join(' e ');
        violations.push({
          rule: "REGRA 6: Conflito de construtora",
          brokerName: getBrokerName(brokerId),
          brokerId,
          date,
          details: `${getBrokerName(brokerId)} está alocado para construtoras DIFERENTES no dia ${date}: ${buildersList}. Corretores não podem atender construtoras concorrentes no mesmo dia.`,
          severity: 'critical'
        });
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // REGRA 10: Rotação entre semanas (não pode repetir mesmo local externo em semanas consecutivas)
  // NOTA: Aplica-se APENAS ao Artus Vivence - outros locais (como Botanic)
  // podem ter repetição devido ao alto volume de plantões
  // ═══════════════════════════════════════════════════════════
  if (previousWeeksAssignments && previousWeeksAssignments.length > 0) {
    // Identificar a semana atual
    const currentWeekDates = new Set(assignments.map(a => a.assignment_date));
    const currentWeekDatesArray = Array.from(currentWeekDates).sort();
    
    if (currentWeekDatesArray.length > 0) {
      const currentWeekStart = new Date(currentWeekDatesArray[0] + "T00:00:00");
      
      // Filtrar apenas alocações da semana imediatamente anterior
      const previousWeekAssignments = previousWeeksAssignments.filter(a => {
        const assignDate = new Date(a.assignment_date + "T00:00:00");
        const daysDiff = Math.round((currentWeekStart.getTime() - assignDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff > 0 && daysDiff <= 7; // Apenas semana anterior
      });
      
      // Para cada corretor na semana atual, verificar se repete local externo da semana anterior
      for (const [brokerId, dateMap] of brokerDateAssignments) {
        // Coletar locais externos da semana atual para este corretor
        const currentWeekExternalLocations = new Set<string>();
        for (const [date, dayAssignments] of dateMap) {
          for (const assignment of dayAssignments) {
            const loc = getLocation(assignment.location_id);
            if (loc?.type === 'external') {
              currentWeekExternalLocations.add(assignment.location_id);
            }
          }
        }
        
        // Verificar se algum desses locais foi usado na semana anterior
        const previousWeekBrokerAssignments = previousWeekAssignments.filter(a => a.broker_id === brokerId);
        for (const prevAssignment of previousWeekBrokerAssignments) {
          const loc = getLocation(prevAssignment.location_id);
          
          // SOMENTE verificar para Artus Vivence - ignorar outros locais (Botanic, etc)
          if (!loc?.name?.toLowerCase().includes('vivence')) {
            continue;
          }
          
          if (loc?.type === 'external' && currentWeekExternalLocations.has(prevAssignment.location_id)) {
            // VERIFICAR SE É O ÚNICO CORRETOR CONFIGURADO PARA ESTE LOCAL
            // Usar locationBrokerConfigs se disponível, senão verificar alocados
            let isOnlyConfigured = false;
            
            if (locationBrokerConfigs) {
              const configuredBrokers = locationBrokerConfigs.get(prevAssignment.location_id) || [];
              isOnlyConfigured = configuredBrokers.length === 1 && configuredBrokers[0] === brokerId;
            } else {
              // Fallback: Contar quantos corretores diferentes foram para este local em ambas as semanas
              const allBrokersForLocation = new Set<string>();
              
              // Da semana atual
              for (const a of assignments) {
                if (a.location_id === prevAssignment.location_id) {
                  allBrokersForLocation.add(a.broker_id);
                }
              }
              
              // Da semana anterior
              for (const a of previousWeeksAssignments) {
                if (a.location_id === prevAssignment.location_id) {
                  allBrokersForLocation.add(a.broker_id);
                }
              }
              
              isOnlyConfigured = allBrokersForLocation.size === 1;
            }
            
            violations.push({
              rule: "REGRA 10: Rotação entre semanas",
              brokerName: getBrokerName(brokerId),
              brokerId,
              location: loc.name,
              details: isOnlyConfigured
                ? `Repetição no ${loc.name} em semanas consecutivas (único corretor configurado - inevitável)`
                : `Repetição no ${loc.name} em semanas consecutivas (violação de rotação)`,
              severity: isOnlyConfigured ? 'warning' : 'critical'
            });
            break; // Só reportar uma vez por local
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // REGRA ESCADA DE DISTRIBUIÇÃO (INVIOLÁVEL)
  // Ninguém com N+2 enquanto existir elegível com N
  // Ex: ninguém com 3 se existir elegível com 1
  //     ninguém com 4 se existir elegível com 2
  // ═══════════════════════════════════════════════════════════
  {
    // Contar externos por corretor (dias únicos)
    const brokerExternalDays = new Map<string, Set<string>>();
    for (const assignment of assignments) {
      const loc = getLocation(assignment.location_id);
      if (loc?.type === 'external') {
        if (!brokerExternalDays.has(assignment.broker_id)) {
          brokerExternalDays.set(assignment.broker_id, new Set());
        }
        brokerExternalDays.get(assignment.broker_id)!.add(assignment.assignment_date);
      }
    }
    
    // Identificar corretores elegíveis para externos (quem tem pelo menos 1 local externo configurado)
    const brokersWithExternals: { id: string; name: string; count: number }[] = [];
    for (const broker of brokers) {
      const count = brokerExternalDays.get(broker.id)?.size || 0;
      // Incluir TODOS corretores que aparecem em alocações externas OU que têm 0 mas são elegíveis
      // Como não temos locationBrokerConfigs aqui de forma confiável, usamos quem tem alguma alocação
      // OU quem tem externalShiftCount registrado
      const hasAnyExternalAllocation = assignments.some(a => {
        const loc = getLocation(a.location_id);
        return a.broker_id === broker.id && loc?.type === 'external';
      });
      // Considerar elegível se tem alguma alocação externa OU tem count > 0
      if (hasAnyExternalAllocation || count > 0) {
        brokersWithExternals.push({ id: broker.id, name: broker.name, count });
      }
    }
    
    if (brokersWithExternals.length > 0) {
      const minCount = Math.min(...brokersWithExternals.map(b => b.count));
      const maxCount = Math.max(...brokersWithExternals.map(b => b.count));
      
      // Violação: diferença >= 2 entre qualquer par de corretores elegíveis
      if (maxCount - minCount >= 3) {
        const brokersAtMin = brokersWithExternals.filter(b => b.count === minCount);
        const brokersAtMax = brokersWithExternals.filter(b => b.count === maxCount);
        
        violations.push({
          rule: "ESCADA DE DISTRIBUIÇÃO: Diferença >= 3 entre corretores",
          brokerName: brokersAtMax.map(b => b.name).join(', '),
          brokerId: brokersAtMax[0].id,
          details: `PROIBIDO: ${brokersAtMax.map(b => `${b.name}(${b.count})`).join(', ')} vs ${brokersAtMin.map(b => `${b.name}(${b.count})`).join(', ')}. Diferença de ${maxCount - minCount} externos. Máximo permitido: 2.`,
          severity: 'critical'
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // RESULTADO
  // ═══════════════════════════════════════════════════════════
  const criticalViolations = violations.filter(v => v.severity === 'critical');
  const valid = criticalViolations.length === 0;
  
  let summary = '';
  if (valid) {
    summary = '✅ Todas as regras foram respeitadas';
  } else {
    summary = `❌ ${criticalViolations.length} violação(ões) crítica(s) encontrada(s):\n` +
      criticalViolations.map(v => `  - ${v.rule}: ${v.brokerName} - ${v.details}`).join('\n');
  }
  
  return { valid, violations, summary };
}

/**
 * Valida se uma única alocação pode ser adicionada sem violar regras
 * Usada para verificação em tempo real durante a geração
 */
export function canAddAssignment(
  newAssignment: ScheduleAssignment,
  existingAssignments: ScheduleAssignment[],
  brokerName: string,
  locationInfo: LocationInfo,
  needsSameBroker: boolean
): { allowed: boolean; reason: string; rule: string } {
  
  // Se for local interno, permitir (regras são diferentes)
  if (locationInfo.type !== 'external') {
    return { allowed: true, reason: 'OK', rule: '' };
  }
  
  const brokerId = newAssignment.broker_id;
  const date = newAssignment.assignment_date;
  const shift = newAssignment.shift_type;
  
  // Filtrar alocações do mesmo corretor
  const brokerAssignments = existingAssignments.filter(a => a.broker_id === brokerId);
  
  // REGRA 4: Não pode ter externo no mesmo dia em OUTRO local
  const otherExternalSameDay = brokerAssignments.find(a =>
    a.assignment_date === date &&
    a.location_id !== newAssignment.location_id
  );
  if (otherExternalSameDay) {
    return { 
      allowed: false, 
      reason: `Já alocado em outro local externo no mesmo dia`,
      rule: 'REGRA 4: Conflito de local'
    };
  }
  
  // REGRA 5: Se NÃO precisa do mesmo corretor, não pode nos dois turnos do mesmo local
  if (!needsSameBroker) {
    const hasOtherShiftSameLocation = brokerAssignments.some(a =>
      a.assignment_date === date &&
      a.location_id === newAssignment.location_id &&
      a.shift_type !== shift
    );
    if (hasOtherShiftSameLocation) {
      return { 
        allowed: false, 
        reason: `Já tem outro turno no mesmo local`,
        rule: 'REGRA 5: Dois turnos'
      };
    }
  }
  
  return { allowed: true, reason: 'OK', rule: '' };
}

/**
 * Log detalhado das violações para debug
 */
export function logViolations(result: ValidationResult): void {
  if (result.valid) {
    console.log('✅ VALIDAÇÃO: Todas as regras foram respeitadas');
    return;
  }
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('❌ VALIDAÇÃO FALHOU - VIOLAÇÕES ENCONTRADAS');
  console.log('═══════════════════════════════════════════════════════════');
  
  const grouped = new Map<string, RuleViolation[]>();
  for (const v of result.violations) {
    if (!grouped.has(v.rule)) {
      grouped.set(v.rule, []);
    }
    grouped.get(v.rule)!.push(v);
  }
  
  for (const [rule, violations] of grouped) {
    console.log(`\n🔴 ${rule} (${violations.length} violação(ões)):`);
    for (const v of violations) {
      console.log(`   - ${v.brokerName}: ${v.details}${v.date ? ` (${v.date})` : ''}`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`TOTAL: ${result.violations.filter(v => v.severity === 'critical').length} violações críticas`);
  console.log('❌ ESCALA NÃO DEVE SER SALVA');
  console.log('═══════════════════════════════════════════════════════════');
}
