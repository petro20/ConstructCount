# Portal ConstructCount (M2PB)

Portal de licenças com **contas de cliente**, **Dite Gateway** (pay.diteads.com — assinatura recorrente,
ativa/renova por webhook), **PT/EN/ES**. PHP + MySQL, sem Composer (REST/cURL). Deploy no `public_html`.

**Pagamento (Dite):** `lib/dite.php` cria a assinatura (`POST /api/v1/subscriptions`, header `X-Api-Key`) e
redireciona pro `checkout_url`; `webhooks/dite.php` recebe os eventos (assinados por HMAC em `X-Dite-Signature`)
e libera/estende/revoga a licença pelo `external_reference` (`user_<id>`). Config: `DITE_BASE_URL`,
`DITE_API_KEY`, `DITE_WEBHOOK_SECRET`, `DITE_PLANS`. No painel Apps do Dite: `webhook_url = https://constructcount.com/webhooks/dite`.

## Estrutura
```
portal/
  index.php          landing + planos + "consultar licença"
  register/login/logout.php
  dashboard.php      minhas licenças (copiar chave, status, vencimento)
  checkout.php       inicia o Stripe Checkout (assinatura)
  billing.php        portal de cobrança do Stripe (cliente gerencia/cancela)
  success/cancel.php retorno do checkout
  webhook.php        recebe eventos do Stripe → cria/renova/cancela a licença
  api/validate.php   o APP valida aqui (key+device → token)
  admin/index.php    M2PB: emitir/revogar manual (ADMIN_EMAILS)
  lib/               db, util, i18n, auth, license, stripe, layout
  assets/            style.css, logo.png, favicon.ico
  schema.sql, config.example.php
```

## Deploy (uma vez)
1. **Domínio**: aponte o domínio novo p/ a Hostinger; ative **SSL (HTTPS)**.
2. **Banco**: crie um MySQL; rode `schema.sql` no phpMyAdmin.
3. **Config**: copie `config.example.php` → `config.php` e preencha:
   - `PORTAL_URL` (https do domínio), banco, `APP_SECRET`, `LIC_SECRET`, `LIC_GRACE_DAYS`;
   - **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICES` (price_id de cada plano), `ADMIN_EMAILS`.
4. **Suba** a pasta `portal/` p/ o `public_html/` do domínio (o conteúdo, não a pasta).
5. **Assets**: copie um `logo.png` e `favicon.ico` p/ `assets/` (pode reusar os do app).
6. **Stripe**:
   - crie os **Produtos/Preços** (mensal/anual) e cole os `price_id` em `STRIPE_PRICES`;
   - em Developers → **Webhooks**, adicione o endpoint `https://SEU-DOMINIO/webhook.php` e cole o
     *Signing secret* em `STRIPE_WEBHOOK_SECRET`. Eventos: `checkout.session.completed`, `invoice.paid`,
     `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.
7. **Admin**: faça login com um e-mail de `ADMIN_EMAILS` e acesse `/admin/`.

## Ligar o bloqueio no APP (depois do portal no ar)
- **Desktop**: `desktop/license_client.py` → `REQUIRED=True` e `FENESTRA_LICENSE_URL=https://SEU-DOMINIO`
  (ou env `FENESTRA_LICENSE_REQUIRED=1` / `FENESTRA_LICENSE_URL=...`). Reconstrua o `.exe`.
- **Web do app**: `js/license.js` → `LICENSING=true` e `PORTAL='https://SEU-DOMINIO'`.
- **IA (extract.php do app)**: em `api/config.php` defina
  `FENESTRA_LICENSE_VALIDATE_URL = 'https://SEU-DOMINIO/api/validate.php'`.

## Fluxo
1. Cliente cria conta → **Assinar** → Stripe Checkout → paga.
2. Stripe chama `webhook.php` → cria/renova a licença (vencimento = fim do período).
3. Cliente vê a chave no **dashboard** → cola no app → `api/validate.php` aprova → app abre.
4. A IA do app revalida a cada uso; renovação/cancelamento refletem automático via webhook.

## Segurança
- Enforcement real = servidor (validação online + gate da IA). App é dissuasão (motor local decompilável).
- `config.php` nunca vai pro Git. HTTPS obrigatório. Webhook verifica assinatura (`Stripe-Signature`).
