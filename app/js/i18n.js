/* =========================================================================
   i18n.js — internacionalização EN / PT / ES
   Abordagem: o texto em PORTUGUÊS é a própria chave. Este módulo percorre o
   DOM e troca o texto/placeholder/title/data-tip pelo idioma atual, usando o
   dicionário DICT (pt → {en, es}). Um MutationObserver retraduz o conteúdo
   inserido dinamicamente (tabelas, listas, mensagens) sem precisar marcar HTML.
   Para código JS use F.tr('texto em PT', vars?, langOverride?).
   Idioma: detectado do sistema (fallback en), persistido em localStorage.
   ========================================================================= */
'use strict';
window.ConstructCount = window.ConstructCount || {};

(function (F) {
  const LANGS = ['en', 'pt', 'es'];
  const norm = (s) => String(s == null ? '' : s).trim().replace(/\s+/g, ' ');

  /* ----------------------------------------------------------------- dicionário
     Chave = string em PT (normalizada: espaços colapsados). Só o que precisa
     mudar de idioma entra aqui; o que é igual nas 3 línguas é deixado de fora. */
  const DICT = {
    // ---- header ----
    'Extração inteligente de esquadrias · Orçamento & Pedido em segundos': {
      en: 'Smart window & door takeoff · Quote & order in seconds',
      es: 'Extracción inteligente de carpinterías · Presupuesto y pedido en segundos' },

    // ---- ribbon (abas / grupos / botões) ----
    'Início': { en: 'Home', es: 'Inicio' },
    'Documentos': { en: 'Documents', es: 'Documentos' },
    'Importar Takeoff': { en: 'Import Takeoff', es: 'Importar Takeoff' },
    'Exibir': { en: 'View', es: 'Ver' },
    'Configurações': { en: 'Settings', es: 'Configuración' },
    'Ajuda': { en: 'Help', es: 'Ayuda' },
    'Fornecedor': { en: 'Supplier', es: 'Proveedor' },
    'Plantas': { en: 'Plans', es: 'Planos' },
    'Idioma': { en: 'Language', es: 'Idioma' },
    'Sobre': { en: 'About', es: 'Acerca' },
    'Abrir projeto': { en: 'Open project', es: 'Abrir proyecto' },
    'Novo projeto': { en: 'New project', es: 'Nuevo proyecto' },
    '📂 Novo projeto (PDF)': { en: '📂 New project (PDF)', es: '📂 Nuevo proyecto (PDF)' },
    'Convertendo o PDF em imagens…': { en: 'Converting the PDF to images…', es: 'Convirtiendo el PDF a imágenes…' },
    'Nome do projeto (como está no projeto):': {
      en: 'Project name (as in the drawing):', es: 'Nombre del proyecto (como en el plano):' },
    'Reconhecer': { en: 'Recognize', es: 'Reconocer' },
    'Reconhecer marcas nas folhas atuais (detecta só nas que restaram)': {
      en: 'Recognize marks on the current sheets (detects only the remaining ones)',
      es: 'Reconocer marcas en las hojas actuales (detecta sólo las que quedaron)' },
    'Reconhecendo…': { en: 'Recognizing…', es: 'Reconociendo…' },
    'Reconhecer marcas nas {n} folhas atuais? (apague as que não quer antes)': {
      en: 'Recognize marks on the current {n} sheets? (delete the ones you don\'t want first)',
      es: '¿Reconocer marcas en las {n} hojas actuales? (borra antes las que no quieres)' },
    'Falha no reconhecimento': { en: 'Recognition failed', es: 'Fallo en el reconocimiento' },
    'Reconhecimento concluído': { en: 'Recognition done', es: 'Reconocimiento completado' },
    'Nenhuma folha para reconhecer': { en: 'No sheet to recognize', es: 'Ninguna hoja para reconocer' },
    'Unidade m²/ft²': { en: 'Unit m²/ft²', es: 'Unidad m²/ft²' },
    'Motor local': { en: 'Local engine', es: 'Motor local' },
    'Como funciona': { en: 'How it works', es: 'Cómo funciona' },
    'Recolher/expandir': { en: 'Collapse/expand', es: 'Contraer/expandir' },
    'Todos os direitos reservados': { en: 'All rights reserved', es: 'Todos los derechos reservados' },
    'Desenvolvido por': { en: 'Developed by', es: 'Desarrollado por' },
    'Licença': { en: 'License', es: 'Licencia' },
    'Licença & Direitos': { en: 'License & Rights', es: 'Licencia y Derechos' },
    'ConstructCount é um software proprietário da M2PB. © 2026 M2PB — Todos os direitos reservados.': {
      en: 'ConstructCount is proprietary software owned by M2PB. © 2026 M2PB — All rights reserved.',
      es: 'ConstructCount es un software propietario de M2PB. © 2026 M2PB — Todos los derechos reservados.' },
    'A comercialização deste aplicativo — incluindo a venda de assinaturas e licenças de uso — é direito exclusivo da M2PB. Nenhuma outra pessoa física ou jurídica está autorizada a vender, revender, sublicenciar ou distribuir assinaturas ou licenças deste app sem autorização expressa e por escrito da M2PB.': {
      en: 'The commercialization of this application — including the sale of subscriptions and usage licenses — is the exclusive right of M2PB. No other individual or entity is authorized to sell, resell, sublicense or distribute subscriptions or licenses of this app without the express written authorization of M2PB.',
      es: 'La comercialización de esta aplicación — incluida la venta de suscripciones y licencias de uso — es derecho exclusivo de M2PB. Ninguna otra persona física o jurídica está autorizada a vender, revender, sublicenciar o distribuir suscripciones o licencias de esta app sin la autorización expresa y por escrito de M2PB.' },
    'É vedada a cópia, modificação, engenharia reversa ou redistribuição sem permissão. Para adquirir uma assinatura oficial, contate a M2PB.': {
      en: 'Copying, modification, reverse engineering or redistribution without permission is prohibited. To purchase an official subscription, contact M2PB.',
      es: 'Queda prohibida la copia, modificación, ingeniería inversa o redistribución sin permiso. Para adquirir una suscripción oficial, contacte a M2PB.' },

    // ---- barra de menu ----
    'Projeto ▾': { en: 'Project ▾', es: 'Proyecto ▾' },
    '📂 Abrir projeto (PDF)…': { en: '📂 Open project (PDF)…', es: '📂 Abrir proyecto (PDF)…' },
    '🗂️ Projetos salvos…': { en: '🗂️ Saved projects…', es: '🗂️ Proyectos guardados…' },
    'Documentos ▾': { en: 'Documents ▾', es: 'Documentos ▾' },
    '📄 Orçamento Cliente (PDF)…': { en: '📄 Client Quote (PDF)…', es: '📄 Presupuesto Cliente (PDF)…' },
    '📊 Pedido Fornecedor (Excel)…': { en: '📊 Supplier Order (Excel)…', es: '📊 Pedido Proveedor (Excel)…' },
    '🗺️ Planta Marcada (PDF)…': { en: '🗺️ Marked Plan (PDF)…', es: '🗺️ Plano Marcado (PDF)…' },
    '📝 Proposta Cliente (PDF)…': { en: '📝 Client Proposal (PDF)…', es: '📝 Propuesta Cliente (PDF)…' },
    'Configurações ▾': { en: 'Settings ▾', es: 'Configuración ▾' },
    '⚙️ Configurações do motor…': { en: '⚙️ Engine settings…', es: '⚙️ Configuración del motor…' },
    'Ajuda ▾': { en: 'Help ▾', es: 'Ayuda ▾' },
    'ℹ️ Como funciona': { en: 'ℹ️ How it works', es: 'ℹ️ Cómo funciona' },

    // ---- modal configurações ----
    'Configurações do motor local': { en: 'Local engine settings', es: 'Configuración del motor local' },
    'Pasta dos projetos (Jobs)': { en: 'Projects folder (Jobs)', es: 'Carpeta de proyectos (Jobs)' },
    'DPI (qualidade × velocidade)': { en: 'DPI (quality × speed)', es: 'DPI (calidad × velocidad)' },
    'Tamanho de exibição (px)': { en: 'Display size (px)', es: 'Tamaño de visualización (px)' },
    'Escopo das folhas': { en: 'Sheet scope', es: 'Alcance de hojas' },
    '✓ {n} PDFs juntados num projeto só ({p} folhas).': { en: '✓ {n} PDFs merged into one project ({p} sheets).', es: '✓ {n} PDFs unidos en un solo proyecto ({p} hojas).' },
    '⚠ {k} ignorado(s): {files}.': { en: '⚠ {k} skipped: {files}.', es: '⚠ {k} ignorado(s): {files}.' },
    '📁 Abrir pasta do projeto': { en: '📁 Open project folder', es: '📁 Abrir carpeta del proyecto' },
    'Atualize o app: este recurso precisa da versão nova do motor.': { en: 'Update the app: this feature needs the new engine version.', es: 'Actualice la app: esta función necesita la versión nueva del motor.' },
    'Nenhum PDF encontrado nesta pasta.': { en: 'No PDF found in this folder.', es: 'No se encontró ningún PDF en esta carpeta.' },
    'Todas as páginas': { en: 'All pages', es: 'Todas las páginas' },
    'Só as folhas com marcas': { en: 'Only sheets with marks', es: 'Sólo hojas con marcas' },
    'Folha do Window Schedule (A700)': { en: 'Window Schedule sheet (A700)', es: 'Hoja de Window Schedule (A700)' },
    'Folha do Storefront (A701)': { en: 'Storefront sheet (A701)', es: 'Hoja de Storefront (A701)' },
    'auto ou nº': { en: 'auto or no.', es: 'auto o nº' },
    'Mudanças valem para o próximo "Reprocessar" de um projeto.': {
      en: 'Changes apply on the next "Reprocess" of a project.',
      es: 'Los cambios se aplican al próximo "Reprocesar" de un proyecto.' },
    'Cancelar': { en: 'Cancel', es: 'Cancelar' },
    'Salvar': { en: 'Save', es: 'Guardar' },

    // ---- modal projetos salvos ----
    '📁 Projetos salvos': { en: '📁 Saved projects', es: '📁 Proyectos guardados' },
    'Buscar projeto…': { en: 'Search project…', es: 'Buscar proyecto…' },
    'Ícones': { en: 'Icons', es: 'Iconos' },
    'Lista': { en: 'List', es: 'Lista' },
    'Atualizar': { en: 'Refresh', es: 'Actualizar' },

    // ---- 1. upload ----
    'Upload da Planta (PDF)': { en: 'Plan Upload (PDF)', es: 'Carga del Plano (PDF)' },
    'Envie a planta arquitetônica. A IA fará a extração das esquadrias.': {
      en: 'Upload the architectural plan. The AI will extract the windows & doors.',
      es: 'Sube el plano arquitectónico. La IA extraerá las carpinterías.' },
    'Clique ou arraste o PDF aqui': { en: 'Click or drag the PDF here', es: 'Haz clic o arrastra el PDF aquí' },
    'Apenas arquivos .pdf': { en: 'Only .pdf files', es: 'Sólo archivos .pdf' },
    'Selecionar projeto (PDF) — motor local': {
      en: 'Select project (PDF) — local engine', es: 'Seleccionar proyecto (PDF) — motor local' },
    'Analisando com IA': { en: 'Analyzing with AI', es: 'Analizando con IA' },
    'Já tem o takeoff pronto? Importe direto (gera preço e documentos sem reprocessar):': {
      en: 'Already have the takeoff? Import it directly (price & documents without reprocessing):',
      es: '¿Ya tienes el takeoff? Impórtalo directo (precio y documentos sin reprocesar):' },
    'Importar Takeoff (Excel / JSON)': { en: 'Import Takeoff (Excel / JSON)', es: 'Importar Takeoff (Excel / JSON)' },

    // ---- 2. dados do projeto ----
    'Dados do Projeto': { en: 'Project Details', es: 'Datos del Proyecto' },
    'Nome do projeto': { en: 'Project name', es: 'Nombre del proyecto' },
    'Cliente': { en: 'Client', es: 'Cliente' },
    'E-mail': { en: 'Email', es: 'Correo' },
    'Telefone': { en: 'Phone', es: 'Teléfono' },

    // ---- 3. tabela / editor ----
    'Itens Extraídos & Editor': { en: 'Extracted Items & Editor', es: 'Ítems Extraídos y Editor' },
    'Converter para ft²': { en: 'Convert to ft²', es: 'Convertir a ft²' },
    'Converter para m²': { en: 'Convert to m²', es: 'Convertir a m²' },
    'Tipo': { en: 'Type', es: 'Tipo' },
    'Larg.': { en: 'Width', es: 'Ancho' },
    'Alt.': { en: 'Height', es: 'Alto' },
    'Orig.': { en: 'Orig.', es: 'Orig.' },
    'Qtd': { en: 'Qty', es: 'Cant.' },
    'Área un.': { en: 'Unit area', es: 'Área un.' },
    'Total': { en: 'Total', es: 'Total' },
    'Medida original como no projeto': { en: 'Original size as in the project', es: 'Medida original como en el proyecto' },
    'Adicionar item': { en: 'Add item', es: 'Agregar ítem' },
    'Edite ID, Tipo, Largura (mm), Altura (mm) e Qtd — a área recalcula sozinha. Unidade:': {
      en: 'Edit ID, Type, Width (mm), Height (mm) and Qty — area recalculates automatically. Unit:',
      es: 'Edita ID, Tipo, Ancho (mm), Alto (mm) y Cant. — el área se recalcula sola. Unidad:' },
    'Área total do projeto:': { en: 'Project total area:', es: 'Área total del proyecto:' },

    // ---- 4. custos ----
    'Módulo de Custos': { en: 'Cost Module', es: 'Módulo de Costos' },
    'Moeda': { en: 'Currency', es: 'Moneda' },
    'Custo fornecedor (': { en: 'Supplier cost (', es: 'Costo proveedor (' },
    'Frete (%)': { en: 'Freight (%)', es: 'Flete (%)' },
    'Margem desejada (%)': { en: 'Target margin (%)', es: 'Margen deseado (%)' },
    'Área total (m²)': { en: 'Total area (m²)', es: 'Área total (m²)' },
    'Custo total': { en: 'Total cost', es: 'Costo total' },
    'Preço cliente': { en: 'Client price', es: 'Precio cliente' },
    'Lucro': { en: 'Profit', es: 'Beneficio' },

    // ---- 5. pré-visualização ----
    'Pré-visualização Técnica': { en: 'Technical Preview', es: 'Vista Previa Técnica' },
    'Desenho gerado automaticamente do item': { en: 'Drawing auto-generated for item', es: 'Dibujo generado automáticamente del ítem' },
    'Dobradiça:': { en: 'Hinge:', es: 'Bisagra:' },
    '— a definir': { en: '— to define', es: '— a definir' },
    'Esquerda': { en: 'Left', es: 'Izquierda' },
    'Direita': { en: 'Right', es: 'Derecha' },
    'Lado da dobradiça / abertura': { en: 'Hinge / opening side', es: 'Lado de la bisagra / apertura' },
    'Lado da dobradiça': { en: 'Hinge side', es: 'Lado de la bisagra' },
    'Abertura: para Dentro / para Fora': { en: 'Opening: inward / outward', es: 'Apertura: hacia dentro / hacia fuera' },
    'Lado (E/D)': { en: 'Side (L/R)', es: 'Lado (I/D)' },
    'Abre (D/F)': { en: 'Opens (I/O)', es: 'Abre (D/F)' },
    '▭ Retângulo (janela)': { en: '▭ Rectangle (window)', es: '▭ Rectángulo (ventana)' },
    'Retângulo (janela)': { en: 'Rectangle (window)', es: 'Rectángulo (ventana)' },
    'Marcar retângulo: ARRASTE uma caixa sobre a janela na planta. A caixa fica na cor da marca e mostra a tag (rótulo abaixo) bem grande no centro.': { en: 'Rectangle mark: DRAG a box over the window on the plan. The box uses the mark color and shows the tag (label below) large in the center.', es: 'Marcar rectángulo: ARRASTRE una caja sobre la ventana en el plano. La caja toma el color de la marca y muestra la etiqueta (rótulo abajo) grande en el centro.' },
    'Caixa marcada{l}': { en: 'Box marked{l}', es: 'Caja marcada{l}' },
    '⊞ Auto Retângulo': { en: '⊞ Auto Rectangle', es: '⊞ Auto Rectángulo' },
    'Auto Retângulo': { en: 'Auto Rectangle', es: 'Auto Rectángulo' },
    'Auto Retângulo…': { en: 'Auto Rectangle…', es: 'Auto Rectángulo…' },
    'Auto Retângulo: +{a} caixa(s) de {m}': { en: 'Auto Rectangle: +{a} box(es) of {m}', es: 'Auto Rectángulo: +{a} caja(s) de {m}' },
    'Auto Retângulo: nada igual encontrado (ajuste a sensibilidade)': { en: 'Auto Rectangle: no match found (adjust sensitivity)', es: 'Auto Rectángulo: no se encontró nada igual (ajuste la sensibilidad)' },
    'Arraste um retângulo sobre os TIPOS DE PAREDE (Esc cancela; clique sem arrastar = folha toda).': { en: 'Drag a rectangle over the WALL TYPES (Esc cancels; click without dragging = whole sheet).', es: 'Arrastre un rectángulo sobre los TIPOS DE PARED (Esc cancela; clic sin arrastrar = hoja entera).' },
    'Tipos de parede (IA)': { en: 'Wall types (AI)', es: 'Tipos de pared (IA)' },
    'Medidas (IA)': { en: 'Measurements (AI)', es: 'Medidas (IA)' },
    'Arraste um retângulo sobre as MEDIDAS/SCHEDULE (Esc cancela; clique sem arrastar = folhas marcadas).': { en: 'Drag a rectangle over the MEASUREMENTS/SCHEDULE (Esc cancels; click without dragging = marked sheets).', es: 'Arrastre un rectángulo sobre las MEDIDAS/SCHEDULE (Esc cancela; clic sin arrastrar = hojas marcadas).' },
    'Relendo medidas na área marcada…': { en: 'Re-reading measurements in the marked area…', es: 'Releyendo medidas en el área marcada…' },
    'Local não leu — lendo medidas com IA de visão (nuvem)…': { en: 'Local read empty — reading measurements with vision AI (cloud)…', es: 'Lectura local vacía — leyendo medidas con IA de visión (nube)…' },
    '🧠 IA: {n} medidas lidas na área (confira na Conferência)': { en: '🧠 AI: {n} measurements read in the area (check in Review)', es: '🧠 IA: {n} medidas leídas en el área (revise en Conferencia)' },
    'IA: nenhuma esquadria legível na área': { en: 'AI: no legible window/door in the area', es: 'IA: ninguna ventana/puerta legible en el área' },
    'Área de leitura removida': { en: 'Read area removed', es: 'Área de lectura eliminada' },
    'Auto Retângulo: clique numa caixa modelo (marque uma com ▭ antes).': { en: 'Auto Rectangle: click a template box (mark one with ▭ first).', es: 'Auto Rectángulo: haga clic en una caja modelo (marque una con ▭ antes).' },
    'Auto Retângulo: marque UMA caixa com ▭ e clique nela aqui. Ele acha as janelas iguais na folha e cria a mesma caixa (cor + tag) em todas.': { en: 'Auto Rectangle: mark ONE box with ▭ and click it here. It finds the matching windows on the sheet and creates the same box (color + tag) on all of them.', es: 'Auto Rectángulo: marque UNA caja con ▭ y haga clic en ella aquí. Encuentra las ventanas iguales en la hoja y crea la misma caja (color + etiqueta) en todas.' },
    'Abre para:': { en: 'Opens:', es: 'Abre hacia:' },
    'Abre:': { en: 'Opens:', es: 'Abre:' },
    'Mão: a definir (conforme o projeto)': { en: 'Hand: to define (per the project)', es: 'Mano: a definir (según el proyecto)' },
    'Dentro': { en: 'Inward', es: 'Hacia dentro' },
    'Fora': { en: 'Outward', es: 'Hacia fuera' },

    // ---- 6. quadro resumo ----
    'Quadro Resumo': { en: 'Summary Table', es: 'Cuadro Resumen' },
    'Marca colorida e única por tipo (cor + forma) com a quantidade por projeto.': {
      en: 'Unique colored mark per type (color + shape) with the quantity per project.',
      es: 'Marca de color única por tipo (color + forma) con la cantidad por proyecto.' },
    'Marca': { en: 'Mark', es: 'Marca' },
    'Medida (mm)': { en: 'Size (mm)', es: 'Medida (mm)' },
    'Medida (mm / ft)': { en: 'Size (mm / ft)', es: 'Medida (mm / ft)' },
    'Total de unidades': { en: 'Total units', es: 'Total de unidades' },
    'Baixar Quadro Resumo (PDF)': { en: 'Download Summary (PDF)', es: 'Descargar Cuadro Resumen (PDF)' },

    // ---- 7. conferência ----
    'Conferência (Planta × Fachada)': { en: 'Cross-check (Plan × Elevation)', es: 'Verificación (Plano × Fachada)' },
    'Comparação das esquadrias entre a planta baixa e a fachada/elevação. Resolva as divergências antes de enviar ao fabricante.': {
      en: 'Comparison of windows & doors between floor plan and elevation. Resolve the discrepancies before sending to the manufacturer.',
      es: 'Comparación de carpinterías entre la planta y la fachada/alzado. Resuelve las discrepancias antes de enviar al fabricante.' },

    // ---- 8. exportação ----
    'Exportação': { en: 'Export', es: 'Exportación' },
    'Gere os documentos finais para cliente e fornecedor.': {
      en: 'Generate the final documents for client and supplier.',
      es: 'Genera los documentos finales para cliente y proveedor.' },
    'Orçamento Cliente': { en: 'Client Quote', es: 'Presupuesto Cliente' },
    'PDF com itens, preços, total e condições de pagamento.': {
      en: 'PDF with items, prices, total and payment terms.',
      es: 'PDF con ítems, precios, total y condiciones de pago.' },
    'Pedido Fornecedor': { en: 'Supplier Order', es: 'Pedido Proveedor' },
    'Excel (.xlsx) com medidas e especificações (sem preços).': {
      en: 'Excel (.xlsx) with sizes and specifications (no prices).',
      es: 'Excel (.xlsx) con medidas y especificaciones (sin precios).' },
    'Planta Marcada': { en: 'Marked Plan', es: 'Plano Marcado' },
    'PDF da planta com a marca colorida sobre cada janela + quadro resumo em cada folha (para conferir o levantamento da IA).': {
      en: 'Plan PDF with the colored mark over each window + summary table on each sheet (to check the AI takeoff).',
      es: 'PDF del plano con la marca de color sobre cada ventana + cuadro resumen en cada hoja (para verificar el takeoff de la IA).' },
    'Proposta Cliente': { en: 'Client Proposal', es: 'Propuesta Cliente' },
    'PDF de proposta (capa, posições com desenho + specs, pricing, contato) — sem marca do fornecedor.': {
      en: 'Proposal PDF (cover, positions with drawing + specs, pricing, contact) — no supplier branding.',
      es: 'PDF de propuesta (portada, posiciones con dibujo + specs, pricing, contacto) — sin marca del proveedor.' },

    // ---- placeholder inicial / atalhos ----
    'Envie um PDF para começar.': { en: 'Upload a PDF to start.', es: 'Sube un PDF para empezar.' },
    'Os resultados e o desenho técnico aparecerão aqui.': {
      en: 'The results and the technical drawing will appear here.',
      es: 'Los resultados y el dibujo técnico aparecerán aquí.' },
    '📂 Abrir projeto (PDF)': { en: '📂 Open project (PDF)', es: '📂 Abrir proyecto (PDF)' },
    '🗂️ Projetos salvos': { en: '🗂️ Saved projects', es: '🗂️ Proyectos guardados' },

    // ---- footer ----
    'ConstructCount · POC frontend-only · dados de extração simulados': {
      en: 'ConstructCount · frontend-only POC · simulated extraction data',
      es: 'ConstructCount · POC sólo frontend · datos de extracción simulados' },

    // ---- anotador ----
    'Revisar planta — confirme/adicione as marcas': {
      en: 'Review plan — confirm/add the marks', es: 'Revisar plano — confirma/agrega las marcas' },
    '+ Adicionar marca': { en: '+ Add mark', es: '+ Agregar marca' },
    'Rótulo:': { en: 'Label:', es: 'Etiqueta:' },
    'ex.: F1': { en: 'e.g. F1', es: 'ej.: F1' },
    'Pavimentos×': { en: 'Floors×', es: 'Niveles×' },
    'Quantos pavimentos esta planta representa (ex.: 3º ao 9º = 7). Multiplica as contagens.': {
      en: 'How many floors this plan represents (e.g. 3rd to 9th = 7). Multiplies the counts.',
      es: 'Cuántos niveles representa este plano (ej.: 3º al 9º = 7). Multiplica los conteos.' },
    'Concluir': { en: 'Finish', es: 'Finalizar' },
    'Clique numa marca p/ confirmar/rejeitar · "Adicionar marca" + clique p/ incluir · duplo-clique p/ editar rótulo · roda do mouse = zoom · arraste = mover': {
      en: 'Click a mark to confirm/reject · "Add mark" + click to include · double-click to edit label · mouse wheel = zoom · drag = pan',
      es: 'Haz clic en una marca para confirmar/rechazar · "Agregar marca" + clic para incluir · doble clic para editar etiqueta · rueda = zoom · arrastrar = mover' },

    // ---- workspace: topo ----
    'Preparando projeto…': { en: 'Preparing project…', es: 'Preparando proyecto…' },
    'Seção/grupo onde as novas marcas entram': { en: 'Section/group where new marks go', es: 'Sección/grupo donde entran las nuevas marcas' },
    'Nova seção': { en: 'New section', es: 'Nueva sección' },
    'Renomear seção': { en: 'Rename section', es: 'Renombrar sección' },
    'Excluir seção': { en: 'Delete section', es: 'Eliminar sección' },
    'Consolidar → Tabela': { en: 'Consolidate → Table', es: 'Consolidar → Tabla' },
    'Tudo': { en: 'All', es: 'Todo' },
    'Fachada (parede externa)': { en: 'Façade (exterior wall)', es: 'Fachada (pared exterior)' },
    'Portas interiores': { en: 'Interior doors', es: 'Puertas interiores' },
    'Tudo (janelas + portas)': { en: 'Everything (windows + doors)', es: 'Todo (ventanas + puertas)' },
    'Reconhecimento do projeto': { en: 'Project recognition', es: 'Reconocimiento del proyecto' },
    'O que este projeto vai levantar?': { en: 'What will this project take off?', es: '¿Qué va a levantar este proyecto?' },
    'Escopo': { en: 'Scope', es: 'Alcance' },
    'Varrendo o PDF…': { en: 'Scanning the PDF…', es: 'Escaneando el PDF…' },
    'Selecionar folhas para pesquisar': { en: 'Select sheets to process', es: 'Seleccionar hojas a procesar' },
    'Marque as folhas (plantas) que o motor vai processar. Use 📐 para a folha de medidas (schedule).': {
      en: 'Check the sheets (plans) the engine will process. Use 📐 for the measures sheet (schedule).',
      es: 'Marca las hojas (planos) que el motor procesará. Usa 📐 para la hoja de medidas (schedule).' },
    'Selecionar todas': { en: 'Select all', es: 'Seleccionar todas' },
    'Limpar': { en: 'Clear', es: 'Limpiar' },
    '{n} selecionada(s)': { en: '{n} selected', es: '{n} seleccionada(s)' },
    'Processar selecionadas ({n})': { en: 'Process selected ({n})', es: 'Procesar seleccionadas ({n})' },
    'Folha de medidas (schedule)': { en: 'Measures sheet (schedule)', es: 'Hoja de medidas (schedule)' },
    'Selecione ao menos uma folha.': { en: 'Select at least one sheet.', es: 'Selecciona al menos una hoja.' },
    'O que levantar: tudo, só a fachada (parede externa: janelas + portas externas) ou só as portas interiores': {
      en: 'What to take off: everything, only the façade (exterior wall: windows + exterior doors), or only interior doors',
      es: 'Qué levantar: todo, sólo la fachada (pared exterior: ventanas + puertas exteriores) o sólo las puertas interiores' },
    'Fechar': { en: 'Close', es: 'Cerrar' },

    // ---- workspace: painéis / ícones ----
    'Expandir painel': { en: 'Expand panel', es: 'Expandir panel' },
    'Páginas': { en: 'Pages', es: 'Páginas' },
    'Marcas desta folha': { en: 'Marks on this sheet', es: 'Marcas de esta hoja' },
    'Recolher painel (vira barra de ícones)': { en: 'Collapse panel (becomes an icon bar)', es: 'Contraer panel (barra de iconos)' },
    '◀ recolher': { en: '◀ collapse', es: '◀ contraer' },
    'recolher ▶': { en: 'collapse ▶', es: 'contraer ▶' },
    'Apaga as folhas marcadas com 🗑 (libera espaço)': { en: 'Deletes sheets marked with 🗑 (frees space)', es: 'Borra las hojas marcadas con 🗑 (libera espacio)' },
    'Projetos salvos': { en: 'Saved projects', es: 'Proyectos guardados' },
    'Abrir novo projeto (PDF)': { en: 'Open new project (PDF)', es: 'Abrir nuevo proyecto (PDF)' },
    'Recarregar folha': { en: 'Reload sheet', es: 'Recargar hoja' },
    'Ordenar (nº / marcas)': { en: 'Sort (no. / marks)', es: 'Ordenar (nº / marcas)' },
    'Mais nitidez': { en: 'Sharper', es: 'Más nitidez' },
    'Abrir pasta do projeto': { en: 'Open project folder', es: 'Abrir carpeta del proyecto' },
    'Apagar folhas marcadas': { en: 'Delete marked sheets', es: 'Borrar hojas marcadas' },

    // ---- workspace: ferramentas ----
    'Ferramentas': { en: 'Tools', es: 'Herramientas' },
    'Modo contar: clique na planta para adicionar 1 marca': { en: 'Count mode: click the plan to add 1 mark', es: 'Modo contar: clic en el plano para agregar 1 marca' },
    '⊕ Contar': { en: '⊕ Count', es: '⊕ Contar' },
    'Auto Count: clique numa marca de amostra e ele acha todas as iguais na folha': {
      en: 'Auto Count: click a sample mark and it finds all matching ones on the sheet',
      es: 'Auto Count: haz clic en una marca de muestra y encuentra todas las iguales en la hoja' },
    'Apagar: clique numa marca para removê-la de vez': { en: 'Delete: click a mark to remove it', es: 'Borrar: haz clic en una marca para quitarla' },
    '🗑 Apagar (1 a 1)': { en: '🗑 Delete (one by one)', es: '🗑 Borrar (una a una)' },
    "Apaga TODAS as marcas do código selecionado na lista (clique num código em 'Marcas desta folha')": {
      en: "Deletes ALL marks of the code selected in the list (click a code in 'Marks on this sheet')",
      es: "Borra TODAS las marcas del código seleccionado en la lista (haz clic en un código en 'Marcas de esta hoja')" },
    '🗑 Apagar selecionadas': { en: '🗑 Delete selected', es: '🗑 Borrar seleccionadas' },
    'Remove todas as marcas rejeitadas (cinza) desta folha': { en: 'Removes all rejected (gray) marks on this sheet', es: 'Elimina todas las marcas rechazadas (gris) de esta hoja' },
    'Limpar rejeitadas': { en: 'Clear rejected', es: 'Limpiar rechazadas' },

    // ---- workspace: auto count ----
    'Maior = só idênticos; menor = pega mais parecidos': { en: 'Higher = identical only; lower = catches similar ones', es: 'Mayor = sólo idénticos; menor = capta los parecidos' },
    'Sensibilidade': { en: 'Sensitivity', es: 'Sensibilidad' },
    'Rótulo': { en: 'Label', es: 'Etiqueta' },

    // ---- workspace: janela selecionada ----
    'Janela selecionada': { en: 'Selected window', es: 'Ventana seleccionada' },
    'Clique num código na lista à esquerda.': { en: 'Click a code in the list on the left.', es: 'Haz clic en un código en la lista de la izquierda.' },
    'Largura': { en: 'Width', es: 'Ancho' },
    'Altura': { en: 'Height', es: 'Alto' },
    'usar a última medida do desenho': { en: 'use the last measure from the drawing', es: 'usar la última medida del dibujo' },
    'Salvar medida da janela': { en: 'Save window size', es: 'Guardar medida de la ventana' },

    // ---- workspace: escala / medir ----
    'Escala / Medir (desenho)': { en: 'Scale / Measure (drawing)', es: 'Escala / Medir (dibujo)' },
    'Trace uma linha sobre uma medida conhecida do desenho e informe o valor real': {
      en: 'Draw a line over a known dimension in the drawing and enter its real value',
      es: 'Traza una línea sobre una medida conocida del dibujo e indica el valor real' },
    '📏 Calibrar escala': { en: '📏 Calibrate scale', es: '📏 Calibrar escala' },
    'Trace uma linha e veja a medida real (precisa calibrar a escala antes). Pode adicionar várias.': {
      en: 'Draw a line and see the real measure (calibrate the scale first). You can add several.',
      es: 'Traza una línea y ve la medida real (calibra la escala antes). Puedes agregar varias.' },
    '📐 Medir (várias)': { en: '📐 Measure (multiple)', es: '📐 Medir (varias)' },
    'Apaga a medida selecionada (clique numa medida; ou tecla Delete)': {
      en: 'Deletes the selected measure (click a measure; or press Delete)',
      es: 'Borra la medida seleccionada (haz clic en una medida; o tecla Suprimir)' },
    '🗑 Apagar medida selecionada': { en: '🗑 Delete selected measure', es: '🗑 Borrar medida seleccionada' },
    'Remove todas as medidas desta folha': { en: 'Removes all measures on this sheet', es: 'Elimina todas las medidas de esta hoja' },
    'Limpar todas as medidas': { en: 'Clear all measures', es: 'Limpiar todas las medidas' },
    'Escala: não calibrada.': { en: 'Scale: not calibrated.', es: 'Escala: no calibrada.' },

    // ---- workspace: medidas (schedule) ----
    'Medidas (schedule)': { en: 'Sizes (schedule)', es: 'Medidas (schedule)' },
    'Marca esta folha como fonte de medidas (ex.: A700/A701)': {
      en: 'Marks this sheet as a size source (e.g. A700/A701)',
      es: 'Marca esta hoja como fuente de medidas (ej.: A700/A701)' },
    '📐 Usar esta folha p/ medidas': { en: '📐 Use this sheet for sizes', es: '📐 Usar esta hoja p/ medidas' },
    'Lê as dimensões só das folhas marcadas e atualiza as medidas': {
      en: 'Reads dimensions only from marked sheets and updates the sizes',
      es: 'Lee las dimensiones sólo de las hojas marcadas y actualiza las medidas' },
    '↻ Reler medidas': { en: '↻ Re-read sizes', es: '↻ Releer medidas' },

    // ---- workspace: folha ----
    'Folha': { en: 'Sheet', es: 'Hoja' },
    'Quantos pavimentos esta folha representa': { en: 'How many floors this sheet represents', es: 'Cuántos niveles representa esta hoja' },
    'Ajustar': { en: 'Fit', es: 'Ajustar' },
    'Re-renderiza esta folha em alta resolução (mais nítido no zoom). Mantém marcas e medidas.': {
      en: 'Re-renders this sheet in high resolution (sharper on zoom). Keeps marks and measures.',
      es: 'Vuelve a renderizar esta hoja en alta resolución (más nítida en zoom). Mantiene marcas y medidas.' },
    '🔍 Mais nitidez (esta folha)': { en: '🔍 Sharper (this sheet)', es: '🔍 Más nitidez (esta hoja)' },

    // ---- workspace: barra direita (ícones) ----
    'Expandir painel ': { en: 'Expand panel', es: 'Expandir panel' },
    'Contar': { en: 'Count', es: 'Contar' },
    'Apagar (1 a 1)': { en: 'Delete (one by one)', es: 'Borrar (una a una)' },
    'Calibrar escala': { en: 'Calibrate scale', es: 'Calibrar escala' },
    'Medir': { en: 'Measure', es: 'Medir' },
    'Ajustar à tela': { en: 'Fit to screen', es: 'Ajustar a pantalla' },

    // ---- workspace: rodapé status ----
    'Escala calibrada desta folha': { en: 'Calibrated scale of this sheet', es: 'Escala calibrada de esta hoja' },
    'Escala: —': { en: 'Scale: —', es: 'Escala: —' },
    'Snap: gruda o clique no centro da marca mais próxima': { en: 'Snap: sticks the click to the nearest mark center', es: 'Snap: ajusta el clic al centro de la marca más cercana' },
    'Ortho: trava a medida em horizontal/vertical': { en: 'Ortho: locks the measure to horizontal/vertical', es: 'Ortho: bloquea la medida en horizontal/vertical' },
    'Record: Point To Point': { en: 'Record: Point To Point', es: 'Record: Punto a Punto' },
    'Folha / projeto': { en: 'Sheet / project', es: 'Hoja / proyecto' },

    // ===================== DOCUMENTOS (PDF/Excel) =====================
    // -- comuns --
    'Projeto': { en: 'Project', es: 'Proyecto' },
    'Data': { en: 'Date', es: 'Fecha' },
    'Preço': { en: 'Price', es: 'Precio' },
    'Pos.': { en: 'Pos.', es: 'Pos.' },
    'Medida (ft)': { en: 'Size (ft)', es: 'Medida (ft)' },
    'Área': { en: 'Area', es: 'Área' },
    'Área (m²/ft²)': { en: 'Area (m²/ft²)', es: 'Área (m²/ft²)' },
    'Quadro Resumo de Esquadrias': { en: 'Window & Door Summary', es: 'Cuadro Resumen de Carpinterías' },
    // -- orçamento cliente (export.js) --
    'Orçamento ao Cliente — Esquadrias (portas & janelas)': {
      en: 'Client Quote — Windows & Doors', es: 'Presupuesto al Cliente — Carpinterías (puertas y ventanas)' },
    'Especificações (conforme o projeto)': { en: 'Specifications (per project)', es: 'Especificaciones (según el proyecto)' },
    'Medida': { en: 'Size', es: 'Medida' },
    'tipos': { en: 'types', es: 'tipos' },
    'unidades': { en: 'units', es: 'unidades' },
    'portas': { en: 'doors', es: 'puertas' },
    'janelas': { en: 'windows', es: 'ventanas' },
    'tipos de porta': { en: 'door types', es: 'tipos de puerta' },
    'tipos de janela': { en: 'window types', es: 'tipos de ventana' },
    'Esquadrias': { en: 'Windows & Doors', es: 'Carpinterías' },
    'Portas': { en: 'Doors', es: 'Puertas' },
    'Janelas': { en: 'Windows', es: 'Ventanas' },
    'VALOR FINAL: {v}': { en: 'FINAL AMOUNT: {v}', es: 'VALOR FINAL: {v}' },
    'Condições de pagamento': { en: 'Payment terms', es: 'Condiciones de pago' },
    '• 50% de entrada na aprovação do orçamento;': { en: '• 50% down payment on quote approval;', es: '• 50% de anticipo al aprobar el presupuesto;' },
    '• 50% na entrega/instalação;': { en: '• 50% on delivery/installation;', es: '• 50% en la entrega/instalación;' },
    '• Prazo de produção: 25 dias úteis;': { en: '• Production lead time: 25 business days;', es: '• Plazo de producción: 25 días hábiles;' },
    '• Validade da proposta: 15 dias;': { en: '• Quote valid for: 15 days;', es: '• Validez de la propuesta: 15 días;' },
    '• Pix, transferência ou cartão (até 12x).': { en: '• Wire transfer or card (up to 12x).', es: '• Transferencia o tarjeta (hasta 12x).' },
    'Especificações lidas do projeto (door/window schedule). Itens sem dado: "a definir" — nada foi assumido.': {
      en: 'Specifications read from the project (door/window schedule). Missing data: "to define" — nothing was assumed.',
      es: 'Especificaciones leídas del proyecto (door/window schedule). Sin dato: "a definir" — nada fue asumido.' },
    '⚠ marca reconstruída do texto (sem hexágono no projeto) — confirmar marcação': {
      en: '⚠ mark reconstructed from text (no hexagon in the project) — confirm marking',
      es: '⚠ marca reconstruida del texto (sin hexágono en el proyecto) — confirmar marcación' },
    // -- specs (rótulos) --
    'Material': { en: 'Material', es: 'Material' },
    'Vidro': { en: 'Glass', es: 'Vidrio' },
    '— (folha sólida)': { en: '— (solid leaf)', es: '— (hoja sólida)' },
    '— (porta sólida)': { en: '— (solid door)', es: '— (puerta sólida)' },
    'Dobradiças': { en: 'Hinges', es: 'Bisagras' },
    'Fechadura': { en: 'Lockset', es: 'Cerradura' },
    'Soleira': { en: 'Saddle', es: 'Umbral' },
    'Corta-fogo': { en: 'Fire rating', es: 'Cortafuego' },
    'Almofadas': { en: 'Panels', es: 'Plafones' },
    'Veneziana': { en: 'Louver', es: 'Persiana' },
    'Grade': { en: 'Grille', es: 'Reja' },
    'Painel': { en: 'Panel', es: 'Panel' },
    'Representação do adicional': { en: 'Add-on representation', es: 'Representación del adicional' },
    'Como o adicional é desenhado no lugar do vidro': { en: 'How the add-on is drawn instead of glass', es: 'Cómo se dibuja el adicional en lugar del vidrio' },
    'Nome do adicional desta janela (aparece nos rótulos, no desenho e no relatório)': { en: 'Name of this window’s add-on (shown in labels, drawing and report)', es: 'Nombre del adicional de esta ventana (aparece en etiquetas, dibujo e informe)' },
    'Cor': { en: 'Color', es: 'Color' },
    'Mão': { en: 'Hand', es: 'Mano' },
    'Obs': { en: 'Notes', es: 'Obs' },
    'a definir (conforme projeto)': { en: 'to define (per project)', es: 'a definir (según proyecto)' },
    'a definir': { en: 'to define', es: 'a definir' },
    'abre p/ fora': { en: 'opens outward', es: 'abre hacia fuera' },
    'abre p/ dentro': { en: 'opens inward', es: 'abre hacia dentro' },
    // -- pedido fornecedor (excel) --
    'PEDIDO AO FORNECEDOR': { en: 'SUPPLIER ORDER', es: 'PEDIDO AL PROVEEDOR' },
    'Marca (cor)': { en: 'Mark (color)', es: 'Marca (color)' },
    'Forma': { en: 'Shape', es: 'Forma' },
    'Medida original': { en: 'Original size', es: 'Medida original' },
    'Observacoes': { en: 'Notes', es: 'Observaciones' },
    '⚠ marca reconstruída do texto — confirmar marcação': {
      en: '⚠ mark reconstructed from text — confirm marking', es: '⚠ marca reconstruida del texto — confirmar marcación' },
    // -- quadro resumo (pdf) --
    'Cada tipo possui cor e forma únicas. Anexe este quadro a cada planta.': {
      en: 'Each type has a unique color and shape. Attach this table to every plan.',
      es: 'Cada tipo tiene color y forma únicos. Adjunta este cuadro a cada plano.' },
    // -- proposta (proposal.js) --
    'Proposta técnica de esquadrias': { en: 'Windows & doors technical proposal', es: 'Propuesta técnica de carpinterías' },
    'Obrigado pela oportunidade': { en: 'Thank you for the opportunity', es: 'Gracias por la oportunidad' },
    'Não foi possível ler a imagem da folha.': { en: 'Could not read the sheet image.', es: 'No se pudo leer la imagen de la hoja.' },
    'Sem conexão com o servidor de IA.': { en: 'No connection to the AI server.', es: 'Sin conexión con el servidor de IA.' },
    'Resposta inválida do servidor de IA (HTTP {s}).': { en: 'Invalid response from the AI server (HTTP {s}).', es: 'Respuesta inválida del servidor de IA (HTTP {s}).' },
    'Fale conosco': { en: 'Contact us', es: 'Contáctanos' },
    'Site': { en: 'Website', es: 'Sitio web' },
    'Endereço': { en: 'Address', es: 'Dirección' },
    'Aceite da proposta': { en: 'Proposal acceptance', es: 'Aceptación de la propuesta' },
    '• Valores em USD.': { en: '• Amounts in USD.', es: '• Valores en USD.' },
    'Agradecemos a confiança em nos receber. Esta proposta foi preparada com atenção a cada detalhe do seu projeto. Ficamos à disposição para esclarecer dúvidas e seguir para a próxima etapa.': { en: 'Thank you for receiving us. This proposal was prepared with attention to every detail of your project. We remain available to clarify any questions and move on to the next step.', es: 'Agradecemos la confianza al recibirnos. Esta propuesta fue preparada con atención a cada detalle de tu proyecto. Quedamos a disposición para aclarar dudas y avanzar a la siguiente etapa.' },
    'PROJECT PROPOSAL': { en: 'PROJECT PROPOSAL', es: 'PROPUESTA DE PROYECTO' },
    'Proposal Details by': { en: 'Proposal Details by', es: 'Detalles de la Propuesta por' },
    'Project address:': { en: 'Project address:', es: 'Dirección del proyecto:' },
    'Cliente: {c}': { en: 'Client: {c}', es: 'Cliente: {c}' },
    '{n} tipos · {q} unidades{brk}': { en: '{n} types · {q} units{brk}', es: '{n} tipos · {q} unidades{brk}' },
    ' ({d} portas · {w} janelas)': { en: ' ({d} doors · {w} windows)', es: ' ({d} puertas · {w} ventanas)' },
    'Positions': { en: 'Positions', es: 'Posiciones' },
    'Pricing': { en: 'Pricing', es: 'Precios' },
    'Quantidade': { en: 'Quantity', es: 'Cantidad' },
    'Operação': { en: 'Operation', es: 'Operación' },
    'VALOR TOTAL: {v}': { en: 'TOTAL AMOUNT: {v}', es: 'VALOR TOTAL: {v}' },
    'Quantidade total: {q} un.   ·   Área total: {a}': {
      en: 'Total quantity: {q} units   ·   Total area: {a}', es: 'Cantidad total: {q} un.   ·   Área total: {a}' },
    'Condições': { en: 'Terms', es: 'Condiciones' },
    '• 50% na aprovação, 50% na entrega/instalação;': {
      en: '• 50% on approval, 50% on delivery/installation;', es: '• 50% en la aprobación, 50% en la entrega/instalación;' },
    '• Prazo de produção: a confirmar;': { en: '• Production lead time: to confirm;', es: '• Plazo de producción: a confirmar;' },
    '• Tempered glass conforme IBC/IRC ch.24 (a confirmar em revisão de código).': {
      en: '• Tempered glass per IBC/IRC ch.24 (to confirm in code review).',
      es: '• Vidrio templado según IBC/IRC cap.24 (a confirmar en revisión de código).' },
    'Contact Information': { en: 'Contact Information', es: 'Información de Contacto' },
    'Página': { en: 'Page', es: 'Página' },
    'Size: {w} × {h}  ({wm}×{hm} mm)': { en: 'Size: {w} × {h}  ({wm}×{hm} mm)', es: 'Medida: {w} × {h}  ({wm}×{hm} mm)' },
    // -- rótulos de tipo (porta/janela) --
    'Janela Casement (abrir)': { en: 'Casement Window', es: 'Ventana Casement (abatible)' },
    'Janela Casement 2 folhas': { en: 'Double Casement Window', es: 'Ventana Casement 2 hojas' },
    'Janela de correr': { en: 'Sliding Window', es: 'Ventana corredera' },
    'Janela basculante / maxim-ar': { en: 'Awning / Hopper Window', es: 'Ventana proyectante / oscilante' },
    'Oscilo-batente': { en: 'Tilt & Turn', es: 'Oscilobatiente' },
    'Janela guilhotina': { en: 'Double-Hung Window', es: 'Ventana guillotina' },
    'Janela fixa': { en: 'Fixed Window', es: 'Ventana fija' },
    'Janela geminada (Twin)': { en: 'Twin Window', es: 'Ventana gemela (Twin)' },
    'Porta de abrir': { en: 'Swing Door', es: 'Puerta abatible' },
    'Porta 2 folhas': { en: 'Double Door', es: 'Puerta 2 hojas' },
    'Porta pré-montada': { en: 'Pre-Hung Door', es: 'Puerta premontada' },
    'Porta embutida': { en: 'Pocket Door', es: 'Puerta embutida' },
    'Porta sanfonada': { en: 'Bifold Door', es: 'Puerta plegable' },
    'Porta de correr (armário)': { en: 'Bypass / Closet Door', es: 'Puerta corredera (clóset)' },
    'Porta celeiro': { en: 'Barn Door', es: 'Puerta granero' },
    'Porta francesa': { en: 'French Door', es: 'Puerta francesa' },
    'Porta holandesa': { en: 'Dutch Door', es: 'Puerta holandesa' },
    'Porta de correr': { en: 'Sliding Door', es: 'Puerta corredera' },
    'Porta de correr de vidro': { en: 'Sliding Glass / Patio Door', es: 'Puerta corredera de vidrio' },
    'Porta de entrada': { en: 'Entry Door', es: 'Puerta de entrada' },
    'Porta corta-fogo': { en: 'Fire-Rated Door', es: 'Puerta cortafuego' },
    'Porta lisa': { en: 'Flush Door', es: 'Puerta lisa' },
    'Porta almofadada': { en: 'Panel Door', es: 'Puerta con plafones' },
    'Portão de garagem': { en: 'Garage Door', es: 'Puerta de garaje' },
    'Porta de fachada': { en: 'Storefront Door', es: 'Puerta de fachada' },
    'Fachada envidraçada (storefront)': { en: 'Storefront (glazed façade)', es: 'Fachada acristalada (storefront)' },
    // -- cover kind --
    'PORTAS': { en: 'DOORS', es: 'PUERTAS' },
    'JANELAS': { en: 'WINDOWS', es: 'VENTANAS' },
    'ESQUADRIAS': { en: 'WINDOWS & DOORS', es: 'CARPINTERÍAS' },

    // ===================== MENSAGENS DINÂMICAS (JS) =====================
    "Lendo a planta — motor local (PDF grande pode levar ~1 min)": { en: "Reading the plan — local engine (a large PDF may take ~1 min)", es: "Leyendo el plano — motor local (un PDF grande puede tardar ~1 min)" },
    "Gerando planta marcada…": { en: "Generating marked plan…", es: "Generando plano marcado…" },
    "Falha: {e}": { en: "Failed: {e}", es: "Error: {e}" },
    "Planta marcada: {e}": { en: "Marked plan: {e}", es: "Plano marcado: {e}" },
    "✓ Planta marcada gerada ({n} folhas) e aberta.": { en: "✓ Marked plan generated ({n} sheets) and opened.", es: "✓ Plano marcado generado ({n} hojas) y abierto." },
    "Erro no motor: {e}": { en: "Engine error: {e}", es: "Error del motor: {e}" },
    "Falha ao chamar o motor ({e}).": { en: "Failed to call the engine ({e}).", es: "Error al llamar al motor ({e})." },
    "Erro ao preparar projeto: {e}": { en: "Error preparing project: {e}", es: "Error al preparar el proyecto: {e}" },
    "Reabrindo projeto…": { en: "Reopening project…", es: "Reabriendo proyecto…" },
    "Preparando projeto (rasterizando folhas e detectando marcas)…": { en: "Preparing project (rasterizing sheets and detecting marks)…", es: "Preparando proyecto (rasterizando hojas y detectando marcas)…" },
    "{done}/{total} folhas": { en: "{done}/{total} sheets", es: "{done}/{total} hojas" },
    "Falha no preparo: {e}": { en: "Preparation failed: {e}", es: "Error en la preparación: {e}" },
    "Falha no workspace ({e}).": { en: "Workspace failed ({e}).", es: "Error en el espacio de trabajo ({e})." },
    "Falha ao carregar o projeto ({e}).": { en: "Failed to load the project ({e}).", es: "Error al cargar el proyecto ({e})." },
    "Não consegui carregar o projeto.": { en: "Could not load the project.", es: "No se pudo cargar el proyecto." },
    "Takeoff consolidado: {types} tipos, {marks} unidades.": { en: "Takeoff consolidated: {types} types, {marks} units.", es: "Takeoff consolidado: {types} tipos, {marks} unidades." },
    "⚠ {n} marca(s) SEM hexágono no projeto (spec reconstruída do texto): {marks}. Confirme/ajuste a marcação na tabela e na Conferência.": { en: "⚠ {n} mark(s) WITHOUT a hexagon in the project (spec reconstructed from text): {marks}. Confirm/adjust the marking in the table and in the Review.", es: "⚠ {n} marca(s) SIN hexágono en el proyecto (spec reconstruida del texto): {marks}. Confirme/ajuste la marcación en la tabla y en la Revisión." },
    "Atenção: o projeto não tem hexágono para a(s) marca(s): {marks}.\nA especificação foi reconstruída do texto do schedule.\nConfirme/ajuste a marcação correta na tabela (campo ID) e veja a Conferência.": { en: "Warning: the project has no hexagon for the mark(s): {marks}.\nThe specification was reconstructed from the schedule text.\nConfirm/adjust the correct marking in the table (ID field) and check the Review.", es: "Atención: el proyecto no tiene hexágono para la(s) marca(s): {marks}.\nLa especificación fue reconstruida del texto del schedule.\nConfirme/ajuste la marcación correcta en la tabla (campo ID) y vea la Revisión." },
    "Nenhuma marca confirmada no projeto.": { en: "No marks confirmed in the project.", es: "Ninguna marca confirmada en el proyecto." },
    "Erro no CV: {e}": { en: "CV error: {e}", es: "Error de CV: {e}" },
    "folha {page} ({n})": { en: "sheet {page} ({n})", es: "hoja {page} ({n})" },
    "Folha {page}: {n} marcas candidatas.": { en: "Sheet {page}: {n} candidate marks.", es: "Hoja {page}: {n} marcas candidatas." },
    "Outras com marcas: {list}.": { en: "Others with marks: {list}.", es: "Otras con marcas: {list}." },
    "Nenhuma marca confirmada.": { en: "No marks confirmed.", es: "Ninguna marca confirmada." },
    "Buscando dimensões do schedule…": { en: "Fetching schedule dimensions…", es: "Buscando dimensiones del schedule…" },
    "Contagem aplicada: {n} marcas, {hit} com dimensão do schedule.": { en: "Count applied: {n} marks, {hit} with schedule dimensions.", es: "Conteo aplicado: {n} marcas, {hit} con dimensión del schedule." },
    "Disponível apenas no app de desktop (motor local).": { en: "Available only in the desktop app (local engine).", es: "Disponible solo en la app de escritorio (motor local)." },
    "Abra um projeto e consolide o levantamento antes de gerar este documento.": { en: "Open a project and consolidate the takeoff before generating this document.", es: "Abre un proyecto y consolida el conteo antes de generar este documento." },
    "ConstructCount — motor local\n\n1) Projeto ▸ Abrir projeto (PDF): o motor lê a planta.\n   • PDF com texto → tabela direto.\n   • PDF vetorizado → prepara a pasta do projeto e abre o workspace (folhas + marcas editáveis).\n2) Configurações: DPI, pasta, escopo e folhas do schedule.\n3) Projetos salvos: reabrir sem reprocessar, reprocessar ou excluir.": { en: "ConstructCount — local engine\n\n1) Project ▸ Open project (PDF): the engine reads the plan.\n   • PDF with text → table directly.\n   • Vectorized PDF → prepares the project folder and opens the workspace (sheets + editable marks).\n2) Settings: DPI, folder, scope and schedule sheets.\n3) Saved projects: reopen without reprocessing, reprocess or delete.", es: "ConstructCount — motor local\n\n1) Proyecto ▸ Abrir proyecto (PDF): el motor lee el plano.\n   • PDF con texto → tabla directa.\n   • PDF vectorizado → prepara la carpeta del proyecto y abre el workspace (hojas + marcas editables).\n2) Configuración: DPI, carpeta, alcance y hojas del schedule.\n3) Proyectos guardados: reabrir sin reprocesar, reprocesar o eliminar." },
    "Configurações salvas.": { en: "Settings saved.", es: "Configuración guardada." },
    "Carregando projetos…": { en: "Loading projects…", es: "Cargando proyectos…" },
    "{n} projeto(s)": { en: "{n} project(s)", es: "{n} proyecto(s)" },
    " · {n} filtrado(s)": { en: " · {n} filtered", es: " · {n} filtrado(s)" },
    "Nenhum projeto preparado ainda. Use <b>Projeto ▸ Abrir projeto (PDF)</b>.": { en: "No project prepared yet. Use <b>Project ▸ Open project (PDF)</b>.", es: "Aún no hay ningún proyecto preparado. Usa <b>Proyecto ▸ Abrir proyecto (PDF)</b>." },
    "Nenhum projeto encontrado para a busca.": { en: "No project found for the search.", es: "No se encontró ningún proyecto para la búsqueda." },
    "{p} folhas · {u} unid.": { en: "{p} sheets · {u} units", es: "{p} hojas · {u} unid." },
    " · {n} medidas": { en: " · {n} measures", es: " · {n} medidas" },
    "Abrir": { en: "Open", es: "Abrir" },
    "Reprocessar": { en: "Reprocess", es: "Reprocesar" },
    "Excluir": { en: "Delete", es: "Eliminar" },
    "Reprocessar \"{name}\"? As marcas serão redetectadas (edições da pasta serão perdidas).": { en: "Reprocess \"{name}\"? The marks will be re-detected (folder edits will be lost).", es: "¿Reprocesar \"{name}\"? Las marcas se volverán a detectar (se perderán las ediciones de la carpeta)." },
    "Excluir a pasta do projeto \"{name}\"? Não dá pra desfazer.": { en: "Delete the project folder \"{name}\"? This can't be undone.", es: "¿Eliminar la carpeta del proyecto \"{name}\"? No se puede deshacer." },
    "Importando takeoff…": { en: "Importing takeoff…", es: "Importando takeoff…" },
    "Não consegui importar ({err}).": { en: "Couldn't import ({err}).", es: "No se pudo importar ({err})." },
    "Takeoff vazio ou inválido.": { en: "Empty or invalid takeoff.", es: "Takeoff vacío o inválido." },
    "✓ Takeoff: {n} tipos, {q} unidades.": { en: "✓ Takeoff: {n} types, {q} units.", es: "✓ Takeoff: {n} tipos, {q} unidades." },
    "Não foi possível ler o arquivo.": { en: "Couldn't read the file.", es: "No se pudo leer el archivo." },
    "resposta inválida do servidor": { en: "invalid server response", es: "respuesta inválida del servidor" },
    " ({n} porta(s) interna(s) ignorada(s))": { en: " ({n} interior door(s) ignored)", es: " ({n} puerta(s) interior(es) ignorada(s))" },
    "✓ {n} esquadrias da fachada extraídas pela IA{extra}.": { en: "✓ {n} facade windows & doors extracted by AI{extra}.", es: "✓ {n} carpinterías de la fachada extraídas por la IA{extra}." },
    "A IA não encontrou um quadro de esquadrias neste PDF; carreguei um exemplo para editar.": { en: "The AI didn't find a window & door schedule in this PDF; I loaded an example to edit.", es: "La IA no encontró un cuadro de carpinterías en este PDF; cargué un ejemplo para editar." },
    "Extração por IA indisponível ({err}). Usando dados de exemplo — veja o README para configurar a API.": { en: "AI extraction unavailable ({err}). Using sample data — see the README to configure the API.", es: "Extracción por IA no disponible ({err}). Usando datos de ejemplo — consulta el README para configurar la API." },
    "Marca na planta sem dimensão no quadro de tipos.": { en: "Mark on the plan without a dimension in the types schedule.", es: "Marca en el plano sin dimensión en el cuadro de tipos." },
    "Tipo definido no quadro mas sem marca na planta.": { en: "Type defined in the schedule but without a mark on the plan.", es: "Tipo definido en el cuadro pero sin marca en el plano." },
    "Aparece na planta mas não na fachada.": { en: "Appears on the plan but not on the facade.", es: "Aparece en el plano pero no en la fachada." },
    "Aparece na fachada mas não na planta.": { en: "Appears on the facade but not on the plan.", es: "Aparece en la fachada pero no en el plano." },
    "✓ Nenhuma divergência entre planta e fachada.": { en: "✓ No discrepancy between plan and facade.", es: "✓ Sin discrepancias entre plano y fachada." },
    "Excluir item": { en: "Delete item", es: "Eliminar elemento" },
    "Folha {p}": { en: "Sheet {p}", es: "Hoja {p}" },
    "folha de medidas": { en: "measures sheet", es: "hoja de medidas" },
    "desmarcar": { en: "unselect", es: "deseleccionar" },
    "selecionar": { en: "select", es: "seleccionar" },
    "Restaurar marcas desta folha (desfaz o último Reconhecer)": { en: "Restore this sheet's marks (undo the last Recognize)", es: "Restaurar las marcas de esta hoja (deshace el último Reconocer)" },
    "Abra uma folha primeiro": { en: "Open a sheet first", es: "Abre una hoja primero" },
    "Restaurar as marcas desta folha do backup? Isso desfaz o último Reconhecer nesta folha.": { en: "Restore this sheet's marks from backup? This undoes the last Recognize on this sheet.", es: "¿Restaurar las marcas de esta hoja desde el respaldo? Esto deshace el último Reconocer en esta hoja." },
    "Sem backup para esta folha": { en: "No backup for this sheet", es: "Sin respaldo para esta hoja" },
    "Falha ao restaurar": { en: "Restore failed", es: "Fallo al restaurar" },
    "Marcas restauradas: {n}": { en: "Marks restored: {n}", es: "Marcas restauradas: {n}" },
    "marcar para apagar": { en: "mark for deletion", es: "marcar para borrar" },
    "Clique = só abre · Ctrl/Shift+clique = selecionar (várias) · selecionadas: 🔎 Reconhecer ou 🗑 Apagar": { en: "Click = open only · Ctrl/Shift+click = select (multiple) · selected: 🔎 Recognize or 🗑 Delete", es: "Clic = solo abrir · Ctrl/Shift+clic = seleccionar (varias) · seleccionadas: 🔎 Reconocer o 🗑 Borrar" },
    "Reconhecendo {n} selecionadas…": { en: "Recognizing {n} selected…", es: "Reconociendo {n} seleccionadas…" },
    "🗑 Apagar ({n})": { en: "🗑 Delete ({n})", es: "🗑 Borrar ({n})" },
    "{s} (folha {p})": { en: "{s} (sheet {p})", es: "{s} (hoja {p})" },
    "sem medida no schedule": { en: "no measure in schedule", es: "sin medida en el schedule" },
    "Nenhuma marca confirmada nesta folha.": { en: "No confirmed marks on this sheet.", es: "Ninguna marca confirmada en esta hoja." },
    "Código <b>{c}</b>": { en: "Code <b>{c}</b>", es: "Código <b>{c}</b>" },
    "(medida manual)": { en: "(manual measure)", es: "(medida manual)" },
    "(do schedule)": { en: "(from schedule)", es: "(del schedule)" },
    "1px = {v} mm": { en: "1px = {v} mm", es: "1px = {v} mm" },
    "não calibrada": { en: "not calibrated", es: "no calibrada" },
    "Escala: {t}": { en: "Scale: {t}", es: "Escala: {t}" },
    " · {n} medida(s)": { en: " · {n} measure(s)", es: " · {n} medida(s)" },
    "🗑 Apagar {n} selecionadas": { en: "🗑 Delete {n} selected", es: "🗑 Borrar {n} seleccionadas" },
    "🗑 Apagar selecionada": { en: "🗑 Delete selected", es: "🗑 Borrar seleccionada" },
    "{n} apagadas": { en: "{n} deleted", es: "{n} borradas" },
    "Apagada": { en: "Deleted", es: "Borrada" },
    "Clique no 2º ponto…": { en: "Click the 2nd point…", es: "Haz clic en el 2º punto…" },
    "Comprimento REAL desta linha (ex.: 7'-0\", 2336mm, 2.5m):": { en: "REAL length of this line (e.g.: 7'-0\", 2336mm, 2.5m):", es: "Longitud REAL de esta línea (ej.: 7'-0\", 2336mm, 2.5m):" },
    "Escala calibrada: 1px = {v}mm": { en: "Scale calibrated: 1px = {v}mm", es: "Escala calibrada: 1px = {v}mm" },
    "Calibre a escala primeiro (📏 Calibrar escala).": { en: "Calibrate the scale first (📏 Calibrate scale).", es: "Calibra la escala primero (📏 Calibrar escala)." },
    "Medida {n}: {ft} ({mm}mm)": { en: "Measure {n}: {ft} ({mm}mm)", es: "Medida {n}: {ft} ({mm}mm)" },
    "📐 ✓ Folha de medidas": { en: "📐 ✓ Measures sheet", es: "📐 ✓ Hoja de medidas" },
    "Folhas de medidas: {list}": { en: "Measures sheets: {list}", es: "Hojas de medidas: {list}" },
    "Nenhuma folha de medidas marcada.": { en: "No measures sheet marked.", es: "Ninguna hoja de medidas marcada." },
    "Auto Count disponível no app de desktop.": { en: "Auto Count available in the desktop app.", es: "Auto Count disponible en la app de escritorio." },
    "Auto Count…": { en: "Auto Count…", es: "Auto Count…" },
    "Falha no Auto Count": { en: "Auto Count failed", es: "Fallo en Auto Count" },
    "Auto Count: +{a} de {m} (sens. {s})": { en: "Auto Count: +{a} of {m} (sens. {s})", es: "Auto Count: +{a} de {m} (sens. {s})" },
    "Auto Count: +{a} de {m} · lendo códigos…": { en: "Auto Count: +{a} of {m} · reading codes…", es: "Auto Count: +{a} de {m} · leyendo códigos…" },
    "Auto Count: nada encontrado": { en: "Auto Count: nothing found", es: "Auto Count: nada encontrado" },
    "Auto Count: lendo {m} possíveis…": { en: "Auto Count: reading {m} candidates…", es: "Auto Count: leyendo {m} posibles…" },
    "Auto Count: +{a} \"{t}\" · ignoradas {s} de outro código": { en: "Auto Count: +{a} \"{t}\" · skipped {s} of other code", es: "Auto Count: +{a} \"{t}\" · ignoradas {s} de otro código" },
    "Auto Count: +{a} de {m}": { en: "Auto Count: +{a} of {m}", es: "Auto Count: +{a} de {m}" },
    "Auto Count: +{a} (códigos lidos)": { en: "Auto Count: +{a} (codes read)", es: "Auto Count: +{a} (códigos leídos)" },
    "Auto Count: +{a} (códigos não lidos)": { en: "Auto Count: +{a} (codes not read)", es: "Auto Count: +{a} (códigos no leídos)" },
    "Salvo ✓": { en: "Saved ✓", es: "Guardado ✓" },
    "Falha ao salvar": { en: "Failed to save", es: "Error al guardar" },
    "Editando…": { en: "Editing…", es: "Editando…" },
    "Ordenado por {by}": { en: "Sorted by {by}", es: "Ordenado por {by}" },
    "nº de marcas": { en: "no. of marks", es: "nº de marcas" },
    "nº da folha": { en: "sheet no.", es: "nº de hoja" },
    "Marque folhas com 🗑 na lista primeiro": { en: "Mark sheets with 🗑 in the list first", es: "Marca hojas con 🗑 en la lista primero" },
    "Disponível no app de desktop.": { en: "Available in the desktop app.", es: "Disponible en la app de escritorio." },
    "Seção ativa: {s}": { en: "Active section: {s}", es: "Sección activa: {s}" },
    "Nome da nova seção (ex.: Janelas, Portas, Storefront, Pav 3):": { en: "Name of the new section (e.g.: Windows, Doors, Storefront, Floor 3):", es: "Nombre de la nueva sección (ej.: Ventanas, Puertas, Storefront, Piso 3):" },
    "Seção criada: {s}": { en: "Section created: {s}", es: "Sección creada: {s}" },
    "Novo nome para a seção \"{s}\":": { en: "New name for the section \"{s}\":", es: "Nuevo nombre para la sección \"{s}\":" },
    "Seção renomeada": { en: "Section renamed", es: "Sección renombrada" },
    "Excluir a seção \"{s}\"? As marcas dela vão para a primeira seção.": { en: "Delete the section \"{s}\"? Its marks will move to the first section.", es: "¿Eliminar la sección \"{s}\"? Sus marcas pasarán a la primera sección." },
    "Seção excluída": { en: "Section deleted", es: "Sección eliminada" },
    "Medida movida": { en: "Measure moved", es: "Medida movida" },
    "{n} selecionada(s) · Del p/ apagar": { en: "{n} selected · Del to delete", es: "{n} seleccionada(s) · Supr para borrar" },
    "🗑 Apagadas {n} (laço ←)": { en: "🗑 Deleted {n} (lasso ←)", es: "🗑 Borradas {n} (lazo ←)" },
    "{n} medida(s) selecionada(s) · Del p/ apagar": { en: "{n} measure(s) selected · Del to delete", es: "{n} medida(s) seleccionada(s) · Supr para borrar" },
    "Rótulo da marca:": { en: "Mark label:", es: "Etiqueta de la marca:" },
    "Calibre a escala primeiro (📏).": { en: "Calibrate the scale first (📏).", es: "Calibra la escala primero (📏)." },
    "Sem medidas": { en: "No measures", es: "Sin medidas" },
    "Medidas limpas": { en: "Measures cleared", es: "Medidas borradas" },
    "Meça algo no desenho primeiro": { en: "Measure something on the drawing first", es: "Mide algo en el dibujo primero" },
    "Informe largura e/ou altura": { en: "Enter width and/or height", es: "Indica ancho y/o alto" },
    "Medida salva para {c}": { en: "Measure saved for {c}", es: "Medida guardada para {c}" },
    "Primeiro clique num código na lista \"Marcas desta folha\" para selecioná-lo.": { en: "First click a code in the \"Marks on this sheet\" list to select it.", es: "Primero haz clic en un código de la lista \"Marcas de esta hoja\" para seleccionarlo." },
    "Apagadas {n} marcas \"{lab}\"": { en: "Deleted {n} marks \"{lab}\"", es: "Borradas {n} marcas \"{lab}\"" },
    "Nada para apagar": { en: "Nothing to delete", es: "Nada para borrar" },
    "Apagar {n} folha(s) marcada(s)? Isso remove as imagens e marcas dessas folhas (libera espaço).": { en: "Delete {n} marked sheet(s)? This removes the images and marks of those sheets (frees space).", es: "¿Borrar {n} hoja(s) marcada(s)? Esto elimina las imágenes y marcas de esas hojas (libera espacio)." },
    "Falha ao apagar folhas": { en: "Failed to delete sheets", es: "Error al borrar hojas" },
    "Erro: {e}": { en: "Error: {e}", es: "Error: {e}" },
    "Folhas apagadas: {n}": { en: "Sheets deleted: {n}", es: "Hojas borradas: {n}" },
    "Folha {p} marcada p/ medidas": { en: "Sheet {p} marked for measures", es: "Hoja {p} marcada p/ medidas" },
    "Folha {p} desmarcada": { en: "Sheet {p} unmarked", es: "Hoja {p} desmarcada" },
    "Marque ao menos uma folha como medidas (botão 📐) antes de reler.": { en: "Mark at least one sheet as measures (📐 button) before re-reading.", es: "Marca al menos una hoja como medidas (botón 📐) antes de releer." },
    "Relendo medidas das folhas {list}…": { en: "Re-reading measures from sheets {list}…", es: "Releyendo medidas de las hojas {list}…" },
    "Falha ao reler medidas": { en: "Failed to re-read measures", es: "Error al releer medidas" },
    "Medidas atualizadas: {n} códigos lidos": { en: "Measures updated: {n} codes read", es: "Medidas actualizadas: {n} códigos leídos" },
    "Removidas {n} rejeitadas": { en: "Removed {n} rejected", es: "Eliminadas {n} rechazadas" },
    "Nenhuma rejeitada": { en: "None rejected", es: "Ninguna rechazada" },
    "Gerando alta resolução…": { en: "Generating high resolution…", es: "Generando alta resolución…" },
    "Falha na alta resolução": { en: "High resolution failed", es: "Fallo en la alta resolución" },
    "Folha em alta resolução ✓": { en: "Sheet in high resolution ✓", es: "Hoja en alta resolución ✓" },
    "Consolidando…": { en: "Consolidating…", es: "Consolidando…" },
    "Falha ao consolidar": { en: "Failed to consolidate", es: "Error al consolidar" },
    "Cancelado": { en: "Cancelled", es: "Cancelado" },
    "Folha: {page}": { en: "Sheet: {page}", es: "Hoja: {page}" },
    "(sem rótulo)": { en: "(no label)", es: "(sin etiqueta)" },
    "Legenda": { en: "Legend", es: "Leyenda" },
    "Legenda: ligada": { en: "Legend: on", es: "Leyenda: activada" },
    "Legenda: oculta": { en: "Legend: hidden", es: "Leyenda: oculta" },
    "Mostrar/ocultar a legenda das marcas": { en: "Show/hide the marks legend", es: "Mostrar/ocultar la leyenda de las marcas" },
    "Legenda movida": { en: "Legend moved", es: "Leyenda movida" },
    "Legenda redimensionada": { en: "Legend resized", es: "Leyenda redimensionada" },
    "Legenda: posição automática": { en: "Legend: automatic position", es: "Leyenda: posición automática" },
    "{total} marcas ×{mx} = {grand} · {breakdown}": { en: "{total} marks ×{mx} = {grand} · {breakdown}", es: "{total} marcas ×{mx} = {grand} · {breakdown}" },
    "{total} marcas · {breakdown}": { en: "{total} marks · {breakdown}", es: "{total} marcas · {breakdown}" },
    "S/ROTULO": { en: "NO LABEL", es: "S/ETIQUETA" },
    "CV-assistido · {mx} pavimentos": { en: "CV-assisted · {mx} floors", es: "Asistido por CV · {mx} niveles" },
    "CV-assistido": { en: "CV-assisted", es: "Asistido por CV" },
    "QUADRO RESUMO": { en: "SUMMARY TABLE", es: "CUADRO RESUMEN" },
    "{id}  {type}  {width}x{height}  Qtd {qty}": { en: "{id}  {type}  {width}x{height}  Qty {qty}", es: "{id}  {type}  {width}x{height}  Cant {qty}" },
    "Envie um PDF real da planta para gerar a versão marcada.": { en: "Upload a real PDF of the plan to generate the marked version.", es: "Envíe un PDF real del plano para generar la versión marcada." },
    "Não foi possível abrir/marcar o PDF ({e}).": { en: "Could not open/mark the PDF ({e}).", es: "No se pudo abrir/marcar el PDF ({e})." },
    "✓ Planta marcada (PDF) gerada — marcas nas janelas + quadro resumo.": { en: "✓ Marked plan (PDF) generated — marks on windows + summary table.", es: "✓ Plano marcado (PDF) generado — marcas en las ventanas + cuadro resumen." },
    "✓ PDF gerado com o quadro resumo em cada folha (a IA não retornou coordenadas das marcas).": { en: "✓ PDF generated with the summary table on each sheet (the AI did not return mark coordinates).", es: "✓ PDF generado con el cuadro resumen en cada hoja (la IA no devolvió coordenadas de las marcas)." },
    // -- picker --
    'Idioma do documento': { en: 'Document language', es: 'Idioma del documento' },
    'Em qual idioma gerar este documento?': { en: 'In which language to generate this document?', es: '¿En qué idioma generar este documento?' },
  };

  /* ----------------------------------------------------------------- estado */
  function detect() {
    const saved = (function () { try { return localStorage.getItem('fenestra_lang'); } catch (e) { return null; } })();
    if (saved && LANGS.includes(saved)) return saved;
    const nav = (navigator.language || navigator.userLanguage || 'en').slice(0, 2).toLowerCase();
    if (nav === 'pt') return 'pt';
    if (nav === 'es') return 'es';
    return 'en';
  }
  let LANG = detect();
  F.getLang = () => LANG;

  // ---- pacote Framing / Parede + relatórios (pt → en/es) ----
  Object.assign(DICT, {
    '% de ganho — custo vira venda': { en: '% markup — cost becomes sale', es: '% de ganancia — costo se vuelve venta' },
    '(geral)': { en: '(general)', es: '(general)' },
    '(sem piso)': { en: '(no floor)', es: '(sin piso)' },
    '(tipo)': { en: '(type)', es: '(tipo)' },
    'Aberturas': { en: 'Openings', es: 'Aberturas' },
    'Abra a planta (PDF ou imagem) para começar a marcar.': { en: 'Open the plan (PDF or image) to start marking.', es: 'Abre el plano (PDF o imagen) para empezar a marcar.' },
    'Abrindo editor visual…': { en: 'Opening visual editor…', es: 'Abriendo editor visual…' },
    'Abrir planta': { en: 'Open plan', es: 'Abrir plano' },
    'Adicionar imagem / logo': { en: 'Add image / logo', es: 'Añadir imagen / logo' },
    'Adicionar logo': { en: 'Add logo', es: 'Añadir logo' },
    'Altura (ft)': { en: 'Height (ft)', es: 'Altura (ft)' },
    'Análise do proprietário': { en: 'Owner analysis', es: 'Análisis del propietario' },
    'Análise do proprietário — Custo × Venda · CONFIDENCIAL': { en: 'Owner analysis — Cost × Sale · CONFIDENTIAL', es: 'Análisis del propietario — Costo × Venta · CONFIDENCIAL' },
    'Apresentação': { en: 'Introduction', es: 'Presentación' },
    'Arraste para aumentar/diminuir a tabela': { en: 'Drag to resize the table', es: 'Arrastra para redimensionar la tabla' },
    'Arraste para reordenar': { en: 'Drag to reorder', es: 'Arrastra para reordenar' },
    'Assinar Relatórios': { en: 'Subscribe to Reports', es: 'Suscribir Informes' },
    'Assinatura': { en: 'Signature', es: 'Firma' },
    'Biblioteca de relatório indisponível.': { en: 'Report library unavailable.', es: 'Biblioteca de informe no disponible.' },
    'Bitola': { en: 'Gauge', es: 'Calibre' },
    'Bitola (stud)': { en: 'Stud size', es: 'Calibre (stud)' },
    'Blocos': { en: 'Blocks', es: 'Bloques' },
    'Buscar preços (IA)': { en: 'Find prices (AI)', es: 'Buscar precios (IA)' },
    'CUSTO TOTAL': { en: 'TOTAL COST', es: 'COSTO TOTAL' },
    'Cabeçalho / logo': { en: 'Header / logo', es: 'Encabezado / logo' },
    'Centro': { en: 'Center', es: 'Centro' },
    'Chapas': { en: 'Sheets', es: 'Placas' },
    'Componentes (1 por linha — o que está no desenho/nota)': { en: 'Components (1 per line — from the drawing/note)', es: 'Componentes (1 por línea — del dibujo/nota)' },
    'Composição': { en: 'Breakdown', es: 'Composición' },
    'Comprimento': { en: 'Length', es: 'Longitud' },
    'Comprimento real desta linha, em pés (ex.: 10):': { en: 'Actual length of this line, in feet (e.g. 10):', es: 'Longitud real de esta línea, en pies (ej. 10):' },
    'Condições comerciais': { en: 'Commercial terms', es: 'Condiciones comerciales' },
    'Conferência': { en: 'Review', es: 'Revisión' },
    'Confirmar preços': { en: 'Confirm prices', es: 'Confirmar precios' },
    'Cor do texto': { en: 'Text color', es: 'Color de texto' },
    'Cotação': { en: 'Quote', es: 'Cotización' },
    'Cotação ao fornecedor': { en: 'Supplier RFQ', es: 'Cotización al proveedor' },
    'Custo': { en: 'Cost', es: 'Costo' },
    'Dados do cliente': { en: 'Client details', es: 'Datos del cliente' },
    'Dados do cliente / obra': { en: 'Client / project details', es: 'Datos del cliente / obra' },
    'Defina a região do trabalho primeiro.': { en: 'Set the job region first.', es: 'Define la región del trabajo primero.' },
    'Defina a região primeiro.': { en: 'Set the region first.', es: 'Define la región primero.' },
    'Disponível no app de desktop.': { en: 'Available in the desktop app.', es: 'Disponible en la app de escritorio.' },
    'Documento interno — não enviar ao cliente.': { en: 'Internal document — do not send to the client.', es: 'Documento interno — no enviar al cliente.' },
    'Drywall comum': { en: 'Regular drywall', es: 'Drywall común' },
    'Drywall resist. água (WR)': { en: 'Water-resistant drywall (WR)', es: 'Drywall resistente al agua (WR)' },
    'Drywall resistente à água': { en: 'Water-resistant drywall', es: 'Drywall resistente al agua' },
    'Drywall — folhas 4x8': { en: 'Drywall — 4x8 sheets', es: 'Drywall — hojas 4x8' },
    'Duplicar (outro piso)': { en: 'Duplicate (another floor)', es: 'Duplicar (otro piso)' },
    'Editar': { en: 'Edit', es: 'Editar' },
    'Editar p/ resolver': { en: 'Edit to resolve', es: 'Editar para resolver' },
    'Editar tipo / completar especificação': { en: 'Edit type / complete spec', es: 'Editar tipo / completar especificación' },
    'Editar tipo…': { en: 'Edit type…', es: 'Editar tipo…' },
    'Editor de relatório': { en: 'Report editor', es: 'Editor de informe' },
    'Editor visual de relatório': { en: 'Visual report editor', es: 'Editor visual de informe' },
    'Editor visual indisponível.': { en: 'Visual editor unavailable.', es: 'Editor visual no disponible.' },
    'Empresa': { en: 'Company', es: 'Empresa' },
    'Encerramento': { en: 'Closing', es: 'Cierre' },
    'Escopo da obra — quais ofícios o takeoff cobre': { en: 'Job scope — which trades the takeoff covers', es: 'Alcance de la obra — qué oficios cubre el cómputo' },
    'Escopo do serviço': { en: 'Scope of work', es: 'Alcance del trabajo' },
    'Espaç. (in)': { en: 'Spacing (in)', es: 'Espaciado (in)' },
    'Especificação incompleta': { en: 'Incomplete spec', es: 'Especificación incompleta' },
    'Faces (ext/int)': { en: 'Faces (ext/int)', es: 'Caras (ext/int)' },
    'Falha ao carregar o editor visual (precisa de internet).': { en: 'Failed to load the visual editor (internet needed).', es: 'Error al cargar el editor visual (se necesita internet).' },
    'Falha ao iniciar o editor visual.': { en: 'Failed to start the visual editor.', es: 'Error al iniciar el editor visual.' },
    'Falha ao ler a região.': { en: 'Failed to read the region.', es: 'Error al leer la región.' },
    'Fechar editor': { en: 'Close editor', es: 'Cerrar editor' },
    'Ganho %:': { en: 'Markup %:', es: 'Ganancia %:' },
    'Ganho aplicado': { en: 'Markup applied', es: 'Ganancia aplicada' },
    'Gerando planta marcada…': { en: 'Generating marked plan…', es: 'Generando plano marcado…' },
    'Gerar relatórios deste levantamento': { en: 'Generate reports from this takeoff', es: 'Generar informes de este cómputo' },
    'IA busca tamanho + preço da região (você confirma)': { en: 'AI finds size + regional price (you confirm)', es: 'IA busca tamaño + precio de la región (tú confirmas)' },
    'IA buscando tamanhos e preços da região…': { en: 'AI finding regional sizes and prices…', es: 'IA buscando tamaños y precios de la región…' },
    'IA escrevendo o texto da proposta…': { en: 'AI writing the proposal text…', es: 'IA escribiendo el texto de la propuesta…' },
    'IA: ': { en: 'AI: ', es: 'IA: ' },
    'Imagem / Foto / logo': { en: 'Image / Photo / logo', es: 'Imagen / Foto / logo' },
    'Importar': { en: 'Import', es: 'Importar' },
    'Imposto': { en: 'Tax', es: 'Impuesto' },
    'Imposto (sales tax) sobre o material': { en: 'Sales tax on material', es: 'Impuesto (sales tax) sobre el material' },
    'Imposto mat. %:': { en: 'Material tax %:', es: 'Impuesto mat. %:' },
    'Imposto sobre material': { en: 'Tax on material', es: 'Impuesto sobre material' },
    'Imprimir / PDF': { en: 'Print / PDF', es: 'Imprimir / PDF' },
    'Isolamento': { en: 'Insulation', es: 'Aislamiento' },
    'Isolamento (batt)': { en: 'Insulation (batt)', es: 'Aislamiento (batt)' },
    'Itálico': { en: 'Italic', es: 'Cursiva' },
    'LISTA DE MATERIAIS / PEDIDO': { en: 'MATERIAL LIST / ORDER', es: 'LISTA DE MATERIALES / PEDIDO' },
    'Lado externo da parede': { en: 'Exterior wall side', es: 'Lado exterior de la pared' },
    'Lado interno da parede': { en: 'Interior wall side', es: 'Lado interior de la pared' },
    'Larg.(ft)': { en: 'Width (ft)', es: 'Ancho (ft)' },
    'Legenda dos tipos de parede': { en: 'Wall type legend', es: 'Leyenda de tipos de pared' },
    'Leitura da planta só no app desktop.': { en: 'Plan reading only in the desktop app.', es: 'Lectura del plano solo en la app de escritorio.' },
    'Lendo a região da planta…': { en: 'Reading the region from the plan…', es: 'Leyendo la región del plano…' },
    'Ler da planta': { en: 'Read from plan', es: 'Leer del plano' },
    'Ler do carimbo/endereço da planta': { en: 'Read from the plan title block/address', es: 'Leer del cajetín/dirección del plano' },
    'Limpar formatação': { en: 'Clear formatting', es: 'Limpiar formato' },
    'Linear — traçar parede (clique p/ mudar de direção, Esc finaliza)': { en: 'Linear — draw wall (click to change direction, Esc to finish)', es: 'Lineal — trazar pared (clic para cambiar dirección, Esc finaliza)' },
    'Lista de materiais': { en: 'Material list', es: 'Lista de materiales' },
    'Lista numerada': { en: 'Numbered list', es: 'Lista numerada' },
    'Logo / marca': { en: 'Logo / brand', es: 'Logo / marca' },
    'Lucro (Venda − Custo)': { en: 'Profit (Sale − Cost)', es: 'Ganancia (Venta − Costo)' },
    'M.O.': { en: 'Labor', es: 'M.O.' },
    'M.O. $/SF:': { en: 'Labor $/SF:', es: 'M.O. $/SF:' },
    'MATERIAL POR PISO': { en: 'MATERIAL BY FLOOR', es: 'MATERIAL POR PISO' },
    'Madeira': { en: 'Wood', es: 'Madera' },
    'Maior': { en: 'Larger', es: 'Más grande' },
    'Manual': { en: 'Manual', es: 'Manual' },
    'Marcar spec como conferida': { en: 'Mark spec as reviewed', es: 'Marcar spec como revisada' },
    'Margem sobre a venda': { en: 'Margin on sale', es: 'Margen sobre la venta' },
    'Mat.': { en: 'Mat.', es: 'Mat.' },
    'Materiais': { en: 'Materials', es: 'Materiales' },
    'Material $ / sobra %:': { en: 'Material $ / waste %:', es: 'Material $ / merma %:' },
    'Material (com sobra)': { en: 'Material (with waste)', es: 'Material (con merma)' },
    'Material por piso': { en: 'Material by floor', es: 'Material por piso' },
    'Material: madeira ou metal?': { en: 'Material: wood or metal?', es: 'Material: madera o metal?' },
    'Menor': { en: 'Smaller', es: 'Más pequeño' },
    'Metal': { en: 'Metal', es: 'Metal' },
    'Modelo grande demais p/ salvar — reduza/retire fotos (o documento atual segue ok p/ imprimir).': { en: 'Template too large to save — reduce/remove photos (the current document still prints fine).', es: 'Plantilla demasiado grande para guardar — reduce/quita fotos (el documento actual igual imprime bien).' },
    'Modelo padrão': { en: 'Default template', es: 'Plantilla predeterminada' },
    'Modelo salvo': { en: 'Template saved', es: 'Plantilla guardada' },
    'Montante (stud)': { en: 'Stud', es: 'Montante (stud)' },
    'Montantes': { en: 'Studs', es: 'Montantes' },
    'Mão de obra': { en: 'Labor', es: 'Mano de obra' },
    'Negrito': { en: 'Bold', es: 'Negrita' },
    'Nome': { en: 'Name', es: 'Nombre' },
    'Normal': { en: 'Normal', es: 'Normal' },
    'Nova parede': { en: 'New wall', es: 'Nueva pared' },
    'Novo': { en: 'New', es: 'Nuevo' },
    'Nº proposta': { en: 'Proposal #', es: 'N° propuesta' },
    'Não achei o endereço na planta — digite a região.': { en: 'Address not found in the plan — type the region.', es: 'No encontré la dirección en el plano — escribe la región.' },
    'Não consegui buscar preços: ': { en: 'Could not fetch prices: ', es: 'No pude buscar precios: ' },
    'Pesquisa de preços (IA) é um add-on (US$ 10/mês).': { en: 'AI price lookup is an add-on (US$ 10/mo).', es: 'Búsqueda de precios (IA) es un add-on (US$ 10/mes).' },
    'Blocking (linhas)': { en: 'Blocking (rows)', es: 'Blocking (filas)' },
    'Blocking (madeira)': { en: 'Blocking (wood)', es: 'Blocking (madera)' },
    'Bridging (linhas)': { en: 'Bridging (rows)', es: 'Bridging (filas)' },
    'Bridging (metal)': { en: 'Bridging (metal)', es: 'Bridging (metal)' },
    'LF': { en: 'LF', es: 'LF' },
    'Plates (madeira)': { en: 'Plates (wood)', es: 'Plates (madera)' },
    'Plates (nº)': { en: 'Plates (qty)', es: 'Plates (n.º)' },
    'Track (nº)': { en: 'Track (qty)', es: 'Track (n.º)' },
    'Track / Guias (metal)': { en: 'Track (metal)', es: 'Track / rieles (metal)' },
    'Pesquisa de preços (IA)': { en: 'AI price lookup', es: 'Búsqueda de precios (IA)' },
    'A IA busca na web os preços de material da obra e preenche o takeoff — você confirma tudo. Vale pra qualquer obra.': { en: 'AI fetches material prices online for your job and fills the takeoff — you confirm everything. Works on any job.', es: 'La IA busca en la web los precios de material de la obra y llena el cómputo — tú confirmas todo. Vale para cualquier obra.' },
    '/mês por região': { en: '/mo per region', es: '/mes por región' },
    'Escolher regiões': { en: 'Pick regions', es: 'Elegir regiones' },
    'todas as regiões': { en: 'all regions', es: 'todas las regiones' },
    'adicionar região': { en: 'add region', es: 'agregar región' },
    'Dê preço nas obras publicadas: escolha suas regiões e pague 1, 3, 6 ou 12 meses por região. Baixe a planta, levante no app e envie sua proposta.': { en: 'Bid on posted jobs: pick your regions and pay 1, 3, 6 or 12 months per region. Download the plans, take off in the app and send your proposal.', es: 'Da precio a las obras publicadas: elige tus regiones y paga 1, 3, 6 o 12 meses por región. Descarga el plano, computa en la app y envía tu propuesta.' },
    'Dê preço nas obras publicadas: escolha suas regiões, baixe a planta, levante no app e envie sua proposta.': { en: 'Bid on posted jobs: pick your regions, download the plans, take off in the app and send your proposal.', es: 'Da precio a las obras publicadas: elige tus regiones, descarga el plano, computa en la app y envía tu propuesta.' },
    'Preços por região': { en: 'Regional pricing', es: 'Precios por región' },
    'A IA busca na web tamanhos e preços de material da região da obra — você confirma tudo.': { en: 'AI fetches material sizes and prices online for the job\'s region — you confirm everything.', es: 'La IA busca en la web tamaños y precios de material de la región de la obra — tú confirmas todo.' },
    'Obra / endereço': { en: 'Project / address', es: 'Obra / dirección' },
    'Observações': { en: 'Notes', es: 'Observaciones' },
    'Ofício não incluído no seu plano': { en: 'Trade not included in your plan', es: 'Oficio no incluido en tu plan' },
    'Ofício não incluído no seu plano — compre para liberar': { en: 'Trade not in your plan — buy to unlock', es: 'Oficio no incluido en tu plan — compra para desbloquear' },
    'Orçamento': { en: 'Quote', es: 'Cotización' },
    'Orçamento — Framing · Drywall · Insulation · Paint': { en: 'Quote — Framing · Drywall · Insulation · Paint', es: 'Cotización — Framing · Drywall · Insulation · Paint' },
    'PEDIDO DE COTAÇÃO — FORNECEDOR': { en: 'REQUEST FOR QUOTE — SUPPLIER', es: 'SOLICITUD DE COTIZACIÓN — PROVEEDOR' },
    'Padrão': { en: 'Default', es: 'Predeterminado' },
    'Paisagem': { en: 'Landscape', es: 'Horizontal' },
    'Piso': { en: 'Floor', es: 'Piso' },
    'Pisos': { en: 'Floors', es: 'Pisos' },
    'Planta marcada': { en: 'Marked plan', es: 'Plano marcado' },
    'Plate / Track': { en: 'Plate / Track', es: 'Plate / Track' },
    'Plates/Track': { en: 'Plates/Track', es: 'Plates/Track' },
    'Por piso': { en: 'By floor', es: 'Por piso' },
    'Por tipo de parede': { en: 'By wall type', es: 'Por tipo de pared' },
    'Por folha': { en: 'By sheet', es: 'Por hoja' },
    '(sem nível)': { en: '(no level)', es: '(sin nivel)' },
    'MATERIAL POR NÍVEL': { en: 'MATERIAL BY LEVEL', es: 'MATERIAL POR NIVEL' },
    'Piso & Forro': { en: 'Floor & Ceiling', es: 'Piso y Cielo raso' },
    'Proposta — Piso & Forro': { en: 'Proposal — Floor & Ceiling', es: 'Propuesta — Piso y Cielo raso' },
    'folhas': { en: 'sheets', es: 'hojas' },
    'folha': { en: 'sheet', es: 'hoja' },
    '(vão + adicional)': { en: '(opening + add-on)', es: '(vano + adicional)' },
    '(vão + {t})': { en: '(opening + {t})', es: '(vano + {t})' },
    '+ Largura (adicional do projeto)': { en: '+ Width (project add-on)', es: '+ Ancho (adicional del proyecto)' },
    '+ Altura (adicional do projeto)': { en: '+ Height (project add-on)', es: '+ Alto (adicional del proyecto)' },
    '+ Largura': { en: '+ Width', es: '+ Ancho' },
    '+ Altura': { en: '+ Height', es: '+ Alto' },
    'adicional do projeto': { en: 'project add-on', es: 'adicional del proyecto' },
    'Rótulo do adicional': { en: 'Add-on label', es: 'Etiqueta del adicional' },
    'Como o adicional aparece nos rótulos e no relatório (vale para todo o sistema)': { en: 'How the add-on appears in labels and the report (applies system-wide)', es: 'Cómo aparece el adicional en las etiquetas y el informe (vale para todo el sistema)' },
    'pavimentos': { en: 'floors', es: 'pisos' },
    'editável': { en: 'editable', es: 'editable' },
    'larg': { en: 'width', es: 'ancho' },
    'alt': { en: 'height', es: 'alto' },
    'Consolidar tabela': { en: 'Consolidate table', es: 'Consolidar tabla' },
    'Total desta folha': { en: 'Total for this sheet', es: 'Total de esta hoja' },
    'Conte janelas/portas na planta (🔢 Contar / Auto Count) para aparecer aqui.': { en: 'Count windows/doors on the plan (🔢 Count / Auto Count) to see them here.', es: 'Cuenta ventanas/puertas en el plano (🔢 Contar / Auto Count) para verlas aquí.' },
    'Edite Tipo e Medidas aqui; depois clique em Consolidar para gerar o consolidado e os documentos.': { en: 'Edit Type and Sizes here; then click Consolidate to generate the consolidated table and documents.', es: 'Edita Tipo y Medidas aquí; luego haz clic en Consolidar para generar la tabla consolidada y los documentos.' },
    /* --- Ajuda: Trilha 3 — Piso & Forro (fragmentos por nó de texto) --- */
    'O ConstructCount lê a planta arquitetônica e levanta esquadrias, paredes (framing, drywall, insulation e pintura) e áreas de piso e forro — e entrega os documentos prontos. Veja o fluxo completo abaixo.': { en: 'ConstructCount reads the architectural plan and takes off windows/doors, walls (framing, drywall, insulation and paint) and floor and ceiling areas — and delivers the documents ready. See the full flow below.', es: 'ConstructCount lee el plano arquitectónico y computa carpinterías, paredes (framing, drywall, insulation y pintura) y áreas de piso y cielo — y entrega los documentos listos. Mira el flujo completo abajo.' },
    '🟩 Trilha 3 — Piso & Forro': { en: '🟩 Track 3 — Floor & Ceiling', es: '🟩 Ruta 3 — Piso & Cielo' },
    'O fluxo dos pacotes de área: meça o piso e o forro por SF, a IA lê os acabamentos da legenda, e saem os mesmos relatórios da Parede.': { en: 'The flow of the area packages: measure floor and ceiling by SF, the AI reads the finishes from the legend, and you get the same reports as the Wall.', es: 'El flujo de los paquetes de área: mide el piso y el cielo por SF, la IA lee los acabados de la leyenda, y obtienes los mismos informes que la Pared.' },
    '1. Escopo': { en: '1. Scope', es: '1. Alcance' },
    '— em FERRAMENTAS, ligue': { en: '— in TOOLS, enable', es: '— en HERRAMIENTAS, activa' },
    '(verde) e/ou': { en: '(green) and/or', es: '(verde) y/o' },
    '(azul). Cada um é um pacote à parte.': { en: '(blue). Each one is a separate package.', es: '(azul). Cada uno es un paquete aparte.' },
    '2. Meça as áreas': { en: '2. Measure the areas', es: '2. Mide las áreas' },
    '— calibre a escala (📏) e use a ferramenta de': { en: '— calibrate the scale (📏) and use the', es: '— calibra la escala (📏) y usa la herramienta de' },
    ': clique nos cantos do cômodo (duplo-clique fecha) ou': { en: ': click the room corners (double-click closes) or', es: ': haz clic en las esquinas del cuarto (doble clic cierra) o' },
    'com 2 cliques na diagonal.': { en: 'with 2 clicks on the diagonal.', es: 'con 2 clics en la diagonal.' },
    'SHIFT+clique': { en: 'SHIFT+click', es: 'SHIFT+clic' },
    'cria uma área negativa (vermelha) que desconta colunas, escadas e vãos.': { en: 'creates a negative area (red) that subtracts columns, stairs and openings.', es: 'crea un área negativa (roja) que resta columnas, escaleras y vanos.' },
    '3. Acabamentos por IA': { en: '3. Finishes by AI', es: '3. Acabados por IA' },
    '— a IA lê a legenda de acabamentos (FLOOR / CEILING / WALL BASE FINISH LEGEND) e preenche o': { en: '— the AI reads the finish legend (FLOOR / CEILING / WALL BASE FINISH LEGEND) and fills in the', es: '— la IA lee la leyenda de acabados (FLOOR / CEILING / WALL BASE FINISH LEGEND) y completa el' },
    'de cada código (FF-01, VB-2…). Tudo cai na': { en: 'of each code (FF-01, VB-2…). It all lands in', es: 'de cada código (FF-01, VB-2…). Todo cae en' },
    '(⚠️) pra você validar — a IA pergunta, não chuta.': { en: '(⚠️) for you to validate — the AI asks, it does not guess.', es: '(⚠️) para que valides — la IA pregunta, no adivina.' },
    '4. Tag e rodapé': { en: '4. Tag and baseboard', es: '4. Tag y zócalo' },
    '— cada área recebe a': { en: '— each area gets the', es: '— cada área recibe la' },
    'do acabamento (aparece no rótulo). O': { en: 'of the finish (shown on the label). The', es: 'del acabado (aparece en la etiqueta). El' },
    'rodapé (base)': { en: 'baseboard (base)', es: 'zócalo (base)' },
    'tem a sua própria tag (VB-x) e quantidade em': { en: 'has its own tag (VB-x) and quantity in', es: 'tiene su propia tag (VB-x) y cantidad en' },
    '(perímetro do piso × altura).': { en: '(floor perimeter × height).', es: '(perímetro del piso × altura).' },
    '5. Takeoff por folha': { en: '5. Takeoff by sheet', es: '5. Takeoff por hoja' },
    'na barra de status: tabela editável agrupada por': { en: 'on the status bar: an editable table grouped by', es: 'en la barra de estado: tabla editable agrupada por' },
    'nível': { en: 'level', es: 'nivel' },
    '(First Floor, Second Floor…), com preço + sobra % + imposto → Custo → Ganho % → Venda. Defina a': { en: '(First Floor, Second Floor…), with price + waste % + tax → Cost → Markup % → Sale. Set the', es: '(First Floor, Second Floor…), con precio + desperdicio % + impuesto → Costo → Ganancia % → Venta. Define la' },
    'e use 💲 Buscar preços (IA).': { en: 'and use 💲 Fetch prices (AI).', es: 'y usa 💲 Buscar precios (IA).' },
    '6. Relatórios': { en: '6. Reports', es: '6. Informes' },
    '(add-on), o mesmo conjunto da Parede para Piso & Forro: orçamento, lista de materiais, material por nível, cotação ao fornecedor, análise do proprietário, resumo, planta marcada — e os editores (blocos e visual) com escolha do tamanho de papel.': { en: '(add-on), the same set as the Wall for Floor & Ceiling: quote, material list, material by level, supplier RFQ, owner analysis, summary, marked plan — and the editors (blocks and visual) with paper size choice.', es: '(add-on), el mismo conjunto que la Pared para Piso & Cielo: presupuesto, lista de materiales, material por nivel, cotización al proveedor, análisis del propietario, resumen, plano marcado — y los editores (bloques y visual) con elección del tamaño de papel.' },
    'Área (Piso/Forro)': { en: 'Area (Floor/Ceiling)', es: 'Área (Piso/Cielo)' },
    'Meça pisos e forros por SF: clique nos cantos ou use o Retângulo; una várias áreas num só total.': { en: 'Measure floors and ceilings by SF: click the corners or use the Rectangle; merge several areas into one total.', es: 'Mide pisos y cielos por SF: haz clic en las esquinas o usa el Rectángulo; une varias áreas en un solo total.' },
    'Como levanto piso e forro?': { en: 'How do I take off floor and ceiling?', es: '¿Cómo computo piso y cielo?' },
    'Ligue': { en: 'Enable', es: 'Activa' },
    'e/ou': { en: 'and/or', es: 'y/o' },
    'ou': { en: 'or', es: 'o' },
    'no escopo, meça as áreas por SF na planta (ferramenta de Área) e a IA lê os acabamentos da legenda (tipo e fabricante). O rodapé entra com a própria tag (VB-x) em SF. Os relatórios são os mesmos da Parede completa.': { en: 'in the scope, measure the areas by SF on the plan (Area tool) and the AI reads the finishes from the legend (type and manufacturer). The baseboard comes in with its own tag (VB-x) in SF. The reports are the same as the Complete Wall.', es: 'en el alcance, mide las áreas por SF en el plano (herramienta de Área) y la IA lee los acabados de la leyenda (tipo y fabricante). El zócalo entra con su propia tag (VB-x) en SF. Los informes son los mismos que la Pared completa.' },
    'Teto/Forro': { en: 'Ceiling', es: 'Techo/Cielo' },
    'Retângulo': { en: 'Rectangle', es: 'Rectángulo' },
    'Tamanho do papel': { en: 'Paper size', es: 'Tamaño del papel' },
    'Carta (Letter)': { en: 'Letter', es: 'Carta (Letter)' },
    'Ofício (Legal)': { en: 'Legal', es: 'Oficio (Legal)' },
    'Material por nível': { en: 'Material by level', es: 'Material por nivel' },
    'Material por nível (Excel)': { en: 'Material by level (Excel)', es: 'Material por nivel (Excel)' },
    'Preencha o "Preço unit." — o Total calcula sozinho.': { en: 'Fill the "Unit price" — Total computes automatically.', es: 'Completa el "Precio unit." — el Total se calcula solo.' },
    'Preço (USD)': { en: 'Price (USD)', es: 'Precio (USD)' },
    'Preço do material': { en: 'Material price', es: 'Precio del material' },
    'Preço unit.': { en: 'Unit price', es: 'Precio unit.' },
    'Proposta': { en: 'Proposal', es: 'Propuesta' },
    'Proposta — Framing': { en: 'Proposal — Framing', es: 'Propuesta — Framing' },
    'Qtd c/ sobra': { en: 'Qty w/ waste', es: 'Cant. con merma' },
    'Região': { en: 'Region', es: 'Región' },
    'Região:': { en: 'Region:', es: 'Región:' },
    'Região: ': { en: 'Region: ', es: 'Región: ' },
    'Relatório': { en: 'Report', es: 'Informe' },
    'Relatórios': { en: 'Reports', es: 'Informes' },
    'Relatórios é um add-on (US$ 15/mês)': { en: 'Reports is an add-on (US$ 15/mo)', es: 'Informes es un add-on (US$ 15/mes)' },
    'Remover': { en: 'Remove', es: 'Quitar' },
    'Remover bloco': { en: 'Remove block', es: 'Quitar bloque' },
    'Resumo': { en: 'Summary', es: 'Resumen' },
    'Resumo (região + totais)': { en: 'Summary (region + totals)', es: 'Resumen (región + totales)' },
    'Resumo do takeoff': { en: 'Takeoff summary', es: 'Resumen del cómputo' },
    'Resumo do takeoff — Framing': { en: 'Takeoff summary — Framing', es: 'Resumen del cómputo — Framing' },
    'Resumo técnico': { en: 'Technical summary', es: 'Resumen técnico' },
    'Resumo técnico (LF/SF)': { en: 'Technical summary (LF/SF)', es: 'Resumen técnico (LF/SF)' },
    'Retrato': { en: 'Portrait', es: 'Vertical' },
    'Salvar modelo': { en: 'Save template', es: 'Guardar plantilla' },
    'Sem paredes traçadas para o relatório.': { en: 'No walls drawn for the report.', es: 'No hay paredes trazadas para el informe.' },
    'Sheathing (DensGlass/plywood)': { en: 'Sheathing (DensGlass/plywood)', es: 'Sheathing (DensGlass/plywood)' },
    'Sheathing — folhas 4x8': { en: 'Sheathing — 4x8 sheets', es: 'Sheathing — hojas 4x8' },
    'Sobra/perda de material (%)': { en: 'Material waste (%)', es: 'Merma de material (%)' },
    'Stud': { en: 'Stud', es: 'Stud' },
    'Studs': { en: 'Studs', es: 'Studs' },
    'Sublinhado': { en: 'Underline', es: 'Subrayado' },
    'TOTAL': { en: 'TOTAL', es: 'TOTAL' },
    'Tabela de materiais': { en: 'Materials table', es: 'Tabla de materiales' },
    'Tabela do orçamento': { en: 'Quote table', es: 'Tabla de cotización' },
    'Tabela do orçamento (por tipo)': { en: 'Quote table (by type)', es: 'Tabla de cotización (por tipo)' },
    'Takeoff de Framing': { en: 'Framing Takeoff', es: 'Cómputo de Framing' },
    'Takeoff': { en: 'Takeoff', es: 'Cómputo' },
    'Tamanho': { en: 'Size', es: 'Tamaño' },
    'Texto': { en: 'Text', es: 'Texto' },
    'Texto com IA': { en: 'AI text', es: 'Texto con IA' },
    'Texto gerado — revise e edite à vontade.': { en: 'Text generated — review and edit freely.', es: 'Texto generado — revisa y edita a gusto.' },
    'Tinta + primer': { en: 'Paint + primer', es: 'Pintura + primer' },
    'Tipo': { en: 'Type', es: 'Tipo' },
    'Tipo de parede': { en: 'Wall type', es: 'Tipo de pared' },
    'Tipos de parede': { en: 'Wall types', es: 'Tipos de pared' },
    'Tipos — clique p/ ativar e traçar': { en: 'Types — click to activate and draw', es: 'Tipos — clic para activar y trazar' },
    'Totais': { en: 'Totals', es: 'Totales' },
    'Totais (custo → venda)': { en: 'Totals (cost → sale)', es: 'Totales (costo → venta)' },
    'Trace paredes (📐 Linear) e atribua um tipo para o takeoff aparecer aqui.': { en: 'Draw walls (📐 Linear) and assign a type for the takeoff to show here.', es: 'Traza paredes (📐 Lineal) y asigna un tipo para que el cómputo aparezca aquí.' },
    'Trace paredes e atribua tipos antes de montar o relatório.': { en: 'Draw walls and assign types before building the report.', es: 'Traza paredes y asigna tipos antes de armar el informe.' },
    'Travamento': { en: 'Bracing', es: 'Arriostramiento' },
    'Trocar': { en: 'Replace', es: 'Cambiar' },
    'Trocar logo': { en: 'Replace logo', es: 'Cambiar logo' },
    'Título': { en: 'Title', es: 'Título' },
    'Unid.': { en: 'Unit', es: 'Unidad' },
    'Unidade': { en: 'Unit', es: 'Unidad' },
    'VENDA': { en: 'SALE', es: 'VENTA' },
    'VENDA FINAL': { en: 'FINAL SALE', es: 'VENTA FINAL' },
    'Valor': { en: 'Value', es: 'Valor' },
    'Valores estimados em USD. Quantidades levantadas da planta; preços conforme a região.': { en: 'Estimated values in USD. Quantities taken off the plan; prices per region.', es: 'Valores estimados en USD. Cantidades del plano; precios según la región.' },
    'Venda': { en: 'Sale', es: 'Venta' },
    'Verga (header)': { en: 'Header', es: 'Dintel (header)' },
    'Verga/LF': { en: 'Header/LF', es: 'Dintel/LF' },
    'Vergas': { en: 'Headers', es: 'Dinteles' },
    'Vergas (headers)': { en: 'Headers', es: 'Dinteles (headers)' },
    'alinhar': { en: 'align', es: 'alinear' },
    'cidade, estado ou ZIP': { en: 'city, state or ZIP', es: 'ciudad, estado o ZIP' },
    'estimativa IA': { en: 'AI estimate', es: 'estimación IA' },
    'ex.: R-13 / 3½" fiberglass': { en: 'e.g. R-13 / 3½" fiberglass', es: 'ej. R-13 / 3½" fiberglass' },
    'maior': { en: 'larger', es: 'mayor' },
    'menor': { en: 'smaller', es: 'menor' },
    'outra…': { en: 'other…', es: 'otra…' },
    'sem pendências': { en: 'no pending items', es: 'sin pendientes' },
    'todos': { en: 'all', es: 'todos' },
    'Stud': { en: 'Stud', es: 'Stud' },
    'Guia/plate LF': { en: 'Track/plate LF', es: 'Riel/plate LF' },
    'Verga LF': { en: 'Header LF', es: 'Dintel LF' },
    'Chapa': { en: 'Sheet', es: 'Placa' },
    'Duplicar': { en: 'Duplicate', es: 'Duplicar' },
    '• 50% na aprovação · 50% na entrega.<br>• Validade da proposta: 15 dias.<br>• Valores em USD.': { en: '• 50% on approval · 50% on delivery.<br>• Proposal valid for 15 days.<br>• Prices in USD.', es: '• 50% a la aprobación · 50% a la entrega.<br>• Validez de la propuesta: 15 días.<br>• Valores en USD.' }
  });

  Object.assign(DICT, {
    'Linear': { en: 'Linear', es: 'Lineal' },
    'Legenda': { en: 'Legend', es: 'Leyenda' },
    'Voltar': { en: 'Back', es: 'Volver' },
    'Mover': { en: 'Move', es: 'Mover' },
    'Trechos': { en: 'Segments', es: 'Tramos' },
    'Total estimado': { en: 'Estimated total', es: 'Total estimado' },
    'Paredes: total': { en: 'Walls: total', es: 'Paredes: total' },
    'Opcional.': { en: 'Optional.', es: 'Opcional.' },
    'Altura (ft)': { en: 'Height (ft)', es: 'Altura (ft)' },
    'escala calibrada': { en: 'scale calibrated', es: 'escala calibrada' },
    'escala não calibrada': { en: 'scale not calibrated', es: 'escala no calibrada' },
    'Calibre a escala primeiro (📏).': { en: 'Calibrate the scale first (📏).', es: 'Calibra la escala primero (📏).' },
    'Não foi possível abrir o PDF.': { en: 'Could not open the PDF.', es: 'No se pudo abrir el PDF.' },
    'Visualizador de PDF não carregou. Tente novamente.': { en: 'PDF viewer failed to load. Try again.', es: 'El visor de PDF no cargó. Inténtalo de nuevo.' },
    'Nenhum tipo. Clique em + Novo.': { en: 'No types. Click + New.', es: 'Sin tipos. Clic en + Nuevo.' },
    'Traçe paredes na planta ou adicione manual.': { en: 'Draw walls on the plan or add manually.', es: 'Traza paredes en el plano o agrega manualmente.' },
    'Guia/plate (LF)': { en: 'Track/plate (LF)', es: 'Riel/plate (LF)' },
    'Verga (LF)': { en: 'Header (LF)', es: 'Dintel (LF)' },
    'Chapa (un)': { en: 'Sheet (ea)', es: 'Placa (un)' },
    'Montante (un)': { en: 'Stud (ea)', es: 'Montante (un)' },
    'Aberturas': { en: 'Openings', es: 'Aberturas' }
  });

  // ---- aba Pacote (catálogo / showcase) ----
  Object.assign(DICT, {
    'Pacote': { en: 'Package', es: 'Paquete' },
    '📦 Pacotes ConstructCount': { en: '📦 ConstructCount Packages', es: '📦 Paquetes ConstructCount' },
    'Um app,': { en: 'One app,', es: 'Una app,' },
    'vários ofícios': { en: 'many trades', es: 'varios oficios' },
    'Cada pacote é um motor de levantamento por especialidade. Comece pelo de Janelas e Portas — os próximos já estão a caminho.': { en: 'Each package is a takeoff engine for a specialty. Start with Windows & Doors — more are on the way.', es: 'Cada paquete es un motor de cómputo por especialidad. Empieza con Ventanas y Puertas — los próximos ya vienen.' },
    'Verificando assinatura…': { en: 'Checking subscription…', es: 'Verificando suscripción…' },
    'Assinatura ativa': { en: 'Subscription active', es: 'Suscripción activa' },
    'Assinatura cortesia · sem vencimento': { en: 'Courtesy subscription · no expiry', es: 'Suscripción cortesía · sin vencimiento' },
    'Sem assinatura ativa — assine ou ative sua chave': { en: 'No active subscription — subscribe or activate your key', es: 'Sin suscripción activa — suscríbete o activa tu clave' },
    'Pacote disponível': { en: 'Available package', es: 'Paquete disponible' },
    'Pronto para usar hoje.': { en: 'Ready to use today.', es: 'Listo para usar hoy.' },
    '🟢 Disponível': { en: '🟢 Available', es: '🟢 Disponible' },
    'Janelas ': { en: 'Windows ', es: 'Ventanas ' },
    'e Portas': { en: '& Doors', es: 'y Puertas' },
    'Levante esquadrias direto da planta — leitura por IA, contagem, medidas e documentos prontos.': { en: 'Take off windows & doors straight from the plans — AI reading, counting, sizes and ready documents.', es: 'Computa carpinterías directo del plano — lectura por IA, conteo, medidas y documentos listos.' },
    'Cobrança mensal em dólar (USD) · cancele quando quiser': { en: 'Monthly billing in USD · cancel anytime', es: 'Cobro mensual en USD · cancela cuando quieras' },
    'Assinar agora': { en: 'Subscribe now', es: 'Suscribirse ahora' },
    'Já tenho uma chave': { en: 'I have a key', es: 'Ya tengo una clave' },
    'Já tenho a chave': { en: 'I have the key', es: 'Ya tengo la clave' },
    '🤖 Leitura por IA do PDF do projeto': { en: '🤖 AI reading of the project PDF', es: '🤖 Lectura por IA del PDF del proyecto' },
    '📐 Takeoff automático pelo schedule': { en: '📐 Automatic takeoff from the schedule', es: '📐 Cómputo automático desde el schedule' },
    '🪟 Todos os tipos + Twin (conta ×2)': { en: '🪟 All types + Twin (counts ×2)', es: '🪟 Todos los tipos + Twin (cuenta ×2)' },
    '🏢 Pavimentos× e Resumo editável': { en: '🏢 Floors× and editable summary', es: '🏢 Pisos× y resumen editable' },
    '🔀 Split de folhas lado a lado': { en: '🔀 Side-by-side sheet split', es: '🔀 División de hojas lado a lado' },
    '📄 Orçamento, Pedido, Proposta e Planta Marcada': { en: '📄 Quote, Order, Proposal and Marked Plan', es: '📄 Cotización, Pedido, Propuesta y Plano Marcado' },
    '🎨 Documentos com a sua marca': { en: '🎨 Documents with your brand', es: '🎨 Documentos con tu marca' },
    '🔄 Atualizações e novos recursos': { en: '🔄 Updates and new features', es: '🔄 Actualizaciones y nuevas funciones' },
    'Por ofício ': { en: 'By trade ', es: 'Por oficio ' },
    'Compre só o que você usa — ou leve o combo abaixo com desconto.': { en: 'Buy only what you use — or get the combo below at a discount.', es: 'Compra solo lo que usas — o lleva el combo de abajo con descuento.' },
    'Montantes, plates, track, vergas e sheathing.': { en: 'Studs, plates, track, headers and sheathing.', es: 'Montantes, plates, track, dinteles y sheathing.' },
    'Board comum e resistente à água, chapas 4x8.': { en: 'Regular and water-resistant board, 4x8 sheets.', es: 'Placa común y resistente al agua, hojas 4x8.' },
    'Área de cavidade isolada por SF.': { en: 'Insulated cavity area by SF.', es: 'Área de cavidad aislada por SF.' },
    'Pintura de parede por SF (tape, spackle, paint).': { en: 'Wall paint by SF (tape, spackle, paint).', es: 'Pintura de pared por SF (tape, spackle, paint).' },
    'Assinar': { en: 'Subscribe', es: 'Suscribirse' },
    'Ativo': { en: 'Active', es: 'Activo' },
    '🟢 Ativo no seu plano': { en: '🟢 Active in your plan', es: '🟢 Activo en tu plan' },
    '🏗️ Parede completa': { en: '🏗️ Complete wall', es: '🏗️ Pared completa' },
    '🏗️ Pacote estrutural': { en: '🏗️ Structural package', es: '🏗️ Paquete estructural' },
    'Parede completa': { en: 'Complete wall', es: 'Pared completa' },
    'Parede ': { en: 'Complete ', es: 'Pared ' },
    'completa': { en: 'wall', es: 'completa' },
    'Os 4 ofícios juntos, com desconto. ': { en: 'All 4 trades together, at a discount. ', es: 'Los 4 oficios juntos, con descuento. ' },
    'Melhor valor.': { en: 'Best value.', es: 'Mejor valor.' },
    'Estimativa de parede por IA, do framing à pintura. Meça na planta (ou deixe a IA detectar), a IA lê os tipos de parede do projeto, e você sai com quantidades, custo e preço de venda — pronto pra mandar o orçamento.': { en: 'AI wall estimating, from framing to paint. Measure on the plan (or let the AI detect), the AI reads the project wall types, and you get quantities, cost and sale price — ready to send the quote.', es: 'Estimación de pared por IA, del framing a la pintura. Mide en el plano (o deja que la IA detecte), la IA lee los tipos de pared del proyecto, y obtienes cantidades, costo y precio de venta — listo para enviar la cotización.' },
    'Combo dos 4 ofícios · ou compre por ofício à parte · cobrança mensal em USD · cancele quando quiser': { en: 'Combo of the 4 trades · or buy by trade separately · monthly billing in USD · cancel anytime', es: 'Combo de los 4 oficios · o compra por oficio aparte · cobro mensual en USD · cancela cuando quieras' },
    '🎁 7 dias grátis': { en: '🎁 7-day free trial', es: '🎁 7 días gratis' },
    '🎁 7 dias grátis — sem cartão': { en: '🎁 7 days free — no card', es: '🎁 7 días gratis — sin tarjeta' },
    'Testar 7 dias grátis': { en: 'Try 7 days free', es: 'Probar 7 días gratis' },
    'Assinar Parede completa': { en: 'Subscribe to Complete wall', es: 'Suscribir Pared completa' },
    'Abrir takeoff': { en: 'Open takeoff', es: 'Abrir cómputo' },
    '🏗️🧱🧊🎨 4 ofícios na mesma parede: Framing · Drywall · Insulation · Paint': { en: '🏗️🧱🧊🎨 4 trades on the same wall: Framing · Drywall · Insulation · Paint', es: '🏗️🧱🧊🎨 4 oficios en la misma pared: Framing · Drywall · Insulation · Paint' },
    '🧠 IA lê os tipos de parede do projeto (A301) — material, montante, plates, gypsum, isolamento': { en: '🧠 AI reads the project wall types (A301) — material, stud, plates, gypsum, insulation', es: '🧠 La IA lee los tipos de pared del proyecto (A301) — material, montante, plates, gypsum, aislamiento' },
    '📏 Medição Linear na planta + ✨ detectar paredes (IA) · altura por piso (A302)': { en: '📏 Linear measuring on the plan + ✨ detect walls (AI) · height per floor (A302)', es: '📏 Medición Lineal en el plano + ✨ detectar paredes (IA) · altura por piso (A302)' },
    '🧩 Parede de 2 faces: DensGlass externo · drywall comum ou resistente à água (banheiro)': { en: '🧩 Two-face wall: exterior DensGlass · regular or water-resistant drywall (bathroom)', es: '🧩 Pared de 2 caras: DensGlass exterior · drywall común o resistente al agua (baño)' },
    '🔩 Montantes, guias/track, plates, vergas, sheathing e folhas 4x8': { en: '🔩 Studs, track, plates, headers, sheathing and 4x8 sheets', es: '🔩 Montantes, track, plates, dinteles, sheathing y hojas 4x8' },
    '💲 Material + mão de obra + sobra % + imposto → Custo → Ganho % → Venda': { en: '💲 Material + labor + waste % + tax → Cost → Markup % → Sale', es: '💲 Material + mano de obra + merma % + impuesto → Costo → Ganancia % → Venta' },
    '📍 Preço por região (IA busca na web, você confirma) · tudo em USD': { en: '📍 Regional pricing (AI searches the web, you confirm) · all in USD', es: '📍 Precio por región (la IA busca en la web, tú confirmas) · todo en USD' },
    'add-on à parte': { en: 'separate add-on', es: 'add-on aparte' },
    'Recurso extra que você liga em qualquer pacote.': { en: 'Extra feature you turn on in any package.', es: 'Función extra que activas en cualquier paquete.' },
    'Orçamento, materiais, pedido ao fornecedor, planta marcada + editores (blocos e visual) + texto por IA.': { en: 'Quote, materials, supplier order, marked plan + editors (blocks and visual) + AI text.', es: 'Cotización, materiales, pedido al proveedor, plano marcado + editores (bloques y visual) + texto por IA.' },
    'Próximos pacotes': { en: 'Coming next', es: 'Próximos paquetes' },
    'Mais ofícios chegando ao ConstructCount.': { en: 'More trades coming to ConstructCount.', es: 'Más oficios llegando a ConstructCount.' },
    'Em breve': { en: 'Soon', es: 'Pronto' },
    'Pisos & Revestimentos': { en: 'Floors & Finishes', es: 'Pisos y Revestimientos' },
    'Área, rodapés e perdas por cômodo.': { en: 'Area, baseboards and waste per room.', es: 'Área, zócalos y merma por ambiente.' },
    'Elétrica': { en: 'Electrical', es: 'Eléctrica' },
    'Pontos, circuitos, eletrodutos e quadros.': { en: 'Devices, circuits, conduit and panels.', es: 'Puntos, circuitos, tubería y tableros.' },
    'Hidráulica': { en: 'Plumbing', es: 'Plomería' },
    'Pontos de água/esgoto, conexões e metragem.': { en: 'Water/sewer points, fittings and footage.', es: 'Puntos de agua/desagüe, conexiones y metraje.' }
  });

  // ---- varredura geral: mensagens dinâmicas + tooltips (workspace, framing, licença) ----
  Object.assign(DICT, {
    '(automático)': { en: '(automatic)', es: '(automático)' },
    '(do schedule)': { en: '(from schedule)', es: '(del schedule)' },
    '(medida manual)': { en: '(manual measure)', es: '(medida manual)' },
    '(sem rótulo)': { en: '(no label)', es: '(sin etiqueta)' },
    'A IA não encontrou nenhuma prancha de tipos de parede (wall type details) neste projeto.': { en: 'AI did not find any wall type details sheet in this project.', es: 'La IA no encontró ninguna lámina de tipos de pared (wall type details) en este proyecto.' },
    'A IA não encontrou um quadro de esquadrias neste PDF; carreguei um exemplo para editar.': { en: 'AI did not find a window/door schedule in this PDF; I loaded an example to edit.', es: 'La IA no encontró un cuadro de carpinterías en este PDF; cargué un ejemplo para editar.' },
    'Abra um projeto e consolide o levantamento antes de gerar este documento.': { en: 'Open a project and consolidate the takeoff before generating this document.', es: 'Abre un proyecto y consolida el cómputo antes de generar este documento.' },
    'Abra uma folha primeiro': { en: 'Open a sheet first', es: 'Abre una hoja primero' },
    'Abra uma folha primeiro.': { en: 'Open a sheet first.', es: 'Abre una hoja primero.' },
    'Abrir': { en: 'Open', es: 'Abrir' },
    'Adicionar piso': { en: 'Add floor', es: 'Añadir piso' },
    'Altura do piso em pés (ex.: 9.1, 10):': { en: 'Floor height in feet (e.g. 9.1, 10):', es: 'Altura del piso en pies (ej. 9.1, 10):' },
    'Altura do piso — medidas lidas pela IA (A302)': { en: 'Floor height — sizes read by AI (A302)', es: 'Altura del piso — medidas leídas por la IA (A302)' },
    "Apaga TODAS as marcas do código selecionado na lista (clique num código em 'Marcas desta folha')": { en: "Deletes ALL marks of the code selected in the list (click a code in 'Marks on this sheet')", es: "Borra TODAS las marcas del código seleccionado en la lista (clic en un código en 'Marcas de esta hoja')" },
    'Apaga as folhas selecionadas (clique / Ctrl / Shift)': { en: 'Deletes the selected sheets (click / Ctrl / Shift)', es: 'Borra las hojas seleccionadas (clic / Ctrl / Shift)' },
    'Apagada': { en: 'Deleted', es: 'Borrada' },
    'Apagar esta folha e tudo nela?': { en: 'Delete this sheet and everything on it?', es: '¿Borrar esta hoja y todo en ella?' },
    'Aparece na fachada mas não na planta.': { en: 'Appears in the elevation but not in the plan.', es: 'Aparece en la fachada pero no en el plano.' },
    'Aparece na planta mas não na fachada.': { en: 'Appears in the plan but not in the elevation.', es: 'Aparece en el plano pero no en la fachada.' },
    'Aplica a altura do piso ativo às PAREDES selecionadas.': { en: 'Applies the active floor height to the selected WALLS.', es: 'Aplica la altura del piso activo a las PAREDES seleccionadas.' },
    'Aplica o tipo selecionado (acima) às PAREDES selecionadas na planta. Selecione as linhas e clique aqui.': { en: 'Applies the selected type (above) to the selected WALLS on the plan. Select the lines and click here.', es: 'Aplica el tipo seleccionado (arriba) a las PAREDES seleccionadas en el plano. Selecciona las líneas y haz clic aquí.' },
    'Assinatura não autorizada': { en: 'Subscription not authorized', es: 'Suscripción no autorizada' },
    'Ativar / trocar licença': { en: 'Activate / change license', es: 'Activar / cambiar licencia' },
    'Ativar este tipo': { en: 'Activate this type', es: 'Activar este tipo' },
    'Ativar licença': { en: 'Activate license', es: 'Activar licencia' },
    'Ative o ConstructCount': { en: 'Activate ConstructCount', es: 'Activa ConstructCount' },
    'Atualizar folha': { en: 'Refresh sheet', es: 'Actualizar hoja' },
    'Auto Count': { en: 'Auto Count', es: 'Auto Count' },
    'Auto Count disponível no app de desktop.': { en: 'Auto Count available in the desktop app.', es: 'Auto Count disponible en la app de escritorio.' },
    'Auto Count: clique numa marca de amostra e ele acha todas as iguais na folha. Ou ARRASTE uma caixa (começando numa marca) pra contar só dentro dela.': { en: 'Auto Count: click a sample mark and it finds all alike on the sheet. Or DRAG a box (starting on a mark) to count only inside it.', es: 'Auto Count: haz clic en una marca de muestra y encuentra todas iguales en la hoja. O ARRASTRA una caja (empezando en una marca) para contar solo dentro.' },
    'Auto Count: nada encontrado': { en: 'Auto Count: nothing found', es: 'Auto Count: nada encontrado' },
    'Auto Count…': { en: 'Auto Count…', es: 'Auto Count…' },
    'Buscando dimensões do schedule…': { en: 'Fetching schedule dimensions…', es: 'Buscando dimensiones del schedule…' },
    'Cada especialidade (trade) é uma camada sobre a planta. As novas marcas entram na camada ATIVA.': { en: 'Each trade is a layer over the plan. New marks go into the ACTIVE layer.', es: 'Cada especialidad (trade) es una capa sobre el plano. Las nuevas marcas entran en la capa ACTIVA.' },
    'Calibre (📏) → Traçe a parede (🧱): clique pra mudar de direção · Esc/Enter finaliza · Backspace desfaz ponto · roda = zoom.': { en: 'Calibrate (📏) → Draw the wall (🧱): click to change direction · Esc/Enter finishes · Backspace undoes point · wheel = zoom.', es: 'Calibra (📏) → Traza la pared (🧱): clic para cambiar dirección · Esc/Enter finaliza · Backspace deshace punto · rueda = zoom.' },
    'Calibre a escala primeiro (📏 Calibrar escala).': { en: 'Calibrate the scale first (📏 Calibrate scale).', es: 'Calibra la escala primero (📏 Calibrar escala).' },
    'Camada excluída': { en: 'Layer deleted', es: 'Capa eliminada' },
    'Cancelado': { en: 'Cancelled', es: 'Cancelado' },
    'Carregando projetos…': { en: 'Loading projects…', es: 'Cargando proyectos…' },
    'Clique no 2º ponto…': { en: 'Click the 2nd point…', es: 'Haz clic en el 2º punto…' },
    'Colar como este tipo': { en: 'Paste as this type', es: 'Pegar como este tipo' },
    'Colar paredes': { en: 'Paste walls', es: 'Pegar paredes' },
    'Configurações salvas.': { en: 'Settings saved.', es: 'Configuración guardada.' },
    'Consolidando…': { en: 'Consolidating…', es: 'Consolidando…' },
    'Copiar paredes': { en: 'Copy walls', es: 'Copiar paredes' },
    'Defina ANTES de levantar: quais ofícios esta estimativa cobre. A mesma parede gera quantidades para cada escopo ligado.': { en: 'Set BEFORE taking off: which trades this estimate covers. The same wall produces quantities for each scope turned on.', es: 'Define ANTES de computar: qué oficios cubre esta estimación. La misma pared genera cantidades para cada alcance activado.' },
    'Deletar folha': { en: 'Delete sheet', es: 'Borrar hoja' },
    'Deletar paredes deste tipo': { en: 'Delete walls of this type', es: 'Borrar paredes de este tipo' },
    'Desfeito ↶': { en: 'Undone ↶', es: 'Deshecho ↶' },
    'Desmarcar p/ apagar': { en: 'Unmark for delete', es: 'Desmarcar para borrar' },
    'Detecção de paredes disponível no app de desktop.': { en: 'Wall detection available in the desktop app.', es: 'Detección de paredes disponible en la app de escritorio.' },
    'Digite a chave de licença.': { en: 'Enter the license key.', es: 'Ingresa la clave de licencia.' },
    'Disponível apenas no app de desktop (motor local).': { en: 'Available only in the desktop app (local engine).', es: 'Disponible solo en la app de escritorio (motor local).' },
    'Dividir: ver uma 2ª folha ao lado': { en: 'Split: view a 2nd sheet side by side', es: 'Dividir: ver una 2ª hoja al lado' },
    'Duplicar paredes': { en: 'Duplicate walls', es: 'Duplicar paredes' },
    'Duplo-clique p/ ocultar/mostrar este tipo': { en: 'Double-click to hide/show this type', es: 'Doble clic para ocultar/mostrar este tipo' },
    'Duplo-clique: ocultar/mostrar todas as cores desta folha': { en: 'Double-click: hide/show all colors on this sheet', es: 'Doble clic: ocultar/mostrar todos los colores de esta hoja' },
    'Editando…': { en: 'Editing…', es: 'Editando…' },
    'Envie um PDF real da planta para gerar a versão marcada.': { en: 'Send a real plan PDF to generate the marked version.', es: 'Envía un PDF real del plano para generar la versión marcada.' },
    'Escala não calibrada — os comprimentos sairão zerados. Detectar mesmo assim?': { en: 'Scale not calibrated — lengths will be zero. Detect anyway?', es: 'Escala no calibrada — las longitudes saldrán en cero. ¿Detectar igual?' },
    'Escolha um tipo na caixa Tipo: primeiro': { en: 'Choose a type in the Type: box first', es: 'Elige un tipo en la casilla Tipo: primero' },
    'Estimativa IA': { en: 'AI estimate', es: 'Estimación IA' },
    'Excluir': { en: 'Delete', es: 'Eliminar' },
    'Excluir item': { en: 'Delete item', es: 'Eliminar elemento' },
    'Expandir todas': { en: 'Expand all', es: 'Expandir todas' },
    'Falha ao apagar folhas': { en: 'Failed to delete sheets', es: 'Error al borrar hojas' },
    'Falha ao consolidar': { en: 'Failed to consolidate', es: 'Error al consolidar' },
    'Falha ao reler medidas': { en: 'Failed to re-read measures', es: 'Error al releer medidas' },
    'Falha ao restaurar': { en: 'Failed to restore', es: 'Error al restaurar' },
    'Falha ao salvar': { en: 'Failed to save', es: 'Error al guardar' },
    'Falha na alta resolução': { en: 'High-resolution failed', es: 'Error en alta resolución' },
    'Falha na detecção de paredes': { en: 'Wall detection failed', es: 'Error en la detección de paredes' },
    'Falha na leitura dos tipos de parede': { en: 'Failed to read wall types', es: 'Error al leer los tipos de pared' },
    'Falha no Auto Count': { en: 'Auto Count failed', es: 'Error en Auto Count' },
    'Fazendo backup… (pode levar um momento em projetos grandes)': { en: 'Backing up… (may take a moment on large projects)', es: 'Haciendo respaldo… (puede tardar en proyectos grandes)' },
    'Fechar 2ª folha': { en: 'Close 2nd sheet', es: 'Cerrar 2ª hoja' },
    'Folha em alta resolução ✓': { en: 'High-resolution sheet ✓', es: 'Hoja en alta resolución ✓' },
    'Folhas 4x8': { en: '4x8 sheets', es: 'Hojas 4x8' },
    'Gerando alta resolução…': { en: 'Generating high resolution…', es: 'Generando alta resolución…' },
    'IA: detecta as linhas de parede da folha e cria os traços Linear na camada ativa. Você revisa e apaga as erradas (clique + Del).': { en: 'AI: detects the wall lines on the sheet and creates Linear traces in the active layer. You review and delete the wrong ones (click + Del).', es: 'IA: detecta las líneas de pared de la hoja y crea los trazos Lineales en la capa activa. Tú revisas y borras las erróneas (clic + Del).' },
    'IA: lê o detalhe de tipo de parede desta folha (wall type detail) e cria as assemblies — montante, espaçamento, plates, gypsum, isolamento — automaticamente.': { en: 'AI: reads the wall type detail on this sheet and creates the assemblies — stud, spacing, plates, gypsum, insulation — automatically.', es: 'IA: lee el detalle de tipo de pared de esta hoja y crea los ensamblajes — montante, espaciado, plates, gypsum, aislamiento — automáticamente.' },
    'IA: nenhum tipo de parede encontrado no projeto': { en: 'AI: no wall type found in the project', es: 'IA: ningún tipo de pared encontrado en el proyecto' },
    'IA: nenhuma parede detectada nesta folha': { en: 'AI: no wall detected on this sheet', es: 'IA: ninguna pared detectada en esta hoja' },
    'Importando takeoff…': { en: 'Importing takeoff…', es: 'Importando cómputo…' },
    'Informe medida ou tipo': { en: 'Enter size or type', es: 'Indica medida o tipo' },
    'Insira a chave de licença fornecida pela M2PB para usar o aplicativo.': { en: 'Enter the license key provided by M2PB to use the app.', es: 'Ingresa la clave de licencia provista por M2PB para usar la app.' },
    'Insira a chave de licença fornecida pela M2PB.': { en: 'Enter the license key provided by M2PB.', es: 'Ingresa la clave de licencia provista por M2PB.' },
    'Ir para esta folha': { en: 'Go to this sheet', es: 'Ir a esta hoja' },
    'LF total': { en: 'Total LF', es: 'LF total' },
    'Legenda movida': { en: 'Legend moved', es: 'Leyenda movida' },
    'Legenda redimensionada': { en: 'Legend resized', es: 'Leyenda redimensionada' },
    'Legenda: ligada': { en: 'Legend: on', es: 'Leyenda: activada' },
    'Legenda: oculta': { en: 'Legend: hidden', es: 'Leyenda: oculta' },
    'Legenda: posição automática': { en: 'Legend: automatic position', es: 'Leyenda: posición automática' },
    'Lendo a planta — motor local (PDF grande pode levar ~1 min)': { en: 'Reading the plan — local engine (large PDF may take ~1 min)', es: 'Leyendo el plano — motor local (PDF grande puede tardar ~1 min)' },
    'Licença não autorizada': { en: 'License not authorized', es: 'Licencia no autorizada' },
    'Linear: traço contínuo de vários pontos na CAMADA ativa (clique p/ mudar de direção, Esc/Enter finaliza, Backspace desfaz). Precisa calibrar a escala. Usado por Framing e outros pacotes.': { en: 'Linear: continuous multi-point trace on the ACTIVE layer (click to change direction, Esc/Enter finishes, Backspace undoes). Requires scale calibration. Used by Framing and other packages.', es: 'Lineal: trazo continuo de varios puntos en la CAPA activa (clic para cambiar dirección, Esc/Enter finaliza, Backspace deshace). Requiere calibrar la escala. Usado por Framing y otros paquetes.' },
    'Linha(s) apagada(s)': { en: 'Line(s) deleted', es: 'Línea(s) borrada(s)' },
    'Marca na planta sem dimensão no quadro de tipos.': { en: 'Mark on the plan with no dimension in the type schedule.', es: 'Marca en el plano sin dimensión en el cuadro de tipos.' },
    'Marcar p/ apagar': { en: 'Mark for delete', es: 'Marcar para borrar' },
    'Marque ao menos uma folha como medidas (botão 📐) antes de reler.': { en: 'Mark at least one sheet as measures (📐 button) before re-reading.', es: 'Marca al menos una hoja como medidas (botón 📐) antes de releer.' },
    'Marque folhas com 🗑 na lista primeiro': { en: 'Mark sheets with 🗑 in the list first', es: 'Marca hojas con 🗑 en la lista primero' },
    'Medida movida': { en: 'Measure moved', es: 'Medida movida' },
    'Medidas limpas': { en: 'Measures cleared', es: 'Medidas borradas' },
    '▱ Área (rápida)': { en: '▱ Area (quick)', es: '▱ Área (rápida)' },
    'Área: {sf} SF': { en: 'Area: {sf} SF', es: 'Área: {sf} SF' },
    'Área apagada': { en: 'Area deleted', es: 'Área eliminada' },
    'Área editada': { en: 'Area edited', es: 'Área editada' },
    '🧠 Ler escopo da folha de medidas': { en: '🧠 Read scope from the schedule sheet', es: '🧠 Leer alcance de la hoja de medidas' },
    'IA leu do escopo: ': { en: 'AI read from scope: ', es: 'IA leyó del alcance: ' },
    'Nada lido — defina o escopo e marque a folha de medidas (📐).': { en: 'Nothing read — set the scope and mark the schedule sheet (📐).', es: 'Nada leído — define el alcance y marca la hoja de medidas (📐).' },
    'Acabamentos lidos da folha de medidas:': { en: 'Finishes read from the schedule sheet:', es: 'Acabados leídos de la hoja de medidas:' },
    'tipos de parede ({n})': { en: 'wall types ({n})', es: 'tipos de pared ({n})' },
    'alturas ({n})': { en: 'heights ({n})', es: 'alturas ({n})' },
    'piso ({n})': { en: 'floor ({n})', es: 'piso ({n})' },
    'forro ({n})': { en: 'ceiling ({n})', es: 'cielo ({n})' },
    'base ({n})': { en: 'base ({n})', es: 'zócalo ({n})' },
    'Base': { en: 'Base', es: 'Zócalo' },
    'Piso / Forro': { en: 'Floor / Ceiling', es: 'Piso / Cielo' },
    'Forro': { en: 'Ceiling', es: 'Cielo' },
    '📊 Takeoff de Piso/Forro': { en: '📊 Floor/Ceiling Takeoff', es: '📊 Cómputo de Piso/Cielo' },
    'Parede': { en: 'Wall', es: 'Pared' },
    'Janelas e Portas': { en: 'Windows & Doors', es: 'Ventanas y Puertas' },
    'Disciplina do takeoff': { en: 'Takeoff discipline', es: 'Disciplina del cómputo' },
    'Pacotes atualizados': { en: 'Packages updated', es: 'Paquetes actualizados' },
    'Sobra': { en: 'Waste', es: 'Merma' },
    'ITEM': { en: 'ITEM', es: 'ÍTEM' },
    'Tipo de material': { en: 'Material type', es: 'Tipo de material' },
    'Fabricante': { en: 'Manufacturer', es: 'Fabricante' },
    'Subtotal': { en: 'Subtotal', es: 'Subtotal' },
    'Tag': { en: 'Tag', es: 'Tag' },
    'Nível': { en: 'Level', es: 'Nivel' },
    'Disciplina': { en: 'Discipline', es: 'Disciplina' },
    'IA busca o preço por região de cada material (você confirma)': { en: 'AI searches the regional price of each material (you confirm)', es: 'La IA busca el precio por región de cada material (tú confirmas)' },
    'Sem acabamentos para precificar (leia o escopo).': { en: 'No finishes to price (read the scope).', es: 'Sin acabados para cotizar (lee el alcance).' },
    '{n} preço(s) estimado(s)': { en: '{n} price(s) estimated', es: '{n} precio(s) estimado(s)' },
    'Planta marcada — Piso & Forro · {s}': { en: 'Marked plan — Floor & Ceiling · {s}', es: 'Plano marcado — Piso & Cielo · {s}' },
    'tipo': { en: 'type', es: 'tipo' },
    'fabricante': { en: 'manufacturer', es: 'fabricante' },
    'Nível/pavimento (lido do projeto)': { en: 'Level/floor (read from the project)', es: 'Nivel/piso (leído del proyecto)' },
    'Duplo-clique p/ ocultar/mostrar este acabamento': { en: 'Double-click to hide/show this finish', es: 'Doble clic para ocultar/mostrar este acabado' },
    'Ativar este acabamento': { en: 'Activate this finish', es: 'Activar este acabado' },
    'Selecionar áreas deste acabamento': { en: 'Select areas of this finish', es: 'Seleccionar áreas de este acabado' },
    'Abrir Takeoff': { en: 'Open Takeoff', es: 'Abrir Cómputo' },
    'Editar acabamento (tipo/fabricante)': { en: 'Edit finish (type/manufacturer)', es: 'Editar acabado (tipo/fabricante)' },
    'Deletar áreas deste acabamento': { en: 'Delete areas of this finish', es: 'Eliminar áreas de este acabado' },
    'Apagar as {n} área(s) deste acabamento nesta folha?': { en: 'Delete the {n} area(s) of this finish on this sheet?', es: '¿Eliminar las {n} área(s) de este acabado en esta hoja?' },
    'níveis ({n})': { en: 'levels ({n})', es: 'niveles ({n})' },
    'Conferir acabamentos (tipo / fabricante)': { en: 'Review finishes (type / manufacturer)', es: 'Revisar acabados (tipo / fabricante)' },
    'A IA lê da folha de medidas; confira e corrija o que precisar. Salvo no projeto e usado nos relatórios.': { en: 'AI reads from the measure sheet; review and fix as needed. Saved in the project and used in reports.', es: 'La IA lee de la hoja de medidas; revisa y corrige lo necesario. Guardado en el proyecto y usado en los informes.' },
    'Acabamentos salvos': { en: 'Finishes saved', es: 'Acabados guardados' },
    'Adicionar': { en: 'Add', es: 'Añadir' },
    'Código': { en: 'Code', es: 'Código' },
    'Nenhum acabamento. Leia o escopo ou adicione manualmente.': { en: 'No finishes. Read the scope or add manually.', es: 'Sin acabados. Lee el alcance o añade manualmente.' },
    'ex.: Porcelanato 12x24': { en: 'e.g. Porcelain tile 12x24', es: 'ej. Porcelanato 12x24' },
    'ex.: Daltile': { en: 'e.g. Daltile', es: 'ej. Daltile' },
    'Projeto (Piso & Forro)': { en: 'Project (Floor & Ceiling)', es: 'Proyecto (Piso & Cielo)' },
    'Resumo do projeto — Piso & Forro': { en: 'Project summary — Floor & Ceiling', es: 'Resumen del proyecto — Piso & Cielo' },
    'Piso & Forro — Folha {s}': { en: 'Floor & Ceiling — Sheet {s}', es: 'Piso & Cielo — Hoja {s}' },
    'Folha {s} · Piso: {f} SF · Forro: {c} SF': { en: 'Sheet {s} · Floor: {f} SF · Ceiling: {c} SF', es: 'Hoja {s} · Piso: {f} SF · Cielo: {c} SF' },
    'Folha {s} — Venda: {v}': { en: 'Sheet {s} — Sale: {v}', es: 'Hoja {s} — Venta: {v}' },
    'Meça áreas de Piso/Forro para gerar o relatório.': { en: 'Measure Floor/Ceiling areas to generate the report.', es: 'Mide áreas de Piso/Cielo para generar el informe.' },
    'Orçamento — Piso & Forro': { en: 'Quote — Floor & Ceiling', es: 'Presupuesto — Piso & Cielo' },
    'Resumo do takeoff — Piso & Forro': { en: 'Takeoff summary — Floor & Ceiling', es: 'Resumen del cómputo — Piso & Cielo' },
    'Valores em USD. Quantidades levantadas da planta; sobra de material aplicada.': { en: 'Values in USD. Quantities taken from the plan; material waste applied.', es: 'Valores en USD. Cantidades tomadas del plano; merma de material aplicada.' },
    'Custo total: {c}': { en: 'Total cost: {c}', es: 'Costo total: {c}' },
    'Piso: {f} SF · Forro: {c} SF · sobra {w}% · imposto {t}% · ganho {g}%': { en: 'Floor: {f} SF · Ceiling: {c} SF · waste {w}% · tax {t}% · markup {g}%', es: 'Piso: {f} SF · Cielo: {c} SF · merma {w}% · impuesto {t}% · ganancia {g}%' },
    'VALOR DE VENDA: {v}': { en: 'SALE VALUE: {v}', es: 'VALOR DE VENTA: {v}' },
    '📄 Orçamento ao cliente (PDF)': { en: '📄 Client quote (PDF)', es: '📄 Presupuesto al cliente (PDF)' },
    '📊 Resumo do takeoff (PDF)': { en: '📊 Takeoff summary (PDF)', es: '📊 Resumen del cómputo (PDF)' },
    '📦 Lista de materiais / Pedido (Excel)': { en: '📦 Materials list / Order (Excel)', es: '📦 Lista de materiales / Pedido (Excel)' },
    '📊 Resumo por pacote': { en: '📊 Summary by package', es: '📊 Resumen por paquete' },
    'Abrir no Takeoff': { en: 'Open in Takeoff', es: 'Abrir en el Cómputo' },
    'Total geral': { en: 'Grand total', es: 'Total general' },
    'base': { en: 'base', es: 'base' },
    'marcas': { en: 'marks', es: 'marcas' },
    'sem traços': { en: 'no lines', es: 'sin trazos' },
    'alt.': { en: 'h.', es: 'alt.' },
    'Sem dados ainda.': { en: 'No data yet.', es: 'Sin datos aún.' },
    'Editar parede': { en: 'Edit wall', es: 'Editar pared' },
    'Abrir Relatórios': { en: 'Open Reports', es: 'Abrir Informes' },
    'Nenhuma disciplina no seu plano.': { en: 'No discipline in your plan.', es: 'Ninguna disciplina en tu plan.' },
    'Preços, tipos e mão de obra da Parede ficam no painel detalhado.': { en: 'Wall prices, types and labor are in the detailed panel.', es: 'Precios, tipos y mano de obra de la Pared están en el panel detallado.' },
    'Esquadrias (Janelas e Portas) são contadas com a ferramenta 🔢 Contar / Auto Count.': { en: 'Openings (Windows & Doors) are counted with the 🔢 Count / Auto Count tool.', es: 'Las aberturas (Ventanas y Puertas) se cuentan con la herramienta 🔢 Contar / Auto Count.' },
    'O consolidado e os documentos saem na Central de Relatórios.': { en: 'The consolidated list and documents come from the Reports Hub.', es: 'El consolidado y los documentos salen de la Central de Informes.' },
    'Rodapé (base)': { en: 'Base (baseboard)', es: 'Zócalo (base)' },
    'Rodapé': { en: 'Base', es: 'Zócalo' },
    'Qtd': { en: 'Qty', es: 'Cant' },
    'Un': { en: 'Unit', es: 'Un' },
    'Preço un.': { en: 'Unit price', es: 'Precio un.' },
    'Custo': { en: 'Cost', es: 'Costo' },
    'Venda': { en: 'Sale', es: 'Venta' },
    'Imposto': { en: 'Tax', es: 'Impuesto' },
    'Ganho': { en: 'Markup', es: 'Ganancia' },
    'Meça áreas de {k} (ferramenta ▱ Área) para aparecer aqui.': { en: 'Measure {k} areas (▱ Area tool) to show here.', es: 'Mide áreas de {k} (herramienta ▱ Área) para que aparezcan aquí.' },
    'janelas/portas ({n})': { en: 'windows/doors ({n})', es: 'ventanas/puertas ({n})' },
    'Ponto removido': { en: 'Point removed', es: 'Punto eliminado' },
    'Ponto adicionado': { en: 'Point added', es: 'Punto añadido' },
    'Piso': { en: 'Floor', es: 'Piso' },
    'Teto': { en: 'Ceiling', es: 'Techo' },
    'Teto / Forro': { en: 'Ceiling', es: 'Techo / Cielo' },
    'Tipo de área:': { en: 'Area type:', es: 'Tipo de área:' },
    '▱ Piso': { en: '▱ Floor', es: '▱ Piso' },
    '▱ Forro': { en: '▱ Ceiling', es: '▱ Cielo' },
    '✨ Detectar cômodo (1 clique)': { en: '✨ Detect room (1 click)', es: '✨ Detectar habitación (1 clic)' },
    '✨ Detectar cômodo (marcar)': { en: '✨ Detect rooms (mark)', es: '✨ Detectar habitaciones (marcar)' },
    '✨ Detectar': { en: '✨ Detect', es: '✨ Detectar' },
    'Detectar {n} cômodo(s)': { en: 'Detect {n} room(s)', es: 'Detectar {n} habitación(es)' },
    '✨ IA detectando o cômodo…': { en: '✨ AI detecting the room…', es: '✨ IA detectando la habitación…' },
    '✨ IA detectando {n} cômodo(s)…': { en: '✨ AI detecting {n} room(s)…', es: '✨ IA detectando {n} habitación(es)…' },
    '{ok} cômodo(s) detectado(s)': { en: '{ok} room(s) detected', es: '{ok} habitación(es) detectada(s)' },
    '{f} falhou(aram)': { en: '{f} failed', es: '{f} falló(aron)' },
    'Marque os cômodos com cliques primeiro.': { en: 'Mark the rooms with clicks first.', es: 'Marca las habitaciones con clics primero.' },
    'Falha ao detectar os cômodos.': { en: 'Failed to detect the rooms.', es: 'Error al detectar las habitaciones.' },
    '✨ Varinha: clique nos cômodos e depois Detectar': { en: '✨ Wand: click the rooms then Detect', es: '✨ Varita: haz clic en las habitaciones y luego Detectar' },
    'Varinha de cômodo: desligada': { en: 'Room wand: off', es: 'Varita de habitación: apagada' },
    'Falha ao detectar o cômodo.': { en: 'Failed to detect the room.', es: 'Error al detectar la habitación.' },
    'Não consegui delimitar o cômodo — desenhe manual.': { en: "Couldn't outline the room — draw it manually.", es: 'No pude delimitar la habitación — dibújala manual.' },
    'Detectar cômodo: disponível no app desktop.': { en: 'Detect room: available in the desktop app.', es: 'Detectar habitación: disponible en la app de escritorio.' },
    '{n} área(s) selecionada(s) · Del p/ apagar': { en: '{n} area(s) selected · Del to delete', es: '{n} área(s) seleccionada(s) · Supr para borrar' },
    '{n} áreas apagadas': { en: '{n} areas deleted', es: '{n} áreas eliminadas' },
    '🔗 Unir áreas (1 só)': { en: '🔗 Merge areas (into 1)', es: '🔗 Unir áreas (en 1)' },
    '⇧ Shift+clique = negativo (desconta)': { en: '⇧ Shift+click = negative (subtracts)', es: '⇧ Shift+clic = negativo (descuenta)' },
    '▭ Retângulo (2 cliques)': { en: '▭ Rectangle (2 clicks)', es: '▭ Rectángulo (2 clics)' },
    '▭ Retângulo: clique 2 cantos na diagonal': { en: '▭ Rectangle: click 2 diagonal corners', es: '▭ Rectángulo: haz clic en 2 esquinas diagonales' },
    'Retângulo: desligado': { en: 'Rectangle: off', es: 'Rectángulo: apagado' },
    '{n} áreas unidas → {sf} SF': { en: '{n} areas merged → {sf} SF', es: '{n} áreas unidas → {sf} SF' },
    'Selecione 2+ áreas para unir (ou tenha 2+ do mesmo tipo na folha).': { en: 'Select 2+ areas to merge (or have 2+ of the same type on the sheet).', es: 'Selecciona 2+ áreas para unir (o ten 2+ del mismo tipo en la hoja).' },
    '{pkg} é um pacote à parte (US$ 12/mês) — assine na aba Pacote para liberar.': { en: '{pkg} is a separate package (US$ 12/mo) — subscribe on the Package tab to unlock.', es: '{pkg} es un paquete aparte (US$ 12/mes) — suscríbelo en la pestaña Paquete para desbloquear.' },
    'Meça algo no desenho primeiro': { en: 'Measure something on the drawing first', es: 'Mide algo en el dibujo primero' },
    'Modo de reconhecimento do projeto — clique para mudar': { en: 'Project recognition mode — click to change', es: 'Modo de reconocimiento del proyecto — clic para cambiar' },
    'Mostrar (cor)': { en: 'Show (color)', es: 'Mostrar (color)' },
    'Mostrar todas as cores': { en: 'Show all colors', es: 'Mostrar todos los colores' },
    'Mostrar/ocultar': { en: 'Show/hide', es: 'Mostrar/ocultar' },
    'Mostrar/ocultar a legenda das marcas': { en: 'Show/hide the marks legend', es: 'Mostrar/ocultar la leyenda de marcas' },
    'Mudar cor': { en: 'Change color', es: 'Cambiar color' },
    'Nada para apagar': { en: 'Nothing to delete', es: 'Nada que borrar' },
    'Nada para desfazer': { en: 'Nothing to undo', es: 'Nada que deshacer' },
    'Nenhum projeto encontrado para a busca.': { en: 'No project found for the search.', es: 'Ningún proyecto encontrado para la búsqueda.' },
    'Nenhuma folha de medidas marcada.': { en: 'No measure sheet marked.', es: 'Ninguna hoja de medidas marcada.' },
    'Nenhuma marca confirmada nesta folha.': { en: 'No confirmed marks on this sheet.', es: 'Ninguna marca confirmada en esta hoja.' },
    'Nenhuma marca confirmada no projeto.': { en: 'No confirmed marks in the project.', es: 'Ninguna marca confirmada en el proyecto.' },
    'Nenhuma marca confirmada.': { en: 'No confirmed marks.', es: 'Ninguna marca confirmada.' },
    'Nenhuma rejeitada': { en: 'None rejected', es: 'Ninguna rechazada' },
    'Nome da nova camada (ex.: Drywall, Framing…):': { en: 'New layer name (e.g. Drywall, Framing…):', es: 'Nombre de la nueva capa (ej. Drywall, Framing…):' },
    'Nome da nova seção (ex.: Janelas, Portas, Storefront, Pav 3):': { en: 'New section name (e.g. Windows, Doors, Storefront, Floor 3):', es: 'Nombre de la nueva sección (ej. Ventanas, Puertas, Storefront, Piso 3):' },
    'Nome do piso (ex.: 2nd Floor):': { en: 'Floor name (e.g. 2nd Floor):', es: 'Nombre del piso (ej. 2nd Floor):' },
    'Novo nome do tipo:': { en: 'New type name:', es: 'Nuevo nombre del tipo:' },
    'Não consegui carregar o projeto.': { en: 'Could not load the project.', es: 'No pude cargar el proyecto.' },
    'Não dá para apagar a última camada.': { en: 'Cannot delete the last layer.', es: 'No se puede borrar la última capa.' },
    'Não foi possível ler o arquivo.': { en: 'Could not read the file.', es: 'No se pudo leer el archivo.' },
    'Não foi possível verificar a assinatura agora.': { en: 'Could not verify the subscription now.', es: 'No se pudo verificar la suscripción ahora.' },
    'O que o ConstructCount faz': { en: 'What ConstructCount does', es: 'Qué hace ConstructCount' },
    'Ocultar (cor)': { en: 'Hide (color)', es: 'Ocultar (color)' },
    'Ordenar FOLHAS por': { en: 'Sort SHEETS by', es: 'Ordenar HOJAS por' },
    'Ordenar TIPOS por': { en: 'Sort TYPES by', es: 'Ordenar TIPOS por' },
    'Ortho (tecla O): trava a medida em horizontal/vertical': { en: 'Ortho (key O): locks the measure to horizontal/vertical', es: 'Ortho (tecla O): fija la medida en horizontal/vertical' },
    'Ortho: desligado': { en: 'Ortho: off', es: 'Ortho: apagado' },
    'Ortho: ligado': { en: 'Ortho: on', es: 'Ortho: activado' },
    'Paredes apagadas': { en: 'Walls deleted', es: 'Paredes borradas' },
    'Piso 1': { en: 'Floor 1', es: 'Piso 1' },
    'Piso ATIVO — a parede que você traçar herda a ALTURA deste piso (LF × altura = SF). Pegue a altura na A302.': { en: 'ACTIVE floor — the wall you draw inherits this floor HEIGHT (LF × height = SF). Get the height from A302.', es: 'Piso ACTIVO — la pared que traces hereda la ALTURA de este piso (LF × altura = SF). Toma la altura de A302.' },
    'Primeiro clique num código na lista "Marcas desta folha" para selecioná-lo.': { en: 'First click a code in the "Marks on this sheet" list to select it.', es: 'Primero haz clic en un código de la lista "Marcas de esta hoja" para seleccionarlo.' },
    'QUADRO RESUMO': { en: 'SUMMARY TABLE', es: 'CUADRO RESUMEN' },
    'Reabrindo projeto…': { en: 'Reopening project…', es: 'Reabriendo proyecto…' },
    'Recolher todas': { en: 'Collapse all', es: 'Contraer todas' },
    'Reconhecer marcas: nas folhas SELECIONADAS (se houver seleção) ou em todas': { en: 'Recognize marks: on SELECTED sheets (if any) or on all', es: 'Reconocer marcas: en las hojas SELECCIONADAS (si hay) o en todas' },
    'Renomear': { en: 'Rename', es: 'Renombrar' },
    'Renomear tipo': { en: 'Rename type', es: 'Renombrar tipo' },
    'Reprocessar': { en: 'Reprocess', es: 'Reprocesar' },
    'Restaurar as marcas desta folha do backup? Isso desfaz o último Reconhecer nesta folha.': { en: 'Restore this sheet marks from backup? This undoes the last Recognize on this sheet.', es: '¿Restaurar las marcas de esta hoja del respaldo? Esto deshace el último Reconocer en esta hoja.' },
    'Restaurar marcas desta folha (desfaz o último Reconhecer)': { en: 'Restore this sheet marks (undoes the last Recognize)', es: 'Restaurar marcas de esta hoja (deshace el último Reconocer)' },
    'Resumo da marcação (tabela editável)': { en: 'Marking summary (editable table)', es: 'Resumen de marcado (tabla editable)' },
    'Rótulo da marca:': { en: 'Mark label:', es: 'Etiqueta de la marca:' },
    'Salvo ✓': { en: 'Saved ✓', es: 'Guardado ✓' },
    'Selecione paredes na planta primeiro': { en: 'Select walls on the plan first', es: 'Selecciona paredes en el plano primero' },
    'Selecione uma ou mais paredes na planta primeiro': { en: 'Select one or more walls on the plan first', es: 'Selecciona una o más paredes en el plano primero' },
    'Sem backup para esta folha': { en: 'No backup for this sheet', es: 'Sin respaldo para esta hoja' },
    'Sem medidas': { en: 'No measures', es: 'Sin medidas' },
    'Seção excluída': { en: 'Section deleted', es: 'Sección eliminada' },
    'Seção renomeada': { en: 'Section renamed', es: 'Sección renombrada' },
    'Snap (tecla S): gruda o clique no ponto notável mais próximo': { en: 'Snap (key S): snaps the click to the nearest notable point', es: 'Snap (tecla S): pega el clic al punto notable más cercano' },
    'Snap: desligado': { en: 'Snap: off', es: 'Snap: apagado' },
    'Snap: ligado': { en: 'Snap: on', es: 'Snap: activado' },
    'Takeoff de Framing indisponível.': { en: 'Framing Takeoff unavailable.', es: 'Cómputo de Framing no disponible.' },
    'Takeoff de Framing: parts e preço a partir dos traços Linear desta camada': { en: 'Framing Takeoff: parts and price from the Linear traces in this layer', es: 'Cómputo de Framing: partes y precio a partir de los trazos Lineales de esta capa' },
    'Takeoff vazio ou inválido.': { en: 'Empty or invalid takeoff.', es: 'Cómputo vacío o inválido.' },
    'Tipo de framing ATIVO — a parede que você traçar (Linear/Detectar) entra neste tipo, com a cor dele.': { en: 'ACTIVE framing type — the wall you draw (Linear/Detect) goes into this type, with its color.', es: 'Tipo de framing ACTIVO — la pared que traces (Lineal/Detectar) entra en este tipo, con su color.' },
    'Tipo definido no quadro mas sem marca na planta.': { en: 'Type defined in the schedule but with no mark on the plan.', es: 'Tipo definido en el cuadro pero sin marca en el plano.' },
    'Validando…': { en: 'Validating…', es: 'Validando…' },
    'Zoom +': { en: 'Zoom +', es: 'Zoom +' },
    'Zoom −': { en: 'Zoom −', es: 'Zoom −' },
    'código (A→Z)': { en: 'code (A→Z)', es: 'código (A→Z)' },
    'desmarcar': { en: 'unmark', es: 'desmarcar' },
    'folha de medidas': { en: 'measure sheet', es: 'hoja de medidas' },
    'nome (A→Z)': { en: 'name (A→Z)', es: 'nombre (A→Z)' },
    'nº da folha': { en: 'sheet #', es: 'n° de hoja' },
    'nº de marcas': { en: '# of marks', es: 'n° de marcas' },
    'nº do tipo (1, 2, 2A…)': { en: 'type # (1, 2, 2A…)', es: 'n° de tipo (1, 2, 2A…)' },
    'não calibrada': { en: 'not calibrated', es: 'no calibrada' },
    'quantidade': { en: 'quantity', es: 'cantidad' },
    'resposta inválida do servidor': { en: 'invalid server response', es: 'respuesta inválida del servidor' },
    'selecionar': { en: 'select', es: 'seleccionar' },
    'sem conexão com o servidor de licença': { en: 'no connection to the license server', es: 'sin conexión con el servidor de licencias' },
    'sem conexão e carência expirada': { en: 'no connection and grace period expired', es: 'sin conexión y periodo de gracia vencido' },
    'sem medida no schedule': { en: 'no size in schedule', es: 'sin medida en el schedule' },
    'CV-assistido': { en: 'CV-assisted', es: 'asistido por CV' },
    'Lados chapa': { en: 'Board sides', es: 'Lados placa' },
    '🗑 Apagar selecionada': { en: '🗑 Delete selected', es: '🗑 Borrar seleccionada' },
    '✨ IA: detectando paredes…': { en: '✨ AI: detecting walls…', es: '✨ IA: detectando paredes…' },
    '🧠 IA: lendo os tipos de parede desta folha…': { en: '🧠 AI: reading the wall types on this sheet…', es: '🧠 IA: leyendo los tipos de pared de esta hoja…' },
    'Formato não reconhecido — lendo com IA de visão (nuvem)…': { en: 'Format not recognized — reading with vision AI (cloud)…', es: 'Formato no reconocido — leyendo con IA de visión (nube)…' },
    '🔄 Atualização do app disponível — baixe a nova versão no portal (constructcount.com).': { en: '🔄 App update available — download the new version at the portal (constructcount.com).', es: '🔄 Actualización de la app disponible — descarga la nueva versión en el portal (constructcount.com).' },
    '📐 ✓ Folha de medidas': { en: '📐 ✓ Measure sheet', es: '📐 ✓ Hoja de medidas' }
  });

  // ---- HTML estático: labels, botões e FAQ (frases inteiras) ----
  Object.assign(DICT, {
    'Camadas': { en: 'Layers', es: 'Capas' },
    'Começar agora': { en: 'Get started', es: 'Empezar ahora' },
    'Como ativo minha licença?': { en: 'How do I activate my license?', es: '¿Cómo activo mi licencia?' },
    'Concreto & Fundação': { en: 'Concrete & Foundation', es: 'Concreto y Cimentación' },
    'Geral': { en: 'General', es: 'General' },
    'Escopo da obra': { en: 'Job scope', es: 'Alcance de la obra' },
    'Folha:': { en: 'Sheet:', es: 'Hoja:' },
    'Piso:': { en: 'Floor:', es: 'Piso:' },
    'Tipo:': { en: 'Type:', es: 'Tipo:' },
    '2ª folha:': { en: '2nd sheet:', es: '2ª hoja:' },
    'Prévia:': { en: 'Preview:', es: 'Vista previa:' },
    'Pedido': { en: 'Order', es: 'Pedido' },
    'Salvar janela (medida + tipo)': { en: 'Save window (size + type)', es: 'Guardar ventana (medida + tipo)' },
    'Marca / Relatórios': { en: 'Brand / Reports', es: 'Marca / Informes' },
    'Idioma e unidade': { en: 'Language and unit', es: 'Idioma y unidad' },
    'Perguntas frequentes': { en: 'FAQ', es: 'Preguntas frecuentes' },
    'Sobre a assinatura': { en: 'About the subscription', es: 'Sobre la suscripción' },
    'Licença & Direitos': { en: 'License & Rights', es: 'Licencia y Derechos' },
    'Tipos + Twin': { en: 'Types + Twin', es: 'Tipos + Twin' },
    'Resumo editável': { en: 'Editable summary', es: 'Resumen editable' },
    'Relatórios prontos': { en: 'Ready reports', es: 'Informes listos' },
    'Leitura por IA': { en: 'AI reading', es: 'Lectura por IA' },
    'Takeoff automático': { en: 'Automatic takeoff', es: 'Cómputo automático' },
    'Direto do schedule': { en: 'Straight from the schedule', es: 'Directo del schedule' },
    'Do PDF ao orçamento em minutos': { en: 'From PDF to quote in minutes', es: 'Del PDF a la cotización en minutos' },
    'Dois tipos de PDF': { en: 'Two PDF types', es: 'Dos tipos de PDF' },
    'Em 3 passos': { en: 'In 3 steps', es: 'En 3 pasos' },
    'Passo a passo': { en: 'Step by step', es: 'Paso a paso' },
    'Pronto pra começar?': { en: 'Ready to start?', es: '¿Listo para empezar?' },
    'Pronto pra levantar a próxima obra?': { en: 'Ready to take off your next project?', es: '¿Listo para computar tu próxima obra?' },
    'Salve e reabra sem reprocessar': { en: 'Save and reopen without reprocessing', es: 'Guarda y reabre sin reprocesar' },
    'Seus projetos ficam salvos': { en: 'Your projects are saved', es: 'Tus proyectos quedan guardados' },
    'Simples assim, do arquivo ao orçamento.': { en: 'Just like that, from file to quote.', es: 'Así de simple, del archivo a la cotización.' },
    'Tudo que ele faz': { en: 'Everything it does', es: 'Todo lo que hace' },
    'Confira e ajuste': { en: 'Review and adjust', es: 'Revisa y ajusta' },
    'Confira o takeoff no workspace': { en: 'Review the takeoff in the workspace', es: 'Revisa el cómputo en el workspace' },
    'Gere os documentos': { en: 'Generate the documents', es: 'Genera los documentos' },
    'Ajuste tipos e medidas': { en: 'Adjust types and sizes', es: 'Ajusta tipos y medidas' },
    'Split de folhas': { en: 'Sheet split', es: 'División de hojas' },
    'PDF com texto (vetorial)': { en: 'PDF with text (vector)', es: 'PDF con texto (vectorial)' },
    'PDF escaneado (imagem)': { en: 'Scanned PDF (image)', es: 'PDF escaneado (imagen)' },
    'Casement, de correr, fixa e Twin (geminada que conta ×2).': { en: 'Casement, sliding, fixed and Twin (paired, counts ×2).', es: 'Casement, corredera, fija y Twin (geminada, cuenta ×2).' },
    'Funciona offline?': { en: 'Does it work offline?', es: '¿Funciona sin conexión?' },
    'Sim, com um período de carência. O app revalida a licença quando você reconecta.': { en: 'Yes, with a grace period. The app revalidates the license when you reconnect.', es: 'Sí, con un periodo de gracia. La app revalida la licencia cuando te reconectas.' },
    'Meus projetos ficam salvos onde?': { en: 'Where are my projects saved?', es: '¿Dónde se guardan mis proyectos?' },
    'Posso cancelar?': { en: 'Can I cancel?', es: '¿Puedo cancelar?' },
    'Sim, a qualquer momento. Você mantém o acesso até o fim do período pago.': { en: 'Yes, anytime. You keep access until the end of the paid period.', es: 'Sí, en cualquier momento. Mantienes el acceso hasta el fin del periodo pagado.' },
    'Preciso converter o PDF antes?': { en: 'Do I need to convert the PDF first?', es: '¿Necesito convertir el PDF antes?' },
    'Não. Envie o PDF original do projeto — o motor cuida da leitura.': { en: 'No. Send the original project PDF — the engine handles the reading.', es: 'No. Envía el PDF original del proyecto — el motor se encarga de la lectura.' },
    'Já tenho o takeoff pronto. Posso usar?': { en: 'I already have the takeoff ready. Can I use it?', es: 'Ya tengo el cómputo listo. ¿Puedo usarlo?' },
    'E se a IA errar uma medida ou tipo?': { en: 'What if the AI gets a size or type wrong?', es: '¿Y si la IA se equivoca en una medida o tipo?' },
    'Quando o schedule é imagem, o OCR ajuda, mas convém conferir. Você completa tipo e medida no Resumo — rápido e seguro.': { en: 'When the schedule is an image, OCR helps, but it is worth checking. You complete type and size in the Summary — fast and safe.', es: 'Cuando el schedule es imagen, el OCR ayuda, pero conviene revisar. Completas tipo y medida en el Resumen — rápido y seguro.' },
    'Multiplica a contagem pelo número de andares iguais.': { en: 'Multiplies the count by the number of identical floors.', es: 'Multiplica el conteo por el número de pisos iguales.' },
    'Lê o PDF do projeto e extrai janelas e portas automaticamente.': { en: 'Reads the project PDF and extracts windows and doors automatically.', es: 'Lee el PDF del proyecto y extrae ventanas y puertas automáticamente.' },
    'Liga/desliga a legenda fixada no desenho (acompanha zoom e movimento).': { en: 'Toggles the legend pinned on the drawing (follows zoom and pan).', es: 'Activa/desactiva la leyenda fijada en el dibujo (sigue zoom y movimiento).' },
    'Medições retas e encaixe nos pontos, para marcações precisas.': { en: 'Straight measurements and point snapping, for precise marking.', es: 'Mediciones rectas y enganche a puntos, para marcado preciso.' },
    'Interface e documentos em três idiomas.': { en: 'Interface and documents in three languages.', es: 'Interfaz y documentos en tres idiomas.' },
    'Conta e dimensiona por tipo, usando o schedule do projeto.': { en: 'Counts and sizes by type, using the project schedule.', es: 'Cuenta y dimensiona por tipo, usando el schedule del proyecto.' },
    'Volume, fôrma e aço por elemento.': { en: 'Volume, formwork and rebar per element.', es: 'Volumen, encofrado y acero por elemento.' },
    'Início ▸ Novo projeto': { en: 'Home ▸ New project', es: 'Inicio ▸ Nuevo proyecto' },
    'Novo projeto (PDF)': { en: 'New project (PDF)', es: 'Nuevo proyecto (PDF)' },
    'Abra o PDF': { en: 'Open the PDF', es: 'Abre el PDF' },
    'Abra o projeto (PDF)': { en: 'Open the project (PDF)', es: 'Abre el proyecto (PDF)' },
    'Abra uma planta e veja o takeoff aparecer na hora.': { en: 'Open a plan and watch the takeoff appear instantly.', es: 'Abre un plano y mira el cómputo aparecer al instante.' },
    'Abra uma planta e veja o takeoff aparecer.': { en: 'Open a plan and watch the takeoff appear.', es: 'Abre un plano y mira el cómputo aparecer.' },
    'O ConstructCount lê a planta arquitetônica, conta e dimensiona as esquadrias e entrega os documentos prontos. Veja o fluxo completo abaixo.': { en: 'ConstructCount reads the architectural plan, counts and sizes the windows & doors and delivers ready documents. See the full flow below.', es: 'ConstructCount lee el plano arquitectónico, cuenta y dimensiona las carpinterías y entrega los documentos listos. Mira el flujo completo abajo.' },
    'O ConstructCount lê o PDF do projeto, conta e dimensiona janelas e portas automaticamente e entrega os documentos prontos — com a sua marca.': { en: 'ConstructCount reads the project PDF, counts and sizes windows and doors automatically and delivers ready documents — with your brand.', es: 'ConstructCount lee el PDF del proyecto, cuenta y dimensiona ventanas y puertas automáticamente y entrega los documentos listos — con tu marca.' },
    'O motor lê o texto embutido e monta a tabela de esquadrias direto, com tipos e medidas do schedule.': { en: 'The engine reads the embedded text and builds the window/door table directly, with types and sizes from the schedule.', es: 'El motor lee el texto incrustado y arma la tabla de carpinterías directo, con tipos y medidas del schedule.' },
    'Tabela editável com a contagem geral — corrija tipo e medida sem sair da folha.': { en: 'Editable table with the overall count — fix type and size without leaving the sheet.', es: 'Tabla editable con el conteo general — corrige tipo y medida sin salir de la hoja.' },
    'Veja as marcas na planta e corrija tipos e medidas no Resumo.': { en: 'See the marks on the plan and fix types and sizes in the Summary.', es: 'Mira las marcas en el plano y corrige tipos y medidas en el Resumen.' },
    'Painel à direita mostra e edita o tipo e a medida da marca atual.': { en: 'Panel on the right shows and edits the type and size of the current mark.', es: 'El panel a la derecha muestra y edita el tipo y la medida de la marca actual.' },
    'Corrige o tipo e a medida direto na tabela do rodapé.': { en: 'Fix the type and size right in the bottom table.', es: 'Corrige el tipo y la medida directo en la tabla inferior.' },
    'Do reconhecimento na planta até o documento final — num fluxo só.': { en: 'From recognition on the plan to the final document — in one flow.', es: 'Del reconocimiento en el plano al documento final — en un solo flujo.' },
    'Duas folhas lado a lado pra comparar (planta × schedule).': { en: 'Two sheets side by side to compare (plan × schedule).', es: 'Dos hojas lado a lado para comparar (plano × schedule).' },
    'Duas folhas ao mesmo tempo, no menu PÁGINAS — compare planta e schedule.': { en: 'Two sheets at once, in the PAGES menu — compare plan and schedule.', es: 'Dos hojas a la vez, en el menú PÁGINAS — compara plano y schedule.' },
    'Alterne PT · EN · ES e m² / ft² na aba Configurações — vale também nos documentos.': { en: 'Switch PT · EN · ES and m² / ft² in Settings — applies to documents too.', es: 'Cambia PT · EN · ES y m² / ft² en Configuración — también aplica a los documentos.' },
    'Aparece no cabeçalho de todos os relatórios (Orçamento, Pedido Fornecedor, Quadro Resumo). Fica salvo neste computador.': { en: 'Appears in the header of every report (Quote, Supplier Order, Summary Table). Saved on this computer.', es: 'Aparece en el encabezado de cada informe (Cotización, Pedido Proveedor, Cuadro Resumen). Se guarda en esta computadora.' },
    'remover logo': { en: 'remove logo', es: 'quitar logo' },
    '🎨 Marca dos relatórios': { en: '🎨 Reports brand', es: '🎨 Marca de los informes' },
    '✨ Detectar paredes (IA)': { en: '✨ Detect walls (AI)', es: '✨ Detectar paredes (IA)' },
    '📐 Linear (contínuo)': { en: '📐 Linear (continuous)', es: '📐 Lineal (continuo)' },
    '🧠 Ler tipos de parede (IA)': { en: '🧠 Read wall types (AI)', es: '🧠 Leer tipos de pared (IA)' },
    '🏷️ Legenda': { en: '🏷️ Legend', es: '🏷️ Leyenda' },
    '💾 Fazer backup (.zip)': { en: '💾 Back up (.zip)', es: '💾 Respaldar (.zip)' },
    '📁 Abrir pasta': { en: '📁 Open folder', es: '📁 Abrir carpeta' },
    '📊 Resumo da marcação': { en: '📊 Marking summary', es: '📊 Resumen de marcado' },
    '📐 Takeoff de esquadrias por IA': { en: '📐 AI window & door takeoff', es: '📐 Cómputo de carpinterías por IA' },
    '＋ Camada (trade)': { en: '＋ Layer (trade)', es: '＋ Capa (trade)' },
    '↳ Aplicar piso/altura às linhas selecionadas': { en: '↳ Apply floor/height to selected lines', es: '↳ Aplicar piso/altura a las líneas seleccionadas' },
    '↳ Aplicar tipo às linhas selecionadas': { en: '↳ Apply type to selected lines', es: '↳ Aplicar tipo a las líneas seleccionadas' },
    '✕ fechar': { en: '✕ close', es: '✕ cerrar' }
  });

  // ---- vitrine da Home (herói, cards, passos) ----
  Object.assign(DICT, {
    'Da planta ao ': { en: 'From the plan to the ', es: 'Del plano a la ' },
    'orçamento': { en: 'quote', es: 'cotización' },
    'em minutos, não horas': { en: 'in minutes, not hours', es: 'en minutos, no horas' },
    'Minutos': { en: 'Minutes', es: 'Minutos' },
    'não horas': { en: 'not hours', es: 'no horas' },
    'sem digitar tabela': { en: 'no typing tables', es: 'sin teclear tablas' },
    'geminada conta dobro': { en: 'paired counts double', es: 'geminada cuenta doble' },
    'app e documentos': { en: 'app and documents', es: 'app y documentos' },
    'Pavimentos×': { en: 'Floors×', es: 'Pisos×' },
    'Planta marcada': { en: 'Marked plan', es: 'Plano marcado' },
    'Orçamento, Pedido (Excel), Proposta e Planta Marcada.': { en: 'Quote, Order (Excel), Proposal and Marked Plan.', es: 'Cotización, Pedido (Excel), Propuesta y Plano Marcado.' },
    'PDF com as marcas coloridas + legenda em cada folha.': { en: 'PDF with colored marks + legend on every sheet.', es: 'PDF con las marcas coloreadas + leyenda en cada hoja.' },
    'Envie a planta. A IA lê as folhas e o ': { en: 'Send the plan. The AI reads the sheets and the ', es: 'Envía el plano. La IA lee las hojas y el ' },
    ' de esquadrias.': { en: ' of windows & doors.', es: ' de carpinterías.' },
    'Orçamento, Pedido, Proposta e Planta Marcada — com a sua marca.': { en: 'Quote, Order, Proposal and Marked Plan — with your brand.', es: 'Cotización, Pedido, Propuesta y Plano Marcado — con tu marca.' }
  });

  // ---- Ajuda: seção do pacote Parede completa + FAQ de pacotes ----
  Object.assign(DICT, {
    'O ConstructCount lê a planta arquitetônica e levanta esquadrias e paredes (framing, drywall, insulation e pintura) — e entrega os documentos prontos. Veja o fluxo completo abaixo.': { en: 'ConstructCount reads the architectural plan and takes off windows/doors and walls (framing, drywall, insulation and paint) — and delivers ready documents. See the full flow below.', es: 'ConstructCount lee el plano arquitectónico y computa carpinterías y paredes (framing, drywall, insulation y pintura) — y entrega los documentos listos. Mira el flujo completo abajo.' },
    'Pacote Parede completa (Framing · Drywall · Insulation · Paint)': { en: 'Complete wall package (Framing · Drywall · Insulation · Paint)', es: 'Paquete Pared completa (Framing · Drywall · Insulation · Paint)' },
    '1. Escopo da obra': { en: '1. Job scope', es: '1. Alcance de la obra' },
    '— em FERRAMENTAS, ligue os ofícios que esta estimativa cobre (🏗️ Framing · 🧱 Drywall · 🧊 Insulation · 🎨 Paint). A mesma parede gera quantidades para cada escopo ligado.': { en: '— in TOOLS, turn on the trades this estimate covers (🏗️ Framing · 🧱 Drywall · 🧊 Insulation · 🎨 Paint). The same wall produces quantities for each scope turned on.', es: '— en HERRAMIENTAS, activa los oficios que cubre esta estimación (🏗️ Framing · 🧱 Drywall · 🧊 Insulation · 🎨 Paint). La misma pared genera cantidades para cada alcance activado.' },
    '2. Tipos de parede por IA': { en: '2. Wall types by AI', es: '2. Tipos de pared por IA' },
    '— abra a folha de partições (ex.: A301) e clique em': { en: '— open the partition sheet (e.g. A301) and click', es: '— abre la hoja de particiones (ej. A301) y haz clic en' },
    ': ela cria os tipos com montante, espaçamento, plates, gypsum e isolamento. Itens com ⚠️ pedem a sua conferência — a IA pergunta, não chuta.': { en: ': it creates the types with stud, spacing, plates, gypsum and insulation. Items with ⚠️ ask for your review — the AI asks, it does not guess.', es: ': crea los tipos con montante, espaciado, plates, gypsum y aislamiento. Los ítems con ⚠️ piden tu revisión — la IA pregunta, no adivina.' },
    '3. Pisos e alturas': { en: '3. Floors and heights', es: '3. Pisos y alturas' },
    '— defina o': { en: '— set the', es: '— define el' },
    'ativo e a altura (lida da A302). Cada parede traçada guarda a altura do seu piso (LF × altura = SF).': { en: 'active and the height (read from A302). Each drawn wall keeps its floor height (LF × height = SF).', es: 'activo y la altura (leída de A302). Cada pared trazada guarda la altura de su piso (LF × altura = SF).' },
    '4. Trace as paredes': { en: '4. Draw the walls', es: '4. Traza las paredes' },
    '— calibre a escala (📏), escolha o': { en: '— calibrate the scale (📏), choose the', es: '— calibra la escala (📏), elige el' },
    'e use': { en: 'and use', es: 'y usa' },
    '📐 Linear': { en: '📐 Linear', es: '📐 Lineal' },
    '(ou ✨ Detectar paredes por IA). O rótulo mostra o tipo e a medida, ex.: (2) 36\'-2".': { en: '(or ✨ Detect walls by AI). The label shows the type and the measure, e.g. (2) 36\'-2".', es: '(o ✨ Detectar paredes por IA). La etiqueta muestra el tipo y la medida, ej. (2) 36\'-2".' },
    '5. Takeoff e preços': { en: '5. Takeoff and prices', es: '5. Cómputo y precios' },
    '— clique em': { en: '— click', es: '— haz clic en' },
    'na barra de status: tabela editável com Material + M.O. + sobra % + imposto → Custo → Ganho % → Venda. Defina a': { en: 'in the status bar: editable table with Material + Labor + waste % + tax → Cost → Markup % → Sale. Set the', es: 'en la barra de estado: tabla editable con Material + M.O. + merma % + impuesto → Costo → Ganancia % → Venta. Define la' },
    'e use 💲 Buscar preços (IA) — você confirma tudo.': { en: 'and use 💲 Find prices (AI) — you confirm everything.', es: 'y usa 💲 Buscar precios (IA) — tú confirmas todo.' },
    '6. Relatórios': { en: '6. Reports', es: '6. Informes' },
    '— no botão': { en: '— on the', es: '— en el botón' },
    '(add-on): orçamento ao cliente, lista de materiais, material por piso, cotação ao fornecedor, análise do proprietário, resumo técnico, planta marcada — e os editores (blocos e visual) com texto por IA.': { en: 'button (add-on): client quote, material list, material by floor, supplier RFQ, owner analysis, technical summary, marked plan — plus the editors (blocks and visual) with AI text.', es: '(add-on): cotización al cliente, lista de materiales, material por piso, cotización al proveedor, análisis del propietario, resumen técnico, plano marcado — y los editores (bloques y visual) con texto por IA.' },
    '📄 Relatórios': { en: '📄 Reports', es: '📄 Informes' },
    '🪟 Trilha 1 — Janelas & Portas': { en: '🪟 Track 1 — Windows & Doors', es: '🪟 Ruta 1 — Ventanas y Puertas' },
    'O fluxo do pacote de esquadrias: a IA lê o schedule e você confere.': { en: 'The windows & doors package flow: the AI reads the schedule and you review.', es: 'El flujo del paquete de carpinterías: la IA lee el schedule y tú revisas.' },
    '🏗️ Trilha 2 — Parede completa': { en: '🏗️ Track 2 — Complete wall', es: '🏗️ Ruta 2 — Pared completa' },
    'O fluxo do pacote de parede: Framing · Drywall · Insulation · Paint, da planta ao preço de venda.': { en: 'The wall package flow: Framing · Drywall · Insulation · Paint, from the plan to the sale price.', es: 'El flujo del paquete de pared: Framing · Drywall · Insulation · Paint, del plano al precio de venta.' },
    'O que cada pacote libera?': { en: 'What does each package unlock?', es: '¿Qué desbloquea cada paquete?' },
    'Cada ofício é vendido à parte (Framing, Drywall, Insulation, Paint) e o combo': { en: 'Each trade is sold separately (Framing, Drywall, Insulation, Paint) and the', es: 'Cada oficio se vende por separado (Framing, Drywall, Insulation, Paint) y el combo' },
    'libera os 4. O app destrava exatamente o que você comprou — ofícios fora do plano aparecem com 🔒. Janelas & Portas é um pacote próprio.': { en: 'combo unlocks all 4. The app unlocks exactly what you bought — trades outside your plan show 🔒. Windows & Doors is its own package.', es: 'desbloquea los 4. La app desbloquea exactamente lo que compraste — los oficios fuera del plan aparecen con 🔒. Ventanas y Puertas es un paquete propio.' },
    'Como funciona o add-on Relatórios?': { en: 'How does the Reports add-on work?', es: '¿Cómo funciona el add-on de Informes?' },
    'Os relatórios e editores do pacote Parede (orçamento, materiais, planta marcada, editor de blocos e visual, texto por IA) são um': { en: 'The Wall package reports and editors (quote, materials, marked plan, block and visual editors, AI text) are a', es: 'Los informes y editores del paquete Pared (cotización, materiales, plano marcado, editores de bloques y visual, texto por IA) son un' },
    'que você liga em qualquer pacote, na aba': { en: 'you can add to any package, in the', es: 'que activas en cualquier paquete, en la pestaña' }
  });

  // ---- Central de relatórios (aba Relatórios) ----
  Object.assign(DICT, {
    'Central de relatórios': { en: 'Reports hub', es: 'Central de informes' },
    'Mural de projetos': { en: 'Project board', es: 'Mural de proyectos' },
    'Dê preço nas obras publicadas: baixe a planta, levante no app e envie sua proposta.': { en: 'Bid on posted jobs: download the plans, take off in the app and send your proposal.', es: 'Da precio a las obras publicadas: descarga el plano, computa en la app y envía tu propuesta.' },
    'Abrir a Central de relatórios': { en: 'Open the Reports hub', es: 'Abrir la Central de informes' },
    'Todos os documentos agora ficam na Central de relatórios.': { en: 'All documents now live in the Reports hub.', es: 'Todos los documentos ahora están en la Central de informes.' },
    'Orçamento, Proposta, Pedido, Quadro Resumo e Planta Marcada — organizados por pacote.': { en: 'Quote, Proposal, Order, Summary Table and Marked Plan — organized by package.', es: 'Cotización, Propuesta, Pedido, Cuadro Resumen y Plano Marcado — organizados por paquete.' },
    'Todos os documentos num lugar só, organizados por pacote.': { en: 'All documents in one place, organized by package.', es: 'Todos los documentos en un solo lugar, organizados por paquete.' },
    'Gerados do takeoff de esquadrias consolidado.': { en: 'Generated from the consolidated windows & doors takeoff.', es: 'Generados del cómputo consolidado de carpinterías.' },
    'Gerados do takeoff de paredes (Linear). Requer o add-on Relatórios.': { en: 'Generated from the wall takeoff (Linear). Requires the Reports add-on.', es: 'Generados del cómputo de paredes (Lineal). Requiere el add-on de Informes.' },
    '🟩 Piso & Forro': { en: '🟩 Floor & Ceiling', es: '🟩 Piso y Cielo raso' },
    'Gerados do takeoff de áreas (Piso/Forro) por tag, com rodapé. Requer o add-on Relatórios.': { en: 'Generated from the area takeoff (Floor/Ceiling) by tag, with baseboard. Requires the Reports add-on.', es: 'Generados del cómputo de áreas (Piso/Cielo) por tag, con zócalo. Requiere el add-on de Informes.' },
    'A IA lê na FOLHA DE MEDIDAS (marcada com 📐) só o que está LIGADO no escopo: tipos de parede, acabamentos de piso/forro, alturas e schedule de janelas/portas. Marque a folha de medidas antes.': { en: 'The AI reads from the MEASUREMENT SHEET (marked with 📐) only what is ENABLED in the scope: wall types, floor/ceiling finishes, heights and the window/door schedule. Mark the measurement sheet first.', es: 'La IA lee en la HOJA DE MEDIDAS (marcada con 📐) solo lo que está ACTIVADO en el alcance: tipos de pared, acabados de piso/cielo, alturas y el schedule de ventanas/puertas. Marca la hoja de medidas antes.' },
    'Altura do rodapé/base em POLEGADAS. A área da base = perímetro do piso × altura (ex.: 4" de base).': { en: 'Baseboard/base height in INCHES. Base area = floor perimeter × height (e.g., 4" base).', es: 'Altura del zócalo/base en PULGADAS. El área de la base = perímetro del piso × altura (ej.: 4" de base).' },
    'Concreto & Fundação': { en: 'Concrete & Foundation', es: 'Concreto & Cimentación' },
    'Defina ANTES de levantar: quais ofícios esta estimativa cobre. Parede gera quantidades por escopo; Piso/Forro vêm da ferramenta de Área (SF).': { en: 'Define BEFORE taking off: which trades this estimate covers. Wall generates quantities by scope; Floor/Ceiling come from the Area tool (SF).', es: 'Define ANTES de computar: qué oficios cubre esta estimación. Pared genera cantidades por alcance; Piso/Cielo vienen de la herramienta de Área (SF).' },
    'Envie a planta. A IA lê as folhas e o schedule de esquadrias.': { en: 'Upload the plan. The AI reads the sheets and the window/door schedule.', es: 'Envía el plano. La IA lee las hojas y el schedule de carpinterías.' },
    'Extração inteligente de esquadrias · Orçamento & Pedido em segundos': { en: 'Smart window/door extraction · Quote & Order in seconds', es: 'Extracción inteligente de carpinterías · Presupuesto & Pedido en segundos' },
    'Itens Extraídos & Editor': { en: 'Extracted Items & Editor', es: 'Ítems Extraídos & Editor' },
    'Licença & Direitos': { en: 'License & Rights', es: 'Licencia & Derechos' },
    'Retângulo: liga o modo Área e cria a área com 2 CLIQUES na diagonal (um canto, o canto oposto). Mais rápido e os cantos saem retos. Shift+1º clique = negativo.': { en: 'Rectangle: turns on Area mode and creates the area with 2 CLICKS on the diagonal (one corner, the opposite corner). Faster and the corners come out square. Shift+1st click = negative.', es: 'Rectángulo: activa el modo Área y crea el área con 2 CLICS en la diagonal (una esquina, la esquina opuesta). Más rápido y las esquinas quedan rectas. Shift+1er clic = negativo.' },
    'Rodapé (opcional)': { en: 'Baseboard (optional)', es: 'Zócalo (opcional)' },
    'Tag do acabamento (ex.: FF-01) — aparece no rótulo da área. Digite ou escolha os lidos da folha de medidas. Com áreas selecionadas, aplica nelas.': { en: 'Finish tag (e.g., FF-01) — shows on the area label. Type it or pick the ones read from the measurement sheet. With areas selected, applies to them.', es: 'Tag del acabado (ej.: FF-01) — aparece en la etiqueta del área. Escríbelo o elige los leídos de la hoja de medidas. Con áreas seleccionadas, se aplica a ellas.' },
    'Takeoff: lista de materiais e preço por disciplina': { en: 'Takeoff: material list and price by discipline', es: 'Takeoff: lista de materiales y precio por disciplina' },
    'Tipo da área — Piso (verde) ou Teto/Forro (azul). Cada área nova entra com este tipo. O total por tipo aparece abaixo.': { en: 'Area type — Floor (green) or Ceiling (blue). Each new area uses this type. The total by type appears below.', es: 'Tipo del área — Piso (verde) o Techo/Cielo (azul). Cada área nueva usa este tipo. El total por tipo aparece abajo.' },
    'Twin ×2': { en: 'Twin ×2', es: 'Twin ×2' },
    'Une várias áreas num ÚNICO piso/forro (um total de SF). Selecione as áreas (clique com o modo Área desligado, Ctrl+clique p/ várias, ou Ctrl+A p/ TODAS) e clique aqui; sem seleção, une TODAS do tipo escolhido nesta folha.': { en: 'Merges several areas into a SINGLE floor/ceiling (one SF total). Select the areas (click with Area mode off, Ctrl+click for several, or Ctrl+A for ALL) and click here; with no selection, it merges ALL of the chosen type on this sheet.', es: 'Une varias áreas en un ÚNICO piso/cielo (un total de SF). Selecciona las áreas (clic con el modo Área apagado, Ctrl+clic para varias, o Ctrl+A para TODAS) y haz clic aquí; sin selección, une TODAS del tipo elegido en esta hoja.' },
    'Você ajusta na tabela': { en: 'You adjust in the table', es: 'Tú ajustas en la tabla' },
    'Edite ID, Tipo, Largura (mm), Altura (mm) e Qtd — a área recalcula sozinha. Unidade:': { en: 'Edit ID, Type, Width (mm), Height (mm) and Qty — the area recalculates by itself. Unit:', es: 'Edita ID, Tipo, Ancho (mm), Alto (mm) y Cant. — el área se recalcula sola. Unidad:' },
    'Área de piso por SF — meça na planta (ferramenta de área) e orce.': { en: 'Floor area by SF — measure on the plan (area tool) and price it.', es: 'Área de piso por SF — mide en el plano (herramienta de área) y cotiza.' },
    'Área de teto/forro por SF — meça na planta (ferramenta de área) e orce.': { en: 'Ceiling area by SF — measure on the plan (area tool) and price it.', es: 'Área de techo/cielo por SF — mide en el plano (herramienta de área) y cotiza.' },
    'Área: clique nos cantos do cômodo/região; duplo-clique (ou Enter) fecha e mostra a área em SF na hora. SHIFT+clique = área NEGATIVA (vermelha) que DESCONTA do total (colunas, escadas, vãos). Botão DIREITO em cima de um ponto apaga aquele ponto. Backspace desfaz o último ponto; quando não está desenhando, apaga a última área. Precisa calibrar a escala.': { en: 'Area: click the corners of the room/region; double-click (or Enter) closes it and shows the area in SF instantly. SHIFT+click = NEGATIVE area (red) that SUBTRACTS from the total (columns, stairs, openings). RIGHT-click on a point deletes that point. Backspace undoes the last point; when not drawing, it deletes the last area. You need to calibrate the scale.', es: 'Área: haz clic en las esquinas del cuarto/región; doble clic (o Enter) la cierra y muestra el área en SF al instante. SHIFT+clic = área NEGATIVA (roja) que RESTA del total (columnas, escaleras, vanos). Clic DERECHO sobre un punto borra ese punto. Backspace deshace el último punto; cuando no estás dibujando, borra la última área. Hay que calibrar la escala.' },
    '💡 PDF com texto → tabela na hora. PDF vetorizado/escaneado → abre o workspace pra você conferir e ajustar.': { en: '💡 PDF with text → table right away. Vectorized/scanned PDF → opens the workspace for you to review and adjust.', es: '💡 PDF con texto → tabla al instante. PDF vectorizado/escaneado → abre el workspace para que revises y ajustes.' },
    /* --- copy estática: landing / onboarding / FAQ / preços (fragmentos por nó de texto) --- */
    'Conta': { en: 'Account', es: 'Cuenta' },
    '/mês': { en: '/mo', es: '/mes' },
    '(à la carte)': { en: '(à la carte)', es: '(a la carta)' },
    '📄 Relatórios e editores (orçamento, materiais, planta marcada, IA) —': { en: '📄 Reports and editors (quote, materials, marked plan, AI) —', es: '📄 Informes y editores (presupuesto, materiales, plano marcado, IA) —' },
    'Clique em': { en: 'Click on', es: 'Haz clic en' },
    'e cole a chave enviada pela M2PB. A ativação é na hora.': { en: 'and paste the key sent by M2PB. Activation is instant.', es: 'y pega la clave enviada por M2PB. La activación es al instante.' },
    '🪟 Janelas & Portas': { en: '🪟 Windows & Doors', es: '🪟 Ventanas y Puertas' },
    'Em': { en: 'In', es: 'En' },
    ', envie a planta em PDF. A IA lê as folhas e o': { en: ', upload the plan as PDF. The AI reads the sheets and the', es: ', envía el plano en PDF. La IA lee las hojas y el' },
    'de esquadrias automaticamente — sem digitar tabela.': { en: 'window/door schedule automatically — no typing tables.', es: 'de carpinterías automáticamente — sin escribir tablas.' },
    'Navegue pelas folhas, veja as': { en: 'Browse the sheets, see the', es: 'Navega por las hojas, ve las' },
    'marcas coloridas': { en: 'colored marks', es: 'marcas de colores' },
    'sobre o desenho e a': { en: 'over the drawing and the', es: 'sobre el dibujo y la' },
    'legenda fixada': { en: 'pinned legend', es: 'leyenda fijada' },
    'na planta. Use o': { en: 'on the plan. Use', es: 'en el plano. Usa el' },
    'pra ver duas folhas lado a lado (ex.: planta × schedule).': { en: 'to see two sheets side by side (e.g., plan × schedule).', es: 'para ver dos hojas lado a lado (ej.: plano × schedule).' },
    'Na tabela': { en: 'In the table', es: 'En la tabla' },
    '(rodapé) você corrige o': { en: '(footer) you correct the', es: '(pie) corriges el' },
    '(casement, correr, fixa,': { en: '(casement, sliding, fixed,', es: '(casement, corredera, fija,' },
    '…) e as': { en: '…) and the', es: '…) y las' },
    'medidas': { en: 'measurements', es: 'medidas' },
    'direto.': { en: 'directly.', es: 'directamente.' },
    'conta em dobro e': { en: 'counts double and', es: 'cuenta doble y' },
    'multiplica pelos andares iguais.': { en: 'multiplies by identical floors.', es: 'multiplica por los pisos iguales.' },
    'Na aba': { en: 'On the tab', es: 'En la pestaña' },
    'para o cliente,': { en: 'for the client,', es: 'para el cliente,' },
    '(Excel) para o fornecedor, e a': { en: '(Excel) for the supplier, and the', es: '(Excel) para el proveedor, y la' },
    'com legenda — tudo com a sua marca.': { en: 'with legend — all with your branding.', es: 'con leyenda — todo con tu marca.' },
    'Tudo fica em': { en: 'Everything stays in', es: 'Todo queda en' },
    '. Reabra na hora, reprocesse se mudar o PDF, ou exclua. Seus trabalhos ficam no seu computador.': { en: '. Reopen instantly, reprocess if the PDF changes, or delete. Your work stays on your computer.', es: '. Reábrelo al instante, reprocésalo si cambia el PDF, o elimínalo. Tus trabajos quedan en tu computadora.' },
    'No workspace': { en: 'In the workspace', es: 'En el workspace' },
    'ou no painel da janela selecionada. A contagem e os documentos atualizam na hora.': { en: 'or in the selected window panel. The count and documents update instantly.', es: 'o en el panel de la ventana seleccionada. El conteo y los documentos se actualizan al instante.' },
    'No seu computador, na pasta do ConstructCount. Reabra a qualquer momento em': { en: 'On your computer, in the ConstructCount folder. Reopen anytime in', es: 'En tu computadora, en la carpeta de ConstructCount. Reábrelo cuando quieras en' },
    '— nada é reprocessado à toa.': { en: '— nothing is reprocessed needlessly.', es: '— nada se reprocesa sin necesidad.' },
    'Sim. Use': { en: 'Yes. Use', es: 'Sí. Usa' },
    'e o sistema gera preço e documentos sem reprocessar a planta.': { en: 'and the system generates pricing and documents without reprocessing the plan.', es: 'y el sistema genera precio y documentos sin reprocesar el plano.' },
    'Nome da empresa': { en: 'Company name', es: 'Nombre de la empresa' },
    'Sua Empresa Ltda': { en: 'Your Company Ltd', es: 'Tu Empresa S.A.' },
    'Linha de contato (telefone · e-mail · site)': { en: 'Contact line (phone · e-mail · website)', es: 'Línea de contacto (teléfono · e-mail · sitio)' },
    'Cor de destaque': { en: 'Accent color', es: 'Color de acento' },
    'Validade 15 dias · CNPJ 00.000.000/0001-00': { en: 'Valid for 15 days · Tax ID 00.000.000/0001-00', es: 'Validez 15 días · CNPJ 00.000.000/0001-00' },
    'no seu computador': { en: 'on your computer', es: 'en tu computadora' },
    '. Atualizar ou reinstalar o app': { en: '. Updating or reinstalling the app', es: '. Actualizar o reinstalar la app' },
    'não apaga': { en: 'does not erase', es: 'no borra' },
    'nada.': { en: 'anything.', es: 'nada.' },
    '🗑 Apagar (0)': { en: '🗑 Delete (0)', es: '🗑 Borrar (0)' },
    'Arraste para redimensionar o painel': { en: 'Drag to resize the panel', es: 'Arrastra para redimensionar el panel' },
    'Tipo (janela / porta)': { en: 'Type (window / door)', es: 'Tipo (ventana / puerta)' },
    'Altura base (pol):': { en: 'Base height (in):', es: 'Altura base (pulg):' },
    '📊 Resumo': { en: '📊 Summary', es: '📊 Resumen' },
    'PDF com preços, com a sua marca': { en: 'PDF with prices, with your brand', es: 'PDF con precios, con tu marca' },
    'PDF de apresentação': { en: 'Presentation PDF', es: 'PDF de presentación' },
    'Excel sem preços': { en: 'Excel without prices', es: 'Excel sin precios' },
    'PDF resumo das marcas': { en: 'PDF summary of the marks', es: 'PDF resumen de las marcas' },
    'PDF da planta com as marcas': { en: 'PDF of the plan with the marks', es: 'PDF del plano con las marcas' },
    '✏️ Editor de relatório (blocos)': { en: '✏️ Report editor (blocks)', es: '✏️ Editor de informe (bloques)' },
    '🎨 Editor visual completo (arrastar/soltar)': { en: '🎨 Full visual editor (drag & drop)', es: '🎨 Editor visual completo (arrastrar/soltar)' },
    '📄 Orçamento ao cliente (PDF)': { en: '📄 Client quote (PDF)', es: '📄 Cotización al cliente (PDF)' },
    '🔒 Análise do proprietário — custo × venda (PDF)': { en: '🔒 Owner analysis — cost × sale (PDF)', es: '🔒 Análisis del propietario — costo × venta (PDF)' },
    '📦 Lista de materiais / Pedido (Excel)': { en: '📦 Material list / Order (Excel)', es: '📦 Lista de materiales / Pedido (Excel)' },
    '🏢 Material por piso (Excel)': { en: '🏢 Material by floor (Excel)', es: '🏢 Material por piso (Excel)' },
    '🧾 Cotação ao fornecedor (Excel)': { en: '🧾 Supplier RFQ (Excel)', es: '🧾 Cotización al proveedor (Excel)' },
    '📊 Resumo do takeoff (PDF)': { en: '📊 Takeoff summary (PDF)', es: '📊 Resumen del cómputo (PDF)' },
    '🗺️ Planta marcada (PDF)': { en: '🗺️ Marked plan (PDF)', es: '🗺️ Plano marcado (PDF)' },
    '✅ Conferir acabamentos (tipo / fabricante)': { en: '✅ Review finishes (type / manufacturer)', es: '✅ Revisar acabados (tipo / fabricante)' },
    '🏢 Material por nível (Excel)': { en: '🏢 Material by level (Excel)', es: '🏢 Material por nivel (Excel)' },
    'Tabela do orçamento (por folha)': { en: 'Quote table (by sheet)', es: 'Tabla del presupuesto (por hoja)' },
    'Resumo técnico (sem preços)': { en: 'Technical summary (no prices)', es: 'Resumen técnico (sin precios)' }
  });

  // índice normalizado (chaves com espaços colapsados) p/ casar HTML e chamadas JS
  const NDICT = {};
  Object.keys(DICT).forEach(k => { NDICT[norm(k)] = DICT[k]; });

  /** Tradução programática p/ uso no JS (documentos, mensagens dinâmicas). */
  F.tr = function (pt, vars, langOverride) {
    const lang = langOverride || LANG;
    let s = pt;
    if (lang !== 'pt') { const e = NDICT[norm(pt)]; if (e && e[lang]) s = e[lang]; }
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  };
  const lookup = (core) => F.tr(core);

  /* ---- Tipos de esquadria (chave em INGLÊS do schedule) → idioma da UI ----
     Espelha o _TYPE_I18N/_MP_I18N do backend. Usado na legenda/tabela. */
  const TYPE_I18N = {
    "Casement Window": { pt: "Janela Casement", en: "Casement Window", es: "Ventana Casement" },
    "Double Casement": { pt: "Janela Casement 2 folhas", en: "Double Casement", es: "Ventana Casement 2 hojas" },
    "Sliding Window": { pt: "Janela de correr", en: "Sliding Window", es: "Ventana corredera" },
    "Awning Window": { pt: "Janela basculante", en: "Awning Window", es: "Ventana proyectante" },
    "Tilt & Turn": { pt: "Oscilo-batente", en: "Tilt & Turn", es: "Oscilobatiente" },
    "Tilt & Turn (open in)": { pt: "Oscilo-batente", en: "Tilt & Turn", es: "Oscilobatiente" },
    "Double Hung": { pt: "Janela guilhotina", en: "Double-Hung Window", es: "Ventana guillotina" },
    "Picture / Fixed": { pt: "Janela fixa", en: "Picture / Fixed", es: "Ventana fija" },
    "Fixed Window": { pt: "Janela fixa", en: "Fixed Window", es: "Ventana fija" },
    "Twin Window": { pt: "Janela geminada (Twin)", en: "Twin Window", es: "Ventana gemela (Twin)" },
    "Single Door": { pt: "Porta de abrir", en: "Swing Door", es: "Puerta abatible" },
    "Single Swing Door": { pt: "Porta de abrir", en: "Single Swing Door", es: "Puerta abatible" },
    "Double Swing Door": { pt: "Porta 2 folhas", en: "Double Swing Door", es: "Puerta 2 hojas" },
    "Pre-Hung Door": { pt: "Porta pré-montada", en: "Pre-Hung Door", es: "Puerta premontada" },
    "Pocket Door": { pt: "Porta embutida", en: "Pocket Door", es: "Puerta embutida" },
    "Bifold Door": { pt: "Porta sanfonada", en: "Bifold Door", es: "Puerta plegable" },
    "Bypass / Sliding Closet": { pt: "Porta de correr (armário)", en: "Bypass / Sliding Closet", es: "Puerta corredera (clóset)" },
    "Barn Door": { pt: "Porta celeiro", en: "Barn Door", es: "Puerta granero" },
    "French Door": { pt: "Porta francesa", en: "French Door", es: "Puerta francesa" },
    "Dutch Door": { pt: "Porta holandesa", en: "Dutch Door", es: "Puerta holandesa" },
    "Sliding Door": { pt: "Porta de correr", en: "Sliding Door", es: "Puerta corredera" },
    "Sliding Glass / Patio": { pt: "Porta de correr de vidro", en: "Sliding Glass / Patio", es: "Puerta corredera de vidrio" },
    "Entry Door": { pt: "Porta de entrada", en: "Entry Door", es: "Puerta de entrada" },
    "Fire-Rated Door": { pt: "Porta corta-fogo", en: "Fire-Rated Door", es: "Puerta cortafuego" },
    "Flush Door": { pt: "Porta lisa", en: "Flush Door", es: "Puerta lisa" },
    "Panel Door": { pt: "Porta almofadada", en: "Panel Door", es: "Puerta con plafones" },
    "Garage Door": { pt: "Portão de garagem", en: "Garage Door", es: "Puerta de garaje" },
    "Storefront Door": { pt: "Porta de fachada", en: "Storefront Door", es: "Puerta de fachada" },
    "Storefront": { pt: "Fachada envidraçada", en: "Storefront", es: "Fachada acristalada" },
  };
  /** Traduz um TIPO (string em inglês do schedule) p/ o idioma atual da UI. */
  F.typeLabel = function (t, langOverride) {
    if (!t) return '';
    const lang = langOverride || LANG;
    const e = TYPE_I18N[t] || TYPE_I18N[String(t).trim()];
    return (e && e[lang]) ? e[lang] : (e && e.pt) || t;
  };
  /** Rótulo do ADICIONAL do projeto (por janela): o termo custom da janela, ou o padrão traduzido. */
  F.addTermLabel = function (lbl) {
    const c = (lbl != null ? String(lbl) : '').trim();
    return c || F.tr('adicional do projeto');
  };

  /* ----------------------------------------------------------------- DOM walk */
  const origText = new WeakMap();   // textNode → {lead, core, trail}
  const origAttr = new WeakMap();   // element → {placeholder, title, 'data-tip'}
  const SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CANVAS: 1, TEXTAREA: 1 };
  let busy = false;                 // ignora as nossas próprias mutações

  function translateTextNode(node) {
    let c = origText.get(node);
    if (c === undefined) {
      const raw = node.nodeValue || '';
      const m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
      c = { lead: m[1], core: norm(m[2]), trail: m[3] };
      origText.set(node, c);
    }
    if (!c.core) return;
    const tr = lookup(c.core);
    const next = c.lead + tr + c.trail;
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  const ATTRS = ['placeholder', 'title', 'data-tip'];
  function translateAttrs(el) {
    let store = origAttr.get(el);
    if (store === undefined) {
      store = {};
      ATTRS.forEach(a => { if (el.hasAttribute(a)) store[a] = norm(el.getAttribute(a)); });
      origAttr.set(el, store);
    }
    ATTRS.forEach(a => {
      if (store[a] == null) return;
      const tr = lookup(store[a]);
      if (el.getAttribute(a) !== tr) el.setAttribute(a, tr);
    });
  }

  function walk(root) {
    if (!root) return;
    // texto
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentNode && (SKIP[n.parentNode.nodeName] || (n.parentNode.closest && n.parentNode.closest('[data-noi18n]')))) ? NodeFilter.FILTER_REJECT
        : (n.nodeValue && n.nodeValue.trim()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const nodes = []; let t; while ((t = tw.nextNode())) nodes.push(t);
    nodes.forEach(translateTextNode);
    // atributos (placeholder/title/data-tip)
    if (root.nodeType === 1) {
      if (ATTRS.some(a => root.hasAttribute && root.hasAttribute(a))) translateAttrs(root);
      root.querySelectorAll && root.querySelectorAll('[placeholder],[title],[data-tip]').forEach(translateAttrs);
    }
  }

  F.translateDOM = function (root) {
    busy = true;
    try { walk(root || document.body); } finally { busy = false; }
  };

  /* ----------------------------------------------------------------- observer */
  let observer = null;
  function startObserver() {
    if (observer || !document.body) return;
    observer = new MutationObserver((muts) => {
      if (busy) return;
      busy = true;
      try {
        for (const m of muts) {
          if (m.type === 'characterData') { if (m.target.parentNode && !SKIP[m.target.parentNode.nodeName]) translateTextNode(m.target); }
          else m.addedNodes.forEach(n => {
            if (n.nodeType === 3) translateTextNode(n);
            else if (n.nodeType === 1) walk(n);
          });
        }
      } finally { busy = false; }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  /* ----------------------------------------------------------------- seletor */
  function buildSwitcher() {
    const header = document.querySelector('header');
    if (!header || document.getElementById('langSwitch')) return;
    const bar = header.querySelector('.max-w-7xl') || header.firstElementChild || header;
    const badge = bar.querySelector('#brandBadge') || bar.querySelector('span.ml-auto, a.ml-auto');
    const sw = document.createElement('div');
    sw.id = 'langSwitch';
    sw.className = 'ml-auto flex items-center gap-1 text-xs';
    LANGS.slice().sort((a, b) => ['pt', 'en', 'es'].indexOf(a) - ['pt', 'en', 'es'].indexOf(b)).forEach(l => {
      const b = document.createElement('button');
      b.dataset.lang = l; b.textContent = l.toUpperCase();
      b.className = 'px-2 py-0.5 rounded ring-1 ring-white/25 hover:bg-white/15 transition';
      b.addEventListener('click', () => F.setLang(l));
      sw.appendChild(b);
    });
    if (badge) { badge.classList.remove('ml-auto'); badge.classList.add('ml-3'); bar.insertBefore(sw, badge); }
    else bar.appendChild(sw);
    refreshSwitcher();
  }
  function refreshSwitcher() {
    const sw = document.getElementById('langSwitch'); if (!sw) return;
    sw.querySelectorAll('button').forEach(b => {
      const on = b.dataset.lang === LANG;
      b.classList.toggle('bg-white', on); b.classList.toggle('text-steel-800', on); b.classList.toggle('font-bold', on);
    });
  }

  /* ----------------------------------------------------------------- setLang */
  F.setLang = function (lang) {
    if (!LANGS.includes(lang)) return;
    LANG = lang;
    try { localStorage.setItem('fenestra_lang', lang); } catch (e) {}
    document.documentElement.lang = lang;
    F.translateDOM(document.body);
    refreshSwitcher();
    // avisa os renderizadores dinâmicos (tabela, preview, etc.) p/ recriar em PT e o observer retraduz
    try { document.dispatchEvent(new CustomEvent('fenestra:lang', { detail: { lang } })); } catch (e) {}
    if (F.onLangChange) try { F.onLangChange(lang); } catch (e) {}
  };

  /* --------------------------------------------- seletor de idioma do documento
     Resolve para 'en'|'pt'|'es' (default = idioma atual). Cancelar → null. */
  const LANG_NAME = { pt: 'Português', en: 'English', es: 'Español' };
  F.pickDocLang = function () {
    return new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.className = 'fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4';
      const box = document.createElement('div');
      box.className = 'bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-steel-800';
      box.innerHTML = '<h3 class="text-lg font-semibold mb-1">' + F.tr('Idioma do documento') + '</h3>' +
        '<p class="text-sm text-steel-500 mb-4">' + F.tr('Em qual idioma gerar este documento?') + '</p>';
      const row = document.createElement('div'); row.className = 'flex gap-2';
      ['pt', 'en', 'es'].forEach(l => {
        const b = document.createElement('button');
        b.textContent = LANG_NAME[l];
        b.className = 'flex-1 px-3 py-2 rounded-lg border font-medium transition ' +
          (l === LANG ? 'bg-steel-600 text-white border-steel-600' : 'border-steel-300 hover:bg-steel-50');
        b.addEventListener('click', () => { cleanup(); resolve(l); });
        row.appendChild(b);
      });
      box.appendChild(row);
      const cancel = document.createElement('button');
      cancel.textContent = F.tr('Cancelar');
      cancel.className = 'mt-4 text-sm text-steel-500 hover:text-steel-800 w-full text-center';
      cancel.addEventListener('click', () => { cleanup(); resolve(null); });
      box.appendChild(cancel);
      ov.appendChild(box); document.body.appendChild(ov);
      ov.addEventListener('click', (e) => { if (e.target === ov) { cleanup(); resolve(null); } });
      function cleanup() { ov.remove(); }
    });
  };

  /* ----------------------------------------- seletor de ESCOPO do projeto
     Resolve 'all'|'facade'|'interior' (default destacado = current). Cancelar → null. */
  const SCOPE_OPT = [
    ['all', 'Tudo (janelas + portas)'],
    ['facade', 'Fachada (parede externa)'],
    ['interior', 'Portas interiores'],
  ];
  F.pickScope = function (current) {
    return new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.className = 'fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4';
      const box = document.createElement('div');
      box.className = 'bg-white rounded-xl shadow-xl w-full max-w-md p-6 text-steel-800';
      box.innerHTML = '<h3 class="text-lg font-semibold mb-1">' + F.tr('Reconhecimento do projeto') + '</h3>' +
        '<p class="text-sm text-steel-500 mb-4">' + F.tr('O que este projeto vai levantar?') + '</p>';
      const col = document.createElement('div'); col.className = 'flex flex-col gap-2';
      SCOPE_OPT.forEach(([val, label]) => {
        const b = document.createElement('button');
        b.textContent = F.tr(label);
        b.className = 'px-3 py-2.5 rounded-lg border font-medium text-left transition ' +
          (val === current ? 'bg-steel-600 text-white border-steel-600' : 'border-steel-300 hover:bg-steel-50');
        b.addEventListener('click', () => { cleanup(); resolve(val); });
        col.appendChild(b);
      });
      box.appendChild(col);
      const cancel = document.createElement('button');
      cancel.textContent = F.tr('Cancelar');
      cancel.className = 'mt-4 text-sm text-steel-500 hover:text-steel-800 w-full text-center';
      cancel.addEventListener('click', () => { cleanup(); resolve(null); });
      box.appendChild(cancel);
      ov.appendChild(box); document.body.appendChild(ov);
      ov.addEventListener('click', (e) => { if (e.target === ov) { cleanup(); resolve(null); } });
      function cleanup() { ov.remove(); }
    });
  };

  /* ----------------------------------------------------------------- init */
  function init() {
    buildSwitcher();
    document.documentElement.lang = LANG;
    F.translateDOM(document.body);
    startObserver();
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

})(window.ConstructCount);
