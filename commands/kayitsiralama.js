// /kayıtsıralama : en çok kayıt yapan yetkilileri sıralar. (Registration Officer ve üstü)
const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../utils/veritabani');
const { RENK, taslak, bilgi } = require('../utils/tasarim');

const GOSTERILEN = 15;

module.exports = {
  yetki: { enAzRol: 'Registration Officer' },
  data: new SlashCommandBuilder()
    .setName('kayıtsıralama')
    .setDescription('En çok kayıt yapan yetkilileri sıralar.')
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction, client) {
    const sirali = db
      .prepare('SELECT yetkili_id, COUNT(*) AS n FROM kayitlar WHERE guild_id = ? GROUP BY yetkili_id ORDER BY n DESC, MIN(zaman) ASC')
      .all(interaction.guildId);
    if (sirali.length === 0) return interaction.reply({ embeds: [bilgi('Henüz hiç kayıt yapılmamış.')] });

    const toplam = sirali.reduce((t, r) => t + r.n, 0);
    const madalya = ['🥇', '🥈', '🥉'];
    const satirlar = sirali.slice(0, GOSTERILEN).map((r, i) => `${madalya[i] ?? `**${i + 1}.**`}  <@${r.yetkili_id}>  ·  **${r.n}** kayıt`);

    const e = taslak(client, RENK.bilgi, 'Kayıt sıralaması')
      .setDescription(satirlar.join('\n\n'))
      .setFooter({ text: `Toplam ${toplam} kayıt  ·  ${sirali.length} yetkili` });
    const ikon = interaction.guild.iconURL({ size: 256 });
    if (ikon) e.setThumbnail(ikon);

    // İlk 15'te değilse kişinin kendi sırasını da göster
    const benim = sirali.findIndex((r) => r.yetkili_id === interaction.user.id);
    if (benim >= GOSTERILEN) e.addFields({ name: 'Senin sıran', value: `**${benim + 1}.**  ·  **${sirali[benim].n}** kayıt`, inline: false });

    return interaction.reply({ embeds: [e], allowedMentions: { parse: [] } });
  },
};
