<?php
/* termos-mural.php — TERMOS DE USO DO MURAL DE PROJETOS (contrato de adesão).
   Vale para os DOIS lados: quem publica (GC/ofertante) e quem dá preço.
   O aceite é obrigatório ao publicar (checkbox + data/versão gravadas no projeto)
   e referenciado no envio de proposta. Versão = TERMS_VERSION (bump ao alterar). */
require __DIR__ . '/lib/layout.php';
require __DIR__ . '/lib/projects.php';

const TERMS_VERSION = '2026-06-12';
$L = lang();
$i = $L === 'en' ? 1 : ($L === 'es' ? 2 : 0);
$fee = number_format(prj_fee(), 2);
$sfee = number_format(prj_storage_fee(), 2);

/* [pt, en, es] — cada seção: título + parágrafos (o {fee}/{sfee} é substituído) */
$S = [
  ['1. O serviço', '1. The service', '1. El servicio',
   ['O Mural de projetos do ConstructCount é um QUADRO DE CONEXÃO entre quem oferece obras ("Ofertante"/GC) e profissionais assinantes que enviam propostas ("Proponente"). O ConstructCount NÃO é parte do contrato da obra, não garante a execução, a qualidade, a veracidade das informações publicadas nem o pagamento entre as partes.',
    'The ConstructCount Project Board is a CONNECTION BOARD between those who post jobs ("Poster"/GC) and subscribing professionals who send bids ("Bidder"). ConstructCount is NOT a party to the construction contract and does not guarantee execution, quality, accuracy of posted information, or payment between the parties.',
    'El Mural de proyectos de ConstructCount es un TABLERO DE CONEXIÓN entre quien ofrece obras ("Ofertante"/GC) y profesionales suscriptores que envían propuestas ("Proponente"). ConstructCount NO es parte del contrato de la obra y no garantiza la ejecución, la calidad, la veracidad de la información publicada ni el pago entre las partes.']],
  ['2. Conta e identidade', '2. Account and identity', '2. Cuenta e identidad',
   ['Publicar e propor exigem conta com dados verdadeiros. O e-mail da conta é o canal oficial de avisos (propostas, prazos, multas, exclusões). Publicar é grátis; dar preço exige a assinatura do Mural da região do projeto.',
    'Posting and bidding require an account with truthful information. The account e-mail is the official notice channel (bids, deadlines, fees, deletions). Posting is free; bidding requires the Board subscription for the project region.',
    'Publicar y proponer exigen cuenta con datos verdaderos. El e-mail de la cuenta es el canal oficial de avisos (propuestas, plazos, multas, eliminaciones). Publicar es gratis; dar precio exige la suscripción del Mural de la región del proyecto.']],
  ['3. Calendário de compromissos', '3. Commitment calendar', '3. Calendario de compromisos',
   ['Toda publicação define 3 prazos obrigatórios: limite para propostas, limite para decidir (negociação) e limite para assinatura do contrato. Os prazos obrigam OS DOIS lados. O sistema fiscaliza automaticamente.',
    'Every post sets 3 mandatory deadlines: bid deadline, decision (negotiation) deadline, and contract signing deadline. Deadlines bind BOTH sides. The system enforces them automatically.',
    'Toda publicación define 3 plazos obligatorios: límite para propuestas, límite para decidir (negociación) y límite para la firma del contrato. Los plazos obligan a AMBOS lados. El sistema los fiscaliza automáticamente.']],
  ['4. Taxas e multas', '4. Fees and penalties', '4. Tarifas y multas',
   ['Prazo descumprido gera multa de US$ {fee} para quem falhou (Ofertante que não decidiu havendo propostas; lado que não confirmou o contrato). Prorrogação de mais de 1 mês além da data original: US$ {fee} por mês adicional. Armazenamento de planta acima de 25 MB: US$ {sfee} por mês, do cadastro até a data final do contrato.',
    'A missed deadline triggers a US$ {fee} penalty for the failing party (a Poster who did not decide despite having bids; a side that did not confirm the contract). Extensions beyond 1 month past the original date: US$ {fee} per additional month. Plan storage above 25 MB: US$ {sfee} per month, from posting until the contract end date.',
    'Un plazo incumplido genera una multa de US$ {fee} para quien falló (Ofertante que no decidió habiendo propuestas; lado que no confirmó el contrato). Prórroga de más de 1 mes sobre la fecha original: US$ {fee} por mes adicional. Almacenamiento de plano mayor a 25 MB: US$ {sfee} por mes, desde la publicación hasta la fecha final del contrato.']],
  ['5. Inadimplência: bloqueio, exclusão e banimento', '5. Non-payment: block, deletion and ban', '5. Impago: bloqueo, eliminación y baneo',
   ['Multa pendente BLOQUEIA publicar e propor. O aviso de multa informa o prazo de 30 dias para regularizar. Vencido o prazo: TODOS os dados do projeto são APAGADOS definitivamente (planta, propostas, relatórios) e a empresa é BANIDA DO SISTEMA EM DEFINITIVO (por e-mail e por conta). A multa permanece devida após a exclusão.',
    'A pending fee BLOCKS posting and bidding. The fee notice states a 30-day deadline to settle. After it expires: ALL project data is PERMANENTLY DELETED (plans, bids, reports) and the company is PERMANENTLY BANNED from the system (by e-mail and by account). The fee remains due after deletion.',
    'Una multa pendiente BLOQUEA publicar y proponer. El aviso de multa informa el plazo de 30 días para regularizar. Vencido el plazo: TODOS los datos del proyecto se ELIMINAN definitivamente (plano, propuestas, informes) y la empresa queda BANEADA DEL SISTEMA DEFINITIVAMENTE (por e-mail y por cuenta). La multa sigue debida tras la eliminación.']],
  ['6. Arquivos e retenção', '6. Files and retention', '6. Archivos y retención',
   ['As plantas ficam protegidas (download apenas para o dono e assinantes habilitados). PDFs de projetos encerrados são removidos do servidor após 60 dias do encerramento. O chat entre as partes é TEMPORÁRIO: ao encerrar (qualquer lado, fim do projeto ou 7 dias sem mensagens), a conversa é enviada por e-mail aos dois e apagada do servidor.',
    'Plans are protected (download only by the owner and entitled subscribers). PDFs of closed projects are removed from the server 60 days after closing. The chat between parties is TEMPORARY: when it ends (either side, project closing, or 7 days without messages), the conversation is e-mailed to both and deleted from the server.',
    'Los planos quedan protegidos (descarga solo para el dueño y suscriptores habilitados). Los PDF de proyectos cerrados se eliminan del servidor 60 días después del cierre. El chat entre las partes es TEMPORAL: al terminar (cualquier lado, fin del proyecto o 7 días sin mensajes), la conversación se envía por e-mail a ambos y se borra del servidor.']],
  ['7. Avisos de proteção de pagamento', '7. Payment protection notices', '7. Avisos de protección de pago',
   ['Ao fechar o contrato, o sistema envia automaticamente um Preliminary Notice de cortesia, e o Proponente pode emitir um Notice of Intent to Lien em caso de não pagamento. Esses documentos são gerados com os dados do projeto COMO CORTESIA e NÃO constituem consultoria jurídica; requisitos e prazos variam por estado.',
    'When the contract is signed, the system automatically sends a courtesy Preliminary Notice, and the Bidder may issue a Notice of Intent to Lien in case of non-payment. These documents are generated from project data AS A COURTESY and are NOT legal advice; requirements and deadlines vary by state.',
    'Al cerrar el contrato, el sistema envía automáticamente un Preliminary Notice de cortesía, y el Proponente puede emitir un Notice of Intent to Lien en caso de impago. Estos documentos se generan con los datos del proyecto COMO CORTESÍA y NO constituyen asesoría legal; requisitos y plazos varían por estado.']],
  ['8. Responsabilidade', '8. Liability', '8. Responsabilidad',
   ['O serviço é fornecido "como está". Na máxima extensão permitida em lei, a responsabilidade do ConstructCount/M2PB limita-se aos valores pagos pelo usuário ao sistema nos últimos 12 meses. Disputas da obra (qualidade, pagamento, contrato) são exclusivamente entre Ofertante e Proponente.',
    'The service is provided "as is". To the maximum extent permitted by law, ConstructCount/M2PB liability is limited to the amounts paid by the user to the system in the last 12 months. Job disputes (quality, payment, contract) are exclusively between Poster and Bidder.',
    'El servicio se ofrece "tal cual". En la máxima medida permitida por la ley, la responsabilidad de ConstructCount/M2PB se limita a los montos pagados por el usuario al sistema en los últimos 12 meses. Las disputas de la obra (calidad, pago, contrato) son exclusivamente entre Ofertante y Proponente.']],
  ['9. Alterações', '9. Changes', '9. Cambios',
   ['Estes termos podem ser atualizados; a versão vigente fica nesta página com a data. O uso do Mural após a publicação de mudanças vale como aceite. Versão: {ver}.',
    'These terms may be updated; the current version lives on this page with its date. Using the Board after changes are posted constitutes acceptance. Version: {ver}.',
    'Estos términos pueden actualizarse; la versión vigente queda en esta página con su fecha. Usar el Mural después de publicarse cambios constituye aceptación. Versión: {ver}.']],
];

layout_top(t('terms_title'));
?>
<div class="card" style="max-width:820px;margin:0 auto">
  <h2>📜 <?= h(t('terms_title')) ?></h2>
  <p class="muted"><?= h(t('terms_sub')) ?> · <?= h(TERMS_VERSION) ?></p>
  <?php foreach ($S as $sec): ?>
    <h3 style="margin:18px 0 6px"><?= h($sec[$i]) ?></h3>
    <?php foreach ([$sec[3][$i]] as $par): ?>
      <p style="margin:0;font-size:13.5px;line-height:1.65"><?= h(str_replace(['{fee}', '{sfee}', '{ver}'], [$fee, $sfee, TERMS_VERSION], $par)) ?></p>
    <?php endforeach; ?>
  <?php endforeach; ?>
  <p style="margin-top:20px"><a class="btn ghost" href="<?= h(url('projetos.php')) ?>">« <?= h(t('prj_board_title')) ?></a></p>
</div>
<?php layout_bottom(); ?>
