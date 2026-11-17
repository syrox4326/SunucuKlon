// /ban kullanici sebep [mesaj_sil] : üyeyi sunucudan yasaklar. (Admin ve üstü)
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { RENK, taslak, alan, uyeSatiri, gif, hata } = require('../utils/tasarim');
const { hedefHatasi } = require('../utils/yetki');
const { db } = require('../utils/veritabani');
const { muteSil } = require('../utils/mute');

module.exports = {
  yetki: { enAzRol: 'Admin' },
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bir üyeyi sunucudan yasaklar.')
    .addUserOption((o) => o.setName('kullanici').setDescription('Yasaklanacak kişi').setRequired(true))
    .addStringOption((o) => o.setName('sebep').setDescription('Yasaklama sebebi (zorunlu)').setRequired(true).setMaxLength(300))
    .addIntegerOption((o) =>
      o
        .setName('mesaj_sil')
        .setDescription('Kişinin geçmiş mesajları da silinsin mi?')
        .addChoices(
          { name: 'Silme', value: 0 },
          { name: 'Son 1 saat', value: 3600 },
          { name: 'Son 24 saat', value: 86400 },
          { name: 'Son 7 gün', value: 604800 },
        ),
    )
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction, client) {
    const kullanici = interaction.options.getUser('kullanici');
    const sebep = interaction.options.getString('sebep');
    const mesajSil = interaction.options.getInteger('mesaj_sil') ?? 0;
    const uye = interaction.options.getMember('kullanici');
    const reddet = (m) => interaction.reply({ embeds: [hata(m)], flags: MessageFlags.Ephemeral });

    const sorun = hedefHatasi(interaction, client, kullanici, uye);
    if (sorun) return reddet(sorun);
    if (uye && !uye.bannable) return reddet('Bu üyeyi yasaklayamıyorum. Botun rolü, üyenin en yüksek rolünün üstünde olmalı.');

    await interaction.deferReply();
    try {
      const zatenBanli = await interaction.guild.bans.fetch({ user: kullanici.id, force: true }).catch(() => null);
      if (zatenBanli) return interaction.editReply({ embeds: [hata('Bu kişi zaten yasaklı.')] });

      if (uye) {
        const dm = new EmbedBuilder()
          .setColor(RENK.ban)
          .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined })
          .setTitle('Sunucudan yasaklandın')
          .addFields(alan('Sebep', sebep))
          .setTimestamp();
        await kullanici.send({ embeds: [dm] }).catch(() => {});
      }

      await interaction.guild.members.ban(kullanici.id, { reason: `${interaction.user.tag}: ${sebep}`, deleteMessageSeconds: mesajSil });
      muteSil(interaction.guildId, kullanici.id);
      db.prepare(
        `INSERT INTO banlar (guild_id, user_id, kullanici, yetkili_id, sebep, zaman) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(guild_id, user_id) DO UPDATE SET kullanici = excluded.kullanici, yetkili_id = excluded.yetkili_id,
           sebep = excluded.sebep, zaman = excluded.zaman`,
      ).run(interaction.guildId, kullanici.id, kullanici.username, interaction.user.id, sebep, Date.now());

      const e = taslak(client, RENK.ban, 'Üye yasaklandı')
        .setThumbnail(kullanici.displayAvatarURL())
        .addFields(alan('Üye', uyeSatiri(kullanici)), alan('Yetkili', `${interaction.user}`), alan('Sebep', sebep))
        .setImage('attachment://ban.gif');
      if (mesajSil) e.addFields(alan('Silinen mesajlar', { 3600: 'Son 1 saat', 86400: 'Son 24 saat', 604800: 'Son 7 gün' }[mesajSil]));
      return interaction.editReply({ embeds: [e], files: [gif('ban')] });
    } catch (e) {
      console.error('[ban]', e);
      return interaction.editReply({ embeds: [hata('Üye yasaklanamadı: ' + e.message)] });
    }
  },
};
