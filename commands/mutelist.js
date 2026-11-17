// /mutelist : sunucudaki AKTİF mute'ları listeler (kim, kim tarafından, ne kadar süre, sebep). (Trial Moderator ve üstü)
const {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags,
} = require('discord.js');
const { db } = require('../utils/veritabani');
const { sureYaz } = require('../utils/sure');
const { RENK, taslak, bilgi } = require('../utils/tasarim');

const SAYFA = 4;
const kisalt = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

module.exports = {
  yetki: { enAzRol: 'Trial Moderator' },
  data: new SlashCommandBuilder()
    .setName('mutelist')
    .setDescription('Şu an susturulmuş olan üyeleri listeler.')
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction, client) {
    const kayitlar = db
      .prepare('SELECT * FROM mutelar WHERE guild_id = ? AND bitis > ? ORDER BY bitis ASC')
      .all(interaction.guildId, Date.now());

    if (kayitlar.length === 0) {
      return interaction.reply({ embeds: [bilgi('Şu anda susturulmuş üye yok.')], flags: MessageFlags.Ephemeral });
    }

    // Kullanıcı adlarını önceden çek (bulunamazsa ID gösterilir)
    const adlar = new Map();
    await Promise.all(
      kayitlar.map(async (k) => {
        const u = await client.users.fetch(k.user_id).catch(() => null);
        adlar.set(k.user_id, u ? u.username : k.user_id);
      }),
    );

    const sayfaSayisi = Math.ceil(kayitlar.length / SAYFA);
    const sayfaUret = (n) => {
      const e = taslak(client, RENK.mute, 'Aktif susturmalar')
        .setDescription(`Şu anda **${kayitlar.length}** üye susturulmuş durumda.`)
        .setFooter({ text: `Sayfa ${n + 1} / ${sayfaSayisi}` });
      kayitlar.slice(n * SAYFA, (n + 1) * SAYFA).forEach((k, i) => {
        const unix = Math.floor(k.bitis / 1000);
        e.addFields({
          name: `${n * SAYFA + i + 1}. ${adlar.get(k.user_id)}`,
          value:
            `**Üye**\n<@${k.user_id}> \`${k.user_id}\`\n` +
            `**Yetkili**\n<@${k.yetkili_id}>\n` +
            `**Süre**\n${sureYaz(k.bitis - k.baslangic)}, bitişe <t:${unix}:R>\n` +
            `**Sebep**\n${kisalt(k.sebep || 'Belirtilmedi', 250)}`,
          inline: false,
        });
      });
      return e;
    };
    const dugmeler = (n) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('onceki').setLabel('Önceki').setStyle(ButtonStyle.Secondary).setDisabled(n === 0),
        new ButtonBuilder().setCustomId('sonraki').setLabel('Sonraki').setStyle(ButtonStyle.Secondary).setDisabled(n >= sayfaSayisi - 1),
      );

    let sayfa = 0;
    const mesaj = await interaction.reply({
      embeds: [sayfaUret(sayfa)],
      components: sayfaSayisi > 1 ? [dugmeler(sayfa)] : [],
      allowedMentions: { parse: [] },
      flags: MessageFlags.Ephemeral,
      fetchReply: true,
    });
    if (sayfaSayisi <= 1) return;

    const toplayici = mesaj.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
      time: 5 * 60 * 1000,
    });
    toplayici.on('collect', async (i) => {
      sayfa += i.customId === 'sonraki' ? 1 : -1;
      await i.update({ embeds: [sayfaUret(sayfa)], components: [dugmeler(sayfa)] });
    });
    toplayici.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
  },
};
