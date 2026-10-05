/* Panel Dnia — strona z linków w e-mailach Supabase Auth (GitHub Pages).
 * Link z wiadomości prowadzi przez serwer Supabase (sprawdza jednorazowy token i jego ważność),
 * a ten przekierowuje tutaj z sesją w części „#…” adresu (nie trafia ona do serwera GitHub ani do historii).
 * type=recovery → formularz nowego hasła; po zmianie wylogowanie WSZYSTKICH sesji (także obcych).
 * type=signup/email/email_change → informacja o potwierdzeniu. Klucz poniżej jest publiczny z założenia. */
(function () {
  'use strict';
  const URL_ = 'https://zyubiaeuvmjofjgomgqp.supabase.co';
  const KEY = 'sb_publishable_ADV4aj4Hg9vdp3rcFzzxJA_XZHalY8s';
  const $ = id => document.getElementById(id);
  const show = id => ['busy', 'reset', 'done', 'bad', 'idle'].forEach(s => { $(s).hidden = s !== id; });
  const done = (title, text) => { $('doneTitle').textContent = title; $('doneText').textContent = text; show('done'); };

  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(location.search);
  const type = hash.get('type') || query.get('type') || '';
  const error = hash.get('error_code') || hash.get('error') || query.get('error_code') || query.get('error');
  // token nie zostaje w pasku adresu ani w historii przeglądarki
  if (location.hash || location.search) history.replaceState(null, '', location.pathname);

  if (error) {
    if (/expired/i.test(error)) $('badText').textContent = 'Link wygasł albo został już użyty. Każdy link działa tylko raz i przez krótki czas.';
    show('bad'); return;
  }
  if (!hash.get('access_token')) { show(type ? 'bad' : 'idle'); return; }
  if (!window.supabase || !window.supabase.createClient) { $('badText').textContent = 'Nie udało się wczytać strony. Odśwież ją.'; show('bad'); return; }

  const client = window.supabase.createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  client.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') || '' }).then(({ data, error: e }) => {
    if (e || !data || !data.session) { show('bad'); return; }
    if (type === 'recovery') {
      $('resetFor').textContent = 'Konto: ' + (data.session.user.email || '');
      show('reset'); $('p1').focus();
    } else if (type === 'email_change') {
      client.auth.signOut({ scope: 'local' }).catch(() => {});
      done('Nowy adres potwierdzony', 'Od teraz logujesz się nowym adresem e-mail. Możesz zamknąć tę stronę.');
    } else {
      client.auth.signOut({ scope: 'local' }).catch(() => {});
      done('Adres potwierdzony', 'Wróć do aplikacji Panel Dnia i zaloguj się. Możesz zamknąć tę stronę.');
    }
  }).catch(() => show('bad'));

  $('resetForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const p1 = $('p1').value, p2 = $('p2').value, err = $('resetErr');
    err.textContent = '';
    if (p1.length < 8) { err.textContent = 'Hasło musi mieć co najmniej 8 znaków.'; return; }
    if (p1 !== p2) { err.textContent = 'Hasła się różnią.'; return; }
    $('resetBtn').disabled = true;
    try {
      const { error: e } = await client.auth.updateUser({ password: p1 });
      if (e) throw e;
      // po resecie hasła wszystkie sesje (inne urządzenia, ewentualnie ktoś obcy) muszą zalogować się od nowa
      await client.auth.signOut({ scope: 'global' }).catch(() => {});
      done('Hasło zmienione', 'Zaloguj się w aplikacji Panel Dnia nowym hasłem. Ze względów bezpieczeństwa wszystkie urządzenia zostały wylogowane.');
    } catch (e) {
      const m = String((e && (e.code || e.message)) || '');
      err.textContent = /same_password|different/i.test(m) ? 'Nowe hasło musi być inne niż poprzednie.'
        : /weak|at least/i.test(m) ? 'Hasło jest za słabe — użyj co najmniej 8 znaków.'
        : /expired|invalid|jwt|session/i.test(m) ? 'Link wygasł. Poproś o nowy w aplikacji.'
        : 'Nie udało się zapisać hasła. Sprawdź internet i spróbuj ponownie.';
      $('resetBtn').disabled = false;
    }
  });
})();
