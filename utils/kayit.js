// Üye kayıt sistemi: ayarlar, ".k @kullanıcı İsim | Yaş" komutu, yeni üyeye kayıtsız rolü.
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('./veritabani');
const { RENK, hata, alan } = require('./tasarim');
const { sahipMi } = require('./yetki');
const { muteGetir, mutedRolunuGetir } = require('./mute');

const NICK_LIMITI = 32;
const KULLANIM = '`.k @kullanıcı İsim | Yaş`  (örnek: `.k @Kerem Kerem | 44`)';

const ayarGetir = (guildId) => db.prepare('SELECT * FROM kayit_ayar WHERE guild_id = ?').get(guildId);

function ayarKaydet(guildId, a) {
  db.prepare(
    `INSERT INTO kayit_ayar (guild_id, kanal_id, kayitsiz_rol_id, sohbet_id, rol_id, rol2_id, rol3_id, yetkili_rol_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET kanal_id = excluded.kanal_id, kayitsiz_rol_id = excluded.kayitsiz_rol_id,
       sohbet_id = excluded.sohbet_id, rol_id = excluded.rol_id, rol2_id = excluded.rol2_id, rol3_id = excluded.rol3_id,
       yetkili_rol_id = excluded.yetkili_rol_id`,
  ).run(guildId, a.kanal, a.kayitsiz, a.sohbet, a.rol, a.rol2 ?? null, a.rol3 ?? null, a.yetkili);
}

// Kayıt kanalındaki ".k ..." mesajını işler. Mesaj bir kayıt komutuysa true döner.
async function mesajIsle(mesaj, client) {
  if (!/^\.k(\s|$)/i.test(mesaj.content)) return false;
  const ayar = ayarGetir(mesaj.guildId);
  if (!ayar || mesaj.channelId !== ayar.kanal_id) return false;

  const cevapla = (embed) => mesaj.reply({ embeds: [embed], allowedMentions: { parse: [], repliedUser: false } }).catch(() => {});

  const yetkiliMi = sahipMi(mesaj.author.id) || mesaj.member?.roles.cache.has(ayar.yetkili_rol_id);
  if (!yetkiliMi) {
    await cevapla(hata('Kayıt yapmak için gerekli yetkiye sahip değilsin.'));
    return true;
  }

  const m = mesaj.content.match(/^\.k\s+(?:<@!?(\d{17,20})>|(\d{17,20}))\s+([\s\S]+)$/i);
  if (!m) {
    await cevapla(hata(`Kullanım: ${KULLANIM}`));
    return true;
  }
  const hedefId = m[1] || m[2];
  const isim = m[3].replace(/\s+/g, ' ').trim();
  if (isim.length > NICK_LIMITI) {
    await cevapla(hata(`İsim en fazla ${NICK_LIMITI} karakter olabilir (şu an ${isim.length}).`));
    return true;
  }

  const uye = await mesaj.guild.members.fetch(hedefId).catch(() => null);
  if (!uye) {
    await cevapla(hata('Bu kişi sunucuda bulunamadı.'));
    return true;
  }
  if (uye.user.bot) {
    await cevapla(hata('Botlar kaydedilemez.'));
    return true;
  }
  const verilecek = [ayar.rol_id, ayar.rol2_id, ayar.rol3_id].filter(Boolean);
  if (!uye.roles.cache.has(ayar.kayitsiz_rol_id) && verilecek.every((r) => uye.roles.cache.has(r))) {
    await cevapla(hata(`${uye} zaten kayıtlı.`));
    return true;
  }

  // Rolleri ve ismi ayarla; hangi adım başarısız olursa açıkça söyle
  const sorunlar = [];
  try {
    if (uye.roles.cache.has(ayar.kayitsiz_rol_id)) await uye.roles.remove(ayar.kayitsiz_rol_id, `Kayıt: ${mesaj.author.tag}`);
    await uye.roles.add(verilecek, `Kayıt: ${mesaj.author.tag}`);
  } catch (e) {
    sorunlar.push(`Roller ayarlanamadı: ${e.message}. Botun rolü, kayıt rollerinin üstünde olmalı.`);
  }
  try {
    await uye.setNickname(isim, `Kayıt: ${mesaj.author.tag}`);
  } catch (e) {
    sorunlar.push(`İsim değiştirilemedi: ${e.message}. Botun rolü, bu üyenin en yüksek rolünün üstünde olmalı.`);
  }
  if (sorunlar.length === 2) {
    await cevapla(hata(sorunlar.join('\n')));
    return true;
  }

  db.prepare('INSERT INTO kayitlar (guild_id, user_id, isim, yetkili_id, zaman) VALUES (?, ?, ?, ?, ?)')
    .run(mesaj.guildId, uye.id, isim, mesaj.author.id, Date.now());

  const e = new EmbedBuilder()
    .setColor(RENK.unmute)
    .setAuthor({ name: 'Kayıt tamamlandı', iconURL: client.user.displayAvatarURL() })
    .setThumbnail(uye.displayAvatarURL())
    .addFields(
      alan('Üye', `${uye}\n\`${uye.id}\``),
      alan('Yeni isim', isim),
      alan('Verilen roller', verilecek.map((r) => `<@&${r}>`).join(' ')),
      alan('Kaydeden', `${mesaj.author}`),
    )
    .setTimestamp();
  if (sorunlar.length) e.addFields(alan('Uyarı', sorunlar.join('\n')));
  await mesaj.reply({ embeds: [e], allowedMentions: { parse: [], repliedUser: false } }).catch(() => {});

  // Sohbet kanalına hoş geldin bildirimi
  const sohbet = mesaj.guild.channels.cache.get(ayar.sohbet_id);
  if (sohbet?.permissionsFor(mesaj.guild.members.me)?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    const b = new EmbedBuilder()
      .setColor(RENK.bilgi)
      .setThumbnail(uye.displayAvatarURL())
      .setDescription(`Aramıza yeni biri katıldı: ${uye}\nHoş geldin, **${isim}**!`)
      .setFooter({ text: `Kaydeden: ${mesaj.author.username}` })
      .setTimestamp();
    await sohbet.send({ embeds: [b], allowedMentions: { users: [uye.id] } }).catch((err) => console.error('[kayit] sohbet bildirimi:', err.message));
  }
  return true;
}

// Sunucuya yeni giren: kayıtsız rolü ver; aktif mute'u varsa Muted rolünü geri ver (mute'dan kaçmayı engeller)
async function uyeGirdi(uye) {
  if (uye.user.bot) return;
  const ayar = ayarGetir(uye.guild.id);
  if (ayar) await uye.roles.add(ayar.kayitsiz_rol_id, 'Kayıt sistemi: yeni üye').catch((e) => console.error('[kayit] kayıtsız rolü verilemedi:', e.message));
  const mute = muteGetir(uye.guild.id, uye.id);
  if (mute && mute.bitis > Date.now()) {
    const rol = await mutedRolunuGetir(uye.guild).catch(() => null);
    if (rol) await uye.roles.add(rol, 'Aktif mute: sunucuya tekrar girdi').catch(() => {});
  }
}

module.exports = { ayarGetir, ayarKaydet, mesajIsle, uyeGirdi };
