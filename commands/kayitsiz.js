// /kayıtsız kullanici [sebep] : kayıtlı üyenin tüm rollerini alıp sadece kayıtsız rolünü bırakır. (Moderator ve üstü)
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { RENK, taslak, alan, uyeSatiri, hata, bilgi } = require('../utils/tasarim');
const { hedefHatasi } = require('../utils/yetki');
const { ayarGetir } = require('../utils/kayit');
const { db } = require('../utils/veritabani');

const ROL_GOSTERIM_LIMITI = 15;

module.exports = {
  yetki: { enAzRol: 'Moderator' },
  data: new SlashCommandBuilder()
    .setName('kayıtsız')
    .setDescription('Kayıtlı bir üyenin tüm rollerini alıp kayıtsıza atar.')
    .addUserOption((o) => o.setName('kullanici').setDescription('Kayıtsıza atılacak üye').setRequired(true))
    .addStringOption((o) => o.setName('sebep').setDescription('Sebep').setMaxLength(300))
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction, client) {
    const kullanici = interaction.options.getUser('kullanici');
    const sebep = interaction.options.getString('sebep');
    const uye = interaction.options.getMember('kullanici');
    const reddet = (m) => interaction.reply({ embeds: [hata(m)], flags: MessageFlags.Ephemeral });

    const ayar = ayarGetir(interaction.guildId);
    if (!ayar) return reddet('Kayıt sistemi kurulmamış. Önce bir yönetici `/kayıtkur` komutunu çalıştırmalı.');
    if (!uye) return reddet('Bu kişi sunucuda değil.');
    if (kullanici.bot) return reddet('Botlar kayıtsıza atılamaz.');
    const sorun = hedefHatasi(interaction, client, kullanici, uye);
    if (sorun) return reddet(sorun);

    const benimEnYuksek = interaction.guild.members.me.roles.highest.position;
    const kayitsizRol = interaction.guild.roles.cache.get(ayar.kayitsiz_rol_id);
    if (!kayitsizRol) return reddet('Ayarlardaki kayıtsız rolü silinmiş. `/kayıtkur` ile sistemi yeniden kur.');

    // Alınacak roller: bot yönetebiliyorsa; entegrasyon rolleri (Booster vb.) ve aktif mute rolü kalır
    const mevcut = [...uye.roles.cache.values()].filter((r) => r.id !== interaction.guildId && r.id !== kayitsizRol.id);
    const korunan = mevcut.filter((r) => r.managed || r.name.toLowerCase() === 'muted');
    const alinamayan = mevcut.filter((r) => !r.managed && r.name.toLowerCase() !== 'muted' && r.position >= benimEnYuksek);
    const alinacak = mevcut.filter((r) => !korunan.includes(r) && !alinamayan.includes(r));

    const zatenKayitsiz = uye.roles.cache.has(kayitsizRol.id) && alinacak.length === 0;
    if (zatenKayitsiz) return interaction.reply({ embeds: [bilgi(`${uye} zaten kayıtsız durumda.`)], flags: MessageFlags.Ephemeral });

    await interaction.deferReply();
    const eskiIsim = uye.nickname;
    const uyarilar = [];
    try {
      if (alinacak.length) await uye.roles.remove(alinacak, `Kayıtsıza atıldı: ${interaction.user.tag}`);
      if (!uye.roles.cache.has(kayitsizRol.id)) await uye.roles.add(kayitsizRol, `Kayıtsıza atıldı: ${interaction.user.tag}`);
    } catch (e) {
      console.error('[kayıtsız]', e);
      return interaction.editReply({ embeds: [hata('Roller değiştirilemedi: ' + e.message)] });
    }
    // Eski kayıt ismini temizle
    if (eskiIsim) await uye.setNickname(null, `Kayıtsıza atıldı: ${interaction.user.tag}`).catch(() => uyarilar.push('Takma ad sıfırlanamadı (botun rolü üyeden yüksek değil).'));
    if (alinamayan.length) uyarilar.push(`Botun rolünden yüksek olduğu için alınamayan roller: ${alinamayan.map((r) => `${r}`).join(' ')}`);

    db.prepare('INSERT INTO kayitsiz_log (guild_id, user_id, yetkili_id, sebep, roller, isim, zaman) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(interaction.guildId, uye.id, interaction.user.id, sebep ?? null, JSON.stringify(alinacak.map((r) => r.id)), eskiIsim ?? null, Date.now());

    const liste = alinacak.length
      ? alinacak.slice(0, ROL_GOSTERIM_LIMITI).map((r) => `${r}`).join(' ') + (alinacak.length > ROL_GOSTERIM_LIMITI ? ` +${alinacak.length - ROL_GOSTERIM_LIMITI} rol daha` : '')
      : 'Alınacak rol yoktu';
    const e = taslak(client, RENK.kick, 'Üye kayıtsıza atıldı')
      .setThumbnail(kullanici.displayAvatarURL())
      .addFields(
        alan('Üye', uyeSatiri(kullanici)),
        alan('Yetkili', `${interaction.user}`),
        alan(`Alınan roller (${alinacak.length})`, liste),
        alan('Kalan rol', `${kayitsizRol}`),
      );
    if (korunan.length) e.addFields(alan('Korunan roller', `${korunan.map((r) => `${r}`).join(' ')}\nBot/entegrasyon rolleri ve aktif mute rolü alınmaz.`));
    if (sebep) e.addFields(alan('Sebep', sebep));
    if (uyarilar.length) e.addFields(alan('Uyarı', uyarilar.join('\n')));
    return interaction.editReply({ embeds: [e], allowedMentions: { parse: [] } });
  },
};
