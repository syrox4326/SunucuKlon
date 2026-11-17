// /unban kullanici_id [sebep] : yasağı kaldırır. Kullanıcı sunucuda olmadığı için ID gerekir. (Admin ve üstü)
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { RENK, taslak, alan, uyeSatiri, gif, hata, bilgi } = require('../utils/tasarim');

module.exports = {
  yetki: { enAzRol: 'Admin' },
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Bir kişinin yasağını kaldırır.')
    .addStringOption((o) => o.setName('kullanici_id').setDescription('Yasağı kaldırılacak kişinin kullanıcı ID\'si').setRequired(true).setMinLength(17).setMaxLength(20))
    .addStringOption((o) => o.setName('sebep').setDescription('Sebep').setMaxLength(300))
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction, client) {
    const id = interaction.options.getString('kullanici_id').trim();
    const sebep = interaction.options.getString('sebep');
    if (!/^\d{17,20}$/.test(id)) {
      return interaction.reply({ embeds: [hata('Geçerli bir kullanıcı ID\'si yaz. ID yalnızca rakamlardan oluşur.')], flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();
    try {
      const ban = await interaction.guild.bans.fetch({ user: id, force: true }).catch(() => null);
      if (!ban) return interaction.editReply({ embeds: [bilgi('Bu ID ile yasaklı biri bulunamadı.')] });

      await interaction.guild.members.unban(id, `${interaction.user.tag}: ${sebep || 'Sebep belirtilmedi'}`);
      const e = taslak(client, RENK.unmute, 'Yasak kaldırıldı')
        .setThumbnail(ban.user.displayAvatarURL())
        .addFields(alan('Üye', uyeSatiri(ban.user)), alan('Yetkili', `${interaction.user}`));
      if (sebep) e.addFields(alan('Sebep', sebep));
      e.setImage('attachment://unban.gif');
      return interaction.editReply({ embeds: [e], files: [gif('unban')] });
    } catch (e) {
      console.error('[unban]', e);
      return interaction.editReply({ embeds: [hata('Yasak kaldırılamadı: ' + e.message)] });
    }
  },
};
