# Licenciamento ConstructCount (M2PB)

Validação de licença **via web** (servidor da M2PB na Hostinger). Modelo escolhido:
**assinatura com vencimento · bloqueio total · carência offline · limite de dispositivos.**

## Arquitetura (resumo)
- A IA (Claude) já passa pelo servidor (`api/extract.php`) → o **gate de licença fica lá** (inquebrável).
- O **app** (desktop e web) pede a chave e revalida online; guarda um **token assinado** p/ abrir offline na carência.
- Segredo HMAC e credenciais do banco ficam em `api/license-config.php` (fora do Git).

## Passos para ativar (uma vez)

1. **Banco** (hPanel → Bancos de Dados MySQL): crie um banco + usuário. No **phpMyAdmin → SQL**, cole `api/license/schema.sql`.
2. **Config**: copie `api/license-config.example.php` → `api/license-config.php` e preencha:
   - dados do banco; `LIC_SECRET` (gere: `php -r "echo bin2hex(random_bytes(32));"`);
   - `LIC_GRACE_DAYS` (ex.: 7); `LIC_ADMIN_PASS` (senha do painel).
3. **Suba os arquivos** para `public_html/api/...` (extract.php, license/, license-config.php).
   - Confirme que o domínio é **HTTPS** (a validação trafega a chave).
4. **Emita chaves**: acesse `https://SEU-DOMINIO/api/license/admin.php` → entre com `LIC_ADMIN_PASS` →
   crie licenças (cliente, plano, **vencimento** `AAAA-MM-DD HH:MM:SS`, **nº de dispositivos**).
5. **Ligue o bloqueio** (o app só abre se validado via web):
   - **Desktop** (interruptor mestre): `desktop/license_client.py` → `REQUIRED = True`
     (ou variável de ambiente `FENESTRA_LICENSE_REQUIRED=1`). Isso bloqueia o motor inteiro no Python
     (`app.py`, decorator `@_gated` nos portões: abrir/criar/listar/ver projeto) **e** o front lê
     `api.license_required()` p/ mostrar a tela de ativação. Domínio: `FENESTRA_LICENSE_URL` (padrão `https://m2pb.com`).
   - **Web**: em `fenestra-quote-ai/js/license.js` troque `var LICENSING = false` → `true` e suba o `?v`.
   - Bloqueio em DUAS camadas: front (overlay) + Python (gate). A IA (`extract.php`) já recusa sem licença.
6. **Reconstrua o .exe** (`desktop/build.bat`) p/ embutir `license_client` (já está no `Fenestra.spec`).

## Como funciona no uso
- 1ª vez: o app mostra a **tela de ativação** (bloqueio total). O cliente cola a chave → valida no servidor →
  guarda o token → libera.
- A cada abertura/6h revalida online. **Offline**: abre dentro da **carência** (ex.: 7 dias); depois pede reconexão.
- Vencida/cancelada/suspensa (no admin) → bloqueia (e a IA recusa no servidor de imediato).
- **Limite de dispositivos**: cada chave vale p/ N máquinas. Trocar de PC além do limite → "Liberar disp." no admin.

## Páginas / Endpoints
- **`api/license/portal.php`** — página PÚBLICA "Minha Licença": o cliente cola a chave e vê a **aprovação**
  (status / plano / vencimento / dispositivos). Só consulta (não consome dispositivo). Link disso no site da M2PB.
- `api/license/admin.php` — painel da M2PB (senha) p/ emitir/renovar/revogar chaves.
- `POST api/license/validate.php` — `{key, device, device_label}` → `{valid, plan, expires_at, grace_days, token, reason}` (usado pelo app).
- `api/extract.php` — exige `license_key` + `device` no corpo **se** `license-config.php` existir.

## Segurança / limites
- Enforcement REAL = servidor (gate na IA). O bloqueio do app é dissuasão (motor local em Python é decompilável).
- Token offline pode ser “replayado” até o fim da carência (por isso carência curta). Vencimento real = servidor.
- Sempre por HTTPS. `license-config.php` e `config.php` NUNCA vão pro Git.
