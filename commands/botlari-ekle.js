// /botlari-ekle kaynak_id hedef_id [haric] : kaynaktaki tüm botların hedefe ekleme linklerini düz liste olarak yollar.
// Botlar, Discord'un bot için oluşturduğu "yönetilen rol" üzerinden bulunur (üye listesi okunmaz).
const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { sunucuGetir } = require('../utils/sunucu');
const { sunucuOtomatik } = require('../utils/yardimci');

const MESAJ_LIMITI = 1900;

const davetLinki = (botId, izin, hedefId) =>
  `https://discord.com/oauth2/authorize?client_id=${botId}&scope=bot%20applications.commands&permissions=${izin}&guild_id=${hedefId}&disable_guild_select=true`;

const norm = (s) => s.trim().toLocaleLowerCase('tr');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botlari-ekle')
    .setDescription('Kaynak sunucudaki botların hedef sunucuya ekleme linklerini gönderir.')
    .addStringOption((o) => o.setName('kaynak_id').setDescription('Botların alınacağı (kaynak) sunucu').setRequired(true).setAutocomplete(true))
    .addStringOption((o) => o.setName('hedef_id').setDescription('Botların ekleneceği (hedef) sunucu').setRequired(true).setAutocomplete(true))
    .addStringOption((o) => o.setName('haric').setDescription('Eklenmeyecek botların adları, virgülle ayır (örn: FRPM Manager, MEE6)'))
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

    const haric = new Set((interaction.options.getString('haric') || '').split(',').map(norm).filter(Boolean));
    await Promise.all([kaynak.roles.fetch(), hedef.roles.fetch()]);
    const hedefteki = new Set([...hedef.roles.cache.values()].map((r) => r.tags?.botId).filter(Boolean));

    const adaylar = [...kaynak.roles.cache.values()]
      .filter((r) => r.tags?.botId && r.tags.botId !== client.user.id)
      .sort((a, b) => b.position - a.position);

    const eklenecek = [];
    const zatenEkli = [];
    const atlanan = [];
    for (const r of adaylar) {
      const kullanici = await client.users.fetch(r.tags.botId).catch(() => null);
      const ad = kullanici?.username || r.name;
      if (haric.has(norm(ad)) || haric.has(norm(r.name))) atlanan.push(ad);
      else if (hedefteki.has(r.tags.botId)) zatenEkli.push(ad);
      else eklenecek.push(`**${ad}**: ${davetLinki(r.tags.botId, r.permissions.bitfield.toString(), hedef.id)}`);
    }

    if (adaylar.length === 0) return interaction.editReply('ℹ️ Kaynak sunucuda (bizim bot dışında) bot bulunamadı.');

    const ozet =
      `🤖 **${kaynak.name}** → **${hedef.name}**\n` +
      `➕ Eklenecek: ${eklenecek.length}` +
      (zatenEkli.length ? ` • ✅ Zaten ekli: ${zatenEkli.join(', ')}` : '') +
      (atlanan.length ? ` • ⏭️ Hariç tutulan: ${atlanan.join(', ')}` : '') +
      '\nLinklere sırayla tıklayıp **Yetkilendir**\'e bas. Özel botların linki çalışmayabilir.';

    // Mesaj sınırına takılmamak için parçalara böl; linklerin önizlemesi kapalı (<...>) olsun
    const parcalar = [];
    let simdiki = '';
    for (const satir of eklenecek.map((s) => s.replace(/: (https:\S+)$/, ': <$1>'))) {
      if ((simdiki + '\n' + satir).length > MESAJ_LIMITI) {
        parcalar.push(simdiki);
        simdiki = '';
      }
      simdiki += (simdiki ? '\n' : '') + satir;
    }
    if (simdiki) parcalar.push(simdiki);

    await interaction.editReply({ content: ozet, flags: MessageFlags.SuppressEmbeds });
    for (const p of parcalar) await interaction.followUp({ content: p, flags: MessageFlags.Ephemeral | MessageFlags.SuppressEmbeds });
  },
};
