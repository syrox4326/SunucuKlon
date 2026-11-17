// /yedek al kaynak_id | /yedek yukle hedef_id dosya [temizle] [emoji] [kuru_calistirma]
const { SlashCommandBuilder, AttachmentBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { sunucuGetir } = require('../utils/sunucu');
const { yapiOku, yapiOzeti, tipYazisi, yapiDogrula } = require('../utils/yapi');
const { klonAkisi } = require('../utils/akis');
const { sunucuOtomatik } = require('../utils/yardimci');

const EN_BUYUK_DOSYA = 8 * 1024 * 1024; // 8 MB

async function al(interaction, client) {
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
    console.error('[yedek al]', e);
    return interaction.editReply('❌ Yedek alınırken hata oluştu: ' + e.message);
  }
}

async function yukle(interaction, client) {
  const sec = {
    temizle: interaction.options.getBoolean('temizle') ?? false,
    emoji: interaction.options.getBoolean('emoji') ?? false,
    kuruCalistirma: interaction.options.getBoolean('kuru_calistirma') ?? false,
  };
  const dosya = interaction.options.getAttachment('dosya');
  if (dosya.size > EN_BUYUK_DOSYA) return interaction.editReply('❌ Dosya çok büyük (en fazla 8 MB).');

  let hedef, yapi;
  try {
    hedef = await sunucuGetir(client, interaction.options.getString('hedef_id'), 'Hedef sunucu');
    const cevap = await fetch(dosya.url);
    if (!cevap.ok) throw new Error('Dosya indirilemedi.');
    yapi = yapiDogrula(JSON.parse(await cevap.text()));
  } catch (e) {
    const mesaj = e instanceof SyntaxError ? 'Dosya geçerli bir JSON değil. /yedek al ile aldığın dosyayı değiştirmeden yükle.' : e.message;
    return interaction.editReply('❌ ' + mesaj);
  }
  return klonAkisi(interaction, { hedef, yapi, sec, baslik: `Yedek: ${yapi.kaynakAd} ➜ ${hedef.name}` });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('yedek')
    .setDescription('Sunucu yapısını JSON olarak yedekler veya yedekten yükler.')
    .addSubcommand((s) =>
      s
        .setName('al')
        .setDescription('Sunucunun yapısını (roller, kanallar, izinler, ayarlar) JSON dosyası olarak dışa aktarır.')
        .addStringOption((o) => o.setName('kaynak_id').setDescription('Yedeği alınacak sunucu').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('yukle')
        .setDescription('/yedek al ile alınan JSON dosyasındaki yapıyı hedef sunucuya yükler.')
        .addStringOption((o) => o.setName('hedef_id').setDescription('Yedeğin yükleneceği sunucu').setRequired(true).setAutocomplete(true))
        .addAttachmentOption((o) => o.setName('dosya').setDescription('/yedek al ile aldığın .json yedek dosyası').setRequired(true))
        .addBooleanOption((o) => o.setName('temizle').setDescription('DİKKAT: Hedefteki tüm kanalları ve rolleri önce siler'))
        .addBooleanOption((o) => o.setName('emoji').setDescription('Yedekteki emojileri ve çıkartmaları da yükle'))
        .addBooleanOption((o) => o.setName('kuru_calistirma').setDescription('Hiçbir şey yapma, sadece ne yapılacağını listele')),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  autocomplete: sunucuOtomatik,

  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return interaction.options.getSubcommand() === 'al' ? al(interaction, client) : yukle(interaction, client);
  },
};
