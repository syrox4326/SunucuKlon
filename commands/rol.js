// /rol ver kullanici rol : seçilen üyeye rol verir. (Admin ve üstü)
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { RENK, taslak, alan, uyeSatiri, hata, bilgi } = require('../utils/tasarim');
const { rolHatasi } = require('../utils/yetki');

module.exports = {
  yetki: { enAzRol: 'Admin' },
  data: new SlashCommandBuilder()
    .setName('rol')
    .setDescription('Rol işlemleri.')
    .addSubcommand((s) =>
      s
        .setName('ver')
        .setDescription('Bir üyeye rol verir.')
        .addUserOption((o) => o.setName('kullanici').setDescription('Rol verilecek üye').setRequired(true))
        .addRoleOption((o) => o.setName('rol').setDescription('Verilecek rol').setRequired(true)),
    )
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction, client) {
    const kullanici = interaction.options.getUser('kullanici');
    const rol = interaction.options.getRole('rol');
    const uye = interaction.options.getMember('kullanici');
    const reddet = (m) => interaction.reply({ embeds: [hata(m)], flags: MessageFlags.Ephemeral });

    if (!uye) return reddet('Bu kişi sunucuda değil.');
    const sorun = rolHatasi(interaction, rol);
    if (sorun) return reddet(sorun);
    if (uye.roles.cache.has(rol.id)) return interaction.reply({ embeds: [bilgi(`${uye} zaten **${rol.name}** rolüne sahip.`)], flags: MessageFlags.Ephemeral });

    await interaction.deferReply();
    try {
      await uye.roles.add(rol, `Rol verildi: ${interaction.user.tag}`);
      const e = taslak(client, RENK.unmute, 'Rol verildi')
        .setThumbnail(kullanici.displayAvatarURL())
        .addFields(alan('Üye', uyeSatiri(kullanici)), alan('Verilen rol', `${rol}`), alan('Yetkili', `${interaction.user}`));
      return interaction.editReply({ embeds: [e], allowedMentions: { parse: [] } });
    } catch (e) {
      console.error('[rol ver]', e);
      return interaction.editReply({ embeds: [hata('Rol verilemedi: ' + e.message)] });
    }
  },
};
