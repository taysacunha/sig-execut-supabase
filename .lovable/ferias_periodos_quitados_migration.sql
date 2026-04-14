-- Create table for manual period settlements (legacy periods before system launch)
create table public.ferias_periodos_quitados (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.ferias_colaboradores(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date not null,
  dias_quitados integer not null default 30,
  observacoes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique (colaborador_id, periodo_inicio)
);

alter table public.ferias_periodos_quitados enable row level security;

create policy "Ferias users can view quitacoes"
  on public.ferias_periodos_quitados for select to authenticated
  using (can_view_system(auth.uid(), 'ferias'::text));

create policy "Ferias editors can insert quitacoes"
  on public.ferias_periodos_quitados for insert to authenticated
  with check (can_edit_system(auth.uid(), 'ferias'::text));

create policy "Ferias editors can update quitacoes"
  on public.ferias_periodos_quitados for update to authenticated
  using (can_edit_system(auth.uid(), 'ferias'::text));

create policy "Ferias editors can delete quitacoes"
  on public.ferias_periodos_quitados for delete to authenticated
  using (can_edit_system(auth.uid(), 'ferias'::text));
