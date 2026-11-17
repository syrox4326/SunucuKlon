// /unmute kullanici [sebep] : susturmayı erken kaldırır. (Trial Moderator ve üstü)
const { SlashCommandBuilder } = require('discord.js');
const { RENK, taslak, alan, uyeSatiri, hata, bilgi } = require('../utils/tasarim');
const { muteKaldir } = require('../utils/mute');

module.exports = {
  yetki: { enAzRol: 'Trial Moderator' },
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Bir üyenin susturmasını kaldırır.')
    .addUserOption((o) => o.setName('kullanici').setDescription('Susturması kaldırılacak üye').setRequired(true))
    .addStringOption((o) => o.setName('sebep').setDescription('Sebep').setMaxLength(300))
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction, client) {
    const kullanici = interaction.options.getUser('kullanici');
    const sebep = interaction.options.getString('sebep');
    await interaction.deferReply();
    try {
      const kaldirildi = await muteKaldir(interaction.guild, kullanici.id, sebep || `${interaction.user.id} tarafından`);
      if (!kaldirildi) return interaction.editReply({ embeds: [bilgi(`${kullanici} zaten susturulmuş değil.`)] });
      const e = taslak(client, RENK.unmute, 'Susturma kaldırıldı')
        .setThumbnail(kullanici.displayAvatarURL())
        .addFields(alan('Üye', uyeSatiri(kullanici)), alan('Yetkili', `${interaction.user}`));
      if (sebep) e.addFields(alan('Sebep', sebep));
      return interaction.editReply({ embeds: [e] });
    } catch (e) {
      console.error('[unmute]', e);
      return interaction.editReply({ embeds: [hata('Susturma kaldırılamadı: ' + e.message)] });
    }
  },
};
