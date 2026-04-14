

## Correção das vulnerabilidades do jsPDF

### Problema
O projeto usa `jspdf@^3.0.4` que tem múltiplas vulnerabilidades conhecidas (path traversal, PDF injection, DoS, XSS). A versão 4.1.0 corrige todas elas.

### Solução
Atualizar `jspdf` de `^3.0.4` para `^4.1.0` no `package.json`. A v4.0.0 corrigiu o path traversal crítico e a v4.1.0 corrigiu todas as demais (AcroForm injection, BMP DoS, XMP metadata injection, race condition). O changelog oficial confirma que **não há breaking changes** além da restrição de acesso ao filesystem no Node.js (que não afeta este projeto, pois usa jsPDF apenas no browser).

### Arquivo modificado
- `package.json` — alterar `"jspdf": "^3.0.4"` para `"jspdf": "^4.1.0"`

### Após a atualização
Marcar as findings de segurança como resolvidas no scanner.

