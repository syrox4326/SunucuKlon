// /kick kullanici sebep : üyeyi sunucudan atar. (Moderator ve üstü)
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { RENK, taslak, alan, uyeSatiri, gif, hata } = require('../utils/tasarim');
const { hedefHatasi } = require('../utils/yetki');
const { db } = require('../utils/veritabani');

module.exports = {
  yetki: { enAzRol: 'Moderator' },
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Bir üyeyi sunucudan atar.')
    .addUserOption((o) => o.setName('kullanici').setDescription('Atılacak üye').setRequired(true))
    .addStringOption((o) => o.setName('sebep').setDescription('Atılma sebebi (zorunlu)').setRequired(true).setMaxLength(300))
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction, client) {
    const kullanici = interaction.options.getUser('kullanici');
    const sebep = interaction.options.getString('sebep');
    const uye = interaction.options.getMember('kullanici');
    const reddet = (m) => interaction.reply({ embeds: [hata(m)], flags: MessageFlags.Ephemeral });

    if (!uye) return reddet('Bu kişi sunucuda değil.');
    const sorun = hedefHatasi(interaction, client, kullanici, uye);
    if (sorun) return reddet(sorun);
    if (!uye.kickable) return reddet('Bu üyeyi atamıyorum. Botun rolü, üyenin en yüksek rolünün üstünde olmalı.');

    await interaction.deferReply();
    try {
      // Atıldıktan sonra DM gönderilemez; bu yüzden önce bildirim
      const dm = new EmbedBuilder()
        .setColor(RENK.kick)
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined })
        .setTitle('Sunucudan atıldın')
        .addFields(alan('Sebep', sebep))
        .setTimestamp();
      await kullanici.send({ embeds: [dm] }).catch(() => {});

      await uye.kick(`${interaction.user.tag}: ${sebep}`);
      db.prepare('INSERT INTO kickler (guild_id, user_id, kullanici, yetkili_id, sebep, zaman) VALUES (?, ?, ?, ?, ?, ?)')
        .run(interaction.guildId, kullanici.id, kullanici.username, interaction.user.id, sebep, Date.now());

      const e = taslak(client, RENK.kick, 'Üye sunucudan atıldı')
        .setThumbnail(kullanici.displayAvatarURL())
        .addFields(alan('Üye', uyeSatiri(kullanici)), alan('Yetkili', `${interaction.user}`), alan('Sebep', sebep))
        .setImage('attachment://kick.gif');
      return interaction.editReply({ embeds: [e], files: [gif('kick')] });
    } catch (e) {
      console.error('[kick]', e);
      return interaction.editReply({ embeds: [hata('Üye atılamadı: ' + e.message)] });
    }
  },
};
