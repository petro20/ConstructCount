<?php
/* publicar.php — quem TEM OBRA publica o projeto no mural. EXIGE CONTA (grátis):
   com multas e banimento definitivo, os dois lados precisam de identidade real.
   O projeto fica ligado à conta (owner_user_id) + link de gestão com token. */
require __DIR__ . '/lib/layout.php';
require __DIR__ . '/lib/projects.php';
prj_ensure_schema();
$u = require_login();   // login obrigatório p/ AMBOS os lados (volta pra cá após entrar)

$err = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  if (!csrf_check()) $err = t('err_fields');
  else {
    $title = trim((string) ($_POST['title'] ?? ''));
    $company = trim((string) ($_POST['company'] ?? ''));
    $cname = trim((string) ($_POST['contact_name'] ?? '')) ?: (string) $u['name'];
    $cemail = (string) $u['email'];   // o contato é SEMPRE o e-mail da conta (responsabilização)
    $region = trim((string) ($_POST['region'] ?? ''));
    $address = trim((string) ($_POST['address'] ?? ''));
    $plat = is_numeric($_POST['lat'] ?? '') ? (float) $_POST['lat'] : null;   // GPS confirmado no mapa
    $plng = is_numeric($_POST['lng'] ?? '') ? (float) $_POST['lng'] : null;
    $deadline = trim((string) ($_POST['deadline'] ?? ''));
    $negDeadline = trim((string) ($_POST['negotiation_deadline'] ?? ''));
    $conDeadline = trim((string) ($_POST['contract_deadline'] ?? ''));
    $descr = trim((string) ($_POST['descr'] ?? ''));
    $trades = array_values(array_intersect((array) ($_POST['trades'] ?? []), PRJ_TRADES));
    if ($title === '' || $company === '' || $cemail === '' || $region === '' || !$trades || !filter_var($cemail, FILTER_VALIDATE_EMAIL)) {
      $err = t('err_fields');
    } elseif ($address === '' || $plat === null || $plng === null) {
      $err = t('prj_addr_err');                        // endereço tem que ser CONFIRMADO no GPS (sugestão + pin)
    } elseif (empty($_POST['accept_terms'])) {
      $err = t('terms_required');                      // contrato de uso do Mural é obrigatório
    } elseif (!$deadline || !$negDeadline || !$conDeadline || $negDeadline < $deadline || $conDeadline < $negDeadline) {
      $err = t('prj_dates_err');                      // calendário obrigatório e em ordem
    } elseif (prj_is_banned((int) $u['id'], $cemail)) {
      $err = t('prj_banned');                          // empresa banida — definitivo
    } elseif (prj_pending_fees('owner', (int) $u['id'], $cemail)) {
      $err = t('prj_blocked_owner');                  // multa pendente → não publica
    } else {
      $pdf = null;
      if (!empty($_FILES['pdf']['name'])) {
        $pdf = prj_save_pdf($_FILES['pdf'], 'project', $perr);
        if ($pdf === null) $err = t('prj_pdf_err');
      }
      $pdfLink = trim((string) ($_POST['pdf_link'] ?? ''));   // alternativa p/ planta grande: link Drive/Dropbox
      if ($pdfLink !== '' && !filter_var($pdfLink, FILTER_VALIDATE_URL)) $err = t('prj_link_err');
      if ($err === '') {
        $tok = bin2hex(random_bytes(16));
        // GPS: usa o pin CONFIRMADO no formulário; geocode da região é só fallback
        $geo = ($plat !== null && $plng !== null) ? ['lat' => $plat, 'lng' => $plng] : prj_geocode($region);
        $pdfSize = ($pdf !== null) ? (int) ($_FILES['pdf']['size'] ?? 0) : null;
        db()->prepare('INSERT INTO projects (title,company,contact_name,contact_email,owner_user_id,region,address,trades,deadline,negotiation_deadline,contract_deadline,contract_deadline_orig,descr,pdf_path,pdf_size,pdf_link,manage_token,lat,lng,terms_accepted_at,terms_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),?)')
            ->execute([$title, $company, $cname, $cemail, (int) $u['id'], $region, $address, implode(',', $trades), $deadline, $negDeadline, $conDeadline, $conDeadline, $descr, $pdf, $pdfSize, ($pdfLink ?: null), $tok, $geo['lat'] ?? null, $geo['lng'] ?? null, '2026-06-12']);
        $id = (int) db()->lastInsertId();
        // OFERTA o link a todos os assinantes do pacote Mural (e-mail broadcast)
        prj_notify_subscribers(['id' => $id, 'title' => $title, 'region' => $region, 'trades' => implode(',', $trades), 'deadline' => $deadline]);
        $link = url('projeto.php?id=' . $id . '&t=' . $tok);
        @mail($cemail, 'ConstructCount — ' . t('prj_published_subject'),
              t('prj_published_mail') . "\n\n" . $link,
              "From: no-reply@constructcount.com\r\nContent-Type: text/plain; charset=utf-8");
        flash(t('prj_published_flash'));
        redirect($link);
      }
    }
  }
}
layout_top(t('prj_post_title'));
?>
<div class="card" style="max-width:760px;margin:0 auto">
  <h2><?= h(t('prj_post_title')) ?></h2>
  <p class="muted"><?= h(t('prj_post_sub')) ?></p>
  <div style="margin-top:10px;padding:12px 14px;border:1px solid #b58a2a;border-radius:10px;background:rgba(217,160,42,.08)">
    <b>⚖️ <?= h(t('prj_rules_title')) ?></b>
    <ul style="margin:8px 0 0;padding-left:18px;font-size:13px;line-height:1.6">
      <li><?= h(str_replace('{fee}', number_format(prj_fee(), 2), t('prj_rule_fee'))) ?></li>
      <li><?= h(str_replace('{fee}', number_format(prj_fee(), 2), t('prj_rule_extension'))) ?></li>
      <li><?= h(str_replace('{fee}', number_format(prj_storage_fee(), 2), t('prj_rule_storage'))) ?></li>
      <li><?= h(t('prj_rule_block')) ?></li>
    </ul>
    <p style="margin:8px 0 0;font-size:12.5px"><a href="<?= h(url('termos-mural.php')) ?>" target="_blank">📜 <?= h(t('terms_title')) ?> »</a></p>
  </div>
  <?php if ($err): ?><p class="err"><?= h($err) ?></p><?php endif; ?>
  <form method="post" enctype="multipart/form-data" style="display:grid;gap:12px;margin-top:10px">
    <?= csrf_field() ?>
    <label><?= h(t('prj_f_title')) ?><br><input name="title" required maxlength="160" style="width:100%"></label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <label><?= h(t('prj_f_company')) ?><br><input name="company" required maxlength="120" style="width:100%"></label>
      <label><?= h(t('prj_f_contact')) ?><br><input name="contact_name" maxlength="120" style="width:100%"></label>
    </div>
    <label><?= h(t('prj_f_email')) ?><br><input type="email" value="<?= h((string) $u['email']) ?>" disabled style="width:100%;opacity:.7" title="<?= h(t('prj_f_email_acct')) ?>"></label>
    <div style="position:relative">
      <label><?= h(t('prj_f_address')) ?><br><input id="prjAddr" name="address" required maxlength="255" autocomplete="off" placeholder="123 Main St, Paterson, NJ" style="width:100%"></label>
      <div id="prjAddrSug" style="position:absolute;left:0;right:0;z-index:30;background:#181818;border:1px solid var(--bd);border-radius:10px;display:none;overflow:hidden"></div>
      <p class="muted" id="prjAddrStatus" style="margin:4px 0 0;font-size:12px"><?= h(t('prj_addr_hint')) ?></p>
      <input type="hidden" name="lat" id="prjLat"><input type="hidden" name="lng" id="prjLng">
      <div id="prjMiniMap" style="display:none;height:200px;border-radius:10px;border:1px solid var(--bd);margin-top:8px"></div>
    </div>
    <label><?= h(t('prj_f_region')) ?><br><input id="prjRegion" name="region" required maxlength="120" placeholder="Paterson, NJ" style="width:100%"></label>
    <div>
      <?= h(t('prj_f_trades')) ?><br>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:6px">
        <?php foreach (PRJ_TRADES as $tr): ?>
          <label style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" name="trades[]" value="<?= h($tr) ?>"> <?= h(prj_trade_label($tr)) ?></label>
        <?php endforeach; ?>
      </div>
    </div>
    <div>
      <b>📅 <?= h(t('prj_calendar')) ?></b>
      <p class="muted" style="margin:4px 0 8px;font-size:12.5px"><?= h(str_replace('{fee}', number_format(prj_fee(), 2), t('prj_calendar_hint'))) ?></p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <label><?= h(t('prj_f_deadline')) ?><br><input type="date" name="deadline" required style="width:100%"></label>
        <label><?= h(t('prj_f_neg_deadline')) ?><br><input type="date" name="negotiation_deadline" required style="width:100%"></label>
        <label><?= h(t('prj_f_con_deadline')) ?><br><input type="date" name="contract_deadline" required style="width:100%"></label>
      </div>
    </div>
    <label><?= h(t('prj_f_pdf')) ?><br><input type="file" name="pdf" accept="application/pdf" style="width:100%">
      <span class="muted" style="font-size:12px">💾 <?= h(str_replace('{fee}', number_format(prj_storage_fee(), 2), t('prj_rule_storage'))) ?></span></label>
    <label><?= h(t('prj_f_link')) ?><br><input type="url" name="pdf_link" placeholder="https://drive.google.com/…" style="width:100%"></label>
    <label><?= h(t('prj_f_descr')) ?><br><textarea name="descr" rows="4" style="width:100%"></textarea></label>
    <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;padding:10px 12px;border:1px solid var(--bd);border-radius:10px">
      <input type="checkbox" name="accept_terms" value="1" required style="margin-top:3px">
      <span><?= h(t('terms_accept')) ?> <a href="<?= h(url('termos-mural.php')) ?>" target="_blank"><b><?= h(t('terms_title')) ?></b></a> — <?= h(t('terms_accept2')) ?></span>
    </label>
    <button class="btn"><?= h(t('prj_post_btn')) ?></button>
    <p class="muted" style="font-size:12.5px"><?= h(t('prj_post_note')) ?></p>
  </form>
  <p id="aiFill" class="muted" style="display:none;margin-top:10px;font-weight:700;color:#7fe3b0"></p>
</div>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
// 📍 ENDEREÇO DA OBRA com GPS confirmado: autocomplete (OpenStreetMap/Nominatim),
// pin no mini-mapa (ARRASTÁVEL p/ ajuste fino) e região (Cidade, UF) automática.
// Sem endereço confirmado o servidor recusa a publicação.
(function () {
  var inp = document.getElementById('prjAddr'), sug = document.getElementById('prjAddrSug');
  var stt = document.getElementById('prjAddrStatus'), reg = document.getElementById('prjRegion');
  var lat = document.getElementById('prjLat'), lng = document.getElementById('prjLng');
  var mapDiv = document.getElementById('prjMiniMap');
  if (!inp) return;
  var T_SEARCH = <?= json_encode(t('prj_addr_searching'), JSON_UNESCAPED_UNICODE) ?>;
  var T_PICK = <?= json_encode(t('prj_addr_pick'), JSON_UNESCAPED_UNICODE) ?>;
  var T_OK = <?= json_encode(t('prj_addr_ok'), JSON_UNESCAPED_UNICODE) ?>;
  var T_HINT = <?= json_encode(t('prj_addr_hint'), JSON_UNESCAPED_UNICODE) ?>;
  var map = null, marker = null, deb = null;

  function setPin(la, lo) {
    lat.value = la.toFixed(6); lng.value = lo.toFixed(6);
    mapDiv.style.display = 'block';
    if (!window.L) return;
    if (!map) {
      map = L.map('prjMiniMap').setView([la, lo], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      marker = L.marker([la, lo], { draggable: true }).addTo(map);
      marker.on('dragend', function () { var p = marker.getLatLng(); lat.value = p.lat.toFixed(6); lng.value = p.lng.toFixed(6); });
    } else { map.setView([la, lo], 16); marker.setLatLng([la, lo]); }
    setTimeout(function () { try { map.invalidateSize(); } catch (e) {} }, 150);
  }
  function pick(it) {
    sug.style.display = 'none';
    inp.value = it.display_name.slice(0, 255);
    var a = it.address || {};
    var city = a.city || a.town || a.village || a.hamlet || a.municipality || '';
    var iso = a['ISO3166-2-lvl4'] || '';                       // ex.: US-NJ
    var uf = iso.indexOf('US-') === 0 ? iso.slice(3) : '';
    if (city || uf) reg.value = (city ? city + ', ' : '') + uf;
    setPin(parseFloat(it.lat), parseFloat(it.lon));
    stt.innerHTML = '✅ ' + T_OK;
  }
  function search(q) {
    stt.textContent = '🔎 ' + T_SEARCH;
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=us&addressdetails=1&q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (list) {
        sug.innerHTML = '';
        if (!list.length) { sug.style.display = 'none'; stt.textContent = T_HINT; return; }
        list.forEach(function (it) {
          var b = document.createElement('button');
          b.type = 'button';
          b.style.cssText = 'display:block;width:100%;text-align:left;padding:9px 12px;background:none;border:0;border-bottom:1px solid rgba(255,255,255,.07);color:inherit;cursor:pointer;font-size:13px';
          b.textContent = '📍 ' + it.display_name;
          b.addEventListener('click', function () { pick(it); });
          sug.appendChild(b);
        });
        sug.style.display = 'block';
        stt.textContent = '⬇️ ' + T_PICK;
      }).catch(function () { stt.textContent = T_HINT; });
  }
  inp.addEventListener('input', function () {
    lat.value = ''; lng.value = '';                            // mudou o texto → GPS precisa reconfirmar
    stt.textContent = T_HINT;
    clearTimeout(deb);
    var q = inp.value.trim();
    if (q.length < 5) { sug.style.display = 'none'; return; }
    deb = setTimeout(function () { search(q); }, 650);
  });
  document.addEventListener('click', function (e) { if (!sug.contains(e.target) && e.target !== inp) sug.style.display = 'none'; });
})();
</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
// ✨ IA de preenchimento: ao escolher o PDF, lê as primeiras folhas NO NAVEGADOR
// (nada é enviado antes de você publicar) e preenche título, região e ofícios.
(function () {
  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var inp = document.querySelector('input[name="pdf"]');
  if (!inp || !window.pdfjsLib) return;
  var MSG = <?= json_encode(t('prj_ai_filled'), JSON_UNESCAPED_UNICODE) ?>;
  var BUSY = <?= json_encode(t('prj_ai_reading'), JSON_UNESCAPED_UNICODE) ?>;
  inp.addEventListener('change', async function () {
    var f = inp.files && inp.files[0];
    if (!f) return;
    var el = document.getElementById('aiFill');
    el.style.display = 'block'; el.textContent = '✨ ' + BUSY;
    try {
      var buf = await f.arrayBuffer();
      var doc = await pdfjsLib.getDocument({ data: buf }).promise;
      var text = '';
      var n = Math.min(doc.numPages, 4);
      for (var i = 1; i <= n; i++) {
        var pg = await doc.getPage(i);
        var tc = await pg.getTextContent();
        text += tc.items.map(function (it) { return it.str; }).join(' ') + '\n';
      }
      var found = [];
      // título: nome do arquivo humanizado
      var tt = document.querySelector('input[name="title"]');
      if (tt && !tt.value) { tt.value = f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160); found.push('título'); }
      // região: "Cidade, UF 99999" no carimbo
      var rg = document.querySelector('input[name="region"]');
      var m = text.match(/([A-Z][A-Za-z.\- ']{2,28}),\s*([A-Z]{2})\.?\s+(\d{5})/);
      if (rg && !rg.value && m) { rg.value = m[1].trim() + ', ' + m[2]; found.push('região'); }
      // ofícios pelo conteúdo
      var tradeRx = { framing: /\bstud|framing|joist/i, drywall: /gypsum|drywall|gwb|wallboard/i, insulation: /insulation|\bbatt\b/i, paint: /\bpaint|spackle/i, windows_doors: /window schedule|door schedule|fenestration/i };
      var hits = [];
      Object.keys(tradeRx).forEach(function (k) {
        if (tradeRx[k].test(text)) {
          var cb = document.querySelector('input[name="trades[]"][value="' + k + '"]');
          if (cb && !cb.checked) { cb.checked = true; hits.push(k); }
        }
      });
      if (hits.length) found.push('ofícios (' + hits.length + ')');
      el.textContent = found.length ? ('✨ ' + MSG + ' ' + found.join(' · ')) : '';
      if (!found.length) el.style.display = 'none';
    } catch (e) { el.style.display = 'none'; }
  });
})();
</script>
<?php layout_bottom(); ?>
