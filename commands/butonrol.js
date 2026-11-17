// /butonrol kanal rol mesaj [buton_yazisi] : seçilen kanala butonlu mesaj gönderir; butona basan rolü alır. (Admin ve üstü)
const {
  SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const { RENK, hata, bilgi } = require('../utils/tasarim');
const { sahipMi } = require('../utils/yetki');
const { ONEK } = require('../utils/butonrol');

module.exports = {
  yetki: { enAzRol: 'Admin' },
  data: new SlashCommandBuilder()
    .setName('butonrol')
    .setDescription('Kanala butonlu rol mesajı gönderir; butona basan rolü alır.')
    .addChannelOption((o) =>
      o.setName('kanal').setDescription('Mesajın gönderileceği kanal').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    )
    .addRoleOption((o) => o.setName('rol').setDescription('Butona basana verilecek rol').setRequired(true))
    .addStringOption((o) => o.setName('mesaj').setDescription('Mesajın metni (satır atlamak için \n yaz)').setRequired(true).setMaxLength(2000))
    .addStringOption((o) => o.setName('buton_yazisi').setDescription('Butonun üzerindeki yazı (boşsa rolün adı)').setMaxLength(80))
    .setDefaultMemberPermissions(null)
    .setDMPermission(false),

  async execute(interaction, client) {
    const kanal = interaction.options.getChannel('kanal');
    const rol = interaction.options.getRole('rol');
    const metin = interaction.options.getString('mesaj').replaceAll('\n', '\n');
    const butonYazisi = interaction.options.getString('buton_yazisi') || rol.name;
    const reddet = (m) => interaction.reply({ embeds: [hata(m)], flags: MessageFlags.Ephemeral });

    // Rol kontrolleri: kimse kendinden yüksek bir rolü butonla dağıtamasın, bot da veremeyeceği rolü sunmasın
    if (rol.id === interaction.guildId) return reddet('@everyone rolü için buton oluşturulamaz.');
    if (rol.managed) return reddet('Bot veya entegrasyon rolleri verilemez.');
    if (!sahipMi(interaction.user.id) && rol.position >= interaction.member.roles.highest.position) {
      return reddet('Kendi en yüksek rolüne eşit veya ondan yüksek bir rol için buton oluşturamazsın.');
    }
    if (rol.position >= interaction.guild.members.me.roles.highest.position) {
      return reddet(`Botun rolü **${rol.name}** rolünün üstünde değil, bu rolü veremem. Sunucu Ayarları > Roller'den bot rolünü yukarı taşı.`);
    }
    const izinler = kanal.permissionsFor(interaction.guild.members.me);
    if (!izinler?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
      return reddet(`Botun ${kanal} kanalında mesaj gönderme izni yok.`);
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const embed = new EmbedBuilder().setColor(rol.color || RENK.bilgi).setDescription(metin);
      const satir = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(ONEK + rol.id).setLabel(butonYazisi).setStyle(ButtonStyle.Primary),
      );
      const mesaj = await kanal.send({ embeds: [embed], components: [satir], allowedMentions: { parse: [] } });
      return interaction.editReply({ embeds: [bilgi(`Butonlu mesaj ${kanal} kanalına gönderildi. [Mesaja git](${mesaj.url})\nButona basan **${rol.name}** rolünü alır, tekrar basarsa rol geri alınır.`)] });
    } catch (e) {
      console.error('[butonrol]', e);
      return interaction.editReply({ embeds: [hata('Mesaj gönderilemedi: ' + e.message)] });
    }
  },
};
