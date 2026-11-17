// /kicklist : bot ile atılan üyelerin geçmişi (en yeniden eskiye). (Moderator ve üstü)
const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../utils/veritabani');
const { RENK, bilgi } = require('../utils/tasarim');
const { listeGonder, gizliBekle } = require('../utils/liste');

const EN_COK = 50;

module.exports = {
  yetki: { enAzRol: 'Moderator' },
  data: new SlashCommandBuilder()
    .setName('kicklist')
    .setDescription('Sunucudan atılan üyelerin geçmişini listeler.')
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction, client) {
    await gizliBekle(interaction);
    const toplam = db.prepare('SELECT COUNT(*) AS n FROM kickler WHERE guild_id = ?').get(interaction.guildId).n;
    if (toplam === 0) return interaction.editReply({ embeds: [bilgi('Henüz atılan üye kaydı yok.')] });

    const kayitlar = db.prepare('SELECT * FROM kickler WHERE guild_id = ? ORDER BY zaman DESC LIMIT ?').all(interaction.guildId, EN_COK);
    const girdiler = kayitlar.map((k) => ({
      baslik: `<@${k.user_id}>  \`${k.kullanici ?? k.user_id}\``,
      satirlar: [
        ['Yetkili', `<@${k.yetkili_id}>`],
        ['Tarih', `<t:${Math.floor(k.zaman / 1000)}:f>`],
        ['Sebep', k.sebep || 'Belirtilmedi'],
      ],
    }));
    return listeGonder(interaction, client, {
      renk: RENK.kick,
      baslik: 'Atılan üyeler',
      ozet: toplam > EN_COK ? `Toplam **${toplam}** kayıt, en yeni **${EN_COK}** tanesi gösteriliyor.` : `Toplam **${toplam}** kayıt.`,
      girdiler,
    });
  },
};
