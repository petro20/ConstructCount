# ConstructCount

Aplicação para **extração de esquadrias** (janelas/portas) a partir de plantas em PDF usando
**IA de visão (Claude API)**, com edição manual, desenho técnico automático (SVG), cálculo de
custos e geração de **orçamento** (cliente) e **pedido** (fornecedor).

> 🤖 **Extração real por IA:** ao enviar o PDF, o backend (`api/extract.php`) manda a planta para
> a Claude API, que lê o quadro de esquadrias e devolve tipo, dimensões e quantidade reais.
> **Sem a chave configurada** (ou aberto sem PHP), o app usa dados de exemplo automaticamente —
> nunca quebra. Veja **🤖 Configurar a extração por IA** abaixo.

## 📁 Estrutura de pastas

```
fenestra-quote-ai/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── main.js          # orquestra a UI (upload → API, tabela, editor, eventos)
│   ├── svg-engine.js    # gera o desenho técnico (SVG)
│   ├── calculator.js    # estado global + motor de cálculo (áreas/custos/conversão) + marcas
│   ├── export.js        # exportação PDF (cliente), Excel (fornecedor) e Quadro Resumo
│   ├── plan-marker.js   # sobrepõe marcas + quadro resumo no PDF da planta (pdf-lib)
│   └── import-takeoff.js# importa o takeoff pronto do agente (.xlsx / schedule_data.json)
├── api/
│   ├── extract.php          # backend: PDF → Claude API → JSON de esquadrias
│   ├── config.example.php   # modelo de config (copie p/ config.php e ponha a chave)
│   └── .user.ini            # limites de upload (Hostinger)
├── assets/
│   └── logo-placeholder.svg
└── README.md
```

> A ordem de carregamento dos scripts importa: `calculator.js` → `svg-engine.js` → `export.js` → `main.js`
> (definida no final do `index.html`). Tudo compartilha o namespace global `window.Fenestra`.

## ✨ Funcionalidades

| # | Recurso | Onde |
|---|---------|------|
| 1 | Upload de PDF (input + drag&drop) → **extração real por IA** (Claude API) com fallback p/ exemplo | `main.js` + `api/extract.php` |
| 2 | Dados do projeto (nome, cliente, e-mail, telefone → entram no PDF) | `main.js` |
| 3 | Tabela extraída + **editor completo**: ID e tipo editáveis, medidas, qtd | `main.js` |
| 4 | **Adicionar / remover** itens (ID auto-gerado) | `main.js` + `calculator.js` |
| 5 | Conversão **m² ⇄ ft²** | `calculator.js` |
| 6 | Desenho SVG por tipo (casement, 2 folhas, correr, basculante, fixa, porta, porta de correr) + **seletor de item** | `svg-engine.js` |
| 7 | Módulo de custos (fornecedor, frete %, margem %) | `calculator.js` |
| 8 | Exportação: **PDF** cliente (com preços) / **Excel .xlsx** fornecedor (sem preços) | `export.js` |

Itens e dados do projeto são salvos em `localStorage` (chave `fenestra.project.v1`).

> **Tipos de esquadria** no editor: Casement, Double Casement, Sliding, Awning, Fixed (janelas),
> Single Door e Sliding Door (portas) e **Storefront** (fachada envidraçada). Cada um tem desenho SVG próprio.

> **Escopo da extração = FACHADA.** A IA captura janelas, **portas da fachada** e **store fronts**;
> classifica cada item (`facade`/`interior`) e o **backend descarta as portas internas** — então
> mesmo que o modelo erre, porta interna não entra. Janelas e storefronts são sempre mantidos.

> **CDNs usados:** Tailwind, jsPDF + autoTable (PDF) e SheetJS (xlsx). Precisam de internet no cliente.
> O sufixo `?v=3` nos assets força o navegador a buscar a versão nova após cada deploy (cache-busting) —
> incremente o número ao publicar mudanças.

## 📥 Importar takeoff pronto (do agente)

Além da extração por IA, a Fenestra **importa o takeoff já produzido pelo agente** de levantamento
(o caminho recomendado para projetos grandes/reais). No card de upload → **Importar Takeoff (Excel / JSON)**:

- **.xlsx** — lê a aba `WINDOW TAKEOFF` (ou `SUMMARY`): Type Mark, Width/Height (imperial), Qty,
  Operation, Glazing, Notes. Converte as medidas para mm e mapeia a operação para o tipo de desenho.
- **schedule_data.json** — estrutura canônica do agente (`marks`, `categories`, `supplements`).

A partir daí a Fenestra gera **preço, Orçamento Cliente, Pedido Fornecedor, Quadro Resumo e Planta Marcada**
— sem reprocessar a planta. (Validado com o `36_Bruckner_Window_Takeoff_Summary.xlsx`: 16 tipos, 265 unidades.)

## 🤖 Configurar a extração por IA

A extração real precisa de **PHP** (a Hostinger já tem) e de uma **chave da Anthropic**:

1. Crie a chave em <https://console.anthropic.com/> → **API Keys**.
2. Copie `api/config.example.php` para **`api/config.php`** e cole sua chave:
   ```php
   define('ANTHROPIC_API_KEY', 'sk-ant-...sua-chave...');
   define('FENESTRA_MODEL', 'claude-opus-4-8'); // ou 'claude-sonnet-4-6' (mais barato)
   ```
3. `api/config.php` **nunca** é versionado (está no `.gitignore`) — a chave fica só no servidor.

**Como funciona:** `js/main.js` lê o PDF, envia em base64 para `api/extract.php`, que chama a
Claude API (modelo de visão) com **saída estruturada** (JSON Schema). A IA lê o quadro de
esquadrias e devolve `id`, `type` (mapeado p/ um dos 7 tipos), largura/altura em mm, quantidade,
vidro, cor e observações. Se a chamada falhar (sem chave, sem PHP, PDF ilegível), o app cai
nos dados de exemplo com um aviso.

> 💰 **Custo:** cada análise gasta tokens da sua conta Anthropic (PDFs com muitas páginas custam
> mais). Opus 4.8 é o mais preciso; para reduzir custo, troque `FENESTRA_MODEL` por `claude-sonnet-4-6`.

> 🔐 A chave fica **só no backend**. Nunca coloque a chave da Anthropic no JavaScript/HTML — ela
> ficaria visível para qualquer visitante.

## ▶️ Testar localmente

A interface é estática, mas a extração por IA precisa de PHP. Duas formas:

```powershell
# 1) COM extração por IA (precisa de PHP + api/config.php configurado)
php -S localhost:8000
# abra http://localhost:8000  → o PHP serve o HTML e o backend juntos

# 2) Só a interface (sem IA — usa dados de exemplo)
python -m http.server 5500
# abra http://localhost:5500
```
Sem PHP, ou sem `config.php`, o upload simplesmente carrega o exemplo (com aviso). Para a
extração real funcionar localmente, use a opção **(1)**.

---

## 🚀 Publicação

### Passo 1 — Versionar com Git / GitHub Desktop

1. Abra o **GitHub Desktop**.
2. `File → New Repository`
3. **Name:** `fenestra-quote-ai`
4. **Local path:** `C:\Users\<SEU_USUARIO>\Documents\GitHub\`
5. **Create repository**.
6. Copie **o conteúdo desta pasta** (`index.html`, `css/`, `js/`, `assets/`, `README.md`)
   para `...\Documents\GitHub\fenestra-quote-ai\`.
7. No GitHub Desktop:
   - **Summary (commit):** `MVP ConstructCount - extração IA simulada + SVG + exportação dupla`
   - **Commit to main**
   - **Publish repository / Push origin**

> Alternativa via terminal (dentro da pasta):
> ```powershell
> git init
> git add .
> git commit -m "MVP ConstructCount - extração IA simulada + SVG + exportação dupla"
> git branch -M main
> git remote add origin https://github.com/<SEU_USUARIO>/fenestra-quote-ai.git
> git push -u origin main
> ```

### Passo 2 — Hospedar na Hostinger

1. Acesse o **hPanel** da Hostinger.
2. **Files → File Manager**.
3. Dentro de `public_html/`, crie a pasta `fenestra-quote-ai/`.
4. Faça **upload de todos os arquivos** mantendo a estrutura de pastas
   (`index.html`, `css/`, `js/`, `assets/`, **`api/`**). Dica: suba um `.zip` e use "Extract".
5. **Crie a chave no servidor** (não vai no zip, por segurança): no File Manager, dentro de
   `api/`, copie `config.example.php` para **`config.php`** e edite com sua chave da Anthropic.
6. Acesse: `https://seudominio.com/fenestra-quote-ai/`

> A Hostinger **tem PHP**, então a extração por IA funciona direto. Para servir na **raiz** do
> domínio, envie os arquivos direto em `public_html/`.
> Confirme que o plano roda PHP 8+ (`api/extract.php` usa cURL, já habilitado por padrão).

### Atualizações futuras
Edite os arquivos → commit/push no GitHub Desktop → reenvie os alterados pelo File Manager
(o `api/config.php` permanece no servidor; não precisa reenviar). Lembre de **incrementar o
`?v=` dos assets** no `index.html` a cada deploy para furar o cache do navegador.

## 🧮 Fórmulas

- Área unitária (m²) = `largura(mm) × altura(mm) × 0.000001`
- ft² = `m² × 10.7639`
- Custo base = `custo_m² × área_total(m²)`  ← **preço por m²**
- Custo total = `custo_base × (1 + frete%)`
- Preço cliente = `custo_total × (1 + margem%)`
- Lucro = `preço_cliente − custo_total`

> Conversão de cotas na extração: pés→mm (`× 304,8`), polegadas→mm (`× 25,4`), m→mm (`× 1000`).

## 🔌 Próximos passos (produção)
- Persistência real (banco) + autenticação de usuários.
- Catálogo de preços por fornecedor.
- Cache/limite de uso da API por usuário (controle de custo).
- Para PDFs muito grandes: usar a Files API da Anthropic em vez de base64 inline.
- Revisão humana assistida: destacar itens de baixa confiança da extração.
