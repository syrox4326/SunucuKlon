// Ana klonlama motoru. Yapı nesnesini (yapi) hedef sunucuya uygular.
// Sıra: temizle > roller > kategoriler > kanallar > izinler > sunucu ayarları > emoji/çıkartma
const { ChannelType, OverwriteType } = require('discord.js');
const { IptalSinyali } = require('./islem');
const { bekle, cdnMi, statikYap } = require('./yardimci');
const { SES_TIPLERI, TIP_ADI } = require('./yapi');
const { atlamaNedeni, silinecekRoller, TOPLULUK_NOTU, EMOJI_LIMITLERI, CIKARTMA_LIMITLERI } = require('./kontrol');

const SEBEP = 'SunucuKlon';
const BEKLE_KISA = 300; // her istekten sonra kısa bekleme (ms)
const BEKLE_UZUN = 800; // emoji/çıkartma gibi yavaş işler için

// Discord hata kodlarını sade Türkçeye çevirir.
function hataMetni(e) {
  const kodlar = {
    50013: 'Botun izni yetmiyor (bot rolü yeterince yüksek olmayabilir)',
    50001: 'Botun buna erişimi yok',
    30005: 'Rol sınırına (250) ulaşıldı',
    30013: 'Kanal sınırına (500) ulaşıldı',
    30008: 'Emoji sınırına ulaşıldı',
    30039: 'Çıkartma sınırına ulaşıldı',
    50074: 'Bu kanal Topluluk için gerekli olduğu için silinemez',
    50035: 'Geçersiz değer gönderildi',
    50045: 'Dosya çok büyük',
    50046: 'Geçersiz dosya türü',
    50093: 'Hedefte Topluluk özelliği kapalı',
  };
  const temel = kodlar[e?.code] || e?.message || String(e);
  return e?.code && kodlar[e.code] && e.message ? `${temel} (${e.message.split('\n')[0]})` : temel;
}

// Bir adımı güvenle çalıştırır: hata olursa kaydeder ve devam eder. İptal sinyalini yutmaz.
async function guvenli(ctx, etiket, fn) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof IptalSinyali) throw e;
    ctx.rapor.hatalar.push(`${etiket}: ${hataMetni(e)}`);
    ctx.islem.hataSayisi++;
    console.error(`[HATA] ${etiket}:`, e);
    return undefined;
  }
}

function atla(ctx, mesaj) {
  ctx.rapor.atlanan.push(mesaj);
  ctx.islem.atlananSayisi++;
}

// undefined/null değerleri nesneden çıkarır (Discord'a gereksiz alan göndermemek için)
function temizNesne(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));
}

// ------------------------------------------------------------------
// 1) TEMİZLE
// ------------------------------------------------------------------
async function adimTemizle(ctx) {
  const { hedef, islem } = ctx;
  const kanallar = [...hedef.channels.cache.values()];
  // Önce kanallar, en son kategoriler
  const sirali = [
    ...kanallar.filter((k) => k.type !== ChannelType.GuildCategory),
    ...kanallar.filter((k) => k.type === ChannelType.GuildCategory),
  ];
  islem.asama('Hedefteki kanalları silme', sirali.length);
  for (const k of sirali) {
    islem.denetle();
    if (!k.deletable) atla(ctx, `Kanal silinemedi (#${k.name}): bot yetkisi yetmiyor`);
    else {
      const s = await guvenli(ctx, `Kanal silme (#${k.name})`, () => k.delete(SEBEP).then(() => true));
      if (s) ctx.rapor.sayac.silinenKanal++;
    }
    islem.adim();
    await bekle(BEKLE_KISA);
  }

  const roller = silinecekRoller(hedef);
  islem.asama('Hedefteki rolleri silme', roller.length);
  for (const r of roller) {
    islem.denetle();
    if (!r.editable) atla(ctx, `Rol silinemedi (@${r.name}): bot rolünden yüksek`);
    else {
      const s = await guvenli(ctx, `Rol silme (@${r.name})`, () => r.delete(SEBEP).then(() => true));
      if (s) ctx.rapor.sayac.silinenRol++;
    }
    islem.adim();
    await bekle(BEKLE_KISA);
  }
}

// ------------------------------------------------------------------
// 2) ROLLER
// ------------------------------------------------------------------
async function adimRoller(ctx) {
  const { hedef, yapi, islem, rolEsle } = ctx;
  const ikonDestegi = (hedef.features || []).includes('ROLE_ICONS');
  const roller = [...yapi.roller].sort((a, b) => a.pozisyon - b.pozisyon); // en alttan en üste
  islem.asama('Roller', roller.length);

  // @everyone izinleri
  await guvenli(ctx, '@everyone izinleri', () => hedef.roles.everyone.setPermissions(BigInt(yapi.everyoneIzin), SEBEP));

  let ikonAtlanan = 0;
  for (const r of roller) {
    islem.denetle();
    const temel = { name: r.ad, color: r.renk, hoist: r.hoist, mentionable: r.mentionable, permissions: BigInt(r.izin), reason: SEBEP };
    const ikonlu = ikonDestegi && ((r.ikon && cdnMi(r.ikon)) || r.emoji);
    const yeni = await guvenli(ctx, `Rol (@${r.ad})`, async () => {
      if (ikonlu) {
        try {
          return await hedef.roles.create({ ...temel, ...(r.emoji ? { unicodeEmoji: r.emoji } : { icon: r.ikon }) });
        } catch (e) {
          ikonAtlanan++; // ikon yüzünden olduysa ikonsuz tekrar dene
        }
      } else if (r.ikon || r.emoji) ikonAtlanan++;
      return hedef.roles.create(temel);
    });
    if (yeni) {
      rolEsle.set(r.id, yeni.id);
      ctx.rapor.sayac.rol++;
    }
    islem.adim();
    await bekle(BEKLE_KISA);
  }
  if (ikonAtlanan > 0) atla(ctx, `${ikonAtlanan} rolün ikonu/emojisi atlandı (hedef boost seviyesi yetersiz veya ikon geçersiz)`);

  // Hiyerarşi: oluşturulan rollerin kapladığı sıra yuvalarını, kaynaktaki sıraya göre dağıt.
  // (Başka rollerin sırasına dokunmaz.)
  islem.asama('Rol hiyerarşisi', 1);
  await guvenli(ctx, 'Rol sıralaması', async () => {
    await hedef.roles.fetch();
    const yeniIdler = roller.map((r) => rolEsle.get(r.id)).filter(Boolean); // kaynaktaki sırayla
    const yuvalar = yeniIdler.map((id) => hedef.roles.cache.get(id)?.position).filter((p) => p !== undefined).sort((a, b) => a - b);
    if (yuvalar.length !== yeniIdler.length) throw new Error('Bazı roller bulunamadı');
    await hedef.roles.setPositions(yeniIdler.map((id, i) => ({ role: id, position: yuvalar[i] })));
  });
  islem.adim();
}

// ------------------------------------------------------------------
// 3) KATEGORİLER
// ------------------------------------------------------------------
async function adimKategoriler(ctx) {
  const { hedef, yapi, islem, kanalEsle } = ctx;
  const kategoriler = yapi.kanallar.filter((k) => k.tip === ChannelType.GuildCategory).sort((a, b) => a.sira - b.sira);
  islem.asama('Kategoriler', kategoriler.length);
  for (const k of kategoriler) {
    islem.denetle();
    const yeni = await guvenli(ctx, `Kategori (${k.ad})`, () =>
      hedef.channels.create({ name: k.ad, type: ChannelType.GuildCategory, reason: SEBEP }),
    );
    if (yeni) {
      kanalEsle.set(k.id, yeni);
      ctx.rapor.sayac.kategori++;
    }
    islem.adim();
    await bekle(BEKLE_KISA);
  }
  // Kategori sırasını kaynaktaki gibi ayarla
  await guvenli(ctx, 'Kategori sıralaması', async () => {
    const liste = kategoriler.map((k, i) => ({ k, i })).filter(({ k }) => kanalEsle.has(k.id));
    if (liste.length) await hedef.channels.setPositions(liste.map(({ k, i }) => ({ channel: kanalEsle.get(k.id).id, position: i })));
  });
}

// ------------------------------------------------------------------
// 4) KANALLAR
// ------------------------------------------------------------------
// Kanal türüne göre oluşturma ayarlarını hazırlar
function kanalAyarlari(ctx, k, ust) {
  const { hedef } = ctx;
  const a = { name: k.ad, type: k.tip, parent: ust?.id, reason: SEBEP };
  switch (k.tip) {
    case ChannelType.GuildText:
      Object.assign(a, { topic: k.konu || undefined, nsfw: k.nsfw, rateLimitPerUser: k.yavasMod, defaultAutoArchiveDuration: k.otoArsiv });
      break;
    case ChannelType.GuildAnnouncement:
      Object.assign(a, { topic: k.konu || undefined, nsfw: k.nsfw, defaultAutoArchiveDuration: k.otoArsiv });
      break;
    case ChannelType.GuildVoice:
      Object.assign(a, {
        bitrate: k.bitrate ? Math.max(8000, Math.min(k.bitrate, hedef.maximumBitrate)) : undefined,
        userLimit: k.kullaniciLimiti,
        rtcRegion: k.rtcBolge,
        videoQualityMode: k.videoKalitesi,
        nsfw: k.nsfw,
        rateLimitPerUser: k.yavasMod || undefined,
      });
      break;
    case ChannelType.GuildStageVoice:
      Object.assign(a, {
        topic: k.konu || undefined,
        bitrate: k.bitrate ? Math.max(8000, Math.min(k.bitrate, hedef.maximumBitrate)) : undefined,
        rtcRegion: k.rtcBolge,
      });
      break;
    case ChannelType.GuildForum:
    case ChannelType.GuildMedia: {
      // Etiket emojisi: sadece normal (unicode) emoji korunur, özel emojiler hedefte olmadığı için düşer
      const etiketler = k.etiketler.map((t) => ({
        name: t.ad,
        moderated: t.moderated,
        ...(t.emojiAd && !t.emojiId ? { emoji: { id: null, name: t.emojiAd } } : {}),
      }));
      const tepki = k.varsayilanTepki && !k.varsayilanTepki.id && k.varsayilanTepki.ad
        ? { id: null, name: k.varsayilanTepki.ad }
        : undefined;
      Object.assign(a, {
        topic: k.konu || undefined,
        nsfw: k.nsfw,
        rateLimitPerUser: k.yavasMod,
        availableTags: etiketler.length ? etiketler : undefined,
        defaultReactionEmoji: tepki,
        defaultThreadRateLimitPerUser: k.konuYavasMod,
        defaultSortOrder: k.siralamaTuru,
        defaultForumLayout: k.tip === ChannelType.GuildForum ? k.forumDuzeni : undefined,
        defaultAutoArchiveDuration: k.otoArsiv,
      });
      break;
    }
  }
  return temizNesne(a);
}

async function adimKanallar(ctx) {
  const { hedef, yapi, islem, kanalEsle } = ctx;
  const kategoriSirasi = new Map(
    yapi.kanallar.filter((k) => k.tip === ChannelType.GuildCategory).sort((a, b) => a.sira - b.sira).map((k, i) => [k.id, i]),
  );
  // Önce kategorisiz kanallar, sonra kategorilerin altındakiler (kategori sırası, sonra kanal sırası)
  const kanallar = yapi.kanallar
    .filter((k) => k.tip !== ChannelType.GuildCategory)
    .sort((a, b) => (a.ustId ? kategoriSirasi.get(a.ustId) ?? 9999 : -1) - (b.ustId ? kategoriSirasi.get(b.ustId) ?? 9999 : -1) || a.sira - b.sira);
  islem.asama('Kanallar', kanallar.length);

  let toplulukNotuEklendi = false;
  const olusanlar = []; // pozisyon ayarı için { kaynak, yeni }
  for (const k of kanallar) {
    islem.denetle();
    const neden = atlamaNedeni(hedef, k.tip);
    if (neden) {
      atla(ctx, `Kanal atlandı (${k.ad} - ${TIP_ADI[k.tip]}): ${neden}`);
      if (!toplulukNotuEklendi) {
        ctx.rapor.notlar.push(TOPLULUK_NOTU);
        toplulukNotuEklendi = true;
      }
      islem.adim();
      continue;
    }
    let ust = null;
    if (k.ustId) {
      ust = kanalEsle.get(k.ustId) || null;
      if (!ust) atla(ctx, `Kanal (${k.ad}) kategorisi oluşturulamadığı için kategorisiz açıldı`);
    }
    const yeni = await guvenli(ctx, `Kanal (${k.ad})`, () => hedef.channels.create(kanalAyarlari(ctx, k, ust)));
    if (yeni) {
      kanalEsle.set(k.id, yeni);
      olusanlar.push({ k, yeni });
      ctx.rapor.sayac.kanal++;
    }
    islem.adim();
    await bekle(BEKLE_KISA + 200);
  }

  // Kanal sıralaması: her kategori için ayrı ayrı, kaynaktaki sırayla
  const gruplar = new Map();
  for (const o of olusanlar) {
    const anahtar = o.k.ustId || 'yok';
    if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
    gruplar.get(anahtar).push(o);
  }
  for (const [anahtar, liste] of gruplar) {
    await guvenli(ctx, 'Kanal sıralaması', () =>
      hedef.channels.setPositions(liste.sort((a, b) => a.k.sira - b.k.sira).map((o, i) => ({ channel: o.yeni.id, position: i }))),
    );
    await bekle(BEKLE_KISA);
  }
}

// ------------------------------------------------------------------
// 5) KANAL / KATEGORİ İZİNLERİ (eski rol ID -> yeni rol ID tablosu ile)
// ------------------------------------------------------------------
async function adimIzinler(ctx) {
  const { yapi, islem, rolEsle, kanalEsle } = ctx;
  const hedefler = yapi.kanallar.filter((k) => kanalEsle.has(k.id));
  islem.asama('Kanal izinleri', hedefler.length);
  let atlananRol = 0;
  for (const k of hedefler) {
    islem.denetle();
    const liste = [];
    for (const o of k.izinler) {
      const yeniRol = rolEsle.get(o.rolId);
      if (!yeniRol) {
        atlananRol++; // bot rolü, yönetilen rol veya oluşturulamayan rol
        continue;
      }
      liste.push({ id: yeniRol, type: OverwriteType.Role, allow: BigInt(o.izin), deny: BigInt(o.yasak) });
    }
    // Boş liste de uygulanır: yeni kanal kategoriden izin kopyalamış olabilir, kaynaktaki gibi olsun
    const s = await guvenli(ctx, `İzinler (${k.ad})`, () => kanalEsle.get(k.id).permissionOverwrites.set(liste, SEBEP).then(() => liste.length));
    if (s !== undefined) ctx.rapor.sayac.izin += s;
    islem.adim();
    await bekle(BEKLE_KISA);
  }
  if (atlananRol > 0) atla(ctx, `${atlananRol} izin kaydı atlandı (bot/yönetilen rol veya oluşturulamayan rollere ait)`);
}

// ------------------------------------------------------------------
// 6) SUNUCU AYARLARI
// ------------------------------------------------------------------
async function adimSunucu(ctx) {
  const { hedef, yapi, islem, kanalEsle } = ctx;
  const s = yapi.sunucu;
  const ozellik = hedef.features || [];
  islem.asama('Sunucu ayarları', 1);

  const ayar = temizNesne({
    name: s.ad || undefined,
    verificationLevel: s.dogrulama,
    defaultMessageNotifications: s.bildirim,
    afkTimeout: s.afkSure,
    systemChannelFlags: s.sistemBayraklari,
    reason: SEBEP,
  });
  const afk = s.afkKanalId ? kanalEsle.get(s.afkKanalId) : null;
  if (afk && afk.type === ChannelType.GuildVoice) ayar.afkChannel = afk.id;
  else if (s.afkKanalId) atla(ctx, 'AFK kanalı ayarlanamadı (kanal oluşturulamadı veya ses kanalı değil)');
  const sistem = s.sistemKanalId ? kanalEsle.get(s.sistemKanalId) : null;
  if (sistem && sistem.type === ChannelType.GuildText) ayar.systemChannel = sistem.id;
  else if (s.sistemKanalId) atla(ctx, 'Sistem mesajları kanalı ayarlanamadı (kanal oluşturulamadı veya metin kanalı değil)');

  const sonuc = await guvenli(ctx, 'Sunucu ayarları', () => hedef.edit(ayar).then(() => true));
  if (sonuc) ctx.rapor.sayac.ayar++;
  await bekle(BEKLE_KISA);

  // İkon: hareketli ikon desteği yoksa sabit hale getir
  if (s.ikon && cdnMi(s.ikon)) {
    const url = ozellik.includes('ANIMATED_ICON') ? s.ikon : statikYap(s.ikon);
    const ok = await guvenli(ctx, 'Sunucu ikonu', () => hedef.setIcon(url, SEBEP).then(() => true));
    if (ok) ctx.rapor.sayac.ayar++;
  } else if (s.ikon) atla(ctx, 'Sunucu ikonu atlandı (güvenli olmayan bağlantı)');

  // Banner: boost seviyesi 2 gerekir
  if (s.banner) {
    if (!ozellik.includes('BANNER')) atla(ctx, 'Sunucu banner\'ı atlandı: hedefin boost seviyesi yetersiz (Seviye 2 gerekir)');
    else if (cdnMi(s.banner)) {
      const ok = await guvenli(ctx, 'Sunucu banner\'ı', () => hedef.setBanner(s.banner, SEBEP).then(() => true));
      if (ok) ctx.rapor.sayac.ayar++;
    }
  }
  islem.adim();
}

// ------------------------------------------------------------------
// 7) EMOJİ VE ÇIKARTMALAR
// ------------------------------------------------------------------
async function adimEmoji(ctx) {
  const { hedef, yapi, islem } = ctx;
  const tier = hedef.premiumTier;
  await Promise.all([hedef.emojis.fetch().catch(() => null), hedef.stickers.fetch().catch(() => null)]);

  // Emojiler (statik ve hareketli limitleri ayrı)
  islem.asama('Emojiler', yapi.emojiler.length);
  const kullanilan = {
    statik: hedef.emojis.cache.filter((e) => !e.animated).size,
    hareketli: hedef.emojis.cache.filter((e) => e.animated).size,
  };
  let emojiLimitAtlanan = 0;
  for (const e of yapi.emojiler) {
    islem.denetle();
    const tur = e.animasyon ? 'hareketli' : 'statik';
    if (kullanilan[tur] >= EMOJI_LIMITLERI[tier]) emojiLimitAtlanan++;
    else if (!cdnMi(e.url)) atla(ctx, `Emoji atlandı (${e.ad}): güvenli olmayan bağlantı`);
    else {
      const yeni = await guvenli(ctx, `Emoji (${e.ad})`, () => hedef.emojis.create({ attachment: e.url, name: e.ad, reason: SEBEP }));
      if (yeni) {
        kullanilan[tur]++;
        ctx.rapor.sayac.emoji++;
      }
      await bekle(BEKLE_UZUN);
    }
    islem.adim();
  }
  if (emojiLimitAtlanan > 0) atla(ctx, `${emojiLimitAtlanan} emoji atlandı: hedefin emoji limiti doldu (boost seviyesi ${tier}: ${EMOJI_LIMITLERI[tier]})`);

  // Çıkartmalar
  islem.asama('Çıkartmalar', yapi.cikartmalar.length);
  let cikartmaKullanilan = hedef.stickers.cache.size;
  let cikartmaLimitAtlanan = 0;
  for (const c of yapi.cikartmalar) {
    islem.denetle();
    if (c.format === 3) atla(ctx, `Çıkartma atlandı (${c.ad}): Lottie biçimi sadece ortak sunucularda desteklenir`);
    else if (cikartmaKullanilan >= CIKARTMA_LIMITLERI[tier]) cikartmaLimitAtlanan++;
    else if (!cdnMi(c.url)) atla(ctx, `Çıkartma atlandı (${c.ad}): güvenli olmayan bağlantı`);
    else {
      const yeni = await guvenli(ctx, `Çıkartma (${c.ad})`, () =>
        hedef.stickers.create({ file: c.url, name: c.ad, tags: c.etiket || c.ad, description: c.aciklama || undefined, reason: SEBEP }),
      );
      if (yeni) {
        cikartmaKullanilan++;
        ctx.rapor.sayac.cikartma++;
      }
      await bekle(BEKLE_UZUN);
    }
    islem.adim();
  }
  if (cikartmaLimitAtlanan > 0) atla(ctx, `${cikartmaLimitAtlanan} çıkartma atlandı: hedefin çıkartma limiti doldu (boost seviyesi ${tier}: ${CIKARTMA_LIMITLERI[tier]})`);
}

// ------------------------------------------------------------------
// ANA FONKSİYON
// ------------------------------------------------------------------
async function uygula(hedef, yapi, sec, islem) {
  const ctx = {
    hedef,
    yapi,
    sec,
    islem,
    rolEsle: new Map(), // eski rol ID -> yeni rol ID
    kanalEsle: new Map(), // eski kanal ID -> yeni kanal nesnesi
    rapor: {
      sayac: { silinenKanal: 0, silinenRol: 0, rol: 0, kategori: 0, kanal: 0, izin: 0, ayar: 0, emoji: 0, cikartma: 0 },
      atlanan: [],
      hatalar: [],
      notlar: [],
      iptal: false,
    },
  };
  // @everyone rolünün ID'si sunucu ID'sine eşittir; izin eşlemesi için tabloya ekle
  ctx.rolEsle.set(yapi.kaynakId, hedef.id);

  try {
    islem.asama('Hazırlık', 0);
    await Promise.all([hedef.roles.fetch(), hedef.channels.fetch()]);
    if (sec.temizle) await adimTemizle(ctx);
    await adimRoller(ctx);
    await adimKategoriler(ctx);
    await adimKanallar(ctx);
    await adimIzinler(ctx);
    await adimSunucu(ctx);
    if (sec.emoji) await adimEmoji(ctx);
  } catch (e) {
    if (e instanceof IptalSinyali) {
      ctx.rapor.iptal = true;
      ctx.rapor.notlar.push('İşlem iptal edildi. Bu noktaya kadar yapılanlar hedefte kaldı.');
    } else {
      ctx.rapor.hatalar.push(`Beklenmeyen hata: ${hataMetni(e)}`);
      islem.hataSayisi++;
      console.error('[BEKLENMEYEN HATA]', e);
    }
  }
  return ctx.rapor;
}

// ------------------------------------------------------------------
// KURU ÇALIŞTIRMA: hiçbir şey yapmadan ne yapılacağını listeler
// ------------------------------------------------------------------
function kuruPlan(hedef, yapi, sec) {
  const s = [];
  const baslik = (t) => s.push('', `=== ${t} ===`);
  s.push('KURU ÇALIŞTIRMA PLANI (hiçbir değişiklik yapılmadı)', `Kaynak: ${yapi.kaynakAd}`, `Hedef: ${hedef.name}`);

  if (sec.temizle) {
    baslik('SİLİNECEKLER (hedefte)');
    const kanallar = [...hedef.channels.cache.values()];
    const roller = silinecekRoller(hedef);
    s.push(`${kanallar.length} kanal/kategori silinecek:`, ...kanallar.map((k) => `  - ${k.name}`));
    s.push(`${roller.length} rol silinecek:`, ...roller.map((r) => `  - @${r.name}`));
  }

  baslik('ROLLER (aşağıdan yukarıya)');
  s.push(`@everyone izinleri kopyalanacak`);
  for (const r of [...yapi.roller].sort((a, b) => a.pozisyon - b.pozisyon)) {
    const ek = [r.hoist ? 'ayrı listele' : null, r.mentionable ? 'etiketlenebilir' : null, r.ikon || r.emoji ? 'ikonlu' : null].filter(Boolean);
    s.push(`  + @${r.ad}${ek.length ? ` (${ek.join(', ')})` : ''}`);
  }

  baslik('KATEGORİLER VE KANALLAR');
  const kategoriler = yapi.kanallar.filter((k) => k.tip === ChannelType.GuildCategory).sort((a, b) => a.sira - b.sira);
  const cocuklar = (id) => yapi.kanallar.filter((k) => k.tip !== ChannelType.GuildCategory && k.ustId === id).sort((a, b) => a.sira - b.sira);
  const yaz = (k, girinti) => {
    const neden = atlamaNedeni(hedef, k.tip);
    s.push(`${girinti}${neden ? 'x' : '+'} [${TIP_ADI[k.tip]}] ${k.ad}${neden ? `  --> ATLANIR: ${neden}` : ''}`);
  };
  cocuklar(null).forEach((k) => yaz(k, '  '));
  for (const kat of kategoriler) {
    s.push(`  + [Kategori] ${kat.ad}`);
    cocuklar(kat.id).forEach((k) => yaz(k, '      '));
  }

  baslik('İZİNLER');
  s.push(`${yapi.kanallar.reduce((t, k) => t + k.izinler.length, 0)} rol bazlı kanal/kategori izni uygulanacak`);
  baslik('SUNUCU AYARLARI');
  s.push(`Ad: ${yapi.sunucu.ad}`, `İkon: ${yapi.sunucu.ikon ? 'kopyalanacak' : 'yok'}`, `Banner: ${yapi.sunucu.banner ? ((hedef.features || []).includes('BANNER') ? 'kopyalanacak' : 'ATLANIR (boost yetersiz)') : 'yok'}`);
  s.push('Doğrulama seviyesi, bildirim ayarı, AFK kanalı/süresi, sistem mesajları kanalı kopyalanacak');
  if (sec.emoji) {
    baslik('EMOJİ VE ÇIKARTMALAR');
    s.push(`${yapi.emojiler.length} emoji, ${yapi.cikartmalar.length} çıkartma denenecek (limit dolunca atlanır)`);
  }
  return s;
}

module.exports = { uygula, kuruPlan, hataMetni };
