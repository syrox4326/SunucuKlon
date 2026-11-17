// /unmute kullanici [sebep] : susturmayı erken kaldırır. (Trial Moderator ve üstü)
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
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

  async execute(interaction) {
    const kullanici = interaction.options.getUser('kullanici');
    const sebep = interaction.options.getString('sebep');
    await interaction.deferReply();
    try {
      const kaldirildi = await muteKaldir(interaction.guild, kullanici.id, sebep || `${interaction.user.id} tarafından`);
      if (!kaldirildi) return interaction.editReply({ content: `ℹ️ ${kullanici} zaten susturulmuş değil.`, allowedMentions: { parse: [] } });
      const e = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('🔊 Susturma kaldırıldı')
        .setDescription(`${kullanici} artık konuşabilir.`)
        .addFields({ name: 'Yetkili', value: `${interaction.user}`, inline: true }, { name: 'Sebep', value: sebep || 'Belirtilmedi', inline: true });
      return interaction.editReply({ embeds: [e] });
    } catch (e) {
      console.error('[unmute]', e);
      return interaction.editReply('❌ Susturma kaldırılamadı: ' + e.message);
    }
  },
};
