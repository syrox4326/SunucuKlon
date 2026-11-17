// /toplu rol ver rol [hedef_rol] : herkese veya belirli bir role sahip üyelere rol verir. (Admin ve üstü)
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { RENK, hata } = require('../utils/tasarim');
const { rolHatasi } = require('../utils/yetki');
const { topluCalistir, mesgulMu } = require('../utils/toplu');

module.exports = {
  yetki: { enAzRol: 'Admin' },
  data: new SlashCommandBuilder()
    .setName('toplu')
    .setDescription('Toplu işlemler.')
    .addSubcommandGroup((g) =>
      g
        .setName('rol')
        .setDescription('Toplu rol işlemleri.')
        .addSubcommand((s) =>
          s
            .setName('ver')
            .setDescription('Herkese veya belirli bir role sahip üyelere rol verir.')
            .addRoleOption((o) => o.setName('rol').setDescription('Verilecek rol').setRequired(true))
            .addRoleOption((o) => o.setName('hedef_rol').setDescription('Sadece bu role sahip üyelere ver (boşsa herkese)')),
        ),
    )
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction, client) {
    const gizli = { flags: MessageFlags.Ephemeral };
    const rol = interaction.options.getRole('rol');
    const hedefRol = interaction.options.getRole('hedef_rol');
    const reddet = (m) => interaction.reply({ embeds: [hata(m)], ...gizli });

    const sorun = rolHatasi(interaction, rol);
    if (sorun) return reddet(sorun);
    if (hedefRol && hedefRol.id === rol.id) return reddet('Verilecek rol ile hedef rol aynı olamaz.');
    if (mesgulMu(interaction.guildId)) return reddet('Bu sunucuda zaten devam eden bir toplu işlem var.');

    await interaction.deferReply(gizli);
    const uyeler = await interaction.guild.members.fetch();
    const hedefler = [];
    const sayac = { bot: 0, zatenVar: 0, kapsamDisi: 0, yonetemiyorum: 0 };
    for (const u of uyeler.values()) {
      if (u.user.bot) sayac.bot++;
      else if (hedefRol && !u.roles.cache.has(hedefRol.id)) sayac.kapsamDisi++;
      else if (u.roles.cache.has(rol.id)) sayac.zatenVar++;
      else if (!u.manageable) sayac.yonetemiyorum++;
      else hedefler.push(u);
    }
    if (hedefler.length === 0) return interaction.editReply({ embeds: [hata('Rol verilecek üye bulunamadı. Herkes ya zaten bu role sahip ya da kapsam dışı.')] });

    const kapsam = hedefRol ? `${hedefRol} rolüne sahip üyelerden` : 'sunucudaki üyelerden';
    const ozet = [
      `${kapsam} **${hedefler.length}** kişiye ${rol} rolü verilecek.`,
      '',
      `> • **Rol verilecek üye:** ${hedefler.length}`,
      `> • **Zaten bu role sahip:** ${sayac.zatenVar}`,
      hedefRol ? `> • **Hedef role sahip olmayan (kapsam dışı):** ${sayac.kapsamDisi}` : null,
      `> • **Botlar:** ${sayac.bot}`,
      `> • **Botun yönetemediği üyeler:** ${sayac.yonetemiyorum}`,
    ].filter((x) => x !== null).join('\n');

    return topluCalistir(interaction, client, {
      baslik: 'Toplu rol verme',
      ozet,
      butonYazisi: `${hedefler.length} kişiye rolü ver`,
      hedefler,
      renk: RENK.unmute,
      uygula: (u) => u.roles.add(rol, `Toplu rol verme: ${interaction.user.tag}`),
    });
  },
};
