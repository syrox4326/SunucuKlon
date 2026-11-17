// /mutelist : sunucudaki AKTİF mute'ları listeler (kim, kim tarafından, ne kadar süre, sebep). (Trial Moderator ve üstü)
const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags,
} = require('discord.js');
const { db } = require('../utils/veritabani');
const { sureYaz } = require('../utils/sure');

const SAYFA = 5;

const kisalt = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

module.exports = {
  yetki: { enAzRol: 'Trial Moderator' },
  data: new SlashCommandBuilder()
    .setName('mutelist')
    .setDescription('Şu an susturulmuş olan üyeleri listeler.')
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction) {
    const simdi = Date.now();
    const kayitlar = db
      .prepare('SELECT * FROM mutelar WHERE guild_id = ? AND bitis > ? ORDER BY bitis ASC')
      .all(interaction.guildId, simdi);

    if (kayitlar.length === 0) {
      return interaction.reply({ content: '✅ Şu anda susturulmuş kimse yok.', flags: MessageFlags.Ephemeral });
    }

    const sayfaSayisi = Math.ceil(kayitlar.length / SAYFA);
    const sayfaUret = (n) => {
      const e = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`🔇 Aktif susturmalar (${kayitlar.length})`)
        .setFooter({ text: `Sayfa ${n + 1}/${sayfaSayisi}` });
      for (const k of kayitlar.slice(n * SAYFA, (n + 1) * SAYFA)) {
        const bitisUnix = Math.floor(k.bitis / 1000);
        e.addFields({
          name: '​',
          value:
            `👤 <@${k.user_id}> (\`${k.user_id}\`)\n` +
            `🛡️ Yetkili: <@${k.yetkili_id}>\n` +
            `⏱️ Süre: **${sureYaz(k.bitis - k.baslangic)}** • Kalan: <t:${bitisUnix}:R> (<t:${bitisUnix}:f>)\n` +
            `📝 Sebep: ${kisalt(k.sebep || 'Belirtilmedi', 200)}`,
        });
      }
      return e;
    };
    const dugmeler = (n) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('onceki').setLabel('◀ Önceki').setStyle(ButtonStyle.Secondary).setDisabled(n === 0),
        new ButtonBuilder().setCustomId('sonraki').setLabel('Sonraki ▶').setStyle(ButtonStyle.Secondary).setDisabled(n >= sayfaSayisi - 1),
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
