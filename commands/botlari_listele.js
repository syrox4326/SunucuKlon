// /botlari_listele kaynak_id hedef_id : kaynaktaki botları bulur, hedefe ekleme linkleri üretir
// Not: Sadece "Guilds" intent'i kullanıldığı için üye listesi okunamaz. Botlar,
// Discord'un bot için otomatik oluşturduğu "yönetilen rol" üzerinden bulunur.
const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, PermissionFlagsBits,
} = require('discord.js');
const { sunucuGetir } = require('../utils/sunucu');
const { izinAdlari, kisalt, sunucuOtomatik } = require('../utils/yardimci');

const SAYFA_BOYUTU = 5;
const ACIKLAMA =
  'Linklere sırayla tıklayıp yetkilendirin. Botların kendi ayarları kopyalanmaz. Özel botların linki çalışmayabilir.';

function davetLinki(botId, izin, hedefId) {
  return `https://discord.com/oauth2/authorize?client_id=${botId}&scope=bot%20applications.commands&permissions=${izin}&guild_id=${hedefId}&disable_guild_select=true`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botlari_listele')
    .setDescription('Kaynak sunucudaki botları listeler ve hedef sunucuya ekleme linkleri üretir.')
    .addStringOption((o) => o.setName('kaynak_id').setDescription('Botların aranacağı (kaynak) sunucunun ID\'si').setRequired(true).setAutocomplete(true))
    .addStringOption((o) => o.setName('hedef_id').setDescription('Botların ekleneceği (hedef) sunucunun ID\'si').setRequired(true).setAutocomplete(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  autocomplete: sunucuOtomatik,

  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    let kaynak, hedef;
    try {
      kaynak = await sunucuGetir(client, interaction.options.getString('kaynak_id'), 'Kaynak sunucu');
      hedef = await sunucuGetir(client, interaction.options.getString('hedef_id'), 'Hedef sunucu');
    } catch (e) {
      return interaction.editReply('❌ ' + e.message);
    }

    await Promise.all([kaynak.roles.fetch(), hedef.roles.fetch()]);
    const hedefteki = new Set([...hedef.roles.cache.values()].map((r) => r.tags?.botId).filter(Boolean));

    // Kaynaktaki bot rollerini bul (kendi botumuz hariç)
    const botRolleri = [...kaynak.roles.cache.values()].filter((r) => r.tags?.botId && r.tags.botId !== client.user.id);
    if (botRolleri.length === 0) {
      return interaction.editReply(
        'ℹ️ Kaynak sunucuda (bizim bot dışında) yönetilen rolü olan bir bot bulunamadı.\n' +
          'Not: Hiç izni olmayan ve rol almamış botlar bu yöntemle görülemez.',
      );
    }

    // Bot adlarını öğrenmeye çalış (olmazsa rol adı kullanılır)
    const botlar = [];
    for (const rol of botRolleri) {
      const id = rol.tags.botId;
      const kullanici = await client.users.fetch(id).catch(() => null);
      const izin = rol.permissions.bitfield.toString();
      const adlar = izinAdlari(izin);
      botlar.push({
        ad: kullanici?.username || rol.name,
        id,
        izin,
        izinYazisi: adlar.includes('Yönetici') ? 'Yönetici (tüm izinler)' : adlar.length ? kisalt(adlar.slice(0, 8).join(', ') + (adlar.length > 8 ? ` +${adlar.length - 8} izin daha` : ''), 300) : 'Özel izin yok',
        ekli: hedefteki.has(id),
      });
    }
    botlar.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));

    const sayfaSayisi = Math.ceil(botlar.length / SAYFA_BOYUTU);
    const sayfaUret = (n) => {
      const e = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🤖 ${kaynak.name} sunucusundaki botlar`)
        .setDescription(`${ACIKLAMA}\n\n**Hedef:** ${hedef.name} • **Toplam:** ${botlar.length} bot`)
        .setFooter({ text: `Sayfa ${n + 1}/${sayfaSayisi}` });
      for (const b of botlar.slice(n * SAYFA_BOYUTU, (n + 1) * SAYFA_BOYUTU)) {
        const link = b.ekli ? '✅ **Zaten ekli**' : `[➕ Hedefe ekle](${davetLinki(b.id, b.izin, hedef.id)})`;
        e.addFields({ name: `${b.ekli ? '✅ ' : ''}${kisalt(b.ad, 200)}`, value: kisalt(`ID: \`${b.id}\`\nİzinler: ${b.izinYazisi}\n${link}`, 1000) });
      }
      return e;
    };
    const dugmeler = (n) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('onceki').setLabel('◀ Önceki').setStyle(ButtonStyle.Secondary).setDisabled(n === 0),
        new ButtonBuilder().setCustomId('sonraki').setLabel('Sonraki ▶').setStyle(ButtonStyle.Secondary).setDisabled(n >= sayfaSayisi - 1),
      );

    let sayfa = 0;
    const mesaj = await interaction.editReply({ embeds: [sayfaUret(sayfa)], components: sayfaSayisi > 1 ? [dugmeler(sayfa)] : [] });
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
