-- Adicionar "-F" em CRECIs que não possuem o sufixo
UPDATE brokers 
SET creci = CONCAT(creci, '-F')
WHERE creci NOT LIKE '%-F';