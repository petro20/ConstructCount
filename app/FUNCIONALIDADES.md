# ConstructCount — Funcionalidades & Changelog

> Este arquivo é atualizado a cada novidade do app. Versão dos assets: **v101**.

## Marca & licença (M2PB)
- **Logo + favicon**: `assets/logo.png` (1024×1024) no header (ao lado do título) e como favicon da aba/app
  (`favicon.ico`, `favicon-16/32.png`, `apple-touch-icon.png` gerados por `assets/make_favicon.py` via Pillow).
- App **propriedade da M2PB**: badge "M2PB" no header e crédito no rodapé (© 2026 · Todos os direitos
  reservados · Desenvolvido por M2PB), ambos linkando para https://m2pb.com.
- **Aviso de licença proprietária**: arquivo `LICENSE` (PT+EN) + tela "Licença" (aba Ajuda 🔒 e link no
  rodapé) — afirma que a comercialização, incluindo **venda de assinaturas**, é direito EXCLUSIVO da M2PB.
  (Validação técnica por servidor da M2PB fica para uma etapa futura.)

## Desenho técnico (pré-visualização)
- Visual **mais realista**: moldura metálica e vidro com **gradientes**, **sombra** suave e **brilho** diagonal.
- **Maçaneta tipo alavanca** (de pegar), não de bola.
- Cotas mostram **mm e imperial** (usa a medida original; se faltar, converte de mm).

## Layout & cards
- **Layout em 1 coluna** (cards empilhados, centralizado `max-w-4xl`).
- **Todos os cards são recolhíveis** (chevron no cabeçalho, clique no título também recolhe) com visual
  renovado (numerador em gradiente, sombra no hover, animação suave). Estado lembrado por card. `js/cards.js`.

## Novo projeto — converter → apagar folhas → Reconhecer
- Botão **Novo projeto** (era "Abrir projeto"): escolhe o PDF e **converte todas as folhas em PNG** (render em
  DPI de exibição, **em paralelo nos vários núcleos** → ~3× mais rápido, ex. 21 folhas em ~4s) e abre o workspace.
- Você **apaga** (🗑) as folhas que não interessam no painel **Páginas**.
- **Seleção estilo Excel** na lista de Páginas: **clique simples** = só **abre** a folha (não seleciona/não apaga);
  **Ctrl+clique** = adiciona/remove folhas avulsas; **Shift+clique** = seleciona o **intervalo** desde a última
  âncora (respeita a ordem exibida); ou marque pelo ☐ da linha. As selecionadas ficam **azuis (☑, borda)** —
  seleção **neutra**, nada é apagado por selecionar. A seleção é a base das ações: **🗑 Apagar (N)** (só apaga
  ao clicar) **ou 🔎 Reconhecer** (se há selecionadas, reconhece só elas; sem seleção, reconhece todas).
- Os **códigos das folhas** (T-100, A-100…) aparecem na lista de Páginas: lidos do carimbo **em 2º plano**
  logo após converter (sem re-renderizar — usa os PNGs), preenchendo a lista ao vivo.
- Botão **🔎 Reconhecer** (na barra do painel Páginas): pergunta o **escopo** e roda a detecção (220 DPI)
  nas folhas **selecionadas** (ou em todas). **Em PARALELO nos vários núcleos** (detect_worker via
  multiprocessing) — selecionar várias folhas e reconhecer todas de uma vez fica bem mais rápido (não é
  mais uma folha de cada vez). **Respeita o escopo**: classifica cada marca pelo TIPO (do schedule) e deixa
  as fora do escopo **cinza (não contam)**; tipo desconhecido permanece. Para filtrar por Fachada/Interior é
  preciso ter a **folha do schedule marcada (📐)** — o Reconhecer lê o schedule automaticamente se ainda não foi lido.
- Ao criar, pergunta o **nome do projeto** (pré-preenchido com o do arquivo, editável) — esse vira o nome de
  exibição; a pasta no disco continua pelo nome do PDF. Renomeável depois (`set_job_name`).
- **Schedule só nas folhas marcadas** (não varre o PDF todo). Sem marcar nenhuma → não lê schedule no preparo
  (use "Reler medidas" depois). Ganho grande de tempo em PDFs com muitas folhas vazias.

## Escopo do levantamento (modo de reconhecimento do projeto)
- É uma **propriedade do projeto** (não um filtro de última hora): ao **abrir/preparar um projeto novo** o app
  pergunta o escopo — **Tudo · Fachada (parede externa) · Portas interiores** — e **grava no projeto**.
- No topo do workspace há um chip 🧭 **Escopo: …** que mostra/permite mudar (persiste).
- O escopo é o **modo de reconhecimento**: marca fora do escopo fica **não-confirmada (cinza)** e não conta.
  O **Consolidar soma as marcas CONFIRMADAS** (não refiltra por escopo) — assim a tabela reflete exatamente o
  que está confirmado no desenho (o que você edita/confirma aparece). Para tirar uma marca da conta, deixe-a
  rejeitada (cinza) ou reconheça no escopo certo.
- Classificação **por tipo, conforme o projeto** (não chuta): Fachada = janelas + storefront + portas
  Entry/Storefront/Patio/Garagem; Interior = demais portas (abrir, embutida, sanfonada, armário, celeiro…).
- Para portas saírem classificadas: marcar a folha do door schedule (📐) → **Reler medidas**. Tudo editável.

## Licenciamento (validação via web — M2PB)
- Modelo: **assinatura com vencimento**, **bloqueio total**, **carência offline**, **limite de dispositivos**.
- A IA (Claude) passa pelo servidor → o **gate de licença fica no `api/extract.php`** (inquebrável). O app pede a
  chave, valida online e guarda um **token assinado** p/ abrir offline na carência.
- Servidor (PHP+MySQL, Hostinger): `api/license/` (`schema.sql`, `_lib.php`, `validate.php`, `admin.php`) +
  `api/license-config.php` (gitignored). Painel **admin** p/ emitir/renovar/revogar chaves.
- Cliente: desktop `license_client.py` (id = MachineGuid; guarda em `%LOCALAPPDATA%\Fenestra`) + `js/license.js`
  (tela de ativação/bloqueio; web e desktop). **Interruptor `LICENSING=false`** em license.js — ligar só quando o
  servidor estiver no ar. Passo a passo em `api/license/README.md`.

## Distribuição (.exe) & atualização
- **Empacotamento**: PyInstaller (onedir) via `desktop/Fenestra.spec` + `desktop/build.bat` → `desktop/dist/Fenestra/Fenestra.exe`
  (ícone = logo). `app.py` é "frozen-aware" (acha UI/motor via `sys._MEIPASS`); no .exe os projetos vão p/
  `%LOCALAPPDATA%\Fenestra\Jobs`. Requer **WebView2 Runtime** na máquina (já vem no Win 10/11).
- **Estratégia de updates** (a definir hospedagem): separar **interface web** (muda muito, ~0,6 MB → atualização
  "quente" baixada de um servidor na abertura) do **motor/.exe** (muda pouco, pesado → "aviso + download manual"
  quando a versão do motor subir). 99% das mudanças (UI/documentos/i18n) não exigem redistribuir o .exe.

## Idiomas (EN / PT / ES)
- App **trilíngue**: seletor PT/EN/ES no header (canto direito). Idioma **detectado do sistema** na 1ª vez
  (fallback inglês), persistido em `localStorage`.
- `js/i18n.js`: o texto em PT é a própria chave. Percorre o DOM e troca texto/placeholder/title/data-tip pelo
  dicionário `pt → {en, es}`; um **MutationObserver** retraduz conteúdo inserido dinamicamente. Para código:
  `Fenestra.tr('texto PT', vars?, idioma?)`.
- **Documentos com idioma escolhido na exportação**: ao gerar Orçamento, Pedido, Quadro Resumo ou Proposta,
  abre um seletor (`Fenestra.pickDocLang`) — o documento sai em PT, EN ou ES (datas e números no locale certo),
  independente do idioma da tela.
- **Mensagens dinâmicas traduzidas**: status, alertas, confirmações e contagens montados em código
  (desktop.js/menu.js/main.js/workspace.js/annotator.js/plan-marker.js) usam `Fenestra.tr('...{var}', {var})`
  com ~150 chaves no dicionário — workspace, importação, conferência, seções, medidas, Auto Count etc.
- **Nome dos arquivos exportados segue o idioma**: orcamento-cliente/client-quote/presupuesto-cliente,
  pedido-fornecedor/supplier-order/pedido-proveedor, quadro-resumo/summary-table/cuadro-resumen,
  proposta-cliente/client-proposal/propuesta-cliente.
- **Quadro Resumo mostra mm E ft** por linha — no PDF **e na tabela da tela** (card 6); usa a medida
  original, se faltar converte de mm.

## Visão geral
App de **levantamento (takeoff) e orçamento de esquadrias** (janelas e portas) a partir de plantas em PDF.
- **Web** (Hostinger + PHP/Claude API) e **Desktop** (pywebview + motor Python local, sem servidor).
- PDF com **texto** → levantamento autônomo. PDF **vetorizado** → CV + revisão humana no workspace.

## Motor de levantamento (Python, `takeoff-engine/`)
- `takeoff.py` / `schedule.py` / `build.py` — conta tags por texto + lê o Window Schedule (PDF com texto).
- `cv_takeoff.py` — detecção por visão (hexágonos = janela) + OCR (RapidOCR) para PDF vetorizado.
- `schedule_vector.py` — lê Window Schedule (A700) + Storefront (A701) por OCR; acha as folhas sozinho.
- `door_schedule.py` — lê **DOOR SCHEDULE descritivo** pelo TEXTO do PDF (exato): tamanho, tipo, material,
  dobradiças, fechadura, soleira, vidro, corta-fogo, por marca. Reconstrói **marca faltante no projeto**
  (quando o hexágono não foi desenhado mas a descrição existe).
- `job.py` — projeto em pasta (`F:\Fenestra Data\Jobs\<projeto>\`): páginas rasterizadas, marcas editáveis,
  schedule, seções, escala, medidas. Reabre sem reprocessar.

## App Desktop — menu RIBBON (faixa estilo PlanSwift)
- Faixa com **abas** (chip Fenestra + Início · Documentos · Exibir · Configurações · Ajuda) e **grupos de
  botões** com ícone (hover animado), painel troca por aba. Estilo em `css/styles.css` (.ribbon/.rb-*).
- **Início**: Abrir projeto (PDF) · Projetos salvos (explorador c/ miniatura, busca, grade/lista) · Importar Takeoff.
- **Documentos**: Orçamento Cliente · Proposta Cliente · Pedido Fornecedor · Planta Marcada · Quadro Resumo.
- **Exibir**: alternar unidade m²/ft² · seletor de idioma PT/EN/ES.
- **Configurações**: motor (DPI, pasta dos Jobs, escopo, tamanho de exibição, folha do A700/A701). **Ajuda**: como funciona.
- Abertura automática do explorador ao iniciar quando há projetos.

## Workspace de takeoff (estilo PlanSwift)
- **Painel esquerdo**: árvore de páginas (nome real da folha lido do carimbo) + marcas da folha (com medidas/tipo do schedule).
- **Centro**: planta com **cursor em cruz de tela cheia**; **pan só no botão direito**.
- **Painel direito**: Ferramentas, Auto Count, Janela selecionada, Medidas, Escala, Folha.
- Painéis **recolhíveis** → viram barra de **ícones** (com tooltip animado no hover). Toolbar de ações no painel Páginas.
- **Ferramentas**: Contar · Auto Count · Apagar · Limpar rejeitadas.
- **Caixa da marca cobre o símbolo todo**: no Auto Count, a caixa é ajustada ao desenho da marca (hexágono/círculo + código) — evita cortar o código (ex.: ler "SF1" em vez de "SF12"). Ajuste conservador: só expande quando o símbolo é claramente maior e de forma simétrica; tags pequenas mantêm o tamanho.
- **Auto Count conta SÓ o que você clicou**: usa uma imagem de **trabalho** (alta reduzida ~6500px, cacheada e pré-aquecida ao abrir a folha) p/ achar rápido; como as tags de **número em círculo (①②③)** são quase idênticas, ele **lê o código de cada candidato (OCR) e mantém só os iguais ao código que você clicou** (ignora os de outro código). Tags de letra (A/B/C) são distintas e saem direto. Mostra "lendo N possíveis…" e depois "+A '7' · ignoradas S de outro código".
- **🏷️ Tabela de Legenda das marcas**: em cada folha com marcas aparece uma tabela **ordenada** com colunas **cor · Marca · Tipo · Qtd** (o Tipo vem do schedule), posicionada **no canto que não cobre as marcações**. No workspace é desenhado no canvas (botão 🏷️ na toolbar liga/desliga) **ancorado ao desenho** (coords da folha): ao dar **pan** ela acompanha a folha e ao dar **zoom** ela escala junto — fica como parte do desenho, não flutua na tela. Posição/tamanho são **por folha** — cada página pode ter a legenda num lugar e tamanho diferentes (padrão: canto superior direito da folha). **Arraste** para mover e use a **alça** (canto inferior direito) para redimensionar; **duplo-clique** reseta a folha atual. Fica salvo por projeto/folha. A coluna Qtd mostra só o número. Também sai **em cada folha da Planta Marcada** exportada (no canto livre). Cores batem com as das marcas.
- **🧠 Painel direito inteligente (sequência lógica + adaptativo)**: os painéis seguem a **ordem do fluxo de trabalho**, numerados no título: **1 Folha · 2 Escala/Medir · 3 Camadas · 4 Ferramentas · 5 Auto Count · 6 Janela Selecionada · 7 Medidas (Schedule)**. **Adaptativo**: abre sozinho o painel do contexto (clicou numa marca → *Janela Selecionada*; ativou Auto Count/Medir/Contar → o painel do modo) e recolhe os concorrentes. **Badges de status** em cada título: folha + nº de marcas, escala *calibrada/não calibrada*, camada ativa, código selecionado e **"N sem medida"** (vermelho). Uma linha de **"próximo passo"** no topo orienta o que falta (ex.: *"⚠ 3 códigos sem medida — abra 7 · Medidas"*).
- **↩️ Restaurar marcas** (toolbar do painel Páginas): o **Reconhecer** salva um backup das marcas da folha antes de sobrescrever; este botão restaura o backup (desfaz o último Reconhecer naquela folha).
- **💾 Proteção dos trabalhos (cliente nunca perde)**: em **Projetos salvos** há um **banner fixo** deixando claro que os projetos ficam salvos **no computador do cliente** (`%LOCALAPPDATA%\ConstructCount`, separado da pasta do app) e que **atualizar/reinstalar NÃO apaga nada** — nem os projetos nem a licença. Dois botões: **📁 Abrir pasta dos projetos** (Explorer) e **💾 Fazer backup (.zip)** (zipa TODOS os projetos numa pasta/pendrive escolhido — backup completo e autossuficiente). O **instalador** reforça: ao desinstalar, mostra a mensagem de que projetos e licença são mantidos; ao atualizar (AppId fixo) instala por cima sem duplicar. O **dashboard** (site) também traz a nota de segurança dos dados na área de download.
- **Ferramenta ATIVA destacada**: ao clicar numa ferramenta de modo (Contar/Auto Count/Calibrar/Medir = verde; Apagar = vermelho), o botão fica destacado (cor forte + anel + negrito + leve pulso) — e o ícone correspondente na barra recolhida também — pra deixar claro qual modo está em funcionamento. Clicar de novo desliga.
- **Seleção**: clique / Ctrl+clique / Shift+clique / **laço** (arrastar p/ esquerda = APAGAR; p/ direita = selecionar).
- **Escala/Medir**: calibrar escala, medir (várias), fração 1/16", Snap (linha do desenho) e Ortho, mover/apagar medidas.
- **Pavimentos×** por folha · **Mais nitidez** (re-render da folha) · **Apagar folhas** (libera disco).
- **Folhas de medidas** marcáveis (📐) + **Reler medidas** (window + storefront + door schedule).
- **Seções de takeoff** (grupos: Janelas, Portas, Storefront, Pav 3…) — marca por seção; consolida por seção.
- **Consolidar → Tabela**: soma por (marca, seção) × pavimentos, funde dimensões e specs.

## Tipos & desenho técnico
- Catálogo **Janela / Porta / Fachada** (~16 portas: Swing, Double, Pre-Hung, Pocket, Bifold, Barn, French,
  Dutch, Patio, Entry, Fire, Flush, Panel, Garage, Storefront Door).
- SVG por tipo + **ferragens** (dobradiça/maçaneta/trinca) + **mão** (lado da dobradiça + abre dentro/fora,
  definida **conforme o projeto**, sem chute).

## Orçamento & documentos
- Preço por m² (custo/m² + frete + margem), seletor de moeda, conversão imperial→mm.
- Exports: Orçamento Cliente (PDF), **Pedido Fornecedor** (Excel), Quadro Resumo (PDF),
  Planta Marcada (PDF), Proposta Cliente (PDF).
- **Documentos lidam com portas E janelas** (documento único, item a item) — capa/título da proposta
  se adapta ao conteúdo (PORTAS / JANELAS / ESQUADRIAS); rótulos PT por tipo.
- **Proposta — tabela Pricing com medida em pés**: coluna "Medida (ft)" além de "Medida (mm)" (usa a
  original do projeto; se faltar, converte de mm com fração 1/16", sem chutar).
- **Proposta — Área por tipo (m² E ft²) + rodapé de total**: coluna "Área (m²/ft²)" mostra as duas
  unidades sempre (área unit × qtd), linha de **Total** (soma de quantidade e área) e resumo abaixo do
  VALOR TOTAL "Quantidade total: N un. · Área total: X m² (Y ft²)".
- **Orçamento Cliente detalhado**: agrupado por seção, com coluna de **especificações conforme o projeto**
  (Material, Vidro, Dobradiças, Fechadura, Soleira, Corta-fogo, Almofadas, Veneziana, Cor, Mão) + medida
  original. Marca **reconstruída/divergente** sinalizada (⚠, em âmbar). Nada é assumido — campo sem dado vira "a definir".
- **Pedido Fornecedor (Excel)** com colunas técnicas dedicadas (Material/Vidro/Cor/Dobradiças/Fechadura/Soleira/Corta-fogo/Mão).
- **🎨 Marca / Relatórios (branding configurável)**: painel em Configurações onde o cliente define **nome da empresa, linha de contato, logo (upload, reduzido automaticamente), cor de destaque e rodapé**. Salvo por máquina (localStorage). Aplicado no **cabeçalho** dos relatórios: **Orçamento Cliente** (faixa na cor da marca + logo + empresa + rodapé em todas as páginas), **Quadro Resumo** (mesmo cabeçalho) e **Pedido Fornecedor** (empresa/contato no topo do Excel). Default = "ConstructCount" + azul `#2c476a`. *(Pendente: aplicar o mesmo branding na Planta Marcada e na Proposta.)*
- **Planta Marcada** = **Quadro Resumo (1ª página, legenda colorida + medidas + qtd)** + folhas com as marcas
  + **SEMPRE as folhas de medidas (schedule)** ao final (régua em ciano + cota ft-in/mm). As cores do quadro
  resumo batem com as das marcas no desenho. **Traduzida** (PT/EN/ES) — idioma escolhido na exportação.

## Histórico resumido
- v22–39: tela de anotação CV, schedule OCR (A700/A701), multiplicador de pavimento.
- v40–52: modo PlanSwift (pasta do projeto + workspace), Auto Count com OCR, escala/medidas, medida por tipo.
- v53–76: explorador de projetos, nome da folha, apagar folhas, multi-seleção + laço, cruz de cursor,
  painéis recolhíveis/ícones, toolbar Páginas, seções de takeoff.
- v77–81: tipos de porta + ferragens + mão da esquadria, DOOR SCHEDULE descritivo por texto.
- v82–85: exports via `saveBytes` (diálogo nativo no desktop), proposta/orçamento porta+janela no mesmo
  documento, Orçamento Cliente detalhado por seção com specs do projeto, Pedido Fornecedor com colunas técnicas,
  Planta Marcada anexa as folhas de medidas (schedule).

## Pagamento + Licenciamento (portal constructcount.com)
- **Pagamento via Dite Gateway** (validado ponta a ponta): Assinar → checkout do Dite/Stripe (USD) → webhook
  cria a licença automática. Pacotes/preços = nossa fonte da verdade (`DITE_PLAN_CATALOG` no config do portal),
  enviados **inline** a cada checkout — sem cadastrar plano no painel nem usar plan_id. Detalhes no `portal/`.
- **Bloqueio por licença LIGADO** (pedido "o app só pode abrir se for validado via web"):
  - **Desktop**: `desktop/license_client.py` `REQUIRED=True` por padrão (valida em `constructcount.com/api/validate.php`;
    device = MachineGuid; carência offline pelo token `grace_exp`/`sub_exp`). `app.py` tem `@_gated` em todos os
    portões do motor → sem licença válida o motor fica bloqueado. Dev sem licença: env
    `CONSTRUCTCOUNT_LICENSE_REQUIRED=0`. **Requer reconstruir o `.exe`** (build.bat) p/ valer.
  - **Web**: `js/license.js` `LICENSING=true` (overlay de ativação + bloqueio total; mesmo endpoint/token). `?v=202`.
  - **IA**: `api/extract.php` exige licença SE `CONSTRUCTCOUNT_LICENSE_VALIDATE_URL` estiver no `api/config.php`
    do servidor (descomentar a linha do `config.example.php`).
