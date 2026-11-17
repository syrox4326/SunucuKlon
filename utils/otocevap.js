// Otomatik cevap motoru: mesajda tetik ifadesi geçerse bot cevap yazar. Kurallar sunucu başına veritabanında tutulur.
const { db } = require('./veritabani');

const EN_COK_KURAL = 50;
const BEKLEME_MS = 15_000; // aynı kişi aynı kuralı en sık 15 sn'de bir tetikleyebilir

// Varsayılan kurallar (her sunucuya bir kez eklenir)
const VARSAYILAN = [
  ['Selamün Aleyküm', 'Aleyküm selam'],
  ['Selamın Aleyküm', 'Aleyküm selam'],
  ['Es Selamu Aleyküm', 'Aleyküm selam'],
];

// "Selamün  ALEYKÜM!" -> "selamun aleykum" (küçük harf, Türkçe karakter ve noktalama yok)
function normalize(metin) {
  return String(metin)
    .toLocaleLowerCase('tr')
    .replace(/[ıİ]/g, 'i').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const kacis = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Tetik, kelime sınırlarıyla aranır; kelimeler arası boşluk isteğe bağlı ("selamunaleykum" da eşleşir)
const kuralRegex = (tetik) => new RegExp(`(^| )${tetik.split(' ').map(kacis).join(' ?')}( |$)`);

const onbellek = new Map(); // guildId -> [{ id, re, cevap, uzunluk }]

function kurallar(guildId) {
  let k = onbellek.get(guildId);
  if (!k) {
    k = db.prepare('SELECT id, tetik, cevap FROM otocevaplar WHERE guild_id = ?').all(guildId)
      .map((r) => ({ id: r.id, re: kuralRegex(r.tetik), cevap: r.cevap, uzunluk: r.tetik.length }))
      .sort((a, b) => b.uzunluk - a.uzunluk); // uzun ifade önce
    onbellek.set(guildId, k);
  }
  return k;
}

const sonTetik = new Map(); // "guild:user:kural" -> zaman

// Mesaj bir kurala uyuyorsa cevap metnini döner (bekleme süresi dolmadıysa null)
function eslestir(guildId, kullaniciId, icerik) {
  const m = normalize(icerik);
  if (!m) return null;
  for (const k of kurallar(guildId)) {
    if (!k.re.test(m)) continue;
    const anahtar = `${guildId}:${kullaniciId}:${k.id}`;
    const simdi = Date.now();
    if (simdi - (sonTetik.get(anahtar) ?? 0) < BEKLEME_MS) return null;
    sonTetik.set(anahtar, simdi);
    if (sonTetik.size > 5000) for (const [a, z] of sonTetik) if (simdi - z > BEKLEME_MS) sonTetik.delete(a);
    return k.cevap.replaceAll('{kullanici}', `<@${kullaniciId}>`);
  }
  return null;
}

function ekle(guildId, tetikHam, cevap, ekleyenId) {
  const tetik = normalize(tetikHam);
  if (!tetik) return { hata: 'Tetik ifadesi harf veya rakam içermeli.' };
  const sayi = db.prepare('SELECT COUNT(*) AS n FROM otocevaplar WHERE guild_id = ?').get(guildId).n;
  const var_mi = db.prepare('SELECT id FROM otocevaplar WHERE guild_id = ? AND tetik = ?').get(guildId, tetik);
  if (!var_mi && sayi >= EN_COK_KURAL) return { hata: `En fazla ${EN_COK_KURAL} otomatik cevap eklenebilir.` };
  db.prepare(
    `INSERT INTO otocevaplar (guild_id, tetik, tetik_ham, cevap, ekleyen_id, zaman) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, tetik) DO UPDATE SET tetik_ham = excluded.tetik_ham, cevap = excluded.cevap, ekleyen_id = excluded.ekleyen_id, zaman = excluded.zaman`,
  ).run(guildId, tetik, tetikHam.trim(), cevap, ekleyenId, Date.now());
  onbellek.delete(guildId);
  return { guncellendi: Boolean(var_mi) };
}

function sil(guildId, tetikHam) {
  const r = db.prepare('DELETE FROM otocevaplar WHERE guild_id = ? AND tetik = ?').run(guildId, normalize(tetikHam));
  onbellek.delete(guildId);
  return r.changes > 0;
}

const liste = (guildId) => db.prepare('SELECT * FROM otocevaplar WHERE guild_id = ? ORDER BY id').all(guildId);

// Her sunucuya varsayılan kuralları bir kez ekler (sonradan silinirse tekrar eklenmez)
function varsayilanlariEkle(guildId, botId) {
  const anahtar = `otocevap_tohum:${guildId}`;
  if (db.prepare('SELECT 1 FROM meta WHERE anahtar = ?').get(anahtar)) return;
  for (const [t, c] of VARSAYILAN) ekle(guildId, t, c, botId);
  db.prepare('INSERT INTO meta (anahtar, deger) VALUES (?, ?)').run(anahtar, '1');
}

module.exports = { normalize, eslestir, ekle, sil, liste, varsayilanlariEkle, EN_COK_KURAL };
