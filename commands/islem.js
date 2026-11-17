// /islem durum | iptal : devam eden uzun işlemi izler veya güvenle durdurur
const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const islemYonetimi = require('../utils/islem');
const { sureYaz } = require('../utils/yardimci');

function durum(interaction) {
  const islem = islemYonetimi.aktifGetir();
  if (islem) {
    const e = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('⚙️ Devam eden işlem')
      .setDescription(`**${islem.baslik}**\n\n${islem.durumMetni()}`)
      .addFields({ name: 'Son adımlar', value: islem.sonLoglar.slice(-4).map((l) => `• ${l}`).join('\n') || 'Henüz yok' });
    return interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
  }
  const son = islemYonetimi.sonGetir();
  if (son) {
    const sonuc = son.ozet?.iptal ? 'iptal edildi' : son.ozet?.hatalar?.length ? 'hatalarla bitti' : 'başarıyla bitti';
    return interaction.reply({
      content: `💤 Şu anda devam eden işlem yok.\nSon işlem: **${son.baslik}** — ${sonuc} (${sureYaz(son.bitisZamani - son.baslangic)} sürdü, ${son.hataSayisi} hata, ${son.atlananSayisi} atlanan).`,
      flags: MessageFlags.Ephemeral,
    });
  }
  return interaction.reply({ content: '💤 Şu anda devam eden bir işlem yok.', flags: MessageFlags.Ephemeral });
}

function iptal(interaction) {
  const islem = islemYonetimi.aktifGetir();
  if (!islem) return interaction.reply({ content: '💤 İptal edilecek devam eden bir işlem yok.', flags: MessageFlags.Ephemeral });
  islem.iptalIstendi = true;
  islem.log('İptal istendi');
  return interaction.reply({
    content: '🛑 İptal istendi. Bot şu anki adımı bitirip duracak ve ne kadarının yapıldığını rapor edecek. (Yapılanlar geri alınmaz.)',
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('islem')
    .setDescription('Devam eden uzun işlemi izler veya durdurur.')
    .addSubcommand((s) => s.setName('durum').setDescription('Devam eden işlemin ilerlemesini gösterir.'))
    .addSubcommand((s) => s.setName('iptal').setDescription('Devam eden işlemi güvenle durdurur.'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    return interaction.options.getSubcommand() === 'iptal' ? iptal(interaction) : durum(interaction);
  },
};
