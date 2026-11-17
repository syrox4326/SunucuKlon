// Serbest yazılmış süreyi milisaniyeye çevirir: "24 saat", "1 gün", "90dk", "1g 12sa", "2h", "1.5 saat"...
const BIRIMLER = {
  sn: 1000, sny: 1000, saniye: 1000, sec: 1000, second: 1000, seconds: 1000,
  dk: 60_000, dak: 60_000, dakika: 60_000, min: 60_000, mins: 60_000, minute: 60_000, minutes: 60_000, m: 60_000,
  sa: 3_600_000, saat: 3_600_000, h: 3_600_000, hr: 3_600_000, hrs: 3_600_000, hour: 3_600_000, hours: 3_600_000,
  g: 86_400_000, gun: 86_400_000, gün: 86_400_000, d: 86_400_000, day: 86_400_000, days: 86_400_000,
  hf: 604_800_000, hafta: 604_800_000, w: 604_800_000, week: 604_800_000, weeks: 604_800_000,
};

const DAKIKA = 60_000;
const GUN = 86_400_000;
const EN_AZ = DAKIKA;
const EN_COK = 7 * GUN;

const ORNEK = 'Örnekler: `30 dakika`, `24 saat`, `1 gün`, `1g 12sa`, `90dk`';

// Döner: { ms } veya { hata }
function sureCoz(metin) {
  const ham = String(metin ?? '').toLocaleLowerCase('tr').trim();
  if (!ham) return { hata: 'Süre yazmadın. ' + ORNEK };

  const parca = /(\d+(?:[.,]\d+)?)\s*([a-zçğıöşü]+)/g;
  let toplam = 0;
  let eslesen = 0;
  for (const m of ham.matchAll(parca)) {
    const katsayi = BIRIMLER[m[2]];
    if (!katsayi) return { hata: `"${m[2]}" birimini anlamadım. Kullanabileceklerin: sn, dk, saat (sa), gün (g), hafta (hf). ${ORNEK}` };
    toplam += parseFloat(m[1].replace(',', '.')) * katsayi;
    eslesen++;
  }
  // Eşleşmeyen artık kalmış mı? (sadece boşluk, virgül, "ve", "+" serbest)
  const artik = ham.replace(parca, '').replace(/\b(ve|and)\b/g, '').replace(/[\s,+]/g, '');
  if (eslesen === 0 || artik) return { hata: 'Süreyi anlayamadım. Sayının yanına birim de yaz. ' + ORNEK };

  const ms = Math.round(toplam);
  if (ms < EN_AZ) return { hata: 'Süre en az 1 dakika olmalı.' };
  if (ms > EN_COK) return { hata: 'Süre en fazla 7 gün olabilir.' };
  return { ms };
}

// 90_000_000 -> "1 gün 1 saat"
function sureYaz(ms) {
  const g = Math.floor(ms / GUN);
  const sa = Math.floor((ms % GUN) / 3_600_000);
  const dk = Math.round((ms % 3_600_000) / DAKIKA);
  const p = [];
  if (g) p.push(`${g} gün`);
  if (sa) p.push(`${sa} saat`);
  if (dk && p.length < 2) p.push(`${dk} dakika`);
  return p.join(' ') || '1 dakika';
}

module.exports = { sureCoz, sureYaz, EN_COK };
