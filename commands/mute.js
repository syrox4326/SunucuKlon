// /mute kullanici sure [sebep] : Muted rolü verir, süre dolunca otomatik açılır. (Trial Moderator ve üstü)
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { sureCoz, sureYaz } = require('../utils/sure');
const { muteUygula, muteGetir } = require('../utils/mute');
const { sahipMi } = require('../utils/yetki');

module.exports = {
  yetki: { enAzRol: 'Trial Moderator' },
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Bir üyeyi belirli süreliğine susturur (en fazla 7 gün).')
    .addUserOption((o) => o.setName('kullanici').setDescription('Susturulacak üye').setRequired(true))
    .addStringOption((o) => o.setName('sure').setDescription('Süre: 30 dakika, 24 saat, 1 gün, 1g 12sa... (en fazla 7 gün)').setRequired(true))
    .addStringOption((o) => o.setName('sebep').setDescription('Susturma sebebi').setMaxLength(300))
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction, client) {
    const sure = sureCoz(interaction.options.getString('sure'));
    if (sure.hata) return interaction.reply({ content: '❌ ' + sure.hata, flags: MessageFlags.Ephemeral });

    const hedef = interaction.options.getMember('kullanici');
    if (!hedef) return interaction.reply({ content: '❌ Bu kişi sunucuda değil.', flags: MessageFlags.Ephemeral });
    if (hedef.id === interaction.user.id) return interaction.reply({ content: '❌ Kendini susturamazsın.', flags: MessageFlags.Ephemeral });
    if (hedef.id === client.user.id || hedef.user.bot) return interaction.reply({ content: '❌ Botlar susturulamaz.', flags: MessageFlags.Ephemeral });
    if (hedef.id === interaction.guild.ownerId) return interaction.reply({ content: '❌ Sunucu sahibi susturulamaz.', flags: MessageFlags.Ephemeral });

    // Yetkili, kendi rolüne eşit veya üstündeki birini susturamaz (bot sahibi hariç)
    if (!sahipMi(interaction.user.id) && hedef.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({ content: '❌ Senin rolüne eşit veya senden yüksek roldeki birini susturamazsın.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();
    const sebep = interaction.options.getString('sebep');
    try {
      const { bitis } = await muteUygula(hedef, sure.ms, interaction.user.id, sebep);
      const unix = Math.floor(bitis / 1000);
      const e = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('🔇 Susturuldu')
        .setDescription(`${hedef} **${sureYaz(sure.ms)}** boyunca susturuldu.`)
        .addFields(
          { name: 'Bitiş', value: `<t:${unix}:f> (<t:${unix}:R>)`, inline: true },
          { name: 'Yetkili', value: `${interaction.user}`, inline: true },
          { name: 'Sebep', value: sebep || 'Belirtilmedi' },
        );
      await interaction.editReply({ embeds: [e] });
      hedef.send(`🔇 **${interaction.guild.name}** sunucusunda **${sureYaz(sure.ms)}** susturuldun.\nSebep: ${sebep || 'Belirtilmedi'}\nBitiş: <t:${unix}:f>`).catch(() => {});
    } catch (e) {
      console.error('[mute]', e);
      const ipucu = e.code === 50013 ? ' Botun rolü "Muted" rolünün üstünde olmalı ve "Rolleri Yönet" izni olmalı.' : '';
      await interaction.editReply('❌ Susturulamadı: ' + e.message + ipucu);
    }
  },
};
