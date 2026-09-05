# Roadmap

- [x] Auditar a diferença real entre `dev_tracker` e `dev_tracker_log`.
- [x] Reconciliar o histórico sem perder horas do consolidado.
- [x] Usar `dev_tracker_log` como fonte única nas visões por sistema e cronológica.
- [x] Unificar totais e PDFs e validar a página `/dev`.
- [x] Diagnosticar as 58 atividades zeradas (teto artificial de 1.195h na importação).
- [ ] Executar `db/migrations/20260905120000_dev_tracker_log_fix_final.sql` no SQL Editor do Supabase (total esperado: 1.686h).
- [x] Remover da tela a comparação fixa com o acervo legado.
- [x] Bloquear lançamentos com horas zeradas ou negativas.
- [x] Alertar na tela sobre atividades zeradas e títulos duplicados.
- [x] Marcar como inválidos os scripts antigos de importação/reconciliação.
- [x] Documentar a regra de registro imediato de novas funcionalidades/correções no histórico.
