// Bir sunucunun yapısını okuyup düz bir JSON nesnesine çevirir (yedek formatı).
// Aynı format hem /klonla hem /yedek_al hem de /yedekten_yukle tarafından kullanılır.
const { ChannelType, OverwriteType } = require('discord.js');

const SURUM = 1;

// Kopyalanabilen kanal türleri ve Türkçe adları
const TIP_ADI = {
  [ChannelType.GuildText]: 'Metin',
  [ChannelType.GuildVoice]: 'Ses',
  [ChannelType.GuildCategory]: 'Kategori',
  [ChannelType.GuildAnnouncement]: 'Duyuru',
  [ChannelType.GuildStageVoice]: 'Sahne',
  [ChannelType.GuildForum]: 'Forum',
  [ChannelType.GuildMedia]: 'Medya',
};
const KOPYALANABILIR = new Set(Object.keys(TIP_ADI).map(Number));
const SES_TIPLERI = new Set([ChannelType.GuildVoice, ChannelType.GuildStageVoice]);

// Kanal sıralaması: Discord metin benzeri kanalları önce, ses kanallarını sonra gösterir.
function kanalSirala(liste) {
  return [...liste].sort(
    (a, b) =>
      Number(SES_TIPLERI.has(a.type)) - Number(SES_TIPLERI.has(b.type)) ||
      a.rawPosition - b.rawPosition ||
      (BigInt(a.id) < BigInt(b.id) ? -1 : 1),
  );
}

// Sunucuyu okuyup yapı nesnesi döndürür.
async function yapiOku(guild) {
  await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);
  const emojiler = await guild.emojis.fetch().catch(() => new Map());
  const cikartmalar = await guild.stickers.fetch().catch(() => new Map());

  // --- Roller (bot/yönetilen roller ve @everyone hariç) ---
  const roller = [...guild.roles.cache.values()]
    .filter((r) => !r.managed && r.id !== guild.id)
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      id: r.id,
      ad: r.name,
      renk: r.color,
      hoist: r.hoist,
      mentionable: r.mentionable,
      izin: r.permissions.bitfield.toString(),
      pozisyon: r.position,
      ikon: r.icon ? r.iconURL({ extension: 'png', size: 256 }) : null,
      emoji: r.unicodeEmoji || null,
    }));

  // --- Kanallar ve kategoriler ---
  const hepsi = [...guild.channels.cache.values()].filter((c) => KOPYALANABILIR.has(c.type));
  const kategoriler = kanalSirala(hepsi.filter((c) => c.type === ChannelType.GuildCategory));
  const siraHaritasi = new Map();
  kategoriler.forEach((c, i) => siraHaritasi.set(c.id, i));
  const gruplar = new Map(); // ust kategori id -> çocuk kanallar
  for (const c of hepsi.filter((c) => c.type !== ChannelType.GuildCategory)) {
    const anahtar = c.parentId || 'yok';
    if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
    gruplar.get(anahtar).push(c);
  }
  for (const liste of gruplar.values()) kanalSirala(liste).forEach((c, i) => siraHaritasi.set(c.id, i));

  const kanallar = hepsi.map((c) => {
    const roleOzel = [...c.permissionOverwrites.cache.values()].filter((o) => o.type === OverwriteType.Role);
    const uyeOzel = c.permissionOverwrites.cache.size - roleOzel.length;
    return {
      id: c.id,
      ad: c.name,
      tip: c.type,
      ustId: c.parentId || null,
      sira: siraHaritasi.get(c.id) ?? 0,
      konu: c.topic ?? null,
      nsfw: Boolean(c.nsfw),
      yavasMod: c.rateLimitPerUser ?? 0,
      bitrate: c.bitrate ?? null,
      kullaniciLimiti: c.userLimit ?? 0,
      rtcBolge: c.rtcRegion ?? null,
      videoKalitesi: c.videoQualityMode ?? null,
      otoArsiv: c.defaultAutoArchiveDuration ?? null,
      etiketler: (c.availableTags || []).map((t) => ({
        ad: t.name,
        moderated: Boolean(t.moderated),
        emojiAd: t.emoji?.name ?? null,
        emojiId: t.emoji?.id ?? null,
      })),
      varsayilanTepki: c.defaultReactionEmoji ? { id: c.defaultReactionEmoji.id ?? null, ad: c.defaultReactionEmoji.name ?? null } : null,
      konuYavasMod: c.defaultThreadRateLimitPerUser ?? null,
      siralamaTuru: c.defaultSortOrder ?? null,
      forumDuzeni: c.defaultForumLayout ?? null,
      izinler: roleOzel.map((o) => ({ rolId: o.id, izin: o.allow.bitfield.toString(), yasak: o.deny.bitfield.toString() })),
      uyeOzelSayisi: uyeOzel,
    };
  });

  // --- Emoji ve çıkartmalar ---
  const emojiListe = [...emojiler.values()].map((e) => ({
    ad: e.name,
    animasyon: Boolean(e.animated),
    url: `https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? 'gif' : 'png'}?size=128`,
  }));
  const cikartmaListe = [...cikartmalar.values()].map((s) => ({
    ad: s.name,
    aciklama: s.description || '',
    etiket: s.tags || '',
    format: s.format,
    url: s.url,
  }));

  return {
    surum: SURUM,
    tarih: new Date().toISOString(),
    kaynakId: guild.id,
    kaynakAd: guild.name,
    sunucu: {
      ad: guild.name,
      ikon: guild.icon ? guild.iconURL({ extension: 'png', size: 1024 }) : null,
      banner: guild.banner ? guild.bannerURL({ extension: 'png', size: 1024 }) : null,
      dogrulama: guild.verificationLevel,
      bildirim: guild.defaultMessageNotifications,
      afkSure: guild.afkTimeout,
      afkKanalId: guild.afkChannelId || null,
      sistemKanalId: guild.systemChannelId || null,
      sistemBayraklari: guild.systemChannelFlags?.bitfield ?? 0,
    },
    everyoneIzin: guild.roles.everyone.permissions.bitfield.toString(),
    roller,
    kanallar,
    emojiler: emojiListe,
    cikartmalar: cikartmaListe,
  };
}

// Dışarıdan gelen (yedek dosyası) veriyi kontrol edip temizler. Hatalı dosyada anlaşılır hata verir.
function yapiDogrula(ham) {
  if (!ham || typeof ham !== 'object' || Array.isArray(ham)) throw new Error('Dosya geçerli bir SunucuKlon yedeği değil.');
  if (ham.surum !== SURUM) throw new Error('Bu yedek dosyasının sürümü desteklenmiyor.');
  if (!Array.isArray(ham.roller) || !Array.isArray(ham.kanallar)) throw new Error('Yedek dosyasında roller veya kanallar bölümü yok.');

  const metin = (v, max, varsayilan = '') => (typeof v === 'string' && v.length ? v.slice(0, max) : varsayilan);
  const sayi = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
  const izin = (v) => (/^\d{1,20}$/.test(String(v)) ? String(v) : '0');
  const idMi = (v) => (/^\d{17,20}$/.test(String(v)) ? String(v) : null);
  const dizi = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

  const roller = dizi(ham.roller, 500)
    .filter((r) => r && idMi(r.id))
    .map((r) => ({
      id: String(r.id),
      ad: metin(r.ad, 100, 'yeni-rol'),
      renk: Math.min(0xffffff, Math.max(0, sayi(r.renk))),
      hoist: Boolean(r.hoist),
      mentionable: Boolean(r.mentionable),
      izin: izin(r.izin),
      pozisyon: sayi(r.pozisyon),
      ikon: typeof r.ikon === 'string' ? r.ikon : null,
      emoji: typeof r.emoji === 'string' ? r.emoji.slice(0, 20) : null,
    }));

  const kanallar = dizi(ham.kanallar, 1000)
    .filter((k) => k && idMi(k.id) && KOPYALANABILIR.has(Number(k.tip)))
    .map((k) => ({
      id: String(k.id),
      ad: metin(k.ad, 100, 'kanal'),
      tip: Number(k.tip),
      ustId: idMi(k.ustId),
      sira: sayi(k.sira),
      konu: typeof k.konu === 'string' ? k.konu.slice(0, 1024) : null,
      nsfw: Boolean(k.nsfw),
      yavasMod: Math.min(21600, Math.max(0, sayi(k.yavasMod))),
      bitrate: k.bitrate == null ? null : sayi(k.bitrate, null),
      kullaniciLimiti: Math.min(99, Math.max(0, sayi(k.kullaniciLimiti))),
      rtcBolge: typeof k.rtcBolge === 'string' ? k.rtcBolge : null,
      videoKalitesi: k.videoKalitesi == null ? null : sayi(k.videoKalitesi, null),
      otoArsiv: k.otoArsiv == null ? null : sayi(k.otoArsiv, null),
      etiketler: dizi(k.etiketler, 20).map((t) => ({
        ad: metin(t?.ad, 20, 'etiket'),
        moderated: Boolean(t?.moderated),
        emojiAd: typeof t?.emojiAd === 'string' ? t.emojiAd : null,
        emojiId: idMi(t?.emojiId),
      })),
      varsayilanTepki: k.varsayilanTepki && typeof k.varsayilanTepki === 'object'
        ? { id: idMi(k.varsayilanTepki.id), ad: typeof k.varsayilanTepki.ad === 'string' ? k.varsayilanTepki.ad : null }
        : null,
      konuYavasMod: k.konuYavasMod == null ? null : sayi(k.konuYavasMod, null),
      siralamaTuru: k.siralamaTuru == null ? null : sayi(k.siralamaTuru, null),
      forumDuzeni: k.forumDuzeni == null ? null : sayi(k.forumDuzeni, null),
      izinler: dizi(k.izinler, 500)
        .filter((o) => o && idMi(o.rolId))
        .map((o) => ({ rolId: String(o.rolId), izin: izin(o.izin), yasak: izin(o.yasak) })),
      uyeOzelSayisi: sayi(k.uyeOzelSayisi),
    }));

  const s = ham.sunucu && typeof ham.sunucu === 'object' ? ham.sunucu : {};
  return {
    surum: SURUM,
    tarih: metin(ham.tarih, 40),
    kaynakId: idMi(ham.kaynakId) || '0',
    kaynakAd: metin(ham.kaynakAd, 100, 'Bilinmeyen sunucu'),
    sunucu: {
      ad: metin(s.ad, 100),
      ikon: typeof s.ikon === 'string' ? s.ikon : null,
      banner: typeof s.banner === 'string' ? s.banner : null,
      dogrulama: s.dogrulama == null ? null : sayi(s.dogrulama, null),
      bildirim: s.bildirim == null ? null : sayi(s.bildirim, null),
      afkSure: s.afkSure == null ? null : sayi(s.afkSure, null),
      afkKanalId: idMi(s.afkKanalId),
      sistemKanalId: idMi(s.sistemKanalId),
      sistemBayraklari: sayi(s.sistemBayraklari),
    },
    everyoneIzin: izin(ham.everyoneIzin),
    roller,
    kanallar,
    emojiler: dizi(ham.emojiler, 600)
      .filter((e) => e && typeof e.url === 'string')
      .map((e) => ({ ad: metin(e.ad, 32, 'emoji'), animasyon: Boolean(e.animasyon), url: e.url })),
    cikartmalar: dizi(ham.cikartmalar, 100)
      .filter((c) => c && typeof c.url === 'string')
      .map((c) => ({
        ad: metin(c.ad, 30, 'cikartma'),
        aciklama: metin(c.aciklama, 100),
        etiket: metin(c.etiket, 200),
        format: sayi(c.format, 1),
        url: c.url,
      })),
  };
}

// Yapının sayısal özeti (onay ekranında gösterilir)
function yapiOzeti(yapi) {
  const sayac = {};
  for (const k of yapi.kanallar) sayac[k.tip] = (sayac[k.tip] || 0) + 1;
  return {
    rol: yapi.roller.length,
    kategori: sayac[ChannelType.GuildCategory] || 0,
    kanalToplam: yapi.kanallar.length,
    tipSayilari: sayac,
    izinSayisi: yapi.kanallar.reduce((t, k) => t + k.izinler.length, 0),
    emoji: yapi.emojiler.length,
    cikartma: yapi.cikartmalar.length,
  };
}

// Tür sayılarını "12 Metin, 4 Ses" gibi yazıya çevirir
function tipYazisi(tipSayilari) {
  return Object.entries(tipSayilari)
    .filter(([tip]) => Number(tip) !== ChannelType.GuildCategory)
    .map(([tip, adet]) => `${adet} ${TIP_ADI[tip]}`)
    .join(', ') || 'yok';
}

module.exports = { SURUM, TIP_ADI, KOPYALANABILIR, SES_TIPLERI, yapiOku, yapiDogrula, yapiOzeti, tipYazisi };
