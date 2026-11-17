// /duzelt motoru: kaynak sunucuyu hedefle karşılaştırır, FARKLARI düzeltir.
// Hiçbir şey silmez. Eşleştirme ada göre yapılır (önceki klonlamadan ID bilgisi kalmadığı için).
// Sıra: roller (+sıralama) > kategoriler (+sıralama) > kanallar (+sıralama) > izinler > sunucu ayarları
const { ChannelType, OverwriteType } = require('discord.js');
const { bekle } = require('./yardimci');
const { SES_TIPLERI, KOPYALANABILIR, TIP_ADI } = require('./yapi');
const { atlamaNedeni, TOPLULUK_NOTU } = require('./kontrol');
const { IptalSinyali } = require('./islem');
const { guvenli, atla, kanalAyarlari, hataMetni } = require('./klonlayici');

const SEBEP = 'SunucuKlon /duzelt';
const BEKLE_KISA = 300;

const bosSayac = () => ({ rol: 0, rolSira: 0, kategori: 0, kanal: 0, kanalSira: 0, izin: 0, ayar: 0, olusturulan: 0 });

// Bir değişikliği uygular (kuru çalıştırmada sadece kaydeder). Başarılıysa fn'in sonucunu (yoksa true) döner.
async function degistir(ctx, sayacAnahtar, aciklama, fn) {
  ctx.rapor.ayrintilar.push(aciklama);
  if (ctx.sec.kuruCalistirma) {
    ctx.rapor.sayac[sayacAnahtar]++;
    return null;
  }
  const s = await guvenli(ctx, aciklama, async () => (await fn()) ?? true);
  if (s) {
    ctx.rapor.sayac[sayacAnahtar]++;
    await bekle(BEKLE_KISA);
  }
  return s || null;
}

// Aynı ada sahip öğeleri sırayla eşleştirmek için: ad -> [öğeler]
function adHavuzu(liste, adAl) {
  const h = new Map();
  for (const x of liste) {
    const a = adAl(x);
    if (!h.has(a)) h.set(a, []);
    h.get(a).push(x);
  }
  return h;
}

const ayniDizi = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// ------------------------------------------------------------------
// 1) ROLLER
// ------------------------------------------------------------------
async function adimRoller(ctx) {
  const { hedef, kaynak, yapi, islem, rolEsle, sec } = ctx;
  const ben = await hedef.members.fetchMe();
  await hedef.roles.fetch();
  const kaynakRoller = [...yapi.roller].sort((a, b) => a.pozisyon - b.pozisyon);
  islem.asama('Roller', kaynakRoller.length + 1);

  // @everyone
  islem.denetle();
  const evIzin = BigInt(yapi.everyoneIzin);
  if (hedef.roles.everyone.permissions.bitfield !== evIzin) {
    await degistir(ctx, 'rol', '@everyone izinleri düzeltildi', () => hedef.roles.everyone.setPermissions(evIzin, SEBEP));
  }
  islem.adim();

  // Bot/yönetilen roller: aynı adlı yönetilen rolü eşle (izinlerin çoğu bunlara aitti)
  const hedefYonetilen = adHavuzu([...hedef.roles.cache.values()].filter((r) => r.managed), (r) => r.name);
  let eslesmeyenYonetilen = 0;
  for (const r of kaynak.roles.cache.values()) {
    if (!r.managed) continue;
    const aday = hedefYonetilen.get(r.name)?.shift();
    if (aday) rolEsle.set(r.id, aday.id);
    else eslesmeyenYonetilen++;
  }
  if (eslesmeyenYonetilen > 0) {
    ctx.rapor.notlar.push(`${eslesmeyenYonetilen} bot/yönetilen rol hedefte bulunamadı (o botlar hedefe eklenmemiş). Bu rollere ait kanal izinleri uygulanamaz. /botlari_listele ile botları ekleyip /duzelt'i tekrar çalıştırabilirsin.`);
  }

  // Normal roller: ada göre eşle
  const havuz = adHavuzu(
    [...hedef.roles.cache.values()].filter((r) => !r.managed && r.id !== hedef.id).sort((a, b) => a.position - b.position),
    (r) => r.name,
  );
  for (const r of kaynakRoller) {
    islem.denetle();
    const t = havuz.get(r.ad)?.shift();
    if (t) {
      rolEsle.set(r.id, t.id);
      const f = {};
      if (t.color !== r.renk) f.color = r.renk;
      if (t.hoist !== r.hoist) f.hoist = r.hoist;
      if (t.mentionable !== r.mentionable) f.mentionable = r.mentionable;
      if (t.permissions.bitfield !== BigInt(r.izin)) f.permissions = BigInt(r.izin);
      if (Object.keys(f).length) {
        if (!t.editable) atla(ctx, `Rol düzeltilemedi (@${r.ad}): bot rolünden yüksek veya eşit`);
        else await degistir(ctx, 'rol', `Rol düzeltildi (@${r.ad}): ${Object.keys(f).join(', ')}`, () => t.edit({ ...f, reason: SEBEP }));
      }
    } else if (sec.olustur) {
      const yeni = await degistir(ctx, 'olusturulan', `Eksik rol oluşturuldu (@${r.ad})`, () =>
        hedef.roles.create({ name: r.ad, color: r.renk, hoist: r.hoist, mentionable: r.mentionable, permissions: BigInt(r.izin), reason: SEBEP }),
      );
      if (yeni && yeni !== true) rolEsle.set(r.id, yeni.id);
    } else atla(ctx, `Rol hedefte yok, oluşturulmadı (@${r.ad})`);
    islem.adim();
  }
  const fazlaRol = [...havuz.values()].flat().length;
  if (fazlaRol > 0) ctx.rapor.notlar.push(`Hedefte kaynakta olmayan ${fazlaRol} rol var. Bunlara dokunulmadı (silinmez).`);

  // Rol hiyerarşisi
  islem.asama('Rol sıralaması', 1);
  await hedef.roles.fetch();
  const istenen = kaynakRoller
    .map((r) => rolEsle.get(r.id))
    .filter(Boolean)
    .map((id) => hedef.roles.cache.get(id))
    .filter((r) => r && !r.managed && r.editable)
    .map((r) => r.id);
  const mevcut = istenen.map((id) => hedef.roles.cache.get(id)).sort((a, b) => a.position - b.position).map((r) => r.id);
  if (!ayniDizi(istenen, mevcut)) {
    const yuvalar = istenen.map((id) => hedef.roles.cache.get(id).position).sort((a, b) => a - b);
    await degistir(ctx, 'rolSira', `Rol sıralaması düzeltildi (${istenen.length} rol)`, () =>
      hedef.roles.setPositions(istenen.map((id, i) => ({ role: id, position: yuvalar[i] }))),
    );
    if (!sec.kuruCalistirma) {
      await hedef.roles.fetch();
      const kontrol = istenen.map((id) => hedef.roles.cache.get(id)).sort((a, b) => a.position - b.position).map((r) => r.id);
      if (!ayniDizi(istenen, kontrol)) {
        ctx.rapor.hatalar.push('Rol sıralaması uygulandı ama kontrol edince hâlâ farklı görünüyor. Bot rolünün listenin en üstünde olduğundan emin ol ve /duzelt\'i tekrar çalıştır.');
        islem.hataSayisi++;
      }
    }
  }
  islem.adim();
}

// ------------------------------------------------------------------
// 2) KATEGORİLER
// ------------------------------------------------------------------
async function adimKategoriler(ctx) {
  const { hedef, yapi, islem, kanalEsle, sec } = ctx;
  await hedef.channels.fetch();
  const kaynakKat = yapi.kanallar.filter((k) => k.tip === ChannelType.GuildCategory).sort((a, b) => a.sira - b.sira);
  islem.asama('Kategoriler', kaynakKat.length);
  const havuz = adHavuzu(
    [...hedef.channels.cache.values()].filter((c) => c.type === ChannelType.GuildCategory).sort((a, b) => a.rawPosition - b.rawPosition),
    (c) => c.name,
  );
  for (const k of kaynakKat) {
    islem.denetle();
    const t = havuz.get(k.ad)?.shift();
    if (t) kanalEsle.set(k.id, t);
    else if (sec.olustur) {
      const yeni = await degistir(ctx, 'olusturulan', `Eksik kategori oluşturuldu (${k.ad})`, () =>
        hedef.channels.create({ name: k.ad, type: ChannelType.GuildCategory, reason: SEBEP }),
      );
      if (yeni && yeni !== true) kanalEsle.set(k.id, yeni);
    } else atla(ctx, `Kategori hedefte yok, oluşturulmadı (${k.ad})`);
    islem.adim();
  }

  // Sıralama: eşleşenler kaynak sırasıyla, fazlalıklar sonda
  await hedef.channels.fetch();
  const eslesen = kaynakKat.map((k) => kanalEsle.get(k.id)).filter(Boolean).map((c) => hedef.channels.cache.get(c.id)).filter(Boolean);
  const eslesenIdler = new Set(eslesen.map((c) => c.id));
  const hepsi = [...hedef.channels.cache.values()].filter((c) => c.type === ChannelType.GuildCategory).sort((a, b) => a.rawPosition - b.rawPosition);
  const fazla = hepsi.filter((c) => !eslesenIdler.has(c.id));
  const istenen = [...eslesen, ...fazla].map((c) => c.id);
  if (!ayniDizi(istenen, hepsi.map((c) => c.id))) {
    await degistir(ctx, 'kanalSira', `Kategori sıralaması düzeltildi (${istenen.length} kategori)`, () =>
      hedef.channels.setPositions(istenen.map((id, i) => ({ channel: id, position: i }))),
    );
  }
}

// ------------------------------------------------------------------
// 3) KANALLAR
// ------------------------------------------------------------------
// Kanalın kaynaktan farklı olan ayarlarını döndürür
function kanalFarklari(hedef, c, k) {
  const f = {};
  const konu = () => {
    if ((c.topic || '') !== (k.konu || '')) f.topic = k.konu || null;
  };
  const nsfw = () => {
    if (Boolean(c.nsfw) !== k.nsfw) f.nsfw = k.nsfw;
  };
  const yavas = () => {
    if ((c.rateLimitPerUser || 0) !== k.yavasMod) f.rateLimitPerUser = k.yavasMod;
  };
  const bitrate = () => {
    if (!k.bitrate) return;
    const b = Math.max(8000, Math.min(k.bitrate, hedef.maximumBitrate));
    if (c.bitrate !== b) f.bitrate = b;
  };
  switch (k.tip) {
    case ChannelType.GuildText:
      konu(); nsfw(); yavas();
      break;
    case ChannelType.GuildAnnouncement:
      konu(); nsfw();
      break;
    case ChannelType.GuildVoice:
      bitrate();
      if ((c.userLimit || 0) !== k.kullaniciLimiti) f.userLimit = k.kullaniciLimiti;
      if ((c.rtcRegion ?? null) !== (k.rtcBolge ?? null)) f.rtcRegion = k.rtcBolge ?? null;
      break;
    case ChannelType.GuildStageVoice:
      konu(); bitrate();
      break;
    case ChannelType.GuildForum:
    case ChannelType.GuildMedia:
      konu(); nsfw(); yavas();
      break;
  }
  return f;
}

const mevcutSira = (liste) =>
  [...liste].sort(
    (a, b) =>
      Number(SES_TIPLERI.has(a.type)) - Number(SES_TIPLERI.has(b.type)) ||
      a.rawPosition - b.rawPosition ||
      (BigInt(a.id) < BigInt(b.id) ? -1 : 1),
  );

async function adimKanallar(ctx) {
  const { hedef, yapi, islem, kanalEsle, sec } = ctx;
  await hedef.channels.fetch();
  const kaynakKanallar = yapi.kanallar.filter((k) => k.tip !== ChannelType.GuildCategory);
  const katSira = new Map(yapi.kanallar.filter((k) => k.tip === ChannelType.GuildCategory).sort((a, b) => a.sira - b.sira).map((k, i) => [k.id, i]));
  kaynakKanallar.sort((a, b) => (a.ustId ? katSira.get(a.ustId) ?? 9999 : -1) - (b.ustId ? katSira.get(b.ustId) ?? 9999 : -1) || a.sira - b.sira);
  islem.asama('Kanallar', kaynakKanallar.length);

  const sahipsiz = new Set(
    [...hedef.channels.cache.values()].filter((c) => KOPYALANABILIR.has(c.type) && c.type !== ChannelType.GuildCategory).map((c) => c.id),
  );
  let toplulukNotu = false;

  for (const k of kaynakKanallar) {
    islem.denetle();
    const neden = atlamaNedeni(hedef, k.tip);
    if (neden) {
      atla(ctx, `Kanal atlandı (${k.ad} - ${TIP_ADI[k.tip]}): ${neden}`);
      if (!toplulukNotu) {
        ctx.rapor.notlar.push(TOPLULUK_NOTU);
        toplulukNotu = true;
      }
      islem.adim();
      continue;
    }
    const ust = k.ustId ? kanalEsle.get(k.ustId) || null : null;
    const adaylar = [...sahipsiz].map((id) => hedef.channels.cache.get(id)).filter((c) => c && c.type === k.tip && c.name === k.ad);
    const t = adaylar.find((c) => (c.parentId || null) === (ust?.id || null)) || adaylar[0];

    if (t) {
      sahipsiz.delete(t.id);
      kanalEsle.set(k.id, t);
      if ((t.parentId || null) !== (ust?.id || null) && (ust || !k.ustId)) {
        await degistir(ctx, 'kanal', `Kanal doğru kategoriye taşındı (${k.ad} ➜ ${ust ? ust.name : 'kategorisiz'})`, () =>
          t.setParent(ust?.id || null, { lockPermissions: false, reason: SEBEP }),
        );
      } else if (k.ustId && !ust) atla(ctx, `Kanal (${k.ad}) için kaynak kategorisi hedefte yok, taşınamadı`);
      const f = kanalFarklari(hedef, t, k);
      if (Object.keys(f).length) {
        await degistir(ctx, 'kanal', `Kanal ayarı düzeltildi (${k.ad}): ${Object.keys(f).join(', ')}`, () => t.edit({ ...f, reason: SEBEP }));
      }
    } else if (sec.olustur) {
      const yeni = await degistir(ctx, 'olusturulan', `Eksik kanal oluşturuldu (${k.ad} - ${TIP_ADI[k.tip]})`, () =>
        hedef.channels.create(kanalAyarlari(ctx, k, ust)),
      );
      if (yeni && yeni !== true) kanalEsle.set(k.id, yeni);
    } else atla(ctx, `Kanal hedefte yok, oluşturulmadı (${k.ad})`);
    islem.adim();
  }
  if (sahipsiz.size > 0) ctx.rapor.notlar.push(`Hedefte kaynakta olmayan ${sahipsiz.size} kanal var. Bunlara dokunulmadı (silinmez).`);

  // Sıralama: her kategorinin içi (ve kategorisizler) kaynaktaki gibi
  islem.asama('Kanal sıralaması', 1);
  await hedef.channels.fetch();
  const gruplar = new Map(); // üst id | 'yok' -> [{k, c}]
  for (const k of kaynakKanallar) {
    const c = kanalEsle.get(k.id) && hedef.channels.cache.get(kanalEsle.get(k.id).id);
    if (!c) continue;
    const anahtar = c.parentId || 'yok';
    if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
    gruplar.get(anahtar).push({ k, c });
  }
  for (const [anahtar, liste] of gruplar) {
    islem.denetle();
    const eslesenler = liste.sort((a, b) => a.k.sira - b.k.sira).map((x) => x.c);
    const idler = new Set(eslesenler.map((c) => c.id));
    const grupHepsi = [...hedef.channels.cache.values()].filter((c) => c.type !== ChannelType.GuildCategory && (c.parentId || 'yok') === anahtar && !c.isThread?.());
    const fazla = mevcutSira(grupHepsi.filter((c) => !idler.has(c.id)));
    const istenen = [...eslesenler, ...fazla].map((c) => c.id);
    const mevcut = mevcutSira(grupHepsi).map((c) => c.id);
    if (!ayniDizi(istenen, mevcut)) {
      const ad = anahtar === 'yok' ? 'kategorisiz kanallar' : hedef.channels.cache.get(anahtar)?.name || anahtar;
      await degistir(ctx, 'kanalSira', `Kanal sıralaması düzeltildi (${ad}: ${istenen.length} kanal)`, () =>
        hedef.channels.setPositions(istenen.map((id, i) => ({ channel: id, position: i }))),
      );
    }
  }
  islem.adim();
}

// ------------------------------------------------------------------
// 4) İZİNLER
// ------------------------------------------------------------------
async function adimIzinler(ctx) {
  const { hedef, kaynak, yapi, islem, rolEsle, kanalEsle } = ctx;
  await hedef.channels.fetch();
  const kaynakMap = new Map(yapi.kanallar.map((k) => [k.id, k]));
  const eslesenler = [...kanalEsle.entries()].filter(([id]) => kaynakMap.has(id));
  islem.asama('Kanal izinleri', eslesenler.length);
  const eslesmeyen = new Map(); // kaynak rol id -> kayıt sayısı

  for (const [kid, c0] of eslesenler) {
    islem.denetle();
    const c = hedef.channels.cache.get(c0.id) || c0;
    const k = kaynakMap.get(kid);
    const istenen = [];
    for (const o of k.izinler) {
      const yeni = rolEsle.get(o.rolId);
      if (!yeni) {
        eslesmeyen.set(o.rolId, (eslesmeyen.get(o.rolId) || 0) + 1);
        continue;
      }
      istenen.push({ id: yeni, type: OverwriteType.Role, allow: BigInt(o.izin), deny: BigInt(o.yasak) });
    }
    const istenenIdler = new Set(istenen.map((o) => o.id));
    const mevcutHepsi = [...c.permissionOverwrites.cache.values()];
    // Dokunulmayanlar: üyeye özel izinler ve istenmeyen yönetilen (bot) rol izinleri
    const korunan = mevcutHepsi.filter(
      (o) => o.type === OverwriteType.Member || (hedef.roles.cache.get(o.id)?.managed && !istenenIdler.has(o.id)),
    );
    const korunanIdler = new Set(korunan.map((o) => o.id));
    const mevcutRol = mevcutHepsi.filter((o) => !korunanIdler.has(o.id));
    const fark =
      istenen.length !== mevcutRol.length ||
      istenen.some((d) => {
        const m = mevcutRol.find((x) => x.id === d.id);
        return !m || m.allow.bitfield !== d.allow || m.deny.bitfield !== d.deny;
      });
    if (fark) {
      const son = [...istenen, ...korunan.map((o) => ({ id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield }))];
      await degistir(ctx, 'izin', `İzinler düzeltildi (${c.name}): ${istenen.length} rol izni`, () => c.permissionOverwrites.set(son, SEBEP));
    }
    islem.adim();
  }

  if (eslesmeyen.size > 0) {
    const toplam = [...eslesmeyen.values()].reduce((t, n) => t + n, 0);
    const adlar = [...eslesmeyen.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, n]) => `@${kaynak.roles.cache.get(id)?.name || id} (${n})`)
      .join(', ');
    atla(ctx, `${toplam} izin kaydı uygulanamadı, hedefte karşılığı olmayan rollere ait: ${adlar}${eslesmeyen.size > 10 ? ' ...' : ''}`);
  }
}

// ------------------------------------------------------------------
// 5) SUNUCU AYARLARI
// ------------------------------------------------------------------
async function adimSunucu(ctx) {
  const { hedef, yapi, islem, kanalEsle } = ctx;
  const s = yapi.sunucu;
  islem.asama('Sunucu ayarları', 1);
  const f = {};
  if (s.dogrulama != null && hedef.verificationLevel !== s.dogrulama) f.verificationLevel = s.dogrulama;
  if (s.bildirim != null && hedef.defaultMessageNotifications !== s.bildirim) f.defaultMessageNotifications = s.bildirim;
  if (s.afkSure != null && hedef.afkTimeout !== s.afkSure) f.afkTimeout = s.afkSure;
  if ((hedef.systemChannelFlags?.bitfield ?? 0) !== s.sistemBayraklari) f.systemChannelFlags = s.sistemBayraklari;
  const afk = s.afkKanalId ? kanalEsle.get(s.afkKanalId) : null;
  if (afk && afk.type === ChannelType.GuildVoice && hedef.afkChannelId !== afk.id) f.afkChannel = afk.id;
  const sistem = s.sistemKanalId ? kanalEsle.get(s.sistemKanalId) : null;
  if (sistem && sistem.type === ChannelType.GuildText && hedef.systemChannelId !== sistem.id) f.systemChannel = sistem.id;
  if (Object.keys(f).length) {
    await degistir(ctx, 'ayar', `Sunucu ayarları düzeltildi: ${Object.keys(f).join(', ')}`, () => hedef.edit({ ...f, reason: SEBEP }));
  }
  islem.adim();
}

// ------------------------------------------------------------------
// ANA FONKSİYON
// ------------------------------------------------------------------
async function duzelt(kaynak, hedef, yapi, sec, islem) {
  const ctx = {
    kaynak,
    hedef,
    yapi,
    sec,
    islem,
    rolEsle: new Map(),
    kanalEsle: new Map(),
    rapor: { sayac: bosSayac(), atlanan: [], hatalar: [], notlar: [], ayrintilar: [], iptal: false },
  };
  ctx.rolEsle.set(kaynak.id, hedef.id); // @everyone
  try {
    islem.asama('Hazırlık', 0);
    await Promise.all([hedef.roles.fetch(), hedef.channels.fetch(), kaynak.roles.fetch()]);
    await adimRoller(ctx);
    await adimKategoriler(ctx);
    await adimKanallar(ctx);
    await adimIzinler(ctx);
    await adimSunucu(ctx);
  } catch (e) {
    if (e instanceof IptalSinyali) {
      ctx.rapor.iptal = true;
      ctx.rapor.notlar.push('İşlem iptal edildi. Bu noktaya kadar yapılan düzeltmeler hedefte kaldı.');
    } else {
      ctx.rapor.hatalar.push(`Beklenmeyen hata: ${hataMetni(e)}`);
      islem.hataSayisi++;
      console.error('[BEKLENMEYEN HATA]', e);
    }
  }
  const c = ctx.rapor.sayac;
  const onEk = sec.kuruCalistirma ? 'Düzeltilecek' : 'Düzeltilen';
  ctx.rapor.ozelBasarili = [
    `${onEk} rol: ${c.rol} (sıralama: ${c.rolSira})`,
    `${onEk} kanal/kategori ayarı: ${c.kanal}`,
    `${onEk} sıralama grubu: ${c.kanalSira}`,
    `${onEk} kanal izni: ${c.izin} kanal`,
    `${onEk} sunucu ayarı: ${c.ayar}`,
    `${sec.kuruCalistirma ? 'Oluşturulacak' : 'Oluşturulan'} eksik öğe: ${c.olusturulan}`,
  ];
  ctx.rapor.basariBasligi = sec.kuruCalistirma ? '🧪 Kuru çalıştırma bitti (hiçbir şey değiştirilmedi)' : '✅ Düzeltme başarıyla bitti';
  ctx.rapor.dosyaAdi = sec.kuruCalistirma ? 'duzelt-plani.txt' : 'duzelt-raporu.txt';
  return ctx.rapor;
}

module.exports = { duzelt };
