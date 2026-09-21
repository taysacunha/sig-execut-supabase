DO $$
DECLARE
  usuario uuid;
  total_veiculos integer;
  total_motoristas integer;
  total_proprietarios integer;
  total_centros integer;
BEGIN
  FOREACH usuario IN ARRAY ARRAY[
    'eb1d4601-d9a1-4bbb-9af3-d8a4e3027a76'::uuid,
    '11ab4056-0346-492e-9d45-6da0a5291f9b'::uuid
  ] LOOP
    PERFORM set_config('request.jwt.claim.sub', usuario::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    SELECT count(*), count(motorista_nome), count(proprietario_nome), count(centro_custo_nome)
      INTO total_veiculos, total_motoristas, total_proprietarios, total_centros
    FROM public.despesas_veiculos_lookup();

    IF total_veiculos = 0 THEN
      RAISE EXCEPTION 'Usuário % não recebeu veículos na validação', usuario;
    END IF;
    IF total_motoristas = 0 THEN
      RAISE EXCEPTION 'Usuário % não recebeu nenhum nome de motorista', usuario;
    END IF;
    IF total_proprietarios = 0 THEN
      RAISE EXCEPTION 'Usuário % não recebeu nenhum nome de proprietário', usuario;
    END IF;
    IF total_centros = 0 THEN
      RAISE EXCEPTION 'Usuário % não recebeu nenhum nome de centro de custo', usuario;
    END IF;
  END LOOP;
END;
$$;