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
    'Abre para:': { en: 'Opens:', es: 'Abre hacia:' },
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
      acceptNode: (n) => (n.parentNode && SKIP[n.parentNode.nodeName]) ? NodeFilter.FILTER_REJECT
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
