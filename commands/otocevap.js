// /otocevap ekle | sil | liste : mesajda bir ifade geçince botun otomatik cevap yazmasını ayarlar. (Moderator ve üstü)
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { RENK, taslak, hata, bilgi } = require('../utils/tasarim');
const oto = require('../utils/otocevap');

const kisalt = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

module.exports = {
  yetki: { enAzRol: 'Moderator' },
  data: new SlashCommandBuilder()
    .setName('otocevap')
    .setDescription('Otomatik cevapları yönetir.')
    .addSubcommand((s) =>
      s
        .setName('ekle')
        .setDescription('Yeni bir otomatik cevap ekler (aynı ifade varsa cevabını günceller).')
        .addStringOption((o) => o.setName('tetik').setDescription('Mesajda geçince tetiklenecek ifade').setRequired(true).setMaxLength(100))
        .addStringOption((o) => o.setName('cevap').setDescription('Botun yazacağı cevap ({kullanici} yazarsan yazanı etiketler)').setRequired(true).setMaxLength(500)),
    )
    .addSubcommand((s) =>
      s
        .setName('sil')
        .setDescription('Bir otomatik cevabı siler.')
        .addStringOption((o) => o.setName('tetik').setDescription('Silinecek kuralın tetik ifadesi').setRequired(true).setMaxLength(100)),
    )
    .addSubcommand((s) => s.setName('liste').setDescription('Tüm otomatik cevapları gösterir.'))
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction, client) {
    const gizli = { flags: MessageFlags.Ephemeral };
    const alt = interaction.options.getSubcommand();

    if (alt === 'ekle') {
      const tetik = interaction.options.getString('tetik');
      const cevap = interaction.options.getString('cevap');
      const sonuc = oto.ekle(interaction.guildId, tetik, cevap, interaction.user.id);
      if (sonuc.hata) return interaction.reply({ embeds: [hata(sonuc.hata)], ...gizli });
      const e = taslak(client, RENK.unmute, sonuc.guncellendi ? 'Otomatik cevap güncellendi' : 'Otomatik cevap eklendi').addFields(
        { name: 'Tetik', value: kisalt(tetik, 200), inline: false },
        { name: 'Cevap', value: kisalt(cevap, 500), inline: false },
      );
      return interaction.reply({ embeds: [e], ...gizli });
    }

    if (alt === 'sil') {
      const tetik = interaction.options.getString('tetik');
      return oto.sil(interaction.guildId, tetik)
        ? interaction.reply({ embeds: [bilgi(`**${kisalt(tetik, 100)}** otomatik cevabı silindi.`)], ...gizli })
        : interaction.reply({ embeds: [hata('Bu ifadeyle kayıtlı bir otomatik cevap bulunamadı. Tam ifadeyi `/otocevap liste` ile kontrol et.')], ...gizli });
    }

    const kayitlar = oto.liste(interaction.guildId);
    if (kayitlar.length === 0) return interaction.reply({ embeds: [bilgi('Henüz otomatik cevap yok. `/otocevap ekle` ile ekleyebilirsin.')], ...gizli });
    const govde = kayitlar
      .map((k, i) => `**${i + 1}.**  ${kisalt(k.tetik_ham, 80)}\n> **Cevap**  ${kisalt(k.cevap, 120)}`)
      .join('\n\n');
    const e = taslak(client, RENK.bilgi, 'Otomatik cevaplar').setDescription(`Toplam **${kayitlar.length}** kural.\n\n${govde}`.slice(0, 4000));
    return interaction.reply({ embeds: [e], allowedMentions: { parse: [] }, ...gizli });
  },
};
