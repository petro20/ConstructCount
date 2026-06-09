<?php
declare(strict_types=1);
require_once __DIR__ . '/util.php';

$GLOBALS['I18N'] = [
  // chave => [pt, en, es]
  'app_name'      => ['ConstructCount', 'ConstructCount', 'ConstructCount'],
  'tagline'       => ['Orçamento de esquadrias a partir da planta', 'Window & door takeoff from your plans', 'Cómputo de carpinterías desde el plano'],
  'login'         => ['Entrar', 'Sign in', 'Entrar'],
  'logout'        => ['Sair', 'Sign out', 'Salir'],
  'register'      => ['Criar conta', 'Create account', 'Crear cuenta'],
  'email'         => ['E-mail', 'Email', 'Correo'],
  'password'      => ['Senha', 'Password', 'Contraseña'],
  'name'          => ['Nome', 'Name', 'Nombre'],
  'dashboard'     => ['Minha conta', 'My account', 'Mi cuenta'],
  'my_licenses'   => ['Minhas licenças', 'My licenses', 'Mis licencias'],
  'subscribe'     => ['Assinar', 'Subscribe', 'Suscribirse'],
  'renew'         => ['Renovar', 'Renew', 'Renovar'],
  'plan'          => ['Plano', 'Plan', 'Plan'],
  'package'       => ['Pacote', 'Package', 'Paquete'],
  'status'        => ['Status', 'Status', 'Estado'],
  'expires'       => ['Vencimento', 'Expires', 'Vence'],
  'devices'       => ['Dispositivos', 'Devices', 'Dispositivos'],
  'key'           => ['Chave', 'Key', 'Clave'],
  'approved'      => ['Licença aprovada', 'License approved', 'Licencia aprobada'],
  'not_approved'  => ['Não aprovada', 'Not approved', 'No aprobada'],
  'check_license' => ['Consultar licença', 'Check license', 'Consultar licencia'],
  'no_account'    => ['Não tem conta?', "Don't have an account?", '¿Sin cuenta?'],
  'have_account'  => ['Já tem conta?', 'Already have an account?', '¿Ya tienes cuenta?'],
  'monthly'       => ['Mensal', 'Monthly', 'Mensual'],
  'annual'        => ['Anual', 'Annual', 'Anual'],
  'copy'          => ['Copiar', 'Copy', 'Copiar'],
  'copied'        => ['Copiado!', 'Copied!', '¡Copiado!'],
  'use_in_app'    => ['Cole esta chave na tela de ativação do app.', 'Paste this key in the app activation screen.', 'Pega esta clave en la pantalla de activación de la app.'],
  'download_app'  => ['⬇ Baixar o app (Windows)', '⬇ Download the app (Windows)', '⬇ Descargar la app (Windows)'],
  'download_hint' => ['Baixe e execute o instalador — ele cria o ícone na Área de Trabalho. Abra o ConstructCount e cole sua chave para ativar.', 'Download and run the installer — it creates a Desktop icon. Open ConstructCount and paste your key to activate.', 'Descarga y ejecuta el instalador — crea un icono en el Escritorio. Abre ConstructCount y pega tu clave para activar.'],
  'download_warn' => ['⚠️ O Windows pode mostrar um aviso de segurança (app novo). Clique em “Mais informações” → “Executar mesmo assim”. É normal e seguro.', '⚠️ Windows may show a security warning (new app). Click “More info” → “Run anyway”. It’s normal and safe.', '⚠️ Windows puede mostrar un aviso de seguridad (app nueva). Haz clic en “Más información” → “Ejecutar de todos modos”. Es normal y seguro.'],
  'data_safe' => ['💾 Seus projetos ficam salvos no seu computador. Atualizar ou reinstalar o app não apaga seus trabalhos nem a licença.', '💾 Your projects are saved on your computer. Updating or reinstalling the app does not delete your work or your license.', '💾 Tus proyectos se guardan en tu computadora. Actualizar o reinstalar la app no borra tu trabajo ni tu licencia.'],
  'manage_billing'=> ['Gerenciar assinatura', 'Manage billing', 'Gestionar suscripción'],
  'cancel_sub'    => ['Cancelar assinatura', 'Cancel subscription', 'Cancelar suscripción'],
  'confirm_cancel'=> ['Cancelar sua assinatura? O acesso continua até o fim do período.', 'Cancel your subscription? Access continues until the end of the period.', '¿Cancelar tu suscripción? El acceso continúa hasta el fin del período.'],
  'err_login'     => ['E-mail ou senha inválidos.', 'Invalid email or password.', 'Correo o contraseña inválidos.'],
  'err_exists'    => ['Este e-mail já tem conta.', 'This email already has an account.', 'Este correo ya tiene cuenta.'],
  'err_fields'    => ['Preencha todos os campos.', 'Fill in all fields.', 'Completa todos los campos.'],
  'no_licenses'   => ['Você ainda não tem licença. Assine para começar.', 'You have no license yet. Subscribe to start.', 'Aún no tienes licencia. Suscríbete para empezar.'],
  'pay_ok'        => ['Pagamento confirmado! Sua licença está ativa.', 'Payment confirmed! Your license is active.', '¡Pago confirmado! Tu licencia está activa.'],
  'pay_cancel'    => ['Pagamento cancelado.', 'Payment canceled.', 'Pago cancelado.'],

  // ---- landing ----
  'hero_badge'=> ['⚡ Estimating de esquadrias com IA', '⚡ AI-powered window & door estimating', '⚡ Estimación de carpintería con IA'],
  'dev_by'    => ['Desenvolvido por', 'Developed by', 'Desarrollado por'],
  'rights'    => ['Todos os direitos reservados.', 'All rights reserved.', 'Todos los derechos reservados.'],
  'stat_fast' => ['mais rápido que manual', 'faster than manual', 'más rápido que manual'],
  'stat_min'  => ['min por folha', 'min per sheet', 'min por hoja'],
  'stat_rep'  => ['relatórios: Excel + PDF', 'reports: Excel + PDF', 'informes: Excel + PDF'],
  'hero_h1'   => ['Orçamento de esquadrias direto da planta', 'Window & door quotes straight from the plans', 'Cotización de carpinterías directo del plano'],
  'hero_sub'  => ['Leia o PDF do projeto, levante portas e janelas automaticamente e gere orçamento, pedido e planta marcada em minutos.', 'Read the project PDF, take off doors and windows automatically and generate quotes, supplier orders and marked plans in minutes.', 'Lee el PDF del proyecto, computa puertas y ventanas automáticamente y genera cotizaciones, pedidos y planos marcados en minutos.'],
  'cta_start' => ['Começar agora', 'Get started', 'Empezar ahora'],
  'cta_plans' => ['Ver planos', 'See plans', 'Ver planes'],
  'feat_title'=> ['Tudo para o levantamento e o orçamento', 'Everything for takeoff and quoting', 'Todo para el cómputo y la cotización'],
  'f1_t'=>['Leitura por IA','AI reading','Lectura por IA'], 'f1_d'=>['Extrai esquadrias do PDF do projeto.','Extracts windows & doors from the project PDF.','Extrae carpinterías del PDF del proyecto.'],
  'f2_t'=>['Takeoff automático','Automatic takeoff','Cómputo automático'], 'f2_d'=>['Conta e dimensiona por tipo, conforme o schedule.','Counts and sizes by type, per the schedule.','Cuenta y dimensiona por tipo, según el schedule.'],
  'f3_t'=>['Documentos prontos','Ready documents','Documentos listos'], 'f3_d'=>['Orçamento, pedido (Excel), proposta e quadro resumo.','Quote, supplier order (Excel), proposal and summary.','Cotización, pedido (Excel), propuesta y cuadro resumen.'],
  'f4_t'=>['Planta marcada','Marked plan','Plano marcado'], 'f4_d'=>['Marcas coloridas + legenda em cada folha.','Colored marks + legend on each sheet.','Marcas de color + leyenda en cada hoja.'],
  'f5_t'=>['Trilíngue','Trilingual','Trilingüe'], 'f5_d'=>['Interface e documentos em PT, EN e ES.','UI and documents in PT, EN and ES.','Interfaz y documentos en PT, EN y ES.'],
  'f6_t'=>['Desktop e Web','Desktop & Web','Escritorio y Web'], 'f6_d'=>['App para Windows e versão no navegador.','Windows app and browser version.','App para Windows y versión web.'],
  'how_title'=>['Como funciona','How it works','Cómo funciona'],
  'how1'=>['Assine um plano','Subscribe to a plan','Suscríbete a un plan'], 'how1d'=>['Pagamento seguro por cartão.','Secure card payment.','Pago seguro con tarjeta.'],
  'how2'=>['Receba sua chave','Get your key','Recibe tu clave'], 'how2d'=>['A licença aparece na sua conta na hora.','The license shows in your account instantly.','La licencia aparece en tu cuenta al instante.'],
  'how3'=>['Ative e orce','Activate & quote','Activa y cotiza'], 'how3d'=>['Cole a chave no app e comece.','Paste the key in the app and start.','Pega la clave en la app y empieza.'],
  'pricing_title'=>['Planos','Plans','Planes'],
  'best'=>['Melhor custo','Best value','Mejor precio'],
  'per_dev'=>['dispositivo','device','dispositivo'],
  'feat_inc'=>['Tudo incluso · atualizações · suporte','Everything included · updates · support','Todo incluido · actualizaciones · soporte'],
  'final_cta'=>['Pronto para acelerar seus orçamentos?','Ready to speed up your quotes?','¿Listo para acelerar tus cotizaciones?'],
];

function lang(): string {
  static $L = null;
  if ($L !== null) return $L;
  $valid = ['pt', 'en', 'es'];
  $q = strtolower((string) ($_GET['lang'] ?? ''));
  if (in_array($q, $valid, true)) { setcookie('fqa_lang', $q, time() + 31536000, '/'); $L = $q; return $L; }
  if (!empty($_COOKIE['fqa_lang']) && in_array($_COOKIE['fqa_lang'], $valid, true)) { $L = $_COOKIE['fqa_lang']; return $L; }
  $al = strtolower(substr((string) ($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? ''), 0, 2));
  $L = in_array($al, $valid, true) ? $al : 'en';   // foco EUA → padrão inglês
  return $L;
}

function t(string $key): string {
  $i = ['pt' => 0, 'en' => 1, 'es' => 2][lang()];
  return $GLOBALS['I18N'][$key][$i] ?? ($GLOBALS['I18N'][$key][0] ?? $key);
}
