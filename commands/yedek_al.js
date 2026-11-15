// /yedek_al kaynak_id : sunucu yapısını JSON dosyası olarak dışa aktarır
const { SlashCommandBuilder, AttachmentBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { sunucuGetir } = require('../utils/sunucu');
const { yapiOku, yapiOzeti, tipYazisi } = require('../utils/yapi');
const { sunucuOtomatik } = require('../utils/yardimci');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('yedek_al')
    .setDescription('Sunucunun yapısını (roller, kanallar, izinler, ayarlar) JSON dosyası olarak dışa aktarır.')
    .addStringOption((o) => o.setName('kaynak_id').setDescription('Yedeği alınacak sunucunun ID\'si').setRequired(true).setAutocomplete(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  autocomplete: sunucuOtomatik,

  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    let sunucu;
    try {
      sunucu = await sunucuGetir(client, interaction.options.getString('kaynak_id'), 'Kaynak sunucu');
    } catch (e) {
      return interaction.editReply('❌ ' + e.message);
    }
    try {
      const yapi = await yapiOku(sunucu);
      const ozet = yapiOzeti(yapi);
      const tarih = new Date().toISOString().slice(0, 10);
      const ad = sunucu.name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'sunucu';
      const dosya = new AttachmentBuilder(Buffer.from(JSON.stringify(yapi, null, 2), 'utf8'), { name: `yedek-${ad}-${tarih}.json` });
      return interaction.editReply({
        content:
          `✅ **${sunucu.name}** yedeği hazır.\n🎭 ${ozet.rol} rol • 📁 ${ozet.kategori} kategori • 💬 ${ozet.kanalToplam - ozet.kategori} kanal (${tipYazisi(ozet.tipSayilari)}) • 😀 ${ozet.emoji} emoji • 🏷️ ${ozet.cikartma} çıkartma\n` +
          'Not: Yedekte mesaj ve üye bilgisi yoktur. Görseller (ikon, emoji) Discord bağlantısı olarak saklanır.',
        files: [dosya],
      });
    } catch (e) {
      console.error('[yedek_al]', e);
      return interaction.editReply('❌ Yedek alınırken hata oluştu: ' + e.message);
    }
  },
};
