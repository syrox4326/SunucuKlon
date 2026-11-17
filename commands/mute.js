// /mute kullanici sure [sebep] : Muted rolü verir, süre dolunca otomatik açılır. (Trial Moderator ve üstü)
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { RENK, taslak, alan, zaman, uyeSatiri, muteGifi, hata } = require('../utils/tasarim');
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
    .addStringOption((o) => o.setName('sebep').setDescription('Susturma sebebi (zorunlu)').setRequired(true).setMaxLength(300))
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction, client) {
    const sure = sureCoz(interaction.options.getString('sure'));
    if (sure.hata) return interaction.reply({ embeds: [hata(sure.hata)], flags: MessageFlags.Ephemeral });

    const hedef = interaction.options.getMember('kullanici');
    if (!hedef) return interaction.reply({ embeds: [hata('Bu kişi sunucuda değil.')], flags: MessageFlags.Ephemeral });
    if (hedef.id === interaction.user.id) return interaction.reply({ embeds: [hata('Kendini susturamazsın.')], flags: MessageFlags.Ephemeral });
    if (hedef.id === client.user.id || hedef.user.bot) return interaction.reply({ embeds: [hata('Botlar susturulamaz.')], flags: MessageFlags.Ephemeral });
    if (hedef.id === interaction.guild.ownerId) return interaction.reply({ embeds: [hata('Sunucu sahibi susturulamaz.')], flags: MessageFlags.Ephemeral });

    // Yetkili, kendi rolüne eşit veya üstündeki birini susturamaz (bot sahibi hariç)
    if (!sahipMi(interaction.user.id) && hedef.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({ embeds: [hata('Senin rolüne eşit veya senden yüksek roldeki birini susturamazsın.')], flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();
    const sebep = interaction.options.getString('sebep');
    try {
      const { bitis } = await muteUygula(hedef, sure.ms, interaction.user.id, sebep);
      const e = taslak(client, RENK.mute, 'Üye susturuldu')
        .setThumbnail(hedef.displayAvatarURL())
        .addFields(
          alan('Üye', uyeSatiri(hedef.user)),
          alan('Süre', sureYaz(sure.ms)),
          alan('Bitiş', zaman(bitis)),
          alan('Yetkili', `${interaction.user}`),
          alan('Sebep', sebep),
        )
        .setImage('attachment://mute.gif');
      await interaction.editReply({ embeds: [e], files: [muteGifi()] });

      const dm = new EmbedBuilder()
        .setColor(RENK.mute)
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined })
        .setTitle('Susturuldun')
        .addFields(alan('Süre', sureYaz(sure.ms)), alan('Bitiş', zaman(bitis)), alan('Sebep', sebep))
        .setTimestamp();
      hedef.send({ embeds: [dm] }).catch(() => {});
    } catch (e) {
      console.error('[mute]', e);
      const ipucu = e.code === 50013 ? ' Botun rolü "Muted" rolünün üstünde olmalı ve "Rolleri Yönet" izni olmalı.' : '';
      await interaction.editReply({ embeds: [hata('Susturulamadı: ' + e.message + ipucu)] });
    }
  },
};
